const baseCreep = require("baseCreep");
const flagManager = require("flagManager");

/**
 * Finds the best energy source in a remote room.
 * Priority: tombstones > ruins > dropped resources > containers > storage
 * @param {Room} room
 * @returns {Object|null} { target, action } where action is 'withdraw' or 'pickup'
 */
function findRemoteEnergySource(room) {
  const tombstones = room.find(FIND_TOMBSTONES, {
    filter: (t) => t.store && t.store[RESOURCE_ENERGY] > 0,
  });
  if (tombstones.length > 0) {
    return { target: tombstones[0], action: "withdraw" };
  }

  const ruins = room.find(FIND_RUINS, {
    filter: (r) => r.store && r.store[RESOURCE_ENERGY] > 0,
  });
  if (ruins.length > 0) {
    return { target: ruins[0], action: "withdraw" };
  }

  const dropped = room.find(FIND_DROPPED_RESOURCES, {
    filter: (r) => r.resourceType === RESOURCE_ENERGY && r.amount > 0,
  });
  if (dropped.length > 0) {
    return { target: dropped[0], action: "pickup" };
  }

  const containers = room.find(FIND_STRUCTURES, {
    filter: (s) =>
      s.structureType === STRUCTURE_CONTAINER &&
      s.store[RESOURCE_ENERGY] > 0,
  });
  if (containers.length > 0) {
    return { target: containers[0], action: "withdraw" };
  }

  const storage = room.find(FIND_STRUCTURES, {
    filter: (s) =>
      s.structureType === STRUCTURE_STORAGE &&
      s.store[RESOURCE_ENERGY] > 0,
  });
  if (storage.length > 0) {
    return { target: storage[0], action: "withdraw" };
  }

  return null;
}

/**
 * Handles remote hauler behavior as a simple state machine:
 *   1. If empty → travel to remote room
 *   2. If in remote room and not full → collect energy
 *   3. If full (or nothing left to collect) → travel home
 *   4. If in home room with cargo → fall through to normal delivery
 * @param {Creep} creep
 * @returns {boolean} true if remote logic handled the tick, false to fall through
 */
function handleRemoteHauler(creep) {
  const remoteRoom = creep.memory.remoteRoom;
  const spawnRoom = creep.memory.spawnRoom;
  const isEmpty = creep.store.getUsedCapacity() === 0;
  const isFull = creep.store.getFreeCapacity() === 0;
  const inRemoteRoom = creep.room.name === remoteRoom;
  const inHomeRoom = creep.room.name === spawnRoom;

  // Validate that our assigned flag still exists
  const flag = Game.flags[creep.memory.remoteFlagName];
  if (!flag) {
    delete creep.memory.isRemoteHauler;
    delete creep.memory.remoteFlagName;
    delete creep.memory.remoteRoom;
    return false;
  }

  // State 1: Empty → travel to remote room
  if (isEmpty && !inRemoteRoom) {
    creep.moveTo(flag, {
      visualizePathStyle: { stroke: "#ffaa00", opacity: 0.5 },
    });
    return true;
  }

  // State 2: In remote room and not full → collect energy
  if (inRemoteRoom && !isFull) {
    const source = findRemoteEnergySource(creep.room);
    if (source) {
      if (source.action === "pickup") {
        if (creep.pickup(source.target) === ERR_NOT_IN_RANGE) {
          creep.moveTo(source.target, {
            visualizePathStyle: { stroke: "#ffaa00", opacity: 0.5 },
          });
        }
      } else {
        if (creep.withdraw(source.target, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
          creep.moveTo(source.target, {
            visualizePathStyle: { stroke: "#ffaa00", opacity: 0.5 },
          });
        }
      }
      return true;
    }
    // No energy sources available — head home with whatever we have
    if (!isEmpty) {
      // Fall through to state 3
    } else {
      // Empty and nothing to collect — wait near flag
      creep.moveTo(flag);
      return true;
    }
  }

  // State 3: Has cargo and not in home room → travel home
  if (!isEmpty && !inHomeRoom) {
    const homeRoom = Game.rooms[spawnRoom];
    const target = homeRoom && homeRoom.storage
      ? homeRoom.storage
      : (homeRoom && homeRoom.controller ? homeRoom.controller : new RoomPosition(25, 25, spawnRoom));
    creep.moveTo(target, {
      visualizePathStyle: { stroke: "#ffffff", opacity: 0.5 },
    });
    return true;
  }

  // State 4: In home room with cargo → fall through to normal delivery
  return false;
}

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
      if (creep.memory.isRemoteHauler && handleRemoteHauler(creep)) {
        return;
      }

      // Haulers alternate between collecting and delivering energy
      base.workerActions(creep, ["rally", "delivering", "hauling"]);

      base.performAction(creep, creep.memory.action);
    },
  };
};

module.exports = roleHauler();
