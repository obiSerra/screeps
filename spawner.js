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
 * @param {Room} room - The room object
 * @param {Object} currentCreeps - Current creep counts by role
 * @param {Object} targetRoster - Target roster counts
 * @returns {Array} Body parts array
 */
const getWorkerCreepBody = (energyAvailable, room, currentCreeps = {}, targetRoster = {}) => {
  const bodyList = [
    [WORK, WORK, WORK, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE], // 800
    [WORK, WORK, WORK, CARRY, CARRY, MOVE, MOVE, MOVE],        // 650
    [WORK, WORK, CARRY, MOVE, MOVE],                           // 400
    [WORK, CARRY, MOVE],                                        // 200
  ];

  const areInvaders = room ? utils.areThereInvaders(room) : false;
  const combatParts = [TOUGH, TOUGH, ATTACK];
  const combatCost = calculateBodyCost(combatParts);

  // Calculate total current workers and target
  const totalCurrent = Object.values(currentCreeps).reduce((sum, count) => sum + count, 0);
  const totalTarget = Object.values(targetRoster).reduce((sum, count) => sum + count, 0);
  
  // Only use larger bodies when we have at least 75% of target worker count
  const hasEnoughWorkers = totalCurrent >= totalTarget * 0.75;
  
  const bodyCosts = bodyList
    .map((body) => [calculateBodyCost(body), body])
    .sort((a, b) => b[0] - a[0]); // Sort by cost descending

  // Find base body that fits
  let selectedBody = null;
  for (const [cost, body] of bodyCosts) {
    if (energyAvailable >= cost) {
      // If we don't have enough workers, prefer smaller bodies to spawn more creeps faster
      if (!hasEnoughWorkers && cost > 400) {
        continue; // Skip larger bodies when workforce is insufficient
      }
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
 * Get transporter creep body based on available energy
 * Creates as many [WORK, CARRY, MOVE] sets as possible
 * Pure function - no side effects
 * @param {number} energyAvailable - Current energy available
 * @returns {Array} Body parts array
 */
const getTransporterBody = (energyAvailable) => {
  const setcost = BODYPART_COST[WORK] + BODYPART_COST[CARRY] + BODYPART_COST[MOVE]; // 100 + 50 + 50 = 200
  const maxSets = Math.floor(energyAvailable / setcost);
  
  if (maxSets < 1) {
    return undefined;
  }
  
  // Cap at 16 sets to stay under 50 body parts limit (16 * 3 = 48)
  const sets = Math.min(maxSets, 16);
  
  const body = [];
  for (let i = 0; i < sets; i++) {
    body.push(WORK);
  }
  for (let i = 0; i < sets; i++) {
    body.push(CARRY);
  }
  for (let i = 0; i < sets; i++) {
    body.push(MOVE);
  }
  
  return body;
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
  const moveCount = 1;
  let remainingEnergy =
    energyAvailable - moveCount * moveCost - workCost - carryCost;

  if (remainingEnergy < 0) {
    return undefined; // Not enough energy
  }

  // Add as many [TOUGH, RANGED_ATTACK, TOUGH] triplets as possible
  const tripletCost = moveCost + toughCost + rangedAttackCost;
  const tripletCount = Math.floor(remainingEnergy / tripletCost);

  // Build the body array: TOUGH parts first, then RANGED_ATTACK, then WORK/CARRY, then MOVE
  const body = [];

  // Add all TOUGH parts (one per triplet)
  for (let i = 0; i < tripletCount; i++) {
    body.push(TOUGH);
  }

  // Add all RANGED_ATTACK parts (one per triplet)
  for (let i = 0; i < tripletCount; i++) {
    body.push(RANGED_ATTACK);
  }

  // Add WORK part
  body.push(WORK);

  // Add CARRY part
  body.push(CARRY);

  // Add all MOVE parts (one per triplet + initial moveCount)
  for (let i = 0; i < moveCount + tripletCount; i++) {
    body.push(MOVE);
  }

  return body;
};

/**
 * Get RCL tier for scaling strategy
 * Pure function - no side effects
 * @param {number} rcl - Room Control Level (1-8)
 * @returns {string} Tier: "early" (1-3), "mid" (4-7), or "late" (8+)
 */
const getRCLTier = (rcl) => {
  if (rcl <= 3) return "early";
  if (rcl <= 7) return "mid";
  return "late";
};

/**
 * Get generalist body for RCL 1-3 (swarm strategy)
 * Pure function - no side effects
 * @param {number} rcl - Room Control Level
 * @param {number} energyAvailable - Current energy available
 * @returns {Array} Body parts array
 */
const getGeneralistBody = (rcl, energyAvailable) => {
  // Small, flexible generalists with WORK, CARRY, MOVE
  const bodyList = [
    [WORK, WORK, WORK, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE], // 800
    [WORK, WORK, WORK, CARRY, CARRY, MOVE, MOVE, MOVE],        // 650
    [WORK, WORK, CARRY, MOVE, MOVE],                           // 400
    [WORK, CARRY, MOVE],                                        // 200
  ];

  for (const body of bodyList) {
    const cost = calculateBodyCost(body);
    if (energyAvailable >= cost) {
      return [...body];
    }
  }
  
  return undefined;
};

/**
 * Get miner body (stationary harvester at source)
 * Pure function - no side effects
 * @param {number} rcl - Room Control Level
 * @param {number} energyAvailable - Current energy available
 * @returns {Array} Body parts array
 */
const getMinerBody = (rcl, energyAvailable) => {
  const tier = getRCLTier(rcl);
  
  if (tier === "early") {
    // RCL 1-3: Should not use miners yet, return generalist
    return getGeneralistBody(rcl, energyAvailable);
  }
  
  if (tier === "late") {
    // RCL 8+: Giant miner - [WORK×5, MOVE×1] or scaled down
    // Max source output is 10 energy/tick with 5 WORK parts (5 * 2 = 10)
    const giantBody = [WORK, WORK, WORK, WORK, WORK, MOVE]; // 550 energy
    if (energyAvailable >= calculateBodyCost(giantBody)) {
      return giantBody;
    }
    // Fallback to smaller miner
  }
  
  // RCL 4-7: Medium miner
  const bodyList = [
    [WORK, WORK, WORK, WORK, WORK, MOVE],       // 550 - optimal for source
    [WORK, WORK, WORK, MOVE],                    // 350
    [WORK, WORK, MOVE],                          // 250
  ];
  
  for (const body of bodyList) {
    const cost = calculateBodyCost(body);
    if (energyAvailable >= cost) {
      return [...body];
    }
  }
  
  return undefined;
};

/**
 * Get hauler body (pure transport, no WORK parts)
 * Pure function - no side effects
 * @param {number} rcl - Room Control Level
 * @param {number} energyAvailable - Current energy available
 * @returns {Array} Body parts array
 */
const getHaulerBody = (rcl, energyAvailable) => {
  const tier = getRCLTier(rcl);
  
  if (tier === "early") {
    // RCL 1-3: Should not use haulers yet, return generalist
    return getGeneralistBody(rcl, energyAvailable);
  }
  
  // Haulers need 1 MOVE per 2 CARRY on roads
  // Build as many [CARRY×2, MOVE] sets as possible
  const setCost = BODYPART_COST[CARRY] * 2 + BODYPART_COST[MOVE]; // 150 per set
  const maxSets = Math.floor(energyAvailable / setCost);
  
  if (maxSets < 1) {
    return undefined;
  }
  
  // Cap based on tier
  let capSets = 16; // 48 parts max (just under 50 limit)
  if (tier === "mid") {
    capSets = 8; // Medium haulers for RCL 4-7
  }
  
  const sets = Math.min(maxSets, capSets);
  
  const body = [];
  // Add all CARRY parts first
  for (let i = 0; i < sets * 2; i++) {
    body.push(CARRY);
  }
  // Add all MOVE parts
  for (let i = 0; i < sets; i++) {
    body.push(MOVE);
  }
  
  return body;
};

/**
 * Get upgrader body (optimized for controller work)
 * Pure function - no side effects
 * @param {number} rcl - Room Control Level
 * @param {number} energyAvailable - Current energy available
 * @returns {Array} Body parts array
 */
const getUpgraderBody = (rcl, energyAvailable) => {
  const tier = getRCLTier(rcl);
  
  if (tier === "early") {
    // RCL 1-3: Use generalist body
    return getGeneralistBody(rcl, energyAvailable);
  }
  
  if (tier === "late") {
    // RCL 8+: Giant upgrader - stationary near controller
    // [WORK×15, CARRY×3, MOVE×6] or scaled down
    const giantBody = [
      WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK,
      WORK, WORK, WORK, WORK, WORK, // 15 WORK
      CARRY, CARRY, CARRY,           // 3 CARRY
      MOVE, MOVE, MOVE, MOVE, MOVE, MOVE // 6 MOVE
    ]; // 1500 + 150 + 300 = 1950 energy
    
    if (energyAvailable >= calculateBodyCost(giantBody)) {
      return giantBody;
    }
    
    // Scaled giant: [WORK×10, CARRY×2, MOVE×4]
    const mediumGiantBody = [
      WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK,
      CARRY, CARRY,
      MOVE, MOVE, MOVE, MOVE
    ]; // 1000 + 100 + 200 = 1300
    
    if (energyAvailable >= calculateBodyCost(mediumGiantBody)) {
      return mediumGiantBody;
    }
  }
  
  // RCL 4-7: Medium upgrader - more WORK than generalist
  const bodyList = [
    [WORK, WORK, WORK, WORK, CARRY, CARRY, MOVE, MOVE, MOVE], // 800
    [WORK, WORK, WORK, CARRY, CARRY, MOVE, MOVE, MOVE],       // 650
    [WORK, WORK, CARRY, MOVE, MOVE],                          // 400
  ];
  
  for (const body of bodyList) {
    const cost = calculateBodyCost(body);
    if (energyAvailable >= cost) {
      return [...body];
    }
  }
  
  return undefined;
};

/**
 * Get builder body (balanced WORK/CARRY for construction)
 * Pure function - no side effects
 * @param {number} rcl - Room Control Level
 * @param {number} energyAvailable - Current energy available
 * @returns {Array} Body parts array
 */
const getBuilderBody = (rcl, energyAvailable) => {
  const tier = getRCLTier(rcl);
  
  if (tier === "early") {
    // RCL 1-3: Use generalist body
    return getGeneralistBody(rcl, energyAvailable);
  }
  
  // RCL 4+: Balanced builder with equal WORK/CARRY and enough MOVE
  const bodyList = [
    [WORK, WORK, WORK, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE], // 800
    [WORK, WORK, CARRY, CARRY, MOVE, MOVE],                    // 500
    [WORK, CARRY, MOVE],                                        // 200
  ];
  
  for (const body of bodyList) {
    const cost = calculateBodyCost(body);
    if (energyAvailable >= cost) {
      return [...body];
    }
  }
  
  return undefined;
};

/**
 * Get defender body (combat creep scaled by RCL)
 * Pure function - no side effects
 * @param {number} rcl - Room Control Level
 * @param {number} energyAvailable - Current energy available
 * @returns {Array} Body parts array
 */
const getDefenderBody = (rcl, energyAvailable) => {
  const tier = getRCLTier(rcl);
  
  if (tier === "early") {
    // RCL 1-3: Small, cheap defenders
    // [TOUGH, ATTACK, MOVE] × N sets
    const setcost = BODYPART_COST[TOUGH] + BODYPART_COST[ATTACK] + BODYPART_COST[MOVE]; // 140
    const maxSets = Math.floor(energyAvailable / setcost);
    
    if (maxSets < 1) {
      return undefined;
    }
    
    const sets = Math.min(maxSets, 3); // Cap at 3 sets for early game
    const body = [];
    
    for (let i = 0; i < sets; i++) body.push(TOUGH);
    for (let i = 0; i < sets; i++) body.push(ATTACK);
    for (let i = 0; i < sets; i++) body.push(MOVE);
    
    return body;
  }
  
  if (tier === "late") {
    // RCL 8+: Giant tank
    const giantBody = [
      TOUGH, TOUGH, TOUGH, TOUGH, TOUGH, TOUGH, TOUGH, TOUGH, TOUGH, TOUGH, // 10 TOUGH
      ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, // 10 ATTACK
      RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, // 5 RANGED_ATTACK
      MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE,
      MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE,
      MOVE, MOVE, MOVE, MOVE, MOVE // 25 MOVE
    ]; // 100 + 800 + 750 + 1250 = 2900
    
    if (energyAvailable >= calculateBodyCost(giantBody)) {
      return giantBody;
    }
    
    // Fallback to medium
  }
  
  // RCL 4-7: Medium defender
  const bodyList = [
    [TOUGH, TOUGH, ATTACK, ATTACK, RANGED_ATTACK, MOVE, MOVE, MOVE, MOVE, MOVE], // 730
    [TOUGH, ATTACK, ATTACK, MOVE, MOVE, MOVE],                                     // 340
    [TOUGH, ATTACK, MOVE],                                                         // 140
  ];
  
  for (const body of bodyList) {
    const cost = calculateBodyCost(body);
    if (energyAvailable >= cost) {
      return [...body];
    }
  }
  
  return undefined;
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
 * @param {Object} extraMemory - Additional memory properties (optional)
 * @returns {number} Spawn result code
 */
const executeSpawn = (spawn, role, body, gameTime, extraMemory = {}) => {
  const name = generateCreepName(role, gameTime);
  console.log(`Spawning new ${role}: ${name}`);
  const memory = { role, ...extraMemory };
  return spawn.spawnCreep(body, name, { memory });
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
 * Get appropriate body for a role based on RCL
 * Pure function - no side effects
 * @param {string} role - Creep role
 * @param {number} rcl - Room Control Level
 * @param {number} energyAvailable - Current energy available
 * @param {Room} room - The room object
 * @param {Object} currentCreeps - Current creep counts by role
 * @param {Object} roster - Target roster counts
 * @returns {Array} Body parts array
 */
const getBodyForRole = (role, rcl, energyAvailable, room, currentCreeps, roster) => {
  const tier = getRCLTier(rcl);
  
  // Check for invaders (for combat parts in early tiers)
  const areInvaders = room ? utils.areThereInvaders(room) : false;
  
  switch (role) {
    case "harvester":
      // RCL 1-3 only
      return getGeneralistBody(rcl, energyAvailable);
    
    case "upgrader":
      return getUpgraderBody(rcl, energyAvailable);
    
    case "builder":
      return getBuilderBody(rcl, energyAvailable);
    
    case "miner":
      // RCL 4+ only
      return getMinerBody(rcl, energyAvailable);
    
    case "hauler":
      // RCL 4+ only
      return getHaulerBody(rcl, energyAvailable);
    
    case "transporter":
      // Legacy role (deprecated at RCL 4+)
      return getTransporterBody(energyAvailable);
    
    case "defender":
      return getDefenderBody(rcl, energyAvailable);
    
    default:
      // Fallback to generalist for unknown roles
      return getGeneralistBody(rcl, energyAvailable);
  }
};

/**
 * Find unassigned source for a new miner
 * Pure function - no side effects
 * @param {Room} room - The room
 * @param {Array} existingMiners - Array of existing miner creeps
 * @returns {string|null} Source ID or null
 */
const findUnassignedSource = (room, existingMiners) => {
  const sources = room.find(FIND_SOURCES);
  const assignedSources = existingMiners
    .map(m => m.memory.assignedSource)
    .filter(Boolean);
  
  // Find a source without a miner
  const unassignedSource = sources.find(s => !assignedSources.includes(s.id));
  return unassignedSource ? unassignedSource.id : (sources[0] ? sources[0].id : null);
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
  const room = Game.rooms[roomStatus.roomName];
  const rcl = roomStatus.controllerLevel;

  // Try primary spawn based on roster
  const primaryRole = determineSpawnRole(roster, currentCreeps, roomStatus);
  if (primaryRole) {
    // Get appropriate body for role and RCL
    const spawnBody = getBodyForRole(
      primaryRole,
      rcl,
      roomStatus.energyAvailable,
      room,
      currentCreeps,
      roster
    );
    
    if (!spawnBody) {
      displaySpawningVisual(spawn);
      return { spawned: false, reason: "insufficient_energy" };
    }
    
    // Prepare extra memory for specific roles
    let extraMemory = {};
    if (primaryRole === "miner") {
      // Assign source to miner
      const existingMiners = Object.values(Game.creeps).filter(c => c.memory.role === "miner");
      const assignedSource = findUnassignedSource(room, existingMiners);
      if (assignedSource) {
        extraMemory.assignedSource = assignedSource;
      }
    }
    
    const result = executeSpawn(spawn, primaryRole, spawnBody, Game.time, extraMemory);
    displaySpawningVisual(spawn);
    return { spawned: result === OK, role: primaryRole, result };
  }

  // Try extra spawn when energy is full
  const extraRole = determineExtraSpawn(currentCreeps, roomStatus);
  if (extraRole) {
    console.log(
      `Energy full: ${roomStatus.energyAvailable}/${roomStatus.energyCapacity} spawning extra ${extraRole} Creep`,
    );

    // Get appropriate body for role and RCL
    const extraBody = getBodyForRole(
      extraRole,
      rcl,
      roomStatus.energyAvailable,
      room,
      currentCreeps,
      roster
    );
    
    if (!extraBody) {
      displaySpawningVisual(spawn);
      return { spawned: false, reason: "insufficient_energy" };
    }

    const result = executeSpawn(spawn, extraRole, extraBody, Game.time);
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
  getTransporterBody,
  
  // RCL-based body generators
  getRCLTier,
  getGeneralistBody,
  getMinerBody,
  getHaulerBody,
  getUpgraderBody,
  getBuilderBody,
  getDefenderBody,
  getBodyForRole,
  
  // Helper functions
  findUnassignedSource,
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
