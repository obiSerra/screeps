/**
 * Spawner Roster Module
 * Handles roster counting, priority determination, and fighter requirements
 * Pure functions for analyzing creep populations and spawn needs
 */

const { findLabs, findMineralInRoom } = require("./spawnerHelpers");
const utils = require("./utils");

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
 * Get required number of fighters based on active flags
 * Pure function - no side effects
 * @param {boolean} hasHostiles - Whether hostile creeps are present
 * @returns {number} Number of fighters needed
 */
const getRequiredFighterCount = (hasHostiles) => {
  // Attack flag: 2 fighters for immediate combat
  if (Game.flags['attack']) {
    return 2;
  }
  
  // Prepare attack flag: configurable fighter count (default 4)
  // Can be configured by naming flag: prepare_attack_3, prepare_attack_5, etc.
  const prepareAttackFlags = Object.keys(Game.flags).filter(name => 
    name.startsWith('prepare_attack')
  );
  
  if (prepareAttackFlags.length > 0) {
    // Extract number from flag name (e.g., "prepare_attack_5" -> 5)
    const match = prepareAttackFlags[0].match(/prepare_attack_(\d+)/);
    return match ? parseInt(match[1], 10) : 4; // Default to 4 if no number specified
  }
  
  // Hostiles present: 2 defenders
  if (hasHostiles) {
    return 2;
  }
  
  return 0; // No fighters needed
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

module.exports = {
  countCreepsByRole,
  getRequiredFighterCount,
  findBestRoleToSpawn,
};
