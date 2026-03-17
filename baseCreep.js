/**
 * Base Creep Module
 * Functional approach to creep behavior management
 *
 * Architecture:
 * - Pure functions for calculations and decisions
 * - Effectful functions clearly marked for game state modifications
 * - Composable action handlers
 */

const utils = require("./utils");
const stats = require("./stats");

// ============================================================================
// Constants
// ============================================================================

const CRITICAL_HITS = 1000;
const WALL_MIN_HITS = 1000000;
const RAMPART_MIN_HEALTH_PERCENT = 0.5;
const STRUCTURE_MIN_HEALTH_PERCENT = 0.5;

const ACTION_ICONS = {
  gathering: "🔄",
  building: "🚧",
  repairing: "🛠",
  upgrading: "⚡",
  harvesting: "⛏",
  claiming: "📜",
  attacking: "⚔️",
  transporting: "📦",
  mining: "⛏️",
  hauling: "🚚",
  delivering: "📬",
  deconstructing: "🔨",
};

const PATH_COLORS = {
  gathering: "#ffaa00",
  building: "#ffffff",
  repairing: "#00ff22",
  upgrading: "#ffaa00",
  harvesting: "#0004ff",
  attacking: "#ff0000",
  transporting: "#ff8800",
  mining: "#ffaa00",
  hauling: "#00aaff",
  delivering: "#0004ff",
  deconstructing: "#ff6600",
};

// ============================================================================
// Pure Functions - Creep Analysis
// ============================================================================

/**
 * Check if creep is a fighter (has attack parts)
 * Pure function
 * @param {Creep} creep
 * @returns {boolean} True if creep has ATTACK or RANGED_ATTACK parts
 */
const isFighter = (creep) =>
  creep.body.some(
    (part) => part.type === ATTACK || part.type === RANGED_ATTACK,
  );

// ============================================================================
// Pure Functions - Target Finding & Sorting
// ============================================================================

/**
 * Find walls that need repair
 * Pure function
 * @param {Room} room
 * @returns {Array} Wall structures below minimum hits
 */
const findWallsNeedingRepair = (room) =>
  room.find(FIND_STRUCTURES, {
    filter: (s) => s.structureType === STRUCTURE_WALL && s.hits < WALL_MIN_HITS,
  });

/**
 * Find ramparts that need repair
 * Pure function
 * @param {Room} room
 * @returns {Array} Rampart structures below health threshold
 */
const findRampartsNeedingRepair = (room) =>
  room.find(FIND_STRUCTURES, {
    filter: (s) =>
      s.structureType === STRUCTURE_RAMPART &&
      s.hits < s.hitsMax * RAMPART_MIN_HEALTH_PERCENT,
  });

/**
 * Find non-wall structures that need repair
 * Pure function
 * @param {Room} room
 * @returns {Array} Structures below health threshold
 */
const findStructuresNeedingRepair = (room) =>
  room.find(FIND_STRUCTURES, {
    filter: (s) =>
      s.structureType !== STRUCTURE_WALL &&
      s.structureType !== STRUCTURE_RAMPART &&
      s.hits < s.hitsMax * STRUCTURE_MIN_HEALTH_PERCENT,
  });

/**
 * Calculate repair priority score for a target
 * Lower score = higher priority
 * Pure function
 * @param {Creep} creep
 * @param {Structure} target
 * @returns {number} Priority score
 */
const calculateRepairScore = (creep, target) => {
  const distance = creep.pos.getRangeTo(target);
  const isCritical = target.hits < CRITICAL_HITS ? -1000000 : 0;
  return target.hits * (1 + distance / 50) + isCritical;
};

/**
 * Find and sort all repair targets by priority
 * Pure function
 * @param {Creep} creep
 * @returns {Array} Sorted repair targets
 */
const findRepairTargets = (creep) => {
  const { room } = creep;

  const allTargets = [
    ...findStructuresNeedingRepair(room),
    ...findWallsNeedingRepair(room),
    ...findRampartsNeedingRepair(room),
  ];

  return allTargets.sort(
    (a, b) => calculateRepairScore(creep, a) - calculateRepairScore(creep, b),
  );
};

/**
 * Filter targets to only critical repairs
 * Pure function
 * @param {Array} targets
 * @returns {Array} Critical repair targets
 */
const filterCriticalRepairs = (targets) =>
  targets.filter((t) => t.hits < CRITICAL_HITS);

/**
 * Count creeps targeting a specific object
 * Pure function
 * @param {string} targetId
 * @returns {number} Count of creeps targeting this object
 */
const countCreepsTargeting = (targetId) =>
  Object.values(Game.creeps).filter(
    (creep) =>
      creep.memory.actionTarget && creep.memory.actionTarget.id === targetId,
  ).length;

/**
 * Prioritize construction sites by type when multiple types exist
 * Extensions are prioritized first when there are multiple types
 * Pure function
 * @param {Array} constructionSites
 * @returns {Array} Sorted construction sites with extensions first if multiple types
 */
const prioritizeConstructionSites = (constructionSites) => {
  const types = new Set(constructionSites.map((s) => s.structureType));

  // Only prioritize if there are multiple types
  if (types.size <= 1) {
    return constructionSites;
  }

  // Sort with extensions first
  return [...constructionSites].sort((a, b) => {
    const aIsExtension = a.structureType === STRUCTURE_EXTENSION ? 0 : 1;
    const bIsExtension = b.structureType === STRUCTURE_EXTENSION ? 0 : 1;
    return aIsExtension - bIsExtension;
  });
};

/**
 * Find structure at deconstruct flag for deconstruction
 * Pure function
 * @param {Room} room
 * @returns {Object|null} Structure at deconstruct flag or null
 */
const findDeconstructTarget = (room) => {
  const deconstructFlag = Game.flags['deconstruct'];
  if (!deconstructFlag) {
    return null;
  }

  // Only consider flags in the same room
  if (deconstructFlag.pos.roomName !== room.name) {
    return null;
  }

  // Find structure at flag position
  const structures = deconstructFlag.pos.lookFor(LOOK_STRUCTURES);
  if (structures.length > 0) {
    // Filter out structures that can't be deconstructed (like controller)
    const deconstructible = structures.filter(
      (s) => s.structureType !== STRUCTURE_CONTROLLER
    );
    return deconstructible.length > 0 ? deconstructible[0] : null;
  }

  return null;
};

/**
 * Find and prioritize attack targets for fighters
 * Prioritizes enemy creeps first, then targets marked by attack flag
 * Pure function
 * @param {Creep} creep
 * @returns {Object|null} Highest priority attack target or null
 */
const findPrioritizedAttackTarget = (creep) => {
  // Priority 1: Always look for enemy creeps first (highest priority)
  const hostileCreeps = creep.room.find(FIND_HOSTILE_CREEPS);
  if (hostileCreeps.length > 0) {
    // Sort by distance and return closest
    return creep.pos.findClosestByPath(hostileCreeps) || hostileCreeps[0];
  }

  // Priority 2: Check for attack flag to target structures
  const attackFlag = Game.flags['attack'];
  if (!attackFlag) {
    return null;
  }

  // Find the structure at the flag's position
  const flagPos = attackFlag.pos;
  const structuresAtFlag = flagPos.lookFor(LOOK_STRUCTURES);
  
  // If there's a structure at the flag position, target it specifically
  // This includes walls, ramparts, and any other structure type
  if (structuresAtFlag.length > 0) {
    // Prioritize non-wall structures if multiple exist at same position
    const nonWallStructure = structuresAtFlag.find(
      (s) => s.structureType !== STRUCTURE_WALL && s.structureType !== STRUCTURE_RAMPART
    );
    return nonWallStructure || structuresAtFlag[0];
  }
  
  // If no structure at flag, find all potential targets in the room
  const hostileStructures = creep.room.find(FIND_HOSTILE_STRUCTURES);
  
  // Also include walls and ramparts as valid targets when attack flag is present
  const walls = creep.room.find(FIND_STRUCTURES, {
    filter: (s) =>
      s.structureType === STRUCTURE_WALL || s.structureType === STRUCTURE_RAMPART,
  });
  
  const allStructureTargets = [...hostileStructures, ...walls];
  
  if (allStructureTargets.length === 0) {
    return null;
  }
  
  // Structure priority mapping (lower = higher priority)
  const structurePriority = {
    [STRUCTURE_SPAWN]: 1,
    [STRUCTURE_TOWER]: 2,
    [STRUCTURE_EXTENSION]: 3,
    [STRUCTURE_WALL]: 5,
    [STRUCTURE_RAMPART]: 5,
  };
  
  // Sort by priority, then by distance
  allStructureTargets.sort((a, b) => {
    const priorityA = structurePriority[a.structureType] || 4;
    const priorityB = structurePriority[b.structureType] || 4;
    
    if (priorityA !== priorityB) {
      return priorityA - priorityB;
    }
    
    // Same priority - sort by distance
    return creep.pos.getRangeTo(a) - creep.pos.getRangeTo(b);
  });
  
  return allStructureTargets[0];
};

/**
 * Sort targets by least contention and distance
 * Pure function - distributes creeps across targets
 * @param {Creep} creep
 * @param {Array} targets
 * @param {boolean} considerCurrentSorting - If true, considers original list order in scoring
 * @returns {Array} Sorted targets
 */
const sortByContention = (creep, targets, considerCurrentSorting = false) => {
  const scored = targets.map((target, index) => ({
    target,
    creepsTargeting: countCreepsTargeting(target.id),
    distance: creep.pos.getRangeTo(target),
    originalIndex: index,
  }));

  // When considerCurrentSorting is true, original index is the primary factor
  const originalIndexWeight = considerCurrentSorting ? 10000 : 0;
  const creepsTargetingWeight = 100;
  const distanceWeight = 1;

  return scored
    .sort((a, b) => {
      // Weighted index: original order (weight 10000 when enabled) + contention (weight 100) + distance (weight 1)
      const scoreA =
        a.originalIndex * originalIndexWeight +
        a.creepsTargeting * creepsTargetingWeight +
        a.distance * distanceWeight;
      const scoreB =
        b.originalIndex * originalIndexWeight +
        b.creepsTargeting * creepsTargetingWeight +
        b.distance * distanceWeight;
      return scoreA - scoreB;
    })
    .map((s) => s.target);
};

/**
 * Find energy deposit targets (spawns, extensions, towers)
 * Pure function
 * @param {Room} room
 * @returns {Array} Structures that can receive energy
 */
const findEnergyDepositTargets = (room) =>
  room.find(FIND_STRUCTURES, {
    filter: (s) =>
      (s.structureType === STRUCTURE_EXTENSION ||
        s.structureType === STRUCTURE_SPAWN ||
        s.structureType === STRUCTURE_TOWER) &&
      s.store.getFreeCapacity(RESOURCE_ENERGY) > 0,
  });

// ============================================================================
// Pure Functions - Action Decision
// ============================================================================

/**
 * Check if creep needs to gather resources
 * Pure function
 * @param {Creep} creep
 * @returns {boolean}
 */
const needsToGather = (creep) =>
  creep.store[RESOURCE_ENERGY] === 0 ||
  (creep.memory.action === undefined && creep.store.getFreeCapacity() > 0);

/**
 * Check if creep has finished gathering
 * Pure function
 * @param {Creep} creep
 * @returns {boolean}
 */
const hasFinishedGathering = (creep) =>
  (creep.memory.action === "gathering" || creep.memory.action === undefined) &&
  creep.store.getFreeCapacity() === 0;

/**
 * Determine action availability
 * Pure function - returns object describing what actions are possible
 * @param {Creep} creep
 * @returns {Object} Action availability map
 */
const getActionAvailability = (creep) => {
  const { room } = creep;
  const repairTargets = findRepairTargets(creep);
  const criticalRepairs = filterCriticalRepairs(repairTargets);
  const constructionSites = room.find(FIND_CONSTRUCTION_SITES);
  const energyAvailable = room.energyAvailable;
  const energyCapacity = room.energyCapacityAvailable;

  // Check for storage and containers at 50% capacity for transporting
  const storage = room.find(FIND_STRUCTURES, {
    filter: (s) => s.structureType === STRUCTURE_STORAGE,
  })[0];
  const containersWithEnergy = room.find(FIND_STRUCTURES, {
    filter: (s) =>
      s.structureType === STRUCTURE_CONTAINER &&
      s.store[RESOURCE_ENERGY] >= s.store.getCapacity(RESOURCE_ENERGY) * 0.5,
  });

  // Check for mining opportunities (sources exist and creep has assigned source)
  const sources = room.find(FIND_SOURCES_ACTIVE);
  const hasMiningTarget = creep.memory.assignedSource || sources.length > 0;

  // Check for hauling opportunities (containers with energy or dropped resources)
  const containersForHauling = room.find(FIND_STRUCTURES, {
    filter: (s) =>
      s.structureType === STRUCTURE_CONTAINER && s.store[RESOURCE_ENERGY] > 0,
  });
  const droppedEnergy = room.find(FIND_DROPPED_RESOURCES, {
    filter: (r) => r.resourceType === RESOURCE_ENERGY && r.amount > 50,
  });
  const hasHaulingTarget =
    containersForHauling.length > 0 || droppedEnergy.length > 0;

  // Check for delivery targets (spawns/extensions/towers/storage needing energy)
  const deliveryTargets = room.find(FIND_STRUCTURES, {
    filter: (s) =>
      (s.structureType === STRUCTURE_SPAWN ||
        s.structureType === STRUCTURE_EXTENSION ||
        s.structureType === STRUCTURE_TOWER ||
        s.structureType === STRUCTURE_STORAGE) &&
      s.store.getFreeCapacity(RESOURCE_ENERGY) > 0,
  });
  const hasDeliveryTarget = deliveryTargets.length > 0;

  // Check for deconstruct target
  const deconstructTarget = findDeconstructTarget(room);
  const hasDeconstructTarget = deconstructTarget !== null;

  return {
    repairCritical: criticalRepairs.length > 0,
    building: constructionSites.length > 0,
    repairing: repairTargets.length > 0,
    harvesting: energyAvailable < energyCapacity,
    transporting: storage && containersWithEnergy.length > 0,
    mining: hasMiningTarget,
    hauling:
      hasHaulingTarget && creep.store.getFreeCapacity(RESOURCE_ENERGY) > 0,
    delivering: hasDeliveryTarget && creep.store[RESOURCE_ENERGY] > 0,
    deconstructing: hasDeconstructTarget,
    upgrading: true, // Always available as fallback
    // Include targets for immediate use
    targets: {
      criticalRepairs,
      repairTargets,
      constructionSites,
      storage,
      containersWithEnergy,
      sources,
      containersForHauling,
      droppedEnergy,
      deliveryTargets,
      deconstructTarget,
    },
  };
};

/**
 * Select the best build target from construction sites
 * Prioritizes extensions when multiple types exist, then sorts by contention
 * Pure function
 * @param {Creep} creep
 * @param {Array} constructionSites
 * @returns {Object} { id, pos } of selected target
 */
const selectBuildTarget = (creep, constructionSites) => {
  const prioritizedSites = prioritizeConstructionSites(constructionSites);
  const targets = sortByContention(creep, prioritizedSites, true);
  if (targets.length === 0) {
    return null;
  }
  const target = targets[0];
  return { id: target.id, pos: target.pos };
};

/**
 * Select action and target based on priority list
 * Pure function - returns decision without side effects
 * @param {Creep} creep
 * @param {Array} priorityList
 * @returns {Object} { action, target }
 */
const selectAction = (creep, priorityList) => {
  const availability = getActionAvailability(creep);
  const { targets } = availability;

  // Critical repairs always take priority
  if (availability.repairCritical) {
    const target = targets.criticalRepairs[0];
    return {
      action: "repairing",
      target: { id: target.id, pos: target.pos },
    };
  }

  // Check priority list
  for (const action of priorityList) {
    if (action === "attacking") {
      // Attacking is handled separately in workerActions combat check
      // Skip it here in selectAction
      continue;
    }
    if (action === "building" && availability.building) {
      const target = selectBuildTarget(creep, targets.constructionSites);
      if (!target) {
        continue; // No valid build targets, check next action
      }
      return {
        action: "building",
        target,
      };
    }
    if (action === "repairing" && availability.repairing) {
      const target = targets.repairTargets[0];
      return {
        action: "repairing",
        target: { id: target.id, pos: target.pos },
      };
    }
    if (action === "harvesting" && availability.harvesting) {
      return { action: "harvesting", target: null };
    }
    if (action === "transporting" && availability.transporting) {
      return {
        action: "transporting",
        target: { id: targets.storage.id, pos: targets.storage.pos },
      };
    }
    if (action === "mining" && availability.mining) {
      return { action: "mining", target: null };
    }
    if (action === "hauling" && availability.hauling) {
      return { action: "hauling", target: null };
    }
    if (action === "delivering" && availability.delivering) {
      return { action: "delivering", target: null };
    }
    if (action === "deconstructing" && availability.deconstructing) {
      const target = targets.deconstructTarget;
      return {
        action: "deconstructing",
        target: { id: target.id, pos: target.pos },
      };
    }
    if (action === "upgrading") {
      return { action: "upgrading", target: null };
    }
  }

  // Default fallback
  return { action: "upgrading", target: null };
};

/**
 * Placeholder for worker role check - can be expanded with actual logic
 * @param {Creep} creep
 * @returns
 */
const isWorker = (creep) => true;
// ============================================================================
// Effectful Functions - Game State Modifications
// ============================================================================

/**
 * Display action icon above creep
 * Effectful function
 * @param {Creep} creep
 * @param {string} action
 */
const sayAction = (creep, action) => {
  const icon = ACTION_ICONS[action] || "";
  creep.say(`${icon} ${action}`);
};

/**
 * Move creep towards target with path visualization
 * Effectful function
 * @param {Creep} creep
 * @param {RoomObject} target
 * @param {string} color - Path stroke color
 */
const moveToTarget = (creep, target, color = "#ffffff") => {
  const options = { visualizePathStyle: { stroke: color } };

  // Non-fighters avoid enemy creeps
  if (!isFighter(creep) && utils.areThereInvaders(creep.room)) {
    options.costCallback = (roomName, costMatrix) => {
      const room = Game.rooms[roomName];
      if (room) {
        const hostiles = room.find(FIND_HOSTILE_CREEPS);
        hostiles.forEach((hostile) => {
          // Increase cost around hostile creeps (3x3 area)
          for (let x = -1; x <= 1; x++) {
            for (let y = -1; y <= 1; y++) {
              const posX = hostile.pos.x + x;
              const posY = hostile.pos.y + y;
              if (posX >= 0 && posX < 50 && posY >= 0 && posY < 50) {
                costMatrix.set(posX, posY, 0xff);
              }
            }
          }
        });
      }
      return costMatrix;
    };
  }

  creep.moveTo(target, options);
};

/**
 * Update creep memory with action and target
 * Effectful function
 * @param {Creep} creep
 * @param {string} action
 * @param {Object|null} target
 */
const setCreepAction = (creep, action, target = null) => {
  creep.memory.action = action;
  if (target) {
    creep.memory.actionTarget = target;
  } else {
    delete creep.memory.actionTarget;
  }
};

/**
 * Clear creep action state
 * Effectful function
 * @param {Creep} creep
 */
const clearCreepAction = (creep) => {
  creep.memory.action = undefined;
  delete creep.memory.actionTarget;
};

// ============================================================================
// Action Handlers - Composed Effectful Functions
// ============================================================================

/**
 * Select the best source target for gathering
 * Pure function
 * @param {Creep} creep
 * @returns {Object|null} { id, pos } of selected source or null if none available
 */
const selectGatheringTarget = (creep) => {
  // Upgraders preferentially pick energy from storage
  if (creep.memory.role === "upgrader") {
    const storage = creep.room.find(FIND_STRUCTURES, {
      filter: (s) =>
        s.structureType === STRUCTURE_STORAGE && s.store[RESOURCE_ENERGY] > 0,
    })[0];

    if (storage) {
      return { id: storage.id, pos: storage.pos };
    }
  }

  const source = utils.findBestSourceForCreep(creep);
  if (!source) {
    return null;
  }
  return { id: source.id, pos: source.pos };
};

/**
 * Select the best container for transporter gathering
 * Pure function - finds containers at 50%+ capacity
 * @param {Creep} creep
 * @returns {Object|null} { id, pos } of selected container or null
 */
const selectTransporterGatheringTarget = (creep) => {
  const containers = creep.room.find(FIND_STRUCTURES, {
    filter: (s) =>
      s.structureType === STRUCTURE_CONTAINER &&
      s.store[RESOURCE_ENERGY] >= s.store.getCapacity(RESOURCE_ENERGY) * 0.5,
  });

  if (containers.length === 0) {
    return null;
  }

  // Sort by energy amount (highest first) and distance
  const sorted = containers.sort((a, b) => {
    const energyDiff = b.store[RESOURCE_ENERGY] - a.store[RESOURCE_ENERGY];
    if (energyDiff !== 0) return energyDiff;
    return creep.pos.getRangeTo(a) - creep.pos.getRangeTo(b);
  });

  return { id: sorted[0].id, pos: sorted[0].pos };
};

/**
 * Handle gathering action
 * Effectful function
 * @param {Creep} creep
 */
const handleGathering = (creep) => {
  const { actionTarget } = creep.memory;
  if (!actionTarget) {
    // No target set, find one and set it
    const target = selectGatheringTarget(creep);
    if (!target) {
      // No gathering targets available
      clearCreepAction(creep);
      return;
    }
    setCreepAction(creep, "gathering", target);
    return;
  }

  const source = Game.getObjectById(actionTarget.id);

  // Source no longer exists (shouldn't happen with sources, but handle gracefully)
  if (!source) {
    clearCreepAction(creep);
    return;
  }

  // Check if the target is a container or storage
  const isContainer =
    source.structureType === STRUCTURE_CONTAINER ||
    source.structureType === STRUCTURE_STORAGE;

  // Check if source is empty
  const isEmpty = isContainer
    ? source.store[RESOURCE_ENERGY] === 0
    : source.energy === 0;

  if (isEmpty) {
    // Source is empty, find a new target
    const newTarget = isContainer
      ? selectTransporterGatheringTarget(creep)
      : selectGatheringTarget(creep);

    if (newTarget) {
      setCreepAction(creep, "gathering", newTarget);
    } else {
      // No alternative targets available, clear action
      clearCreepAction(creep);
    }
    return;
  }

  if (isContainer) {
    // Withdraw from container/storage
    if (creep.withdraw(source, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
      moveToTarget(creep, source, PATH_COLORS.gathering);
    }
  } else {
    // Harvest from source
    const result = creep.harvest(source);
    if (result === ERR_NOT_IN_RANGE) {
      moveToTarget(creep, source, PATH_COLORS.gathering);
    } else if (result === OK) {
      // Track harvested energy (estimate based on WORK parts)
      const workParts = creep.body.filter(p => p.type === WORK).length;
      const harvestAmount = workParts * 2; // Each WORK part harvests 2 energy per tick
      stats.recordHarvest(creep.room.name, source.id, harvestAmount);
    }
  }
};

/**
 * Handle building action
 * Effectful function
 * @param {Creep} creep
 */
const handleBuilding = (creep) => {
  const { actionTarget } = creep.memory;
  if (!actionTarget) {
    clearCreepAction(creep);
    return;
  }

  const target = Game.getObjectById(actionTarget.id);
  const targetPos = actionTarget.pos;

  // Target still exists and needs building
  if (target && target.progress < target.progressTotal) {
    const result = creep.build(target);
    if (result === ERR_NOT_IN_RANGE) {
      moveToTarget(creep, target, PATH_COLORS.building);
    } else if (result === OK) {
      // Track construction work (estimate based on WORK parts)
      const workParts = creep.body.filter(p => p.type === WORK).length;
      const buildAmount = workParts * 5; // Each WORK part builds 5 energy worth per tick
      stats.recordConstruction(creep.room.name, buildAmount);
    }
    return;
  }

  // Construction complete - check if we should switch to repairing
  if (!target && targetPos) {
    const structures = creep.room
      .lookForAt(LOOK_STRUCTURES, targetPos.x, targetPos.y)
      .filter((s) => s.hits < s.hitsMax);

    if (structures.length > 0) {
      console.log(
        `Target construction site ${actionTarget.id} is now a structure. ` +
          `Creep ${creep.name} will switch to repairing it.`,
      );
      setCreepAction(creep, "repairing", {
        id: structures[0].id,
        pos: structures[0].pos,
      });
      return;
    } else {
      const availability = getActionAvailability(creep);
      const { targets } = availability;

      const newTarget = selectBuildTarget(creep, targets.constructionSites);
      if (newTarget) {
        console.log(
          `Target construction site ${actionTarget.id} completed. ` +
            `Creep ${creep.name} will switch to building new target ${newTarget.id}.`,
        );
        setCreepAction(creep, "building", {
          id: newTarget.id,
          pos: newTarget.pos,
        });
        return;
      }
    }

    setCreepAction(creep, "building");
  }

  // Target no longer exists - clear action
  clearCreepAction(creep);
};

/**
 * Handle repairing action
 * Effectful function
 * @param {Creep} creep
 */
const handleRepairing = (creep) => {
  const { actionTarget } = creep.memory;
  if (!actionTarget) {
    clearCreepAction(creep);
    return;
  }

  const target = Game.getObjectById(actionTarget.id);

  // Target exists and needs repair
  if (target && target.hits < target.hitsMax) {
    const result = creep.repair(target);
    if (result === ERR_NOT_IN_RANGE) {
      moveToTarget(creep, target, PATH_COLORS.repairing);
    } else if (result === OK) {
      // Track repair work (estimate based on WORK parts)
      const workParts = creep.body.filter(p => p.type === WORK).length;
      const repairAmount = workParts * 100; // Each WORK part repairs 100 hits per tick
      stats.recordRepair(creep.room.name, repairAmount);
    }
    return;
  }

  // Find next repair target
  console.log(`No repair targets found for creep ${creep.name}`);
  const repairTargets = findRepairTargets(creep);
  if (repairTargets.length > 0) {
    const nextTarget = repairTargets[0];
    setCreepAction(creep, "repairing", {
      id: nextTarget.id,
      pos: nextTarget.pos,
    });
  } else {
    clearCreepAction(creep);
  }
};

/**
 * Handle upgrading action
 * Effectful function
 * @param {Creep} creep
 */
const handleUpgrading = (creep) => {
  const { controller } = creep.room;
  const result = creep.upgradeController(controller);
  if (result === ERR_NOT_IN_RANGE) {
    moveToTarget(creep, controller, PATH_COLORS.upgrading);
  } else if (result === OK) {
    // Track controller upgrade work (based on WORK parts)
    const workParts = creep.body.filter(p => p.type === WORK).length;
    const upgradeAmount = workParts * 1; // Each WORK part upgrades 1 energy per tick
    stats.recordUpgrade(creep.room.name, upgradeAmount);
  }
};

/**
 * Handle harvesting (energy delivery) action
 * Effectful function
 * @param {Creep} creep
 */
const handleHarvesting = (creep) => {
  const { room } = creep;
  const { energyAvailable, energyCapacityAvailable } = room;

  // Check if energy is full - switch to upgrading
  if (energyAvailable >= energyCapacityAvailable) {
    console.log(
      `Energy is full in room ${room.name}. ` +
        `Creep ${creep.name} will switch to upgrading.`,
    );
    setCreepAction(creep, "upgrading", null);
    return;
  }

  const targets = findEnergyDepositTargets(room);
  if (targets.length > 0) {
    if (creep.transfer(targets[0], RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
      moveToTarget(creep, targets[0], PATH_COLORS.harvesting);
    }
  }
};

/**
 * Handle attacking action
 * Effectful function
 * @param {Creep} creep
 */
const handleAttacking = (creep) => {
  const { actionTarget } = creep.memory;
  if (!actionTarget) {
    clearCreepAction(creep);
    return;
  }

  const target = Game.getObjectById(actionTarget.id);

  console.log(`Creep ${creep.name} is attacking target ${actionTarget.id}`);

  // Target no longer exists - clear action
  if (!target) {
    clearCreepAction(creep);
    return;
  }

  // Check what attack parts the creep has
  const hasRangedAttack = creep.body.some((part) => part.type === RANGED_ATTACK);
  const hasMeleeAttack = creep.body.some((part) => part.type === ATTACK);
  const range = creep.pos.getRangeTo(target);

  // Use the most appropriate attack type based on range and available parts
  let attackResult = ERR_NO_BODYPART;
  
  if (hasRangedAttack && range <= 3) {
    // Use ranged attack if in range (1-3 tiles)
    attackResult = creep.rangedAttack(target);
    console.log(`Attack result for ${creep.name} on target ${target.id}: ${attackResult}`);
  } else if (hasMeleeAttack && range === 1) {
    // Use melee attack if adjacent
    attackResult = creep.attack(target);
  }
  
  // If attack was successful or we're in position, we're done
  if (attackResult === OK) {
    return;
  }
  
  // Move closer to target
  if (attackResult === ERR_NOT_IN_RANGE || range > 1) {
    // If we have ranged attack, stay at range 3; if melee only, move to range 1
    const targetRange = hasRangedAttack ? 3 : 1;
    moveToTarget(creep, target, PATH_COLORS.attacking);
  }
};

/**
 * Handle transporting action (move energy from containers to storage)
 * Effectful function
 * @param {Creep} creep
 */
const handleTransporting = (creep) => {
  const { room } = creep;
  const { actionTarget } = creep.memory;

  // Get storage
  const storage = actionTarget ? Game.getObjectById(actionTarget.id) : null;
  if (!storage) {
    clearCreepAction(creep);
    return;
  }

  // Transfer energy to storage
  if (creep.store[RESOURCE_ENERGY] > 0) {
    const result = creep.transfer(storage, RESOURCE_ENERGY);
    if (result === ERR_NOT_IN_RANGE) {
      moveToTarget(creep, storage, PATH_COLORS.transporting);
    } else if (result === OK) {
      // Successfully transferred, clear action to pick up more
      clearCreepAction(creep);
    }
  } else {
    // No energy, clear action to gather more
    clearCreepAction(creep);
  }
};

/**
 * Handle mining action (stationary harvesting at assigned source)
 * Effectful function
 * @param {Creep} creep
 */
const handleMining = (creep) => {
  const { assignedSource } = creep.memory;

  // Get assigned source from memory or find nearest
  let source = null;
  if (assignedSource) {
    source = Game.getObjectById(assignedSource);
  }

  // If no assigned source or source no longer exists, find nearest
  if (!source) {
    const sources = creep.room.find(FIND_SOURCES);
    if (sources.length > 0) {
      source = creep.pos.findClosestByPath(sources);
      if (source) {
        creep.memory.assignedSource = source.id;
      }
    }
  }

  if (!source) {
    // No sources available, this shouldn't happen
    return;
  }

  // Harvest from source
  const result = creep.harvest(source);
  if (result === ERR_NOT_IN_RANGE) {
    moveToTarget(creep, source, PATH_COLORS.mining);
  } else if (result === OK) {
    // Track mined energy (based on WORK parts)
    const workParts = creep.body.filter(p => p.type === WORK).length;
    const harvestAmount = workParts * 2; // Each WORK part harvests 2 energy per tick
    stats.recordHarvest(creep.room.name, source.id, harvestAmount);
    
    // Mining successfully - check if we need to drop energy to container
    // Look for container at source position
    const containers = source.pos.findInRange(FIND_STRUCTURES, 1, {
      filter: (s) => s.structureType === STRUCTURE_CONTAINER,
    });

    // If creep is full and there's a container nearby, transfer to it
    if (
      creep.store.getFreeCapacity(RESOURCE_ENERGY) === 0 &&
      containers.length > 0
    ) {
      const container = containers[0];
      if (container.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
        creep.transfer(container, RESOURCE_ENERGY);
      }
    }
  }
};

/**
 * Handle hauling action (pickup energy from containers/dropped resources)
 * Effectful function
 * @param {Creep} creep
 */
const handleHauling = (creep) => {
  // If creep is full, switch to delivering
  if (creep.store.getFreeCapacity(RESOURCE_ENERGY) === 0) {
    clearCreepAction(creep);
    return;
  }

  const { actionTarget } = creep.memory;

  // Find target if not set
  if (!actionTarget) {
    // Prioritize dropped energy first (before it decays)
    const droppedEnergy = creep.room.find(FIND_DROPPED_RESOURCES, {
      filter: (r) => r.resourceType === RESOURCE_ENERGY && r.amount > 50,
    });

    // If dropped energy exists, prioritize it
    if (droppedEnergy.length > 0) {
      const sorted = sortByContention(creep, droppedEnergy, false);
      setCreepAction(creep, "hauling", {
        id: sorted[0].id,
        pos: sorted[0].pos,
      });
      return;
    }

    // Otherwise, look for containers near sources with energy
    const containers = creep.room.find(FIND_STRUCTURES, {
      filter: (s) =>
        s.structureType === STRUCTURE_CONTAINER && s.store[RESOURCE_ENERGY] > 0,
    });

    if (containers.length > 0) {
      const sorted = sortByContention(creep, containers, false);
      setCreepAction(creep, "hauling", {
        id: sorted[0].id,
        pos: sorted[0].pos,
      });
      return;
    }

    // No targets available
    clearCreepAction(creep);
    return;
  }

  const target = Game.getObjectById(actionTarget.id);
  if (!target) {
    clearCreepAction(creep);
    return;
  }

  // Pickup or withdraw
  let result;
  if (target instanceof Resource) {
    result = creep.pickup(target);
  } else {
    result = creep.withdraw(target, RESOURCE_ENERGY);
  }

  if (result === ERR_NOT_IN_RANGE) {
    moveToTarget(creep, target, PATH_COLORS.hauling);
  } else if (result === OK || result === ERR_FULL) {
    clearCreepAction(creep);
  } else if (result === ERR_NOT_ENOUGH_RESOURCES) {
    clearCreepAction(creep);
  }
};

/**
 * Handle deconstructing action (dismantle structure at deconstruct flag)
 * Effectful function
 * @param {Creep} creep
 */
const handleDeconstructing = (creep) => {
  const { actionTarget } = creep.memory;
  if (!actionTarget) {
    clearCreepAction(creep);
    return;
  }

  const target = Game.getObjectById(actionTarget.id);

  // Target no longer exists - deconstruction complete
  if (!target) {
    console.log(
      `Deconstruction target ${actionTarget.id} no longer exists. ` +
        `Creep ${creep.name} completed deconstruction.`,
    );
    clearCreepAction(creep);
    return;
  }

  // Deconstruct the target
  const result = creep.dismantle(target);
  if (result === ERR_NOT_IN_RANGE) {
    moveToTarget(creep, target, PATH_COLORS.deconstructing);
  } else if (result === OK) {
    // Successfully deconstructing
  } else {
    console.log(
      `Creep ${creep.name} failed to deconstruct ${target.structureType} ` +
        `at ${target.pos}: error ${result}`,
    );
    clearCreepAction(creep);
  }
};

/**
 * Handle delivering action (deliver energy to spawns/extensions/towers/storage)
 * Effectful function
 * @param {Creep} creep
 */
const handleDelivering = (creep) => {
  const { room } = creep;
  const { energyAvailable, energyCapacityAvailable } = room;

  // If creep is empty, switch back to hauling
  if (creep.store[RESOURCE_ENERGY] === 0) {
    clearCreepAction(creep);
    return;
  }

  const { actionTarget } = creep.memory;

  // Find target if not set
  if (!actionTarget) {
    // Priority: Spawn > Extensions > Towers > Storage
    let targets = creep.room.find(FIND_STRUCTURES, {
      filter: (s) =>
        (s.structureType === STRUCTURE_SPAWN ||
          s.structureType === STRUCTURE_EXTENSION ||
          s.structureType === STRUCTURE_TOWER) &&
        s.store.getFreeCapacity(RESOURCE_ENERGY) > 0,
    });

    // If no priority targets, deliver to storage
    if (targets.length === 0) {
      targets = creep.room.find(FIND_STRUCTURES, {
        filter: (s) =>
          s.structureType === STRUCTURE_STORAGE &&
          s.store.getFreeCapacity(RESOURCE_ENERGY) > 0,
      });
    }

    if (targets.length === 0) {
      clearCreepAction(creep);
      return;
    }

    const closest = creep.pos.findClosestByPath(targets);
    if (closest) {
      setCreepAction(creep, "delivering", { id: closest.id, pos: closest.pos });
    }
    return;
  }

  const target = Game.getObjectById(actionTarget.id);
  if (!target) {
    clearCreepAction(creep);
    return;
  }

  const result = creep.transfer(target, RESOURCE_ENERGY);
  if (result === ERR_NOT_IN_RANGE) {
    moveToTarget(creep, target, PATH_COLORS.delivering);
  } else if (result === OK || result === ERR_FULL) {
    // Successfully transferred or target is full
    // If creep still has energy, try to find a new delivery target
    if (creep.store[RESOURCE_ENERGY] > 0) {
      // Clear target to find a new one on next tick
      delete creep.memory.actionTarget;
    } else {
      // Creep is empty, switch back to hauling
      clearCreepAction(creep);
    }
  }
};

/**
 * Action handler registry
 * Maps action names to handler functions
 */
const ACTION_HANDLERS = {
  gathering: handleGathering,
  building: handleBuilding,
  repairing: handleRepairing,
  upgrading: handleUpgrading,
  harvesting: handleHarvesting,
  attacking: handleAttacking,
  transporting: handleTransporting,
  mining: handleMining,
  hauling: handleHauling,
  delivering: handleDelivering,
  deconstructing: handleDeconstructing,
};

// ============================================================================
// Main Orchestration Functions
// ============================================================================

/**
 * Determine and set the creep's next action
 * Effectful function - modifies creep memory
 * @param {Creep} creep
 * @param {Array} priorityList - Action priority order
 */
const workerActions = (creep, priorityList) => {
  const isTransporter = priorityList.includes("transporting");
  const isMiner = priorityList.includes("mining");
  const isHauler = priorityList.includes("hauling");

  // Check for "upgrade" flag - harvesters prioritize upgrading when this flag exists
  const upgradeFlag = creep.room.find(FIND_FLAGS, {
    filter: (flag) => flag.name === "upgrade",
  })[0];

  // If upgrade flag exists and this is a harvester, modify priority list
  if (upgradeFlag && creep.memory.role === "harvester") {
    // Move "upgrading" to the front of the priority list
    const modifiedPriorityList = priorityList.filter(
      (action) => action !== "upgrading",
    );
    modifiedPriorityList.unshift("upgrading");
    priorityList = modifiedPriorityList;
  }

  // Check for combat: if creep is a fighter and there are targets to attack
  if (isFighter(creep)) {
    const target = findPrioritizedAttackTarget(creep);
    if (target) {
      setCreepAction(creep, "attacking", { id: target.id, pos: target.pos });
      sayAction(creep, "attacking");
      return;
    }
  }

  // If was attacking but no more targets, reset action
  if (creep.memory.action === "attacking") {
    const target = findPrioritizedAttackTarget(creep);
    if (!target) {
      clearCreepAction(creep);
    }
  }

  // Specialized roles (miners, haulers) use their own action selection
  // They don't use the legacy "gathering" action
  if (isMiner || isHauler) {
    // For specialized roles, always use priority-based action selection
    // Clear action if undefined or if it's a legacy action type
    if (
      !creep.memory.action ||
      creep.memory.action === "gathering" ||
      creep.memory.action === "harvesting"
    ) {
      clearCreepAction(creep);
    }

    // Select action from priority list
    const { action, target } = selectAction(creep, priorityList);

    // Only update if action changed or no target set
    if (creep.memory.action !== action || !creep.memory.actionTarget) {
      setCreepAction(creep, action, target);
      sayAction(creep, action);
    }
    return;
  }

  // Legacy behavior for generalist workers (harvesters, upgraders, builders)
  // Check if creep needs to gather
  if (needsToGather(creep) && creep.memory.action !== "gathering") {
    let target;
    if (isTransporter) {
      // Transporters gather from containers at 50%+ capacity
      target = selectTransporterGatheringTarget(creep);
      if (!target) {
        // No containers available, idle
        return;
      }
    } else {
      target = selectGatheringTarget(creep);
      if (!target) {
        // No gathering targets available, idle
        return;
      }
    }
    setCreepAction(creep, "gathering", target);
    sayAction(creep, "gathering");
    return;
  }

  // Check if creep has finished gathering and needs new action
  if (hasFinishedGathering(creep)) {
    const { action, target } = selectAction(creep, priorityList);
    setCreepAction(creep, action, target);
    sayAction(creep, action);
  }
};

/**
 * Execute the creep's current action
 * Effectful function - performs game actions
 * @param {Creep} creep
 * @param {string} action
 */
const performAction = (creep, action) => {
  sayAction(creep, action);

  const handler = ACTION_HANDLERS[action];
  if (handler) {
    handler(creep);
  } else {
    console.log(`Unknown action ${action} for creep ${creep.name}`);
    clearCreepAction(creep);
  }
};

// ============================================================================
// Legacy Compatibility Layer
// ============================================================================

/**
 * Legacy baseCreep object for backward compatibility
 * Wraps functional implementation
 */
const baseCreep = {
  findSource: utils.findBestSourceForCreep,
  gatherResource: handleGathering,
  workerActions,
  moveToTarget,
  performAction,
};

// ============================================================================
// Exports
// ============================================================================

module.exports = {
  // Legacy export for backward compatibility
  baseCreep,

  // Constants
  CRITICAL_HITS,
  WALL_MIN_HITS,
  RAMPART_MIN_HEALTH_PERCENT,
  STRUCTURE_MIN_HEALTH_PERCENT,
  ACTION_ICONS,
  PATH_COLORS,

  // Pure functions - target finding
  findWallsNeedingRepair,
  findRampartsNeedingRepair,
  findStructuresNeedingRepair,
  findRepairTargets,
  filterCriticalRepairs,
  findEnergyDepositTargets,
  findDeconstructTarget,
  isWorker,
  isFighter,
  // Pure functions - sorting
  calculateRepairScore,
  countCreepsTargeting,
  sortByContention,

  // Pure functions - decision making
  needsToGather,
  hasFinishedGathering,
  getActionAvailability,
  selectBuildTarget,
  selectGatheringTarget,
  selectTransporterGatheringTarget,
  selectAction,

  // Effectful functions - state management
  sayAction,
  moveToTarget,
  setCreepAction,
  clearCreepAction,

  // Action handlers
  handleGathering,
  handleBuilding,
  handleRepairing,
  handleUpgrading,
  handleHarvesting,
  handleAttacking,
  handleTransporting,
  handleDeconstructing,
  ACTION_HANDLERS,

  // Main orchestration
  workerActions,
  performAction,
};
