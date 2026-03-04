const utils = require("./utils");

const CRITICAL_HITS = 100; // Define critical hits threshold for critical repairs

const findRepainTargets = (creep) => {
  const walls = creep.room.find(FIND_STRUCTURES, {
    filter: (structure) =>
      structure.structureType == STRUCTURE_WALL &&
      structure.hits < 1000000, // Only repair walls below 1M health
  });

  const ramparts = creep.room.find(FIND_STRUCTURES, {
    filter: (structure) =>
      structure.structureType == STRUCTURE_RAMPART &&
      structure.hits < structure.hitsMax * 0.5, // Only repair ramparts below 50% health
  });

  const targets = creep.room
    .find(FIND_STRUCTURES, {
      filter: (structure) =>
        structure.structureType !== STRUCTURE_WALL &&
        structure.hits < structure.hitsMax * 0.8, // Only repair structures below 80% health
    })
    .concat(walls)
    .concat(ramparts);

  // Sort targets by lowest health percentage, prioritizing ramparts
  targets.sort((a, b) => {
    const distanceA = creep.pos.getRangeTo(a);
    const distanceB = creep.pos.getRangeTo(b);
    const healthPercentA = a.hits / a.hitsMax;
    const healthPercentB = b.hits / b.hitsMax;

    // Prioritize structures with absolute health below 1000 first
    const isLowHealthA = a.hits < 100 ? 1 : 0;
    const isLowHealthB = b.hits < 100 ? 1 : 0;

    if (isLowHealthA !== isLowHealthB) {
      return isLowHealthB - isLowHealthA; // Low health structures come first
    }

    // Weight: 70% health percentage, 30% distance (normalized to 0-1 range by dividing by 50)
    const scoreA = healthPercentA * 0.7 + (distanceA / 50) * 0.3;
    const scoreB = healthPercentB * 0.7 + (distanceB / 50) * 0.3;

    return scoreA - scoreB;
  });
  return targets;
};

function sortTargets(creep, targets) {
  // Create a hashmap with target.id as key and {targetCount, distance} as values
  const targetMap = {};

  targets.forEach((target) => {
    // Count how many creeps are targeting this target
    let targetCount = 0;
    for (const creepName in Game.creeps) {
      const otherCreep = Game.creeps[creepName];
      if (otherCreep.memory.actionTarget === target.id) {
        targetCount++;
      }
    }

    // Calculate distance
    const distance = creep.pos.getRangeTo(target);

    // Store in hashmap
    targetMap[target.id] = {
      targetCount: targetCount,
      distance: distance,
    };
  });

  // Sort targets based on targetCount (ascending) and distance (descending)
  targets.sort((a, b) => {
    const dataA = targetMap[a.id];
    const dataB = targetMap[b.id];

    // First, sort by targetCount (ascending - fewer targets first)
    if (dataA.targetCount !== dataB.targetCount) {
      return dataA.targetCount - dataB.targetCount;
    }

    // If targetCount is the same, sort by distance (descending - farther first)
    return dataB.distance - dataA.distance;
  });

  return targets;
}

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
    const repairCritical = repairTargets.filter(
      (target) => target.hits < CRITICAL_HITS,
    );

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
        if (action == "repairCritical" && repairCritical.length > 0) {
          chooseAction = "repairing";
          choosenTarget = {
            id: repairCritical[0].id,
            pos: repairCritical[0].pos,
          };
          break;
        } else if (action == "building" && constructionSites.length > 0) {
          chooseAction = "building";
          const target = sortTargets(creep, constructionSites)[0];
          choosenTarget = { id: target.id, pos: target.pos };
          // creep.memory.action = "building";
          // creep.say("🚧 build");
          break;
        } else if (action == "repairing" && repairTargets.length > 0) {
          chooseAction = "repairing";
          const target = repairTargets[0];
          choosenTarget = { id: target.id, pos: target.pos };
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
    // TODO - refactor to make it more maintanable
    const energyAvailable = creep.room.energyAvailable;
    const energyCapacity = creep.room.energyCapacityAvailable;
    sayAction(creep, action);
    if (action == "gathering") {
      baseCreep.gatherResource(creep);
    } else if (action == "building") {
      const memoryTarget = creep.memory.actionTarget;

      const target = Game.getObjectById(memoryTarget.id);
      const targetPos = memoryTarget.pos;

      if (target && target.progress < target.progressTotal) {
        if (creep.build(target) == ERR_NOT_IN_RANGE) {
          baseCreep.moveToTarget(creep, target, "#ffffff");
        }
      } else if (!target) {
        const structure = creep.room.lookForAt(
          LOOK_STRUCTURES,
          targetPos.x,
          targetPos.y,
        )[0];
        if (structure && structure.hits < structure.hitsMax) {
          console.log(
            `Target construction site ${memoryTarget.id} is now a structure. Creep ${creep.name} will switch to repairing it.`,
          );
          creep.memory.action = "repairing";
          creep.memory.actionTarget = { id: structure.id, pos: structure.pos };
        } else {
          creep.memory.action = undefined;
          delete creep.memory.actionTarget;
        }
      } else {
        creep.memory.action = undefined;
      }
    } else if (action == "repairing" && creep.memory.actionTarget) {
      const memoryTarget = creep.memory.actionTarget;
      var target = Game.getObjectById(memoryTarget.id);

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
