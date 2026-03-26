/**
 * Target Finding Module
 * Pure functions for finding, filtering, and prioritizing targets
 */

const CONFIG = require("./config");
const {
  CRITICAL_HITS,
  WALL_MIN_HITS,
  RAMPART_MIN_HEALTH_PERCENT,
  STRUCTURE_MIN_HEALTH_PERCENT,
} = require("./creep.constants");

const { moveToTarget } = require("./creep.effects");

// ============================================================================
// Pure Functions - Basic Target Finding
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
 * Find energy deposit targets (spawns, extensions, towers)
 * Pure function
 * @param {Room} room
 * @returns {Array} Structures that can receive energy
 */
const findEnergyDepositTargets = (room) => {
  // Check if room is in energy priority mode
  const roomMemory = Memory.rooms && Memory.rooms[room.name];
  const energyPriorityMode = roomMemory && roomMemory.energyPriorityMode;

  const structures = room.find(FIND_STRUCTURES, {
    filter: (s) => {
      // In priority mode, only target spawns and extensions
      // Exception: Also include towers below minimum energy threshold
      if (energyPriorityMode) {
        const minTowerEnergy =
          CONFIG.ENERGY.PRIORITY_MODE.MIN_TOWER_ENERGY_PERCENT;
        return (
          ((s.structureType === STRUCTURE_EXTENSION ||
            s.structureType === STRUCTURE_SPAWN) &&
            s.store.getFreeCapacity(RESOURCE_ENERGY) > 0) ||
          (s.structureType === STRUCTURE_TOWER &&
            s.store.getFreeCapacity(RESOURCE_ENERGY) > 0 &&
            s.store[RESOURCE_ENERGY] <
              s.store.getCapacity(RESOURCE_ENERGY) * minTowerEnergy)
        );
      }

      // Normal mode: include towers as well
      return (
        (s.structureType === STRUCTURE_EXTENSION ||
          s.structureType === STRUCTURE_SPAWN ||
          s.structureType === STRUCTURE_TOWER) &&
        s.store.getFreeCapacity(RESOURCE_ENERGY) > 0
      );
    },
  });

  // Sort by priority: Spawn > Tower > Extension
  return structures.sort((a, b) => {
    const getPriority = (structure) => {
      if (structure.structureType === STRUCTURE_SPAWN) return 1;
      if (structure.structureType === STRUCTURE_TOWER) return 2;
      if (structure.structureType === STRUCTURE_EXTENSION) return 3;
      return 4;
    };
    return getPriority(a) - getPriority(b);
  });
};

/**
 * Find structure at deconstruct flag for deconstruction
 * Pure function
 * @param {Room} room
 * @returns {Object|null} Structure at deconstruct flag or null
 */
const findDeconstructTarget = (room) => {
  const deconstructFlag = Game.flags["deconstruct"];
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
    return {
      id: structures[0].id,
      pos: structures[0].pos,
      structureType: structures[0].structureType,
    };
  }

  return null;
};

/**
 * Find construction site at priority_build flag for priority building
 * Checks all rooms for any flag named 'priority_build'
 * Pure function
 * @returns {Object|null} Construction site at priority_build flag or null
 */
const findPriorityBuildTarget = () => {
  const priorityBuildFlag = Game.flags["priority_build"];
  if (!priorityBuildFlag) {
    return null;
  }

  // Find construction site at flag position
  const constructionSites = priorityBuildFlag.pos.lookFor(
    LOOK_CONSTRUCTION_SITES,
  );
  if (constructionSites.length > 0) {
    return constructionSites[0];
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
    const closest = creep.pos.findClosestByPath(hostileCreeps);
    return closest || hostileCreeps[0];
  }

  // Priority 2: Check for attack flags to target structures (attack or attack_X pattern)
  const attackFlags = Object.entries(Game.flags).filter(
    ([name, flag]) => name === "attack" || name.startsWith("attack_"),
  );

  if (attackFlags.length === 0) {
    return null;
  }

  // Find the closest attack flag
  const closestFlagEntry = creep.pos.findClosestByPath(
    attackFlags.map(([name, flag]) => flag),
  );
  const attackFlag = closestFlagEntry || attackFlags[0][1];

  if (!attackFlag) {
    return null;
  }

  // Find the structure at the flag's position
  const flagPos = attackFlag.pos;

  // Check if we have vision of the flag's room before calling lookFor
  const flagRoom = Game.rooms[flagPos.roomName];
  if (flagRoom) {
    const structuresAtFlag = flagPos.lookFor(LOOK_STRUCTURES);

    // If there's a structure at the flag position, target it specifically
    // Filter out allied structures to never target them
    if (structuresAtFlag.length > 0) {
      const validTarget = structuresAtFlag.find(
        (s) => !s.my && (!s.owner || s.owner.username !== creep.owner.username),
      );
      if (validTarget) {
        return validTarget;
      }
    }

    // If no structure at flag, find all potential targets in the flag's room
    const hostileStructures = flagRoom.find(FIND_HOSTILE_STRUCTURES);

    // Also include walls and ramparts as valid targets when attack flag is present
    // Only include hostile or neutral walls/ramparts, never allied ones
    const walls = flagRoom.find(FIND_STRUCTURES, {
      filter: (s) =>
        (s.structureType === STRUCTURE_WALL ||
          s.structureType === STRUCTURE_RAMPART) &&
        !s.my &&
        (!s.owner || s.owner.username !== creep.owner.username),
    });

    const allStructureTargets = [...hostileStructures, ...walls];

    if (allStructureTargets.length > 0) {
      // Structure priority mapping (lower = higher priority)
      const structurePriority = {
        [STRUCTURE_SPAWN]: 1,
        [STRUCTURE_TOWER]: 2,
        [STRUCTURE_EXTENSION]: 3,
        [STRUCTURE_WALL]: 5,
        [STRUCTURE_RAMPART]: 4,
      };

      // Find closest high-priority structure
      const priorityTargets = allStructureTargets
        .map((s) => ({
          structure: s,
          priority: structurePriority[s.structureType] || 10,
          distance: creep.pos.getRangeTo(s),
        }))
        .sort((a, b) => {
          // Sort by priority first, then distance
          if (a.priority !== b.priority) {
            return a.priority - b.priority;
          }
          return a.distance - b.distance;
        });

      return priorityTargets[0].structure;
    }
    moveToTarget(creep, attackFlag.pos, {
      visualizePathStyle: { stroke: "#ff0000", opacity: 0.5 },
    });
    return flagPos; // If no structures, return flag position as target for fighters to move towards
  }

  if (flagRoom !== creep.room.name) {
    moveToTarget(creep, attackFlag.pos, {
      visualizePathStyle: { stroke: "#ff0000", opacity: 0.5 },
    });
    return flagPos; // If no structures, return flag position as target for fighters to move towards
  }

  // If we don't have vision of the flag's room, or no targets found,
  // check for targets in the creep's current room
  const hostileStructures = creep.room.find(FIND_HOSTILE_STRUCTURES);

  // Also include walls and ramparts as valid targets when attack flag is present
  // Only include hostile or neutral walls/ramparts, never allied ones
  const walls = creep.room.find(FIND_STRUCTURES, {
    filter: (s) =>
      (s.structureType === STRUCTURE_WALL ||
        s.structureType === STRUCTURE_RAMPART) &&
      !s.my &&
      (!s.owner || s.owner.username !== creep.owner.username),
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
    [STRUCTURE_RAMPART]: 4,
  };

  // Find closest high-priority structure
  const priorityTargets = allStructureTargets
    .map((s) => ({
      structure: s,
      priority: structurePriority[s.structureType] || 10,
      distance: creep.pos.getRangeTo(s),
    }))
    .sort((a, b) => {
      // Sort by priority first, then distance
      if (a.priority !== b.priority) {
        return a.priority - b.priority;
      }
      return a.distance - b.distance;
    });

  return priorityTargets[0].structure;
};

// ============================================================================
// Pure Functions - Target Scoring and Prioritization
// ============================================================================

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
  const isCritical =
    target.hits < CRITICAL_HITS ? CONFIG.REPAIR.CRITICAL_PRIORITY_BONUS : 0;
  return (
    target.hits * (1 + distance / CONFIG.REPAIR.DISTANCE_DIVISOR) + isCritical
  );
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
    if (
      a.structureType === STRUCTURE_EXTENSION &&
      b.structureType !== STRUCTURE_EXTENSION
    )
      return -1;
    if (
      a.structureType !== STRUCTURE_EXTENSION &&
      b.structureType === STRUCTURE_EXTENSION
    )
      return 1;
    return 0;
  });
};

// ============================================================================
// Exports
// ============================================================================

/**
 * Find damaged friendly creeps to heal
 * Pure function
 * @param {Creep} creep - The healer creep
 * @returns {Creep|null} Most damaged friendly creep in range or null
 */
const findHealTarget = (creep) => {
  // Find friendly creeps that are damaged
  const damagedCreeps = creep.room.find(FIND_MY_CREEPS, {
    filter: (c) => c.hits < c.hitsMax,
  });

  if (damagedCreeps.length === 0) {
    return null;
  }

  // Prioritize creeps by damage percentage and proximity
  const scoredCreeps = damagedCreeps.map((c) => {
    const damagePercent = 1 - c.hits / c.hitsMax; // Higher = more damaged
    const distance = creep.pos.getRangeTo(c);
    // Score: prioritize heavily damaged + close
    const score = damagePercent * 100 - distance * 2;
    return { creep: c, score };
  });

  // Sort by score (highest first)
  scoredCreeps.sort((a, b) => b.score - a.score);

  return scoredCreeps[0].creep;
};

/**
 * Find and prioritize ranged attack targets for shooters
 * Similar to findPrioritizedAttackTarget but considers optimal shooter range
 * Pure function
 * @param {Creep} creep
 * @returns {Object|null} Highest priority ranged attack target or null
 */
const findRangedAttackTarget = (creep) => {
  // Priority 1: Always look for enemy creeps first (highest priority)
  const hostileCreeps = creep.room.find(FIND_HOSTILE_CREEPS);
  if (hostileCreeps.length > 0) {
    // For shooters, prefer targets at medium range (not too close, not too far)
    const optimalRange =
      CONFIG.OFFENSIVE.FIGHTER_CLASSES.SHOOTER.OPTIMAL_RANGE || 3;

    const scoredTargets = hostileCreeps.map((c) => {
      const range = creep.pos.getRangeTo(c);
      // Prefer targets near optimal range
      const rangePenalty = Math.abs(range - optimalRange);
      const score = 100 - rangePenalty;
      return { target: c, score };
    });

    scoredTargets.sort((a, b) => b.score - a.score);
    return scoredTargets[0].target;
  }

  // Priority 2: Check for attack flags to target structures
  // Reuse same logic as melee attackers
  const attackFlags = Object.entries(Game.flags).filter(
    ([name, flag]) => name === "attack" || name.startsWith("attack_"),
  );

  if (attackFlags.length === 0) {
    return null;
  }

  // Find the closest attack flag
  const closestFlagEntry = creep.pos.findClosestByPath(
    attackFlags.map(([name, flag]) => flag),
  );
  const attackFlag = closestFlagEntry || attackFlags[0][1];

  if (!attackFlag) {
    return null;
  }

  // Find the structure at the flag's position
  const flagPos = attackFlag.pos;

  // Check if we have vision of the flag's room before calling lookFor
  const flagRoom = Game.rooms[flagPos.roomName];
  if (flagRoom) {
    const structuresAtFlag = flagPos.lookFor(LOOK_STRUCTURES);

    // If there's a structure at the flag position, target it specifically
    if (structuresAtFlag.length > 0) {
      const validTarget = structuresAtFlag.find(
        (s) => !s.my && (!s.owner || s.owner.username !== creep.owner.username),
      );
      if (validTarget) {
        return validTarget;
      }
    }

    // If no structure at flag, find all potential targets in the flag's room
    const hostileStructures = flagRoom.find(FIND_HOSTILE_STRUCTURES);
    const walls = flagRoom.find(FIND_STRUCTURES, {
      filter: (s) =>
        (s.structureType === STRUCTURE_WALL ||
          s.structureType === STRUCTURE_RAMPART) &&
        !s.my &&
        (!s.owner || s.owner.username !== creep.owner.username),
    });

    const allStructureTargets = [...hostileStructures, ...walls];

    if (allStructureTargets.length > 0) {
      // Find closest target (shooters can hit from range)
      const closest = creep.pos.findClosestByPath(allStructureTargets);
      return closest || allStructureTargets[0];
    }
  }

  // If we don't have vision of the flag's room or no targets found, return null
  // The fighter will move toward the flag until it gains vision
  return null;
};

/**
 * Find the nearest attack flag (attack or attack_X pattern)
 * Pure function
 * @param {Creep} creep
 * @returns {Flag|null} Nearest attack flag or null
 */
const findNearestAttackFlag = (creep) => {
  const attackFlags = Object.entries(Game.flags).filter(
    ([name, flag]) => name === "attack" || name.startsWith("attack_"),
  );

  if (attackFlags.length === 0) {
    return null;
  }

  // Find the closest attack flag by path
  const flagObjects = attackFlags.map(([name, flag]) => flag);
  const closest = creep.pos.findClosestByPath(flagObjects);

  // If findClosestByPath fails (no path), fall back to range
  return closest || creep.pos.findClosestByRange(flagObjects);
};

module.exports = {
  findWallsNeedingRepair,
  findRampartsNeedingRepair,
  findStructuresNeedingRepair,
  findRepairTargets,
  filterCriticalRepairs,
  findEnergyDepositTargets,
  findDeconstructTarget,
  findPriorityBuildTarget,
  findPrioritizedAttackTarget,
  findHealTarget,
  findRangedAttackTarget,
  findNearestAttackFlag,
  calculateRepairScore,
  countCreepsTargeting,
  sortByContention,
  prioritizeConstructionSites,
};
