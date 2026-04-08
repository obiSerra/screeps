/**
 * Defender Role
 * Emergency defense creep optimized for maximum attack power
 * Stays combat-ready and does not perform economic tasks
 */

const utils = require("utils");
const baseCreep = require("baseCreep");
const CONFIG = require("config");

var roleDefender = () => {
  const base = baseCreep.baseCreep;
  
  return {
    /** @param {Creep} creep **/
    run: function (creep) {
      // Defenders focus exclusively on combat - no economic tasks
      // baseCreep.workerActions() will automatically assign "attacking" when invaders present
      
      const hasInvaders = utils.areThereInvaders(creep.room);
      
      if (hasInvaders) {
        // Combat mode: attack hostile creeps
        base.workerActions(creep, ["attacking"]);
        
        if (!creep.memory.action) {
          creep.memory.action = "attacking";
        }
        
        base.performAction(creep, creep.memory.action);
      } else {
        // No invaders: patrol defensive positions
        // Patrol near spawn or controller as defensive position
        const cache = global.roomCache && global.roomCache[creep.room.name];
        const spawn = cache ? cache.spawns[0] : creep.room.find(FIND_MY_SPAWNS)[0];
        const controller = creep.room.controller;
        
        // Alternate patrol positions for coverage
        const patrolTarget = (Game.time % (CONFIG.COMBAT.PATROL_MODULO * 10)) < (CONFIG.COMBAT.PATROL_MODULO * 5)
          ? spawn
          : controller;
        
        if (patrolTarget) {
          const range = creep.pos.getRangeTo(patrolTarget);
          
          // Stay within defensive range but not too close
          if (range > CONFIG.COMBAT.DEFENSIVE_RANGE + CONFIG.COMBAT.PATROL_OFFSET) {
            creep.moveTo(patrolTarget, {
              visualizePathStyle: { stroke: "#0000ff", opacity: 0.3 },
              reusePath: 20
            });
          } else if (range < CONFIG.COMBAT.PATROL_OFFSET) {
            // Move away if too close
            const direction = patrolTarget.pos.getDirectionTo(creep.pos);
            creep.move(direction);
          } else {
            // In patrol zone: idle or scan for threats
            creep.say("🛡️");
          }
        }
      }
    },
  };
};

module.exports = roleDefender();
