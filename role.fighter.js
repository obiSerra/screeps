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
        // baseCreep workerActions() automatically detects fighters and assigns "attacking" action
        // when invaders present. Priority list gives fighters something to do when idle.
        base.workerActions(creep, ["attacking", "delivering", "transporting", "hauling"]);
        // console.log(`Fighter ${creep.name} performing action: ${creep.memory.action}`);
        // Safety check: if no action assigned, default to hauling
        if (!creep.memory.action) {
          creep.memory.action = "transporting";
        }
        
        // Perform the assigned action
        base.performAction(creep, creep.memory.action);
        
        // If no action assigned and no invaders, check for attack flags first
        if (!creep.memory.action && !utils.areThereInvaders(creep.room)) {
          // Check for attack flags to rally at
          const attackFlag = findNearestAttackFlag(creep);
          if (attackFlag) {
            // Move to attack flag position
            if (creep.pos.getRangeTo(attackFlag) > 2) {
              creep.moveTo(attackFlag, {
                visualizePathStyle: { stroke: "#ff0000", opacity: 0.5 }
              });
            }
          } else {
            // No attack flags, patrol near controller/spawn
            const controller = creep.room.controller;
            if (controller && creep.pos.getRangeTo(controller) > 5) {
              creep.moveTo(controller, {
                visualizePathStyle: { stroke: "#ff0000", opacity: 0.5 }
              });
            }
          }
        }
      },
    };
  };

  module.exports = roleFighter();
