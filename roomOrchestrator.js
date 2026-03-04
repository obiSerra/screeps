const utils = require("./utils");
// const fleetManager = require('./fleetManager');

// Action based planning?

// GOALS:
// 0. Plan the room development (roads from resouces to areas, extensions...)
// 1. Upgrade the controller level to 2
// 2. Build 5 extensions
// 3

function placeRampantsConstructionSites(roomName) {
  const room = Game.rooms[roomName];
  const flags = room.find(FIND_FLAGS, {
    filter: (flag) => flag.name.startsWith("rampart_"),
  });

  flags.forEach((flag) => {
    const result = room.createConstructionSite(
      flag.pos.x,
      flag.pos.y,
      STRUCTURE_RAMPART,
    );
    if (result === OK) {
      flag.remove();
    }
  });
}

function planCriticalStructureRamparts(
  roomName,
  position,
  distance = 3,
  visualize = true,
) {
  const room = Game.rooms[roomName];
  if (!position) {
    return [];
  }

  const terrain = room.getTerrain();
  const rampartPositions = [];

  // Get all positions at given distance from position
  for (let dx = -distance; dx <= distance; dx++) {
    for (let dy = -distance; dy <= distance; dy++) {
      // Only get perimeter (not interior)
      if (Math.abs(dx) === distance || Math.abs(dy) === distance) {
        const x = position.x + dx;
        const y = position.y + dy;

        // Check bounds
        if (x > 0 && x < 49 && y > 0 && y < 49) {
          // Check if terrain allows building (not a wall)
          const structures = room.lookForAt(LOOK_STRUCTURES, x, y);
          const flags = room.lookForAt(LOOK_FLAGS, x, y);
          const constructionSites = room.lookForAt(
            LOOK_CONSTRUCTION_SITES,
            x,
            y,
          );

          // Filter out roads from structures (roads are allowed)
          const nonRoadStructures = structures.filter(
            (s) => s.structureType !== STRUCTURE_ROAD,
          );

          if (
            terrain.get(x, y) !== TERRAIN_MASK_WALL &&
            flags.length === 0 &&
            constructionSites.length === 0 &&
            nonRoadStructures.length === 0
          ) {
            rampartPositions.push({ x, y });

            if (visualize) {
              // Draw a green overlay to visualize
              room.visual.rect(x - 0.5, y - 0.5, 1, 1, {
                fill: "green",
                opacity: 0.3,
              });
            } else {
              // Place a flag
              room.createFlag(x, y, `rampart_${x}_${y}`, COLOR_GREEN);
            }
          }
        }
      }
    }
  }

  return rampartPositions;
}

module.exports = {
  planCriticalStructureRamparts,
  placeRampantsConstructionSites,
};
