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
      // Priority: attacking > rally
      base.workerActions(creep, ["attacking", "rally"]);
      
      // Perform the assigned action
      base.performAction(creep, creep.memory.action);
    },
  };
};

module.exports = roleFighterFodder();
