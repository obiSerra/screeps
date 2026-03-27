/**
 * Action Decisions Module
 * Pure functions for determining what actions creeps should take
 */

const CONFIG = require("./config");
const utils = require("./utils");
const {
  findRepairTargets,
  filterCriticalRepairs,
  findDeconstructTarget,
  findPriorityBuildTarget,
  prioritizeConstructionSites,
  sortByContention,
  countCreepsTargeting,
} = require("./creep.targetFinding");
const { canPerformAction } = require("./creep.analysis");

// ============================================================================
// Pure Functions - Resource State
// ============================================================================

/**
 * Check if creep needs to gather resources
 * Pure function
 * @param {Creep} creep
 * @returns {boolean}
 */
const needsToGather = (creep) =>
  creep.store[RESOURCE_ENERGY] === 0 ||
  (creep.memory.action === undefined && creep.store.getFreeCapacity() > 0);

/**
 * Check if creep has finished gathering
 * Pure function
 * @param {Creep} creep
 * @returns {boolean}
 */
const hasFinishedGathering = (creep) =>
  (creep.memory.action === "gathering" || creep.memory.action === undefined) &&
  creep.store.getFreeCapacity() === 0;

// ============================================================================
// Pure Functions - Action Availability
// ============================================================================

/**
 * Determine action availability
 * Pure function - returns object describing what actions are possible
 * @param {Creep} creep
 * @returns {Object} Action availability map
 */
const getActionAvailability = (creep) => {
  const { room } = creep;
  
  // Use cached room data
  const cache = global.roomCache[room.name];
  const repairTargets = findRepairTargets(creep);
  const criticalRepairs = filterCriticalRepairs(repairTargets);
  const constructionSites = cache ? cache.constructionSites : room.find(FIND_CONSTRUCTION_SITES);
  const energyAvailable = room.energyAvailable;
  const energyCapacity = room.energyCapacityAvailable;

  // Check for storage and containers at 50% capacity for transporting (use cache)
  const storage = cache ? cache.storage : room.find(FIND_STRUCTURES, {
    filter: (s) => s.structureType === STRUCTURE_STORAGE,
  })[0];
  
  const allStructures = cache ? cache.allStructures : room.find(FIND_STRUCTURES);
  const containersWithEnergy = allStructures.filter(s =>
    s.structureType === STRUCTURE_CONTAINER &&
    s.store[RESOURCE_ENERGY] >= s.store.getCapacity(RESOURCE_ENERGY) * CONFIG.ENERGY.CONTAINER.TARGET_THRESHOLD
  );

  // Check for mining opportunities (sources exist and creep has assigned source)
  const sources = cache ? cache.sourcesActive : room.find(FIND_SOURCES_ACTIVE);
  const hasMiningTarget = creep.memory.assignedSource || sources.length > 0;

  // Check for hauling opportunities (containers with energy or dropped resources)
  const containersForHauling = allStructures.filter(s =>
    s.structureType === STRUCTURE_CONTAINER && s.store[RESOURCE_ENERGY] > 0
  );
  
  const droppedResources = cache ? cache.droppedResources : room.find(FIND_DROPPED_RESOURCES);
  const droppedEnergy = droppedResources.filter(r => 
    r.resourceType === RESOURCE_ENERGY && r.amount > CONFIG.ENERGY.CONTAINER.MIN_DROPPED_RESOURCE
  );
  const hasHaulingTarget =
    containersForHauling.length > 0 || droppedEnergy.length > 0;

  // Check for delivery targets (spawns/extensions/towers/storage needing energy)
  const deliveryTargets = allStructures.filter(s =>
    (s.structureType === STRUCTURE_SPAWN ||
      s.structureType === STRUCTURE_EXTENSION ||
      s.structureType === STRUCTURE_TOWER ||
      s.structureType === STRUCTURE_STORAGE) &&
    s.store.getFreeCapacity(RESOURCE_ENERGY) > 0
  );
  const hasDeliveryTarget = deliveryTargets.length > 0;

  // Check for deconstruct target
  const deconstructTarget = findDeconstructTarget(room);
  const hasDeconstructTarget = deconstructTarget !== null;

  // Check for priority build target (across all rooms)
  const priorityBuildTarget = findPriorityBuildTarget();
  const hasPriorityBuildTarget = priorityBuildTarget !== null;

  return {
    repairCritical: criticalRepairs.length > 0 && canPerformAction(creep, "repairing"),
    building: (constructionSites.length > 0 || hasPriorityBuildTarget) && canPerformAction(creep, "building"),
    repairing: repairTargets.length > 0 && canPerformAction(creep, "repairing"),
    harvesting: energyAvailable < energyCapacity && canPerformAction(creep, "harvesting"),
    transporting: storage && containersWithEnergy.length > 0 && canPerformAction(creep, "transporting"),
    mining: hasMiningTarget && canPerformAction(creep, "mining"),
    hauling:
      hasHaulingTarget && creep.store.getFreeCapacity(RESOURCE_ENERGY) > 0 && canPerformAction(creep, "hauling"),
    delivering: hasDeliveryTarget && creep.store[RESOURCE_ENERGY] > 0 && canPerformAction(creep, "delivering"),
    deconstructing: hasDeconstructTarget && canPerformAction(creep, "deconstructing"),
    upgrading: canPerformAction(creep, "upgrading"),
    targets: {
      criticalRepairs,
      repairTargets,
      constructionSites,
      storage,
      containersWithEnergy,
      sources,
      containersForHauling,
      droppedEnergy,
      deliveryTargets,
      deconstructTarget,
      priorityBuildTarget,
    },
  };
};

// ============================================================================
// Pure Functions - Target Selection
// ============================================================================

/**
 * Select the best build target from construction sites
 * Prioritizes priority_build flag first, then extensions when multiple types exist, then sorts by contention
 * Pure function
 * @param {Creep} creep
 * @param {Array} constructionSites
 * @returns {Object} { id, pos } of selected target
 */
const selectBuildTarget = (creep, constructionSites) => {
  // Priority 1: Check for priority_build flag
  const priorityBuildTarget = findPriorityBuildTarget();
  if (priorityBuildTarget) {
    return { id: priorityBuildTarget.id, pos: priorityBuildTarget.pos };
  }

  // Priority 2: Existing prioritization logic
  const prioritizedSites = prioritizeConstructionSites(constructionSites);
  const targets = sortByContention(creep, prioritizedSites, true);
  if (targets.length === 0) {
    return null;
  }
  const target = targets[0];
  return { id: target.id, pos: target.pos };
};

/**
 * Select the best source target for gathering
 * Pure function
 * @param {Creep} creep
 * @returns {Object|null} { id, pos } of selected source or null if none available
 */
const selectGatheringTarget = (creep) => {
  // Priority 1: Check for dropped energy NOT targeted by other creeps
  const droppedEnergy = creep.room.find(FIND_DROPPED_RESOURCES, {
    filter: (r) => 
      r.resourceType === RESOURCE_ENERGY && 
      r.amount > CONFIG.ENERGY.CONTAINER.MIN_DROPPED_RESOURCE &&
      countCreepsTargeting(r.id) === 0,
  });

  if (droppedEnergy.length > 0) {
    const closest = creep.pos.findClosestByPath(droppedEnergy);
    if (closest) {
      return { id: closest.id, pos: closest.pos };
    }
  }

  // Priority 2: Find nearest between non-empty sources and containers/storage with sufficient energy
  const sources = creep.room.find(FIND_SOURCES_ACTIVE, {
    filter: (s) => s.energy > 0,
  });

  const containers = creep.room.find(FIND_STRUCTURES, {
    filter: (s) =>
      (s.structureType === STRUCTURE_CONTAINER || s.structureType === STRUCTURE_STORAGE) &&
      s.store[RESOURCE_ENERGY] > CONFIG.ENERGY.CONTAINER.MIN_FOR_PICKUP,
  });

  // Combine both lists and find the closest
  const allTargets = [...sources, ...containers];
  if (allTargets.length === 0) {
    return null;
  }

  const closest = creep.pos.findClosestByPath(allTargets);
  if (!closest) {
    return null;
  }

  return { id: closest.id, pos: closest.pos };
};

/**
 * Select action and target based on priority list
 * Pure function - returns decision without side effects
 * @param {Creep} creep
 * @param {Array} priorityList
 * @returns {Object} { action, target }
 */
const selectAction = (creep, priorityList) => {
  const availability = getActionAvailability(creep);
  // console.log(`Action availability for ${creep.name}:`, JSON.stringify(availability));
  const { targets } = availability;

  // Critical repairs always take priority
  if (availability.repairCritical) {
    const repairTarget = targets.criticalRepairs[0];
    return {
      action: "repairing",
      target: { id: repairTarget.id, pos: repairTarget.pos },
    };
  }

  // Check priority list
  for (const action of priorityList) {

    if (availability[action]) {
      switch (action) {
        case "building":
          return { action: "building", target: selectBuildTarget(creep, targets.constructionSites) };
        case "repairing":
          const repairTarget = targets.repairTargets[0];
          return { action: "repairing", target: { id: repairTarget.id, pos: repairTarget.pos } };
        case "harvesting":
          return { action: "harvesting", target: null };
        case "transporting":
          return { action: "transporting", target: { id: targets.storage.id, pos: targets.storage.pos } };
        case "mining":
          return { action: "mining", target: null };
        case "hauling":
          return { action: "hauling", target: null };
        case "delivering":
          return { action: "delivering", target: null };
        case "upgrading":
          return { action: "upgrading", target: null };
        case "deconstructing":
          return { action: "deconstructing", target: targets.deconstructTarget };
        case "attacking":
          return { action: "attacking", target: null };
      }
    }
  }
  // Default fallback
  return { action: "upgrading", target: null };
};

// ============================================================================
// Exports
// ============================================================================

module.exports = {
  needsToGather,
  hasFinishedGathering,
  getActionAvailability,
  selectBuildTarget,
  selectGatheringTarget,
  selectAction,
};
