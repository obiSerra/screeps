/**
 * Main Entry Point
 * Thin orchestration layer - delegates all logic to specialized modules
 */

const roomOrchestrator = require("roomOrchestrator");
const linkManager = require("./linkManager");
const labManager = require("./labManager");
const terminalManager = require("./terminalManager");
const stats = require("./stats");
const spawner = require("./spawner");

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
        stats.updateEnergyCollection(room.name);
        
        // Run room orchestration (spawning and creep management)
        roomOrchestrator.orchestrateRoom(room);

        // Run infrastructure managers (RCL 5+)
        const rcl = room.controller ? room.controller.level : 0;

        // Link network management (RCL 5+)
        if (rcl >= 5) {
          linkManager.manageLinkNetwork(room);
        }

        // Lab system management (RCL 6+)
        if (rcl >= 6) {
          labManager.manageLabsystem(room);
        }

        // Terminal trading management (RCL 6+)
        if (rcl >= 6) {
          terminalManager.manageTerminal(room);
        }
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

/**
 * Display spawn metrics and efficiency information
 * Usage: spawnMetrics('W1N1')
 */
global.spawnMetrics = function(roomName) {
  if (!roomName) {
    // Report for all owned rooms
    const ownedRooms = Object.values(Game.rooms)
      .filter(room => room.controller && room.controller.my)
      .map(room => room.name);
    
    if (ownedRooms.length === 0) {
      console.log('No owned rooms found');
      return;
    }
    
    ownedRooms.forEach(name => {
      const metrics = stats.getCollectionMetrics(name);
      const room = Game.rooms[name];
      const rcl = room && room.controller ? room.controller.level : 0;
      
      console.log(`\n═══════════════════════════════════════════`);
      console.log(`  SPAWN METRICS - ${name}`);
      console.log(`  RCL: ${rcl}`);
      console.log(`═══════════════════════════════════════════`);
      console.log(`⚡ EFFICIENCY:`);
      console.log(`  • Tier: ${metrics.efficiencyTier.toUpperCase()}`);
      console.log(`  • Collection Rate: ${metrics.energyCollectionRate.toFixed(2)} energy/tick`);
      console.log(`  • Time to Fill: ${metrics.timeToFillCapacity.toFixed(0)} ticks`);
      console.log(`  • Spawn Threshold: ${(metrics.spawnThreshold * 100).toFixed(0)}%`);
      
      const currentCreeps = spawner.countCreepsByRole(Game.creeps);
      console.log(`\n👥 CURRENT CREEPS:`);
      Object.keys(currentCreeps).forEach(role => {
        console.log(`  • ${role}: ${currentCreeps[role]}`);
      });
      console.log(`═══════════════════════════════════════════\n`);
    });
  } else {
    const metrics = stats.getCollectionMetrics(roomName);
    const room = Game.rooms[roomName];
    const rcl = room && room.controller ? room.controller.level : 0;
    
    console.log(`\n═══════════════════════════════════════════`);
    console.log(`  SPAWN METRICS - ${roomName}`);
    console.log(`  RCL: ${rcl}`);
    console.log(`═══════════════════════════════════════════`);
    console.log(`⚡ EFFICIENCY:`);
    console.log(`  • Tier: ${metrics.efficiencyTier.toUpperCase()}`);
    console.log(`  • Collection Rate: ${metrics.energyCollectionRate.toFixed(2)} energy/tick`);
    console.log(`  • Time to Fill: ${metrics.timeToFillCapacity.toFixed(0)} ticks`);
    console.log(`  • Spawn Threshold: ${(metrics.spawnThreshold * 100).toFixed(0)}%`);
    
    const currentCreeps = spawner.countCreepsByRole(Game.creeps);
    console.log(`\n👥 CURRENT CREEPS:`);
    Object.keys(currentCreeps).forEach(role => {
      console.log(`  • ${role}: ${currentCreeps[role]}`);
    });
    console.log(`═══════════════════════════════════════════\n`);
  }
};
