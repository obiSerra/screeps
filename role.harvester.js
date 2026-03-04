const utils = require("utils");
const baseCreep = require("baseCreep");

var roleHarvester = () => {
  const base = baseCreep.baseCreep;
  return {
    /** @param {Creep} creep **/
    run: function (creep) {
      
      base.workerActions(creep, ["harvesting", "upgrading", "repairing", "building"]);

      base.performAction(creep, creep.memory.action);
    },
  };
};

module.exports = roleHarvester();
