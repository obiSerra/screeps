const utils = require("utils");
const baseCreep = require("baseCreep");

var roleBuilder = () => {
  const base = baseCreep.baseCreep;
  return {
    run: function (creep) {
      // Check if room is in energy priority mode
      const roomMemory = Memory.rooms && Memory.rooms[creep.room.name];
      const energyPriorityMode = roomMemory && roomMemory.energyPriorityMode;
      
      // In priority mode, act as harvester (prioritize energy delivery)
      // Otherwise, use normal builder priorities
      const priorityList = energyPriorityMode
        ? ["rally", "harvesting", "upgrading", "repairing", "building"]
        : ["rally", "deconstructing", "repairCritical", "building", "repairing", "harvesting", "upgrading"];
      
      base.workerActions(creep, priorityList);
      base.performAction(creep, creep.memory.action);
    },
  };
};

module.exports = roleBuilder();
