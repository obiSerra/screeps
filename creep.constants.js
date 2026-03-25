/**
 * Creep Module Constants
 * Configuration values, icons, colors, and body part requirements
 */

const CONFIG = require("./config");

// ============================================================================
// Repair Thresholds
// ============================================================================

const CRITICAL_HITS = CONFIG.REPAIR.CRITICAL_HITS;
const WALL_MIN_HITS = CONFIG.REPAIR.WALL_MIN_HITS;
const RAMPART_MIN_HEALTH_PERCENT = CONFIG.REPAIR.RAMPART_MIN_HEALTH_PERCENT;
const STRUCTURE_MIN_HEALTH_PERCENT = CONFIG.REPAIR.STRUCTURE_MIN_HEALTH_PERCENT;

// ============================================================================
// Visual Indicators
// ============================================================================

const ACTION_ICONS = {
  gathering: "🔄",
  building: "🚧",
  repairing: "🛠",
  upgrading: "⚡",
  harvesting: "⛏",
  claiming: "📜",
  attacking: "⚔️",
  transporting: "📦",
  mining: "⛏️",
  hauling: "🚚",
  delivering: "📬",
  deconstructing: "🔨",
};

const PATH_COLORS = {
  gathering: "#ffaa00",
  building: "#ffffff",
  repairing: "#00ff22",
  upgrading: "#ffaa00",
  harvesting: "#0004ff",
  attacking: "#ff0000",
  transporting: "#ff8800",
  mining: "#ffaa00",
  hauling: "#00aaff",
  delivering: "#0004ff",
  deconstructing: "#ff6600",
};

// ============================================================================
// Body Part Requirements
// ============================================================================

const ACTION_BODY_REQUIREMENTS = {
  building: [WORK],
  repairing: [WORK],
  upgrading: [WORK],
  mining: [WORK],
  deconstructing: [WORK],
  gathering: [CARRY],
  harvesting: [CARRY],
  transporting: [CARRY],
  hauling: [CARRY],
  delivering: [CARRY],
  attacking: [ATTACK, RANGED_ATTACK], // Requires at least one
};

// ============================================================================
// Exports
// ============================================================================

module.exports = {
  CRITICAL_HITS,
  WALL_MIN_HITS,
  RAMPART_MIN_HEALTH_PERCENT,
  STRUCTURE_MIN_HEALTH_PERCENT,
  ACTION_ICONS,
  PATH_COLORS,
  ACTION_BODY_REQUIREMENTS,
};
