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
  // Count extension construction sites
  const extensionSites = room.find(FIND_CONSTRUCTION_SITES, {
    filter: (s) => s.structureType === STRUCTURE_EXTENSION,
  }).length;

  // Count built extensions
  const extensionBuilt = structures.filter(
    (s) => s.structureType === STRUCTURE_EXTENSION
  ).length;

  // Count creeps by role
  const creeps = spawner.countCreepsByRole(Game.creeps);

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
 * Calculate initial roster for low-level rooms
 * @param {Object} roomStatus - Current room status
 * @returns {Object} Roster object {role: count}
 */
const calculateInitialRoster = (roomStatus) => {
  const harvesterCount = roomStatus.creeps.harvester || 0;

  if (harvesterCount < 2) {
    return { harvester: 4, upgrader: 0, builder: 0 };
  }
  return { harvester: 1, upgrader: 2, builder: 1 };
};

/**
 * Calculate roster based on room status with priority-based spawning
 * Prioritizes energy collection, then core operations, then advanced roles
 * Maintains generalists at all RCLs and gradually transitions to specialists
 * Pure function - scales with energy capacity, RCL, and efficiency metrics
 * @param {Object} roomStatus - Current room status
 * @param {Object} efficiencyMetrics - Energy collection efficiency metrics from stats
 * @returns {Object} Roster object {role: count}
 */
const calculateRoster = (roomStatus, efficiencyMetrics = null) => {
  const rcl = roomStatus.controllerLevel;
  const efficiencyTier = efficiencyMetrics ? efficiencyMetrics.efficiencyTier : 'bootstrapping';
  
  // Check if explore flag exists - spawn explorer if present
  const exploreFlag = Game.flags['explore'];
  if (exploreFlag) {
    const explorerCount = roomStatus.creeps.explorer || 0;
    // Only spawn 1 explorer at a time
    if (explorerCount < 1) {
      console.log(`[EXPLORE FLAG] Flag detected at ${exploreFlag.pos}. Spawning explorer.`);
      return { explorer: 1 };
    }
  }
  
  // Check if attack flag is present - spawn fighters as if there's an invader
  const attackFlag = Game.flags['attack'];
  const underAttack = attackFlag !== undefined;
  
  // Critical: ensure at least 2 energy collectors (harvester or miner)
  const harvesterCount = roomStatus.creeps.harvester || 0;
  const minerCount = roomStatus.creeps.miner || 0;
  const totalCollectors = harvesterCount + minerCount;
  
  if (totalCollectors < 2) {
    // Emergency bootstrap: spawn harvesters or miners
    if (rcl < 4) {
      return { harvester: 2, upgrader: 0, builder: 0 };
    } else {
      return { miner: 1, hauler: 1, harvester: 1, upgrader: 0, builder: 0 };
    }
  }

  // Get room and source count for calculations
  const room = Game.rooms[roomStatus.roomName];
  const sources = room ? room.find(FIND_SOURCES) : [];
  const sourceCount = sources.length || 2; // Default to 2 if room not visible

  // ========================================================================
  // RCL 1-3: Bootstrap with generalists, gradually add specialists
  // ========================================================================
  if (rcl <= 3) {
    const roster = {};
    
    // PRIORITY 1: Energy Collection (primary - always spawn first)
    // Primarily use generalist harvesters at low RCL
    const baseHarvesterCount = Math.max(3, Math.ceil(roomStatus.energyCapacity / 250));
    roster.harvester = Math.min(baseHarvesterCount, 8); // Cap at 8
    
    // PRIORITY 2: Core Operations (spawn when collection is at least 'developing')
    if (efficiencyTier !== 'bootstrapping' || totalCollectors >= 4) {
      // Upgraders: scale with capacity, but keep modest
      roster.upgrader = Math.max(1, Math.floor(roomStatus.energyCapacity / 400));
      roster.upgrader = Math.min(roster.upgrader, 3); // Cap at 3
      
      // Builders: scale with construction sites
      if (roomStatus.constructionSiteCount > 10) {
        roster.builder = 3;
      } else if (roomStatus.constructionSiteCount > 3) {
        roster.builder = 2;
      } else if (roomStatus.constructionSiteCount > 0) {
        roster.builder = 1;
      } else {
        roster.builder = 0;
      }
    } else {
      // Bootstrapping: minimal non-collection roles
      roster.upgrader = rcl < 2 ? 1 : 0;
      roster.builder = 0;
    }
    
    // Add fighters if under attack
    if (underAttack && roomStatus.energyCapacity >= 250) {
      roster.fighter = Math.max(2, Math.floor(roomStatus.energyCapacity / 400));
      console.log(`[ATTACK FLAG] RCL ${rcl}: Spawning ${roster.fighter} fighters`);
    }
    
    return roster;
  }

  // ========================================================================
  // RCL 4-7: Gradual transition from generalists to specialists
  // ========================================================================
  if (rcl <= 7) {
    const roster = {};
    
    // PRIORITY 1: Energy Collection Infrastructure
    // Determine generalist vs specialist balance based on efficiency
    let generalistCount = 0;
    let minerCount = 0;
    let haulerCount = 0;
    
    if (efficiencyTier === 'bootstrapping') {
      // Use primarily generalists with 1 specialist per type
      generalistCount = 3;
      minerCount = Math.min(sourceCount, 1);
      haulerCount = Math.min(sourceCount, 1);
    } else if (efficiencyTier === 'developing') {
      // Transition: 2 generalists, more specialists
      generalistCount = 2;
      minerCount = sourceCount;
      haulerCount = sourceCount * 2;
    } else if (efficiencyTier === 'established') {
      // Mostly specialists: 1 generalist for flexibility
      generalistCount = 1;
      minerCount = sourceCount;
      haulerCount = sourceCount * 2;
    } else { // optimized
      // Full specialists: 1 generalist as backup
      generalistCount = 1;
      minerCount = sourceCount;
      haulerCount = sourceCount * 3; // More haulers for optimized rooms
    }
    
    roster.harvester = generalistCount; // Generalists use harvester role
    roster.miner = minerCount;
    roster.hauler = haulerCount;
    
    // PRIORITY 2: Core Operations (spawn when collection is at least 'developing')
    if (efficiencyTier === 'developing' || efficiencyTier === 'established' || efficiencyTier === 'optimized') {
      // Upgraders: scale with room efficiency
      if (efficiencyTier === 'optimized') {
        roster.upgrader = 3;
      } else if (efficiencyTier === 'established') {
        roster.upgrader = 2;
      } else {
        roster.upgrader = 1;
      }
      
      // Builders: scale with construction sites
      if (roomStatus.constructionSiteCount > 10) {
        roster.builder = 2;
      } else if (roomStatus.constructionSiteCount > 3) {
        roster.builder = 1;
      } else if (roomStatus.constructionSiteCount > 0) {
        roster.builder = 1;
      } else {
        roster.builder = 0;
      }
    } else {
      // Bootstrapping: minimal core operations
      roster.upgrader = 1;
      roster.builder = 0;
    }
    
    // PRIORITY 3: Advanced Roles (RCL 6+ and efficiency 'established' or better)
    if (rcl >= 6 && (efficiencyTier === 'established' || efficiencyTier === 'optimized')) {
      // Mineral extraction
      const minerals = room ? room.find(FIND_MINERALS) : [];
      const mineral = minerals.length > 0 ? minerals[0] : null;
      
      if (mineral && mineral.mineralAmount > 0) {
        const extractor = mineral.pos.lookFor(LOOK_STRUCTURES).find(
          s => s.structureType === STRUCTURE_EXTRACTOR
        );
        
        if (extractor) {
          roster.mineralExtractor = 1;
          roster.hauler = (roster.hauler || 0) + 1; // Extra hauler for minerals
        }
      }
      
      // Lab operations
      const labs = room ? room.find(FIND_MY_STRUCTURES, {
        filter: s => s.structureType === STRUCTURE_LAB
      }) : [];
      
      if (labs.length >= 3) {
        roster.chemist = 1;
      }
    }
    
    // Fighters if under attack
    if (underAttack) {
      roster.fighter = Math.max(3, Math.floor(roomStatus.energyCapacity / 600));
      console.log(`[ATTACK FLAG] RCL ${rcl}: Spawning ${roster.fighter} fighters`);
    }
    
    return roster;
  }

  // ========================================================================
  // RCL 8: Optimized with large specialists + 1 generalist
  // ========================================================================
  const roster = {};
  
  // PRIORITY 1: Energy Collection (always maintain)
  roster.harvester = 1; // 1 generalist for flexibility
  roster.miner = sourceCount; // 1 miner per source
  roster.hauler = sourceCount; // 1 large hauler per source at RCL 8
  
  // PRIORITY 2: Core Operations
  roster.upgrader = 2; // 2 giant upgraders
  
  // Builders: scale with construction
  if (roomStatus.constructionSiteCount > 5) {
    roster.builder = 2;
  } else if (roomStatus.constructionSiteCount > 0) {
    roster.builder = 1;
  } else {
    roster.builder = 0;
  }
  
  // PRIORITY 3: Advanced Roles
  const minerals = room ? room.find(FIND_MINERALS) : [];
  const mineral = minerals.length > 0 ? minerals[0] : null;
  
  if (mineral && mineral.mineralAmount > 0) {
    const extractor = mineral.pos.lookFor(LOOK_STRUCTURES).find(
      s => s.structureType === STRUCTURE_EXTRACTOR
    );
    
    if (extractor) {
      roster.mineralExtractor = 1;
      roster.hauler = (roster.hauler || 0) + 1;
    }
  }
  
  const labs = room ? room.find(FIND_MY_STRUCTURES, {
    filter: s => s.structureType === STRUCTURE_LAB
  }) : [];
  
  if (labs.length >= 3) {
    roster.chemist = 1;
  }
  
  // Fighters if under attack
  if (underAttack) {
    roster.fighter = Math.max(4, Math.floor(roomStatus.energyCapacity / 800));
    console.log(`[ATTACK FLAG] RCL ${rcl}: Spawning ${roster.fighter} elite fighters`);
  }
  
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
        return healthPercent < 0.4 &&
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
