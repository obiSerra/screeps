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
      // Priority: rangingAttack > rally (if no targets/flags)
      base.workerActions(creep, ["rangingAttack", "rally"]);
      
      // Perform the assigned action
      base.performAction(creep, creep.memory.action);
    },
  };
};

module.exports = roleFighterShooter();
