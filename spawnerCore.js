/**
 * Spawner Core Module
 * Handles spawn execution and visual display
 * Contains effectful functions that modify game state
 */

const stats = require("./stats");
const { calculateBodyCost, getBodyForRole } = require("./spawnerBodyUtils");
const { findUnassignedSource } = require("./spawnerHelpers");

/**
 * Generate a unique creep name
 * Pure function - no side effects
 * @param {string} role - Creep role
 * @param {number} gameTime - Current game time
 * @returns {string} Unique creep name
 */
const generateCreepName = (role, gameTime) =>
  `${role.charAt(0).toUpperCase() + role.slice(1)}${gameTime}`;

/**
 * Execute spawn action
 * Effectful function - modifies game state
 * @param {StructureSpawn} spawn - The spawn structure
 * @param {string} role - Role to spawn
 * @param {Array} body - Body parts
 * @param {number} gameTime - Current game time
 * @param {Object} extraMemory - Additional memory properties (optional)
 * @returns {number} Spawn result code
 */
const executeSpawn = (spawn, role, body, gameTime, extraMemory = {}) => {
  const name = generateCreepName(role, gameTime);
  console.log(`Spawning new ${role}: ${name}`);
  const memory = {
    role,
    spawnTick: gameTime,
    spawnRoom: spawn.room.name,
    ...extraMemory,
  };
  const result = spawn.spawnCreep(body, name, { memory });

  // Track spawn statistics
  if (result === OK) {
    stats.recordSpawn(spawn.room.name, role, body, calculateBodyCost(body));
  } else {
    console.log(`Room ${spawn.room.name} failed to spawn ${role}: ${result} - Body: ${body} (Cost: ${calculateBodyCost(body)}) - Available Energy: ${spawn.room.energyAvailable} `);
  }

  return result;
};

/**
 * Display spawning visual
 * Effectful function - modifies visuals
 * @param {StructureSpawn} spawn - The spawn structure
 * @param {Object} efficiencyMetrics - Optional efficiency metrics for display
 */
const displaySpawningVisual = (spawn, efficiencyMetrics = null) => {
  if (!spawn.spawning) {
    // Display efficiency tier if available
    if (efficiencyMetrics) {
      spawn.room.visual.text(
        `⚡ ${efficiencyMetrics.efficiencyTier}`,
        spawn.pos.x + 1,
        spawn.pos.y,
        { align: "left", opacity: 0.8 },
      );
    }
    return;
  }

  const spawningCreep = Game.creeps[spawn.spawning.name];
  if (spawningCreep) {
    spawn.room.visual.text(
      `🛠️ ${spawningCreep.memory.role}`,
      spawn.pos.x + 1,
      spawn.pos.y,
      { align: "left", opacity: 0.8 },
    );
  }
};

/**
 * Try to spawn a creep with the given role
 * @param {StructureSpawn} spawn - The spawn structure
 * @param {string} role - Role to spawn
 * @param {Object} roomStatus - Room status
 * @param {Room} room - The room object
 * @param {Object} efficiencyMetrics - Energy collection efficiency metrics (optional)
 * @returns {Object} Spawn result
 */
const trySpawn = (spawn, role, roomStatus, room, efficiencyMetrics = null) => {
  const rcl = roomStatus.controllerLevel;
  const body = getBodyForRole(
    role,
    rcl,
    roomStatus.energyAvailable,
    room,
    efficiencyMetrics,
  );

  if (!body || calculateBodyCost(body) > roomStatus.energyAvailable) {
    return { spawned: false, role, reason: "insufficient_energy_or_no_body" };
  }

  // Extra memory for miners
  let extraMemory = {};
  if (role === "miner") {
    const existingMiners = Object.values(Game.creeps).filter(
      (c) => c.memory.role === "miner" && c.memory.spawnRoom === room.name,
    );
    const sourceId = findUnassignedSource(room, existingMiners);
    extraMemory = { assignedSource: sourceId };
  }

  const result = executeSpawn(spawn, role, body, Game.time, extraMemory);
  return { spawned: result === OK, role, result };
};

module.exports = {
  generateCreepName,
  executeSpawn,
  displaySpawningVisual,
  trySpawn,
};
