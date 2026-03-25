# Project Spec

> **Last updated:** 2026-03-25 09:47 UTC  
> **Updated by:** maintainer agent  
> **Revision scope:** full scan (no previous spec found)

---

## 1. Project Overview

This is a Screeps AI bot written in JavaScript. Screeps is a programming game where players write code to control units in a persistent MMO world. This bot implements automated colony management with dual-mode operation (planning and executing), role-based creep workforce management, and infrastructure automation for energy distribution, compound production, and market trading. The bot handles RCL 1-8 progression with adaptive strategies that shift from generalist swarm tactics to specialized roles as the colony matures.

---

## 2. Architecture & Module Map

| Concern | File(s) | Notes |
|---|---|---|
| **Core Loop** | [main.js](main.js) | Entry point, per-room orchestration, garbage collection |
| **Room Orchestration** | [roomOrchestrator.js](roomOrchestrator.js) | Mode management, roster calculation, tower control, creep routing |
| **Spawning Logic** | [spawner.js](spawner.js) | Body composition, adaptive sizing, spawn queue management |
| **Base Planning** | [planner.js](planner.js) | Layout generation, structure placement, road pathfinding |
| **Creep Behavior** | [baseCreep.js](baseCreep.js) | Action selection, target finding, movement, all action handlers |
| **Statistics** | [stats.js](stats.js) | Telemetry tracking, efficiency metrics, performance monitoring |
| **Infrastructure - Links** | [linkManager.js](linkManager.js) | Energy transfer between sources/storage/controller |
| **Infrastructure - Labs** | [labManager.js](labManager.js) | Compound production, reaction queues, boosting stations |
| **Infrastructure - Terminal** | [terminalManager.js](terminalManager.js) | Market trading, buy/sell automation based on thresholds |
| **Utilities** | [utils.js](utils.js) | Distance transforms, pathfinding helpers, terrain analysis |
| **Role: Harvester** | [role.harvester.js](role.harvester.js) | Early-game generalist energy gatherer |
| **Role: Upgrader** | [role.upgrader.js](role.upgrader.js) | Controller upgrading specialist |
| **Role: Builder** | [role.builder.js](role.builder.js) | Construction site builder |
| **Role: Miner** | [role.miner.js](role.miner.js) | Stationary source harvester (RCL 4+) |
| **Role: Hauler** | [role.hauler.js](role.hauler.js) | Pure transport, no WORK parts (RCL 4+) |
| **Role: Fighter** | [role.fighter.js](role.fighter.js) | Combat units with ATTACK parts |
| **Role: Transporter** | [role.transporter.js](role.transporter.js) | Energy distribution to spawn/extensions |
| **Role: Claimer** | [role.claimer.js](role.claimer.js) | Remote room claiming |
| **Role: Explorer** | [role.explorer.js](role.explorer.js) | Scouting and room discovery |
| **Role: Mineral Extractor** | [role.mineralExtractor.js](role.mineralExtractor.js) | Mineral mining (RCL 6+) |
| **Role: Chemist** | [role.chemist.js](role.chemist.js) | Lab resource management |

---

## 3. Key Logic & Main Loop

### Main Loop ([main.js](main.js#L63))
1. **Garbage collection** - Clear memory for dead creeps and stale rooms
2. **Per-room processing** - Filter owned rooms, iterate each
3. **Statistics updates** - System stats, creep stats, energy collection metrics
4. **Room orchestration** - Spawn management, creep behavior execution
5. **Infrastructure managers** - Links (RCL 5+), Labs (RCL 6+), Terminal (RCL 6+)
6. **Error boundary** - Single try-catch wraps room processing (logs errors, continues)

### Spawn Prioritization ([spawner.js](spawner.js))
- **Emergency spawns first** - Fighter spawns with reserved energy on invasion
- **Role priority list** - Fighters > Miners/Haulers > Upgraders > Builders > Specialists
- **Adaptive body sizing** - Scales creep size based on efficiency metrics and RCL tier
- **Body composition** - Separate functions per role, considers combat parts for invasions

### Creep Behavior ([baseCreep.js](baseCreep.js))
- **Action selection** - Priority list determines which action to take (repair > build > upgrade)
- **Target assignment** - Stored in `creep.memory.actionTarget` with contention checking
- **Action handlers** - Registry maps actions to handler functions (gathering, building, repairing, etc.)
- **State transitions** - Workers switch between gathering (empty) and working (full)
- **Combat coordination** - Attack flag system redirects fighters to specific targets

### RCL Progression Strategy
- **RCL 1-3** - Swarm of small generalists ([WORK, CARRY, MOVE] × N)
- **RCL 4-7** - Specialized roles emerge: stationary miners, pure haulers, dedicated upgraders
- **RCL 8+** - Giant creeps with maximum efficiency, minimum count

---

## 4. Criticalities & Potential Issues

### 🔴 High Severity

| # | File(s) | Description |
|---|---|---|
| 1 | [main.js](main.js#L68-L96) | **Only one try-catch in entire codebase.** Infrastructure managers (linkManager, labManager, terminalManager), role files, and spawner have no error handling. A single exception in any manager silently halts execution. |
| 2 | [baseCreep.js](baseCreep.js) | **God object anti-pattern - 1649 lines.** Handles action selection, target finding, movement, repair logic, attack coordination, statistics, path visualization, and all 11 action handlers. Single point of failure. |
| 3 | [spawner.js](spawner.js) | **Overly complex module - 1220 lines.** Mixes body composition algorithms (15+ functions), spawn execution, roster calculation, emergency logic, and adaptive sizing. Should be decomposed. |
| 4 | [baseCreep.js](baseCreep.js#L1195-L1316) | **122-line function `handleHauling`.** Cyclomatic complexity likely >10. Four priority levels with nested conditionals, mineral type detection loop. Extract priority checking to separate functions. |
| 5 | [spawner.js](spawner.js) | **102-line function (likely `calculateRoster`).** Manages roster calculations with RCL-specific branching. Exceeds cognitive limit. |
| 6 | [planner.js](planner.js#L206-L220) | **Quadruple nested loop.** Four levels deep (x, y, dx, dy) in `findOptimalCenter`. Inefficient O(n^4) complexity. Should use distance transform or precomputed grid. |
| 7 | All role files | **Inconsistent module paths.** Some use `require("utils")`, others `require("./utils")`. Can cause undefined behavior in CommonJS. Standardize on `./` prefix. |
| 8 | [roomOrchestrator.js](roomOrchestrator.js), [baseCreep.js](baseCreep.js) | **Circular dependency risk.** roomOrchestrator requires all role modules; all role modules require baseCreep; if baseCreep references orchestrator logic, creates cycle. Verify with dependency graph. |

### 🟡 Medium Severity

| # | File(s) | Description |
|---|---|---|
| 9 | [planner.js](planner.js) | **917 lines, multiple concerns.** Handles layout generation, structure placement, flag management, road pathfinding, and visualization. Should split into `layout.js`, `placement.js`, `visualization.js`. |
| 10 | [stats.js](stats.js) | **541 lines of telemetry logic.** Functional but large. Consider extracting interval management, metric recording, and efficiency calculation into separate modules. |
| 11 | [baseCreep.js](baseCreep.js#L1362-L1445), [baseCreep.js](baseCreep.js#L787-L869) | **Long action handlers.** `handleDelivering` (84 lines), `handleGathering` (83 lines), `handleMining` (73 lines). Extract target selection logic. |
| 12 | [planner.js](planner.js#L118-L125), [utils.js](utils.js#L25-L27) | **Triple nested loops.** Three levels deep in extension grid generation and distance transform calculation. Consider using functional approaches (flatMap, reduce) to flatten. |
| 13 | Multiple files | **102 uses of `let` keyword.** Significant mutation, mostly in loops (acceptable) but also in business logic. Prefer `const` and functional transformations where possible. |
| 14 | Multiple files | **123 console.log statements.** Heavy logging can impact performance. No structured log levels (debug, info, warn, error). Consider log level system or toggle. |
| 15 | [spawner.js](spawner.js), [baseCreep.js](baseCreep.js) | **Magic numbers scattered throughout.** Examples: 1000000 (wall hits), 0.5 (health percent), 3000 (stat interval ticks). Extract to named constants at module top. |
| 16 | [roomOrchestrator.js](roomOrchestrator.js#L85) | **Commented code in `getRoomStatus`.** Line clearing planner flags suggests incomplete refactoring. Remove or uncomment. |

### 🟢 Low / Informational

| # | File(s) | Description |
|---|---|---|
| 17 | All files | **No JSDoc for many functions.** Some functions documented, others not. Inconsistent. Add JSDoc for public API functions. |
| 18 | [baseCreep.js](baseCreep.js#L18-L21) | **Constants at module top - good pattern.** CRITICAL_HITS, WALL_MIN_HITS, etc. defined as module constants. Apply pattern to other modules with magic numbers. |
| 19 | [spawner.js](spawner.js#L18-L30) | **`getEmergencyReserve` uses tiered thresholds.** Good example of explicit scaling logic. Could extract threshold config to separate object. |
| 20 | Multiple role files | **Role modules are concise (15-50 lines).** Good separation. Only exceptions are role.mineralExtractor (263), role.explorer (184), role.chemist (143). |
| 21 | [stats.js](stats.js) | **Interval-based statistics tracking.** Well-designed system with rolling windows and automatic interval rollover. Good observability foundation. |
| 22 | [spawner.js](spawner.js#L742) | **`executeSpawn` tracks spawn tick in memory.** Good practice for lifetime tracking and debugging. |

---

## 5. Recent Changes (since last run)

No previous run detected - this is the initial full scan. Most recent git activity (since 2026-01-01):
- `a1948e3` - Better extractor (modified role.mineralExtractor.js, roomOrchestrator.js, spawner.js)
- `b75bf73` - Basic mining (modified role.mineralExtractor.js, roomOrchestrator.js, spawner.js)
- `22396d1` - Pick it up (modified baseCreep.js)
- `122c10d` - Can do it (modified baseCreep.js, spawner.js)
- `c66be5a` - By room (modified main.js, roomOrchestrator.js)
- `0893f43` - Start multiroom handling (modified role.claimer.js, roomOrchestrator.js, spawner.js)

Recent work focused on mineral extraction, multiroom support, and hauling improvements.

---

## 6. Recommendations for Next Sprint

1. **Add error boundaries** - Wrap each infrastructure manager call in try-catch (linkManager, labManager, terminalManager)
2. **Decompose baseCreep.js** - Extract action handlers to separate files (actions/gathering.js, actions/building.js, etc.)
3. **Refactor long functions** - Break down `handleHauling` (122 lines) into smaller composable functions
4. **Standardize module paths** - Use `./` prefix consistently in all require() statements
5. **Extract magic numbers** - Create config.js with named constants for thresholds
6. **Simplify planner nested loops** - Replace quadruple nested loop with distance transform or BFS
7. **Add JSDoc** - Document public API functions consistently across all modules
8. **Verify no circular dependencies** - Run dependency graph analysis to confirm safe import order
