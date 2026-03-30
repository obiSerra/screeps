const utils = require("utils");
const baseCreep = require("baseCreep");
const flagManager = require("flagManager");

/**
 * Hauler role - pure transport creep with no WORK parts
 * Picks up energy from containers near sources and dropped resources
 * Delivers energy to spawns, extensions, towers, and storage
 * Used in RCL 4+ specialized strategy
 * Supports remote hauling via isRemoteHauler memory property
 */
var roleHauler = () => {
  const base = baseCreep.baseCreep;
  return {
    /** @param {Creep} creep **/
    run: function (creep) {
      // Handle remote hauler behavior
      if (creep.memory.isRemoteHauler) {
        const isEmpty = creep.store.getUsedCapacity() === 0;
        const isFull = creep.store.getFreeCapacity() === 0;
        
        // Get all remote source flags to know which rooms to check
        const remoteFlags = flagManager.getRemoteSourceFlags();
        
        if (remoteFlags.length === 0) {
          // No remote flags, switch to local hauling
          delete creep.memory.isRemoteHauler;
        } else {
          // If empty, go to remote room to pick up resources
          if (isEmpty) {
            // Find nearest remote flag with energy available
            let targetFlag = null;
            let maxEnergy = 0;
            
            for (const {flag, sourceId} of remoteFlags) {
              // Check if there's dropped energy or containers in that room
              if (Game.rooms[flag.pos.roomName]) {
                const room = Game.rooms[flag.pos.roomName];
                const droppedEnergy = room.find(FIND_DROPPED_RESOURCES, {
                  filter: r => r.resourceType === RESOURCE_ENERGY
                });
                const containers = flag.pos.findInRange(FIND_STRUCTURES, 3, {
                  filter: s => s.structureType === STRUCTURE_CONTAINER && s.store[RESOURCE_ENERGY] > 0
                });
                
                const totalEnergy = droppedEnergy.reduce((sum, r) => sum + r.amount, 0) +
                                   containers.reduce((sum, c) => sum + c.store[RESOURCE_ENERGY], 0);
                
                if (totalEnergy > maxEnergy) {
                  maxEnergy = totalEnergy;
                  targetFlag = flag;
                }
              } else {
                // Room not visible, go there to scout
                targetFlag = flag;
                break;
              }
            }
            
            if (targetFlag && creep.room.name !== targetFlag.pos.roomName) {
              creep.moveTo(targetFlag, {
                visualizePathStyle: { stroke: '#ffaa00', opacity: 0.5 }
              });
              return;
            }
          }
          
          // If full, return to spawn room to deliver
          if (isFull && creep.room.name !== creep.memory.spawnRoom) {
            const spawnRoom = Game.rooms[creep.memory.spawnRoom];
            if (spawnRoom && spawnRoom.controller) {
              creep.moveTo(spawnRoom.controller, {
                visualizePathStyle: { stroke: '#ffffff', opacity: 0.5 }
              });
              return;
            }
          }
        }
      }
      
      // Haulers alternate between collecting and delivering energy
      base.workerActions(creep, ["rally", "hauling", "delivering"]);
      
      base.performAction(creep, creep.memory.action);
    },
  };
};

module.exports = roleHauler();
