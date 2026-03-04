function getDistanceTransform(roomName, options = {}) {
  const defaultOptions = { innerPositions: undefined, visual: false };
  const mergedOptions = { ...defaultOptions, ...options };
  const { innerPositions, visual } = mergedOptions;

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
        costs.set(x, y, 1 << 8);
      }
    }
  } else {
    for (const pos of innerPositions) {
      costs.set(pos.x, pos.y, 1 << 8);
    }
  }

  for (let x = 0; x <= 49; x++) {
    for (let y = 0; y <= 49; y++) {
      const nearDistances = BOTTOM_LEFT.map(
        (vector) => costs.get(x + vector.x, y + vector.y) + 1 || 100,
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

function countCreepsNextToPosition(pos, range = 1) {
  const creeps = pos.findInRange(FIND_CREEPS, range);
  return creeps.length;
}


function findBestSourceForCreep(creep) {
  const sources = creep.room.find(FIND_SOURCES);
  
  for (const source of sources) {
    const creepsAround = countCreepsNextToPosition(source.pos, 1);
    const energyAvailable = source.energy;
    const distance = creep.pos.getRangeTo(source);

    const score = energyAvailable / (1 + creepsAround) / (1 + distance);

    source.score = score;
  }

  sources.sort((a, b) => b.score - a.score);

  return sources[0];
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
  
}

const utils = {
  getDistanceTransform,
  getPositionsByPathCost,
  periodicLogger,
  findNearestEnergySource,
  findBestSourceForCreep
};

module.exports = utils;
