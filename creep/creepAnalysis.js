/**
 * Creep Analysis Module
 * Pure functions for analyzing creep capabilities and properties
 */

const { ACTION_BODY_REQUIREMENTS } = require("./constants");

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
  const requiredParts = ACTION_BODY_REQUIREMENTS[action];
  
  // If action has no requirements defined, allow it (permissive default)
  if (!requiredParts || requiredParts.length === 0) {
    return true;
  }
  
  // Check if creep has at least ONE of the required parts
  return requiredParts.some((requiredPart) =>
    creep.body.some((bodyPart) => bodyPart.type === requiredPart)
  );
};

// ============================================================================
// Exports
// ============================================================================

module.exports = {
  isFighter,
  canPerformAction,
};
