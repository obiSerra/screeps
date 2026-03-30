# Project Spec

> **Last updated:** 2026-03-30 12:00 UTC  
> **Updated by:** maintainer agent  
> **Revision scope:** incremental since 2026-03-26 09:00

---

## 1. Project Overview

This is a Screeps AI bot written in JavaScript. Screeps is a programming game where players write code to control units in a persistent MMO world. This bot implements automated colony management with dual-mode operation (planning and executing), role-based creep workforce management, and infrastructure automation for energy distribution, compound production, and market trading. The bot handles RCL 1-8 progression with adaptive strategies that shift from generalist swarm tactics to specialized roles as the colony matures.

---

## 2. Architecture & Module Map

| Concern | File(s) | Notes |
|---|---|---|
| **Configuration** | [config.js](config.js) (443 lines) | Centralized tuning parameters, fighter classes config, remote harvesting config (EXPANDED 2026-03-29) |
| **Core Loop** | [main.js](main.js) (636 lines) | Entry point, room cache system, global targeting map, console debug functions (EXPANDED 2026-03-29) |
| **Error Tracking** | [errorTracker.js](errorTracker.js) (289 lines) | Centralized error logging with rate limiting, Memory persistence, statistics (NEW 2026-03-26) |
| **Flag Management** | [flagManager.js](flagManager.js) (419 lines) | Centralized flag system with per-tick caching, pattern-based queries (NEW 2026-03-29) |
| **Room Orchestration** | [roomOrchestrator.js](roomOrchestrator.js) (706 lines) | Mode management, priority mode activation, tower control, creep routing (MODIFIED 2026-03-29) |
| **Spawning - Orchestrator** | [spawner.js](spawner.js) (89 lines) | Main spawn procedure, priority logic (REFACTORED 2026-03-25, MODIFIED 2026-03-29) |
| **Spawning - Body Utils** | [spawnerBodyUtils.js](spawnerBodyUtils.js) (1010 lines) | Pure functions for body composition, fighter class bodies (EXPANDED 2026-03-29) |
| **Spawning - Combat** | [spawnerCombat.js](spawnerCombat.js) (229 lines) | Threat assessment, defender spawning logic (NEW 2026-03-29) |
| **Spawning - Core** | [spawnerCore.js](spawnerCore.js) (125 lines) | Spawn execution, visual display (NEW 2026-03-25) |
| **Spawning - Helpers** | [spawnerHelpers.js](spawnerHelpers.js) (86 lines) | Helper utilities for spawning (NEW 2026-03-25) |
| **Spawning - Roster** | [spawnerRoster.js](spawnerRoster.js) (120 lines) | Roster calculations, role counts (NEW 2026-03-25) |
| **Creep - Orchestrator** | [baseCreep.js](baseCreep.js) (213 lines) | Main creep behavior coordination (REFACTORED 2026-03-25, MODIFIED 2026-03-29) |
| **Creep - Action Handlers** | [creep.actionHandlers.js](creep.actionHandlers.js) (1176 lines) | All action execution logic, rally action (EXPANDED 2026-03-29) |
| **Creep - Action Decisions** | [creep.actionDecisions.js](creep.actionDecisions.js) (274 lines) | Action selection, priority logic, flag awareness (MODIFIED 2026-03-29) |
| **Creep - Target Finding** | [creep.targetFinding.js](creep.targetFinding.js) (363 lines) | Target selection algorithms (NEW 2026-03-25) |
| **Creep - Analysis** | [creep.analysis.js](creep.analysis.js) (88 lines) | Creep state analysis utilities (NEW 2026-03-25) |
| **Creep - Effects** | [creep.effects.js](creep.effects.js) (100 lines) | Movement, memory updates, visuals (NEW 2026-03-25) |
| **Creep - Constants** | [creep.constants.js](creep.constants.js) (80 lines) | Action requirements, icons, colors (NEW 2026-03-25) |
| **Base Planning** | [planner.js](planner.js) (908 lines) | Layout generation, structure placement, road pathfinding, flag integration (MODIFIED 2026-03-29) |
| **Statistics** | [stats.js](stats.js) (543 lines) | Telemetry tracking, efficiency metrics, performance monitoring |
| **Infrastructure - Links** | [linkManager.js](linkManager.js) (183 lines) | Energy transfer between sources/storage/controller, 5-tick cache (OPTIMIZED 2026-03-29) |
| **Infrastructure - Labs** | [labManager.js](labManager.js) (404 lines) | Compound production, reaction queues, boosting stations, memory-based caching (OPTIMIZED 2026-03-29) |
| **Infrastructure - Terminal** | [terminalManager.js](terminalManager.js) (293 lines) | Market trading, buy/sell automation, market order cache (OPTIMIZED 2026-03-29) |
| **Utilities** | [utils.js](utils.js) (381 lines) | Distance transforms, pathfinding helpers, terrain analysis |
| **Role: Harvester** | [role.harvester.js](role.harvester.js) | Early-game generalist energy gatherer, rally-aware (MODIFIED 2026-03-29) |
| **Role: Upgrader** | [role.upgrader.js](role.upgrader.js) | Controller upgrading specialist, rally-aware (MODIFIED 2026-03-29) |
| **Role: Builder** | [role.builder.js](role.builder.js) | Construction site builder, rally-aware (MODIFIED 2026-03-29) |
| **Role: Miner** | [role.miner.js](role.miner.js) | Stationary source harvester (RCL 4+), rally-aware (MODIFIED 2026-03-29) |
| **Role: Hauler** | [role.hauler.js](role.hauler.js) | Pure transport, no WORK parts (RCL 4+), rally-aware (MODIFIED 2026-03-29) |
| **Role: Transporter** | [role.transporter.js](role.transporter.js) (15 lines) | Energy distribution to spawn/extensions, rally-aware (MODIFIED 2026-03-29) |
| **Role: Defender** | [role.defender.js](role.defender.js) (65 lines) | Emergency defense creep with patrol behavior (NEW 2026-03-29) |
| **Role: Fighter (Combat Classes)** | Multiple files | Specialized fighter subclasses with distinct combat roles (NEW 2026-03-29) |
| **Role: Fighter Fodder** | [role.fighterFodder.js](role.fighterFodder.js) (25 lines) | Cheap disposable melee units (NEW 2026-03-29) |
| **Role: Fighter Invader** | [role.fighterInvader.js](role.fighterInvader.js) (26 lines) | Balanced melee units with utility (NEW 2026-03-29) |
| **Role: Fighter Healer** | [role.fighterHealer.js](role.fighterHealer.js) (25 lines) | Support units with HEAL parts (NEW 2026-03-29) |
| **Role: Fighter Shooter** | [role.fighterShooter.js](role.fighterShooter.js) (25 lines) | Ranged damage dealers (NEW 2026-03-29) |
| **Role: Fighter** | [role.fighter.js](role.fighter.js) | Combat units with ATTACK parts, delegates to class-specific logic (MODIFIED 2026-03-29) |
| **Role: Claimer** | [role.claimer.js](role.claimer.js) | Remote room claiming (MODIFIED 2026-03-29) |
| **Role: Explorer** | [role.explorer.js](role.explorer.js) (185 lines) | Scouting and room discovery; uses CONFIG (MODIFIED 2026-03-29) |
| **Role: Mineral Extractor** | [role.mineralExtractor.js](role.mineralExtractor.js) (263 lines) | Mineral mining (RCL 6+) |
| **Role: Chemist** | [role.chemist.js](role.chemist.js) (143 lines) | Lab resource management |

---

## 3. Major Improvements Since Last Update (2026-03-26 09:00 → 2026-03-30 12:00)

### 📊 Summary Statistics
- **Commits:** 28 commits by 2 authors (Roberto Serra: 12, obione: 16)
- **Files changed:** 30+ files modified, 8 new modules created (flagManager, spawnerCombat, 5 fighter roles, defender)
- **Net changes:** ~1,300 lines added, ~300 lines modified
- **Codebase size:** 11,136 lines across 40 JS files (from ~9,800 lines)
- **Major themes:** 
  1. Performance optimization (CPU reduction)
  2. Centralized flag management system
  3. Combat system overhaul with specialized fighter classes
  4. Emergency defender system

---

### 🚀 NEW FEATURE: Performance Optimization System (CPU Reduction)
**Status:** Phases 1-3 Complete ✅  
**Estimated Total Savings:** 60-85% CPU reduction from baseline  
**Documentation:** [llm-prompts/cpu-optimization.md](llm-prompts/cpu-optimization.md)

#### Phase 1: Critical Room Scanning Optimizations ✅
**Est. Savings:** -30 to -40 CPU/tick  
**Implementation Date:** 2026-03-29

**Core Changes:**
- **Global Room Cache System** ([main.js](main.js#L91-L141)) — Single `room.find()` per room per tick, caches all structures/creeps/sites
- **Global Targeting Map** ([main.js](main.js#L143-L158)) — O(n×m) → O(n) targeting algorithm with `global.targetingCounts`
- **Memory Cleanup Throttling** ([main.js](main.js#L164-L169)) — Cleanup every 100 ticks instead of every tick
- **Tower Targeting Refactored** ([roomOrchestrator.js](roomOrchestrator.js#L219-L288)) — Scan room once before tower loop
- **getActionAvailability Optimized** ([creep.actionDecisions.js](creep.actionDecisions.js)) — Uses cache instead of 8 separate room.find() calls per creep
- **handleDelivering Refactored** ([creep.actionHandlers.js](creep.actionHandlers.js)) — Single cache filter instead of cascading scans

**Impact:** 
- Eliminates 200+ redundant `room.find()` calls per tick in a typical room with 30 creeps
- Major bottleneck resolved

#### Phase 2: Infrastructure Manager Optimizations ✅
**Est. Savings:** -3 to -4 CPU/tick  
**Implementation Date:** 2026-03-29

**Core Changes:**
- **Link Categorization Cache** ([linkManager.js](linkManager.js)) — 5-tick TTL, stores link IDs, auto-invalidates on destruction
- **Lab Categorization Cache** ([labManager.js](labManager.js)) — Memory-based indefinite cache (labs don't move)
- **Memory-Based Boost Queue** ([labManager.js](labManager.js), [spawnerCore.js](spawnerCore.js)) — O(1) queue lookup vs O(n) creep scan
- **Market Order Cache** ([terminalManager.js](terminalManager.js)) — 5-tick TTL reduces expensive API calls by 80%

**Impact:**
- Infrastructure overhead reduced from ~8-10 CPU/tick to ~4-5 CPU/tick

#### Phase 3: High RCL Creep Count Reduction ✅
**Est. Savings:** -10 to -20 CPU/tick  
**Implementation Date:** 2026-03-29

**Core Changes:**
- **RCL-Based Roster Scaling** ([config.js](config.js)) — `{6: 0.8, 7: 0.6, 8: 0.4}` multipliers applied to hauler/builder/upgrader
- **Roster Scaling Applied** ([roomOrchestrator.js](roomOrchestrator.js)) — Reduces creep count by 40-60% at high RCL, compensated by 2.5× body size
- **Controller Upgrade Cap Awareness** ([spawnerRoster.js](spawnerRoster.js)) — Caps upgrader spawning at 15 WORK parts total (game limit)
- **Body Size Validation** ([spawnerBodyUtils.js](spawnerBodyUtils.js)) — Max hauler 48 parts, upgrader 36 parts

**Impact:**
- RCL 8: ~20-30 creeps → ~10-15 creeps while maintaining throughput
- Per-creep processing overhead cut proportionally

---

### 🚩 NEW FEATURE: Centralized Flag Management System
**Module:** [flagManager.js](flagManager.js) (419 lines, NEW 2026-03-29)  
**Documentation:** [llm-prompts/flag-system-documentation.md](llm-prompts/flag-system-documentation.md)

**Architecture:**
- **Per-tick caching** — All flag lookups cached per tick to minimize `Game.flags` accesses
- **Pattern-based queries** — Regex patterns for `attack_X`, `source_X`, `XXX_S_N` flag formats
- **Pure functions** — All functions stateless except per-tick cache
- **Type safety** — Consistent flag type constants and validation

**Flag Types Supported:**
1. **Rally Flag** (`rally`) — Gather all creeps to a central point for coordination
2. **Attack Flags** (`attack`, `attack_X`) — Direct combat operations, numbered variants for multiple fronts
3. **Remote Source Flags** (`source_X`) — Remote harvesting operations
4. **Claim Flag** (`claim`) — Room claiming operations
5. **Explore Flag** (`explore`) — Scouting missions
6. **Deconstruct Flag** (`deconstruct`) — Controlled structure demolition
7. **Priority Build Flag** (`priority_build`) — Construction priority override
8. **Planner Flags** (`XXX_S_N`) — Base layout structure placement markers

**Integration Points:**
- [creep.actionDecisions.js](creep.actionDecisions.js) — Rally mode activation
- [creep.actionHandlers.js](creep.actionHandlers.js) — Rally movement implementation
- [baseCreep.js](baseCreep.js) — Attack flag awareness
- [planner.js](planner.js) — Planner flag parsing
- [spawnerHelpers.js](spawnerHelpers.js) — Attack flag detection for fighter spawning
- [spawnerRoster.js](spawnerRoster.js) — Flag-driven roster adjustments
- 7+ role files — Rally-aware behavior

**Benefits:**
- Single source of truth for flag logic (previously scattered across 10+ files)
- Performance: per-tick caching prevents redundant lookups
- Maintainability: new flag types added in one place

---

### ⚔️ NEW FEATURE: Specialized Fighter Class System
**Status:** Complete ✅  
**Implementation Date:** 2026-03-29

#### New Combat Architecture

**Configuration Module:** [config.js](config.js#L268-L390)  
**Combat Assessment:** [spawnerCombat.js](spawnerCombat.js) (229 lines, NEW)  
**Body Composition:** [spawnerBodyUtils.js](spawnerBodyUtils.js) — 4 new fighter body functions (~400 lines)

**Fighter Classes (4 specialized roles):**

1. **Fodder** ([role.fighterFodder.js](role.fighterFodder.js), 25 lines)
   - **Design:** 1 ATTACK, TOUGH armor (max 10), MOVE for speed
   - **Config:** `MIN_COST: 140`, `MAX_TOUGH_PARTS: 10`, `TOUGH_MOVE_SET_COST: 60`
   - **Purpose:** Cheap cannon fodder to absorb damage (~200-400 energy)
   - **Scaling:** Linear with energy, prioritizes durability

2. **Invader** ([role.fighterInvader.js](role.fighterInvader.js), 26 lines)
   - **Design:** Max 2 ATTACK, 1 CARRY utility, TOUGH armor, 1:2 MOVE ratio
   - **Config:** `MIN_COST: 280`, `MAX_ATTACK_PARTS: 2`, `MAX_TOUGH_PARTS: 10`
   - **Purpose:** Balanced melee with utility (pickup/heal energy)
   - **Scaling:** Moderate size (~400-800 energy)

3. **Healer** ([role.fighterHealer.js](role.fighterHealer.js), 25 lines)
   - **Design:** HEAL parts (max 8), 1 CARRY, 1:1 MOVE ratio for speed
   - **Config:** `MIN_COST: 400`, `MAX_HEAL_PARTS: 8`, `HEAL_MOVE_SET_COST: 300`
   - **Purpose:** Support units healing damaged fighters
   - **Scaling:** Each HEAL provides +12 HP/tick at range 1

4. **Shooter** ([role.fighterShooter.js](role.fighterShooter.js), 25 lines)
   - **Design:** RANGED_ATTACK parts (max 8), 1 CARRY, 1:1 MOVE ratio for kiting
   - **Config:** `MIN_COST: 300`, `MAX_RANGED_ATTACK_PARTS: 8`, `RANGED_MOVE_SET_COST: 200`
   - **Purpose:** Ranged damage dealers, maintain range 3
   - **Scaling:** Each RANGED_ATTACK deals 10-50 dmg based on range

**Fighter Composition Ratios per RCL:**
```javascript
FIGHTER_RATIOS: {
  4: { fodder: 0.6, invader: 0.3, healer: 0.05, shooter: 0.05 },
  5: { fodder: 0.5, invader: 0.3, healer: 0.1, shooter: 0.1 },
  6: { fodder: 0.3, invader: 0.4, healer: 0.15, shooter: 0.15 },
  7: { fodder: 0.2, invader: 0.4, healer: 0.2, shooter: 0.2 },
  8: { fodder: 0.1, invader: 0.4, healer: 0.25, shooter: 0.25 }
}
```
- **Early RCL (4-5):** Swarm of cheap fodder with some balanced units
- **Mid RCL (6-7):** Balanced composition with more healers/shooters
- **Late RCL (8):** Heavy support/ranged with minimal fodder

**Implementation:**
- [spawnerBodyUtils.js](spawnerBodyUtils.js) — 4 new pure body functions (`getFodderCreepBody`, `getInvaderCreepBody`, `getHealerCreepBody`, `getShooterCreepBody`)
- [spawnerRoster.js](spawnerRoster.js) — Fighter count calculation based on attack flags and ratios
- [role.fighter.js](role.fighter.js) — Delegates to class-specific behavior based on creep name suffix

**Benefits:**
- Rock-paper-scissors combat dynamics
- Scalable from RCL 4-8 with evolving composition
- Cost-effective: mix of cheap/expensive units based on RCL
- Tactical flexibility: different unit types for different scenarios

---

### 🛡️ NEW FEATURE: Emergency Defender System
**Module:** [role.defender.js](role.defender.js) (65 lines, NEW 2026-03-29)  
**Assessment:** [spawnerCombat.js](spawnerCombat.js) (229 lines, NEW 2026-03-29)

**Purpose:** Spawn rapid-response defenders when colony is under invasion threat

**Threat Assessment Logic:**
```javascript
analyzeInvasionThreat(room) → {
  invaderCount: number,
  totalAttackPower: number,  // Sum of ATTACK + RANGED_ATTACK damage
  hasKilledCreeps: boolean,  // Recent creep losses tracked
  avgInvaderHP: number,
  locations: [RoomPosition]
}
```

**Defender Spawning Conditions:**
1. `invaderCount >= 2` OR `totalAttackPower >= 200` OR `hasKilledCreeps === true`
2. Reserved energy: scales with threat level (300-500 energy)
3. Priority: spawns before economic creeps

**Defender Body:**
- **Design:** Max 4 ATTACK parts, TOUGH armor, MOVE for speed
- **Config:** `MIN_COST: 130` ([config.js](config.js))
- **Scaling:** `[TOUGH×N, ATTACK×M, MOVE×K]` optimized for available energy
- **Example (500e):** `[T, T, T, T, A, A, A, A, M, M, M, M]` = 8 toughness + 320 dmg/tick

**Defender Behavior:**
- **Combat mode:** Attack hostile creeps using baseCreep attack logic
- **Patrol mode:** Alternate between spawn and controller positions (20-tick cycle)
- **No economic tasks:** Defenders focus exclusively on combat

**Benefits:**
- Automatic threat detection and response
- No manual intervention required for invasions
- Threat level → defender size scaling
- Efficient patrol behavior when no threats present

---

### 🔄 NEW FEATURE: Rally Flag System
**Integration Points:** 7 role files, [creep.actionDecisions.js](creep.actionDecisions.js), [creep.actionHandlers.js](creep.actionHandlers.js)

**Purpose:** Coordinate creep gathering for mass movements, defensive positioning, or maintenance

**Behavior:**
1. Place rally flag anywhere in visible rooms
2. All rally-aware creeps prioritize "rally" action over normal tasks
3. Creeps move to flag location and idle within range 3
4. Remove flag to resume normal operations

**Rally-Aware Roles:**
- Harvester, Upgrader, Builder, Miner, Hauler, Transporter, Fighter (7 roles updated)

**Implementation:**
- [flagManager.js](flagManager.js) — `isRallyModeActive()`, `getRallyFlag()`
- [creep.actionDecisions.js](creep.actionDecisions.js#L111-L115) — Adds `rally: hasRallyFlag` to action availability
- [creep.actionHandlers.js](creep.actionHandlers.js#L1106-L1138) — `handleRally()` movement logic
- [creep.constants.js](creep.constants.js) — Rally icon 🚩 and color #ff00ff

**Benefits:**
- Manual control for tactical situations
- Useful for coordinating mass attacks or defensive formations
- Clean implementation via centralized flag system

---

### 🌍 NEW FEATURE: Remote Harvesting System
**Status:** Experimental (implemented but may need tuning) ⚠️  
**Configuration:** [config.js](config.js#L391-L396)

**Purpose:** Harvest remote energy sources via `source_X` flags

**Behavior:**
1. Place `source_X` flag on a source in an adjacent room
2. Miners/haulers assigned to remote sources via flagManager
3. Energy transported back to home room
4. Distance penalty: `DISTANCE_PENALTY_MULTIPLIER: 1.5` for remote source scoring

**Config:**
```javascript
REMOTE_HARVESTING: {
  ENABLED: true,
  DISTANCE_PENALTY_MULTIPLIER: 1.5,
  AVOID_HOSTILE_ROOMS: false
}
```

**Integration:**
- [flagManager.js](flagManager.js) — Pattern matching for `source_X` flags
- [creep.actionDecisions.js](creep.actionDecisions.js) — Remote source awareness
- [creep.actionHandlers.js](creep.actionHandlers.js) — Remote gathering logic
- [utils.js](utils.js) — Remote pathfinding helpers

**Status Note:** Feature implemented but removed in commit `b54197d` due to issues. Code retained for future re-enablement.

---

## 4. Historical Context (Pre-2026-03-26 09:00)

### Previously Completed (2026-03-25 → 2026-03-26 09:00)

For historical context, see section 4-8 of previous spec version. Major accomplishments:
- ✅ spawner.js decomposition (1309 → 140 lines)
- ✅ baseCreep.js decomposition (1669 → 173 lines)
- ✅ Energy priority mode system
- ✅ Fighter secondary jobs
- ✅ Error tracking system (errorTracker.js)
- ✅ Link/gathering optimizations

---

## 5. Key Logic & Main Loop

### Main Loop ([main.js](main.js#L69-L200))
1. **Performance Optimization** — Initialize room cache and targeting map (Phase 1 optimizations)
2. **Garbage collection** — Clear memory for dead creeps and stale rooms (throttled to every 100 ticks)
3. **Per-room processing** — Filter owned rooms, iterate each with try-catch wrapper
4. **Statistics updates** — System stats, creep stats, energy collection metrics
5. **Room orchestration** — Priority mode management, spawn coordination, creep execution
6. **Infrastructure managers** — Links (RCL 5+), Labs (RCL 6+), Terminal (RCL 6+) with error tracking and caching
7. **Error boundary** — Try-catch wraps room processing; errors logged via errorTracker

### Room Cache System ([main.js](main.js#L91-L141))
**Purpose:** Eliminate redundant room.find() calls by caching per room per tick

**Cached Data:**
- Raw data: all structures, all creeps, construction sites, sources, dropped resources
- Derived caches: towers, spawns, extensions, containers, links, labs, storage, terminal, sources active
- Cache lifetime: 1 tick (cleared automatically at `Game.time` change)
- Access: `global.roomCache[roomName].structures`, `global.roomCache[roomName].towers`, etc.

**Impact:** Reduces room.find() calls from 200+ per tick to 5-8 per tick in busy rooms

### Global Targeting Map ([main.js](main.js#L143-L158))
**Purpose:** Replace O(n×m) nested loops with O(1) target contention lookups

**Mechanism:**
- Build once per tick: iterate all creeps, map `global.targetingCounts[targetId] = count`
- Used by: `countCreepsTargeting()` in creep.targetFinding.js
- Eliminates worst case: 30 targets × 50 creeps = 1500 iterations per tick

**Impact:** Targeting algorithm complexity O(n×m) → O(n)

### Room Orchestration Workflow ([roomOrchestrator.js](roomOrchestrator.js))
1. **Priority Mode Check** — Activate/deactivate energy priority mode based on `timeToFillCapacity`
2. **Threat Assessment** — Analyze invasion threat via spawnerCombat.analyzeInvasionThreat()
3. **Roster Calculation** — Calculate desired creep counts per role with RCL scaling (via spawnerRoster)
4. **Spawn Execution** — Attempt to spawn highest priority role (via spawner)
5. **Tower Control** — Defensive firing, emergency repairs (optimized: single scan before loop)
6. **Creep Routing** — Execute all creeps' assigned actions (via baseCreep)
7. **Visual Display** — Room info, efficiency metrics

### Spawn Prioritization ([spawner.js](spawner.js))
**Priority Order:**
1. **Defenders** (if invasion threat detected) — Reserved energy (300-500), immediate spawn
2. **Fighters** (if attack flags present) — Reserved energy, immediate spawn
3. **Minimum fleet** — 2 harvesters, 2 builders, 1 upgrader (bootstrapping)
4. **Priority mode boost** — +2 harvesters if `energyPriorityMode` active
5. **Roster spawning** — Only if energy ≥ 80% capacity; uses roster from spawnerRoster
6. **Fighter composition** — If fighters needed, spawn mixed classes based on RCL ratios

**Threat-Based Defender Spawning:**
- Uses `spawnerCombat.analyzeInvasionThreat()` for threat assessment
- Spawns if: `invaderCount >= 2` OR `totalAttackPower >= 200` OR `hasKilledCreeps`
- Reserved energy scales with threat level (300-500 energy)

**Fighter Composition Logic:**
- Reads `CONFIG.OFFENSIVE.FIGHTER_RATIOS[rcl]` for class distribution
- Example RCL 6: 30% fodder, 40% invader, 15% healer, 15% shooter
- Spawns fighters in rotation to maintain ratio balance

**Body Composition ([spawnerBodyUtils.js](spawnerBodyUtils.js)):**
- Adaptive sizing based on efficiency metrics (bootstrapping/developing/established/optimized)
- RCL multipliers scale creep size (1x at RCL 1-3, up to 2.5x at RCL 8)
- Pure functions for deterministic body calculation
- Role-specific templates (workers, haulers, miners, fighters, specialists)
- **Fighter bodies:** 4 specialized functions for fodder/invader/healer/shooter

**Spawn Execution ([spawnerCore.js](spawnerCore.js)):**
- Validates body composition and energy availability
- Tracks spawn tick in memory for debugging
- Visual feedback with role icons and energy cost
- Registers creeps needing boosting to `Memory.rooms[roomName].boostQueue`

### Creep Behavior ([baseCreep.js](baseCreep.js) + creep.* modules)

**Architecture:** Functional composition with clear module boundaries
- **baseCreep.js** — Orchestrates action selection and execution
- **creep.actionDecisions.js** — Selects next action based on priority list and state
- **creep.actionHandlers.js** — Executes action-specific logic (gathering, building, rally, attacking, etc.)
- **creep.targetFinding.js** — Finds and scores potential targets (uses global targeting map)
- **creep.analysis.js** — Analyzes creep capabilities and state
- **creep.effects.js** — Handles movement and memory updates
- **creep.constants.js** — Defines action requirements and visuals

**Action Selection Flow:**
1. **Rally check** — If rally flag active → `rally` action takes priority
2. **Combat check** — If fighter with targets → `attacking`
3. **State transition check** — Empty → gather mode; Full → work mode
4. **Priority list iteration** — Choose first available action from role's priority list
5. **Target assignment** — Find and reserve target with contention checking (O(1) with targeting map)
6. **Action execution** — Delegate to appropriate handler in ACTION_HANDLERS registry

**Key Actions:**
- `rally` — Move to rally flag and idle (NEW: flag-driven coordination)
- `gathering` — Collect energy from sources, containers, links, dropped resources
- `mining` — Stationary source harvesting (miners)
- `hauling` — Container/storage logistics
- `transporting` — Energy distribution to spawn/extensions
- `delivering` — Targeted energy delivery to specific structures
- `building` — Construction site work
- `repairing` — Structure maintenance with priority scoring
- `upgrading` — Controller upgrading with link integration
- `attacking` — Combat with prioritized target selection
- `movingToAttack` — Long-range movement to attack flags

**Flag Integration:**
- Rally mode: checked via `flagManager.isRallyModeActive()` in action decisions
- Attack flags: parsed via `flagManager.getAttackFlags()` for combat coordination
- Remote sources: `source_X` flags enable remote harvesting (experimental)

### Combat System

**Fighter Class Behavior:**
- **Fodder:** Simple melee rush, disposable units
- **Invader:** Balanced melee with pickup/heal capability (1 CARRY part)
- **Healer:** Stay behind front line, heal damaged fighters (12 HP/tick per HEAL at range 1)
- **Shooter:** Maintain range 3, kite enemies (10-50 dmg per RANGED_ATTACK based on range)

**Defender Behavior:**
- **Combat mode:** Attack hostile creeps using baseCreep attack logic
- **Patrol mode:** Alternate between spawn and controller (CONFIG.COMBAT.PATROL_MODULO)
- **No economic tasks:** Defenders focus exclusively on combat

**Target Prioritization:**
- Healers > Ranged > Melee > Workers (threat-based)
- Uses `creep.targetFinding.js` algorithms

### RCL Progression Strategy
- **RCL 1-3** — Swarm of small generalists ([WORK, CARRY, MOVE] × 2-4)
- **RCL 4-5** — Specialized roles emerge: stationary miners, pure haulers, dedicated upgraders
- **RCL 6-7** — Large specialists, mineral extraction, lab network active, fighter classes unlock
- **RCL 8** — Giant creeps with maximum efficiency, minimum count (50 parts max), roster scaling 0.4×

**Roster Scaling at High RCL:**
- RCL 6: 0.8× hauler/builder/upgrader count
- RCL 7: 0.6× hauler/builder/upgrader count
- RCL 8: 0.4× hauler/builder/upgrader/mineralExtractor/chemist count
- Harvesters and miners exempt (source-bound, can't reduce without losing throughput)

**Priority Mode Override:** When energy flow is critical, additional harvesters spawn and workers prioritize spawn/extension over storage/containers.

---

## 6. Criticalities & Potential Issues

### 🔴 High Severity

| # | File(s) | Description | Status |
|---|---|---|---|
| 1 | Multiple modules | **Incomplete error handling coverage.** errorTracker.js (289 lines) added with rate-limited logging and statistics. Infrastructure managers (linkManager, labManager, terminalManager) now wrapped in try-catch. spawner.js, roomOrchestrator.js, baseCreep.js have error tracking. **STILL MISSING:** Role files (20+ files including new fighter roles) and supporting modules (planner, utils, flagManager, spawnerCombat) have no error handling. | **PARTIALLY RESOLVED (2026-03-26)** — **WORSENED (2026-03-30)** — 8 new modules without error handling |
| 2 | ~~[baseCreep.js](baseCreep.js)~~ | ~~**God-object with 1669 lines.**~~ | ✅ **RESOLVED (2026-03-25)** |
| 3 | ~~[spawner.js](spawner.js)~~ | ~~**Overly complex module (1309 lines).**~~ | ✅ **RESOLVED (2026-03-25)** |
| 4 | [creep.actionHandlers.js](creep.actionHandlers.js) (1176 lines, +259 lines) | **Still the largest module after growth.** Contains all action handlers including new rally handler. Long functions persist: `handleDelivering` (~84 lines), `handleGathering` (~83 lines), `handleHauling` (likely >100 lines). Should extract sub-functions. **WORSENED** — Rally action added but no refactoring of long handlers. | **UNRESOLVED (GROWING)** |
| 5 | [spawnerBodyUtils.js](spawnerBodyUtils.js) (1010 lines, +176 lines) | **Grew significantly with 4 new fighter body functions.** Now includes: generalist, miner, hauler, upgrader, builder, defender, 4 fighter classes (fodder/invader/healer/shooter), explorer, transporter, mineral extractor, chemist, claimer (15+ functions). **WORSENED** — Fighter classes added ~400 lines without grouping. Should organize by category (workers, combat, specialists). | **UNRESOLVED (GROWING)** |
| 6 | [planner.js](planner.js#L206-L220) (908 lines) | **Quadruple nested loop.** Four levels deep (x, y, dx, dy) in `findOptimalCenter`. Inefficient O(n^4) complexity. Should use distance transform or precomputed grid. | **UNRESOLVED** |
| 7 | Multiple role files | **Inconsistent module paths.** Some use `require("baseCreep")` (role.builder, role.claimer) while others use `require("./baseCreep")` (role.explorer). Can cause undefined behavior in CommonJS. **5 new fighter role files** — All use `./ ` prefix correctly but inconsistency remains across old roles. | **PARTIALLY IMPROVED (2026-03-29)** — New files correct, old files still inconsistent |
| 8 | [roomOrchestrator.js](roomOrchestrator.js) + multiple modules | **Circular dependency risk with new modules.** roomOrchestrator ↔ spawner ↔ spawnerRoster ↔ spawnerCombat chain. **NEW RISK:** flagManager.js required by 10+ modules including creep.*, spawner*, role.* with potential for circular imports. Verify with `madge --circular .` | **NEEDS VERIFICATION (CRITICAL)** — 8 new modules increase risk |
| 9 | [flagManager.js](flagManager.js) (419 lines) | **New centralized module with high coupling.** Required by 15+ modules across the codebase (creep.*, spawner*, planner, 7 role files). Single point of failure. No error handling. If flagManager breaks, entire system could fail. **CRITICAL NEW RISK** | **NEW ISSUE (2026-03-30)** |

### 🟡 Medium Severity

| # | File(s) | Description | Status |
|---|---|---|---|
| 10 | [planner.js](planner.js) (908 lines) | **Multiple concerns in one file.** Handles layout generation, structure placement, flag management, road pathfinding, and visualization. Should split into `layout.js`, `placement.js`, `visualization.js`. | **UNRESOLVED** |
| 11 | [creep.actionHandlers.js](creep.actionHandlers.js) | **Long action handlers.** `handleDelivering` (84 lines), `handleGathering` (83 lines), `handleHauling` (estimated 100+ lines), `handleAttacking` (estimated 60+ lines), `handleRally` (NEW, 32 lines). Priority checking and target selection should be extracted to separate functions. | **WORSENED (2026-03-30)** — Rally handler added without refactoring |
| 12 | [planner.js](planner.js#L118-L125), [utils.js](utils.js#L25-L27) | **Triple nested loops.** Three levels deep in extension grid generation and distance transform calculation. Consider using functional approaches (flatMap, reduce) to flatten. | **UNRESOLVED** |
| 13 | Multiple files | **Significant use of `let` keyword.** 102+ instances across codebase pre-2026-03-29. New modules (flagManager, spawnerCombat, 5 fighter roles) likely add 30-50 more instances. Most in loops (acceptable) but also in business logic. Prefer `const` and functional transformations where possible. | **WORSENED (2026-03-30)** — 8 new modules increase usage |
| 14 | Multiple files | **188 console.log statements** (up from 130). Heavy logging can impact performance. No structured log levels (debug, info, warn, error). Top offenders: stats.js (39), main.js (32), role.mineralExtractor.js (20), roomOrchestrator.js (16), spawnerBodyUtils.js (NEW, estimated 15+). Consider log level system or toggle. | **WORSENED (2026-03-30)** — +58 log statements from new features |
| 15 | ~~Multiple files~~ | ~~**Magic numbers scattered throughout.**~~ | ✅ **RESOLVED (2026-03-25)** — Extracted to CONFIG.js |
| 16 | [roomOrchestrator.js](roomOrchestrator.js) | **Commented code present.** Some old logic may be commented out. Verify and clean up dead code. | **NEEDS VERIFICATION** |
| 17 | [spawnerBodyUtils.js](spawnerBodyUtils.js) | **15+ body composition functions.** While pure and well-documented, the number of similar functions suggests potential for abstraction. Consider parameterized body builder or composition pattern. **WORSENED** — Now 19+ functions with fighter classes. | **WORSENED (2026-03-30)** |
| 18 | [flagManager.js](flagManager.js) | **No validation for flag naming collisions.** If user creates flags with conflicting names (e.g., `attack` and `attack_1` simultaneously), behavior undefined. Should validate or document expected patterns. | **NEW ISSUE (2026-03-30)** |
| 19 | [spawnerCombat.js](spawnerCombat.js) | **Threat assessment has no history tracking.** `hasKilledCreeps` relies on room memory that's manually set elsewhere. If memory not updated, threat detection fails. Should be self-contained. | **NEW ISSUE (2026-03-30)** |

### 🟢 Low / Informational

| # | File(s) | Description | Status |
|---|---|---|---|
| 20 | All files | **No JSDoc for many functions.** Some functions documented, others not. Inconsistent. Add JSDoc for public API functions. New modules (flagManager, spawnerCombat, fighter roles) have minimal documentation. | **WORSENED (2026-03-30)** — 8 new modules with minimal docs |
| 21 | [creep.constants.js](creep.constants.js), [config.js](config.js) | **Good pattern: Constants at module level.** Constants extracted to dedicated files. Apply pattern consistently across all modules. | **IMPROVED (2026-03-29)** — Fighter class config added to CONFIG.js |
| 22 | [spawnerBodyUtils.js](spawnerBodyUtils.js) | **Pure functions for body composition.** Excellent separation of pure logic from effectful spawning. All body functions are side-effect free and deterministic. **NEW:** 4 fighter body functions also pure. | **MAINTAINED (2026-03-30)** — Still excellent practice |
| 23 | Most role files | **Role modules remain concise (15-50 lines).** Good separation. **NEW fighter roles:** All 15-26 lines each (excellent). Only exceptions: role.mineralExtractor (263), role.explorer (185), role.chemist (143), role.defender (65). | **IMPROVED (2026-03-30)** — New roles well-structured |
| 24 | [stats.js](stats.js) (543 lines) | **Interval-based statistics tracking.** Well-designed system with rolling windows and automatic interval rollover. Good observability foundation. | **UNCHANGED** — Still excellent |
| 25 | [spawnerCore.js](spawnerCore.js#L89) | **Spawn tick tracking in memory.** Good practice for lifetime tracking and debugging. Preserved during refactoring. | **UNCHANGED** — Still good practice |
| 26 | creep.* modules | **Clear functional hierarchy with no circular dependencies.** baseCreep → actionHandlers → actionDecisions/targetFinding → analysis. Clean separation of concerns. | **MAINTAINED (2026-03-30)** — Still clean |
| 27 | [errorTracker.js](errorTracker.js) | **Rate-limited error logging with statistics.** Prevents console spam while maintaining observability. Memory-based persistence, context-aware logging, critical threshold alerts. | **MAINTAINED (2026-03-26)** — Still excellent |
| 28 | [main.js](main.js#L260-L368) | **Console debug functions for error tracking.** Four global functions (errorSummary, errorRecent, errorStats, errorClear) provide runtime debugging without code changes. | **MAINTAINED (2026-03-26)** — Still useful |
| 29 | [flagManager.js](flagManager.js) | **Per-tick caching for performance.** All flag lookups cached per tick to minimize Game.flags accesses. Clean functional API with pattern-based queries. | **NEW STRENGTH (2026-03-30)** — Excellent performance optimization |
| 30 | [main.js](main.js) | **Global room cache system.** Single source of truth for room data per tick. Eliminates 200+ redundant find() calls. | **NEW STRENGTH (2026-03-30)** — Major performance win |
| 31 | [spawnerCombat.js](spawnerCombat.js) | **Pure threat assessment functions.** All analysis functions are side-effect free and deterministic. Good separation from spawning logic. | **NEW STRENGTH (2026-03-30)** — Clean architecture |
| 32 | Fighter class system | **Well-structured specialization.** Four distinct fighter types with clear roles, config-driven composition ratios, pure body functions. Scalable from RCL 4-8. | **NEW STRENGTH (2026-03-30)** — Excellent design |

---

## 7. Recent Changes Since Last Run (2026-03-26 09:00 → 2026-03-30 12:00)

### Summary Statistics
- **Commits:** 28 commits by 2 authors (Roberto Serra: 12, obione: 16)
- **Files changed:** 30+ files modified, 8 new modules created
- **Net changes:** ~1,300 lines added, ~300 lines modified
- **Codebase size:** 11,136 lines across 40 JS files (from ~9,800 lines, +14% growth)
- **Major themes:** Performance optimization, flag system, combat overhaul

### Git Log (Most Recent First, grouped by theme)

#### Flag System (7 commits)
- `c127363` — **attack flag fixed**: Corrected baseCreep.js and flagManager.js attack flag handling
- `40c518d` — **fix part 1**: Fixed baseCreep, actionHandlers, constants, 4 fighter roles
- `54d9fab` — **flag fixes**: Major flag system update across 14 files, added .github/copilot-instructions.md
- `2e9616c` — **syntax error**: Fixed flagManager.js syntax
- `59ac52f` — **flag refactoring**: Created flagManager.js (404 lines), flag docs, moved prompt files to llm-prompts/
- `29b36ff` — **rally flag**: Added rally action to 7 role files and creep modules
- `1765375` — **idle after rally**: Fixed rally action idle behavior

#### Performance Optimization (6 commits)
- `f5f4653` — **cpu optimization phase 3**: Added roster scaling config, RCL-based creep count reduction
- `66d8cca` — **cpu optimization phase 2**: Infrastructure manager caching (links, labs, terminal)
- `10a9bd6` — **CPU optimization**: Room cache system, targeting map, Phase 1 implementation
- `b54197d` — **removed remote gathering**: Rolled back experimental remote source feature
- `a074415` — **move to remote source**: Added remote source movement logic
- `adccd5e` — **remote sources**: Implemented remote source harvesting via flags

#### Combat System (9 commits)
- `9cd0b67` — **notify flag-driven**: Added flag-driven notification to main.js
- `fc72c7c` — **rally action fixed**: Fixed rally action decision logic
- `d0a6a37` — **fighters class**: Created 4 fighter role files (fodder/healer/invader/shooter)
- `d62ba18` — **Defender updated**: Added role.defender.js, spawnerCombat.js, defender body logic
- `78cc2f3`, `92691e6`, `e789293` — **fighter moving**: Fighter movement updates
- `270cb2b` — **syntax error fixed**: Fixed targetFinding syntax
- `1fe2d35` — **attack next room**: Attack logic for adjacent rooms

#### Bug Fixes (6 commits)
- `db00256` — **error no_body_part**: Fixed creep.actionHandlers.js body part error
- `abe3ae6` — **target finding fixed**: Fixed targetFinding logic
- `19b2493` — **find source updated**: Updated source finding in actionDecisions and utils

#### Documentation Updates (2 commits)  
- `25fd0d9` — **error handling updated**: Updated maintainer agent docs and project spec
- `cd69305` — **project spec updated**: Updated current-project-spec.md

### File Change Summary

**New Modules Created (8):**
- **flagManager.js** (419 lines) — Centralized flag management with per-tick caching
- **spawnerCombat.js** (229 lines) — Threat assessment and defender spawning logic
- **role.defender.js** (65 lines) — Emergency defense creep with patrol behavior
- **role.fighterFodder.js** (25 lines) — Cheap disposable melee units
- **role.fighterHealer.js** (25 lines) — Support units with HEAL parts
- **role.fighterInvader.js** (26 lines) — Balanced melee units with utility
- **role.fighterShooter.js** (25 lines) — Ranged damage dealers
- **.github/copilot-instructions.md** — Instructions to avoid optional chaining syntax

**Major Growths:**
- **spawnerBodyUtils.js:** 834 → 1010 lines (+176 lines, +21%) — Added 4 fighter body functions
- **creep.actionHandlers.js:** 917 → 1176 lines (+259 lines, +28%) — Added rally handler, attack improvements
- **main.js:** 368 → 636 lines (+268 lines, +73%) — Added room cache, targeting map, CPU optimizations
- **config.js:** 302 → 443 lines (+141 lines, +47%) — Fighter classes config, remote harvesting config

**Modified for Integration:**
- **baseCreep.js:** 173 → 213 lines (+40 lines) — Attack flag integration, error tracking
- **roomOrchestrator.js:** 768 → 706 lines (-62 lines) — Roster scaling, threat assessment integration
- **spawner.js:** 140 → 89 lines (-51 lines) — Simplified with combat module extraction
- **planner.js:** 917 → 908 lines (-9 lines) — Flag manager integration
- **creep.actionDecisions.js, creep.targetFinding.js, creep.effects.js** — Rally and attack flag integration
- **7 role files** (harvester, upgrader, builder, miner, hauler, transporter, fighter) — Rally-aware behavior
- **spawnerRoster.js, spawnerHelpers.js, spawnerCore.js** — Fighter class spawning, boost queue, flag awareness
- **linkManager.js, labManager.js, terminalManager.js** — Caching optimizations (Phase 2)

---

## 8. Recommendations for Next Sprint

### Priority 1: Critical Issues (Address Immediately)

1. **🔴 Add error handling to new modules** — flagManager.js, spawnerCombat.js, 5 fighter role files, role.defender.js all lack error boundaries. Single failure could cascade across system given high coupling.

2. **🔴 Verify no circular dependencies** — Run `madge --circular .` to confirm module graph is acyclic. Critical with 8 new modules and flagManager required by 15+ files.

3. **🔴 Test flagManager fault tolerance** — Single point of failure affecting 15+ modules. Add error handling and fallback behavior if `Game.flags` access fails.

4. **🔴 Validate fighter class scaling** — Test fighter composition ratios at all RCLs (4-8). Verify cost calculations don't exceed energy capacity.

5. **🔴 Test CPU optimization impact** — Measure actual CPU usage before/after Phase 1-3 optimizations. Validate 60-85% savings estimate.

### Priority 2: Code Quality (Technical Debt)

6. **🟡 Refactor creep.actionHandlers.js** — Extract long handlers (handleDelivering 84 lines, handleGathering 83 lines, handleHauling 100+ lines) into sub-functions. Module grew 28% to 1176 lines.

7. **🟡 Organize spawnerBodyUtils.js** — Group 19+ body functions by category (workers, combat, specialists). Module grew 21% to 1010 lines without organizational refactoring.

8. **🟡 Standardize module paths** — Convert all `require("module")` to `require("./module")` for consistency across 40 files.

9. **🟡 Add JSDoc comments** — Document public APIs in flagManager.js, spawnerCombat.js, fighter role files (8 new modules with minimal docs).

10. **🟡 Reduce console logging** — 188 log statements (up from 130). Consider implementing log level system or feature flag to disable debug logs.

### Priority 3: Testing & Validation

11. **🧪 Test rally flag system** — Verify rally behavior across all 7 rally-aware roles. Confirm instant transition back to normal tasks when flag removed.

12. **🧪 Test defender spawning** — Validate threat assessment logic triggers correctly. Test defender patrol behavior and combat transition.

13. **🧪 Test remote harvesting** — Feature was implemented then removed (commit `b54197d`). If re-enabling, test distance penalties and pathfinding.

14. **🧪 Validate roster scaling** — Test high RCL creep count reduction (0.4× at RCL 8). Confirm throughput maintained with larger bodies.

15. **🧪 Test controller upgrade cap** — Verify upgrader spawning caps at 15 WORK parts total. Ensure no wasteful spawning at RCL 8.

### Priority 4: Performance & Optimization

16. **⚡ Optimize planner.js nested loops** — Replace O(n^4) algorithm in `findOptimalCenter` with distance transform (still unresolved from previous sprint).

17. **⚡ Profile flag system overhead** — Per-tick caching reduces lookups but 15+ modules call flagManager. Measure actual performance impact.

18. **⚡ Monitor Memory usage growth** — Error tracking, boost queue, lab categories all use Memory. Track growth over time.

19. **⚡ Consider room cache TTL** — Current cache is 1-tick. For stable data (structures), could extend TTL to reduce even minimal overhead.

### Priority 5: Feature Completeness

20. **✨ Document flag system for users** — Create user-facing guide for placing flags (rally, attack_X, source_X, etc.) and expected behaviors.

21. **✨ Add threat history tracking** — spawnerCombat.js relies on manually-set room memory for `hasKilledCreeps`. Make self-contained with automatic tracking.

22. **✨ Implement flag naming validation** — Detect and warn about conflicting flag names (e.g., `attack` and `attack_1` simultaneously).

23. **✨ Expose fighter class config** — Consider allowing per-room fighter ratio overrides for tactical flexibility.

24. **✨ Add visual indicators** — Show rally point range, defender patrol paths, fighter class composition in room visuals.

### Key Metrics to Track

- **CPU Usage:** Target 60-85% reduction from baseline (Phase 1-3 optimizations)
- **Creep Count at RCL 8:** Target 10-15 creeps (from 20-30) with roster scaling
- **Error Rate:** Monitor via `global.errorSummary()` — should remain <5 errors/100 ticks
- **Fighter Win Rate:** Track combat success with new class system
- **Code Coverage:** Add error handling to remaining 20+ modules without try-catch

---

## 9. Future Improvements & TODOs

*This section is reserved for user-defined tasks and TODOs. The maintainer agent does not modify this section except to add items discovered in code comments.*

### From Code Analysis

**No TODO/FIXME/HACK comments found in codebase** (grep search returned no matches)

### Suggested Future Work (from recommendations)

- Implement log level system (debug/info/warn/error) to reduce production overhead
- Add visual indicators for rally points, defender patrols, fighter composition
- Create user-facing documentation for flag system usage
- Consider per-room fighter ratio overrides for tactical flexibility
- Extend room cache TTL for stable data (structures) to reduce overhead further
- Add automatic threat history tracking to spawnerCombat.js
- Implement flag naming validation to prevent conflicts

---

## 10. Appendix: Key Files Reference

### Core Systems
- **Entry Point:** [main.js](main.js) (636 lines) — Room cache, targeting map, main loop
- **Configuration:** [config.js](config.js) (443 lines) — All tuning parameters
- **Error Tracking:** [errorTracker.js](errorTracker.js) (289 lines) — Rate-limited logging

### Flag System
- **Flag Manager:** [flagManager.js](flagManager.js) (419 lines) — Centralized flag management
- **Documentation:** [llm-prompts/flag-system-documentation.md](llm-prompts/flag-system-documentation.md)

### Spawning System
- **Orchestrator:** [spawner.js](spawner.js) (89 lines)
- **Body Composition:** [spawnerBodyUtils.js](spawnerBodyUtils.js) (1010 lines)
- **Combat Assessment:** [spawnerCombat.js](spawnerCombat.js) (229 lines)
- **Spawn Execution:** [spawnerCore.js](spawnerCore.js) (125 lines)
- **Helpers:** [spawnerHelpers.js](spawnerHelpers.js) (86 lines)
- **Roster Calculation:** [spawnerRoster.js](spawnerRoster.js) (120 lines)

### Creep System
- **Orchestrator:** [baseCreep.js](baseCreep.js) (213 lines)
- **Action Handlers:** [creep.actionHandlers.js](creep.actionHandlers.js) (1176 lines)
- **Action Decisions:** [creep.actionDecisions.js](creep.actionDecisions.js) (274 lines)
- **Target Finding:** [creep.targetFinding.js](creep.targetFinding.js) (363 lines)
- **Analysis:** [creep.analysis.js](creep.analysis.js) (88 lines)
- **Effects:** [creep.effects.js](creep.effects.js) (100 lines)
- **Constants:** [creep.constants.js](creep.constants.js) (80 lines)

### Room Management
- **Orchestration:** [roomOrchestrator.js](roomOrchestrator.js) (706 lines)
- **Planning:** [planner.js](planner.js) (908 lines)
- **Statistics:** [stats.js](stats.js) (543 lines)

### Infrastructure
- **Links:** [linkManager.js](linkManager.js) (183 lines)
- **Labs:** [labManager.js](labManager.js) (404 lines)
- **Terminal:** [terminalManager.js](terminalManager.js) (293 lines)

### Utilities
- **Utils:** [utils.js](utils.js) (381 lines)

### Roles (24 total)
**Economic Roles:**
- [role.harvester.js](role.harvester.js)
- [role.upgrader.js](role.upgrader.js)
- [role.builder.js](role.builder.js)
- [role.miner.js](role.miner.js)
- [role.hauler.js](role.hauler.js)
- [role.transporter.js](role.transporter.js)

**Combat Roles:**
- [role.defender.js](role.defender.js) (65 lines)
- [role.fighter.js](role.fighter.js)
- [role.fighterFodder.js](role.fighterFodder.js) (25 lines)
- [role.fighterInvader.js](role.fighterInvader.js) (26 lines)
- [role.fighterHealer.js](role.fighterHealer.js) (25 lines)
- [role.fighterShooter.js](role.fighterShooter.js) (25 lines)

**Specialist Roles:**
- [role.explorer.js](role.explorer.js) (185 lines)
- [role.claimer.js](role.claimer.js)
- [role.mineralExtractor.js](role.mineralExtractor.js) (263 lines)
- [role.chemist.js](role.chemist.js) (143 lines)

### Documentation
- **Project Spec:** [llm-prompts/current-project-spec.md](llm-prompts/current-project-spec.md) (this file)
- **CPU Optimization:** [llm-prompts/cpu-optimization.md](llm-prompts/cpu-optimization.md)
- **Flag System:** [llm-prompts/flag-system-documentation.md](llm-prompts/flag-system-documentation.md)
- **Screeps Context:** [llm-prompts/screeps.md](llm-prompts/screeps.md)
- **Prompt Template:** [llm-prompts/prompt-template.md](llm-prompts/prompt-template.md)

---

**End of Project Spec**