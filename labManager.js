/**
 * Lab Manager Module
 * Orchestrates compound production and creep boosting
 * Manages lab assignment, reaction queues, and boost stations
 */

/**
 * Compound recipes - defines how to produce each compound
 * Format: { output: { input1: mineralType, input2: mineralType } }
 */
const COMPOUND_RECIPES = {
  // Tier 1 - Base Compounds
  OH: { input1: RESOURCE_OXYGEN, input2: RESOURCE_HYDROGEN },
  ZK: { input1: RESOURCE_ZYNTHIUM, input2: RESOURCE_KEANIUM },
  UL: { input1: RESOURCE_UTRIUM, input2: RESOURCE_LEMERGIUM },
  G: { input1: RESOURCE_ZYNTHIUM, input2: RESOURCE_KEANIUM }, // Ghodium (alternative recipe)

  // Tier 2 - Combat Boosts
  UH: { input1: RESOURCE_UTRIUM, input2: RESOURCE_HYDROGEN },      // Attack boost
  UO: { input1: RESOURCE_UTRIUM, input2: RESOURCE_OXYGEN },        // Harvest boost
  KH: { input1: RESOURCE_KEANIUM, input2: RESOURCE_HYDROGEN },     // Carry boost
  KO: { input1: RESOURCE_KEANIUM, input2: RESOURCE_OXYGEN },       // Ranged attack boost
  LH: { input1: RESOURCE_LEMERGIUM, input2: RESOURCE_HYDROGEN },   // Build boost
  LO: { input1: RESOURCE_LEMERGIUM, input2: RESOURCE_OXYGEN },     // Heal boost
  ZH: { input1: RESOURCE_ZYNTHIUM, input2: RESOURCE_HYDROGEN },    // Dismantle boost
  ZO: { input1: RESOURCE_ZYNTHIUM, input2: RESOURCE_OXYGEN },      // Move boost
  GH: { input1: RESOURCE_GHODIUM, input2: RESOURCE_HYDROGEN },     // Upgrade boost
  GO: { input1: RESOURCE_GHODIUM, input2: RESOURCE_OXYGEN },       // Tough boost

  // Tier 3 - Advanced Boosts (commented out - implement when Tier 2 stable)
  // UH2O: { input1: 'UH', input2: RESOURCE_OXYGEN },
  // UHO2: { input1: 'UO', input2: RESOURCE_HYDROGEN },
  // KH2O: { input1: 'KH', input2: RESOURCE_OXYGEN },
  // KHO2: { input1: 'KO', input2: RESOURCE_HYDROGEN },
  // LH2O: { input1: 'LH', input2: RESOURCE_OXYGEN },
  // LHO2: { input1: 'LO', input2: RESOURCE_HYDROGEN },
  // ZH2O: { input1: 'ZH', input2: RESOURCE_OXYGEN },
  // ZHO2: { input1: 'ZO', input2: RESOURCE_HYDROGEN },
  // GH2O: { input1: 'GH', input2: RESOURCE_OXYGEN },
  // GHO2: { input1: 'GO', input2: RESOURCE_HYDROGEN },
};

/**
 * Production priorities - combat boosts first
 */
const PRODUCTION_PRIORITIES = [
  'UH',  // Attack boost - highest priority
  'ZH',  // Dismantle boost - second priority
  'UO',  // Harvest boost - third priority
  'LH',  // Build boost
  'ZO',  // Move boost
  'GH',  // Upgrade boost
  'KH',  // Carry boost
  'GO',  // Tough boost
  'LO',  // Heal boost
  'KO',  // Ranged attack boost
  'OH',  // Base compound
  'ZK',  // Base compound
  'UL',  // Base compound
];

/**
 * Resource thresholds for compound production
 */
const COMPOUND_THRESHOLDS = {
  MIN_STOCK: 1000,   // Produce if below this amount
  TARGET_STOCK: 5000, // Stop producing at this amount
  MIN_INPUT: 1000,    // Minimum input minerals needed to start reaction
};

/**
 * Identify labs by type
 * @param {Room} room - The room to analyze
 * @returns {Object} Categorized labs
 */
const categorizeLabs = (room) => {
  const labs = room.find(FIND_MY_STRUCTURES, {
    filter: (s) => s.structureType === STRUCTURE_LAB,
  });

  if (labs.length < 3) {
    return { inputLabs: [], outputLabs: [], boostLabs: [], allLabs: labs };
  }

  // Reserve last 2 labs for boosting
  const boostLabs = labs.slice(-2);
  const reactionLabs = labs.slice(0, -2);

  // Input labs are first 2 available labs
  const inputLabs = reactionLabs.slice(0, 2);
  // Output labs are remaining labs (can run multiple reactions)
  const outputLabs = reactionLabs.slice(2);

  return { inputLabs, outputLabs, boostLabs, allLabs: labs };
};

/**
 * Get current compound stocks from storage
 * @param {Room} room - The room
 * @returns {Object} Compound amounts
 */
const getCompoundStocks = (room) => {
  if (!room.storage) return {};

  const stocks = {};
  for (const compound of PRODUCTION_PRIORITIES) {
    stocks[compound] = room.storage.store[compound] || 0;
  }
  return stocks;
};

/**
 * Determine next compound to produce based on priorities and stock levels
 * @param {Room} room - The room
 * @returns {string|null} Compound type to produce or null
 */
const getNextCompoundToProduce = (room) => {
  if (!room.storage) return null;

  const stocks = getCompoundStocks(room);

  // Find highest priority compound below minimum stock
  for (const compound of PRODUCTION_PRIORITIES) {
    const currentStock = stocks[compound] || 0;
    
    if (currentStock < COMPOUND_THRESHOLDS.MIN_STOCK) {
      // Check if we have enough input materials
      const recipe = COMPOUND_RECIPES[compound];
      if (!recipe) continue;

      const input1Amount = room.storage.store[recipe.input1] || 0;
      const input2Amount = room.storage.store[recipe.input2] || 0;

      if (input1Amount >= COMPOUND_THRESHOLDS.MIN_INPUT && 
          input2Amount >= COMPOUND_THRESHOLDS.MIN_INPUT) {
        return compound;
      }
    }
  }

  return null;
};

/**
 * Assign labs for a specific reaction
 * @param {Room} room - The room
 * @param {string} compound - Compound to produce
 * @returns {Object|null} Lab assignment or null
 */
const assignLabsForReaction = (room, compound) => {
  const { inputLabs, outputLabs } = categorizeLabs(room);

  if (inputLabs.length < 2 || outputLabs.length < 1) {
    return null;
  }

  const recipe = COMPOUND_RECIPES[compound];
  if (!recipe) return null;

  // Initialize room memory for lab assignments
  if (!Memory.rooms[room.name].labs) {
    Memory.rooms[room.name].labs = {};
  }

  // Store assignment in memory
  Memory.rooms[room.name].labs.currentReaction = compound;
  Memory.rooms[room.name].labs.input1 = { id: inputLabs[0].id, resource: recipe.input1 };
  Memory.rooms[room.name].labs.input2 = { id: inputLabs[1].id, resource: recipe.input2 };
  Memory.rooms[room.name].labs.output = { id: outputLabs[0].id, resource: compound };

  return {
    inputLab1: inputLabs[0],
    inputLab2: inputLabs[1],
    outputLab: outputLabs[0],
    compound,
    recipe,
  };
};

/**
 * Run reactions in assigned labs
 * @param {Room} room - The room
 * @returns {Object} Status report
 */
const runReactions = (room) => {
  const labMemory = Memory.rooms[room.name].labs;
  if (!labMemory || !labMemory.currentReaction) {
    return { active: false, reason: "no reaction assigned" };
  }

  const inputLab1 = Game.getObjectById(labMemory.input1.id);
  const inputLab2 = Game.getObjectById(labMemory.input2.id);
  const outputLab = Game.getObjectById(labMemory.output.id);

  if (!inputLab1 || !inputLab2 || !outputLab) {
    return { active: false, reason: "labs not found" };
  }

  // Check if input labs have sufficient resources
  const input1Amount = inputLab1.store[labMemory.input1.resource] || 0;
  const input2Amount = inputLab2.store[labMemory.input2.resource] || 0;

  if (input1Amount < 5 || input2Amount < 5) {
    return { active: false, reason: "insufficient inputs", input1Amount, input2Amount };
  }

  // Check if output lab has capacity
  const outputAmount = outputLab.store[labMemory.currentReaction] || 0;
  if (outputAmount >= COMPOUND_THRESHOLDS.TARGET_STOCK) {
    // Stop this reaction, clear assignment
    delete Memory.rooms[room.name].labs.currentReaction;
    return { active: false, reason: "target reached", outputAmount };
  }

  // Check if output lab is full
  if (outputLab.store.getFreeCapacity() < 10) {
    return { active: false, reason: "output lab full" };
  }

  // Check cooldown
  if (outputLab.cooldown > 0) {
    return { active: false, reason: "cooldown", cooldown: outputLab.cooldown };
  }

  // Run reaction
  const result = outputLab.runReaction(inputLab1, inputLab2);

  if (result === OK) {
    return {
      active: true,
      compound: labMemory.currentReaction,
      outputAmount: outputAmount + 5,
    };
  }

  return { active: false, reason: `error ${result}` };
};

/**
 * Handle creep boosting at boost labs
 * @param {Room} room - The room
 * @returns {number} Number of boosts applied
 */
const handleBoosting = (room) => {
  const { boostLabs } = categorizeLabs(room);
  if (boostLabs.length === 0) return 0;

  // Find creeps that need boosting
  const creepsNeedingBoost = room.find(FIND_MY_CREEPS, {
    filter: (c) => c.memory.needsBoosting && !c.memory.boosted,
  });

  if (creepsNeedingBoost.length === 0) return 0;

  let boostsApplied = 0;

  for (const creep of creepsNeedingBoost) {
    const boostTypes = creep.memory.boostTypes || [];
    if (boostTypes.length === 0) continue;

    for (const boostType of boostTypes) {
      // Find boost lab with this compound
      const boostLab = boostLabs.find(
        (lab) => (lab.store[boostType] || 0) >= 30 * creep.body.length
      );

      if (!boostLab) continue;

      // Check if creep is in range
      if (!creep.pos.isNearTo(boostLab)) {
        creep.moveTo(boostLab, { visualizePathStyle: { stroke: "#ffaa00" } });
        continue;
      }

      // Apply boost
      const result = boostLab.boostCreep(creep);
      if (result === OK) {
        boostsApplied++;
        creep.say(`💉 ${boostType}`);
        
        // Mark as boosted if all boosts applied
        if (!creep.memory.boostApplied) {
          creep.memory.boostApplied = [];
        }
        creep.memory.boostApplied.push(boostType);
        
        if (creep.memory.boostApplied.length >= boostTypes.length) {
          creep.memory.boosted = true;
          delete creep.memory.needsBoosting;
        }
      }
    }
  }

  return boostsApplied;
};

/**
 * Main lab management function - run every tick
 * @param {Room} room - The room to manage
 * @returns {Object} Status report
 */
const manageLabsystem = (room) => {
  // Initialize room memory
  if (!Memory.rooms[room.name]) {
    Memory.rooms[room.name] = {};
  }
  if (!Memory.rooms[room.name].labs) {
    Memory.rooms[room.name].labs = {};
  }

  const { allLabs } = categorizeLabs(room);

  if (allLabs.length < 3) {
    return { active: false, reason: "insufficient labs", labCount: allLabs.length };
  }

  // Assign reaction if no current reaction
  if (!Memory.rooms[room.name].labs.currentReaction) {
    const nextCompound = getNextCompoundToProduce(room);
    if (nextCompound) {
      assignLabsForReaction(room, nextCompound);
    }
  }

  // Run reactions
  const reactionStatus = runReactions(room);

  // Handle boosting
  const boostsApplied = handleBoosting(room);

  return {
    active: true,
    labCount: allLabs.length,
    reactionStatus,
    boostsApplied,
  };
};

/**
 * Get lab filling/emptying tasks for chemist
 * @param {Room} room - The room
 * @returns {Array} Array of tasks { labId, resourceType, action: 'fill'|'empty', amount }
 */
const getLabTasks = (room) => {

  const labMemory = Memory.rooms[room.name] && Memory.rooms[room.name].labs;
  if (!labMemory) return [];

  const tasks = [];

  // Task 1: Fill input labs
  if (labMemory.input1) {
    const lab = Game.getObjectById(labMemory.input1.id);
    const resource = labMemory.input1.resource;
    if (lab && (lab.store[resource] || 0) < 1000) {
      tasks.push({
        labId: lab.id,
        resourceType: resource,
        action: "fill",
        amount: 1000 - (lab.store[resource] || 0),
      });
    }
  }

  if (labMemory.input2) {
    const lab = Game.getObjectById(labMemory.input2.id);
    const resource = labMemory.input2.resource;
    if (lab && (lab.store[resource] || 0) < 1000) {
      tasks.push({
        labId: lab.id,
        resourceType: resource,
        action: "fill",
        amount: 1000 - (lab.store[resource] || 0),
      });
    }
  }

  // Task 2: Empty output lab
  if (labMemory.output) {
    const lab = Game.getObjectById(labMemory.output.id);
    const resource = labMemory.output.resource;
    if (lab && (lab.store[resource] || 0) > 100) {
      tasks.push({
        labId: lab.id,
        resourceType: resource,
        action: "empty",
        amount: lab.store[resource],
      });
    }
  }

  return tasks;
};

module.exports = {
  manageLabsystem,
  getLabTasks,
  categorizeLabs,
  COMPOUND_RECIPES,
  PRODUCTION_PRIORITIES,
};
