# Flag System Documentation

## Overview

This document describes all flag-driven behaviors in the Screeps codebase. The flag system has been centralized into a single module (`flagManager.js`) that provides a unified interface for managing and querying flags throughout the project.

## Architecture

### Centralized Flag Manager

**Module**: `flagManager.js`

The flag manager provides:
- **Per-tick caching**: All flag lookups are cached per game tick to minimize repeated `Game.flags` accesses
- **Pattern-based queries**: Efficient retrieval of flags matching specific naming patterns
- **Pure functions**: All functions are stateless (except for per-tick cache)
- **Type safety**: Consistent flag type constants and validation

### Design Principles

1. **Single Source of Truth**: All flag-related logic goes through `flagManager.js`
2. **Performance**: Per-tick caching prevents redundant lookups
3. **Functional Programming**: Small, reusable, composable functions
4. **Clean Abstractions**: High-level functions hide flag naming conventions

## Flag Types

### 1. Rally Flag

**Name**: `rally`

**Purpose**: Activates rally mode for all creeps, causing them to move to a central gathering point.

**Behavior**:
- When present, creeps prioritize moving to the rally flag location
- Used for coordinating mass movements or defensive positioning
- Checked in `creep.actionDecisions.js` via `flagManager.isRallyModeActive()`

**Usage**:
```javascript
// Check if rally mode is active
const hasRallyFlag = flagManager.isRallyModeActive();

// Get rally flag instance
const rallyFlag = flagManager.getRallyFlag();
```

**Files Using**: 
- `creep.actionDecisions.js` - Decision logic to prioritize rally movement
- `creep.actionHandlers.js` - Implements the rally movement behavior

---

### 2. Attack Flags

**Names**: 
- `attack` (default attack force)
- `attack_X` where X is a number (specifies exact force size)

**Purpose**: Marks target rooms for offensive operations and optionally specifies the number of fighters to spawn.

**Behavior**:
- `attack`: Spawns default attack force (configured in `CONFIG.OFFENSIVE.DEFAULT_ATTACK_COUNT`)
- `attack_X`: Spawns exactly X fighters to attack the flagged location
- Multiple attack flags can be active simultaneously
- Fighters move to the nearest attack flag and engage hostiles
- **Fighter fallback**: When no targets visible, fighters use "rally" action to stay combat-ready (fixed March 30, 2026)

**Recent Fix**: Fighters no longer fall back to worker actions ("delivering", "transporting") when at attack flags with no visible enemies. They now maintain combat readiness via "rally" action.

**Usage**:
```javascript
// Get all attack flags with parsed counts
const attackFlags = flagManager.getAttackFlags();
// Returns: [{name, flag, count}, ...]

// Find nearest attack flag for a creep
const nearestFlag = flagManager.findNearestAttackFlag(creep);

// Check if any attack operations are active
const isAttacking = flagManager.hasActiveAttackOperations();

// Get total attack force size
const totalFighters = flagManager.getTotalAttackForceSize();
```

**Files Using**:
- `creep.targetFinding.js` - Identifies attack targets and finds nearest attack flag
- `role.explorer.js` - Explorers scout attack flag locations
- `spawnerRoster.js` - Determines how many fighters to spawn
- `main.js` - Global `attackStatus()` function for debugging
- `role.fighterShooter.js` - Ranged attack fighters (fixed fallback behavior)
- `role.fighterHealer.js` - Healer fighters (fixed fallback behavior)
- `role.fighterFodder.js` - Melee fodder fighters (fixed fallback behavior)
- `role.fighterInvader.js` - Balanced fighters (fixed fallback behavior)

---

### 3. Claim Flag

**Name**: `claim`

**Purpose**: Marks a room to be claimed by a claimer creep.

**Behavior**:
- Spawns a claimer creep when flag is present
- Claimer moves to the flag's room and claims the controller
- Used for expanding to new rooms

**Usage**:
```javascript
// Check if claim flag exists
const hasClaim = flagManager.hasFlag('claim');

// Get claim flag instance
const claimFlag = flagManager.getClaimFlag();
```

**Files Using**:
- `role.claimer.js` - Claimer creeps navigate to and claim the controller
- `role.explorer.js` - Explorers can scout claim flag locations
- `spawnerHelpers.js` - Spawns claimer when flag is present

---

### 4. Explore Flag

**Name**: `explore`

**Purpose**: Directs explorer creeps to specific rooms for scouting.

**Behavior**:
- Explorer creeps move to the explore flag location
- Used to gather room intelligence (hostiles, sources, structures)
- Helps with strategic planning and threat assessment

**Usage**:
```javascript
// Get explore flag instance
const exploreFlag = flagManager.getExploreFlag();
```

**Files Using**:
- `role.explorer.js` - Implements exploration behavior

---

### 5. Deconstruct Flag

**Name**: `deconstruct`

**Purpose**: Marks a structure to be dismantled by builder creeps.

**Behavior**:
- Builder creeps prioritize dismantling the structure at the flag location
- Used to remove unwanted or misplaced structures
- Provides resource recovery from dismantled structures

**Usage**:
```javascript
// Get deconstruct flag instance
const deconstructFlag = flagManager.getDeconstructFlag();
```

**Files Using**:
- `creep.targetFinding.js` - Builders find structures to dismantle near the flag

---

### 6. Priority Build Flag

**Name**: `priority_build`

**Purpose**: Marks a high-priority construction site for builders.

**Behavior**:
- Builders prioritize construction sites near this flag
- Used to expedite critical structures (towers, spawn, walls)
- Overrides normal construction priority logic

**Usage**:
```javascript
// Get priority build flag instance
const priorityBuildFlag = flagManager.getPriorityBuildFlag();
```

**Files Using**:
- `creep.targetFinding.js` - Builders find priority construction targets

---

### 7. Remote Source Flags

**Names**: `source_X` where X is a number (source ID)

**Purpose**: Marks remote sources for harvesting outside the main room.

**Behavior**:
- Identifies sources in neighboring rooms for remote harvesting
- Each flag corresponds to a specific remote source
- Miners spawn with `remoteSourceId` and navigate to remote room
- Haulers spawn with `isRemoteHauler` and transport energy back to spawn room
- Hauler count scales with distance (1 base + 1 per 50 tiles with multiplier)
- Requires `CONFIG.REMOTE_HARVESTING.ENABLED = true`

**Implementation Status**: ✅ **FULLY IMPLEMENTED** (as of March 30, 2026)

**Usage**:
```javascript
// Get all remote source flags
const remoteFlags = flagManager.getRemoteSourceFlags();
// Returns: [{name, flag, sourceId}, ...]

// Check if remote harvesting is configured
const hasRemote = flagManager.hasRemoteHarvestingFlags();

// Get remote harvesting needs for a room
const needs = flagManager.getRemoteHarvestingNeeds(room);
// Returns: {miners: N, haulers: M, sources: [{sourceId, flagName, distance}]}
```

**Files Using**:
- `spawnerRoster.js` - Calculates remote harvesting needs with `getRemoteHarvestingNeeds()`
- `spawnerHelpers.js` - Priority check `checkRemoteHarvestingPriority()` spawns remote creeps
- `spawner.js` - Integrated into spawning priority chain (Priority 2.5)
- `spawnerCore.js` - Enhanced `trySpawn()` to accept remote source assignments
- `role.miner.js` - Remote navigation logic for miners with `remoteSourceId`
- `role.hauler.js` - Remote hauling behavior for haulers with `isRemoteHauler`

**Memory Properties**:
- Remote Miners: `creep.memory.remoteSourceId` (number), `creep.memory.remoteFlagName` (string)
- Remote Haulers: `creep.memory.isRemoteHauler` (boolean)

**Configuration**:
```javascript
// In config.js
CONFIG.REMOTE_HARVESTING: {
    ENABLED: true,                          // Master switch
    DISTANCE_PENALTY_MULTIPLIER: 1.5,       // Hauler scaling factor
    AVOID_HOSTILE_ROOMS: false,             // Not yet implemented
    FLAG_PATTERN: /^source_\d+$/,           // source_0, source_1, etc.
    DEFAULT_DISTANCE: 100                   // Fallback distance
}
```

---

### 8. Planner Flags (Structure Planning)

**Names**: `XXX_S_N` pattern
- `XXX`: 3-letter structure code (e.g., `SPA`, `EXT`, `TOW`)
- `S`: Stage number (RCL when structure should be built)
- `N`: Unique identifier (index)

**Purpose**: Marks planned locations for structures in a room layout.

**Structure Codes**:
- `SPA`: Spawn
- `EXT`: Extension
- `ROA`: Road
- `WAL`: Wall
- `RAM`: Rampart
- `LNK`: Link
- `STO`: Storage
- `TOW`: Tower
- `OBS`: Observer
- `PWR`: Power Spawn
- `EXR`: Extractor
- `LAB`: Lab
- `TER`: Terminal
- `CON`: Container
- `NUK`: Nuker
- `FAC`: Factory

**Behavior**:
- Created by the room planner module (`planner.js`)
- Marks precise positions for structures in an optimized layout
- Automatically removed when the structure is built
- Used to create construction sites at appropriate RCL stages

**Usage**:
```javascript
// Get all planner flags, optionally filtered by room
const plannerFlags = flagManager.getPlannerFlags(room);
// Returns: [{name, flag, structureCode, stage, id}, ...]

// Get planner flags for specific structure type
const extensions = flagManager.getPlannerFlags(room)
  .filter(item => item.structureCode === 'EXT');
```

**Files Using**:
- `planner.js` - Creates, manages, and removes planner flags
- `roomOrchestrator.js` - Counts planned extensions for room management

---

## API Reference

### Core Functions

#### `getFlag(name)`
Get a flag by name (cached).
- **Parameters**: `name` (string) - Flag name
- **Returns**: `Flag` object or `null`

#### `hasFlag(name)`
Check if a flag exists.
- **Parameters**: `name` (string) - Flag name
- **Returns**: `boolean`

#### `getFlags(names)`
Get multiple flags by names.
- **Parameters**: `names` (Array<string>) - Array of flag names
- **Returns**: `Array<Flag>` - Array of flag objects (excludes non-existent)

#### `getAllFlags()`
Get all flags (cached).
- **Returns**: `Object` - All flags from `Game.flags`

### Pattern-Based Queries

#### `getFlagsByPattern(pattern)`
Get all flags matching a regex pattern.
- **Parameters**: `pattern` (RegExp) - Regex to match flag names
- **Returns**: `Array<{name, flag, match}>` - Flags with regex matches

#### `getAttackFlags()`
Get all attack flags with parsed force counts.
- **Returns**: `Array<{name, flag, count}>`

#### `getRemoteSourceFlags()`
Get all remote source flags.
- **Returns**: `Array<{name, flag, sourceId}>`

#### `getPlannerFlags(room)`
Get all structure planner flags.
- **Parameters**: `room` (Room, optional) - Filter by room
- **Returns**: `Array<{name, flag, structureCode, stage, id}>`

### Command Flag Accessors

Simple accessors for common command flags:
- `getRallyFlag()` → `Flag|null`
- `getClaimFlag()` → `Flag|null`
- `getExploreFlag()` → `Flag|null`
- `getDeconstructFlag()` → `Flag|null`
- `getPriorityBuildFlag()` → `Flag|null`

### Proximity Helpers

#### `findNearestFlag(pos, flags, usePath)`
Find the nearest flag from a list.
- **Parameters**: 
  - `pos` (RoomPosition) - Position to measure from
  - `flags` (Array<Flag>) - Flags to search
  - `usePath` (boolean, default: true) - Use pathfinding vs range
- **Returns**: `Flag|null`

#### `findNearestAttackFlag(creep)`
Find the nearest attack flag for a creep.
- **Parameters**: `creep` (Creep)
- **Returns**: `Flag|null`

#### `isFlagInRoom(flag, roomOrPos)`
Check if flag is in the same room.
- **Parameters**: 
  - `flag` (Flag)
  - `roomOrPos` (Room|RoomPosition)
- **Returns**: `boolean`

#### `getDistanceToFlag(pos, flag, linear)`
Get distance to flag.
- **Parameters**: 
  - `pos` (RoomPosition)
  - `flag` (Flag)
  - `linear` (boolean, default: true) - Linear vs path distance
- **Returns**: `number` - Distance or Infinity

### State Queries

#### `isRallyModeActive()`
Check if rally mode is active.
- **Returns**: `boolean`

#### `hasActiveAttackOperations()`
Check if any attack operations are active.
- **Returns**: `boolean`

#### `hasRemoteHarvestingFlags()`
Check if remote harvesting is configured with flags.
- **Returns**: `boolean`

#### `getTotalAttackForceSize()`
Get total attack force size across all attack flags.
- **Returns**: `number`

---

## Migration Summary

### What Changed

**Before**: Direct `Game.flags` access scattered throughout the codebase
```javascript
// Old pattern
for (const flagName in Game.flags) {
  const flag = Game.flags[flagName];
  // ... logic
}
```

**After**: Centralized flag manager with caching and typed queries
```javascript
// New pattern
const attackFlags = flagManager.getAttackFlags();
for (const {name, flag, count} of attackFlags) {
  // ... logic
}
```

### Files Refactored

1. **planner.js**: Refactored planner flag management
   - `getPlannedStructures()` → uses `flagManager.getPlannerFlags()`
   - `placeStructureFlag()` → uses `flagManager.hasFlag()`
   - `clearPlannerFlags()` → uses `flagManager.getPlannerFlags()`

2. **roomOrchestrator.js**: Refactored extension counting
   - Extension planning → uses `flagManager.getPlannerFlags()`

3. **main.js**: Refactored attack status global function
   - `attackStatus()` → uses `flagManager.getAttackFlags()`

4. **Already using flagManager** (from earlier work):
   - `creep.actionDecisions.js`
   - `creep.actionHandlers.js`
   - `creep.targetFinding.js`
   - `role.claimer.js`
   - `role.explorer.js`
   - `spawnerHelpers.js`
   - `spawnerRoster.js`

### Benefits

1. **Performance**: Per-tick caching prevents redundant `Game.flags` lookups
2. **Maintainability**: Single source of truth for flag logic
3. **Type Safety**: Explicit flag type constants and structured return values
4. **Testability**: Pure functions are easier to test
5. **Extensibility**: Easy to add new flag types or behaviors

---

## Best Practices

### Adding New Flag Types

1. Add flag type constant to `FLAG_TYPES` in `flagManager.js`
2. If pattern-based, add pattern to `FLAG_PATTERNS`
3. Create accessor function (e.g., `getMyNewFlag()`)
4. Add to exports
5. Document in this file

### Performance Considerations

- Always use `flagManager` functions instead of `Game.flags`
- Per-tick cache is automatic - no need to cache in calling code
- Use pattern-based queries for bulk lookups instead of individual `getFlag()` calls

### Naming Conventions

- **Simple command flags**: Use lowercase single words (`rally`, `claim`, `explore`)
- **Numbered variants**: Use underscore suffix (`attack_5`, `source_2`)
- **Structure planning**: Use `XXX_S_N` pattern with 3-letter codes

---

## Examples

### Example 1: Spawning Fighters for Attack Operations

```javascript
const flagManager = require('./flagManager');

// Get all attack flags with counts
const attackFlags = flagManager.getAttackFlags();

// Calculate how many fighters we need in total
const totalNeeded = flagManager.getTotalAttackForceSize();

// Check current fighter count
const currentFighters = Object.values(Game.creeps)
  .filter(c => c.memory.role === 'fighter').length;

// Spawn more if needed
if (currentFighters < totalNeeded) {
  // Spawn fighter logic...
}
```

### Example 2: Builder Prioritization

```javascript
const flagManager = require('./flagManager');

function findBuildTarget(creep) {
  // Check for priority build flag first
  const priorityFlag = flagManager.getPriorityBuildFlag();
  if (priorityFlag) {
    const sites = creep.room.lookForAt(LOOK_CONSTRUCTION_SITES, priorityFlag.pos);
    if (sites.length > 0) return sites[0];
  }
  
  // Fall back to normal construction site logic
  return creep.pos.findClosestByPath(FIND_CONSTRUCTION_SITES);
}
```

### Example 3: Remote Harvesting Setup

```javascript
const flagManager = require('./flagManager');

// Check if remote harvesting is enabled and configured
if (flagManager.hasRemoteHarvestingFlags()) {
  const remoteFlags = flagManager.getRemoteSourceFlags();
  
  for (const {flag, sourceId} of remoteFlags) {
    // Spawn miner for this source
    // Spawn hauler for this source
  }
}
```

---

## Troubleshooting

### Flag Not Being Recognized

1. Check flag name spelling and format
2. Verify flag is in the correct room (for room-filtered queries)
3. Ensure flag actually exists in game: `console.log(JSON.stringify(Game.flags))`

### Performance Issues

1. Verify you're using `flagManager` functions (benefit from caching)
2. Check if you're calling flag functions in tight loops unnecessarily
3. Use pattern-based queries instead of multiple individual lookups

### Cache Not Updating

The cache automatically resets every game tick. If flags seem stale:
1. Check `Game.time` is incrementing
2. Verify you're not running code in between ticks
3. Test with `flagManager.getAllFlags()` to see raw flag state

---

## Future Enhancements

Potential improvements to the flag system:

1. **Flag Priority System**: Assign priorities to flags for conflict resolution
2. **Flag Expiry**: Auto-remove flags after X ticks
3. **Flag Validation**: Validate flag positions before creating
4. **Flag History**: Track flag creation/deletion for analytics
5. **Visual Debugging**: Console commands to visualize flag effects
6. **Multi-room Coordination**: Cross-room flag synchronization

---

## Related Documentation

- [Screeps API Documentation](https://docs.screeps.com/)
- [CONFIG Module](../config.js) - Flag-related configuration constants
- [Room Planner](../planner.js) - Structure planning system
- [Spawner Module](../spawner.js) - Creep spawning logic

---

*Last Updated: March 30, 2026*
*Maintainer: LLM Agent*
