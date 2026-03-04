/**
 * Main Entry Point
 * Thin orchestration layer - delegates all logic to specialized modules
 */

const roomOrchestrator = require("roomOrchestrator");

// ============================================================================
// Memory Management
// ============================================================================

/**
 * Clear memory for dead creeps
 * Prevents memory bloat from accumulated dead creep data
 */
const clearCreepsMemory = () => {
  for (const name in Memory.creeps) {
    if (!Game.creeps[name]) {
      delete Memory.creeps[name];
    }
  }
};

/**
 * Clear stale room memory for rooms we no longer own
 */
const clearStaleRoomMemory = () => {
  if (!Memory.rooms) return;

  for (const roomName in Memory.rooms) {
    const room = Game.rooms[roomName];
    // Remove memory for rooms we don't have vision of or don't own
    if (!room || !room.controller?.my) {
      // Keep planning data for rooms we might reclaim
      // Only delete if we haven't seen the room in a while
      if (!Game.rooms[roomName]) {
        // Could add timestamp-based cleanup here
        // For now, keep room data to preserve plans
      }
    }
  }
};

// ============================================================================
// Main Game Loop
// ============================================================================

module.exports.loop = function () {
  // Garbage collection
  clearCreepsMemory();
  clearStaleRoomMemory();

  // Process each owned room
  Object.values(Game.rooms)
    .filter((room) => room.controller?.my)
    .forEach((room) => {
      try {
        roomOrchestrator.orchestrateRoom(room);
      } catch (error) {
        console.log(`Error in room ${room.name}: ${error.message}`);
        console.log(error.stack);
      }
    });
};
