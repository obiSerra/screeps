/**
 * Spawner Module - Main Orchestrator
 * Coordinates spawn procedure using modular components
 */

const CONFIG = require("./config");
const utils = require("./utils");
const errorTracker = require("./errorTracker");
const { displaySpawningVisual } = require("./spawnerCore");
const { countCreepsByRole } = require("./spawnerRoster");
const {
  checkDefenderPriority,
  checkOffensiveFighterPriority,
  checkRemoteHarvestingPriority,
  checkMinimumFleetPriority,
  checkClaimerPriority,
  checkEnergyPriorityHarvester,
  checkEnergyThreshold,
  checkRosterSpawning,
} = require("./spawnerHelpers");

/**
 * Main spawn procedure - modular priority-based spawning logic
 * Priority order:
 * 1. Defenders (active invasion requiring backup)
 * 2. Offensive fighters (attack/prepare_attack flags)
 * 3. Minimum fleet (bootstrapping)
 * 4. Claimer (expansion)
 * 5. Energy priority harvesters (bottleneck response)
 * 6. Energy threshold check (wait for 70% energy)
 * 7. Roster spawning (normal operations)
 * 
 * @param {StructureSpawn} spawn - The spawn structure
 * @param {Object} roster - Target roster {role: count}
 * @param {Object} roomStatus - Current room status
 * @param {Object} efficiencyMetrics - Energy collection efficiency metrics
 * @returns {Object} Spawn result info
 */
const spawnProcedure = (spawn, roster, roomStatus, efficiencyMetrics) => {
  try {
    if (!spawn || spawn.spawning) {
      displaySpawningVisual(spawn);
      return {
        spawned: false,
        reason: spawn && spawn.spawning ? "busy" : "no_spawn",
      };
    }

    const currentCreeps = countCreepsByRole(Game.creeps, roomStatus.roomName);
    const room = Game.rooms[roomStatus.roomName];
    const roomMemory = Memory.rooms && Memory.rooms[roomStatus.roomName];

    // Execute priority checks in order
    const priorityChecks = [
      () => checkDefenderPriority(spawn, room, currentCreeps, roomStatus, efficiencyMetrics),
      () => checkOffensiveFighterPriority(spawn, room, currentCreeps, roomStatus, efficiencyMetrics),
      () => checkRemoteHarvestingPriority(spawn, room, currentCreeps, roomStatus, efficiencyMetrics),
      () => checkMinimumFleetPriority(spawn, room, currentCreeps, roomStatus, efficiencyMetrics),
      () => checkClaimerPriority(spawn, room, currentCreeps, roomStatus, efficiencyMetrics),
      () => checkEnergyPriorityHarvester(spawn, room, currentCreeps, roster, roomMemory, roomStatus, efficiencyMetrics),
      () => checkEnergyThreshold(roomStatus),
      () => checkRosterSpawning(spawn, room, currentCreeps, roster, roomStatus, efficiencyMetrics),
    ];

    for (const check of priorityChecks) {
      const result = check();
      console.log(`Priority check result: ${result ? JSON.stringify(result) : 'no spawn'}`);
      if (result) {
        displaySpawningVisual(spawn);
        return result;
      }
    }

    displaySpawningVisual(spawn);
    return { spawned: false, reason: "roster_full" };
  } catch (error) {
    errorTracker.logError(error, {
      module: 'spawner',
      function: 'spawnProcedure',
      room: roomStatus ? roomStatus.roomName : 'unknown'
    }, 'ERROR');
    displaySpawningVisual(spawn);
    return { spawned: false, reason: 'error', error: error.message };
  }
};

module.exports = {
  spawnProcedure,
  countCreepsByRole,
};
