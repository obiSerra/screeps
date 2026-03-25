/**
 * Base Creep Module
 * Main orchestration for creep behavior management
 * 
 * This module coordinates creep actions using a functional approach,
 * delegating to specialized sub-modules for different concerns.
 */

const utils = require("./utils");
const { isFighter } = require("./creep.analysis");
const { findPrioritizedAttackTarget } = require("./creep.targetFinding");
const {
  needsToGather,
  hasFinishedGathering,
  selectAction,
  selectGatheringTarget,
} = require("./creep.actionDecisions");
const {
  sayAction,
  setCreepAction,
  clearCreepAction,
} = require("./creep.effects");
const { ACTION_HANDLERS } = require("./creep.actionHandlers");

// ============================================================================
// Main Orchestration Functions
// ============================================================================

/**
 * Determine and set the creep's next action
 * Effectful function - modifies creep memory
 * @param {Creep} creep
 * @param {Array} priorityList - Action priority order
 */
const workerActions = (creep, priorityList) => {
  const isTransporter = priorityList.includes("transporting") && creep.body.some((part) => part.type === CARRY);
  const isMiner = priorityList.includes("mining");
  const isHauler = priorityList.includes("hauling") && creep.body.some((part) => part.type === CARRY);

  // Check for combat: if creep is a fighter and there are targets to attack
  if (isFighter(creep)) {
    const target = findPrioritizedAttackTarget(creep);
    if (target) {
      setCreepAction(creep, "attacking", { id: target.id, pos: target.pos });
      sayAction(creep, "attacking");
      return;
    } else {
      console.log(`Fighter ${creep.name} has no attack targets`);
    }
  }

  // If was attacking but no more targets, reset action
  if (creep.memory.action === "attacking") {
    const target = findPrioritizedAttackTarget(creep);
    if (!target) {
      clearCreepAction(creep);
    }
  }

  // Specialized roles (miners, haulers) use their own action selection
  // They don't use the legacy "gathering" action
  if (isMiner || isHauler) {
    // For specialized roles, always use priority-based action selection
    // Clear action if undefined or if it's a legacy action type
    if (
      !creep.memory.action ||
      creep.memory.action === "gathering" ||
      creep.memory.action === "harvesting"
    ) {
      clearCreepAction(creep);
    }

    // Select action from priority list
    const { action, target } = selectAction(creep, priorityList);

    // Only update if action changed or no target set
    if (creep.memory.action !== action || !creep.memory.actionTarget) {
      setCreepAction(creep, action, target);
      sayAction(creep, action);
    }
    return;
  }

  // Legacy behavior for generalist workers (harvesters, upgraders, builders)
  // Check if creep needs to gather
  if (needsToGather(creep) && creep.memory.action !== "gathering") {
    let target;
    if (isTransporter) {
      // Transporters gather from containers at 50%+ capacity
      target = selectTransporterGatheringTarget(creep);
      if (!target) {
        // No containers available, idle
        return;
      }
    } else {
      target = selectGatheringTarget(creep);
      if (!target) {
        // No gathering targets available, idle
        return;
      }
    }
    setCreepAction(creep, "gathering", target);
    sayAction(creep, "gathering");
    return;
  }

  // Check if creep has finished gathering and needs new action
  if (hasFinishedGathering(creep)) {
    const { action, target } = selectAction(creep, priorityList);
    setCreepAction(creep, action, target);
    sayAction(creep, action);
  }
};

/**
 * Execute the creep's current action
 * Effectful function - performs game actions
 * @param {Creep} creep
 * @param {string} action
 */
const performAction = (creep, action) => {
  sayAction(creep, action);

  const handler = ACTION_HANDLERS[action];
  if (handler) {
    handler(creep);
  } else {
    console.log(`Unknown action ${action} for creep ${creep.name}`);
    clearCreepAction(creep);
  }
};

// ============================================================================
// Legacy Compatibility Layer
// ============================================================================

/**
 * Legacy baseCreep object for backward compatibility
 * Wraps functional implementation
 */
const baseCreep = {
  findSource: utils.findBestSourceForCreep,
  workerActions,
  performAction,
};

// ============================================================================
// Exports
// ============================================================================

module.exports = {
  // Main API
  baseCreep,
  
  // Used by roomOrchestrator
  isFighter,
  
  // Main orchestration functions
  workerActions,
  performAction,
};
