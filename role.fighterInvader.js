/**
 * Invader Fighter Role
 * Balanced melee units with economic utility fallback
 * Current standard fighter design - versatile combat + support tasks
 */

const baseCreep = require("./baseCreep");
const { findNearestAttackFlag } = require("./creep.targetFinding");

var roleFighterInvader = () => {
  const base = baseCreep.baseCreep;
  
  return {
    /** @param {Creep} creep **/
    run: function (creep) {
      // Invader fighters are balanced - combat priority, economic fallback
      // baseCreep workerActions() automatically detects fighters and assigns "attacking" action
      // when invaders present. Priority list gives fighters something to do when idle.
      base.workerActions(creep, ["attacking", "delivering", "transporting", "hauling"]);
      
      // Safety check: if no action assigned, check for attack flags
      if (!creep.memory.action) {
        const attackFlag = findNearestAttackFlag(creep);
        if (attackFlag && creep.pos.getRangeTo(attackFlag) > 2) {
          creep.moveTo(attackFlag, {
            visualizePathStyle: { stroke: "#ff0000", opacity: 0.5 }
          });
          return;
        }
        // Stay combat-ready instead of becoming transport worker
        creep.memory.action = "rally";
      }
      
      // Perform the assigned action
      base.performAction(creep, creep.memory.action);
    },
  };
};

module.exports = roleFighterInvader();
