/**
 * Main Entry Point
 * Thin orchestration layer - delegates all logic to specialized modules
 */

const roomOrchestrator = require("roomOrchestrator");
const stats = require("./stats");

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
      // Track creep death before deleting memory
      const creepMemory = Memory.creeps[name];
      if (creepMemory.role && creepMemory.spawnRoom) {
        const ticksLived = Game.time - (creepMemory.spawnTick || 0);
        stats.recordCreepDeath(creepMemory.spawnRoom, name, creepMemory.role, ticksLived);
      }
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
    if (!room || !room.controller || !room.controller.my) {
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
    .filter((room) => room.controller && room.controller.my)
    .forEach((room) => {
      try {
        // Update system and creep statistics
        stats.updateSystemStats(room.name);
        stats.updateCreepStats(room.name);
        
        // Run room orchestration
        roomOrchestrator.orchestrateRoom(room);
      } catch (error) {
        console.log(`Error in room ${room.name}: ${error.message}`);
        console.log(error.stack);
      }
    });
};

// ============================================================================
// Global Console Functions
// ============================================================================

/**
 * Display statistics report for a room
 * Usage: statsReport('W1N1')
 */
global.statsReport = function(roomName) {
  if (!roomName) {
    // Report for all owned rooms
    const ownedRooms = Object.values(Game.rooms)
      .filter(room => room.controller && room.controller.my)
      .map(room => room.name);
    
    if (ownedRooms.length === 0) {
      console.log('No owned rooms found');
      return;
    }
    
    ownedRooms.forEach(name => stats.report(name));
  } else {
    stats.report(roomName);
  }
};

/**
 * Display trend report for a room
 * Usage: statsTrends('W1N1')
 */
global.statsTrends = function(roomName) {
  if (!roomName) {
    // Report for all owned rooms
    const ownedRooms = Object.values(Game.rooms)
      .filter(room => room.controller && room.controller.my)
      .map(room => room.name);
    
    if (ownedRooms.length === 0) {
      console.log('No owned rooms found');
      return;
    }
    
    ownedRooms.forEach(name => stats.reportTrends(name));
  } else {
    stats.reportTrends(roomName);
  }
};

/**
 * Export statistics data as JSON
 * Usage: statsExport('W1N1')
 */
global.statsExport = function(roomName) {
  if (!roomName) {
    console.log('Please specify a room name: statsExport("W1N1")');
    return;
  }
  const data = stats.exportData(roomName);
  if (data) {
    console.log(data);
  } else {
    console.log(`No statistics available for room ${roomName}`);
  }
};
