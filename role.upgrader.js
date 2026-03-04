const utils = require("utils");
const baseCreep = require("baseCreep");
var roleUpgrader = () => {
  const base = baseCreep.baseCreep;
  return {
    /** @param {Creep} creep **/
    run: function (creep) {
      base.workerActions(creep, [
        "repairCritical",
        "upgrading",
        "harvesting",
        "repairing",
        "building",
      ]);

      base.performAction(creep, creep.memory.action);
    },
  };
};

module.exports = roleUpgrader();
