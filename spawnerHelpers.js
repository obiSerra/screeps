/**
 * Spawner Helpers Module
 * Utility functions for resource management and room analysis
 * Pure functions - no side effects
 */

const CONFIG = require("./config");

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

module.exports = {
  getEmergencyReserve,
  findUnassignedSource,
  findLabs,
  findMineralInRoom,
};
