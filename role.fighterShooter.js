/**
 * Shooter Fighter Role
 * Ranged damage dealers with RANGED_ATTACK parts
 * Maintains distance from targets for optimal damage/safety
 */

const baseCreep = require("./baseCreep");

var roleFighterShooter = () => {
  const base = baseCreep.baseCreep;
  
  return {
    /** @param {Creep} creep **/
    run: function (creep) {
      // Shooter fighters use ranged attacks and maintain distance
      // Priority: rangingAttack > delivering (energy resupply)
      base.workerActions(creep, ["rangingAttack", "delivering"]);
      
      // Safety check: if no action assigned, default to delivering
      if (!creep.memory.action) {
        creep.memory.action = "delivering";
      }
      
      // Perform the assigned action
      base.performAction(creep, creep.memory.action);
    },
  };
};

module.exports = roleFighterShooter();
