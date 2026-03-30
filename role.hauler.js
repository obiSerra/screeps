const utils = require("utils");
const baseCreep = require("baseCreep");

/**
 * Hauler role - pure transport creep with no WORK parts
 * Picks up energy from containers near sources and dropped resources
 * Delivers energy to spawns, extensions, towers, and storage
 * Used in RCL 4+ specialized strategy
 */
var roleHauler = () => {
  const base = baseCreep.baseCreep;
  return {
    /** @param {Creep} creep **/
    run: function (creep) {
      // Haulers alternate between collecting and delivering energy
      base.workerActions(creep, ["rally", "hauling", "delivering"]);
      
      base.performAction(creep, creep.memory.action);
    },
  };
};

module.exports = roleHauler();
