/**
 * Spawner Roster Module
 * Handles roster counting, priority determination, and fighter requirements
 * Pure functions for analyzing creep populations and spawn needs
 */

const flagManager = require("./flagManager");
const { findLabs, findMineralInRoom } = require("./spawnerHelpers");
const { shouldSpawnDefenders } = require("./spawnerCombat");
const utils = require("./utils");
const CONFIG = require("./config");

/**
 * Count current creeps by role
 * Pure function - no side effects
 * @param {Object} creeps - Game.creeps object
 * @param {string} roomName - Name of the room to count creeps for
 * @returns {Object} Counts by role
 */
const countCreepsByRole = (creeps, roomName) =>
  Object.values(creeps).reduce((counts, creep) => {
    if (creep.memory.spawnRoom !== roomName) {
      return counts;
    }
    const role = creep.memory.role;
    if (role) {
      counts[role] = (counts[role] || 0) + 1;
    }
    return counts;
  }, {});

/**
 * Get required number of defenders based on invasion threat assessment
 * Pure function - no side effects
 * @param {Room} room - The room to analyze
 * @param {Object} currentCreeps - Current creep counts by role
 * @returns {number} Number of defenders needed
 */
const getRequiredDefenderCount = (room, currentCreeps) => {
  const defenderNeed = shouldSpawnDefenders(room, currentCreeps);
  return defenderNeed.needed;
};

/**
 * Parse all active attack flags and extract force size requirements
 * Pure function - no side effects
 * @returns {Array<Object>} Array of {name, count, flag} for each attack flag
 */
const parseAttackFlags = () => {
  // Delegate to flag manager which caches results per tick
  return flagManager.getAttackFlags();
};

/**
 * Calculate fighter class distribution based on total count and RCL
 * Pure function - no side effects
 * @param {number} totalCount - Total number of fighters to spawn
 * @param {number} rcl - Room Control Level
 * @returns {Object} Fighter counts by class {fodder, invader, healer, shooter}
 */
const calculateFighterClassCounts = (totalCount, rcl) => {
  // Get ratios for this RCL (or default to RCL 8 if higher)
  const ratios = CONFIG.OFFENSIVE.FIGHTER_RATIOS[rcl] || CONFIG.OFFENSIVE.FIGHTER_RATIOS[8];
  
  // Calculate raw counts (may have fractional parts)
  const rawCounts = {
    fodder: totalCount * ratios.fodder,
    invader: totalCount * ratios.invader,
    healer: totalCount * ratios.healer,
    shooter: totalCount * ratios.shooter
  };
  
  // Round down to get initial allocation
  const counts = {
    fodder: Math.floor(rawCounts.fodder),
    invader: Math.floor(rawCounts.invader),
    healer: Math.floor(rawCounts.healer),
    shooter: Math.floor(rawCounts.shooter)
  };
  
  // Calculate remainder to distribute
  let allocated = counts.fodder + counts.invader + counts.healer + counts.shooter;
  let remainder = totalCount - allocated;
  
  // Distribute remainder by priority (fodder → invader → healer → shooter)
  const priorityOrder = ['fodder', 'invader', 'healer', 'shooter'];
  let priorityIndex = 0;
  
  while (remainder > 0) {
    const classKey = priorityOrder[priorityIndex % priorityOrder.length];
    // Only add if ratio > 0 for this class
    if (ratios[classKey] > 0) {
      counts[classKey]++;
      remainder--;
    }
    priorityIndex++;
  }
  
  return counts;
};

/**
 * Get required number of offensive fighters based on active attack flags
 * Pure function - no side effects
 * @param {number} rcl - Room Control Level (for calculating class distribution)
 * @returns {Object} Fighter requirements {total, byClass: {fodder, invader, healer, shooter}, flags}
 */
const getRequiredOffensiveFighterCount = (rcl) => {
  const attackFlags = parseAttackFlags();
  
  if (attackFlags.length === 0) {
    return {
      total: 0,
      byClass: { fodder: 0, invader: 0, healer: 0, shooter: 0 },
      flags: []
    };
  }
  
  // Sum up total required fighters from all flags
  const totalRequired = attackFlags.reduce((sum, flag) => sum + flag.count, 0);
  
  // Calculate class distribution
  const byClass = calculateFighterClassCounts(totalRequired, rcl);
  
  return {
    total: totalRequired,
    byClass: byClass,
    flags: attackFlags
  };
};

/**
 * Find the best role to spawn based on roster deficits and priority order
 * Pure function - no side effects
 * @param {Object} roster - Target roster {role: count}
 * @param {Object} currentCreeps - Current creep counts
 * @param {Object} roomStatus - Room status information
 * @returns {string|null} Role to spawn (priority-based) or null
 */
const findBestRoleToSpawn = (roster, currentCreeps, roomStatus) => {
  const rosterPriority = ["harvester"];

  // Add mineral extraction roles at RCL 6+
  if (roomStatus.controllerLevel >= 6) {
    const room = Game.rooms[roomStatus.roomName];
    if (room) {
      const mineralType = findMineralInRoom(room);
      const labs = findLabs(room);

      // Add mineralExtractor if we have a mineral
      if (mineralType && roster.mineralExtractor > 0) {
        rosterPriority.push("mineralExtractor");
      }

      // Add chemist if we have labs
      if (labs.length > 0 && roster.chemist > 0) {
        rosterPriority.push("chemist");
      }
    }
  }

  rosterPriority.push("upgrader", "builder");
  utils.periodicLogger(`Roster priority order for room ${roomStatus.roomName}: ${rosterPriority.join(", ")}`, 30);

  // Check priority roles first (in order)
  for (const role of rosterPriority) {
    const target = roster[role] || 0;
    const current = currentCreeps[role] || 0;
    if (current < target) {
      console.log(`Priority spawn needed: ${role} (${current}/${target})`);
      return role;
    }
  }

  // Check remaining roles not in priority list
  for (const [role, target] of Object.entries(roster)) {
    const current = currentCreeps[role] || 0;
    if (current < target && !rosterPriority.includes(role)) {
      console.log(`Standard spawn needed: ${role} (${current}/${target})`);
      return role;
    }
  }

  return null;
};

/**
 * Count total WORK parts across all active upgraders for a room
 * Pure function - no side effects
 * Used for RCL 8 upgrade cap awareness (cap = 15 energy/tick = 15 WORK parts)
 * @param {string} roomName - The room to count upgrader WORK parts for
 * @returns {number} Total WORK parts across all upgraders in the room
 */
const getUpgraderWorkPartCount = (roomName) =>
  Object.values(Game.creeps).reduce((total, creep) => {
    if (creep.memory.spawnRoom !== roomName || creep.memory.role !== 'upgrader') {
      return total;
    }
    return total + creep.body.filter(part => part.type === WORK).length;
  }, 0);

/**
 * Get remote harvesting requirements based on active source flags
 * Pure function - no side effects
 * @param {Room} room - The spawning room (to calculate distances)
 * @returns {Object} Remote harvesting needs {miners, haulers, sources: [{sourceId, flagName, distance}]}
 */
const getRemoteHarvestingNeeds = (room) => {
  // Check if remote harvesting is enabled
  if (!CONFIG.REMOTE_HARVESTING || !CONFIG.REMOTE_HARVESTING.ENABLED) {
    return { miners: 0, haulers: 0, sources: [] };
  }

  // Get all remote source flags
  const remoteSourceFlags = flagManager.getRemoteSourceFlags();
  
  if (remoteSourceFlags.length === 0) {
    return { miners: 0, haulers: 0, sources: [] };
  }

  // Calculate distance and requirements for each source
  const sources = remoteSourceFlags.map(({flag, sourceId, name}) => {
    // Calculate linear distance from room controller to flag
    const distance = room.controller && flag.pos 
      ? room.controller.pos.getRangeTo(flag.pos)
      : CONFIG.REMOTE_HARVESTING.DEFAULT_DISTANCE;
    
    return {
      sourceId,
      flagName: name,
      distance
    };
  });

  // Calculate total needs
  // 1 miner per remote source
  const miners = sources.length;
  
  // Haulers scale with distance (using distance penalty multiplier)
  // Base: 1 hauler per source, +1 for every 50 tiles (scaled by multiplier)
  const haulers = sources.reduce((total, source) => {
    const baseHaulers = 1;
    const distanceBonus = Math.floor(
      (source.distance / 50) * CONFIG.REMOTE_HARVESTING.DISTANCE_PENALTY_MULTIPLIER
    );
    return total + baseHaulers + distanceBonus;
  }, 0);

  return {
    miners,
    haulers,
    sources
  };
};

module.exports = {
  countCreepsByRole,
  getRequiredDefenderCount,
  getRequiredOffensiveFighterCount,
  getRequiredFighterCount: getRequiredOffensiveFighterCount, // Alias for backward compatibility
  parseAttackFlags,
  calculateFighterClassCounts,
  findBestRoleToSpawn,
  getUpgraderWorkPartCount,
  getRemoteHarvestingNeeds,
};
