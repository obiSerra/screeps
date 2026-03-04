const utils = require("utils");
const baseCreep = require("baseCreep");

var roleBuilder = () => {
  const base = baseCreep.baseCreep;
  return {
    run: function (creep) {
      base.workerActions(creep, [
        "repairCritical",
        "building",
        "repairing",
        "upgrading",
      ]);
      base.performAction(creep, creep.memory.action);
    },
  };
};

module.exports = roleBuilder();
