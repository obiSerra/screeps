/**
 * Explorer Role
 * Multi-room exploration and expansion creep
 * 
 * Priorities:
 * 1. Claim controller if 'claim' flag exists in same room
 * 2. Attack targets with 'attack' flag
 * 3. Engage hostile creeps/structures nearby
 * 4. Navigate toward 'explore' flag
 */

const CONFIG = require("./config");
const utils = require("./utils");
const baseCreep = require("./baseCreep");

var roleExplorer = () => {
  const base = baseCreep.baseCreep;
  
  return {
    /** @param {Creep} creep **/
    run: function (creep) {
      // Priority 1: Claim controller if 'claim' flag exists in same room
      const claimFlag = Game.flags['claim'];
      if (claimFlag && claimFlag.pos.roomName === creep.room.name) {
        const controller = creep.room.controller;
        
        if (controller) {
          const claimResult = creep.claimController(controller);
          
          if (claimResult === ERR_NOT_IN_RANGE) {
            creep.moveTo(controller, {
              visualizePathStyle: { stroke: '#ffffff' }
            });
            creep.say('📜 Claim');
          } else if (claimResult === OK) {
            creep.say('✅ Claimed!');
            console.log(`[EXPLORER] ${creep.name} successfully claimed controller in ${creep.room.name}`);
          } else if (claimResult === ERR_GCL_NOT_ENOUGH) {
            // Try to reserve instead if we can't claim
            const reserveResult = creep.reserveController(controller);
            if (reserveResult === ERR_NOT_IN_RANGE) {
              creep.moveTo(controller, {
                visualizePathStyle: { stroke: '#ffffff' }
              });
              creep.say('🔖 Reserve');
            } else if (reserveResult === OK) {
              creep.say('🔖 Reserved');
            }
          }
          return;
        }
      }
      
      // Priority 2: Attack targets with 'attack' flag
      const attackFlag = Game.flags['attack'];
      if (attackFlag) {
        // Move toward attack flag
        if (creep.pos.getRangeTo(attackFlag.pos) > 3) {
          creep.moveTo(attackFlag.pos, {
            visualizePathStyle: { stroke: '#ff0000' }
          });
          creep.say('⚔️ Attack');
        } else {
          // In range - look for hostile creeps first
          const hostileCreep = creep.pos.findClosestByRange(FIND_HOSTILE_CREEPS, {
            filter: (hostile) => creep.pos.getRangeTo(hostile) <= 3
          });
          
          if (hostileCreep) {
            const attackResult = creep.rangedAttack(hostileCreep);
            if (attackResult === ERR_NOT_IN_RANGE) {
              creep.moveTo(hostileCreep, {
                visualizePathStyle: { stroke: '#ff0000' }
              });
            }
            creep.say('💥 ' + hostileCreep.owner.username.substring(0, 3));
            return;
          }
          
          // No hostile creeps - attack structures
          const hostileStructure = creep.pos.findClosestByRange(FIND_HOSTILE_STRUCTURES, {
            filter: (structure) => {
              // Prioritize spawns and towers
              return creep.pos.getRangeTo(structure) <= 3 &&
                     structure.structureType !== STRUCTURE_CONTROLLER;
            }
          });
          
          if (hostileStructure) {
            const attackResult = creep.rangedAttack(hostileStructure);
            if (attackResult === ERR_NOT_IN_RANGE) {
              creep.moveTo(hostileStructure, {
                visualizePathStyle: { stroke: '#ff0000' }
              });
            }
            creep.say('💥 Structure');
            return;
          }
          
          // Nothing to attack nearby, move closer to flag
          creep.moveTo(attackFlag.pos, {
            visualizePathStyle: { stroke: '#ff0000' }
          });
        }
        return;
      }
      
      // Priority 3: Engage hostile creeps/structures nearby (defensive)
      const nearbyHostileCreep = creep.pos.findClosestByRange(FIND_HOSTILE_CREEPS, {
        filter: (hostile) => creep.pos.getRangeTo(hostile) <= 5
      });
      
      if (nearbyHostileCreep) {
        const attackResult = creep.rangedAttack(nearbyHostileCreep);
        if (attackResult === ERR_NOT_IN_RANGE) {
          creep.moveTo(nearbyHostileCreep, {
            visualizePathStyle: { stroke: '#ff6600' }
          });
        }
        creep.say('🛡️ Defend');
        return;
      }
      
      const nearbyHostileStructure = creep.pos.findClosestByRange(FIND_HOSTILE_STRUCTURES, {
        filter: (structure) => {
          return creep.pos.getRangeTo(structure) <= 5 &&
                 structure.structureType !== STRUCTURE_CONTROLLER &&
                 structure.structureType !== STRUCTURE_KEEPER_LAIR;
        }
      });
      
      if (nearbyHostileStructure) {
        const attackResult = creep.rangedAttack(nearbyHostileStructure);
        if (attackResult === ERR_NOT_IN_RANGE) {
          creep.moveTo(nearbyHostileStructure, {
            visualizePathStyle: { stroke: '#ff6600' }
          });
        }
        creep.say('🛡️ Clear');
        return;
      }
      
      // Priority 4: Navigate toward 'explore' flag
      const exploreFlag = Game.flags['explore'];
      if (exploreFlag) {
        // Check if we're already at the explore flag location
        if (creep.pos.getRangeTo(exploreFlag.pos) <= 3) {
          // At destination - patrol around the flag
          creep.say('🔍 Scout');
          
          // Move in a small patrol pattern if exactly at flag
          if (creep.pos.isEqualTo(exploreFlag.pos)) {
            const patrolPos = new RoomPosition(
              exploreFlag.pos.x + (Game.time % 4 - 2),
              exploreFlag.pos.y + (Math.floor(Game.time / 4) % 4 - 2),
              exploreFlag.pos.roomName
            );
            creep.moveTo(patrolPos, {
              visualizePathStyle: { stroke: '#00ff00' }
            });
          }
        } else {
          // Navigate to explore flag
          creep.moveTo(exploreFlag.pos, {
            visualizePathStyle: { stroke: '#00ff00' },
            reusePath: 20
          });
          creep.say('🗺️ Explore');
        }
        return;
      }
      
      // No flags - default behavior: patrol home room
      creep.say('💤 Idle');
      const controller = creep.room.controller;
      if (controller && creep.pos.getRangeTo(controller) > 5) {
        creep.moveTo(controller, {
          visualizePathStyle: { stroke: '#888888' }
        });
      }
    },
  };
};

module.exports = roleExplorer();
