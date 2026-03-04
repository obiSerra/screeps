/**
 * Room Planner for Screeps
 * Plans an optimal base layout using a grid design
 * Uses flags to mark structure placements
 * Flag naming convention: XXX_S_N
 *   XXX = 3-letter structure code
 *   S = stage number (when to build)
 *   N = unique identifier
 */

// Structure type codes (3 letters)
const STRUCTURE_CODES = {
  [STRUCTURE_SPAWN]: 'SPA',
  [STRUCTURE_EXTENSION]: 'EXT',
  [STRUCTURE_ROAD]: 'ROA',
  [STRUCTURE_WALL]: 'WAL',
  [STRUCTURE_RAMPART]: 'RAM',
  [STRUCTURE_LINK]: 'LNK',
  [STRUCTURE_STORAGE]: 'STO',
  [STRUCTURE_TOWER]: 'TOW',
  [STRUCTURE_OBSERVER]: 'OBS',
  [STRUCTURE_POWER_SPAWN]: 'PWR',
  [STRUCTURE_EXTRACTOR]: 'EXR',
  [STRUCTURE_LAB]: 'LAB',
  [STRUCTURE_TERMINAL]: 'TER',
  [STRUCTURE_CONTAINER]: 'CON',
  [STRUCTURE_NUKER]: 'NUK',
  [STRUCTURE_FACTORY]: 'FAC',
};

// Reverse lookup: code to structure type
const CODE_TO_STRUCTURE = {};
for (const [structure, code] of Object.entries(STRUCTURE_CODES)) {
  CODE_TO_STRUCTURE[code] = structure;
}

// Structure build stages (RCL levels)
const STRUCTURE_STAGES = {
  [STRUCTURE_SPAWN]: 1,
  [STRUCTURE_EXTENSION]: 2,
  [STRUCTURE_TOWER]: 3,
  [STRUCTURE_STORAGE]: 4,
  [STRUCTURE_LINK]: 5,
  [STRUCTURE_TERMINAL]: 6,
  [STRUCTURE_LAB]: 6,
  [STRUCTURE_OBSERVER]: 8,
  [STRUCTURE_POWER_SPAWN]: 8,
  [STRUCTURE_NUKER]: 8,
  [STRUCTURE_FACTORY]: 7,
  [STRUCTURE_CONTAINER]: 1,
  [STRUCTURE_ROAD]: 2,
  [STRUCTURE_RAMPART]: 2,
  [STRUCTURE_WALL]: 2,
  [STRUCTURE_EXTRACTOR]: 6,
};

// Grid offsets for a stamp-based design (checkerboard pattern for extensions)
// Each position is [dx, dy, structureType, stage]
const CORE_STAMP = [
  // Center structures
  [0, 0, STRUCTURE_STORAGE, 4],
  [0, -1, STRUCTURE_LINK, 5],
  [0, 1, STRUCTURE_TERMINAL, 6],
  [-1, 0, STRUCTURE_SPAWN, 1],
  [1, 0, STRUCTURE_SPAWN, 7],
  [0, -2, STRUCTURE_SPAWN, 8],
  
  // Towers around core
  [-1, -1, STRUCTURE_TOWER, 3],
  [1, -1, STRUCTURE_TOWER, 3],
  [-1, 1, STRUCTURE_TOWER, 5],
  [1, 1, STRUCTURE_TOWER, 5],
  [-2, 0, STRUCTURE_TOWER, 7],
  [2, 0, STRUCTURE_TOWER, 8],
  
  // Labs cluster
  [2, 2, STRUCTURE_LAB, 6],
  [3, 2, STRUCTURE_LAB, 6],
  [4, 2, STRUCTURE_LAB, 6],
  [2, 3, STRUCTURE_LAB, 7],
  [3, 3, STRUCTURE_LAB, 7],
  [4, 3, STRUCTURE_LAB, 7],
  [2, 4, STRUCTURE_LAB, 8],
  [3, 4, STRUCTURE_LAB, 8],
  [4, 4, STRUCTURE_LAB, 8],
  [5, 3, STRUCTURE_LAB, 8],
  
  // Factory, Power Spawn, Nuker, Observer
  [-2, 2, STRUCTURE_FACTORY, 7],
  [-2, -2, STRUCTURE_POWER_SPAWN, 8],
  [2, -2, STRUCTURE_NUKER, 8],
  [-3, 0, STRUCTURE_OBSERVER, 8],
];

/**
 * Generate extension positions in a grid pattern
 * @param {number} centerX - Center X coordinate
 * @param {number} centerY - Center Y coordinate
 * @param {number} count - Number of extensions to place
 * @returns {Array} Array of [dx, dy, structureType, stage] entries
 */
function generateExtensionGrid(centerX, centerY, count) {
  const extensions = [];
  const extensionStages = [
    { stage: 2, count: 5 },
    { stage: 3, count: 5 },
    { stage: 4, count: 10 },
    { stage: 5, count: 10 },
    { stage: 6, count: 10 },
    { stage: 7, count: 10 },
    { stage: 8, count: 10 },
  ];
  
  // Grid positions in a spiral-like pattern (checkerboard)
  const gridPositions = [];
  const maxRadius = 8;
  
  for (let r = 3; r <= maxRadius; r++) {
    for (let dx = -r; dx <= r; dx++) {
      for (let dy = -r; dy <= r; dy++) {
        // Checkerboard pattern
        if ((Math.abs(dx) + Math.abs(dy)) % 2 === 0) continue;
        // Skip if too close to center
        if (Math.abs(dx) < 3 && Math.abs(dy) < 3) continue;
        // Skip lab area
        if (dx >= 2 && dx <= 5 && dy >= 2 && dy <= 4) continue;
        
        const distance = Math.max(Math.abs(dx), Math.abs(dy));
        if (distance === r) {
          gridPositions.push([dx, dy]);
        }
      }
    }
  }
  
  let placed = 0;
  let stageIndex = 0;
  let stageCount = 0;
  
  for (const [dx, dy] of gridPositions) {
    if (placed >= count) break;
    if (stageIndex >= extensionStages.length) break;
    
    const currentStage = extensionStages[stageIndex];
    extensions.push([dx, dy, STRUCTURE_EXTENSION, currentStage.stage]);
    placed++;
    stageCount++;
    
    if (stageCount >= currentStage.count) {
      stageIndex++;
      stageCount = 0;
    }
  }
  
  return extensions;
}

/**
 * Generate road positions connecting structures
 * @param {number} centerX - Center X coordinate
 * @param {number} centerY - Center Y coordinate
 * @returns {Array} Array of [dx, dy, structureType, stage] entries
 */
function generateRoadGrid(centerX, centerY) {
  const roads = [];
  const maxRadius = 7;
  
  // Cross roads from center
  for (let i = 1; i <= maxRadius; i++) {
    roads.push([i, 0, STRUCTURE_ROAD, 3]);
    roads.push([-i, 0, STRUCTURE_ROAD, 3]);
    roads.push([0, i, STRUCTURE_ROAD, 3]);
    roads.push([0, -i, STRUCTURE_ROAD, 3]);
  }
  
  // Diagonal roads
  for (let i = 2; i <= 5; i++) {
    roads.push([i, i, STRUCTURE_ROAD, 4]);
    roads.push([-i, i, STRUCTURE_ROAD, 4]);
    roads.push([i, -i, STRUCTURE_ROAD, 4]);
    roads.push([-i, -i, STRUCTURE_ROAD, 4]);
  }
  
  return roads;
}

/**
 * Find the optimal center position for the base
 * Uses distance transform to find open areas
 * @param {Room} room - The room to analyze
 * @returns {RoomPosition|null} Optimal center position
 */
function findOptimalCenter(room) {
  const terrain = new Room.Terrain(room.name);
  const spawn = room.find(FIND_MY_SPAWNS)[0];
  
  // If we have a spawn, use it as reference
  if (spawn) {
    return spawn.pos;
  }
  
  // Find position with most open space using distance transform
  let bestPos = null;
  let bestScore = 0;
  
  for (let x = 10; x <= 40; x++) {
    for (let y = 10; y <= 40; y++) {
      if (terrain.get(x, y) === TERRAIN_MASK_WALL) continue;
      
      // Calculate open space score
      let score = 0;
      for (let dx = -5; dx <= 5; dx++) {
        for (let dy = -5; dy <= 5; dy++) {
          const tx = x + dx;
          const ty = y + dy;
          if (tx < 0 || tx > 49 || ty < 0 || ty > 49) continue;
          if (terrain.get(tx, ty) !== TERRAIN_MASK_WALL) {
            score++;
          }
        }
      }
      
      // Prefer positions closer to sources
      const sources = room.find(FIND_SOURCES);
      for (const source of sources) {
        const dist = Math.abs(source.pos.x - x) + Math.abs(source.pos.y - y);
        score += Math.max(0, 50 - dist);
      }
      
      // Prefer positions closer to controller
      if (room.controller) {
        const dist = Math.abs(room.controller.pos.x - x) + Math.abs(room.controller.pos.y - y);
        score += Math.max(0, 30 - dist);
      }
      
      if (score > bestScore) {
        bestScore = score;
        bestPos = new RoomPosition(x, y, room.name);
      }
    }
  }
  
  return bestPos;
}

/**
 * Check if a position is valid for building
 * @param {Room} room - The room
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate
 * @returns {boolean} True if position is valid
 */
function isValidBuildPosition(room, x, y) {
  if (x < 2 || x > 47 || y < 2 || y > 47) return false;
  
  const terrain = new Room.Terrain(room.name);
  if (terrain.get(x, y) === TERRAIN_MASK_WALL) return false;
  
  // Check for existing structures
  const structures = room.lookForAt(LOOK_STRUCTURES, x, y);
  for (const struct of structures) {
    if (struct.structureType !== STRUCTURE_ROAD && 
        struct.structureType !== STRUCTURE_RAMPART) {
      return false;
    }
  }
  
  return true;
}

/**
 * Generate flag name from structure type, stage, and index
 * @param {string} structureType - The structure constant
 * @param {number} stage - Build stage (RCL level)
 * @param {number} index - Unique index
 * @returns {string} Flag name
 */
function generateFlagName(structureType, stage, index) {
  const code = STRUCTURE_CODES[structureType] || 'UNK';
  return `${code}_${stage}_${index}`;
}

/**
 * Parse flag name to get structure info
 * @param {string} flagName - The flag name
 * @returns {Object|null} Object with structureType, stage, index or null
 */
function parseFlagName(flagName) {
  const parts = flagName.split('_');
  if (parts.length !== 3) return null;
  
  const [code, stageStr, indexStr] = parts;
  const structureType = CODE_TO_STRUCTURE[code];
  if (!structureType) return null;
  
  return {
    structureType,
    stage: parseInt(stageStr, 10),
    index: parseInt(indexStr, 10),
  };
}

/**
 * Get all planned structures from flags
 * @param {Room} room - The room
 * @returns {Array} Array of {pos, structureType, stage, flagName}
 */
function getPlannedStructures(room) {
  const planned = [];
  
  for (const flagName in Game.flags) {
    const flag = Game.flags[flagName];
    if (flag.room && flag.room.name !== room.name) continue;
    
    const parsed = parseFlagName(flagName);
    if (!parsed) continue;
    
    planned.push({
      pos: flag.pos,
      structureType: parsed.structureType,
      stage: parsed.stage,
      flagName: flagName,
    });
  }
  
  return planned;
}

/**
 * Get structures that should be built at current RCL
 * @param {Room} room - The room
 * @returns {Array} Array of {pos, structureType, flagName}
 */
function getStructuresToBuild(room) {
  const rcl = room.controller ? room.controller.level : 0;
  const planned = getPlannedStructures(room);
  
  return planned.filter(p => p.stage <= rcl);
}

/**
 * Place a flag for a structure
 * @param {Room} room - The room
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate
 * @param {string} structureType - Structure type
 * @param {number} stage - Build stage
 * @param {number} index - Unique index
 * @returns {boolean} True if flag was placed
 */
function placeStructureFlag(room, x, y, structureType, stage, index) {
  const flagName = generateFlagName(structureType, stage, index);
  
  // Check if flag already exists
  if (Game.flags[flagName]) {
    return false;
  }
  
  const pos = new RoomPosition(x, y, room.name);
  const result = pos.createFlag(flagName, COLOR_WHITE, COLOR_WHITE);
  
  return result === flagName;
}

/**
 * Clear all planner flags in a room
 * @param {Room} room - The room
 */
function clearPlannerFlags(room) {
  for (const flagName in Game.flags) {
    const flag = Game.flags[flagName];
    if (flag.room && flag.room.name !== room.name) continue;
    
    const parsed = parseFlagName(flagName);
    if (parsed) {
      flag.remove();
    }
  }
}

/**
 * Plan the complete base layout
 * @param {Room} room - The room to plan
 * @param {Object} options - Planning options
 * @returns {Object} Planning result
 */
function planBaseLayout(room, options = {}) {
  const { clearExisting = false, visualize = false } = options;
  
  if (clearExisting) {
    clearPlannerFlags(room);
  }
  
  const center = findOptimalCenter(room);
  if (!center) {
    return { success: false, error: 'Could not find optimal center' };
  }
  
  const placedFlags = [];
  let flagIndex = 0;
  
  // Place core structures
  for (const [dx, dy, structureType, stage] of CORE_STAMP) {
    const x = center.x + dx;
    const y = center.y + dy;
    
    if (!isValidBuildPosition(room, x, y)) continue;
    
    if (placeStructureFlag(room, x, y, structureType, stage, flagIndex)) {
      placedFlags.push({ x, y, structureType, stage });
      flagIndex++;
    }
  }
  
  // Place extensions
  const extensions = generateExtensionGrid(center.x, center.y, 60);
  for (const [dx, dy, structureType, stage] of extensions) {
    const x = center.x + dx;
    const y = center.y + dy;
    
    if (!isValidBuildPosition(room, x, y)) continue;
    
    if (placeStructureFlag(room, x, y, structureType, stage, flagIndex)) {
      placedFlags.push({ x, y, structureType, stage });
      flagIndex++;
    }
  }
  
  // Place roads
  const roads = generateRoadGrid(center.x, center.y);
  for (const [dx, dy, structureType, stage] of roads) {
    const x = center.x + dx;
    const y = center.y + dy;
    
    if (!isValidBuildPosition(room, x, y)) continue;
    
    if (placeStructureFlag(room, x, y, structureType, stage, flagIndex)) {
      placedFlags.push({ x, y, structureType, stage });
      flagIndex++;
    }
  }
  
  // Plan roads to sources
  const sourceRoads = planSourceRoads(room, center);
  for (const pos of sourceRoads) {
    if (!isValidBuildPosition(room, pos.x, pos.y)) continue;
    
    if (placeStructureFlag(room, pos.x, pos.y, STRUCTURE_ROAD, 3, flagIndex)) {
      placedFlags.push({ x: pos.x, y: pos.y, structureType: STRUCTURE_ROAD, stage: 3 });
      flagIndex++;
    }
  }
  
  // Plan containers at sources
  const containers = planSourceContainers(room);
  for (const pos of containers) {
    if (!isValidBuildPosition(room, pos.x, pos.y)) continue;
    
    if (placeStructureFlag(room, pos.x, pos.y, STRUCTURE_CONTAINER, 1, flagIndex)) {
      placedFlags.push({ x: pos.x, y: pos.y, structureType: STRUCTURE_CONTAINER, stage: 1 });
      flagIndex++;
    }
  }
  
  // Plan controller container and link
  const controllerStructures = planControllerStructures(room);
  for (const { pos, structureType, stage } of controllerStructures) {
    if (!isValidBuildPosition(room, pos.x, pos.y)) continue;
    
    if (placeStructureFlag(room, pos.x, pos.y, structureType, stage, flagIndex)) {
      placedFlags.push({ x: pos.x, y: pos.y, structureType, stage });
      flagIndex++;
    }
  }
  
  if (visualize) {
    visualizePlan(room, placedFlags, center);
  }
  
  return {
    success: true,
    center: center,
    flagsPlaced: placedFlags.length,
    structures: placedFlags,
  };
}

/**
 * Plan roads from center to sources
 * @param {Room} room - The room
 * @param {RoomPosition} center - Base center position
 * @returns {Array} Array of positions for roads
 */
function planSourceRoads(room, center) {
  const sources = room.find(FIND_SOURCES);
  const roads = [];
  
  for (const source of sources) {
    const path = room.findPath(center, source.pos, {
      ignoreCreeps: true,
      swampCost: 2,
      plainCost: 1,
      range: 1,
    });
    
    for (const step of path) {
      roads.push(new RoomPosition(step.x, step.y, room.name));
    }
  }
  
  return roads;
}

/**
 * Plan container positions near sources
 * @param {Room} room - The room
 * @returns {Array} Array of positions for containers
 */
function planSourceContainers(room) {
  const sources = room.find(FIND_SOURCES);
  const containers = [];
  const terrain = new Room.Terrain(room.name);
  
  for (const source of sources) {
    // Find best position adjacent to source
    const positions = [];
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        if (dx === 0 && dy === 0) continue;
        const x = source.pos.x + dx;
        const y = source.pos.y + dy;
        if (terrain.get(x, y) !== TERRAIN_MASK_WALL) {
          positions.push({ x, y });
        }
      }
    }
    
    if (positions.length > 0) {
      // Pick the first valid position
      containers.push(new RoomPosition(positions[0].x, positions[0].y, room.name));
    }
  }
  
  return containers;
}

/**
 * Plan container and link near controller
 * @param {Room} room - The room
 * @returns {Array} Array of {pos, structureType, stage}
 */
function planControllerStructures(room) {
  const structures = [];
  if (!room.controller) return structures;
  
  const terrain = new Room.Terrain(room.name);
  const controller = room.controller;
  
  // Find positions near controller
  const positions = [];
  for (let dx = -2; dx <= 2; dx++) {
    for (let dy = -2; dy <= 2; dy++) {
      if (dx === 0 && dy === 0) continue;
      const x = controller.pos.x + dx;
      const y = controller.pos.y + dy;
      if (x < 2 || x > 47 || y < 2 || y > 47) continue;
      if (terrain.get(x, y) !== TERRAIN_MASK_WALL) {
        const dist = Math.abs(dx) + Math.abs(dy);
        positions.push({ x, y, dist });
      }
    }
  }
  
  positions.sort((a, b) => a.dist - b.dist);
  
  if (positions.length > 0) {
    structures.push({
      pos: new RoomPosition(positions[0].x, positions[0].y, room.name),
      structureType: STRUCTURE_CONTAINER,
      stage: 2,
    });
  }
  
  if (positions.length > 1) {
    structures.push({
      pos: new RoomPosition(positions[1].x, positions[1].y, room.name),
      structureType: STRUCTURE_LINK,
      stage: 5,
    });
  }
  
  return structures;
}

/**
 * Visualize the planned base layout
 * @param {Room} room - The room
 * @param {Array} structures - Array of planned structures
 * @param {RoomPosition} center - Base center
 */
function visualizePlan(room, structures, center) {
  const visual = new RoomVisual(room.name);
  
  // Draw center marker
  visual.circle(center.x, center.y, {
    fill: 'yellow',
    radius: 0.5,
    opacity: 0.8,
  });
  
  // Draw planned structures
  const colors = {
    [STRUCTURE_SPAWN]: 'green',
    [STRUCTURE_EXTENSION]: 'yellow',
    [STRUCTURE_TOWER]: 'red',
    [STRUCTURE_STORAGE]: 'orange',
    [STRUCTURE_LINK]: 'cyan',
    [STRUCTURE_LAB]: 'purple',
    [STRUCTURE_TERMINAL]: 'blue',
    [STRUCTURE_ROAD]: 'gray',
    [STRUCTURE_CONTAINER]: 'brown',
  };
  
  for (const struct of structures) {
    const color = colors[struct.structureType] || 'white';
    visual.rect(struct.x - 0.4, struct.y - 0.4, 0.8, 0.8, {
      fill: color,
      opacity: 0.5,
    });
    visual.text(struct.stage.toString(), struct.x, struct.y + 0.2, {
      font: 0.4,
      color: 'white',
    });
  }
}

/**
 * Execute the build plan - build structures based on flags
 * @param {Room} room - The room
 * @returns {Object} Build result
 */
function executeBuildPlan(room) {
  const structuresToBuild = getStructuresToBuild(room);
  const results = {
    attempted: 0,
    success: 0,
    failed: 0,
    errors: [],
  };
  
  for (const { pos, structureType, flagName } of structuresToBuild) {
    // Check if structure already exists at position
    const existingStructures = room.lookForAt(LOOK_STRUCTURES, pos);
    const hasStructure = existingStructures.some(s => s.structureType === structureType);
    
    if (hasStructure) {
      // Remove flag if structure is built
      const flag = Game.flags[flagName];
      if (flag) flag.remove();
      continue;
    }
    
    // Check for construction site
    const sites = room.lookForAt(LOOK_CONSTRUCTION_SITES, pos);
    const hasSite = sites.some(s => s.structureType === structureType);
    
    if (hasSite) continue;
    
    // Try to place construction site
    results.attempted++;
    const result = room.createConstructionSite(pos, structureType);
    
    if (result === OK) {
      results.success++;
    } else {
      results.failed++;
      results.errors.push({ pos, structureType, error: result });
    }
  }
  
  return results;
}

/**
 * Get build progress for a room
 * @param {Room} room - The room
 * @returns {Object} Progress information
 */
function getBuildProgress(room) {
  const planned = getPlannedStructures(room);
  const rcl = room.controller ? room.controller.level : 0;
  
  const progress = {
    total: planned.length,
    byStage: {},
    built: 0,
    pending: 0,
    currentStage: rcl,
  };
  
  for (const { pos, structureType, stage } of planned) {
    if (!progress.byStage[stage]) {
      progress.byStage[stage] = { total: 0, built: 0 };
    }
    progress.byStage[stage].total++;
    
    const structures = room.lookForAt(LOOK_STRUCTURES, pos);
    const hasStructure = structures.some(s => s.structureType === structureType);
    
    if (hasStructure) {
      progress.built++;
      progress.byStage[stage].built++;
    } else if (stage <= rcl) {
      progress.pending++;
    }
  }
  
  return progress;
}

/**
 * Main room planner function
 * @param {Room} room - The room to plan/manage
 * @param {Object} options - Options
 * @returns {Object} Result of the planning operation
 */
function roomPlanner(room, options = {}) {
  const {
    mode = 'auto', // 'plan', 'build', 'visualize', 'auto', 'clear', 'status'
    clearExisting = false,
    visualize = false,
  } = options;
  
  switch (mode) {
    case 'plan':
      return planBaseLayout(room, { clearExisting, visualize });
      
    case 'build':
      return executeBuildPlan(room);
      
    case 'visualize':
      const planned = getPlannedStructures(room);
      const center = findOptimalCenter(room);
      if (center && planned.length > 0) {
        visualizePlan(room, planned, center);
      }
      return { success: true, structures: planned.length };
      
    case 'clear':
      clearPlannerFlags(room);
      return { success: true, message: 'Flags cleared' };
      
    case 'status':
      return getBuildProgress(room);
      
    case 'auto':
    default:
      // Auto mode: plan if no flags exist, then build
      const existingFlags = getPlannedStructures(room);
      
      if (existingFlags.length === 0) {
        const planResult = planBaseLayout(room, { clearExisting: false, visualize });
        if (!planResult.success) return planResult;
      }
      
      const buildResult = executeBuildPlan(room);
      const progress = getBuildProgress(room);
      
      return {
        success: true,
        ...buildResult,
        progress,
      };
  }
}

// Export utility functions for external use
roomPlanner.planBaseLayout = planBaseLayout;
roomPlanner.executeBuildPlan = executeBuildPlan;
roomPlanner.getPlannedStructures = getPlannedStructures;
roomPlanner.getStructuresToBuild = getStructuresToBuild;
roomPlanner.getBuildProgress = getBuildProgress;
roomPlanner.clearPlannerFlags = clearPlannerFlags;
roomPlanner.visualizePlan = visualizePlan;
roomPlanner.findOptimalCenter = findOptimalCenter;
roomPlanner.parseFlagName = parseFlagName;
roomPlanner.generateFlagName = generateFlagName;
roomPlanner.STRUCTURE_CODES = STRUCTURE_CODES;
roomPlanner.CODE_TO_STRUCTURE = CODE_TO_STRUCTURE;

exports.roomPlanner = roomPlanner;
