/**
 * Spawner Helpers Module
 * Utility functions for resource management and room analysis
 * Pure functions - no side effects
 */

const CONFIG = require("./config");
const flagManager = require("./flagManager");
const utils = require("./utils");

// Import for priority check functions
let trySpawn = null;
let displaySpawningVisual = null;
let getRequiredDefenderCount = null;
let getRequiredOffensiveFighterCount = null;
let findBestRoleToSpawn = null;
let getRemoteHarvestingNeeds = null;

// Lazy load to avoid circular dependencies
const getTrySpawn = () => {
  if (!trySpawn) {
    const spawnerCore = require("./spawnerCore");
    trySpawn = spawnerCore.trySpawn;
    displaySpawningVisual = spawnerCore.displaySpawningVisual;
  }
  return { trySpawn, displaySpawningVisual };
};

const getRosterFunctions = () => {
  if (!getRequiredDefenderCount) {
    const spawnerRoster = require("./spawnerRoster");
    getRequiredDefenderCount = spawnerRoster.getRequiredDefenderCount;
    getRequiredOffensiveFighterCount = spawnerRoster.getRequiredOffensiveFighterCount;
    findBestRoleToSpawn = spawnerRoster.findBestRoleToSpawn;
    getRemoteHarvestingNeeds = spawnerRoster.getRemoteHarvestingNeeds;
  }
  return { getRequiredDefenderCount, getRequiredOffensiveFighterCount, findBestRoleToSpawn, getRemoteHarvestingNeeds };
};

/**
 * Calculate emergency energy reserve for fighter spawning
 * Reserve scales with room energy capacity to ensure fighters can always spawn
 * @param {number} energyCapacity - Room's maximum energy capacity
 * @returns {number} Energy to reserve for emergency fighter spawning
 */
const getEmergencyReserve = (energyCapacity) => {
  // Can't reserve if capacity is too low
  if (energyCapacity < CONFIG.SPAWNING.RESERVES.MIN_CAPACITY_FOR_RESERVE) return 0;

  // Scale reserve based on capacity tiers
  if (energyCapacity < CONFIG.SPAWNING.RESERVES.BASIC_FIGHTER_THRESHOLD) return CONFIG.SPAWNING.RESERVES.BASIC_RESERVE_AMOUNT;
  if (energyCapacity < CONFIG.SPAWNING.RESERVES.MEDIUM_FIGHTER_THRESHOLD) return CONFIG.SPAWNING.RESERVES.MEDIUM_RESERVE_AMOUNT;
  return CONFIG.SPAWNING.RESERVES.LARGE_RESERVE_AMOUNT;
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
    .map((m) => m.memory.assignedSource)
    .filter(Boolean);

  // Find a source without a miner
  const unassignedSource = sources.find((s) => !assignedSources.includes(s.id));
  return unassignedSource
    ? unassignedSource.id
    : sources[0]
      ? sources[0].id
      : null;
};

/**
 * Find all labs in a room
 * Pure function - no side effects
 * @param {Room} room - The room
 * @returns {Array} Array of lab objects with id and position
 */
const findLabs = (room) => {
  return room
    .find(FIND_STRUCTURES, {
      filter: (s) => s.structureType === STRUCTURE_LAB,
    })
    .map((lab) => ({
      id: lab.id,
      pos: lab.pos,
      mineralType: lab.mineralType,
      mineralAmount: lab.mineralAmount,
      energy: lab.energy,
    }));
};

/**
 * Find mineral in a room
 * Pure function - no side effects
 * @param {Room} room - The room
 * @returns {string|null} Mineral type or null
 */
const findMineralInRoom = (room) => {
  const minerals = room.find(FIND_MINERALS);
  if (minerals.length > 0) {
    return minerals[0].mineralType;
  }
  return null;
};

// ============================================================================
// Priority Check Functions
// ============================================================================

/**
 * Check if defenders should be spawned (Priority 1)
 * @param {StructureSpawn} spawn - The spawn structure
 * @param {Room} room - The room object
 * @param {Object} currentCreeps - Current creep counts by role
 * @param {Object} roomStatus - Room status
 * @param {Object} efficiencyMetrics - Energy collection efficiency metrics
 * @returns {Object|null} Spawn result or null if not needed
 */
const checkDefenderPriority = (spawn, room, currentCreeps, roomStatus, efficiencyMetrics) => {
  const { getRequiredDefenderCount } = getRosterFunctions();
  const { trySpawn } = getTrySpawn();
  
  const requiredDefenders = getRequiredDefenderCount(room, currentCreeps);
  const currentDefenders = currentCreeps.defender || 0;
  
  if (requiredDefenders > 0 && currentDefenders < requiredDefenders) {
    console.log(
      `🛡️ Spawning defender (${currentDefenders + 1}/${requiredDefenders}) for invasion response`
    );
    return trySpawn(spawn, "defender", roomStatus, room, efficiencyMetrics);
  }
  
  return null;
};

/**
 * Check if offensive fighters should be spawned (Priority 2)
 * Spawns fighters by class in priority order: fodder → invader → healer → shooter
 * @param {StructureSpawn} spawn - The spawn structure
 * @param {Room} room - The room object
 * @param {Object} currentCreeps - Current creep counts by role
 * @param {Object} roomStatus - Room status
 * @param {Object} efficiencyMetrics - Energy collection efficiency metrics
 * @returns {Object|null} Spawn result or null if not needed
 */
const checkOffensiveFighterPriority = (spawn, room, currentCreeps, roomStatus, efficiencyMetrics) => {
  const { getRequiredOffensiveFighterCount } = getRosterFunctions();
  const { trySpawn } = getTrySpawn();
  
  const requirements = getRequiredOffensiveFighterCount(roomStatus.controllerLevel);
  
  if (requirements.total === 0) {
    return null;
  }
  
  // Count current fighters by class
  const currentByClass = {
    fodder: 0,
    invader: 0,
    healer: 0,
    shooter: 0
  };
  
  for (const creep of Object.values(Game.creeps)) {
    if (creep.memory.spawnRoom !== roomStatus.roomName) continue;
    if (creep.memory.role !== 'fighter') continue;
    
    const fighterClass = creep.memory.fighterClass;
    if (fighterClass && currentByClass.hasOwnProperty(fighterClass)) {
      currentByClass[fighterClass]++;
    }
  }
  
  // Calculate total current fighters
  const totalCurrent = Object.values(currentByClass).reduce((sum, count) => sum + count, 0);
  
  // Try to spawn by priority order: fodder → invader → healer → shooter
  const classOrder = ['fodder', 'invader', 'healer', 'shooter'];
  
  for (const fighterClass of classOrder) {
    const required = requirements.byClass[fighterClass];
    const current = currentByClass[fighterClass];
    
    if (current < required) {
      console.log(
        `⚔️ Spawning ${fighterClass} fighter (${current + 1}/${required}) - Total: ${totalCurrent + 1}/${requirements.total}`
      );
      return trySpawn(spawn, "fighter", roomStatus, room, efficiencyMetrics, fighterClass);
    }
  }
  
  return null;
};

/**
 * Check if remote harvesting miners/haulers should be spawned (Priority 2.5)
 * Spawns miners and haulers for remote source flags
 * @param {StructureSpawn} spawn - The spawn structure
 * @param {Room} room - The room object
 * @param {Object} currentCreeps - Current creep counts by role
 * @param {Object} roomStatus - Room status
 * @param {Object} efficiencyMetrics - Energy collection efficiency metrics
 * @returns {Object|null} Spawn result or null if not needed
 */
const checkRemoteHarvestingPriority = (spawn, room, currentCreeps, roomStatus, efficiencyMetrics) => {
  const { getRemoteHarvestingNeeds } = getRosterFunctions();
  const { trySpawn } = getTrySpawn();
  
  const needs = getRemoteHarvestingNeeds(room);
  
  if (needs.miners === 0 && needs.haulers === 0) {
    return null;
  }
  
  // Count current remote miners and haulers
  const currentRemoteMiners = Object.values(Game.creeps).filter(
    c => c.memory.spawnRoom === roomStatus.roomName && 
         c.memory.role === 'miner' && 
         c.memory.remoteSourceId !== undefined
  ).length;
  
  const currentRemoteHaulers = Object.values(Game.creeps).filter(
    c => c.memory.spawnRoom === roomStatus.roomName && 
         c.memory.role === 'hauler' && 
         c.memory.isRemoteHauler === true
  ).length;
  
  // Priority: miners first, then haulers
  if (currentRemoteMiners < needs.miners) {
    // Find next unassigned remote source
    const assignedSourceIds = Object.values(Game.creeps)
      .filter(c => c.memory.spawnRoom === roomStatus.roomName && 
                   c.memory.role === 'miner' && 
                   c.memory.remoteSourceId !== undefined)
      .map(c => c.memory.remoteSourceId);
    
    const nextSource = needs.sources.find(s => !assignedSourceIds.includes(s.sourceId));
    
    if (nextSource) {
      console.log(
        `⛏️ Spawning remote miner (${currentRemoteMiners + 1}/${needs.miners}) for ${nextSource.flagName}`
      );
      const extraMemory = { remoteSourceId: nextSource.sourceId, remoteFlagName: nextSource.flagName };
      return trySpawn(spawn, "miner", roomStatus, room, efficiencyMetrics, null, extraMemory);
    }
  }
  
  if (currentRemoteHaulers < needs.haulers) {
    console.log(
      `🚚 Spawning remote hauler (${currentRemoteHaulers + 1}/${needs.haulers})`
    );
    const extraMemory = { isRemoteHauler: true };
    return trySpawn(spawn, "hauler", roomStatus, room, efficiencyMetrics, null, extraMemory);
  }
  
  return null;
};

/**
 * Check if minimum fleet needs to be maintained (Priority 3)
 * @param {StructureSpawn} spawn - The spawn structure
 * @param {Room} room - The room object
 * @param {Object} currentCreeps - Current creep counts by role
 * @param {Object} roomStatus - Room status
 * @param {Object} efficiencyMetrics - Energy collection efficiency metrics
 * @returns {Object|null} Spawn result or null if not needed
 */
const checkMinimumFleetPriority = (spawn, room, currentCreeps, roomStatus, efficiencyMetrics) => {
  const { trySpawn } = getTrySpawn();
  
  const minimumFleet = { harvester: 2, builder: 2, upgrader: 1 };
  
  for (const [role, min] of Object.entries(minimumFleet)) {
    if ((currentCreeps[role] || 0) < min) {
      return trySpawn(spawn, role, roomStatus, room, efficiencyMetrics);
    }
  }
  
  return null;
};

/**
 * Check if claimer should be spawned (Priority 4)
 * @param {StructureSpawn} spawn - The spawn structure
 * @param {Room} room - The room object
 * @param {Object} currentCreeps - Current creep counts by role
 * @param {Object} roomStatus - Room status
 * @param {Object} efficiencyMetrics - Energy collection efficiency metrics
 * @returns {Object|null} Spawn result or null if not needed
 */
const checkClaimerPriority = (spawn, room, currentCreeps, roomStatus, efficiencyMetrics) => {
  const { trySpawn } = getTrySpawn();
  // console.log(`Checking claimer priority - claim flag: ${flagManager.hasFlag("claim")}, current claimer count: ${currentCreeps.claimer || 0}`);
  if (flagManager.hasFlag("claim") && !currentCreeps.claimer) {
    return trySpawn(spawn, "claimer", roomStatus, room, efficiencyMetrics);
  }
  
  return null;
};

/**
 * Check if energy priority harvesters should be spawned (Priority 5)
 * @param {StructureSpawn} spawn - The spawn structure
 * @param {Room} room - The room object
 * @param {Object} currentCreeps - Current creep counts by role
 * @param {Object} roster - Target roster
 * @param {Object} roomMemory - Room memory
 * @param {Object} roomStatus - Room status
 * @param {Object} efficiencyMetrics - Energy collection efficiency metrics
 * @returns {Object|null} Spawn result or null if not needed
 */
const checkEnergyPriorityHarvester = (spawn, room, currentCreeps, roster, roomMemory, roomStatus, efficiencyMetrics) => {
  const { trySpawn } = getTrySpawn();
  
  const energyPriorityMode = roomMemory && roomMemory.energyPriorityMode;
  
  if (energyPriorityMode) {
    const currentHarvesters = currentCreeps.harvester || 0;
    const targetHarvesters = (roster.harvester || 2) + CONFIG.ENERGY.PRIORITY_MODE.HARVESTER_BOOST;
    
    if (currentHarvesters < targetHarvesters) {
      console.log(
        `⚡ [PRIORITY MODE] Spawning harvester (${currentHarvesters + 1}/${targetHarvesters}) ` +
        `to improve energy filling - ${roomStatus.roomName}`
      );
      return trySpawn(spawn, "harvester", roomStatus, room, efficiencyMetrics);
    }
  }
  
  return null;
};

/**
 * Check if energy threshold is met for roster spawning (Priority 6)
 * @param {Object} roomStatus - Room status
 * @returns {Object|null} Result object or null if threshold is met
 */
const checkEnergyThreshold = (roomStatus) => {
  const energyRatio = roomStatus.energyAvailable / roomStatus.energyCapacity;
  const minEnergyRatio = 0.7;
  
  if (energyRatio < minEnergyRatio) {
    utils.periodicLogger(
      `Energy at ${Math.round(energyRatio * 100)}% - waiting to spawn until >= ${minEnergyRatio * 100}% - ${roomStatus.roomName}`,
      10,
    );
    return { spawned: false, reason: "waiting_for_energy" };
  }
  
  return null;
};

/**
 * Check roster spawning (Priority 7)
 * @param {StructureSpawn} spawn - The spawn structure
 * @param {Room} room - The room object
 * @param {Object} currentCreeps - Current creep counts by role
 * @param {Object} roster - Target roster
 * @param {Object} roomStatus - Room status
 * @param {Object} efficiencyMetrics - Energy collection efficiency metrics
 * @returns {Object|null} Spawn result or null if roster is full
 */
const checkRosterSpawning = (spawn, room, currentCreeps, roster, roomStatus, efficiencyMetrics) => {
  const { findBestRoleToSpawn } = getRosterFunctions();
  const { trySpawn } = getTrySpawn();
  
  const bestRole = findBestRoleToSpawn(roster, currentCreeps, roomStatus);
  
  if (bestRole) {
    return trySpawn(spawn, bestRole, roomStatus, room, efficiencyMetrics);
  }
  
  return null;
};

module.exports = {
  getEmergencyReserve,
  findUnassignedSource,
  findLabs,
  findMineralInRoom,
  checkDefenderPriority,
  checkOffensiveFighterPriority,
  checkRemoteHarvestingPriority,
  checkMinimumFleetPriority,
  checkClaimerPriority,
  checkEnergyPriorityHarvester,
  checkEnergyThreshold,
  checkRosterSpawning,
};
