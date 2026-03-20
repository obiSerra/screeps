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
 * @param {Creep} creep - The creep
 * @returns {Mineral|null} The mineral or null
 */
const findRoomMineral = (creep) => {
  const room = Game.rooms[creep.memory.assignedRoom || creep.room.name];
  if (!room) return null;

  const minerals = room.find(FIND_MINERALS);
  return minerals.length > 0 ? minerals[0] : null;
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

  console.log(`[MineralExtractor] ${creep.name} - Mineral: ${mineral.mineralType}, Amount: ${mineral.mineralAmount}, Pos: ${mineral.pos}`);

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

  console.log(`[MineralExtractor] ${creep.name} - Extractor cooldown: ${extractor.cooldown}`);
  console.log(`[MineralExtractor] ${creep.name} - Creep pos: ${creep.pos}, Distance to mineral: ${creep.pos.getRangeTo(mineral)}`);
  console.log(`[MineralExtractor] ${creep.name} - Creep WORK parts: ${creep.getActiveBodyparts(WORK)}`);
  console.log(`[MineralExtractor] ${creep.name} - Creep carry: ${creep.store.getUsedCapacity()}/${creep.store.getCapacity()}`);

  // Move to mineral if not in range (need to be adjacent, not on top!)
  if (!creep.pos.inRangeTo(mineral, 1)) {
    console.log(`[MineralExtractor] ${creep.name} - Moving to mineral`);
    creep.moveTo(mineral.pos, {
      visualizePathStyle: { stroke: "#ffaa00" },
      reusePath: 50,
    });
    return ERR_NOT_IN_RANGE;
  }

  console.log(`[MineralExtractor] ${creep.name} - In range, attempting to harvest`);

  // Mine mineral
  const result = creep.harvest(mineral);
  
  console.log(`[MineralExtractor] ${creep.name} - Harvest result: ${result}`);
  
  if (result === OK) {
    creep.say(`⛏️ ${mineral.mineralType}`);
  } else if (result === ERR_NOT_ENOUGH_RESOURCES) {
    creep.say("⏳ cooldown");
  } else if (result === ERR_TIRED) {
    // Extractor is on cooldown
    creep.say(`⏳ ${extractor.cooldown}`);
    console.log(`[MineralExtractor] ${creep.name} - Extractor is on cooldown for ${extractor.cooldown} more ticks`);
  } else if (result === ERR_NO_BODYPART) {
    console.log(`[MineralExtractor] ${creep.name} - ERROR: No WORK body parts!`);
    creep.say("❌ no WORK");
  } else if (result === ERR_FULL) {
    console.log(`[MineralExtractor] ${creep.name} - Creep inventory is full`);
    creep.say("📦 full");
  } else {
    console.log(`[MineralExtractor] ${creep.name} - Harvest failed with error code: ${result}`);
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
      // Mineral extractors focus exclusively on mining minerals
      // They sit at the mineral and harvest until it's depleted
      mineMineral(creep);
    },
  };
};

module.exports = roleMineralExtractor();
