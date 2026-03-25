  /**
   * Spawner Body Utils Module
   * Pure functions for calculating creep body compositions
   * All functions are side-effect free and deterministic
   */

  const CONFIG = require("./config");

  /**
   * Calculate total energy cost of a body composition
   * Pure function - no side effects
   * @param {Array} body - Array of body part constants
   * @returns {number} Total energy cost
   */
  const calculateBodyCost = (body) =>
    body.reduce((total, part) => total + BODYPART_COST[part], 0);

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
  const getAdaptiveSetCount = (
    efficiencyMetrics,
    energyAvailable,
    setCost,
    maxSets,
    isEmergency = false,
    rcl = 1,
  ) => {
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
    const rclMultiplier = CONFIG.SPAWNING.RCL_MULTIPLIERS[rcl] || 1;

    // If no metrics provided, use conservative sizing with RCL factor
    if (!efficiencyMetrics) {
      const baseTarget = Math.max(1, Math.floor(maxAffordable / 2));
      return Math.min(
        Math.floor(baseTarget * rclMultiplier),
        maxSets,
        maxAffordable,
      );
    }

    // Determine base target sets based on efficiency tier
    let baseSets;
    const tier = efficiencyMetrics.efficiencyTier;

    switch (tier) {
      case "bootstrapping":
        baseSets = CONFIG.EFFICIENCY.BODY_SETS.BOOTSTRAPPING;
        break;
      case "developing":
        baseSets = CONFIG.EFFICIENCY.BODY_SETS.DEVELOPING;
        break;
      case "established":
        baseSets = CONFIG.EFFICIENCY.BODY_SETS.ESTABLISHED;
        break;
      case "optimized":
        baseSets = CONFIG.EFFICIENCY.BODY_SETS.OPTIMIZED;
        break;
      default:
        baseSets = CONFIG.EFFICIENCY.BODY_SETS.BOOTSTRAPPING;
    }

    // Apply RCL multiplier and cap at maximum
    const targetSets = Math.floor(baseSets * rclMultiplier);
    return Math.min(targetSets, maxSets, maxAffordable);
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
    const maxSets = CONFIG.SPAWNING.BODY_LIMITS.MAX_GENERALIST_SETS;

    const sets = getAdaptiveSetCount(
      efficiencyMetrics,
      energyAvailable,
      setCost,
      maxSets,
      false,
      rcl,
    );

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
    const maxSets = CONFIG.SPAWNING.BODY_LIMITS.MINER_SETS_BEFORE_EXTRA_WORK;

    const sets = getAdaptiveSetCount(
      efficiencyMetrics,
      energyAvailable,
      setCost,
      maxSets,
      false,
      rcl,
    );

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
    if (
      sets === CONFIG.SPAWNING.BODY_LIMITS.MINER_SETS_BEFORE_EXTRA_WORK &&
      remainingEnergy >= BODYPART_COST[WORK] + BODYPART_COST[MOVE]
    ) {
      body.unshift(WORK); // Add WORK at front
      body.push(MOVE); // Add MOVE at end
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
    let maxSets = CONFIG.SPAWNING.BODY_LIMITS.MAX_HAULER_SETS_LATE;
    if (tier === "mid") {
      maxSets = CONFIG.SPAWNING.BODY_LIMITS.MAX_HAULER_SETS_MID;
    }

    const sets = getAdaptiveSetCount(
      efficiencyMetrics,
      energyAvailable,
      setCost,
      maxSets,
      false,
      rcl,
    );

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
      // RCL 8: Heavy upgrader - [WORK×5, CARRY, MOVE×3] sets
      const bodySet = [WORK, WORK, WORK, WORK, WORK, CARRY, MOVE, MOVE, MOVE]; // 750 per set
      const setCost = calculateBodyCost(bodySet);
      const maxSets = CONFIG.SPAWNING.BODY_LIMITS.MAX_UPGRADER_SETS_LATE;

      const sets = getAdaptiveSetCount(
        efficiencyMetrics,
        energyAvailable,
        setCost,
        maxSets,
        false,
        rcl,
      );

      if (sets < 1) {
        return undefined;
      }

      const body = [];
      for (let i = 0; i < sets * 5; i++) body.push(WORK);
      for (let i = 0; i < sets; i++) body.push(CARRY);
      for (let i = 0; i < sets * 3; i++) body.push(MOVE);

      return body;
    }

    // RCL 4-7: Medium upgrader - [WORK×2, CARRY, MOVE×2] sets
    const bodySet = [WORK, WORK, CARRY, MOVE, MOVE]; // 500 per set
    const setCost = calculateBodyCost(bodySet);
    const maxSets = CONFIG.SPAWNING.BODY_LIMITS.MAX_UPGRADER_SETS_MID;

    const sets = getAdaptiveSetCount(
      efficiencyMetrics,
      energyAvailable,
      setCost,
      maxSets,
      false,
      rcl,
    );

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
    const maxSets = CONFIG.SPAWNING.BODY_LIMITS.MAX_BUILDER_SETS;

    const sets = getAdaptiveSetCount(
      efficiencyMetrics,
      energyAvailable,
      setCost,
      maxSets,
      false,
      rcl,
    );

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
      // RCL 1-3: Minimal defender
      const bodyList = [
        [TOUGH, ATTACK, ATTACK, MOVE, MOVE],
        [ATTACK, MOVE],
      ];

      for (const body of bodyList) {
        const cost = calculateBodyCost(body);
        if (energyAvailable >= cost) {
          return body;
        }
      }
      return undefined;
    }

    if (tier === "late") {
      // RCL 8: Heavy defender with ranged support
      const bodyList = [
        [
          TOUGH,
          TOUGH,
          TOUGH,
          TOUGH,
          ATTACK,
          ATTACK,
          ATTACK,
          RANGED_ATTACK,
          RANGED_ATTACK,
          MOVE,
          MOVE,
          MOVE,
          MOVE,
          MOVE,
          MOVE,
          MOVE,
        ],
        [
          TOUGH,
          TOUGH,
          TOUGH,
          ATTACK,
          ATTACK,
          ATTACK,
          RANGED_ATTACK,
          MOVE,
          MOVE,
          MOVE,
          MOVE,
          MOVE,
        ],
        [TOUGH, TOUGH, ATTACK, ATTACK, RANGED_ATTACK, MOVE, MOVE, MOVE, MOVE],
        [TOUGH, ATTACK, ATTACK, MOVE, MOVE, MOVE],
        [TOUGH, ATTACK, MOVE],
      ];

      for (const body of bodyList) {
        const cost = calculateBodyCost(body);
        if (energyAvailable >= cost) {
          return body;
        }
      }
      return undefined;
    }

    // RCL 4-7: Medium defender
    const bodyList = [
      [TOUGH, TOUGH, ATTACK, ATTACK, RANGED_ATTACK, MOVE, MOVE, MOVE, MOVE, MOVE],
      [TOUGH, ATTACK, ATTACK, MOVE, MOVE, MOVE],
      [TOUGH, ATTACK, MOVE],
    ];

    for (const body of bodyList) {
      const cost = calculateBodyCost(body);
      if (energyAvailable >= cost) {
        return body;
      }
    }

    return undefined;
  };

  /**
   * Get fighter creep body based on available energy
   * Pure function - no side effects
   * Design: Max 2 ATTACK parts, 1 CARRY for utility, TOUGH for armor, and appropriate MOVE for speed
   * Target: 1 MOVE per 2 body parts for full speed on roads
   * @param {number} energyAvailable - Current energy available
   * @returns {Array} Body parts array
   */
  const getFighterCreepBody = (energyAvailable) => {
    const toughCost = BODYPART_COST[TOUGH]; // 10
    const attackCost = BODYPART_COST[ATTACK]; // 80
    const carryCost = BODYPART_COST[CARRY]; // 50
    const workCost = BODYPART_COST[WORK]; // 100
    const moveCost = BODYPART_COST[MOVE]; // 50

    // Minimum viable fighter: 1 ATTACK + 1 CARRY + 1 MOVE = 180
    const minCost = attackCost + carryCost + workCost + moveCost;
    if (energyAvailable < minCost) {
      return undefined;
    }

    let remainingEnergy = energyAvailable;

    // Determine how many ATTACK we can afford (max 2)
    let attackCount = 0;
    if (remainingEnergy >= attackCost * 2) {
      attackCount = 2;
      remainingEnergy -= attackCost * 2;
    } else if (remainingEnergy >= attackCost) {
      attackCount = 1;
      remainingEnergy -= attackCost;
    } else {
      return undefined;
    }

    // Reserve 1 CARRY for utility
    const carryCount = 1;
    remainingEnergy -= carryCost;

    // Calculate TOUGH and MOVE parts with remaining energy
    // Strategy: Add sets of [TOUGH, TOUGH, MOVE] = 70 energy
    // This gives 1 MOVE per 2 non-MOVE parts (full speed on roads)
    const toughMoveSetCost = toughCost * 2 + moveCost; // 70
    let toughCount = 0;
    let moveCount = 0;

    // Add as many [TOUGH×2, MOVE] sets as we can afford
    while (
      remainingEnergy >= toughMoveSetCost &&
      attackCount + carryCount + toughCount + moveCount <
        CONFIG.SPAWNING.BODY_LIMITS.SOFT_LIMIT
    ) {
      toughCount += 2;
      moveCount += 1;
      remainingEnergy -= toughMoveSetCost;
    }

    // Add any remaining TOUGH parts we can afford
    while (
      remainingEnergy >= toughCost &&
      attackCount + carryCount + toughCount + moveCount <
        CONFIG.SPAWNING.BODY_LIMITS.HARD_LIMIT
    ) {
      toughCount += 1;
      remainingEnergy -= toughCost;
    }

    // Ensure at least 1 MOVE for minimum mobility
    if (moveCount === 0) {
      if (remainingEnergy >= moveCost) {
        moveCount = 1;
        remainingEnergy -= moveCost;
      } else {
        // Not enough energy for minimum viable fighter
        // Need to remove 1 TOUGH to make room for 1 MOVE
        if (toughCount > 0) {
          toughCount -= 1;
          moveCount = 1;
        } else {
          return undefined; // Cannot build valid fighter
        }
      }
    }

    // Final check: ensure proper MOVE ratio (add more MOVE if needed for heavy fighters)
    const nonMovePartsCount = attackCount + carryCount + toughCount;
    const idealMoveCount = Math.ceil(nonMovePartsCount / 2); // 1 MOVE per 2 parts

    // Add more MOVE if we're under the ideal and have budget
    while (
      moveCount < idealMoveCount &&
      remainingEnergy >= moveCost &&
      nonMovePartsCount + moveCount < CONFIG.SPAWNING.BODY_LIMITS.HARD_LIMIT
    ) {
      moveCount++;
      remainingEnergy -= moveCost;
    }

    // Build the body array: TOUGH first (absorbs damage), then ATTACK, then CARRY, then MOVE
    const body = [];

    for (let i = 0; i < toughCount; i++) {
      body.push(TOUGH);
    }

    for (let i = 0; i < attackCount; i++) {
      body.push(ATTACK);
    }

    for (let i = 0; i < carryCount; i++) {
      body.push(CARRY);
    }

    for (let i = 0; i < moveCount; i++) {
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
    const claimCost = BODYPART_COST[CLAIM]; // 600
    const rangedCost = BODYPART_COST[RANGED_ATTACK]; // 150
    const moveCost = BODYPART_COST[MOVE]; // 50
    const toughCost = BODYPART_COST[TOUGH]; // 10

    // Minimum: 1 CLAIM + 1 RANGED_ATTACK + 1 MOVE = 800 energy
    if (energyAvailable < CONFIG.SPAWNING.BODY_COSTS.EXPLORER_MIN_ENERGY) {
      return undefined;
    }

    const minEnergy = claimCost + rangedCost + moveCost;

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
      } else {
        break;
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
   * Get transporter creep body based on available energy
   * Creates as many [WORK, CARRY, MOVE] sets as possible
   * Pure function - no side effects
   * @param {number} energyAvailable - Current energy available
   * @returns {Array} Body parts array
   */
  const getTransporterBody = (energyAvailable) => {
    const setcost =
      BODYPART_COST[WORK] + BODYPART_COST[CARRY] + BODYPART_COST[MOVE]; // 200
    const maxSets = Math.floor(energyAvailable / setcost);

    if (maxSets < 1) {
      return undefined;
    }

    // Cap at 16 sets to stay under 50 body parts limit (16 * 3 = 48)
    const sets = Math.min(
      maxSets,
      CONFIG.SPAWNING.BODY_LIMITS.MAX_GENERALIST_SETS,
    );

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

  /**
   * Get claimer body for claiming/reserving rooms
   * Pure function - no side effects
   * @param {number} rcl - Room Control Level
   * @param {number} energyAvailable - Current energy available
   * @returns {Array} Body parts array
   */
  const getClaimerBody = (rcl, energyAvailable) => {
    // Only spawn claimers at RCL 4+ (when claiming/reserving becomes relevant)
    if (rcl < 4) {
      return undefined;
    }

    // Claimer: [CLAIM, WORK, CARRY, MOVE] sets
    const bodySet = [CLAIM, WORK, CARRY, MOVE]; // 650 per set
    const additionalSet = [MOVE];
    const additionalSetCost = calculateBodyCost(additionalSet); // 50
    const setCost = calculateBodyCost(bodySet);
    if (energyAvailable < setCost) {
      return undefined;
    }

    // Start with 1 CLAIM + support parts
    let body = [...bodySet];
    let remainingEnergy = energyAvailable - setCost;

    // Add additional MOVE parts if we have energy (for better mobility)
    while (remainingEnergy >= additionalSetCost && body.length < 10) {
      body.push(MOVE);
      remainingEnergy -= additionalSetCost;
    }

    return body;
  };

  /**
   * Get appropriate body for a role based on RCL
   * Pure function - no side effects
   * @param {string} role - Creep role
   * @param {number} rcl - Room Control Level
   * @param {number} energyAvailable - Current energy available
   * @param {Room} room - The room object
   * @param {Object} efficiencyMetrics - Optional efficiency metrics for adaptive sizing
   * @returns {Array} Body parts array
   */
  const getBodyForRole = (
    role,
    rcl,
    energyAvailable,
    room,
    efficiencyMetrics = null,
  ) => {
    const tier = getRCLTier(rcl);

    switch (role) {
      case "harvester":
        return getGeneralistBody(rcl, energyAvailable, efficiencyMetrics);

      case "hauler":
        return getHaulerBody(rcl, energyAvailable, efficiencyMetrics);

      case "upgrader":
        return getUpgraderBody(rcl, energyAvailable, efficiencyMetrics);

      case "builder":
        return getBuilderBody(rcl, energyAvailable, efficiencyMetrics);

      case "fighter":
        return getFighterCreepBody(energyAvailable);

      case "explorer":
        return getExplorerBody(rcl, energyAvailable);

      case "claimer":
        return getClaimerBody(rcl, energyAvailable);

      case "transporter":
        return getTransporterBody(energyAvailable);

      case "miner":
        return getMinerBody(rcl, energyAvailable, efficiencyMetrics);

      case "mineralExtractor":
        return getMineralExtractorBody(rcl, energyAvailable);

      case "chemist":
        return getChemistBody(rcl, energyAvailable);

      default:
        return undefined;
    }
  };

  module.exports = {
    calculateBodyCost,
    getAdaptiveSetCount,
    getRCLTier,
    getGeneralistBody,
    getMinerBody,
    getHaulerBody,
    getUpgraderBody,
    getBuilderBody,
    getDefenderBody,
    getFighterCreepBody,
    getExplorerBody,
    getTransporterBody,
    getMineralExtractorBody,
    getChemistBody,
    getClaimerBody,
    getBodyForRole,
  };
