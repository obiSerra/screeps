/**
 * Fodder Fighter Role
 * Cheap disposable melee units designed to absorb damage
 * Minimal ATTACK parts with TOUGH armor - designed to die protecting valuable units
 */

const baseCreep = require("./baseCreep");

var roleFighterFodder = () => {
  const base = baseCreep.baseCreep;
  
  return {
    /** @param {Creep} creep **/
    run: function (creep) {
      // Fodder fighters are aggressive - combat first, minimal fallback
      // Priority: attacking > delivering (if wounded and can't fight)
      base.workerActions(creep, ["attacking", "delivering"]);
      
      // Safety check: if no action assigned, default to delivering
      if (!creep.memory.action) {
        creep.memory.action = "delivering";
      }
      
      // Perform the assigned action
      base.performAction(creep, creep.memory.action);
    },
  };
};

module.exports = roleFighterFodder();
