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
    
    // Phase 2 optimization: Register creep in boost queue if it needs boosting
    if (extraMemory.needsBoosting && extraMemory.boostTypes) {
      if (!Memory.rooms[spawn.room.name]) {
        Memory.rooms[spawn.room.name] = {};
      }
      if (!Memory.rooms[spawn.room.name].boostQueue) {
        Memory.rooms[spawn.room.name].boostQueue = {};
      }
      Memory.rooms[spawn.room.name].boostQueue[name] = extraMemory.boostTypes;
    }
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
 * @param {string} fighterClass - Fighter class for fighter role (fodder/invader/healer/shooter) (optional)
 * @param {Object} additionalMemory - Additional memory properties to merge (optional)
 * @returns {Object} Spawn result
 */
const trySpawn = (spawn, role, roomStatus, room, efficiencyMetrics = null, fighterClass = null, additionalMemory = {}) => {
  const rcl = roomStatus.controllerLevel;
  
  // Get body - for fighters, use class-specific body or fallback to default
  let body;
  if (role === "fighter" && fighterClass) {
    const bodyFunctions = require("./spawnerBodyUtils");
    const energyAvailable = roomStatus.energyAvailable;
    
    switch (fighterClass) {
      case 'fodder':
        body = bodyFunctions.getFodderCreepBody(energyAvailable);
        break;
      case 'invader':
        body = bodyFunctions.getInvaderCreepBody(energyAvailable);
        break;
      case 'healer':
        body = bodyFunctions.getHealerCreepBody(energyAvailable);
        break;
      case 'shooter':
        body = bodyFunctions.getShooterCreepBody(energyAvailable);
        break;
      default:
        body = getBodyForRole(role, rcl, energyAvailable, room, efficiencyMetrics);
    }
  } else {
    body = getBodyForRole(role, rcl, roomStatus.energyAvailable, room, efficiencyMetrics);
  }

  if (!body || calculateBodyCost(body) > roomStatus.energyAvailable) {
    // console.log(`Cannot spawn ${role} - ${JSON.stringify(body)} - Cost: ${calculateBodyCost(body)} - Available Energy: ${roomStatus.energyAvailable}`);
    return { spawned: false, role, reason: "insufficient_energy_or_no_body" };
  }

  // Extra memory based on role
  let extraMemory = { ...additionalMemory };
  
  // Handle miner source assignment (local miners only)
  if (role === "miner") {
    const existingMiners = Object.values(Game.creeps).filter(
      (c) => c.memory.role === "miner" && c.memory.spawnRoom === room.name,
    );
    const sourceId = findUnassignedSource(room, existingMiners);
    extraMemory.assignedSource = sourceId;
  }
  
  if (role === "fighter" && fighterClass) {
    extraMemory.fighterClass = fighterClass;
  }

  const result = executeSpawn(spawn, role, body, Game.time, extraMemory);
  return { spawned: result === OK, role, result, fighterClass };
};

module.exports = {
  generateCreepName,
  executeSpawn,
  displaySpawningVisual,
  trySpawn,
};
