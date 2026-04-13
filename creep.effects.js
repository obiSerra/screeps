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

  // Determine if we need custom pathfinding costs
  const hasHostiles = !isFighter(creep) && utils.areThereInvaders(creep.room);
  const targetRoomName = target.pos ? target.pos.roomName : target.roomName;
  const isCrossRoom = targetRoomName && targetRoomName !== creep.room.name;
  const shouldAvoidEdges = !isCrossRoom;

  // Apply custom cost callback if needed (hostile avoidance or edge avoidance)
  if (hasHostiles || shouldAvoidEdges) {
    options.costCallback = function(roomName, costMatrix) {
      // Edge avoidance: avoid room edges when target is in same room
      if (shouldAvoidEdges && roomName === creep.room.name) {
        // Mark edge tiles (x/y = 0, 1, 48, 49) as moderate cost
        for (let x = 0; x < 50; x++) {
          for (let y = 0; y < 50; y++) {
            // Check if position is near edge (within 2 tiles of boundary)
            if (x <= 1 || x >= 48 || y <= 1 || y >= 48) {
              costMatrix.set(x, y, 5);
            }
          }
        }
      }

      // Hostile avoidance: avoid tiles near enemy creeps
      if (hasHostiles) {
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
      }

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
