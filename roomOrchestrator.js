const CONFIG = require("./config");
const utils = require("./utils");
const spawner = require("./spawner");
const planner = require("./planner");
const stats = require("./stats");
const flagManager = require("./flagManager");
const errorTracker = require("./errorTracker");
const roleHarvester = require("./role.harvester");
const roleUpgrader = require("./role.upgrader");
const roleBuilder = require("./role.builder");
const baseCreep = require("./baseCreep");
const roleClaimer = require("./role.claimer");
const roleTransporter = require("./role.transporter");
const roleMiner = require("./role.miner");
const roleHauler = require("./role.hauler");
const roleFighter = require("./role.fighter"); // Kept for backwards compatibility (becomes invader)
const roleFighterFodder = require("./role.fighterFodder");
const roleFighterInvader = require("./role.fighterInvader");
const roleFighterHealer = require("./role.fighterHealer");
const roleFighterShooter = require("./role.fighterShooter");
const roleExplorer = require("./role.explorer");
const roleMineralExtractor = require("./role.mineralExtractor");
const roleChemist = require("./role.chemist");
const roleDefender = require("./role.defender");
const { getUpgraderWorkPartCount } = require("./spawnerRoster");

// ============================================================================
// Room Mode Management
// ============================================================================

/**
 * Initialize room mode in memory if not exists
 * @param {Room} room - The room to initialize
 * @returns {string} Current room mode
 */
const initializeRoomMode = (room) => {
  if (!Memory.rooms) {
    Memory.rooms = {};
  }
  if (!Memory.rooms[room.name]) {
    Memory.rooms[room.name] = {};
  }
  if (!Memory.rooms[room.name].mode) {
    Memory.rooms[room.name].mode = "planning";
    console.log(`Room ${room.name} initialized with mode: planning`);
  }
  return Memory.rooms[room.name].mode;
};

/**
 * Get current room mode
 * @param {string} roomName - Room name
 * @returns {string} Room mode ("planning" or "executing")
 */
const getRoomMode = (roomName) =>
  (Memory.rooms && Memory.rooms[roomName] && Memory.rooms[roomName].mode) || "planning";

// ============================================================================
// Room Status Calculation
// ============================================================================


/**
 * Calculate controller level for a room
 * Pure function
 * @param {Room} room - The room
 * @returns {number} Controller level (0 if no controller)
 */
const getControllerLevel = (room) =>
  room.controller ? room.controller.level : 0;

/**
 * Calculate comprehensive room status
 * Pure function - gathers room state without modifications
 * Uses room cache to avoid redundant find() calls
 * @param {Room} room - The room to analyze
 * @returns {Object} Room status object
 */
const getRoomStatus = (room) => {
  // Use cached structures and construction sites
  const cache = global.roomCache[room.name];
  const structures = cache ? cache.allStructures : room.find(FIND_STRUCTURES);
  const constructionSites = cache ? cache.constructionSites : room.find(FIND_CONSTRUCTION_SITES);
  
  const controllerLevel = getControllerLevel(room);

  // Count planned extensions from flags
  const extensionPlanned = flagManager.getPlannerFlags(room)
    .filter(item => item.structureCode === 'EXT')
    .length;

  const { roomPlanner } = planner;
  roomPlanner.clearPlannerFlags(room);
  // console.log(`[STATUS] Cleared planner flags for room ${room.name}. Found ${extensionPlanned} planned extensions from flags.`);
  // Count extension construction sites
  const extensionSites = constructionSites.filter(
    (s) => s.structureType === STRUCTURE_EXTENSION
  ).length;

  // Count built extensions
  const extensionBuilt = structures.filter(
    (s) => s.structureType === STRUCTURE_EXTENSION
  ).length;

  // Count creeps by role
  const creeps = spawner.countCreepsByRole(Game.creeps, room.name);

  // Check for storage
  const storage = cache ? cache.storage : structures.find((s) => s.structureType === STRUCTURE_STORAGE);
  const hasStorage = !!storage;

  // Check for containers at 50%+ capacity
  const containersHalfFull = structures.filter(
    (s) =>
      s.structureType === STRUCTURE_CONTAINER &&
      s.store[RESOURCE_ENERGY] >= s.store.getCapacity(RESOURCE_ENERGY) * 0.5
  );

  return {
    roomName: room.name,
    controllerLevel,
    extensionBuilt,
    extensionPlanned,
    extensionSites,
    creeps,
    energyAvailable: room.energyAvailable,
    energyCapacity: room.energyCapacityAvailable,
    constructionSiteCount: constructionSites.length,
    hasStorage,
    containersHalfFullCount: containersHalfFull.length,
  };
};

// ============================================================================
// Roster Management
// ============================================================================

/**
 * Get the number of energy sources in a room
 * @param {string} roomName - Room name
 * @returns {number} Number of sources (typically 1-2)
 */
const getSourceCount = (roomName) => {
  const room = Game.rooms[roomName];
  if (!room) return 2; // Default assumption
  return room.find(FIND_SOURCES).length;
};

/**
 * Calculate roster based on room status and RCL
 * Maintains minimum creeps (2 harvesters, 1 builder, 1 upgrader) at all levels
 * Scales specialized roles (miners, haulers, etc.) based on RCL progression
 * 
 * @param {Object} roomStatus - Current room status
 * @param {Object} efficiencyMetrics - Energy collection efficiency metrics
 * @returns {Object} Roster object {role: count}
 */
const calculateRoster = (roomStatus, efficiencyMetrics = null) => {
  const rcl = roomStatus.controllerLevel;
  const sourceCount = getSourceCount(roomStatus.roomName);
  
  utils.periodicLogger(`Efficiency metrics for room ${roomStatus.roomName}: ${JSON.stringify(efficiencyMetrics)}`, 20);
  // Base roster - minimum creeps always maintained
  const roster = {
    harvester: 2,  // Always keep 2 harvesters as backup
    builder: 1,
    upgrader: 1
  };
  
  // Scale builders based on construction sites
  if (roomStatus.constructionSiteCount > CONFIG.ROSTERS.SCALING.CONSTRUCTION_SITES_PER_BUILDER) {
    roster.builder = Math.min(CONFIG.ROSTERS.SCALING.MAX_BUILDERS, 1 + Math.floor(roomStatus.constructionSiteCount / CONFIG.ROSTERS.SCALING.CONSTRUCTION_SITES_PER_BUILDER));
  }
  
  // RCL 1-3: Early game - generalist harvesters only
  if (rcl <= 3) {
    // Adjust based on efficiency tier if available
    if (efficiencyMetrics && efficiencyMetrics.efficiencyTier === 'established') {
      roster.upgrader = CONFIG.ROSTERS.RCL_1_3.UPGRADERS_ESTABLISHED;
    }
    return roster;
  }
  
  // RCL 4-5: Mid-early game - introduce miners and haulers
  if (rcl <= 5) {
    roster.miner = sourceCount;           // 1 miner per source
    roster.hauler = sourceCount + CONFIG.ROSTERS.RCL_4_5.HAULER_OFFSET;      // 1 extra hauler for flexibility
    roster.builder = Math.max(roster.builder, CONFIG.ROSTERS.RCL_4_5.BUILDERS);
    roster.upgrader = CONFIG.ROSTERS.RCL_4_5.UPGRADERS;
    return roster;
  }
  
  // RCL 6-7: Mid-late game - add specialized roles
  if (rcl <= 7) {
    roster.miner = sourceCount;
    roster.hauler = sourceCount + CONFIG.ROSTERS.RCL_6_7.HAULER_OFFSET;      // More haulers for longer distances
    roster.builder = Math.max(roster.builder, CONFIG.ROSTERS.RCL_6_7.BUILDERS);
    roster.upgrader = CONFIG.ROSTERS.RCL_6_7.UPGRADERS;
    // TODO - Optimize later
    // roster.mineralExtractor = CONFIG.ROSTERS.RCL_6_7.MINERAL_EXTRACTORS;          // Mine minerals
    // roster.chemist = CONFIG.ROSTERS.RCL_6_7.CHEMISTS;                   // Lab logistics

    // Apply RCL-based roster scaling (RCL 6: 0.8x, RCL 7: 0.6x)
    const scalingMultiplier = CONFIG.SPAWNING.ROSTER_SCALING[rcl];
    if (scalingMultiplier) {
      const scalableRoles = ['hauler', 'builder', 'upgrader'];
      for (const role of scalableRoles) {
        if (roster[role] !== undefined) {
          roster[role] = Math.max(1, Math.ceil(roster[role] * scalingMultiplier));
        }
      }
    }
    return roster;
  }
  
  // RCL 8: Late game - maximum efficiency
  roster.miner = sourceCount;
  roster.hauler = sourceCount + CONFIG.ROSTERS.RCL_8.HAULER_OFFSET;        // Large hauler fleet
  roster.builder = Math.max(roster.builder, CONFIG.ROSTERS.RCL_8.BUILDERS);
  roster.upgrader = CONFIG.ROSTERS.RCL_8.UPGRADERS;
  roster.mineralExtractor = CONFIG.ROSTERS.RCL_8.MINERAL_EXTRACTORS;
  roster.chemist = CONFIG.ROSTERS.RCL_8.CHEMISTS;

  // Apply RCL-based roster scaling to reduce creep count (compensated by larger bodies)
  // Exempt harvesters and miners — they are source-bound roles
  const scalingMultiplier = CONFIG.SPAWNING.ROSTER_SCALING[rcl];
  if (scalingMultiplier) {
    const scalableRoles = ['hauler', 'builder', 'upgrader', 'mineralExtractor', 'chemist'];
    for (const role of scalableRoles) {
      if (roster[role] !== undefined) {
        roster[role] = Math.max(1, Math.ceil(roster[role] * scalingMultiplier));
      }
    }
  }

  // RCL 8 upgrade cap: controller accepts max 15 energy/tick; cap upgrader count accordingly
  if (rcl >= 8) {
    const currentWorkParts = getUpgraderWorkPartCount(roomStatus.roomName);
    const cap = CONFIG.SPAWNING.UPGRADER_CAP_WORK_PARTS;
    if (currentWorkParts >= cap) {
      // Already at or over cap — maintain current count but don't grow
      const currentUpgraderCount = Object.values(Game.creeps).filter(
        c => c.memory.spawnRoom === roomStatus.roomName && c.memory.role === 'upgrader'
      ).length;
      roster.upgrader = Math.min(roster.upgrader, currentUpgraderCount);
    }
  }

  console.log(`[ROSTER] Calculated roster for room ${roomStatus.roomName} at RCL ${rcl}:`, roster);
  return roster;
};

// ============================================================================
// Tower Handling
// ============================================================================

/**
 * Handle all towers in the room
 * Effectful function - makes towers attack enemies, heal creeps, and repair structures
 * Uses room cache to avoid redundant find() calls
 * @param {Room} room - The room containing towers
 */
const handleTowers = (room) => {
  // Use cached tower list
  const cache = global.roomCache[room.name];
  if (!cache || !cache.towers || cache.towers.length === 0) {
    return;
  }
  
  // Scan room once for all towers (cached from main.js)
  const hostileCreeps = cache.hostileCreeps;
  const damagedCreeps = cache.myCreeps.filter(creep => creep.hits < creep.hitsMax);
  const damagedStructures = cache.allStructures.filter(structure => {
    const healthPercent = structure.hits / structure.hitsMax;
    return healthPercent < CONFIG.ROSTERS.TOWER.REPAIR_THRESHOLD &&
           structure.structureType !== STRUCTURE_WALL &&
           structure.structureType !== STRUCTURE_RAMPART;
  });

  cache.towers.forEach((tower) => {
    // Priority 1: Attack hostile creeps
    if (hostileCreeps.length > 0) {
      const target = tower.pos.findClosestByRange(hostileCreeps);
      if (target) {
        console.log(`Tower in room ${room.name} attacking hostile creep ${target.name}`);
        const result = tower.attack(target);
        if (result === OK) {
          stats.recordTowerAction(room.name, 'attack');
        }
        return;
      }
    }

    // Priority 2: Heal friendly creeps
    if (damagedCreeps.length > 0) {
      const target = tower.pos.findClosestByRange(damagedCreeps);
      if (target) {
        const result = tower.heal(target);
        if (result === OK) {
          stats.recordTowerAction(room.name, 'heal');
        }
        return;
      }
    }

    // Priority 3: Repair structures
    if (damagedStructures.length > 0) {
      // Repair the most damaged structure (by percentage)
      const target = damagedStructures.reduce((min, structure) => {
        const structurePercent = structure.hits / structure.hitsMax;
        const minPercent = min.hits / min.hitsMax;
        return structurePercent < minPercent ? structure : min;
      });
      
      if (target) {
        const result = tower.repair(target);
        if (result === OK) {
          stats.recordTowerAction(room.name, 'repair');
        }
      }
    }
  });
};

// ============================================================================
// Creep Handling
// ============================================================================

/**
 * Route creep to its role handler
 * @param {Creep} creep - The creep to handle
 */
const getCreepRoleHandler = (creep) => {
  const role = creep.memory.role;
  
  // Special handling for fighters - route by class
  if (role === 'fighter') {
    const fighterClass = creep.memory.fighterClass;
    switch (fighterClass) {
      case 'fodder':
        return roleFighterFodder.run;
      case 'invader':
        return roleFighterInvader.run;
      case 'healer':
        return roleFighterHealer.run;
      case 'shooter':
        return roleFighterShooter.run;
      default:
        // Fallback to standard fighter (for old fighters or default)
        return roleFighterInvader.run;
    }
  }
  
  // Standard role handlers
  const roleHandlers = {
    harvester: roleHarvester.run,
    upgrader: roleUpgrader.run,
    builder: roleBuilder.run,
    claimer: roleClaimer.run,
    transporter: roleTransporter.run,
    miner: roleMiner.run,
    hauler: roleHauler.run,
    fighter: roleFighterInvader.run, // Fallback (shouldn't reach here)
    defender: roleDefender.run,
    explorer: roleExplorer.run,
    mineralExtractor: roleMineralExtractor.run,
    chemist: roleChemist.run,
  };
  
  return roleHandlers[role];
};

/**
 * Handle all creeps in the room
 * Effectful function
 * @param {Room} room - The room (currently unused, handles all creeps)
 */
const handleCreeps = (room) => {
  // Note: Attack flag coordination is now handled automatically via creep role files
  // and target finding functions (findPrioritizedAttackTarget, findRangedAttackTarget, findHealTarget)
  // which detect attack/attack_X flags and route fighters appropriately

  // Logic for rebalancing workers tasks

  Object.values(Game.creeps).forEach((creep) => {
    // All fighters now follow normal role handling (flag detection is automatic)
    const isFighterCreep = baseCreep.isFighter(creep);


    try {
      const handler = getCreepRoleHandler(creep);
      if (handler) {
        handler(creep);
      } else {
        console.log(
          `No role function found for creep ${creep.name} with role ${creep.memory.role}`
        );
      }
    } catch (error) {
      errorTracker.logError(error, {
        module: 'roomOrchestrator',
        function: 'handleCreeps',
        room: creep.room.name,
        creep: creep.name,
        role: creep.memory.role
      }, 'ERROR');
      // Clear creep action to prevent stuck state
      if (creep.memory.action) {
        creep.memory.action = null;
      }
    }
  });
};

// ============================================================================
// Planning Mode Handlers
// ============================================================================

/**
 * Handle room in planning mode
 * Visualizes planned layout without taking actions
 * @param {Room} room - The room
 * @param {Object} roomStatus - Current room status
 */
const handlePlanningMode = (room, roomStatus) => {
  console.log(
    `[PLANNING] Room ${room.name} is in PLANNING mode. ` +
    `Set Memory.rooms['${room.name}'].mode = 'executing' to start operations.`
  );

  try {
    // Get or create the plan
    const { roomPlanner } = planner;
    const plannedStructures = roomPlanner.getPlannedStructures(room);
    const lastPlannedRCL = Memory.rooms[room.name].lastPlannedRCL || 0;
    const currentRCL = roomStatus.controllerLevel;

    if (plannedStructures.length === 0 || currentRCL > lastPlannedRCL) {
      // Create or update plan for current RCL
      const action = plannedStructures.length === 0 ? "Creating" : "Updating";
      console.log(`[PLANNING] ${action} base layout plan for room ${room.name} at RCL ${currentRCL}...`);
      roomPlanner.planBaseLayout(room, {
        clearExisting: false,
        visualize: true,
        currentControllerLevel: currentRCL,
      });
      Memory.rooms[room.name].lastPlannedRCL = currentRCL;
    } else {
      // Visualize existing plan
      const center = roomPlanner.findOptimalCenter(room);
      if (center) {
        roomPlanner.visualizePlan(room, plannedStructures, center);
      }
    }

    // Show RCL-appropriate structures count
    const rclStructures = plannedStructures.filter(
      (s) => s.stage <= roomStatus.controllerLevel
    );
    console.log(
      `[PLANNING] Planned structures: ${plannedStructures.length} total, ` +
      `${rclStructures.length} available at RCL ${roomStatus.controllerLevel}`
    );
  } catch (error) {
    errorTracker.logError(error, {
      module: 'roomOrchestrator',
      function: 'handlePlanningMode',
      room: room.name
    }, 'ERROR');
    console.log(`[PLANNING] Error during planning for room ${room.name} - see error log`);
  }
};

/**
 * Handle room in executing mode
 * Normal game loop with spawning and creep actions
 * @param {Room} room - The room
 * @param {Object} roomStatus - Current room status
 */
const handleExecutingMode = (room, roomStatus) => {
  // Get efficiency metrics from stats for adaptive spawning
  const efficiencyMetrics = stats.getCollectionMetrics(room.name);
  
  // Manage energy fill priority mode based on timeToFillCapacity
  if (!Memory.rooms[room.name]) {
    Memory.rooms[room.name] = {};
  }
  
  if (efficiencyMetrics && efficiencyMetrics.timeToFillCapacity !== undefined) {
    const threshold = CONFIG.ENERGY.PRIORITY_MODE.CRITICAL_TIME_TO_FILL_CAPACITY;
    const currentMode = Memory.rooms[room.name].energyPriorityMode || false;
    
    if (efficiencyMetrics.timeToFillCapacity > threshold && !currentMode) {
      Memory.rooms[room.name].energyPriorityMode = true;
      console.log(
        `⚡ ENERGY PRIORITY MODE ACTIVATED for ${room.name} - ` +
        `timeToFillCapacity: ${efficiencyMetrics.timeToFillCapacity.toFixed(0)} > ${threshold} ticks`
      );
    } else if (efficiencyMetrics.timeToFillCapacity <= threshold && currentMode) {
      Memory.rooms[room.name].energyPriorityMode = false;
      console.log(
        `✓ Energy priority mode deactivated for ${room.name} - ` +
        `timeToFillCapacity: ${efficiencyMetrics.timeToFillCapacity.toFixed(0)} <= ${threshold} ticks`
      );
    }
  }
  
  // Log if room is in energy priority mode
  const energyPriorityMode = Memory.rooms[room.name].energyPriorityMode;
  if (energyPriorityMode && efficiencyMetrics) {
    utils.periodicLogger(
      `⚡ PRIORITY MODE ACTIVE in ${room.name} - ` +
      `timeToFillCapacity: ${efficiencyMetrics.timeToFillCapacity.toFixed(0)} ticks - ` +
      `Builders & Upgraders acting as Harvesters`,
      5
    );
  }
  
  // Calculate roster based on room status and efficiency
  const roster = calculateRoster(roomStatus, efficiencyMetrics);
  utils.periodicLogger(`Roster ${room.name} status: ${JSON.stringify(roster)}`, 20);

  // Get spawn and execute spawn procedure
  const spawn = room.find(FIND_MY_SPAWNS)[0];
  if (spawn) {
    spawner.spawnProcedure(spawn, roster, roomStatus, efficiencyMetrics);
  }

  // Update plan when controller level increases
  const { roomPlanner } = planner;
  const lastPlannedRCL = Memory.rooms[room.name].lastPlannedRCL || 0;
  const currentRCL = roomStatus.controllerLevel;

  if (currentRCL > lastPlannedRCL) {
    console.log(
      `[EXECUTING] RCL increased from ${lastPlannedRCL} to ${currentRCL}. ` +
      `Updating build plan for room ${room.name}...`
    );
    roomPlanner.planBaseLayout(room, {
      clearExisting: false,
      visualize: false,
      currentControllerLevel: currentRCL,
    });
    Memory.rooms[room.name].lastPlannedRCL = currentRCL;
  }

  // Execute build plan from planner flags
  roomPlanner.executeBuildPlan(room);

  // Plan ramparts around critical structures
  const spawnPosition = spawn ? spawn.pos : undefined;
  if (spawnPosition) {
    planCriticalStructureRamparts(room.name, spawnPosition, 3, false);
    placeRampantsConstructionSites(room.name);
  }

  // Handle towers
  handleTowers(room);

  // Handle creeps
  handleCreeps(room);
};

// ============================================================================
// Main Orchestrator
// ============================================================================

/**
 * Main room orchestration function
 * Manages room mode and delegates to appropriate handler
 * @param {Room} room - The room to orchestrate
 */
const orchestrateRoom = (room) => {
  // Initialize mode if needed
  const mode = initializeRoomMode(room);

  // Calculate room status
  const roomStatus = getRoomStatus(room);

  // Log status periodically
  utils.periodicLogger(`Room ${room.name} status: ${JSON.stringify(roomStatus)}`, 20);

  // Delegate based on mode
  if (mode === "planning") {
    handlePlanningMode(room, roomStatus);
  } else if (mode === "executing") {
    handleExecutingMode(room, roomStatus);
  } else {
    console.log(`Unknown room mode: ${mode}. Defaulting to planning.`);
    Memory.rooms[room.name].mode = "planning";
    handlePlanningMode(room, roomStatus);
  }
};

// ============================================================================
// Rampart Planning (existing functionality)
// ============================================================================

function placeRampantsConstructionSites(roomName) {
  const room = Game.rooms[roomName];
  const flags = room.find(FIND_FLAGS, {
    filter: (flag) => flag.name.startsWith("rampart_"),
  });

  flags.forEach((flag) => {
    const result = room.createConstructionSite(
      flag.pos.x,
      flag.pos.y,
      STRUCTURE_RAMPART,
    );
    if (result === OK) {
      flag.remove();
    }
  });
}

function planCriticalStructureRamparts(
  roomName,
  position,
  distance = 3,
  visualize = true,
) {
  const room = Game.rooms[roomName];
  if (!position) {
    return [];
  }

  const terrain = room.getTerrain();
  const rampartPositions = [];

  // Get all positions at given distance from position
  for (let dx = -distance; dx <= distance; dx++) {
    for (let dy = -distance; dy <= distance; dy++) {
      // Only get perimeter (not interior)
      if (Math.abs(dx) === distance || Math.abs(dy) === distance) {
        const x = position.x + dx;
        const y = position.y + dy;

        // Check bounds
        if (x > 0 && x < 49 && y > 0 && y < 49) {
          // Check if terrain allows building (not a wall)
          const structures = room.lookForAt(LOOK_STRUCTURES, x, y);
          const flags = room.lookForAt(LOOK_FLAGS, x, y);
          const constructionSites = room.lookForAt(
            LOOK_CONSTRUCTION_SITES,
            x,
            y,
          );

          // Filter out roads from structures (roads are allowed)
          const nonRoadStructures = structures.filter(
            (s) => s.structureType !== STRUCTURE_ROAD,
          );

          if (
            terrain.get(x, y) !== TERRAIN_MASK_WALL &&
            flags.length === 0 &&
            constructionSites.length === 0 &&
            nonRoadStructures.length === 0
          ) {
            rampartPositions.push({ x, y });

            if (visualize) {
              // Draw a green overlay to visualize
              room.visual.rect(x - 0.5, y - 0.5, 1, 1, {
                fill: "green",
                opacity: 0.3,
              });
            } else {
              // Place a flag
              room.createFlag(x, y, `rampart_${x}_${y}`, COLOR_GREEN);
            }
          }
        }
      }
    }
  }

  return rampartPositions;
}

module.exports = {
  // Main orchestrator
  orchestrateRoom,

  // Mode management
  initializeRoomMode,
  getRoomMode,

  // Status
  getRoomStatus,
  getControllerLevel,

  // Roster
  calculateRoster,

  // Towers
  handleTowers,

  // Creeps
  handleCreeps,

  // Rampart planning (legacy)
  planCriticalStructureRamparts,
  placeRampantsConstructionSites,
};
