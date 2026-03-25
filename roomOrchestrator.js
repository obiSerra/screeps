const utils = require("./utils");
const spawner = require("./spawner");
const planner = require("./planner");
const stats = require("./stats");
const roleHarvester = require("./role.harvester");
const roleUpgrader = require("./role.upgrader");
const roleBuilder = require("./role.builder");
const baseCreep = require("./baseCreep");
const roleClaimer = require("./role.claimer");
const roleTransporter = require("./role.transporter");
const roleMiner = require("./role.miner");
const roleHauler = require("./role.hauler");
const roleFighter = require("./role.fighter");
const roleExplorer = require("./role.explorer");
const roleMineralExtractor = require("./role.mineralExtractor");
const roleChemist = require("./role.chemist");

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
 * @param {Room} room - The room to analyze
 * @returns {Object} Room status object
 */
const getRoomStatus = (room) => {
  const structures = room.find(FIND_STRUCTURES);
  const controllerLevel = getControllerLevel(room);

  // Count planned extensions from flags
  const extensionPlanned = Object.keys(Game.flags).filter((flagName) =>
    flagName.startsWith("EXT_")
  ).length;

  const { roomPlanner } = planner;
  roomPlanner.clearPlannerFlags(room);
  // console.log(`[STATUS] Cleared planner flags for room ${room.name}. Found ${extensionPlanned} planned extensions from flags.`);
  // Count extension construction sites
  const extensionSites = room.find(FIND_CONSTRUCTION_SITES, {
    filter: (s) => s.structureType === STRUCTURE_EXTENSION,
  }).length;

  // Count built extensions
  const extensionBuilt = structures.filter(
    (s) => s.structureType === STRUCTURE_EXTENSION
  ).length;

  // Count creeps by role
  const creeps = spawner.countCreepsByRole(Game.creeps, room.name);

  // Count construction sites
  const constructionSites = room.find(FIND_CONSTRUCTION_SITES);

  // Check for storage
  const storage = structures.find((s) => s.structureType === STRUCTURE_STORAGE);
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
  
  // Base roster - minimum creeps always maintained
  const roster = {
    harvester: 2,  // Always keep 2 harvesters as backup
    builder: 1,
    upgrader: 1
  };
  
  // Scale builders based on construction sites
  if (roomStatus.constructionSiteCount > 10) {
    roster.builder = Math.min(4, 1 + Math.floor(roomStatus.constructionSiteCount / 10));
  }
  
  // RCL 1-3: Early game - generalist harvesters only
  if (rcl <= 3) {
    // Adjust based on efficiency tier if available
    if (efficiencyMetrics && efficiencyMetrics.efficiencyTier === 'established') {
      roster.upgrader = 3;
    }
    return roster;
  }
  
  // RCL 4-5: Mid-early game - introduce miners and haulers
  if (rcl <= 5) {
    roster.miner = sourceCount;           // 1 miner per source
    roster.hauler = sourceCount + 1;      // 1 extra hauler for flexibility
    roster.builder = Math.max(roster.builder, 2);
    roster.upgrader = 2;
    return roster;
  }
  
  // RCL 6-7: Mid-late game - add specialized roles
  if (rcl <= 7) {
    roster.miner = sourceCount;
    roster.hauler = sourceCount + 2;      // More haulers for longer distances
    roster.builder = Math.max(roster.builder, 2);
    roster.upgrader = 3;
    roster.mineralExtractor = 1;          // Mine minerals
    roster.chemist = 1;                   // Lab logistics
    return roster;
  }
  
  // RCL 8: Late game - maximum efficiency
  roster.miner = sourceCount;
  roster.hauler = sourceCount + 4;        // Large hauler fleet
  roster.builder = Math.max(roster.builder, 2);
  roster.upgrader = 4;
  roster.mineralExtractor = 1;
  roster.chemist = 1;
  
  console.log(`[ROSTER] Calculated roster for room ${roomStatus.roomName} at RCL ${rcl}:`, roster);
  return roster;
};

// ============================================================================
// Tower Handling
// ============================================================================

/**
 * Handle all towers in the room
 * Effectful function - makes towers attack enemies, heal creeps, and repair structures
 * @param {Room} room - The room containing towers
 */
const handleTowers = (room) => {
  const towers = room.find(FIND_MY_STRUCTURES, {
    filter: (s) => s.structureType === STRUCTURE_TOWER,
  });

  towers.forEach((tower) => {
    // Priority 1: Attack hostile creeps
    const hostileCreeps = room.find(FIND_HOSTILE_CREEPS);
    
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
    const damagedCreeps = room.find(FIND_MY_CREEPS, {
      filter: (creep) => creep.hits < creep.hitsMax
    });
    
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
    const damagedStructures = room.find(FIND_STRUCTURES, {
      filter: (structure) => {
        const healthPercent = structure.hits / structure.hitsMax;
        return healthPercent < 0.2 &&
               structure.structureType !== STRUCTURE_WALL &&
               structure.structureType !== STRUCTURE_RAMPART;
      }
    });
    
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
const roleHandlers = {
  harvester: roleHarvester.run,
  upgrader: roleUpgrader.run,
  builder: roleBuilder.run,
  claimer: roleClaimer.run,
  transporter: roleTransporter.run,
  miner: roleMiner.run,
  hauler: roleHauler.run,
  fighter: roleFighter.run,
  explorer: roleExplorer.run,
  mineralExtractor: roleMineralExtractor.run,
  chemist: roleChemist.run,
};

/**
 * Handle attack flag coordination
 * If an "attack" flag exists, all creeps with ATTACK parts move to attack
 * @returns {boolean} True if attack flag exists and was handled
 */
const handleAttackFlag = () => {
  const attackFlag = Game.flags['attack'];
  if (!attackFlag) {
    return false;
  }

  // Find all creeps with ATTACK parts
  const attackingCreeps = Object.values(Game.creeps).filter(creep => baseCreep.isFighter(creep));

  if (attackingCreeps.length === 0) {
    console.log('[ATTACK FLAG] Flag detected but no creeps with ATTACK parts available');
    return true;
  }

  console.log(`[ATTACK FLAG] Coordinating ${attackingCreeps.length} attacking creeps to ${attackFlag.pos}`);

  attackingCreeps.forEach(creep => {
    // Move to flag position
    if (creep.pos.getRangeTo(attackFlag.pos) > 3) {
      creep.moveTo(attackFlag.pos, {
        visualizePathStyle: { stroke: '#ff0000' }
      });
    } else {
      // Look for hostile creeps or structures nearby
      const hostileCreep = creep.pos.findClosestByRange(FIND_HOSTILE_CREEPS);
      const hostileStructure = creep.pos.findClosestByRange(FIND_HOSTILE_STRUCTURES);
      
      if (hostileCreep && creep.pos.getRangeTo(hostileCreep) <= 3) {
        if (creep.pos.getRangeTo(hostileCreep) > 1) {
          creep.moveTo(hostileCreep, {
            visualizePathStyle: { stroke: '#ff0000' }
          });
        } else {
          creep.attack(hostileCreep);
        }
      } else if (hostileStructure && creep.pos.getRangeTo(hostileStructure) <= 3) {
        if (creep.pos.getRangeTo(hostileStructure) > 1) {
          creep.moveTo(hostileStructure, {
            visualizePathStyle: { stroke: '#ff0000' }
          });
        } else {
          creep.attack(hostileStructure);
        }
      } else {
        // No enemies nearby, move toward flag
        creep.moveTo(attackFlag.pos, {
          visualizePathStyle: { stroke: '#ff0000' }
        });
      }
    }
  });

  return true;
};




/**
 * Handle all creeps in the room
 * Effectful function
 * @param {Room} room - The room (currently unused, handles all creeps)
 */
const handleCreeps = (room) => {
  // Check for attack flag first - if present, attacking creeps follow it
  const attackFlagActive = handleAttackFlag();

  // Logic for rebalancing workers tasks

  Object.values(Game.creeps).forEach((creep) => {
    // Skip creeps already handled by attack flag
    if (attackFlagActive && creep.body.some(part => part.type === ATTACK)) {
      return; // Skip normal role handling for attacking creeps
    }

    const handler = roleHandlers[creep.memory.role];
    if (handler) {
      handler(creep);
    } else {
      console.log(
        `No role function found for creep ${creep.name} with role ${creep.memory.role}`
      );
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
  
  // Calculate roster based on room status and efficiency
  const roster = calculateRoster(roomStatus, efficiencyMetrics);

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
