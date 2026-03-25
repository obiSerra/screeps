const utils = require("utils");
const baseCreep = require("baseCreep");
var roleUpgrader = () => {
  const base = baseCreep.baseCreep;
  return {
    /** @param {Creep} creep **/
    run: function (creep) {
      // Check if room is in energy priority mode
      const roomMemory = Memory.rooms && Memory.rooms[creep.room.name];
      const energyPriorityMode = roomMemory && roomMemory.energyPriorityMode;
      
      // In priority mode, act as harvester (prioritize energy delivery)
      // Otherwise, use normal upgrader priorities
      const priorityList = energyPriorityMode
        ? ["harvesting", "upgrading", "repairing", "building"]
        : ["repairCritical", "upgrading", "harvesting", "repairing", "building"];
      
      base.workerActions(creep, priorityList);

      base.performAction(creep, creep.memory.action);
    },
  };
};

module.exports = roleUpgrader();
