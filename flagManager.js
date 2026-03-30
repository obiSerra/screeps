/**
 * Flag Management Module
 * Centralized module for managing all flag-driven behaviors in the codebase
 * Pure functions with per-tick caching for performance
 */

const CONFIG = require("./config");

// ============================================================================
// Flag Type Constants
// ============================================================================

/**
 * Flag types for categorization and validation
 */
const FLAG_TYPES = {
  // Command flags - direct gameplay behaviors
  RALLY: "rally",
  ATTACK: "attack",
  CLAIM: "claim",
  EXPLORE: "explore",
  DECONSTRUCT: "deconstruct",
  PRIORITY_BUILD: "priority_build",

  // Pattern-based flags
  ATTACK_NUMBERED: "attack_numbered", // attack_X pattern
  REMOTE_SOURCE: "remote_source", // source_X pattern
  PLANNER: "planner", // XXX_S_N pattern (structure planning)
};

/**
 * Flag type patterns for regex matching
 */
const FLAG_PATTERNS = {
  ATTACK_NUMBERED: /^attack_(\d+)$/,
  REMOTE_SOURCE: /^source_(\d+)$/,
  PLANNER: /^[A-Z]{3}_\d+_\d+$/, // XXX_S_N format
};

// ============================================================================
// Per-Tick Cache (Reset every tick)
// ============================================================================

/**
 * Cache for flag lookups per tick
 * Prevents multiple Game.flags accesses in the same tick
 */
let cachedFlags = null;
let cachedTick = -1;

/**
 * Reset cache if needed (new tick)
 */
const ensureCache = () => {
  if (cachedTick !== Game.time) {
    cachedFlags = {
      all: null,
      byType: {},
      byName: {},
    };
    cachedTick = Game.time;
  }
};

/**
 * Get all flags (cached)
 * @returns {Object} All flags from Game.flags
 */
const getAllFlags = () => {
  ensureCache();
  if (!cachedFlags.all) {
    cachedFlags.all = Game.flags;
  }
  return cachedFlags.all;
};

// ============================================================================
// Core Flag Access Functions
// ============================================================================

/**
 * Get a flag by name
 * @param {string} name - Flag name
 * @returns {Flag|null} Flag object or null
 */
const getFlag = (name) => {
  ensureCache();
  if (!(name in cachedFlags.byName)) {
    cachedFlags.byName[name] = Game.flags[name] || null;
  }
  return cachedFlags.byName[name];
};

/**
 * Check if a flag exists
 * @param {string} name - Flag name
 * @returns {boolean} True if flag exists
 */
const hasFlag = (name) => {
  return getFlag(name) !== null;
};

/**
 * Get multiple flags by names
 * @param {Array<string>} names - Array of flag names
 * @returns {Array<Flag>} Array of flag objects (excludes non-existent flags)
 */
const getFlags = (names) => {
  return names.map(getFlag).filter((flag) => flag !== null);
};

// ============================================================================
// Pattern-Based Flag Queries
// ============================================================================

/**
 * Get all flags matching a pattern
 * @param {RegExp} pattern - Regular expression to match flag names
 * @returns {Array<{name: string, flag: Flag, match: Array}>} Array of matching flags with regex matches
 */
const getFlagsByPattern = (pattern) => {
  const flags = getAllFlags();
  const results = [];

  for (const [name, flag] of Object.entries(flags)) {
    const match = name.match(pattern);
    if (match) {
      results.push({ name, flag, match });
    }
  }

  return results;
};

/**
 * Get all attack flags (attack and attack_X)
 * @returns {Array<{name: string, flag: Flag, count: number}>} Attack flags with force count
 */
const getAttackFlags = () => {
  ensureCache();
  const cacheKey = "attack_flags";

  if (!cachedFlags.byType[cacheKey]) {
    const results = [];
    const flags = getAllFlags();

    for (const [name, flag] of Object.entries(flags)) {
      // Match "attack" flag (default count)
      if (name === "attack") {
        results.push({
          name,
          flag,
          count: CONFIG.OFFENSIVE.DEFAULT_ATTACK_COUNT,
        });
      }
      // Match "attack_X" pattern
      else {
        const match = name.match(FLAG_PATTERNS.ATTACK_NUMBERED);
        if (match) {
          results.push({
            name,
            flag,
            count: parseInt(match[1], 10),
          });
        }
      }
    }

    cachedFlags.byType[cacheKey] = results;
  }

  return cachedFlags.byType[cacheKey];
};

/**
 * Get all remote source flags (source_X pattern)
 * @returns {Array<{name: string, flag: Flag, sourceId: number}>} Remote source flags
 */
const getRemoteSourceFlags = () => {
  ensureCache();
  const cacheKey = "remote_source_flags";

  if (!cachedFlags.byType[cacheKey]) {
    const pattern = FLAG_PATTERNS.REMOTE_SOURCE;
    const matches = getFlagsByPattern(pattern);

    cachedFlags.byType[cacheKey] = matches.map(({ name, flag, match }) => ({
      name,
      flag,
      sourceId: parseInt(match[1], 10),
    }));
  }

  return cachedFlags.byType[cacheKey];
};

/**
 * Get all planner flags (structure planning)
 * @param {Room} [room] - Optional room filter
 * @returns {Array<{name: string, flag: Flag, structureCode: string, stage: number, id: number}>}
 */
const getPlannerFlags = (room = null) => {
  const cacheKey = room ? `planner_flags_${room.name}` : "planner_flags_all";
  ensureCache();

  if (!cachedFlags.byType[cacheKey]) {
    const pattern = FLAG_PATTERNS.PLANNER;
    const matches = getFlagsByPattern(pattern);

    let results = matches.map(({ name, flag }) => {
      const parts = name.split("_");
      return {
        name,
        flag,
        structureCode: parts[0],
        stage: parseInt(parts[1], 10),
        id: parseInt(parts[2], 10),
      };
    });

    // Filter by room if specified
    if (room) {
      results = results.filter((item) => item.flag.pos.roomName === room.name);
    }

    cachedFlags.byType[cacheKey] = results;
  }

  return cachedFlags.byType[cacheKey];
};

// ============================================================================
// Command Flag Accessors
// ============================================================================

/**
 * Get the rally flag
 * @returns {Flag|null} Rally flag or null
 */
const getRallyFlag = () => getFlag("rally");

/**
 * Get the claim flag
 * @returns {Flag|null} Claim flag or null
 */
const getClaimFlag = () => getFlag("claim");

/**
 * Get the explore flag
 * @returns {Flag|null} Explore flag or null
 */
const getExploreFlag = () => getFlag("explore");

/**
 * Get the deconstruct flag
 * @returns {Flag|null} Deconstruct flag or null
 */
const getDeconstructFlag = () => getFlag("deconstruct");

/**
 * Get the priority build flag
 * @returns {Flag|null} Priority build flag or null
 */
const getPriorityBuildFlag = () => getFlag("priority_build");

// ============================================================================
// Proximity & Distance Helpers
// ============================================================================

/**
 * Find the nearest flag from a list of flags
 * @param {RoomPosition} pos - Position to measure from
 * @param {Array<Flag>} flags - Array of flags to search
 * @param {boolean} [usePath=true] - Use pathfinding (true) or range (false)
 * @returns {Flag|null} Nearest flag or null
 */
const findNearestFlag = (pos, flags, usePath = true) => {
  if (!flags || flags.length === 0) return null;

  let currentRoom = [];
  for (const flag of flags) {
    if (flag.pos.roomName === pos.roomName) {
      currentRoom.push(flag);
    }
  }

  if (currentRoom.length === 0) {
    return flags[0]; // No flags in the same room, return the first one (could be improved to find closest by range)
  }

  if (usePath) {
    return pos.findClosestByPath(flags) || pos.findClosestByRange(flags);
  }
  return pos.findClosestByRange(flags);
};

/**
 * Find the nearest attack flag for a creep
 * @param {Creep} creep - Creep to find flag for
 * @returns {Flag|null} Nearest attack flag or null
 */
const findNearestAttackFlag = (creep) => {
  const attackFlags = getAttackFlags();

  if (attackFlags.length === 0) return null;

  const flags = attackFlags.map((item) => item.flag);
  return findNearestFlag(creep.pos, flags);
};

// ============================================================================
// Flag Validation & Helpers
// ============================================================================

/**
 * Check if a flag is in the same room as a position
 * @param {Flag} flag - Flag to check
 * @param {RoomPosition|Room} roomOrPos - Room or position
 * @returns {boolean} True if flag is in the same room
 */
const isFlagInRoom = (flag, roomOrPos) => {
  const roomName = roomOrPos.name || roomOrPos.roomName;
  return flag && flag.pos.roomName === roomName;
};

/**
 * Get distance from position to flag
 * @param {RoomPosition} pos - Position to measure from
 * @param {Flag} flag - Flag to measure to
 * @param {boolean} [linear=true] - Use linear distance (true) or path distance (false)
 * @returns {number} Distance or Infinity if unreachable
 */
const getDistanceToFlag = (pos, flag, linear = true) => {
  if (!flag) return Infinity;

  if (linear) {
    return pos.getRangeTo(flag);
  }

  const path = pos.findPathTo(flag);
  return path.length > 0 ? path.length : Infinity;
};

// ============================================================================
// Flag State Queries
// ============================================================================

/**
 * Check if rally mode is active
 * @returns {boolean} True if rally flag exists
 */
const isRallyModeActive = () => hasFlag("rally");

/**
 * Check if there are any active attack operations
 * @returns {boolean} True if any attack flags exist
 */
const hasActiveAttackOperations = () => getAttackFlags().length > 0;

/**
 * Check if remote harvesting is enabled and has flags
 * @returns {boolean} True if remote harvesting is configured
 */
const hasRemoteHarvestingFlags = () => {
  return (
    CONFIG.REMOTE_HARVESTING &&
    CONFIG.REMOTE_HARVESTING.ENABLED &&
    getRemoteSourceFlags().length > 0
  );
};

/**
 * Get total attack force size across all attack flags
 * @returns {number} Total number of fighters requested
 */
const getTotalAttackForceSize = () => {
  return getAttackFlags().reduce((sum, item) => sum + item.count, 0);
};

// ============================================================================
// Exports
// ============================================================================

module.exports = {
  // Constants
  FLAG_TYPES,
  FLAG_PATTERNS,

  // Core access
  getFlag,
  hasFlag,
  getFlags,
  getAllFlags,

  // Pattern-based queries
  getFlagsByPattern,
  getAttackFlags,
  getRemoteSourceFlags,
  getPlannerFlags,

  // Command flag accessors
  getRallyFlag,
  getClaimFlag,
  getExploreFlag,
  getDeconstructFlag,
  getPriorityBuildFlag,

  // Proximity & distance
  findNearestFlag,
  findNearestAttackFlag,
  isFlagInRoom,
  getDistanceToFlag,

  // Flag state queries
  isRallyModeActive,
  hasActiveAttackOperations,
  hasRemoteHarvestingFlags,
  getTotalAttackForceSize,
};
