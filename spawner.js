/**
 * Spawner Module
 * Handles all creep spawning logic with functional composition
 */

const utils = require("./utils");

const calculateBodyCost = (body) =>
  body.reduce((total, part) => total + BODYPART_COST[part], 0);

/**
 * Get body composition based on available energy
 * Pure function - no side effects
 * @param {number} energyAvailable - Current energy available
 * @returns {Array} Body parts array
 */
const getWorkerCreepBody = (energyAvailable, room) => {
  const bodyList = [
    [WORK, WORK, WORK, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE],
    [WORK, WORK, WORK, CARRY, CARRY, MOVE, MOVE, MOVE],
    [WORK, WORK, CARRY, MOVE, MOVE],
    [WORK, CARRY, MOVE],
  ];

  const areInvaders = room ? utils.areThereInvaders(room) : false;
  const combatParts = [TOUGH, TOUGH, ATTACK];
  const combatCost = calculateBodyCost(combatParts);

  const bodyCosts = bodyList
    .map((body) => [calculateBodyCost(body), body])
    .sort((a, b) => b[0] - a[0]); // Sort by cost descending

  // Find base body that fits
  let selectedBody = null;
  for (const [cost, body] of bodyCosts) {
    if (energyAvailable >= cost) {
      selectedBody = [...body];
      break;
    }
  }

  if (!selectedBody) {
    return undefined;
  }

  if (areInvaders) {
    // Remove parts to make room for combat parts, keeping at least one MOVE
    while (
      calculateBodyCost(selectedBody) + combatCost > energyAvailable &&
      selectedBody.length > 0
    ) {
      const lastIndex = selectedBody.length - 1;
      const lastPart = selectedBody[lastIndex];

      // Check if this is the last MOVE
      if (lastPart === MOVE) {
        const moveCount = selectedBody.filter((p) => p === MOVE).length;
        if (moveCount === 1) {
          // This is the last MOVE, can't remove it
          break;
        }
      }

      // Remove the last part
      selectedBody.pop();
    }

    // Add combat parts at the beginning (TOUGH should be first)
    selectedBody = [...combatParts, ...selectedBody];
  } else {
    // Add combat parts only if they fit
    if (calculateBodyCost(selectedBody) + combatCost <= energyAvailable) {
      selectedBody = [...combatParts, ...selectedBody];
    }
  }

  return selectedBody;
};

/**
 * Get fighter creep body based on available energy
 * Pure function - no side effects
 * @param {number} energyAvailable - Current energy available
 * @returns {Array} Body parts array
 */
const getFighterCreepBody = (energyAvailable) => {
  const moveCost = BODYPART_COST[MOVE];
  const toughCost = BODYPART_COST[TOUGH];
  const rangedAttackCost = BODYPART_COST[RANGED_ATTACK];
  const workCost = BODYPART_COST[WORK];
  const carryCost = BODYPART_COST[CARRY];

  // Start with 2 MOVE parts, 1 WORK, and 1 CARRY
  const moveCount = 2;
  let remainingEnergy =
    energyAvailable - moveCount * moveCost - workCost - carryCost;

  if (remainingEnergy < 0) {
    return undefined; // Not enough energy
  }

  // Add as many [TOUGH, RANGED_ATTACK] pairs as possible
  const pairCost = toughCost + rangedAttackCost;
  const pairCount = Math.floor(remainingEnergy / pairCost);
  remainingEnergy -= pairCount * pairCost;

  // Fill remaining energy with TOUGH parts
  const extraToughCount = Math.floor(remainingEnergy / toughCost);

  // Build the body array: TOUGH parts first, then WORK, RANGED_ATTACK, CARRY, then MOVE
  const body = [];

  // Add all TOUGH parts (from pairs + extras)
  for (let i = 0; i < pairCount + extraToughCount; i++) {
    body.push(TOUGH);
  }

  // Add WORK part
  body.push(WORK);

  // Add RANGED_ATTACK parts
  for (let i = 0; i < pairCount; i++) {
    body.push(RANGED_ATTACK);
  }

  // Add CARRY part
  body.push(CARRY);

  // Add MOVE parts at the end
  for (let i = 0; i < moveCount; i++) {
    body.push(MOVE);
  }

  return body;
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
  let canSpawn = roomStatus.energyAvailable >= 200;

  // canSpawn = roomStatus.energyAvailable >= roomStatus.energyCapacity * 0.5;

  // if (roomStatus.energyCapacity <= 450) {
  //   // Early game: spawn as soon as we have 200 energy to get going
  //   canSpawn = roomStatus.energyAvailable >= 200;
  // } else {
  //   roomStatus.energyAvailable >= roomStatus.energyCapacity * 0.5;
  // }

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

  // Ensure at least 1 of each role
  if (harvesterCount < 1) return "harvester";
  if (builderCount < 1) return "builder";
  if (upgraderCount < 1) return "upgrader";

  // Balance: for each harvester, 0.7 builders and 0.5 upgraders
  // Normalize counts by their ratio coefficients
  const normalizedHarvester = harvesterCount / 1;
  const normalizedBuilder = builderCount / 0.7;
  const normalizedUpgrader = upgraderCount / 0.5;

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

  // Claimer

  // NEXT!!!!!!!!!!!!!!!!!
  // if (
  //   !currentCreeps["claimer"] &&
  //   Game.gcl.level >= 2 &&
  //   roomStatus.energyAvailable >= 700
  // ) {
  //   const results = spawnClaimer(spawn);
  //   displaySpawningVisual(spawn);
  //   return { spawned: results === OK, role: "claimer", result: results };
  // }

  const room = Game.rooms[roomStatus.roomName];
  const body = getWorkerCreepBody(roomStatus.energyAvailable, room);

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

    // Fighter upgrader when we have excess energy
    if (extraRole == "upgrader" && roomStatus.energyAvailable > 1000) {
      const fighterBody = getFighterCreepBody(roomStatus.energyAvailable);
      if (fighterBody) {
        const result = executeSpawn(spawn, "upgrader", fighterBody, Game.time);
        displaySpawningVisual(spawn);
        return {
          spawned: result === OK,
          role: "upgrader",
          result,
          fighter: true,
        };
      }
    }

    const result = executeSpawn(spawn, extraRole, Game.time);
    displaySpawningVisual(spawn);
    return { spawned: result === OK, role: extraRole, result, extra: true };
  }

  displaySpawningVisual(spawn);
  return { spawned: false, reason: "roster_full" };
};

module.exports = {
  // Pure functions
  getCreepBody: getWorkerCreepBody,
  getFighterCreepBody,
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
