/**
 * Spawner Module
 * Handles all creep spawning logic with functional composition
 */

const utils = require("./utils");
const stats = require("./stats");

const calculateBodyCost = (body) =>
  body.reduce((total, part) => total + BODYPART_COST[part], 0);

/**
 * Calculate emergency energy reserve for fighter spawning
 * Reserve scales with room energy capacity to ensure fighters can always spawn
 * @param {number} energyCapacity - Room's maximum energy capacity
 * @returns {number} Energy to reserve for emergency fighter spawning
 */
const getEmergencyReserve = (energyCapacity) => {
  // Can't reserve if capacity is too low
  if (energyCapacity < 500) return 0;
  
  // Scale reserve based on capacity tiers
  if (energyCapacity < 1500) return 300;  // Basic fighter (1 set)
  if (energyCapacity < 2500) return 500;  // Medium fighter (2 sets)
  return 800;                              // Full fighter (3+ sets)
};

/**
 * Determine body set count based on efficiency metrics and RCL
 * Pure function - no side effects
 * @param {Object} efficiencyMetrics - Metrics from stats.getCollectionMetrics()
 * @param {number} energyAvailable - Current energy available
 * @param {number} setCost - Cost per body set
 * @param {number} maxSets - Maximum sets allowed by role
 * @param {boolean} isEmergency - If true, always allow minimum spawn
 * @param {number} rcl - Room Control Level (optional, used for additional scaling)
 * @returns {number} Number of body sets to build
 */
const getAdaptiveSetCount = (efficiencyMetrics, energyAvailable, setCost, maxSets, isEmergency = false, rcl = 1) => {
  const maxAffordable = Math.floor(energyAvailable / setCost);
  
  if (maxAffordable < 1) {
    return 0;
  }
  
  // Emergency spawns (e.g., first harvester) always get at least 1 set
  if (isEmergency) {
    return Math.min(maxAffordable, maxSets);
  }
  
  // Calculate RCL multiplier: higher RCL = bigger creeps
  // RCL 1-3: 1x, RCL 4-5: 1.5x, RCL 6-7: 2x, RCL 8: 2.5x
  let rclMultiplier = 1;
  if (rcl >= 8) rclMultiplier = 2.5;
  else if (rcl >= 6) rclMultiplier = 2;
  else if (rcl >= 4) rclMultiplier = 1.5;
  
  // If no metrics provided, use conservative sizing with RCL factor
  if (!efficiencyMetrics) {
    const baseTarget = Math.max(1, Math.floor(maxAffordable / 2));
    return Math.min(Math.floor(baseTarget * rclMultiplier), maxSets, maxAffordable);
  }
  
  // Determine base target sets based on efficiency tier
  let baseSets;
  const tier = efficiencyMetrics.efficiencyTier;
  
  switch (tier) {
    case 'bootstrapping':
      // Start small: 1-2 sets
      baseSets = 2;
      break;
    case 'developing':
      // Medium: 2-4 sets
      baseSets = 4;
      break;
    case 'established':
      // Large: 4-8 sets
      baseSets = 8;
      break;
    case 'optimized':
      // Maximum affordable
      baseSets = maxAffordable;
      break;
    default:
      baseSets = 2;
  }
  
  // Apply RCL multiplier and cap at maximum
  const targetSets = Math.floor(baseSets * rclMultiplier);
  return Math.min(targetSets, maxSets, maxAffordable);
};

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

  const bodyCosts = bodyList
    .map((body) => [calculateBodyCost(body), body])
    .sort((a, b) => b[0] - a[0]); // Sort by cost descending

  // Find base body that fits - always prefer largest affordable body
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
 * Ratio: 3 TOUGH : 1 RANGED_ATTACK : 1 MOVE, plus 1 CARRY for utility
 * @param {number} energyAvailable - Current energy available
 * @returns {Array} Body parts array
 */
const getFighterCreepBody = (energyAvailable) => {
  const carryCost = BODYPART_COST[CARRY]; // 50
  
  // Reserve energy for 1 CARRY part
  let remainingEnergy = energyAvailable - carryCost;
  
  if (remainingEnergy < 0) {
    return undefined; // Not enough energy
  }
  
  // Fighter set: [TOUGH×3, RANGED_ATTACK, MOVE]
  // Cost: 3*10 + 150 + 50 = 230 per set
  const bodySet = [TOUGH, TOUGH, TOUGH, RANGED_ATTACK, MOVE];
  const setCost = calculateBodyCost(bodySet);
  const maxSets = Math.floor(remainingEnergy / setCost);

  if (maxSets < 1) {
    return undefined; // Not enough energy for combat parts
  }

  // Cap at 9 sets to stay under 50 body parts (9 * 5 + 1 CARRY = 46)
  const sets = Math.min(maxSets, 9);

  // Build the body array: TOUGH parts first, then RANGED_ATTACK, then CARRY, then MOVE
  const body = [];

  // Add all TOUGH parts (3 per set) - absorbs damage first
  for (let i = 0; i < sets * 3; i++) {
    body.push(TOUGH);
  }

  // Add all RANGED_ATTACK parts (1 per set)
  for (let i = 0; i < sets; i++) {
    body.push(RANGED_ATTACK);
  }

  // Add 1 CARRY part for utility (can haul energy when not fighting)
  body.push(CARRY);

  // Add all MOVE parts (1 per set)
  for (let i = 0; i < sets; i++) {
    body.push(MOVE);
  }

  return body;
};

/**
 * Get explorer body (for multi-room exploration and claiming)
 * Pure function - no side effects
 * @param {number} rcl - Room Control Level
 * @param {number} energyAvailable - Current energy available
 * @returns {Array} Body parts array
 */
const getExplorerBody = (rcl, energyAvailable) => {
  const claimCost = BODYPART_COST[CLAIM];          // 600
  const rangedCost = BODYPART_COST[RANGED_ATTACK]; // 150
  const moveCost = BODYPART_COST[MOVE];            // 50
  const toughCost = BODYPART_COST[TOUGH];          // 10

  // Minimum: 1 CLAIM + 1 RANGED_ATTACK + 1 MOVE = 800 energy
  const minEnergy = claimCost + rangedCost + moveCost;
  
  if (energyAvailable < minEnergy) {
    return undefined; // Not enough energy for explorer
  }

  // Start with required parts
  let remainingEnergy = energyAvailable - minEnergy;
  
  // Build body: TOUGH first (takes damage), then CLAIM, RANGED_ATTACK, then MOVE
  const body = [];
  
  // Add MOVE + TOUGH pairs, prioritizing MOVE for speed (2 MOVE per 1 TOUGH)
  // Alternate: MOVE, MOVE, TOUGH pattern for 2:1 ratio
  let moveCount = 1; // Already have 1 from minimum
  let toughCount = 0;
  
  while (remainingEnergy > 0) {
    // Try to add 2 MOVE + 1 TOUGH (110 energy)
    if (remainingEnergy >= moveCost * 2 + toughCost) {
      moveCount += 2;
      toughCount += 1;
      remainingEnergy -= moveCost * 2 + toughCost;
    }
    // Try to add 1 MOVE (50 energy)
    else if (remainingEnergy >= moveCost) {
      moveCount += 1;
      remainingEnergy -= moveCost;
    }
    // Try to add 1 TOUGH (10 energy)
    else if (remainingEnergy >= toughCost) {
      toughCount += 1;
      remainingEnergy -= toughCost;
    }
    else {
      break; // Not enough energy for any more parts
    }
  }
  
  // Assemble body in optimal order
  for (let i = 0; i < toughCount; i++) body.push(TOUGH);
  body.push(CLAIM);
  body.push(RANGED_ATTACK);
  for (let i = 0; i < moveCount; i++) body.push(MOVE);
  
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
 * @param {Object} efficiencyMetrics - Optional efficiency metrics for adaptive sizing
 * @returns {Array} Body parts array
 */
const getGeneralistBody = (rcl, energyAvailable, efficiencyMetrics = null) => {
  // Balanced generalist: [WORK, CARRY, MOVE] sets
  const bodySet = [WORK, CARRY, MOVE]; // 200 per set
  const setCost = calculateBodyCost(bodySet);
  const maxSets = 16; // Cap at 16 sets to stay under 50 body parts limit (16 * 3 = 48)
  
  const sets = getAdaptiveSetCount(efficiencyMetrics, energyAvailable, setCost, maxSets, false, rcl);
  
  if (sets < 1) {
    return undefined;
  }
  
  const body = [];
  for (let i = 0; i < sets; i++) body.push(WORK);
  for (let i = 0; i < sets; i++) body.push(CARRY);
  for (let i = 0; i < sets; i++) body.push(MOVE);
  
  return body;
};

/**
 * Get miner body (stationary harvester at source)
 * Pure function - no side effects
 * @param {number} rcl - Room Control Level
 * @param {number} energyAvailable - Current energy available
 * @param {Object} efficiencyMetrics - Optional efficiency metrics for adaptive sizing
 * @returns {Array} Body parts array
 */
const getMinerBody = (rcl, energyAvailable, efficiencyMetrics = null) => {
  const tier = getRCLTier(rcl);
  
  if (tier === "early") {
    // RCL 1-3: Should not use miners yet, return generalist
    return getGeneralistBody(rcl, energyAvailable, efficiencyMetrics);
  }
  
  // Miner: [WORK, WORK, MOVE] sets, capped at 5 WORK parts total
  // Max source output is 10 energy/tick with 5 WORK parts (5 * 2 = 10)
  const bodySet = [WORK, WORK, MOVE]; // 250 per set
  const setCost = calculateBodyCost(bodySet);
  const maxSets = 2; // Cap at 2 sets = 4 WORK (with potential for 5th WORK)
  
  const sets = getAdaptiveSetCount(efficiencyMetrics, energyAvailable, setCost, maxSets, false, rcl);
  
  if (sets < 1) {
    return undefined;
  }
  
  const body = [];
  for (let i = 0; i < sets; i++) body.push(WORK);
  for (let i = 0; i < sets; i++) body.push(WORK);
  for (let i = 0; i < sets; i++) body.push(MOVE);
  
  // Try to add one more WORK if we have room (reaching 5 WORK total)
  const currentCost = calculateBodyCost(body);
  const remainingEnergy = energyAvailable - currentCost;
  if (sets === 2 && remainingEnergy >= BODYPART_COST[WORK] + BODYPART_COST[MOVE]) {
    body.unshift(WORK); // Add WORK at front
    body.push(MOVE);     // Add MOVE at end
  }
  
  return body;
};

/**
 * Get hauler body (pure transport, no WORK parts)
 * Pure function - no side effects
 * @param {number} rcl - Room Control Level
 * @param {number} energyAvailable - Current energy available
 * @param {Object} efficiencyMetrics - Optional efficiency metrics for adaptive sizing
 * @returns {Array} Body parts array
 */
const getHaulerBody = (rcl, energyAvailable, efficiencyMetrics = null) => {
  const tier = getRCLTier(rcl);
  
  if (tier === "early") {
    // RCL 1-3: Should not use haulers yet, return generalist
    return getGeneralistBody(rcl, energyAvailable, efficiencyMetrics);
  }
  
  // Haulers need 1 MOVE per 2 CARRY on roads
  // Build as many [CARRY×2, MOVE] sets as possible
  const setCost = BODYPART_COST[CARRY] * 2 + BODYPART_COST[MOVE]; // 150 per set
  
  // Cap based on tier
  let maxSets = 16; // 48 parts max (just under 50 limit)
  if (tier === "mid") {
    maxSets = 8; // Medium haulers for RCL 4-7
  }
  
  const sets = getAdaptiveSetCount(efficiencyMetrics, energyAvailable, setCost, maxSets, false, rcl);
  
  if (sets < 1) {
    return undefined;
  }
  
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
 * @param {Object} efficiencyMetrics - Optional efficiency metrics for adaptive sizing
 * @returns {Array} Body parts array
 */
const getUpgraderBody = (rcl, energyAvailable, efficiencyMetrics = null) => {
  const tier = getRCLTier(rcl);
  
  if (tier === "early") {
    // RCL 1-3: Use generalist body
    return getGeneralistBody(rcl, energyAvailable, efficiencyMetrics);
  }
  
  if (tier === "late") {
    // RCL 8+: Giant upgrader - [WORK×3, CARRY, MOVE, MOVE] sets
    const bodySet = [WORK, WORK, WORK, CARRY, MOVE, MOVE]; // 700 per set
    const setCost = calculateBodyCost(bodySet);
    const maxSets = 8; // Cap at 8 sets to stay under 50 body parts (8 * 6 = 48)
    
    const sets = getAdaptiveSetCount(efficiencyMetrics, energyAvailable, setCost, maxSets, false, rcl);
    
    if (sets < 1) {
      return undefined;
    }
    
    const body = [];
    for (let i = 0; i < sets * 3; i++) body.push(WORK);
    for (let i = 0; i < sets; i++) body.push(CARRY);
    for (let i = 0; i < sets * 2; i++) body.push(MOVE);
    
    return body;
  }
  
  // RCL 4-7: Medium upgrader - [WORK×2, CARRY, MOVE, MOVE] sets
  const bodySet = [WORK, WORK, CARRY, MOVE, MOVE]; // 500 per set
  const setCost = calculateBodyCost(bodySet);
  const maxSets = 10; // Cap at 10 sets to stay under 50 body parts (10 * 5 = 50)
  
  const sets = getAdaptiveSetCount(efficiencyMetrics, energyAvailable, setCost, maxSets, false, rcl);
  
  if (sets < 1) {
    return undefined;
  }
  
  const body = [];
  for (let i = 0; i < sets * 2; i++) body.push(WORK);
  for (let i = 0; i < sets; i++) body.push(CARRY);
  for (let i = 0; i < sets * 2; i++) body.push(MOVE);
  
  return body;
};

/**
 * Get builder body (balanced WORK/CARRY for construction)
 * Pure function - no side effects
 * @param {number} rcl - Room Control Level
 * @param {number} energyAvailable - Current energy available
 * @param {Object} efficiencyMetrics - Optional efficiency metrics for adaptive sizing
 * @returns {Array} Body parts array
 */
const getBuilderBody = (rcl, energyAvailable, efficiencyMetrics = null) => {
  const tier = getRCLTier(rcl);
  
  if (tier === "early") {
    // RCL 1-3: Use generalist body
    return getGeneralistBody(rcl, energyAvailable, efficiencyMetrics);
  }
  
  // RCL 4+: Builder - [WORK, CARRY, CARRY, MOVE, MOVE] sets
  const bodySet = [WORK, CARRY, CARRY, MOVE, MOVE]; // 350 per set
  const setCost = calculateBodyCost(bodySet);
  const maxSets = 10; // Cap at 10 sets to stay under 50 body parts (10 * 5 = 50)
  
  const sets = getAdaptiveSetCount(efficiencyMetrics, energyAvailable, setCost, maxSets, false, rcl);
  
  if (sets < 1) {
    return undefined;
  }
  
  const body = [];
  for (let i = 0; i < sets; i++) body.push(WORK);
  for (let i = 0; i < sets * 2; i++) body.push(CARRY);
  for (let i = 0; i < sets * 2; i++) body.push(MOVE);
  
  return body;
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
 * Enforces minimum creep counts and reserves energy for emergency fighters
 * Pure function - no side effects
 * @param {Object} roster - Target roster {role: count}
 * @param {Object} currentCreeps - Current creep counts by role
 * @param {Object} roomStatus - Room status info
 * @param {Room} room - The room object
 * @param {Object} efficiencyMetrics - Energy collection efficiency metrics
 * @returns {string|null} Role to spawn or null if none needed
 */
const determineSpawnRole = (roster, currentCreeps, roomStatus, room, efficiencyMetrics = null) => {
  const hasHostiles = room && utils.areThereInvaders(room);
  const emergencyReserve = getEmergencyReserve(roomStatus.energyCapacity);
  
  // PRIORITY 1: EMERGENCY - Spawn fighter if hostiles detected
  // Fighters bypass energy reserve (use all available energy)
  if (hasHostiles) {
    const fighterCount = currentCreeps.fighter || 0;
    const targetFighters = 2;
    if (fighterCount < targetFighters) {
      console.log(`⚔️ ALERT: Hostiles detected! Spawning emergency fighter (${fighterCount}/${targetFighters})`);
      return "fighter";
    }
  }

  const harvesterCount = currentCreeps.harvester || 0;
  const minerCount = currentCreeps.miner || 0;
  const builderCount = currentCreeps.builder || 0;
  const upgraderCount = currentCreeps.upgrader || 0;

  // PRIORITY 2: MINIMUM CREEPS - Always maintain core economy
  // These spawn with lowered thresholds to prevent economy collapse
  
  // 2a: Must have at least 2 energy harvesters
  if (harvesterCount < 2) {
    return "harvester";
  }
  
  // 2b: Must have at least 2 builders
  if (builderCount < 2) {
    return "builder";
  }
  
  // 2c: Must have at least 1 upgraders
  if (upgraderCount < 1) {
    return "upgrader";
  }

  // PRIORITY 3: ROSTER FULFILLMENT - Spawn additional creeps based on roster
  // Apply energy reserve for non-critical spawns (keep reserve for fighters)
  const effectiveEnergy = hasHostiles ? 
    roomStatus.energyAvailable :  // No reserve during attack (fighters already spawned)
    Math.max(0, roomStatus.energyAvailable - emergencyReserve);
  
  const effectiveCapacity = Math.max(300, roomStatus.energyCapacity - emergencyReserve);

  // Determine spawn threshold based on efficiency metrics
  let spawnThreshold = 0.7; // Default - wait for 70% capacity
  if (efficiencyMetrics) {
    spawnThreshold = efficiencyMetrics.spawnThreshold;
  }
  
  // Emergency override: if we have very few energy collectors, lower threshold
  if (harvesterCount + minerCount < 3) {
    spawnThreshold = Math.min(spawnThreshold, 0.3);
  }

  // Check energy conditions for non-critical spawning
  const canSpawn = effectiveEnergy >= effectiveCapacity * spawnThreshold;

  if (!canSpawn) {
    return null;
  }

  // Spawn priority order: harvesters > miners > haulers > builders > upgraders > specialized
  const priorityOrder = ['harvester', 'miner', 'hauler', 'builder', 'upgrader', 'mineralExtractor', 'chemist'];
  
  // First pass: check priority roles
  for (const role of priorityOrder) {
    if (roster[role]) {
      const current = currentCreeps[role] || 0;
      if (current < roster[role]) {
        return role;
      }
    }
  }
  
  // Second pass: any other roles in roster not in priority list
  for (const role of Object.keys(roster)) {
    if (!priorityOrder.includes(role)) {
      const current = currentCreeps[role] || 0;
      if (current < roster[role]) {
        return role;
      }
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
  const memory = { 
    role, 
    spawnTick: gameTime,
    spawnRoom: spawn.room.name,
    ...extraMemory 
  };
  const result = spawn.spawnCreep(body, name, { memory });
  
  // Track spawn statistics
  if (result === OK) {
    const energyCost = calculateBodyCost(body);
    stats.recordSpawn(spawn.room.name, role, body, energyCost);
  } else if (result === ERR_NOT_ENOUGH_ENERGY) {
    stats.recordSpawnFailure(spawn.room.name);
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
    // Display efficiency tier when not spawning
    if (efficiencyMetrics) {
      const tierEmoji = {
        'bootstrapping': '🌱',
        'developing': '🌿',
        'established': '🌳',
        'optimized': '⚡'
      };
      const emoji = tierEmoji[efficiencyMetrics.efficiencyTier] || '❓';
      const rate = efficiencyMetrics.energyCollectionRate.toFixed(1);
      spawn.room.visual.text(
        `${emoji} ${rate}/t`,
        spawn.pos.x + 1,
        spawn.pos.y,
        { align: "left", opacity: 0.6, font: 0.4 }
      );
    }
    return;
  }

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
 * @param {Object} efficiencyMetrics - Optional efficiency metrics for adaptive sizing
 * @returns {Array} Body parts array
 */
const getBodyForRole = (role, rcl, energyAvailable, room, currentCreeps, roster, efficiencyMetrics = null) => {
  const tier = getRCLTier(rcl);
  
  // Check for invaders (for combat parts in early tiers)
  const areInvaders = room ? utils.areThereInvaders(room) : false;
  
  // Determine if this is an emergency spawn (always allow minimum viable body)
  const harvesterCount = currentCreeps.harvester || 0;
  const minerCount = currentCreeps.miner || 0;
  const isEmergencyHarvester = (role === "harvester" || role === "miner") && (harvesterCount + minerCount < 2);
  
  switch (role) {
    case "harvester":
      // RCL 1-3 only
      return getGeneralistBody(rcl, energyAvailable, efficiencyMetrics);
    
    case "upgrader":
      return getUpgraderBody(rcl, energyAvailable, efficiencyMetrics);
    
    case "builder":
      return getBuilderBody(rcl, energyAvailable, efficiencyMetrics);
    
    case "miner":
      // RCL 4+ only
      return getMinerBody(rcl, energyAvailable, efficiencyMetrics);
    
    case "hauler":
      // RCL 4+ only
      return getHaulerBody(rcl, energyAvailable, efficiencyMetrics);
    
    case "transporter":
      // Legacy role (deprecated at RCL 4+)
      return getTransporterBody(energyAvailable);
    
    case "defender":
      return getDefenderBody(rcl, energyAvailable);
    
    case "fighter":
      // Emergency combat role
      return getFighterCreepBody(energyAvailable);
    
    case "explorer":
      // Multi-room exploration and claiming
      return getExplorerBody(rcl, energyAvailable);
    
    case "mineralExtractor":
      // RCL 6+ only (mineral mining)
      return getMineralExtractorBody(rcl, energyAvailable);
    
    case "chemist":
      // RCL 6+ only (lab logistics)
      return getChemistBody(rcl, energyAvailable);
    
    default:
      // Fallback to generalist for unknown roles
      return getGeneralistBody(rcl, energyAvailable, efficiencyMetrics);
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
 * @param {Object} efficiencyMetrics - Optional energy collection efficiency metrics
 * @returns {Object} Spawn result info
 */
const spawnProcedure = (spawn, roster, roomStatus, efficiencyMetrics = null) => {
  if (!spawn || spawn.spawning) {
    displaySpawningVisual(spawn, efficiencyMetrics);
    return {
      spawned: false,
      reason: spawn && spawn.spawning ? "busy" : "no_spawn",
    };
  }

  const currentCreeps = countCreepsByRole(Game.creeps);
  const room = Game.rooms[roomStatus.roomName];
  const rcl = roomStatus.controllerLevel;

  // Try primary spawn based on roster (includes emergency fighter spawning)
  const primaryRole = determineSpawnRole(roster, currentCreeps, roomStatus, room, efficiencyMetrics);
  if (primaryRole) {
    // Get appropriate body for role and RCL
    const spawnBody = getBodyForRole(
      primaryRole,
      rcl,
      roomStatus.energyAvailable,
      room,
      currentCreeps,
      roster,
      efficiencyMetrics
    );
    
    if (!spawnBody) {
      displaySpawningVisual(spawn, efficiencyMetrics);
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
    displaySpawningVisual(spawn, efficiencyMetrics);
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
      roster,
      efficiencyMetrics
    );
    
    if (!extraBody) {
      displaySpawningVisual(spawn, efficiencyMetrics);
      return { spawned: false, reason: "insufficient_energy" };
    }

    const result = executeSpawn(spawn, extraRole, extraBody, Game.time);
    displaySpawningVisual(spawn, efficiencyMetrics);
    return { spawned: result === OK, role: extraRole, result, extra: true };
  }

  displaySpawningVisual(spawn, efficiencyMetrics);
  return { spawned: false, reason: "roster_full" };
};

/**
 * Get mineral extractor body (stationary mineral harvester)
 * Pure function - no side effects
 * @param {number} rcl - Room Control Level
 * @param {number} energyAvailable - Current energy available
 * @returns {Array} Body parts array
 */
const getMineralExtractorBody = (rcl, energyAvailable) => {
  // Only spawn mineral extractors at RCL 6+ (when extractors available)
  if (rcl < 6) {
    return undefined;
  }

  // Mineral extractor: [WORK×2, MOVE, CARRY] sets
  // Max of 10 WORK parts for maximum mineral harvest rate
  // Always include at least 1 CARRY part to hold mined minerals
  const bodySet = [WORK, WORK, MOVE, CARRY]; // 300 per set
  const setCost = calculateBodyCost(bodySet);
  const maxSets = Math.floor(energyAvailable / setCost);
  
  if (maxSets < 1) {
    return undefined;
  }
  
  // Cap at 5 sets = 10 WORK parts (good balance)
  const sets = Math.min(maxSets, 5);
  
  const body = [];
  for (let i = 0; i < sets * 2; i++) body.push(WORK);
  for (let i = 0; i < sets; i++) body.push(MOVE);
  for (let i = 0; i < sets; i++) body.push(CARRY);
  
  return body;
};

/**
 * Get chemist body (lab logistics)
 * Pure function - no side effects
 * @param {number} rcl - Room Control Level
 * @param {number} energyAvailable - Current energy available
 * @returns {Array} Body parts array
 */
const getChemistBody = (rcl, energyAvailable) => {
  // Only spawn chemists at RCL 6+ (when labs available)
  if (rcl < 6) {
    return undefined;
  }

  // Chemist: small [CARRY, MOVE] sets
  // Low priority, small body to minimize cost
  const bodySet = [CARRY, MOVE]; // 100 per set
  const setCost = calculateBodyCost(bodySet);
  const maxSets = Math.floor(energyAvailable / setCost);
  
  if (maxSets < 1) {
    return undefined;
  }
  
  // Cap at 4 sets = 8 parts (small, efficient)
  const sets = Math.min(maxSets, 4);
  
  const body = [];
  for (let i = 0; i < sets; i++) body.push(CARRY);
  for (let i = 0; i < sets; i++) body.push(MOVE);
  
  return body;
};

module.exports = {
  // Pure functions
  getCreepBody: getWorkerCreepBody,
  getFighterCreepBody,
  getTransporterBody,
  getEmergencyReserve,
  
  // RCL-based body generators
  getRCLTier,
  getGeneralistBody,
  getMinerBody,
  getHaulerBody,
  getUpgraderBody,
  getBuilderBody,
  getDefenderBody,
  getExplorerBody,
  getMineralExtractorBody,
  getChemistBody,
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
