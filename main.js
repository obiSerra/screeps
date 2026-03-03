const roleHarvester = require("role.harvester");
const roleUpgrader = require("role.upgrader");
const roleBuilder = require("role.builder");

const utils = require("utils");

function spawnProcedure(roster, baseName) {
  Object.keys(roster).forEach((role) => {
    const creeps = _.filter(Game.creeps, (creep) => creep.memory.role == role);
    // console.log(`${role}s: ${creeps.length}`);

    if (creeps.length < roster[role]) {
      const newName = `${role.charAt(0).toUpperCase() + role.slice(1)}${Game.time}`;
      // console.log(`Spawning new ${role}: ${newName}`);
      Game.spawns[baseName].spawnCreep([WORK, CARRY, MOVE], newName, {
        memory: { role: role },
      });
    }
  });

  if (Game.spawns[baseName].spawning) {
    var spawningCreep = Game.creeps[Game.spawns[baseName].spawning.name];
    Game.spawns[baseName].room.visual.text(
      "🛠️" + spawningCreep.memory.role,
      Game.spawns[baseName].pos.x + 1,
      Game.spawns[baseName].pos.y,
      { align: "left", opacity: 0.8 },
    );
  }
}

function clearCreepsMemory() {
  for (var name in Memory.creeps) {
    if (!Game.creeps[name]) {
      delete Memory.creeps[name];
      // console.log('Clearing non-existing creep memory:', name);
    }
  }
}

function handleCreeps() {
  for (var name in Game.creeps) {
    var creep = Game.creeps[name];
    if (creep.memory.role == "harvester") {
      roleHarvester.run(creep);
    }
    if (creep.memory.role == "upgrader") {
      roleUpgrader.run(creep);
    }
    if (creep.memory.role == "builder") {
      roleBuilder.run(creep);
    }
  }
}

function getControllerLevel(roomName) {
  const room = Game.rooms[roomName];
  const controller = room.controller;
  return controller ? controller.level : 0;
}

function getRoomStatus(roomName) {
  const room = Game.rooms[roomName];
  const structures = room.find(FIND_STRUCTURES);

  let controllerLevel = 0;
  let roomLevel = 0;

  let planned = false;

  // Check if already planned
  Object.keys(Game.flags).forEach((flagName) => {
    if (flagName.startsWith("extension")) {
      planned = true;
    }
  });

  controllerLevel = getControllerLevel(roomName);

  if (!planned) {
    roomLevel = -1;
  }

  return {
    roomLevel,
    details: {
      controllerLevel,
    },
  };
}

function planExtensionPlacement(roomName, maxExtensions = 5) {
  const spawn = Game.spawns[baseName];
  const room = Game.rooms[roomName];
  const terrain = room.getTerrain();
  const extensionPositions = [];

  // Find existing extensions
  const existingExtensions = room.find(FIND_STRUCTURES, {
    filter: (s) => s.structureType === STRUCTURE_EXTENSION,
  });

  const plannedCount = Math.min(
    maxExtensions - existingExtensions.length,
    maxExtensions,
  );

  // Search in expanding rings around the spawn
  for (
    let range = 2;
    range <= 5 && extensionPositions.length < plannedCount;
    range++
  ) {
    const positions = room.lookForAtArea(
      LOOK_TERRAIN,
      spawn.pos.y - range,
      spawn.pos.x - range,
      spawn.pos.y + range,
      spawn.pos.x + range,
      true,
    );

    for (const posData of positions) {
      if (extensionPositions.length >= plannedCount) break;

      const x = posData.x;
      const y = posData.y;

      // Check if position is valid (not wall, not occupied)
      if (terrain.get(x, y) !== TERRAIN_MASK_WALL) {
        const structures = room.lookForAt(LOOK_STRUCTURES, x, y);
        if (structures.length === 0) {
          extensionPositions.push({ x, y });
        }
      }
    }
  }

  // Place flags for each planned extension position
  extensionPositions.forEach((pos, index) => {
    const flagName = `extension${index + 1}`;
    room.createFlag(pos.x, pos.y, flagName, COLOR_YELLOW);
  });

  return extensionPositions;
}

const baseName = "Spawn1"; // TODO - make it dynamic or default

module.exports.loop = function () {
  clearCreepsMemory();

  let roster = {
    harvester: 0,
    builder: 0,
    upgrader: 0,
  };
  const roomName = Game.spawns[baseName].room.name;
  const roomStatus = getRoomStatus(roomName);

  if (roomStatus.controllerLevel < 2) {
    roster.upgrader = 2;
  }

  console.log(`Room status: ${JSON.stringify(roomStatus)}`);

//   if (roomStatus.roomLevel === -1) {
//     planExtensionPlacement(roomName, 5);
//   }

//   spawnProcedure(roster, baseName);

  // //   utils.getPositionsByPathCost(roomName, [{ x: 25, y: 25 }], { visual: true });

  //   const distance_transform = utils.getDistanceTransform(roomName, {
  //     visual: false,
  //   });

//   handleCreeps();
};
