/**
 * Action Handlers Module
 * Effectful functions that execute specific creep actions
 */

const CONFIG = require("./config");
const utils = require("./utils");
const stats = require("./stats");
const { PATH_COLORS } = require("./creep.constants");
const {
  findRepairTargets,
  findEnergyDepositTargets,
  sortByContention,
} = require("./creep.targetFinding");
const {
  selectGatheringTarget,
  selectBuildTarget,
  getActionAvailability,
} = require("./creep.actionDecisions");
const {
  moveToTarget,
  setCreepAction,
  clearCreepAction,
} = require("./creep.effects");

// ============================================================================
// Action Handlers - Composed Effectful Functions
// ============================================================================

/**
 * Handle gathering action
 * Effectful function
 * @param {Creep} creep
 */
const handleGathering = (creep) => {
  const { actionTarget } = creep.memory;
  if (!actionTarget) {
    // No target set, find one and set it
    const target = selectGatheringTarget(creep);
    if (!target) {
      // No gathering targets available
      clearCreepAction(creep);
      return;
    }
    setCreepAction(creep, "gathering", target);
    return;
  }

  const source = Game.getObjectById(actionTarget.id);

  // Source no longer exists (shouldn't happen with sources, but handle gracefully)
  if (!source) {
    clearCreepAction(creep);
    return;
  }

  // Check if the target is a dropped resource
  const isDroppedResource = source instanceof Resource;

  // Check if the target is a container or storage
  const isContainer =
    source.structureType === STRUCTURE_CONTAINER ||
    source.structureType === STRUCTURE_STORAGE;

  if (isDroppedResource) {
    // Pickup dropped resource
    const result = creep.pickup(source);
    if (result === ERR_NOT_IN_RANGE) {
      moveToTarget(creep, source, PATH_COLORS.gathering);
    } else if (result === OK || result === ERR_FULL) {
      clearCreepAction(creep);
    } else {
      // Resource no longer available or error
      clearCreepAction(creep);
    }
    return;
  }

  // Check if source is empty
  const isEmpty = isContainer
    ? source.store[RESOURCE_ENERGY] === 0
    : source.energy === 0;

  if (isEmpty) {
    // Source is empty, clear action to find a new target on next tick
    clearCreepAction(creep);
    return;
  }

  if (isContainer) {
    // Withdraw from container/storage
    if (creep.withdraw(source, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
      moveToTarget(creep, source, PATH_COLORS.gathering);
    }
  } else {
    // Harvest from source
    const result = creep.harvest(source);
    if (result === ERR_NOT_IN_RANGE) {
      moveToTarget(creep, source, PATH_COLORS.gathering);
    } else if (result === OK) {
      // Track harvested energy (estimate based on WORK parts)
      const workParts = creep.body.filter(p => p.type === WORK).length;
      const harvestAmount = workParts * 2; // Each WORK part harvests 2 energy per tick
      stats.recordHarvest(creep.room.name, source.id, harvestAmount);
    }
  }
};

/**
 * Handle building action
 * Effectful function
 * @param {Creep} creep
 */
const handleBuilding = (creep) => {
  const { actionTarget } = creep.memory;
  if (!actionTarget) {
    clearCreepAction(creep);
    return;
  }

  const target = Game.getObjectById(actionTarget.id);
  const targetPos = actionTarget.pos;

  // Target still exists and needs building
  if (target && target.progress < target.progressTotal) {
    const result = creep.build(target);
    if (result === ERR_NOT_IN_RANGE) {
      moveToTarget(creep, target, PATH_COLORS.building);
    } else if (result === OK) {
      // Track construction work (estimate based on WORK parts)
      const workParts = creep.body.filter(p => p.type === WORK).length;
      const buildAmount = workParts * 5; // Each WORK part builds 5 energy worth per tick
      stats.recordConstruction(creep.room.name, buildAmount);
    }
    return;
  }

  // Construction complete - check if we should switch to repairing
  if (!target && targetPos) {
    const structures = creep.room
      .lookForAt(LOOK_STRUCTURES, targetPos.x, targetPos.y)
      .filter((s) => s.hits < s.hitsMax);

    if (structures.length > 0) {
      console.log(
        `Target construction site ${actionTarget.id} is now a structure. ` +
        `Creep ${creep.name} will switch to repairing it.`,
      );
      setCreepAction(creep, "repairing", {
        id: structures[0].id,
        pos: structures[0].pos,
      });
      return;
    } else {
      const availability = getActionAvailability(creep);
      const { targets } = availability;

      const newTarget = selectBuildTarget(creep, targets.constructionSites);
      if (newTarget) {
        console.log(
          `Target construction site ${actionTarget.id} completed. ` +
          `Creep ${creep.name} will switch to building new target ${newTarget.id}.`,
        );
        setCreepAction(creep, "building", {
          id: newTarget.id,
          pos: newTarget.pos,
        });
        return;
      }
    }

    setCreepAction(creep, "building");
  }

  // Target no longer exists - clear action
  clearCreepAction(creep);
};

/**
 * Handle repairing action
 * Effectful function
 * @param {Creep} creep
 */
const handleRepairing = (creep) => {
  const { actionTarget } = creep.memory;
  if (!actionTarget) {
    clearCreepAction(creep);
    return;
  }

  const target = Game.getObjectById(actionTarget.id);

  // Target exists and needs repair
  if (target && target.hits < target.hitsMax) {
    const result = creep.repair(target);
    if (result === ERR_NOT_IN_RANGE) {
      moveToTarget(creep, target, PATH_COLORS.repairing);
    } else if (result === OK) {
      // Track repair work (estimate based on WORK parts)
      const workParts = creep.body.filter(p => p.type === WORK).length;
      const repairAmount = workParts * 100; // Each WORK part repairs 100 hits per tick
      stats.recordRepair(creep.room.name, repairAmount);
    }
    return;
  }

  // Find next repair target
  console.log(`No repair targets found for creep ${creep.name}`);
  const repairTargets = findRepairTargets(creep);
  if (repairTargets.length > 0) {
    const nextTarget = repairTargets[0];
    setCreepAction(creep, "repairing", {
      id: nextTarget.id,
      pos: nextTarget.pos,
    });
  } else {
    clearCreepAction(creep);
  }
};

/**
 * Handle upgrading action
 * Effectful function
 * @param {Creep} creep
 */
const handleUpgrading = (creep) => {
  const { controller } = creep.room;
  const result = creep.upgradeController(controller);
  if (result === ERR_NOT_IN_RANGE) {
    moveToTarget(creep, controller, PATH_COLORS.upgrading);
  } else if (result === OK) {
    // Track controller upgrade work (based on WORK parts)
    const workParts = creep.body.filter(p => p.type === WORK).length;
    const upgradeAmount = workParts * 1; // Each WORK part upgrades 1 energy per tick
    stats.recordUpgrade(creep.room.name, upgradeAmount);
  }
};

/**
 * Handle harvesting (energy delivery) action
 * Effectful function
 * @param {Creep} creep
 */
const handleHarvesting = (creep) => {
  const { room } = creep;
  const { energyAvailable, energyCapacityAvailable } = room;

  // Check if energy is full - switch to upgrading
  if (energyAvailable >= energyCapacityAvailable) {
    console.log(
      `Energy is full in room ${room.name}. ` +
      `Creep ${creep.name} will switch to upgrading.`,
    );
    setCreepAction(creep, "upgrading", null);
    return;
  }

  const targets = findEnergyDepositTargets(room);
  if (targets.length > 0) {
    if (creep.transfer(targets[0], RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
      moveToTarget(creep, targets[0], PATH_COLORS.harvesting);
    }
  }
};

/**
 * Handle attacking action
 * Effectful function
 * @param {Creep} creep
 */
const handleAttacking = (creep) => {
  const { actionTarget } = creep.memory;
  if (!actionTarget) {
    clearCreepAction(creep);
    return;
  }

  const target = Game.getObjectById(actionTarget.id);

  console.log(`Creep ${creep.name} is attacking target ${actionTarget.id}`);

  // Target no longer exists - clear action
  if (!target) {
    clearCreepAction(creep);
    return;
  }

  // Check what attack parts the creep has
  const hasRangedAttack = creep.body.some((part) => part.type === RANGED_ATTACK);
  const hasMeleeAttack = creep.body.some((part) => part.type === ATTACK);
  const range = creep.pos.getRangeTo(target);

  // Use the most appropriate attack type based on range and available parts
  let attackResult = ERR_NO_BODYPART;

  if (hasRangedAttack && range <= 3) {
    // Use ranged attack if in range (1-3 tiles)
    attackResult = creep.rangedAttack(target);
    console.log(`Attack result for ${creep.name} on target ${target.id}: ${attackResult}`);
  } else if (hasMeleeAttack && range === 1) {
    // Use melee attack if adjacent
    attackResult = creep.attack(target);
  }

  // If attack was successful or we're in position, we're done
  if (attackResult === OK) {
    return;
  }

  // Move closer to target
  if (attackResult === ERR_NOT_IN_RANGE || range > 1) {
    // If we have ranged attack, stay at range 3; if melee only, move to range 1
    const targetRange = hasRangedAttack ? 3 : 1;
    moveToTarget(creep, target, PATH_COLORS.attacking);
  }
};

/**
 * Handle transporting action (move energy from containers to storage)
 * Effectful function
 * @param {Creep} creep
 */
const handleTransporting = (creep) => {
  const { room } = creep;
  const { actionTarget } = creep.memory;

  // Get storage
  const storage = actionTarget ? Game.getObjectById(actionTarget.id) : null;
  if (!storage) {
    clearCreepAction(creep);
    return;
  }

  // Transfer energy to storage
  if (creep.store[RESOURCE_ENERGY] > 0) {
    const result = creep.transfer(storage, RESOURCE_ENERGY);
    if (result === ERR_NOT_IN_RANGE) {
      moveToTarget(creep, storage, PATH_COLORS.transporting);
    } else if (result === OK) {
      // Successfully transferred, clear action to pick up more
      clearCreepAction(creep);
    }
  } else {
    // No energy, clear action to gather more
    clearCreepAction(creep);
  }
};

/**
 * Handle mining action (stationary harvesting at assigned source)
 * Effectful function
 * @param {Creep} creep
 */
const handleMining = (creep) => {
  const { assignedSource } = creep.memory;

  // Get assigned source from memory or find nearest
  let source = null;
  if (assignedSource) {
    source = Game.getObjectById(assignedSource);
  }

  // If no assigned source or source no longer exists, find nearest
  if (!source) {
    const sources = creep.room.find(FIND_SOURCES);
    if (sources.length > 0) {
      source = creep.pos.findClosestByPath(sources);
      if (source) {
        creep.memory.assignedSource = source.id;
      }
    }
  }

  if (!source) {
    // No sources available, this shouldn't happen
    return;
  }

  // Harvest from source
  const result = creep.harvest(source);
  if (result === ERR_NOT_IN_RANGE) {
    moveToTarget(creep, source, PATH_COLORS.mining);
  } else if (result === OK) {
    // Track mined energy (based on WORK parts)
    const workParts = creep.body.filter(p => p.type === WORK).length;
    const harvestAmount = workParts * 2; // Each WORK part harvests 2 energy per tick
    stats.recordHarvest(creep.room.name, source.id, harvestAmount);

    // Mining successfully - check for link deposit first, then container
    // Look for link adjacent to source (link network optimization)
    const links = source.pos.findInRange(FIND_MY_STRUCTURES, 2, {
      filter: (s) => s.structureType === STRUCTURE_LINK,
    });

    // If link exists and has capacity, transfer to it (instant delivery)
    if (
      links.length > 0 &&
      creep.store.getFreeCapacity(RESOURCE_ENERGY) === 0
    ) {
      const link = links[0];
      if (link.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
        const transferResult = creep.transfer(link, RESOURCE_ENERGY);
        if (transferResult === OK) {
          // Successfully transferred to link
          return;
        }
      }
    }

    // Fallback: Look for container at source position
    const containers = source.pos.findInRange(FIND_STRUCTURES, 1, {
      filter: (s) => s.structureType === STRUCTURE_CONTAINER,
    });

    // If creep is full and there's a container nearby, transfer to it
    if (
      creep.store.getFreeCapacity(RESOURCE_ENERGY) === 0 &&
      containers.length > 0
    ) {
      const container = containers[0];
      if (container.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
        creep.transfer(container, RESOURCE_ENERGY);
      }
    }
  }
};

/**
 * Handle hauling action (pickup resources from containers/dropped resources)
 * Effectful function - supports energy and minerals
 * @param {Creep} creep
 */
const handleHauling = (creep) => {
  // If creep is full, switch to delivering
  if (creep.store.getFreeCapacity() === 0) {
    clearCreepAction(creep);
    return;
  }

  const { actionTarget } = creep.memory;

  // Find target if not set
  if (!actionTarget) {
    // Priority 1: Dropped energy (before it decays)
    const droppedEnergy = creep.room.find(FIND_DROPPED_RESOURCES, {
      filter: (r) => r.resourceType === RESOURCE_ENERGY && r.amount > CONFIG.ENERGY.CONTAINER.MIN_DROPPED_RESOURCE,
    });

    if (droppedEnergy.length > 0) {
      const sorted = sortByContention(creep, droppedEnergy, false);
      setCreepAction(creep, "hauling", {
        id: sorted[0].id,
        pos: sorted[0].pos,
        resourceType: RESOURCE_ENERGY,
      });
      return;
    }

    // Priority 2: Storage link with energy (fast energy near spawn area)
    const storage = creep.room.storage;
    if (storage) {
      const storageLink = storage.pos.findInRange(FIND_MY_STRUCTURES, 2, {
        filter: (s) =>
          s.structureType === STRUCTURE_LINK &&
          s.store[RESOURCE_ENERGY] >= 200, // Only use link if it has decent amount
      });

      if (storageLink.length > 0) {
        setCreepAction(creep, "hauling", {
          id: storageLink[0].id,
          pos: storageLink[0].pos,
          resourceType: RESOURCE_ENERGY,
        });
        return;
      }
    }

    // Priority 3: Containers with energy (for spawns/extensions)
    const energyContainers = creep.room.find(FIND_STRUCTURES, {
      filter: (s) =>
        s.structureType === STRUCTURE_CONTAINER && s.store[RESOURCE_ENERGY] > 0,
    });

    if (energyContainers.length > 0) {
      const sorted = sortByContention(creep, energyContainers, false);
      setCreepAction(creep, "hauling", {
        id: sorted[0].id,
        pos: sorted[0].pos,
        resourceType: RESOURCE_ENERGY,
      });
      return;
    }

    // Priority 4: Dropped minerals (RCL 6+)
    const droppedMinerals = creep.room.find(FIND_DROPPED_RESOURCES, {
      filter: (r) => r.resourceType !== RESOURCE_ENERGY && r.amount > CONFIG.ENERGY.CONTAINER.MIN_DROPPED_RESOURCE,
    });

    if (droppedMinerals.length > 0) {
      const sorted = sortByContention(creep, droppedMinerals, false);
      setCreepAction(creep, "hauling", {
        id: sorted[0].id,
        pos: sorted[0].pos,
        resourceType: sorted[0].resourceType,
      });
      return;
    }

    // Priority 5: Containers with minerals (RCL 6+)
    const mineralContainers = creep.room.find(FIND_STRUCTURES, {
      filter: (s) => {
        if (s.structureType !== STRUCTURE_CONTAINER) return false;
        // Check if container has any non-energy resources
        for (const resourceType in s.store) {
          if (resourceType !== RESOURCE_ENERGY && s.store[resourceType] > 0) {
            return true;
          }
        }
        return false;
      },
    });

    if (mineralContainers.length > 0) {
      const sorted = sortByContention(creep, mineralContainers, false);
      const container = sorted[0];
      // Find which mineral type to haul
      let mineralType = null;
      for (const resourceType in container.store) {
        if (resourceType !== RESOURCE_ENERGY && container.store[resourceType] > 0) {
          mineralType = resourceType;
          break;
        }
      }

      if (mineralType) {
        setCreepAction(creep, "hauling", {
          id: container.id,
          pos: container.pos,
          resourceType: mineralType,
        });
        return;
      }
    }

    // No targets available
    clearCreepAction(creep);
    return;
  }

  const target = Game.getObjectById(actionTarget.id);
  if (!target) {
    clearCreepAction(creep);
    return;
  }

  const resourceType = actionTarget.resourceType || RESOURCE_ENERGY;

  // Pickup or withdraw
  let result;
  if (target instanceof Resource) {
    result = creep.pickup(target);
  } else {
    result = creep.withdraw(target, resourceType);
  }

  if (result === ERR_NOT_IN_RANGE) {
    moveToTarget(creep, target, PATH_COLORS.hauling);
  } else if (result === OK || result === ERR_FULL) {
    clearCreepAction(creep);
  } else if (result === ERR_NOT_ENOUGH_RESOURCES) {
    clearCreepAction(creep);
  }
};

/**
 * Handle deconstructing action (dismantle structure at deconstruct flag)
 * Effectful function
 * @param {Creep} creep
 */
const handleDeconstructing = (creep) => {
  const { actionTarget } = creep.memory;
  if (!actionTarget) {
    clearCreepAction(creep);
    return;
  }

  const target = Game.getObjectById(actionTarget.id);

  // Target no longer exists - deconstruction complete
  if (!target) {
    console.log(
      `Deconstruction target ${actionTarget.id} no longer exists. ` +
      `Creep ${creep.name} completed deconstruction.`,
    );
    clearCreepAction(creep);
    return;
  }

  // Deconstruct the target
  const result = creep.dismantle(target);
  if (result === ERR_NOT_IN_RANGE) {
    moveToTarget(creep, target, PATH_COLORS.deconstructing);
  } else if (result === OK) {
    // Successfully deconstructing
  } else {
    console.log(
      `Creep ${creep.name} failed to deconstruct ${target.structureType} ` +
      `at ${target.pos}: error ${result}`,
    );
    clearCreepAction(creep);
  }
};

/**
 * Handle delivering action (deliver energy to spawns/extensions/towers/storage)
 * Effectful function
 * @param {Creep} creep
 */
const handleDelivering = (creep) => {
  const { room } = creep;

  // If creep is empty, switch back to hauling
  if (creep.store[RESOURCE_ENERGY] === 0) {
    clearCreepAction(creep);
    return;
  }

  const { actionTarget } = creep.memory;

  // Find target if not set
  if (!actionTarget) {
    // Priority: Spawn > Towers > Extensions > Storage
    let targets = [];

    // First priority: Spawns
    targets = creep.room.find(FIND_STRUCTURES, {
      filter: (s) =>
        s.structureType === STRUCTURE_SPAWN &&
        s.store.getFreeCapacity(RESOURCE_ENERGY) > 0,
    });

    // Second priority: Towers
    if (targets.length === 0) {
      targets = creep.room.find(FIND_STRUCTURES, {
        filter: (s) =>
          s.structureType === STRUCTURE_TOWER &&
          s.store.getFreeCapacity(RESOURCE_ENERGY) > 0,
      });
    }

    // Third priority: Extensions
    if (targets.length === 0) {
      targets = creep.room.find(FIND_STRUCTURES, {
        filter: (s) =>
          s.structureType === STRUCTURE_EXTENSION &&
          s.store.getFreeCapacity(RESOURCE_ENERGY) > 0,
      });
    }

    // Fallback: Storage
    if (targets.length === 0) {
      targets = creep.room.find(FIND_STRUCTURES, {
        filter: (s) =>
          s.structureType === STRUCTURE_STORAGE &&
          s.store.getFreeCapacity(RESOURCE_ENERGY) > 0,
      });
    }

    if (targets.length === 0) {
      clearCreepAction(creep);
      return;
    }

    const closest = creep.pos.findClosestByPath(targets);
    if (closest) {
      setCreepAction(creep, "delivering", { id: closest.id, pos: closest.pos });
    }
    return;
  }

  const target = Game.getObjectById(actionTarget.id);
  if (!target) {
    clearCreepAction(creep);
    return;
  }

  const result = creep.transfer(target, RESOURCE_ENERGY);
  if (result === ERR_NOT_IN_RANGE) {
    moveToTarget(creep, target, PATH_COLORS.delivering);
  } else if (result === OK || result === ERR_FULL) {
    // Successfully transferred or target is full
    // If creep still has energy, try to find a new delivery target
    if (creep.store[RESOURCE_ENERGY] > 0) {
      // Clear target to find a new one on next tick
      delete creep.memory.actionTarget;
    } else {
      // Creep is empty, switch back to hauling
      clearCreepAction(creep);
    }
  }
};

/**
 * Action handler registry
 * Maps action names to handler functions
 */
const ACTION_HANDLERS = {
  gathering: handleGathering,
  building: handleBuilding,
  repairing: handleRepairing,
  upgrading: handleUpgrading,
  harvesting: handleHarvesting,
  attacking: handleAttacking,
  transporting: handleTransporting,
  mining: handleMining,
  hauling: handleHauling,
  delivering: handleDelivering,
  deconstructing: handleDeconstructing,
};

// ============================================================================
// Exports
// ============================================================================

module.exports = {
  handleGathering,
  handleBuilding,
  handleRepairing,
  handleUpgrading,
  handleHarvesting,
  handleAttacking,
  handleTransporting,
  handleMining,
  handleHauling,
  handleDelivering,
  handleDeconstructing,
  ACTION_HANDLERS,
};
