/**
 * Spawner Module
 * Handles all creep spawning logic with functional composition
 */

const calculateBodyCost = (body) =>
  body.reduce((total, part) => total + BODYPART_COST[part], 0);

/**
 * Get body composition based on available energy
 * Pure function - no side effects
 * @param {number} energyAvailable - Current energy available
 * @returns {Array} Body parts array
 */
const getWorkerCreepBody = (energyAvailable) => {
  const bodyList = [
    [WORK, WORK, WORK, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE],
    [WORK, WORK, WORK, CARRY, CARRY, MOVE, MOVE, MOVE],
    [WORK, WORK, CARRY, MOVE, MOVE],
    [WORK, CARRY, MOVE],
  ];

  const bodyCosts = bodyList
    .map((body) => [calculateBodyCost(body), body])
    .sort((a, b) => b[0] - a[0]); // Sort by cost descending

  for (const [cost, body] of bodyCosts) {
    if (energyAvailable >= cost) {
      return body;
    }
  }
};

/**
 * Count current creeps by role
 * Pure function - no side effects
 * @param {Object} creeps - Game.creeps object
 * @returns {Object} Counts by role
 */
const countCreepsByRole = (creeps) =>
  Object.values(creeps).reduce((counts, creep) => {
    const role = creep.memory.role;
    if (role) {
      counts[role] = (counts[role] || 0) + 1;
    }
    return counts;
  }, {});

/**
 * Determine which role should be spawned next
 * Pure function - no side effects
 * @param {Object} roster - Target roster {role: count}
 * @param {Object} currentCreeps - Current creep counts by role
 * @param {Object} roomStatus - Room status info
 * @returns {string|null} Role to spawn or null if none needed
 */
const determineSpawnRole = (roster, currentCreeps, roomStatus) => {
  const harvesterCount = currentCreeps.harvester || 0;

  // Critical: always spawn harvester if none exist
  if (harvesterCount < 1) {
    return "harvester";
  }

  // Check energy conditions for non-critical spawning
  const canSpawn = roomStatus.energyAvailable >= 200;

  if (!canSpawn) {
    return null;
  }

  // Find first role under target count
  for (const role of Object.keys(roster)) {
    const current = currentCreeps[role] || 0;
    if (current < roster[role]) {
      return role;
    }
  }

  return null;
};

/**
 * Determine extra spawn when energy is full
 * Pure function - no side effects
 * @param {Object} currentCreeps - Current creep counts by role
 * @param {Object} roomStatus - Room status info
 * @returns {string|null} Extra role to spawn or null
 */
const determineExtraSpawn = (currentCreeps, roomStatus) => {
  if (roomStatus.energyAvailable !== roomStatus.energyCapacity) {
    return null;
  }

  // Prioritize builders if there are unbuilt structures
  if (roomStatus.constructionSiteCount > 0) {
    return "builder";
  }

  const builderCount = currentCreeps.builder || 0;
  const harvesterCount = currentCreeps.harvester || 0;
  const upgraderCount = currentCreeps.upgrader || 0;

  // Balance: harvesters == builders*0.7 == upgraders*0.5
  // Normalize counts by their ratio coefficients
  const normalizedHarvester = harvesterCount;
  const normalizedBuilder = builderCount;
  const normalizedUpgrader = upgraderCount * 0.5;

  // Spawn whichever role is most deficient
  if (
    normalizedHarvester <= normalizedBuilder &&
    normalizedHarvester <= normalizedUpgrader
  ) {
    return "harvester";
  }
  if (normalizedBuilder <= normalizedUpgrader) {
    return "builder";
  }
  return "upgrader";
};

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
 * @returns {number} Spawn result code
 */
const executeSpawn = (spawn, role, body, gameTime) => {
  const name = generateCreepName(role, gameTime);
  console.log(`Spawning new ${role}: ${name}`);
  return spawn.spawnCreep(body, name, { memory: { role } });
};

/**
 * Display spawning visual
 * Effectful function - modifies visuals
 * @param {StructureSpawn} spawn - The spawn structure
 */
const displaySpawningVisual = (spawn) => {
  if (!spawn.spawning) return;

  const spawningCreep = Game.creeps[spawn.spawning.name];
  if (spawningCreep) {
    spawn.room.visual.text(
      "🛠️" + spawningCreep.memory.role,
      spawn.pos.x + 1,
      spawn.pos.y,
      { align: "left", opacity: 0.8 },
    );
  }
};

const spawnClaimer = (spawn) => {
  const body = [MOVE, MOVE, CLAIM];
  executeSpawn(spawn, "claimer", body, Game.time);
};

/**
 * Main spawn procedure - orchestrates all spawning logic
 * @param {StructureSpawn} spawn - The spawn structure
 * @param {Object} roster - Target roster {role: count}
 * @param {Object} roomStatus - Current room status
 * @returns {Object} Spawn result info
 */
const spawnProcedure = (spawn, roster, roomStatus) => {
  if (!spawn || spawn.spawning) {
    displaySpawningVisual(spawn);
    return {
      spawned: false,
      reason: spawn && spawn.spawning ? "busy" : "no_spawn",
    };
  }

  const currentCreeps = countCreepsByRole(Game.creeps);

  if (
    !currentCreeps["claimer"] &&
    Game.gcl.level >= 2 &&
    roomStatus.energyAvailable >= 700
  ) {
    const results = spawnClaimer(spawn);
    displaySpawningVisual(spawn);
    return { spawned: results === OK, role: "claimer", result: results };
  }

  const body = getWorkerCreepBody(roomStatus.energyAvailable);

  // Try primary spawn based on roster
  const primaryRole = determineSpawnRole(roster, currentCreeps, roomStatus);
  if (primaryRole) {
    const result = executeSpawn(spawn, primaryRole, body, Game.time);
    displaySpawningVisual(spawn);
    return { spawned: result === OK, role: primaryRole, result };
  }

  // Try extra spawn when energy is full
  const extraRole = determineExtraSpawn(currentCreeps, roomStatus);
  if (extraRole) {
    console.log(
      `Energy full: ${roomStatus.energyAvailable}/${roomStatus.energyCapacity} spawning extra ${extraRole} Creep`,
    );
    const result = executeSpawn(spawn, extraRole, body, Game.time);
    displaySpawningVisual(spawn);
    return { spawned: result === OK, role: extraRole, result, extra: true };
  }

  displaySpawningVisual(spawn);
  return { spawned: false, reason: "roster_full" };
};

module.exports = {
  // Pure functions
  getCreepBody: getWorkerCreepBody,
  countCreepsByRole,
  determineSpawnRole,
  determineExtraSpawn,
  generateCreepName,

  // Effectful functions
  executeSpawn,
  displaySpawningVisual,

  // Main orchestrator
  spawnProcedure,
};
