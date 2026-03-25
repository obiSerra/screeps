/**
 * Creep Analysis Module
 * Pure functions for analyzing creep capabilities and properties
 */

const { ACTION_BODY_REQUIREMENTS } = require("./creep.constants");

// ============================================================================
// Pure Functions - Creep Analysis
// ============================================================================

/**
 * Check if creep is a fighter (has attack parts)
 * Pure function
 * @param {Creep} creep
 * @returns {boolean} True if creep has ATTACK or RANGED_ATTACK parts
 */
const isFighter = (creep) =>
  creep.body.some(
    (part) => part.type === ATTACK || part.type === RANGED_ATTACK,
  );

/**
 * Check if creep can perform a specific action based on body parts
 * Pure function
 * @param {Creep} creep
 * @param {string} action - Action name to validate
 * @returns {boolean} True if creep has required body parts for action
 */
const canPerformAction = (creep, action) => {
  const hasBodyPart = (partType) =>
    creep.body.some((bodyPart) => bodyPart.type === partType);
  
  const hasWork = hasBodyPart(WORK);
  const hasCarry = hasBodyPart(CARRY);
  
  // Special cases that require specific part combinations
  switch (action) {
    case "harvesting":
      // Harvesting requires BOTH WORK (to harvest) and CARRY (to store energy)
      return hasWork && hasCarry;
    
    case "transporting":
      // Transporting is CARRY-only (picking up/dropping off resources)
      return hasCarry;
    case "hauling":
      // Hauling is CARRY-only (picking up dropped resources/from containers)
      return hasCarry;
    
    case "mining":
      // Mining is WORK-only (harvest and drop on ground for others to haul)
      return hasWork && !hasCarry;
    
    case "upgrading":
      // Upgrading requires BOTH WORK (to upgrade) and CARRY (to hold energy)
      return hasWork && hasCarry;
    
    case "building":
    case "repairing":
    case "deconstructing":
      // These actions require WORK and CARRY (need to hold energy to build/repair)
      return hasWork && hasCarry;
  }
  
  // For other actions, check if creep has at least ONE of the required parts
  const requiredParts = ACTION_BODY_REQUIREMENTS[action];
  
  // If action has no requirements defined, allow it (permissive default)
  if (!requiredParts || requiredParts.length === 0) {
    return true;
  }
  
  return requiredParts.some((requiredPart) => hasBodyPart(requiredPart));
};

// ============================================================================
// Exports
// ============================================================================

module.exports = {
  isFighter,
  canPerformAction,
};
