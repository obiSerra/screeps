  /**
   * Fighter Role
   * Dedicated combat creep that patrols and defends the room
   */

  const utils = require("utils");
  const baseCreep = require("baseCreep");
  const { findNearestAttackFlag } = require("./creep.targetFinding");

  var roleFighter = () => {
    const base = baseCreep.baseCreep;
    
    return {
      /** @param {Creep} creep **/
      run: function (creep) {
        // Priority 1: Check for attack flags first (before economic tasks)
        const attackFlag = findNearestAttackFlag(creep);
        
        // Priority 2: If attack flag exists and we're not close to it, move there
        if (attackFlag && creep.pos.getRangeTo(attackFlag) > 3) {
          creep.moveTo(attackFlag, {
            visualizePathStyle: { stroke: "#ff0000", opacity: 0.5 }
          });
          return; // Skip economic tasks while moving to attack position
        }
        
        // Priority 3: If at attack flag or no flag, handle combat via baseCreep
        // baseCreep workerActions() automatically detects fighters and assigns "attacking" action
        // when targets are present. Priority list gives fighters something to do when idle.
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

  module.exports = roleFighter();
