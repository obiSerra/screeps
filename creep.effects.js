/**
 * Creep Effects Module
 * Effectful functions that modify creep state and game world
 */

const utils = require("./utils");
const { isFighter } = require("./creep.analysis");
const { ACTION_ICONS, PATH_COLORS } = require("./creep.constants");

// ============================================================================
// Effectful Functions - Game State Modifications
// ============================================================================

/**
 * Display action icon above creep
 * Effectful function
 * @param {Creep} creep
 * @param {string} action
 */
const sayAction = (creep, action) => {
  const icon = ACTION_ICONS[action] || "";
  
  // Check if creep is working remotely (target in different room)
  const target = creep.memory.actionTarget;
  const isRemote = target && target.pos && target.pos.roomName !== creep.room.name;
  
  // Add remote indicator (🌍) for cross-room operations
  const remoteIndicator = isRemote ? "🌍" : "";
  
  creep.say(`${remoteIndicator}${icon} ${action}`);
};

/**
 * Move creep towards target with path visualization
 * Effectful function
 * @param {Creep} creep
 * @param {RoomObject} target
 * @param {string} color - Path stroke color
 */
const moveToTarget = (creep, target, color = "#ffffff") => {
  const options = { visualizePathStyle: { stroke: color } };

  // Non-fighters avoid enemy creeps (use room cache to avoid redundant find() calls)
  if (!isFighter(creep) && utils.areThereInvaders(creep.room)) {
    const cache = global.roomCache && global.roomCache[creep.room.name];
    const hostiles = cache ? cache.hostileCreeps : creep.room.find(FIND_HOSTILE_CREEPS);

    options.avoid = hostiles;

    // If there are hostiles, increase the cost of moving near them
    options.costCallback = function(roomName, costMatrix) {
      const cbCache = global.roomCache && global.roomCache[roomName];
      const cbHostiles = cbCache ? cbCache.hostileCreeps : (Game.rooms[roomName] ? Game.rooms[roomName].find(FIND_HOSTILE_CREEPS) : []);
      cbHostiles.forEach((hostile) => {
        // Mark tiles around hostile as high cost (avoid within 3 tiles)
        for (let dx = -3; dx <= 3; dx++) {
          for (let dy = -3; dy <= 3; dy++) {
            const x = hostile.pos.x + dx;
            const y = hostile.pos.y + dy;
            if (x >= 0 && x < 50 && y >= 0 && y < 50) {
              costMatrix.set(x, y, 10);
            }
          }
        }
      });
      return costMatrix;
    };
  }

  creep.moveTo(target, options);
};

/**
 * Update creep memory with action and target
 * Effectful function
 * @param {Creep} creep
 * @param {string} action
 * @param {Object|null} target
 */
const setCreepAction = (creep, action, target = null) => {
  creep.memory.action = action;
  if (target) {
    creep.memory.actionTarget = target;
  } else {
    delete creep.memory.actionTarget;
  }
};

/**
 * Clear creep action state
 * Effectful function
 * @param {Creep} creep
 */
const clearCreepAction = (creep) => {
  creep.memory.action = undefined;
  delete creep.memory.actionTarget;
};

// ============================================================================
// Exports
// ============================================================================

module.exports = {
  sayAction,
  moveToTarget,
  setCreepAction,
  clearCreepAction,
};
