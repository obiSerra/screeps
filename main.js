/**
 * Main Entry Point
 * Thin orchestration layer - delegates all logic to specialized modules
 */

const CONFIG = require("./config");
const roomOrchestrator = require("roomOrchestrator");
const linkManager = require("./linkManager");
const labManager = require("./labManager");
const terminalManager = require("./terminalManager");
const stats = require("./stats");
const spawner = require("./spawner");
const errorTracker = require("./errorTracker");

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
          try {
            linkManager.manageLinkNetwork(room);
          } catch (error) {
            errorTracker.logError(error, {
              module: 'linkManager',
              function: 'manageLinkNetwork',
              room: room.name
            }, 'ERROR');
          }
        }

        // Lab system management (RCL 6+)
        if (rcl >= 6) {
          try {
            labManager.manageLabsystem(room);
          } catch (error) {
            errorTracker.logError(error, {
              module: 'labManager',
              function: 'manageLabsystem',
              room: room.name
            }, 'ERROR');
          }
        }

        // Terminal trading management (RCL 6+)
        if (rcl >= 6) {
          try {
            terminalManager.manageTerminal(room);
          } catch (error) {
            errorTracker.logError(error, {
              module: 'terminalManager',
              function: 'manageTerminal',
              room: room.name
            }, 'ERROR');
          }
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
      
      const currentCreeps = spawner.countCreepsByRole(Game.creeps, name);
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
    
    const currentCreeps = spawner.countCreepsByRole(Game.creeps, roomName);
    console.log(`\n👥 CURRENT CREEPS:`);
    Object.keys(currentCreeps).forEach(role => {
      console.log(`  • ${role}: ${currentCreeps[role]}`);
    });
    console.log(`═══════════════════════════════════════════\n`);
  }
};

/**
 * Display error tracking summary
 * Usage: errorSummary()
 */
global.errorSummary = function() {
  const summary = errorTracker.getSummary();
  
  console.log(`\n═══════════════════════════════════════════`);
  console.log(`  ERROR TRACKING SUMMARY`);
  console.log(`═══════════════════════════════════════════`);
  console.log(`📊 OVERVIEW:`);
  console.log(`  • Total Error Types: ${summary.totalErrorTypes}`);
  console.log(`  • Total Errors (All Time): ${summary.totalErrorsAllTime}`);
  console.log(`  • Errors (Last 100 Ticks): ${summary.errorsLast100Ticks}`);
  
  if (summary.mostRecentError) {
    const err = summary.mostRecentError;
    console.log(`\n⚠️ MOST RECENT ERROR:`);
    console.log(`  • Tick: ${err.tick} (${Game.time - err.tick} ticks ago)`);
    console.log(`  • Severity: ${err.severity}`);
    console.log(`  • Message: ${err.message}`);
    console.log(`  • Type: ${err.type}`);
  }
  
  if (summary.topErrorTypes.length > 0) {
    console.log(`\n🔝 TOP ERROR TYPES:`);
    summary.topErrorTypes.forEach((item, idx) => {
      console.log(`  ${idx + 1}. ${item.type}: ${item.count} errors`);
    });
  }
  
  console.log(`═══════════════════════════════════════════\n`);
};

/**
 * Display recent errors
 * Usage: errorRecent(5)
 */
global.errorRecent = function(count = 10) {
  const errors = errorTracker.getRecentErrors(count);
  
  if (errors.length === 0) {
    console.log('✅ No errors recorded');
    return;
  }
  
  console.log(`\n═══════════════════════════════════════════`);
  console.log(`  RECENT ERRORS (Last ${count})`);
  console.log(`═══════════════════════════════════════════`);
  
  errors.forEach((err, idx) => {
    const icon = err.severity === 'CRITICAL' ? '🔴' : 
                 err.severity === 'ERROR' ? '❌' : 
                 err.severity === 'WARNING' ? '⚠️' : 'ℹ️';
    console.log(`\n${idx + 1}. ${icon} [${err.severity}] Tick ${err.tick}`);
    console.log(`   Message: ${err.message}`);
    console.log(`   Type: ${err.type}`);
    if (err.context && Object.keys(err.context).length > 0) {
      const ctx = [];
      if (err.context.module) ctx.push(`module=${err.context.module}`);
      if (err.context.function) ctx.push(`fn=${err.context.function}`);
      if (err.context.room) ctx.push(`room=${err.context.room}`);
      if (err.context.creep) ctx.push(`creep=${err.context.creep}`);
      if (ctx.length > 0) {
        console.log(`   Context: ${ctx.join(', ')}`);
      }
    }
  });
  
  console.log(`═══════════════════════════════════════════\n`);
};

/**
 * Display detailed error statistics
 * Usage: errorStats()
 */
global.errorStats = function() {
  const stats = errorTracker.getStatistics();
  
  if (Object.keys(stats).length === 0) {
    console.log('✅ No error statistics available');
    return;
  }
  
  console.log(`\n═══════════════════════════════════════════`);
  console.log(`  ERROR STATISTICS`);
  console.log(`═══════════════════════════════════════════`);
  
  const sortedTypes = Object.entries(stats)
    .sort((a, b) => b[1].total - a[1].total);
  
  sortedTypes.forEach(([type, stat]) => {
    console.log(`\n📍 ${type}:`);
    console.log(`   Total: ${stat.total}`);
    console.log(`   First Seen: Tick ${stat.firstSeen}`);
    console.log(`   Last Seen: Tick ${stat.lastSeen} (${Game.time - stat.lastSeen} ticks ago)`);
    
    if (stat.bySeverity && Object.keys(stat.bySeverity).length > 0) {
      const severities = Object.entries(stat.bySeverity)
        .map(([sev, count]) => `${sev}:${count}`)
        .join(', ');
      console.log(`   By Severity: ${severities}`);
    }
  });
  
  console.log(`═══════════════════════════════════════════\n`);
};

/**
 * Clear all error tracking data
 * Usage: errorClear()
 */
global.errorClear = function() {
  errorTracker.clear();
};
