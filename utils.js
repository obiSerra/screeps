function getDistanceTransform(roomName, options = {}) {
  const defaultOptions = { innerPositions: undefined, visual: false };
  const mergedOptions = { ...defaultOptions, ...options };
  const { innerPositions, visual } = mergedOptions;

  const CONFIG = require("./config");

  const BOTTOM_LEFT = [
    { x: -1, y: 0 },
    { x: 0, y: -1 },
    { x: -1, y: -1 },
    { x: -1, y: 1 },
  ];

  const TOP_RIGHT = [
    { x: 1, y: 0 },
    { x: 0, y: +1 },
    { x: 1, y: 1 },
    { x: 1, y: -1 },
  ];

  let costs = new PathFinder.CostMatrix();

  const terrain = new Room.Terrain(roomName);

  if (innerPositions === undefined) {
    for (let x = 0; x <= 49; x++) {
      for (let y = 0; y <= 49; y++) {
        if (terrain.get(x, y) === TERRAIN_MASK_WALL) {
          costs.set(x, y, 0);
          continue;
        }
        if (x < 1 || x > 48 || y < 1 || y > 48) {
          costs.set(x, y, 0);
          continue;
        }
        costs.set(x, y, CONFIG.UTILITY.DISTANCE_TRANSFORM_INITIAL);
      }
    }
  } else {
    for (const pos of innerPositions) {
      costs.set(pos.x, pos.y, CONFIG.UTILITY.DISTANCE_TRANSFORM_INITIAL);
    }
  }

  for (let x = 0; x <= 49; x++) {
    for (let y = 0; y <= 49; y++) {
      const nearDistances = BOTTOM_LEFT.map(
        (vector) =>
          costs.get(x + vector.x, y + vector.y) + 1 ||
          CONFIG.UTILITY.DISTANCE_FALLBACK,
      );
      nearDistances.push(costs.get(x, y));
      costs.set(x, y, Math.min(...nearDistances));
    }
  }

  let maxDistance = 0;

  for (let x = 49; x >= 0; x--) {
    for (let y = 49; y >= 0; y--) {
      const nearDistances = TOP_RIGHT.map(
        (vector) => costs.get(x + vector.x, y + vector.y) + 1 || 100,
      );
      nearDistances.push(costs.get(x, y));
      const distance = Math.min(...nearDistances);
      maxDistance = Math.max(maxDistance, distance);
      costs.set(x, y, distance);
    }
  }

  if (visual) {
    const roomVisual = new RoomVisual(roomName);

    for (let x = 49; x >= 0; x--) {
      for (let y = 49; y >= 0; y--) {
        if (terrain.get(x, y) === TERRAIN_MASK_WALL) {
          continue;
        }
        const cost = costs.get(x, y);

        if (cost === 0) {
          continue;
        }

        const hue = 180 * (1 - cost / maxDistance);
        const color = `hsl(${hue},100%,60%)`;
        roomVisual.text(cost, x, y);
        roomVisual.rect(x - 0.5, y - 0.5, 1, 1, {
          fill: color,
          opacity: 0.4,
        });
      }
    }
  }

  return costs;
}

function getPositionsByPathCost(roomName, startPositions, options) {
  const ADJACENT_VECTORS = [
    { x: 0, y: -1 }, // TOP
    { x: 1, y: -1 }, // TOP_RIGHT
    { x: 1, y: 0 }, // RIGHT
    { x: 1, y: 1 }, // BOTTOM_RIGHT
    { x: 0, y: 1 }, // BOTTOM
    { x: -1, y: 1 }, // BOTTOM_LEFT
    { x: -1, y: 0 }, // LEFT
    { x: -1, y: -1 }, // TOP_LEFT
  ];

  const defaultOptions = {
    costThreshold: 255,
    visual: false,
  };
  const mergedOptions = { ...defaultOptions, ...options };
  let { costMatrix, costThreshold, visual } = mergedOptions;

  if (costMatrix === undefined) {
    costMatrix = new PathFinder.CostMatrix();
  } else {
    costMatrix = costMatrix.clone();
  }

  const queue = [];

  const result = [];

  const terrain = Game.map.getRoomTerrain(roomName);

  const check = new PathFinder.CostMatrix();

  for (const pos of startPositions) {
    queue.push(pos);
    costMatrix.set(pos.x, pos.y, 0);
    check.set(pos.x, pos.y, 1);
  }

  const roomVisual = new RoomVisual(roomName);

  while (queue.length) {
    const current = queue.shift();
    const currentLevel = costMatrix.get(current.x, current.y);

    for (const vector of ADJACENT_VECTORS) {
      const x = current.x + vector.x;
      const y = current.y + vector.y;
      if (x < 0 || x > 49 || y < 0 || y > 49) {
        continue;
      }

      if (terrain.get(x, y) === TERRAIN_MASK_WALL) {
        continue;
      }

      if (costMatrix.get(x, y) >= costThreshold) {
        continue;
      }

      if (check.get(x, y) > 0) {
        continue;
      }

      costMatrix.set(x, y, currentLevel + 1);

      check.set(x, y, 1);

      queue.push({ x, y });

      const pos = new RoomPosition(x, y, roomName);
      result.push(pos);

      if (visual) {
        roomVisual.text(currentLevel + 1, x, y);
      }
    }
  }

  return costMatrix;
}

function periodicLogger(message, interval = 100) {
  if (Game.time % interval === 0) {
    console.log(message);
  }
}

/**
 * Count creeps targeting a specific source
 * @param {string} sourceId - The ID of the source
 * @returns {number} Number of creeps targeting this source
 */
function countCreepsTargetingSource(sourceId) {
  return Object.values(Game.creeps).filter(
    (creep) =>
      creep.memory.actionTarget && creep.memory.actionTarget.id === sourceId,
  ).length;
}

/**
 * Check if there are enemy creeps in the room
 * Pure function
 * @param {Room} room
 * @returns {boolean} True if there are hostile creeps in the same room
 */
const areThereInvaders = (room) => {
  const areInvaders = room.find(FIND_HOSTILE_CREEPS).length > 0;
  if (areInvaders) {
    periodicLogger(`Invaders detected in room ${room.name}!`, 10);
  }
  return areInvaders;
};

/**
 * Get all flags matching the remote source pattern (source_X)
 * Pure function based on Game.flags reference
 * @returns {Flag[]} Array of flags matching source_X pattern
 */
function getRemoteSourceFlags() {
  const CONFIG = require("./config");
  if (!CONFIG.REMOTE_HARVESTING.ENABLED) {
    return [];
  }

  return Object.values(Game.flags).filter((flag) =>
    CONFIG.REMOTE_HARVESTING.FLAG_PATTERN.test(flag.name),
  );
}

/**
 * Find all sources in rooms marked by remote source flags
 * Pure function with side-effect-free room queries
 * @param {Flag[]} flags - Array of remote source flags
 * @returns {Source[]} Array of sources found near flags (excludes sources in hostile rooms)
 */
function findRemoteSourcesNearFlags(flags) {
  const CONFIG = require("./config");
  const sources = [];
  for (const flag of flags) {
    const room = Game.rooms[flag.pos.roomName];
    // Skip if room not visible
    if (!room) {
      sources.push({ isFlag: true, ...flag }); // Add flag as a placeholder target for scoring
      continue;
    }
    // Skip if room has hostiles and config says to avoid them
    if (
      CONFIG.REMOTE_HARVESTING.AVOID_HOSTILE_ROOMS &&
      areThereInvaders(room)
    ) {
      continue;
    }

    // Add all sources from this room
    const roomSources = room.find(FIND_SOURCES);
    sources.push(...roomSources);
  }

  return sources;
}

/**
 * Check if a creep can harvest from remote rooms
 * Requires both WORK and CARRY body parts
 * Pure function
 * @param {Creep} creep
 * @returns {boolean} True if creep has both WORK and CARRY parts
 */
function canHarvestRemotely(creep) {
  const hasWork = creep.body.some((part) => part.type === WORK);
  const hasCarry = creep.body.some((part) => part.type === CARRY);
  return hasWork && hasCarry;
}

/**
 * Find nearest container with available capacity
 * Pure function (query only, no side effects)
 * @param {Creep} creep
 * @returns {StructureContainer|null} Closest container with space, or null
 */
function findNearestContainerWithSpace(creep) {
  const containers = creep.room.find(FIND_STRUCTURES, {
    filter: (structure) =>
      structure.structureType === STRUCTURE_CONTAINER &&
      structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0,
  });

  if (containers.length === 0) {
    return null;
  }

  return creep.pos.findClosestByPath(containers);
}

function findBestSourceForCreep(creep) {
  const CONFIG = require("./config");

  // Get local sources
  const localSources = creep.room.find(FIND_SOURCES);

  // Get local containers with high fill threshold
  const containers = creep.room.find(FIND_STRUCTURES, {
    filter: (structure) =>
      structure.structureType === STRUCTURE_CONTAINER &&
      structure.store[RESOURCE_ENERGY] >=
        structure.store.getCapacity(RESOURCE_ENERGY) * 0.75,
  });

  // Collect all sources (local + remote if applicable)
  let allSources = [...localSources];

  // Add remote sources if creep can harvest remotely
  if (canHarvestRemotely(creep)) {
    const remoteFlags = getRemoteSourceFlags();
    const remoteSources = findRemoteSourcesNearFlags(remoteFlags);
    allSources = allSources.concat(remoteSources);
  }

  // Filter out depleted sources
  allSources = allSources.filter(
    (source) => source.energy > 0 || source.isFlag,
  );

  const targets = [...allSources, ...containers];

  // Scoring weights from CONFIG
  const DISTANCE_WEIGHT = CONFIG.UTILITY.DISTANCE_WEIGHT;
  const CREEP_WEIGHT = CONFIG.UTILITY.CREEP_WEIGHT;
  const ENERGY_WEIGHT = CONFIG.UTILITY.ENERGY_WEIGHT;
  const REMOTE_DISTANCE_PENALTY =
    CONFIG.REMOTE_HARVESTING.DISTANCE_PENALTY_MULTIPLIER;

  for (const target of targets) {
    const creepsTargeting = countCreepsTargetingSource(target.id);
    const energyAvailable =
      target.energy ||
      (target.store && target.store[RESOURCE_ENERGY]) ||
      (target.isFlag && 1000) ||
      0;
      
    let distance = Math.min(creep.pos.getRangeTo(target), CONFIG.REMOTE_HARVESTING.DEFAULT_DISTANCE);
    // Apply distance penalty for remote sources (not in same room)
    const isRemote = target.pos && target.pos.roomName !== creep.room.name;

    if (isRemote) {
      distance = distance * REMOTE_DISTANCE_PENALTY;
    }

    const score =
      Math.pow(energyAvailable, ENERGY_WEIGHT) /
      Math.pow(1 + creepsTargeting, CREEP_WEIGHT) /
      Math.pow(1 + distance, DISTANCE_WEIGHT);

    target.score = score;
  }

  targets.sort((a, b) => b.score - a.score);
  return targets.length > 0 ? targets[0] : null;
}

function findNearestEnergySource(creep) {
  const sources = creep.room.find(FIND_SOURCES);
  let nearestSource = null;
  let minDistance = Infinity;

  for (const source of sources) {
    const distance = creep.pos.getRangeTo(source);

    if (distance < minDistance) {
      minDistance = distance;
      nearestSource = source;
    }
  }

  return nearestSource;
}

const actions = {
  gathering: "🔄 gathering",
  building: "🚧 building",
  repairing: "🛠 repairing",
  upgrading: "⚡ upgrading",
  harvesting: "⛏ harvesting",
};

// ============================================================================
// Functional Programming Utilities
// ============================================================================

/**
 * Left-to-right function composition
 * @param {...Function} fns - Functions to compose
 * @returns {Function} Composed function
 * @example
 * const addOne = x => x + 1;
 * const double = x => x * 2;
 * const addOneThenDouble = pipe(addOne, double);
 * addOneThenDouble(5); // Returns 12
 */
const pipe =
  (...fns) =>
  (x) =>
    fns.reduce((acc, fn) => fn(acc), x);

/**
 * Right-to-left function composition
 * @param {...Function} fns - Functions to compose
 * @returns {Function} Composed function
 * @example
 * const addOne = x => x + 1;
 * const double = x => x * 2;
 * const doubleThenAddOne = compose(addOne, double);
 * doubleThenAddOne(5); // Returns 11
 */
const compose =
  (...fns) =>
  (x) =>
    fns.reduceRight((acc, fn) => fn(acc), x);

/**
 * Create a memoized version of a function
 * @param {Function} fn - Function to memoize
 * @returns {Function} Memoized function
 */
const memoize = (fn) => {
  const cache = new Map();
  return (...args) => {
    const key = JSON.stringify(args);
    if (cache.has(key)) return cache.get(key);
    const result = fn(...args);
    cache.set(key, result);
    return result;
  };
};

/**
 * Partial application - pre-fill some arguments
 * @param {Function} fn - Function to partially apply
 * @param {...*} presetArgs - Arguments to pre-fill
 * @returns {Function} Partially applied function
 */
const partial =
  (fn, ...presetArgs) =>
  (...laterArgs) =>
    fn(...presetArgs, ...laterArgs);

/**
 * Identity function - returns its argument unchanged
 * Useful in functional pipelines
 * @param {*} x - Any value
 * @returns {*} Same value
 */
const identity = (x) => x;

/**
 * Constant function - always returns the same value
 * @param {*} x - Value to always return
 * @returns {Function} Function that always returns x
 */
const constant = (x) => () => x;

/**
 * Tap - perform side effect and return original value
 * Useful for logging in pipelines
 * @param {Function} fn - Side-effect function
 * @returns {Function} Function that runs fn then returns input
 */
const tap = (fn) => (x) => {
  fn(x);
  return x;
};

const utils = {
  // Existing utilities
  getDistanceTransform,
  getPositionsByPathCost,
  periodicLogger,
  findNearestEnergySource,
  findBestSourceForCreep,
  countCreepsTargetingSource,
  actions,
  areThereInvaders,

  // Remote harvesting utilities
  getRemoteSourceFlags,
  findRemoteSourcesNearFlags,
  canHarvestRemotely,
  findNearestContainerWithSpace,

  // Functional utilities
  pipe,
  compose,
  memoize,
  partial,
  identity,
  constant,
  tap,
};

module.exports = utils;
