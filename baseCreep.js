const utils = require("./utils");

const findRepainTargets = (creep) => {
  const walls = creep.room.find(FIND_STRUCTURES, {
    filter: (structure) =>
      structure.structureType == STRUCTURE_WALL &&
      structure.hits < structure.hitsMax * 0.1, // Only repair walls below 10% health
  });

  const targets = creep.room
    .find(FIND_STRUCTURES, {
      filter: (structure) =>
        structure.structureType !== STRUCTURE_WALL &&
        structure.hits < structure.hitsMax * 0.8, // Only repair structures below 80% health
    })
    .concat(walls);

  // Sort targets by lowest health percentage
  targets.sort((a, b) => {
    const distanceA = creep.pos.getRangeTo(a);
    const distanceB = creep.pos.getRangeTo(b);
    const healthPercentA = a.hits / a.hitsMax;
    const healthPercentB = b.hits / b.hitsMax;
    
    // Weight: 70% health percentage, 30% distance (normalized to 0-1 range by dividing by 50)
    const scoreA = healthPercentA * 0.7 + (distanceA / 50) * 0.3;
    const scoreB = healthPercentB * 0.7 + (distanceB / 50) * 0.3;
    
    return scoreA - scoreB;
    });
  return targets;
};

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
    const repairTargets = findRepainTargets(creep);

    const energyAvailable = creep.room.energyAvailable;
    const energyCapacity = creep.room.energyCapacityAvailable;

    if (
      (creep.memory.action == "gathering" ||
        creep.memory.action === undefined) &&
      creep.store.getFreeCapacity() == 0
    ) {
      let chooseAction = "upgrading";
      let choosenTarget = null;
      for (const action of priorityList) {
        if (action == "building" && constructionSites.length > 0) {
          chooseAction = "building";
          // creep.memory.action = "building";
          // creep.say("🚧 build");
          break;
        } else if (action == "repairing" && repairTargets.length > 0) {
          chooseAction = "repairing";
          choosenTarget = repairTargets[0].id;
          // creep.memory.action = "repairing";
          // creep.say("🛠 repairing");
          break;
        } else if (action == "harvesting" && energyAvailable < energyCapacity) {
          chooseAction = "harvesting";
          // creep.memory.action = "harvesting";
          // creep.say("⛏ harvesting");
          break;
        } else if (action == "upgrading") {
          chooseAction = "upgrading";
          // creep.memory.action = "upgrading";
          // creep.say("⚡ upgrading");
          break;
        }
      }

      if (choosenTarget) {
        creep.memory.actionTarget = choosenTarget;
      } else {
        delete creep.memory.actionTarget; // Clear target if no action requires it
      }
      creep.memory.action = chooseAction;
      sayAction(creep, chooseAction);
    }
  },
  moveToTarget: function (creep, target, color = "#ffffff") {
    creep.moveTo(target, { visualizePathStyle: { stroke: color } });
  },
  performAction(creep, action) {
    const energyAvailable = creep.room.energyAvailable;
    const energyCapacity = creep.room.energyCapacityAvailable;
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
      } else {
        console.log(`No construction sites found for creep ${creep.name}`);
        creep.memory.action = "upgrading"; // Fallback to upgrading if no construction sites
      }
    } else if (action == "repairing" && creep.memory.actionTarget) {
      var target = Game.getObjectById(creep.memory.actionTarget);

      if (target && target.hits < target.hitsMax) {
        if (creep.repair(target) == ERR_NOT_IN_RANGE) {
          baseCreep.moveToTarget(creep, target, "#00ff22");
        }
      } else {
        console.log(`No repair targets found for creep ${creep.name}`);
        creep.memory.action = "upgrading"; // Fallback to upgrading if no repair targets
      }
    } else if (action == "upgrading") {
      if (creep.upgradeController(creep.room.controller) == ERR_NOT_IN_RANGE) {
        baseCreep.moveToTarget(creep, creep.room.controller, "#ffaa00");
      }
    } else if (action == "harvesting") {
      if (energyAvailable >= energyCapacity) {
        console.log(
          `Energy is full in room ${creep.room.name}. Creep ${creep.name} will switch to upgrading.`,
        );
        creep.memory.action = "upgrading";
        return;
      }
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
      creep.memory.action = undefined; // Reset action to trigger re-evaluation
    }
  },
};

exports.baseCreep = baseCreep;
