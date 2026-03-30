/**
 * Shooter Fighter Role
 * Ranged damage dealers with RANGED_ATTACK parts
 * Maintains distance from targets for optimal damage/safety
 */

const baseCreep = require("./baseCreep");
const { findNearestAttackFlag } = require("./creep.targetFinding");

var roleFighterShooter = () => {
  const base = baseCreep.baseCreep;
  
  return {
    /** @param {Creep} creep **/
    run: function (creep) {
      // Shooter fighters use ranged attacks and maintain distance
      // Priority: rangingAttack > delivering (energy resupply)
      base.workerActions(creep, ["rangingAttack", "delivering"]);
      
      // Safety check: if no action assigned, check for attack flags
      if (!creep.memory.action) {
        const attackFlag = findNearestAttackFlag(creep);
        if (attackFlag && creep.pos.getRangeTo(attackFlag) > 2) {
          creep.moveTo(attackFlag, {
            visualizePathStyle: { stroke: "#ff0000", opacity: 0.5 }
          });
          return;
        }
        // Stay combat-ready instead of becoming delivery worker
        creep.memory.action = "rally";
      }
      
      // Perform the assigned action
      base.performAction(creep, creep.memory.action);
    },
  };
};

module.exports = roleFighterShooter();
