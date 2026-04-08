/**
 * Mineral Extractor Role
 * Stationary mineral harvester at room's mineral deposit
 * Requires extractor structure to be built
 * Drops minerals to container or ground for haulers to collect
 * Used in RCL 6+ for mineral economy
 */

const utils = require("./utils");
const baseCreep = require("./baseCreep");

/**
 * Find the mineral deposit in the creep's assigned room
 * Caches mineral ID in Memory (minerals never move)
 * @param {Creep} creep - The creep
 * @returns {Mineral|null} The mineral or null
 */
const findRoomMineral = (creep) => {
  const roomName = creep.memory.assignedRoom || creep.room.name;
  const room = Game.rooms[roomName];
  if (!room) return null;

  // Check Memory cache first (minerals never change position)
  if (Memory.rooms && Memory.rooms[roomName] && Memory.rooms[roomName].mineralId) {
    const mineral = Game.getObjectById(Memory.rooms[roomName].mineralId);
    if (mineral) return mineral;
  }

  const minerals = room.find(FIND_MINERALS);
  if (minerals.length === 0) return null;

  // Cache in Memory (permanent — minerals never move)
  if (!Memory.rooms[roomName]) Memory.rooms[roomName] = {};
  Memory.rooms[roomName].mineralId = minerals[0].id;
  return minerals[0];
};

/**
 * Check if there's a valid extractor at the mineral position
 * @param {Mineral} mineral - The mineral deposit
 * @returns {boolean} Whether extractor exists and is operational
 */
const hasExtractor = (mineral) => {
  if (!mineral) return false;

  const extractor = mineral.pos.lookFor(LOOK_STRUCTURES).find(
    (s) => s.structureType === STRUCTURE_EXTRACTOR
  );

  return !!extractor;
};

/**
 * Get the extractor structure at the mineral position
 * @param {Mineral} mineral - The mineral deposit
 * @returns {StructureExtractor|null} The extractor or null
 */
const getExtractor = (mineral) => {
  if (!mineral) return null;

  const extractor = mineral.pos.lookFor(LOOK_STRUCTURES).find(
    (s) => s.structureType === STRUCTURE_EXTRACTOR
  );

  return extractor || null;
};

/**
 * Mine mineral and drop to container or ground
 * @param {Creep} creep - The creep
 * @returns {number} Status code
 */
const mineMineral = (creep) => {
  // Find assigned mineral
  if (!creep.memory.assignedMineral) {
    const mineral = findRoomMineral(creep);
    if (!mineral) {
      creep.say("❌ no mineral");
      return ERR_NOT_FOUND;
    }
    creep.memory.assignedMineral = mineral.id;
  }

  const mineral = Game.getObjectById(creep.memory.assignedMineral);
  
  if (!mineral) {
    console.log(`[MineralExtractor] ${creep.name} - Lost mineral reference`);
    creep.say("❌ lost mineral");
    delete creep.memory.assignedMineral;
    return ERR_NOT_FOUND;
  }

  // console.log(`[MineralExtractor] ${creep.name} - Mineral: ${mineral.mineralType}, Amount: ${mineral.mineralAmount}, Pos: ${mineral.pos}`);

  // Check if mineral is depleted
  if (mineral.mineralAmount === 0) {
    console.log(`[MineralExtractor] ${creep.name} - Mineral depleted`);
    creep.say("⏳ depleted");
    return ERR_NOT_ENOUGH_RESOURCES;
  }

  // Check if extractor exists
  const extractor = getExtractor(mineral);
  if (!extractor) {
    console.log(`[MineralExtractor] ${creep.name} - No extractor found at mineral position`);
    creep.say("❌ no extractor");
    return ERR_INVALID_TARGET;
  }

  // console.log(`[MineralExtractor] ${creep.name} - Extractor cooldown: ${extractor.cooldown}`);
  // console.log(`[MineralExtractor] ${creep.name} - Creep pos: ${creep.pos}, Distance to mineral: ${creep.pos.getRangeTo(mineral)}`);
  // console.log(`[MineralExtractor] ${creep.name} - Creep WORK parts: ${creep.getActiveBodyparts(WORK)}`);
  // console.log(`[MineralExtractor] ${creep.name} - Creep carry: ${creep.store.getUsedCapacity()}/${creep.store.getCapacity()}`);

  // Move to mineral if not in range (need to be adjacent, not on top!)
  if (!creep.pos.inRangeTo(mineral, 1)) {
    // console.log(`[MineralExtractor] ${creep.name} - Moving to mineral`);
    creep.moveTo(mineral.pos, {
      visualizePathStyle: { stroke: "#ffaa00" },
      reusePath: 50,
    });
    return ERR_NOT_IN_RANGE;
  }

  // console.log(`[MineralExtractor] ${creep.name} - In range, attempting to harvest`);

  // Mine mineral
  const result = creep.harvest(mineral);
  
  // console.log(`[MineralExtractor] ${creep.name} - Harvest result: ${result}`);
  
  if (result === OK) {
    creep.say(`⛏️ ${mineral.mineralType}`);
  } else if (result === ERR_NOT_ENOUGH_RESOURCES) {
    creep.say("⏳ cooldown");
  } else if (result === ERR_TIRED) {
    // Extractor is on cooldown
    creep.say(`⏳ ${extractor.cooldown}`);
    // console.log(`[MineralExtractor] ${creep.name} - Extractor is on cooldown for ${extractor.cooldown} more ticks`);
  } else if (result === ERR_NO_BODYPART) {
    // console.log(`[MineralExtractor] ${creep.name} - ERROR: No WORK body parts!`);
    creep.say("❌ no WORK");
  } else if (result === ERR_FULL) {
    // console.log(`[MineralExtractor] ${creep.name} - Creep inventory is full`);
    creep.say("📦 full");
  } else {
    console.log(`[MineralExtractor] ${creep.name} - Harvest failed with error code: ${result}`);
  }

  return result;
};

/**
 * Find a lab to deliver minerals to
 * @param {Creep} creep - The creep
 * @returns {StructureLab|null} The lab or null
 */
const findLabForDelivery = (creep) => {
  // Find labs that have space for the mineral type we're carrying
  const mineralType = Object.keys(creep.store).find(
    (resourceType) => resourceType !== RESOURCE_ENERGY
  );

  if (!mineralType) return null;

  const cache = global.roomCache && global.roomCache[creep.room.name];
  const labs = cache
    ? cache.labs.filter((s) => s.store.getFreeCapacity(mineralType) > 0)
    : creep.room.find(FIND_STRUCTURES, {
        filter: (s) =>
          s.structureType === STRUCTURE_LAB &&
          s.store.getFreeCapacity(mineralType) > 0,
      });

  if (labs.length === 0) return null;

  // Find closest lab
  return creep.pos.findClosestByPath(labs);
};

/**
 * Deliver minerals to lab
 * @param {Creep} creep - The creep
 * @returns {number} Status code
 */
const deliverMinerals = (creep) => {
  // If creep is empty, switch back to extracting
  if (creep.store.getUsedCapacity() === 0) {
    creep.memory.delivering = false;
    delete creep.memory.deliveryTarget;
    creep.say("⛏️");
    return OK;
  }

  // Find delivery target if not set
  if (!creep.memory.deliveryTarget) {
    const lab = findLabForDelivery(creep);
    if (!lab) {
      console.log(
        `[MineralExtractor] ${creep.name} - No lab available for delivery`
      );
      creep.say("❌ no lab");
      return ERR_NOT_FOUND;
    }
    creep.memory.deliveryTarget = lab.id;
  }

  const target = Game.getObjectById(creep.memory.deliveryTarget);
  if (!target) {
    delete creep.memory.deliveryTarget;
    return ERR_INVALID_TARGET;
  }

  // Get the mineral type we're carrying
  const mineralType = Object.keys(creep.store).find(
    (resourceType) => resourceType !== RESOURCE_ENERGY
  );

  if (!mineralType) {
    creep.memory.delivering = false;
    delete creep.memory.deliveryTarget;
    return OK;
  }

  const result = creep.transfer(target, mineralType);
  
  if (result === ERR_NOT_IN_RANGE) {
    creep.moveTo(target, {
      visualizePathStyle: { stroke: "#0004ff" },
      reusePath: 50,
    });
    creep.say("🚚");
  } else if (result === OK) {
    console.log(
      `[MineralExtractor] ${creep.name} - Delivered minerals to lab`
    );
    creep.say("📬");
    // Clear target to potentially find a new one if we still have minerals
    delete creep.memory.deliveryTarget;
  } else if (result === ERR_FULL) {
    console.log(
      `[MineralExtractor] ${creep.name} - Lab is full, finding new target`
    );
    delete creep.memory.deliveryTarget;
  } else {
    console.log(
      `[MineralExtractor] ${creep.name} - Transfer failed with code: ${result}`
    );
  }

  return result;
};

/**
 * Mineral extractor role implementation
 */
const roleMineralExtractor = () => {
  return {
    /** @param {Creep} creep **/
    run: function (creep) {
      // Switch to delivery mode when full
      if (!creep.memory.delivering && creep.store.getFreeCapacity() === 0) {
        creep.memory.delivering = true;
        delete creep.memory.deliveryTarget;
        creep.say("📦 full");
        console.log(`[MineralExtractor] ${creep.name} - Switching to delivery mode`);
      }

      // Perform appropriate action
      if (creep.memory.delivering) {
        deliverMinerals(creep);
      } else {
        mineMineral(creep);
      }
    },
  };
};

module.exports = roleMineralExtractor();
