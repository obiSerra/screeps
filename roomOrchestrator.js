const utils = require("./utils");
const spawner = require("./spawner");
const planner = require("./planner");
const roleHarvester = require("./role.harvester");
const roleUpgrader = require("./role.upgrader");
const roleBuilder = require("./role.builder");

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
    return { harvester: 2, upgrader: 0, builder: 0 };
  }
  return { harvester: 1, upgrader: 2, builder: 1 };
};

/**
 * Calculate roster based on room status
 * Pure function
 * @param {Object} roomStatus - Current room status
 * @returns {Object} Roster object {role: count}
 */
const calculateRoster = (roomStatus) => {
  const defaultRoster = { harvester: 2, builder: 1, upgrader: 1 };

  // Critical: ensure at least 1 harvester
  if ((roomStatus.creeps.harvester || 0) < 1) {
    return { harvester: 1, upgrader: 0, builder: 0 };
  }

  // Level 1: focus on upgrading to unlock extensions
  if (roomStatus.controllerLevel < 2) {
    return calculateInitialRoster(roomStatus);
  }

  // Adjust builder count based on construction sites
  const roster = { ...defaultRoster };
  if (roomStatus.constructionSiteCount > 10) {
    roster.builder = 4;
  } else if (roomStatus.constructionSiteCount > 0) {
    roster.builder = 2;
  } else {
    roster.builder = 1;
  }

  return roster;
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
};

/**
 * Handle all creeps in the room
 * Effectful function
 * @param {Room} room - The room (currently unused, handles all creeps)
 */
const handleCreeps = (room) => {
  Object.values(Game.creeps).forEach((creep) => {
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

  if (plannedStructures.length === 0) {
    // Create initial plan
    console.log(`[PLANNING] Creating base layout plan for room ${room.name}...`);
    roomPlanner.planBaseLayout(room, {
      clearExisting: false,
      visualize: true,
      currentControllerLevel: roomStatus.controllerLevel,
    });
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
  // Calculate roster based on room status
  const roster = calculateRoster(roomStatus);

  // Get spawn and execute spawn procedure
  const spawn = room.find(FIND_MY_SPAWNS)[0];
  if (spawn) {
    spawner.spawnProcedure(spawn, roster, roomStatus);
  }

  // Execute build plan from planner flags
  const { roomPlanner } = planner;
  roomPlanner.executeBuildPlan(room);

  // Plan ramparts around critical structures
  const spawnPosition = spawn ? spawn.pos : undefined;
  if (spawnPosition) {
    planCriticalStructureRamparts(room.name, spawnPosition, 3, false);
    placeRampantsConstructionSites(room.name);
  }

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
  utils.periodicLogger(`Room ${room.name} status: ${JSON.stringify(roomStatus)}`, 60);

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

  // Creeps
  handleCreeps,

  // Rampart planning (legacy)
  planCriticalStructureRamparts,
  placeRampantsConstructionSites,
};
