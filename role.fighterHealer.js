/**
 * Healer Fighter Role
 * Support units with HEAL parts
 * Stays behind front line to heal damaged allies
 */

const baseCreep = require("./baseCreep");
const { findNearestAttackFlag } = require("./creep.targetFinding");

var roleFighterHealer = () => {
  const base = baseCreep.baseCreep;
  
  return {
    /** @param {Creep} creep **/
    run: function (creep) {
      // Healer fighters prioritize healing damaged allies
      // Priority: healing > delivering (energy resupply)
      base.workerActions(creep, ["healing", "delivering"]);
      
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

module.exports = roleFighterHealer();
