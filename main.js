const roleHarvester = require("role.harvester");
const roleUpgrader = require("role.upgrader");
const roleBuilder = require("role.builder");
const roomOrchestrator = require("roomOrchestrator");
const utils = require("utils");

function spawnProcedure(roster, baseName, roomStatus, roomName) {
  //   MOVE: 50 energy
  // CARRY: 50 energy
  // WORK: 100 energy
  // ATTACK: 80 energy
  // RANGED_ATTACK: 150 energy
  // HEAL: 250 energy
  // TOUGH: 10 energy
  // CLAIM: 600 energy

  let body = [WORK, CARRY, MOVE]; // 200 energy

  const room = Game.rooms[roomName];
  if (roomStatus.energyAvailable >= 500) {
    body = [WORK, WORK, WORK, CARRY, CARRY, MOVE, MOVE]; // 550 energy
  } else if (roomStatus.energyAvailable >= 300) {
    body = [WORK, WORK, CARRY, MOVE, MOVE];
  }

  Object.keys(roster).forEach((role) => {
    const creeps = _.filter(Game.creeps, (creep) => creep.memory.role == role);
    // console.log(`${role}s: ${creeps.length}`);

    if (creeps.length < roster[role]) {
      const newName = `${role.charAt(0).toUpperCase() + role.slice(1)}${Game.time}`;
      console.log(`Spawning new ${role}: ${newName}`);
      if (role === "builder") body = body.concat([MOVE]);
      Game.spawns[baseName].spawnCreep(body, newName, {
        memory: { role: role },
      });
    }
  });

  const energyAvailable = room.energyAvailable;
  const energyCapacity = room.energyCapacityAvailable;
  if (energyAvailable === energyCapacity) {

    const builderCount = _.filter(
      Game.creeps,
      (creep) => creep.memory.role == "builder",
    );
    const harvesterCount = _.filter(
      Game.creeps,
      (creep) => creep.memory.role == "harvester",
    );
    const upgraderCount = _.filter(
      Game.creeps,
      (creep) => creep.memory.role == "upgrader",
    );

    let role = "builder";

    if (builderCount.length > harvesterCount.length * 3) role = "harvester";
    else if (builderCount.length > upgraderCount.length * 3) role = "upgrader";

    console.log(
      `Energy full: ${energyAvailable}/${energyCapacity} spawing extra ${role} Creep`,
    );

    const newName = `${role.charAt(0).toUpperCase() + role.slice(1)}${Game.time}`;
    body = body.concat([MOVE]);
    Game.spawns[baseName].spawnCreep(body, newName, {
      memory: { role: role },
    });
  }

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
  const rolesFunctions = {
    harvester: roleHarvester.run,
    upgrader: roleUpgrader.run,
    builder: roleBuilder.run,
  };

  for (var name in Game.creeps) {
    var creep = Game.creeps[name];
    rolesFunctions[creep.memory.role](creep);
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

  let controllerLevel = getControllerLevel(roomName);

  // Check if already planned
  let extensionPlanned = 0;

  Object.keys(Game.flags).forEach((flagName) => {
    if (flagName.startsWith("ext")) {
      extensionPlanned++;
    }
  });

  // Check the number of extensions build sites
  const extensionSites = room.find(FIND_CONSTRUCTION_SITES, {
    filter: (s) => s.structureType === STRUCTURE_EXTENSION,
  }).length;

  // Check if extensions are already built
  const extensions = structures.filter(
    (s) => s.structureType === STRUCTURE_EXTENSION,
  );
  const extensionBuilt = extensions.length;

  let creeps = {};

  Object.keys(Game.creeps).forEach((creepName) => {
    const creep = Game.creeps[creepName];
    if (creep.memory.role) {
      creeps[creep.memory.role] = (creeps[creep.memory.role] || 0) + 1;
    }
  });

  const energyAvailable = room.energyAvailable;
  const energyCapacity = room.energyCapacityAvailable;

  return {
    controllerLevel,
    extensionBuilt,
    extensionPlanned,
    extensionSites,
    creeps,
    energyAvailable,
    energyCapacity,
  };
}

function planExtensionPlacement(
  roomName,
  existingExtensions,
  maxExtensions = 5,
) {
  const spawn = Game.spawns[baseName];
  const room = Game.rooms[roomName];
  const terrain = room.getTerrain();
  const extensionPositions = [];
  console.log(
    `Planning extension placement. Existing: ${existingExtensions}, Max: ${maxExtensions}`,
  );
  const plannedCount = Math.min(
    maxExtensions - existingExtensions,
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
        const constructionSites = room.lookForAt(LOOK_CONSTRUCTION_SITES, x, y);
        if (structures.length === 0 && constructionSites.length === 0) {
          extensionPositions.push({ x, y });
        }
      }
    }
  }

  console.log(
    `Planned extension positions: ${extensionPositions.length}/${plannedCount}`,
  );

  // Place flags for each planned extension position
  extensionPositions.forEach((pos, index) => {
    const flagName = `ext${index + 1}`;
    const constructionSites = room.lookForAt(
      LOOK_CONSTRUCTION_SITES,
      pos.x,
      pos.y,
    );
    if (constructionSites.length === 0) {
      room.createFlag(pos.x, pos.y, flagName, COLOR_YELLOW);
    }
  });

  return extensionPositions;
}

function placeExtensionConstructionSites(roomName, maxSites = 5) {
  const room = Game.rooms[roomName];
  const flags = room.find(FIND_FLAGS, {
    filter: (f) => f.name.startsWith("ext"),
  });

  let placedSites = 0;
  flags.forEach((flag) => {
    const result = room.createConstructionSite(
      flag.pos.x,
      flag.pos.y,
      STRUCTURE_EXTENSION,
    );
    console.log(
      `Placing construction site at (${flag.pos.x}, ${flag.pos.y}): ${result}`,
    );
    flag.remove();
    placedSites++;
    if (placedSites >= maxSites) {
      return;
    }
  });
}

function removeExtensionFlags(roomName) {
  Game.rooms[roomName]
    .find(FIND_FLAGS, {
      filter: (f) => f.name.startsWith("ext"),
    })
    .forEach((flag) => flag.remove());
}

function initializeRoom(roomStatus, roster) {
  utils.periodicLogger(`Initializing room: ${roomStatus.name}`, 10);
  // First ensure we have enough harvesters to gather energy
  if (roomStatus.creeps.harvester < 2) {
    roster.harvester = 2;
    roster.upgrader = 0; // Don't focus on upgrading until we have enough energy coming in
    roster.builder = 0; // Don't focus on building until we have enough energy coming in
  } else {
    // If we have enough harvesters, focus on upgrading
    roster.upgrader = 2;
    roster.harvester = 1;
    roster.builder = 1;
  }
}

function orchestrateRoom(roomName, roomStatus, roster) {
  const room = Game.rooms[roomName];

  const totalExtensions =
    roomStatus.extensionBuilt +
    roomStatus.extensionPlanned +
    roomStatus.extensionSites;

  const startingExtensions = 10;
  // Planning phase
  // if (totalExtensions < startingExtensions) {
  //   planExtensionPlacement(roomName, totalExtensions, startingExtensions);
  // }

  if (roomStatus.creeps.harvester < 1) {
    roster.harvester = 1;
    roster.upgrader = 0; // Don't focus on upgrading until we have enough energy coming in
    roster.builder = 0; // Don't focus on building until we have enough energy coming in
    return roster;
  }
  // Status level == 1; first priority is to upgrade to level 2 to unlock extensions
  if (roomStatus.controllerLevel < 2) {
    roster = initializeRoom(roomStatus, roster);
    return roster;
  }

  const totalEnergy = roomStatus.energyAvailable;
  const energyCapacity = roomStatus.energyCapacity;
  const energyRatio = energyCapacity > 0 ? totalEnergy / energyCapacity : 0;

  // console.log(`Energy: ${totalEnergy}/${energyCapacity} (${(energyRatio * 100).toFixed(2)}%)`);

  const extensionInitiated =
    roomStatus.extensionBuilt + roomStatus.extensionSites;
  //
  if (roomStatus.controllerLevel == 2) {
    if (extensionInitiated < 5) {
      console.log(
        `Controller level 2, initiating extensions: ${extensionInitiated}/5`,
      );
      placeExtensionConstructionSites(roomName, 5 - extensionInitiated);
    }
  } else if (roomStatus.controllerLevel == 3) {
    if (extensionInitiated < 10) {
      console.log(
        `Controller level 3, initiating extensions: ${extensionInitiated}/10`,
      );
      placeExtensionConstructionSites(roomName, 10 - extensionInitiated);
    }
  }

  const constructionSites = room.find(FIND_CONSTRUCTION_SITES);

  // If we have extensions planned or built, we need builders to construct them
  if (constructionSites.length > 10) {
    roster.builder = 4;
  } else if (constructionSites.length > 0) {
    roster.builder = 2;
  } else {
    roster.builder = 1; // Keep at least 1 builder to handle roads and future construction
  }

  return roster;
}

function planRoadsBasic(roomName) {
  // TODO - improve road planning
  const room = Game.rooms[roomName];
  const spawns = room.find(FIND_MY_SPAWNS);
  const controller = room.controller;
  const sources = room.find(FIND_SOURCES);

  // Plan roads from each source to each spawn and to controller
  sources.forEach((source) => {
    // Plan roads from source to each spawn
    spawns.forEach((spawn) => {
      const path = source.pos.findPathTo(spawn.pos, { ignoreCreeps: true });
      path.forEach((step) => {
        const structures = room.lookForAt(LOOK_STRUCTURES, step.x, step.y);
        const constructionSites = room.lookForAt(
          LOOK_CONSTRUCTION_SITES,
          step.x,
          step.y,
        );
        if (structures.length === 0 && constructionSites.length === 0) {
          room.createConstructionSite(step.x, step.y, STRUCTURE_ROAD);
        }
      });
    });

    // Plan roads from source to controller
    if (controller) {
      const path = source.pos.findPathTo(controller.pos, {
        ignoreCreeps: true,
      });
      path.forEach((step) => {
        const structures = room.lookForAt(LOOK_STRUCTURES, step.x, step.y);
        const constructionSites = room.lookForAt(
          LOOK_CONSTRUCTION_SITES,
          step.x,
          step.y,
        );
        if (structures.length === 0 && constructionSites.length === 0) {
          room.createConstructionSite(step.x, step.y, STRUCTURE_ROAD);
        }
      });
    }
  });
}

function removeConstructionRoads(roomName) {
  const room = Game.rooms[roomName];
  const constructionSites = room.find(FIND_CONSTRUCTION_SITES, {
    filter: (site) => site.structureType === STRUCTURE_ROAD,
  });

  let removedCount = 0;
  constructionSites.forEach((site) => {
    site.remove();
    removedCount++;
  });

  console.log(
    `Removed ${removedCount} road construction sites from ${roomName}`,
  );
  return removedCount;
}

const baseName = "Spawn1"; // TODO - make it dynamic or default

module.exports.loop = function () {
  clearCreepsMemory();

  let roster = {
    harvester: 2,
    builder: 4,
    upgrader: 2,
  };
  const roomName = Game.spawns[baseName].room.name;

  // TODO - UPDATE Orchestrator to handle construction sites alone

  const roomStatus = getRoomStatus(roomName);

  utils.periodicLogger(`Room status: ${JSON.stringify(roomStatus)}`, 60);

  roster = orchestrateRoom(roomName, roomStatus, roster);
  // removeConstructionRoads(roomName);
  // removeExtensionFlags(roomName);

  //   planRoadsBasic(roomName);
  spawnProcedure(roster, baseName, roomStatus, roomName);

  roomOrchestrator.placeRampantsConstructionSites(roomName, true);
//   roomOrchestrator.planControllerRamparts(roomName, false);
  //   utils.getPositionsByPathCost(roomName, [{ x: 25, y: 25 }], { visual: true });

  // const distance_transform = utils.getDistanceTransform(roomName, {
  //   visual: true,
  // });

  handleCreeps();
};
