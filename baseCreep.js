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
};

const PATH_COLORS = {
  gathering: "#ffaa00",
  building: "#ffffff",
  repairing: "#00ff22",
  upgrading: "#ffaa00",
  harvesting: "#0004ff",
};

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
    (a, b) => calculateRepairScore(creep, a) - calculateRepairScore(creep, b)
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
    (creep) => creep.memory.actionTarget && creep.memory.actionTarget.id === targetId
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
 * Sort targets by least contention and distance
 * Pure function - distributes creeps across targets
 * @param {Creep} creep
 * @param {Array} targets
 * @returns {Array} Sorted targets
 */
const sortByContention = (creep, targets) => {
  const scored = targets.map((target) => ({
    target,
    creepsTargeting: countCreepsTargeting(target.id),
    distance: creep.pos.getRangeTo(target),
  }));

  return scored
    .sort((a, b) => {
      if (a.creepsTargeting !== b.creepsTargeting) {
        return a.creepsTargeting - b.creepsTargeting;
      }
      return b.distance - a.distance;
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

  return {
    repairCritical: criticalRepairs.length > 0,
    building: constructionSites.length > 0,
    repairing: repairTargets.length > 0,
    harvesting: energyAvailable < energyCapacity,
    upgrading: true, // Always available as fallback
    // Include targets for immediate use
    targets: {
      criticalRepairs,
      repairTargets,
      constructionSites,
    },
  };
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
    if (action === "building" && availability.building) {
      // Prioritize extensions when multiple construction site types exist
      const prioritizedSites = prioritizeConstructionSites(targets.constructionSites);
      const target = sortByContention(creep, prioritizedSites)[0];
      return {
        action: "building",
        target: { id: target.id, pos: target.pos },
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
    if (action === "upgrading") {
      return { action: "upgrading", target: null };
    }
  }

  // Default fallback
  return { action: "upgrading", target: null };
};

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
  creep.moveTo(target, { visualizePathStyle: { stroke: color } });
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
 * Handle gathering action
 * Effectful function
 * @param {Creep} creep
 */
const handleGathering = (creep) => {
  const source = utils.findBestSourceForCreep(creep);
  if (creep.harvest(source) === ERR_NOT_IN_RANGE) {
    moveToTarget(creep, source, PATH_COLORS.gathering);
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
    if (creep.build(target) === ERR_NOT_IN_RANGE) {
      moveToTarget(creep, target, PATH_COLORS.building);
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
          `Creep ${creep.name} will switch to repairing it.`
      );
      setCreepAction(creep, "repairing", {
        id: structures[0].id,
        pos: structures[0].pos,
      });
      return;
    }
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
    if (creep.repair(target) === ERR_NOT_IN_RANGE) {
      moveToTarget(creep, target, PATH_COLORS.repairing);
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
  if (creep.upgradeController(controller) === ERR_NOT_IN_RANGE) {
    moveToTarget(creep, controller, PATH_COLORS.upgrading);
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
        `Creep ${creep.name} will switch to upgrading.`
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
 * Action handler registry
 * Maps action names to handler functions
 */
const ACTION_HANDLERS = {
  gathering: handleGathering,
  building: handleBuilding,
  repairing: handleRepairing,
  upgrading: handleUpgrading,
  harvesting: handleHarvesting,
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
  // Check if creep needs to gather
  if (needsToGather(creep)) {
    setCreepAction(creep, "gathering", null);
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

  // Pure functions - sorting
  calculateRepairScore,
  countCreepsTargeting,
  sortByContention,

  // Pure functions - decision making
  needsToGather,
  hasFinishedGathering,
  getActionAvailability,
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
  ACTION_HANDLERS,

  // Main orchestration
  workerActions,
  performAction,
};
