/**
 * Fodder Fighter Role
 * Cheap disposable melee units designed to absorb damage
 * Minimal ATTACK parts with TOUGH armor - designed to die protecting valuable units
 */

const baseCreep = require("./baseCreep");
const { findNearestAttackFlag } = require("./creep.targetFinding");

var roleFighterFodder = () => {
  const base = baseCreep.baseCreep;
  
  return {
    /** @param {Creep} creep **/
    run: function (creep) {
      // Fodder fighters are aggressive - combat first, minimal fallback
      // Priority: attacking > delivering (if wounded and can't fight)
      base.workerActions(creep, ["attacking", "delivering"]);
      
      // Safety check: if no action assigned, check for attack flags
      if (!creep.memory.action) {
        const attackFlag = findNearestAttackFlag(creep);
        if (attackFlag && creep.pos.getRangeTo(attackFlag) > 2) {
          creep.moveTo(attackFlag, {
            visualizePathStyle: { stroke: "#ff0000", opacity: 0.5 }
          });
          return;
        }
        creep.memory.action = "delivering";
      }
      
      // Perform the assigned action
      base.performAction(creep, creep.memory.action);
    },
  };
};

module.exports = roleFighterFodder();
