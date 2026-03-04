const utils = require("./utils");

const sayAction = (creep, action) => {
  const icons = {
    gathering: "🔄",
    building: "🚧",
    repairing: "🛠",
    upgrading: "⚡",
    harvesting: "⛏",
  };
  const icon = icons[action] || "";
  creep.say(`${icon} ${action}`);
};

const baseCreep = {
  findSource: utils.findBestSourceForCreep,
  gatherResource: function (creep) {
    const source = utils.findBestSourceForCreep(creep);

    if (creep.harvest(source) == ERR_NOT_IN_RANGE) {
      creep.moveTo(source, { visualizePathStyle: { stroke: "#ffaa00" } });
    }
  },
  workerActions: function (creep, priorityList) {
    if (
      (creep.memory.action === undefined &&
        creep.store.getFreeCapacity() > 0) ||
      creep.store[RESOURCE_ENERGY] == 0
    ) {
      creep.memory.action = "gathering";
      creep.say("🔄 gathering");
      return;
    }

    const constructionSites = creep.room.find(FIND_CONSTRUCTION_SITES);
    const repairTargets = creep.room.find(FIND_STRUCTURES, {
      filter: (structure) =>
        structure.hits < structure.hitsMax &&
        structure.structureType != STRUCTURE_WALL &&
        structure.structureType != STRUCTURE_RAMPART,
    });

    const energyAvailable = creep.room.energyAvailable;
    const energyCapacity = creep.room.energyCapacityAvailable;

    if (
      (creep.memory.action == "gathering" ||
        creep.memory.action === undefined) &&
      creep.store.getFreeCapacity() == 0
    ) {
      for (const action of priorityList) {
        if (action == "building" && constructionSites.length > 0) {
          creep.memory.action = "building";
          creep.say("🚧 build");
          break;
        } else if (action == "repairing" && repairTargets.length > 0) {
          creep.memory.action = "repairing";
          creep.say("🛠 repairing");
          break;
        } else if (action == "harvesting" && energyAvailable < energyCapacity) {
          creep.memory.action = "harvesting";
          creep.say("⛏ harvesting");
          break;
        } else {
          creep.memory.action = "upgrading";
          creep.say("⚡ upgrading");
          break;
        }
      }
    }
  },
  moveToTarget: function (creep, target, color = "#ffffff") {
    creep.moveTo(target, { visualizePathStyle: { stroke: color } });
  },
  performAction(creep, action) {
    sayAction(creep, action);
    if (action == "gathering") {
      baseCreep.gatherResource(creep);
    } else if (action == "building") {
      var targets = creep.room.find(FIND_CONSTRUCTION_SITES);
      if (targets.length) {
        if (creep.build(targets[0]) == ERR_NOT_IN_RANGE) {
          creep.moveTo(targets[0], {
            visualizePathStyle: { stroke: "#ffffff6b" },
          });
        }
      }
    } else if (action == "repairing") {
      var targets = creep.room.find(FIND_STRUCTURES, {
        filter: (structure) => structure.hits < structure.hitsMax,
      });
      if (targets.length) {
        if (creep.repair(targets[0]) == ERR_NOT_IN_RANGE) {
          baseCreep.moveToTarget(creep, targets[0], "#00ff22");
        }
      }
    } else if (action == "upgrading") {
      if (creep.upgradeController(creep.room.controller) == ERR_NOT_IN_RANGE) {
        baseCreep.moveToTarget(creep, creep.room.controller, "#ffaa00");
      }
    } else if (action == "harvesting") {
      var targets = creep.room.find(FIND_STRUCTURES, {
        filter: (structure) => {
          return (
            (structure.structureType == STRUCTURE_EXTENSION ||
              structure.structureType == STRUCTURE_SPAWN ||
              structure.structureType == STRUCTURE_TOWER) &&
            structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0
          );
        },
      });

      if (creep.transfer(targets[0], RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
        baseCreep.moveToTarget(creep, targets[0], "#0004ff");
      }
    } else {
      console.log(`Unknown action ${action} for creep ${creep.name}`);
    }
  },
};

exports.baseCreep = baseCreep;
