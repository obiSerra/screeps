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
    creep.say("❌ lost mineral");
    delete creep.memory.assignedMineral;
    return ERR_NOT_FOUND;
  }

  // Check if mineral is depleted
  if (mineral.mineralAmount === 0) {
    creep.say("⏳ depleted");
    return ERR_NOT_ENOUGH_RESOURCES;
  }

  // Check if extractor exists
  if (!hasExtractor(mineral)) {
    creep.say("❌ no extractor");
    return ERR_INVALID_TARGET;
  }

  // Move to mineral if not in range
  if (!creep.pos.isEqualTo(mineral.pos)) {
    creep.moveTo(mineral.pos, {
      visualizePathStyle: { stroke: "#ffaa00" },
      reusePath: 50,
    });
    return ERR_NOT_IN_RANGE;
  }

  // Mine mineral
  const result = creep.harvest(mineral);
  
  if (result === OK) {
    creep.say(`⛏️ ${mineral.mineralType}`);
  } else if (result === ERR_NOT_ENOUGH_RESOURCES) {
    creep.say("⏳ cooldown");
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
