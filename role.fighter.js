/**
 * Fighter Role
 * Dedicated combat creep that patrols and defends the room
 */

const utils = require("utils");
const baseCreep = require("baseCreep");

var roleFighter = () => {
  const base = baseCreep.baseCreep;
  
  return {
    /** @param {Creep} creep **/
    run: function (creep) {
      // baseCreep workerActions() automatically detects fighters and assigns "attacking" action
      // when invaders present. Priority list gives fighters something to do when idle.
      base.workerActions(creep, ["attacking", "repairing", "upgrading"]);
      
      // Perform the assigned action
      base.performAction(creep, creep.memory.action);
      
      // If no action assigned and no invaders, patrol near controller/spawn
      if (!creep.memory.action && !utils.areThereInvaders(creep.room)) {
        // Patrol: move to controller area as defensive position
        const controller = creep.room.controller;
        if (controller && creep.pos.getRangeTo(controller) > 5) {
          creep.moveTo(controller, {
            visualizePathStyle: { stroke: "#ff0000", opacity: 0.5 }
          });
        }
      }
    },
  };
};

module.exports = roleFighter();
