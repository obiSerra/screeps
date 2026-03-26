/**
 * Invader Fighter Role
 * Balanced melee units with economic utility fallback
 * Current standard fighter design - versatile combat + support tasks
 */

const baseCreep = require("./baseCreep");

var roleFighterInvader = () => {
  const base = baseCreep.baseCreep;
  
  return {
    /** @param {Creep} creep **/
    run: function (creep) {
      // Invader fighters are balanced - combat priority, economic fallback
      // baseCreep workerActions() automatically detects fighters and assigns "attacking" action
      // when invaders present. Priority list gives fighters something to do when idle.
      base.workerActions(creep, ["attacking", "delivering", "transporting", "hauling"]);
      
      // Safety check: if no action assigned, default to transporting
      if (!creep.memory.action) {
        creep.memory.action = "transporting";
      }
      
      // Perform the assigned action
      base.performAction(creep, creep.memory.action);
    },
  };
};

module.exports = roleFighterInvader();
