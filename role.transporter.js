const utils = require("utils");
const baseCreep = require("baseCreep");

var roleTransporter = () => {
  const base = baseCreep.baseCreep;
  return {
    /** @param {Creep} creep **/
    run: function (creep) {
      base.workerActions(creep, ["rally", "transporting"]);
      base.performAction(creep, creep.memory.action);
    },
  };
};

module.exports = roleTransporter();
