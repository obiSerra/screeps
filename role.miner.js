const utils = require("utils");
const baseCreep = require("baseCreep");

/**
 * Miner role - stationary harvester at source
 * Sits at assigned source and harvests continuously
 * Drops energy to container or ground for haulers to collect
 * Used in RCL 4+ specialized strategy
 */
var roleMiner = () => {
  const base = baseCreep.baseCreep;
  return {
    /** @param {Creep} creep **/
    run: function (creep) {
      // Miners focus exclusively on mining at their assigned source
      base.workerActions(creep, ["rally", "mining"]);
      
      base.performAction(creep, creep.memory.action);
    },
  };
};

module.exports = roleMiner();
