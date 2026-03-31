const utils = require("utils");
const baseCreep = require("baseCreep");
const flagManager = require("flagManager");
const { clear } = require("./errorTracker");
const { clearCreepAction } = require("./creep.effects");

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
          console.log(
            `Remote hauler ${creep.name} checking for energy in remote rooms...`,
          );
          // If empty, go to remote room to pick up resources
          if (isEmpty) {
            // Find best remote flag with energy available in containers/storage
            let targetFlag = null;
            let maxEnergy = 0;

            for (const { flag, sourceId } of remoteFlags) {
              // Check if there's energy in containers or storage in that room
              if (Game.rooms[flag.pos.roomName]) {
                const room = Game.rooms[flag.pos.roomName];
                // Find ALL containers and storage in the room (not limited by range)
                const storageStructures = room.find(FIND_STRUCTURES, {
                  filter: (s) =>
                    (s.structureType === STRUCTURE_CONTAINER ||
                      s.structureType === STRUCTURE_STORAGE) &&
                    s.store[RESOURCE_ENERGY] > 0,
                });

                const totalEnergy = storageStructures.reduce(
                  (sum, s) => sum + s.store[RESOURCE_ENERGY],
                  0,
                );

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

            console.log(
              `Creep room ${creep.room.name} - Remote hauler ${creep.name} found max energy ${maxEnergy} at flag ${targetFlag ? targetFlag.name : "none"}`,
            );

            if (targetFlag && creep.room.name !== targetFlag.pos.roomName) {
              creep.moveTo(targetFlag, {
                visualizePathStyle: { stroke: "#ffaa00", opacity: 0.5 },
              });
              return;
            }
          }

          // If in the same room as a remote source flag, pick up energy
          if (!isEmpty) {
            // Already carrying something, don't try to pick up more
            return;
          }

          // Check if creep is in same room as any remote source flag
          const flagInRoom = remoteFlags.find(
            (f) => f.flag.pos.roomName === creep.room.name,
          );
          if (flagInRoom && creep.store.getFreeCapacity() > 0) {
            // Set to hauling mode so it picks up energy from containers/storage
            creep.memory.action = "hauling";
            creep.memory.actionTarget = {
              id: room.find(FIND_STRUCTURES, {
                filter: (s) =>
                  (s.structureType === STRUCTURE_CONTAINER ||
                    s.structureType === STRUCTURE_STORAGE) &&
                  s.store[RESOURCE_ENERGY] > 0,
              })[0].id,
            };
            return;
          }

          // If full, return to spawn room to deliver
          if (isFull && creep.room.name !== creep.memory.spawnRoom) {
            const spawnRoom = Game.rooms[creep.memory.spawnRoom];
            if (spawnRoom && spawnRoom.controller) {
              creep.moveTo(spawnRoom.controller, {
                visualizePathStyle: { stroke: "#ffffff", opacity: 0.5 },
              });
              return;
            }
          }
        }
      }

      // Haulers alternate between collecting and delivering energy
      base.workerActions(creep, ["rally", "delivering", "hauling"]);

      base.performAction(creep, creep.memory.action);
    },
  };
};

module.exports = roleHauler();
