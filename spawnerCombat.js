/**
 * Spawner Combat Module
 * Handles invasion threat assessment, tower defensive capacity analysis,
 * and defender spawn need calculation
 */

const CONFIG = require("./config");

/**
 * Get attack power of a hostile creep based on body parts
 * Pure function - no side effects
 * @param {Creep} hostile - The hostile creep to analyze
 * @returns {number} Total attack power (damage per tick)
 */
const getInvaderAttackPower = (hostile) => {
  if (!hostile || !hostile.body) {
    return 0;
  }

  let attackPower = 0;

  for (const part of hostile.body) {
    if (part.type === ATTACK) {
      attackPower += 80; // ATTACK does 80 damage per tick at melee range
    } else if (part.type === RANGED_ATTACK) {
      attackPower += 35; // RANGED_ATTACK does 10-50 dmg, use 35 as average
    }
  }

  return attackPower;
};

/**
 * Analyze invasion threat in a room
 * Pure function - no side effects
 * @param {Room} room - The room to analyze
 * @returns {Object} Threat analysis: { invaderCount, totalAttackPower, hasKilledCreeps, avgInvaderHP, locations }
 */
const analyzeInvasionThreat = (room) => {
  const hostiles = room.find(FIND_HOSTILE_CREEPS);

  if (hostiles.length === 0) {
    return {
      invaderCount: 0,
      totalAttackPower: 0,
      hasKilledCreeps: false,
      avgInvaderHP: 0,
      locations: [],
    };
  }

  let totalAttackPower = 0;
  let totalHP = 0;
  const locations = [];

  for (const hostile of hostiles) {
    totalAttackPower += getInvaderAttackPower(hostile);
    totalHP += hostile.hits;
    locations.push(hostile.pos);
  }

  const avgInvaderHP = totalHP / hostiles.length;

  // Check if any creeps were recently killed (stored in room memory)
  const roomMemory = Memory.rooms[room.name];
  const hasKilledCreeps =
    roomMemory &&
    roomMemory.recentCreepLosses &&
    roomMemory.recentCreepLosses.length > 0;

  return {
    invaderCount: hostiles.length,
    totalAttackPower,
    hasKilledCreeps,
    avgInvaderHP,
    locations,
  };
};

/**
 * Estimate total invader threat with aggression multipliers
 * Pure function - no side effects
 * @param {Array} hostiles - Array of hostile creeps
 * @param {Array} recentLosses - Array of recent creep losses with positions
 * @param {Room} room - The room being analyzed
 * @returns {number} Weighted threat level
 */
const estimateInvaderThreat = (hostiles, recentLosses, room) => {
  if (hostiles.length === 0) {
    return 0;
  }

  let baseThreat = 0;

  for (const hostile of hostiles) {
    baseThreat += getInvaderAttackPower(hostile);
  }

  let multiplier = 1.0;

  // Check if invaders are near structures (within 3 tiles)
  const structures = room.find(FIND_MY_STRUCTURES);
  const nearStructures = hostiles.some((hostile) =>
    structures.some((structure) => hostile.pos.getRangeTo(structure) <= 3)
  );

  if (nearStructures) {
    multiplier *= CONFIG.DEFENDER.THREAT_MULTIPLIER_IF_ATTACKS;
  }

  // Check if we've had recent creep losses
  if (recentLosses && recentLosses.length > 0) {
    multiplier *= CONFIG.DEFENDER.THREAT_MULTIPLIER_IF_KILLS;
  }

  return baseThreat * multiplier;
};

/**
 * Calculate tower defensive capacity
 * Pure function - no side effects
 * @param {Room} room - The room to analyze
 * @returns {Object} Defensive capacity: { towerCount, avgEnergyPercent, estimatedDPS, canHandleThreat }
 */
const calculateTowerDefensiveCapacity = (room) => {
  const towers = room.find(FIND_MY_STRUCTURES, {
    filter: (s) => s.structureType === STRUCTURE_TOWER,
  });

  if (towers.length === 0) {
    return {
      towerCount: 0,
      avgEnergyPercent: 0,
      estimatedDPS: 0,
      canHandleThreat: false,
    };
  }

  let totalEnergyPercent = 0;

  for (const tower of towers) {
    const energyPercent = tower.store[RESOURCE_ENERGY] / tower.store.getCapacity(RESOURCE_ENERGY);
    totalEnergyPercent += energyPercent;
  }

  const avgEnergyPercent = totalEnergyPercent / towers.length;

  // Estimate DPS: Each tower does ~150-600 damage depending on range
  // Use 300 as average for mid-range combat
  const estimatedDPS = towers.length * 300 * avgEnergyPercent;

  return {
    towerCount: towers.length,
    avgEnergyPercent,
    estimatedDPS,
    canHandleThreat: avgEnergyPercent >= CONFIG.DEFENDER.MIN_TOWER_ENERGY_PERCENT,
  };
};

/**
 * Determine if defenders should be spawned
 * Pure function - no side effects
 * @param {Room} room - The room to analyze
 * @param {Object} currentCreeps - Current creep counts by role
 * @returns {Object} Decision: { needed: number, reason: string }
 */
const shouldSpawnDefenders = (room, currentCreeps) => {
  const threatAnalysis = analyzeInvasionThreat(room);

  // No threat - no defenders needed
  if (threatAnalysis.invaderCount === 0) {
    return { needed: 0, reason: "No invasion threat detected" };
  }

  const towerCapacity = calculateTowerDefensiveCapacity(room);
  const roomMemory = Memory.rooms[room.name];
  const recentLosses = (roomMemory && roomMemory.recentCreepLosses) || [];

  // Get weighted threat level
  const hostiles = room.find(FIND_HOSTILE_CREEPS);
  const invaderThreat = estimateInvaderThreat(hostiles, recentLosses, room);

  // Calculate tower defensive power
  const towerPower =
    towerCapacity.towerCount *
    towerCapacity.avgEnergyPercent *
    CONFIG.DEFENDER.TOWER_EFFECTIVENESS_FACTOR *
    100; // Scale to match threat levels

  // If towers are low on energy, we need defenders regardless
  if (!towerCapacity.canHandleThreat) {
    const currentDefenders = currentCreeps.defender || 0;
    const needed = Math.min(
      Math.max(1, threatAnalysis.invaderCount),
      CONFIG.DEFENDER.MAX_DEFENDERS
    ) - currentDefenders;

    return {
      needed: Math.max(0, needed),
      reason: `Towers low on energy (${Math.round(towerCapacity.avgEnergyPercent * 100)}%), ${threatAnalysis.invaderCount} invaders present`,
    };
  }

  // Calculate defensive gap
  // Assume each defender can handle ~80 threat points (1 ATTACK part base)
  const defenderGap = Math.ceil((invaderThreat - towerPower) / 80);
  const currentDefenders = currentCreeps.defender || 0;
  const needed = Math.max(0, Math.min(defenderGap, CONFIG.DEFENDER.MAX_DEFENDERS) - currentDefenders);

  if (needed > 0) {
    return {
      needed,
      reason: `Threat level ${Math.round(invaderThreat)} exceeds tower capacity ${Math.round(towerPower)}. ${threatAnalysis.invaderCount} invaders, ${currentDefenders} defenders active`,
    };
  }

  return {
    needed: 0,
    reason: `Towers can handle current threat (${threatAnalysis.invaderCount} invaders)`,
  };
};

module.exports = {
  getInvaderAttackPower,
  analyzeInvasionThreat,
  estimateInvaderThreat,
  calculateTowerDefensiveCapacity,
  shouldSpawnDefenders,
};
