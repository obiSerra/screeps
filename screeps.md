# Screeps Colony Strategy Documentation

## Overview

This Screeps bot implements a comprehensive colony management strategy that focuses on automated base development, efficient resource management, and adaptive creep workforce optimization. The strategy prioritizes sustainable growth through intelligent planning and dynamic resource allocation.

## Core Strategic Philosophy

### Two-Mode Operation System

The bot operates in two distinct strategic modes:

#### Planning Mode
- **Purpose**: Design and visualize optimal base layouts before committing resources
- **Use Case**: Initial room setup, RCL upgrades, base reorganization
- **Behavior**: 
  - Analyzes room terrain and resource positions
  - Calculates optimal structure placements using distance optimization
  - Places planning flags for all structures up to current RCL
  - Provides visual feedback showing infrastructure development plan
  - Allows validation before executing construction
- **Transition**: Manually switch to executing mode when plan is satisfactory

#### Executing Mode
- **Purpose**: Active colony management and development
- **Behavior**:
  - Spawns and manages creep workforce
  - Builds planned structures based on flags
  - Manages energy distribution
  - Responds to threats
  - Upgrades controller
  - Maintains infrastructure

### Room Development Strategy

The bot employs a three-tiered development strategy that fundamentally changes creep composition and workforce strategy at each major phase:

#### Tier 1: RCL 1-3 - Swarm Strategy
**Philosophy**: Many small, versatile generalist creeps

**RCL 1 - Bootstrap Phase**
- Primary focus: Upgrade controller to unlock extensions
- Workforce: Small generalist workers (harvesters, upgraders, builders)
- Body composition: [WORK, CARRY, MOVE] scaling to [WORK×3, CARRY×3, MOVE×3]
- Infrastructure: Source containers for efficient harvesting
- Emergency protocol: If no harvesters exist, spawn one immediately

**RCL 2 - Early Expansion**
- Primary focus: Build first extensions, establish road network
- Workforce: Balance between harvesting, upgrading, and building
- Body composition: Still generalist, scaling with energy capacity
- Infrastructure: 
  - First 5 extensions for increased energy capacity
  - Road network connecting spawn, sources, and controller
  - Ramparts for basic defense
- Strategy: Begin structured base layout implementation

**RCL 3 - Fortification Phase**
- Primary focus: Establish defense and increase energy throughput
- Workforce: Continue generalist approach, add builders when needed
- Body composition: Maximum generalist size [WORK×3, CARRY×3, MOVE×3]
- Infrastructure:
  - First towers for automated defense
  - Additional extensions (up to 10 total)
  - Expanded road network
  - Controller container for upgrader efficiency
- Defense: Towers handle invaders; workers gain combat capabilities

#### Tier 2: RCL 4-7 - Specialized Medium Creeps
**Philosophy**: Role-specific bodies optimized for each task

**RCL 4 - Strategic Transition**
- **Major Change**: Shift from harvesters to miner/hauler system
- **New Roles**:
  - **Miners**: Stationary at sources with WORK-heavy bodies [WORK×2-5, MOVE×1]
  - **Haulers**: Pure transport with no WORK parts [CARRY×N, MOVE×N/2]
- Workforce: 1 miner per source, 2 haulers per source, scaled upgraders/builders
- Infrastructure:
  - Central storage for bulk energy management
  - Containers at each source (required for miner/hauler pattern)
  - Complete extension network (up to 20)
  - Additional towers for improved defense
- Economic shift: Specialized roles dramatically increase efficiency

**RCL 5-7 - Specialized Optimization**
- Primary focus: Maximize efficiency through role specialization
- Workforce: Continue miner/hauler split, larger body sizes
- Body compositions:
  - Miners: [WORK×5, MOVE×1] (optimal source harvesting)
  - Haulers: Up to [CARRY×16, MOVE×8] for bulk transport
  - Upgraders: [WORK×4, CARRY×2, MOVE×3] balanced for controller work
  - Builders: [WORK×3, CARRY×3, MOVE×3] balanced for construction
- Infrastructure:
  - RCL 5: Links at storage, controller, and sources
  - RCL 6: Terminal, labs, extractor
  - RCL 7: Factory, additional spawn, more towers
- Efficiency gain: Reduce creep travel time, increase energy throughput

#### Tier 3: RCL 8+ - Giants with Tight Specialization
**Philosophy**: Minimum creep count, maximum individual capability

**RCL 8 - Maximum Optimization**
- **Major Change**: Reduce total creep count, dramatically increase body sizes
- **Giant Compositions**:
  - Miners: [WORK×5, MOVE×1] (unchanged, already optimal)
  - Haulers: [CARRY×32, MOVE×16] (giant cargo capacity)
  - Upgraders: [WORK×15, CARRY×3, MOVE×6] (massive upgrade throughput)
  - Builders: On-demand only, medium to large bodies
  - Defenders: [TOUGH×10, ATTACK×10, RANGED_ATTACK×5, MOVE×25] (tank)
- Workforce: 1 miner per source, 1 hauler per source, 2 giant upgraders
- Infrastructure: Full extension count (60), observer, power spawn, nuker
- Strategy: **CPU efficiency prioritized** - fewer creeps to process per tick
- Benefits: Lower CPU usage, less traffic congestion, higher energy throughput per creep

## Workforce Management Strategy

### Creep Roles and Responsibilities

The bot employs different role strategies based on RCL tier:

#### RCL 1-3: Generalist Roles

**Harvesters**
**Strategic Role**: Primary energy collection and distribution
**Action Priority**:
1. Harvest energy from sources
2. Upgrade controller when energy stores are empty
3. Repair damaged structures
4. Assist with construction if needed

**Body Composition**: Scales from [WORK, CARRY, MOVE] to [WORK×3, CARRY×3, MOVE×3]

**Upgraders**
**Strategic Role**: Controller progression and emergency response
**Action Priority**:
1. Repair critical damage (structures below 1000 hits)
2. Upgrade controller
3. Harvest energy when empty
4. Repair non-critical damage
5. Assist with construction

**Strategic Importance**: Maintains continuous controller upgrade to prevent downgrade
**Body Composition**: Same as harvesters (generalist design)

**Builders**
**Strategic Role**: Infrastructure development and maintenance
**Action Priority**:
1. Repair critical damage (structures below 1000 hits)
2. Construct buildings (prioritizing extensions when multiple types exist)
3. Repair damaged structures
4. Harvest energy when empty
5. Upgrade controller when no builds needed

**Adaptation**: Builder count scales dynamically:
- 4 builders when construction sites exceed 10
- 2 builders when construction sites are between 1-10
- 1 builder when no construction sites exist (maintenance mode)

**Body Composition**: Same as harvesters (generalist design)

#### RCL 4-7: Specialized Roles

**Miners** (NEW)
**Strategic Role**: Stationary energy harvesting at assigned source
**Behavior**: 
- Assigned to specific source on spawn
- Moves to source once, then harvests continuously
- Drops energy to container or ground for haulers
- Never leaves source position

**Action Priority**: Mining only (single-purpose role)
**Body Composition**: 
- RCL 4-7: [WORK×2-5, MOVE×1] (scales with energy capacity)
- RCL 8+: [WORK×5, MOVE×1] (optimal - 10 energy/tick harvest rate)

**Strategic Benefits**: 
- Maximum harvesting efficiency (no travel time)
- Minimal MOVE parts (energy efficient)
- Works perfectly with container system

**Haulers** (NEW)
**Strategic Role**: Pure energy transport (replaces harvesters at RCL 4+)
**Behavior**:
- Picks up energy from containers near sources
- Collects dropped resources
- Delivers to spawns, extensions, towers, storage
- No harvesting capability (no WORK parts)

**Action Priority**:
1. Hauling (pickup from containers/dropped energy)
2. Delivering (transfer to spawns/extensions/towers/storage)

**Body Composition**:
- RCL 4-7: [CARRY×2-16, MOVE×1-8] (1 MOVE per 2 CARRY for roads)
- RCL 8+: [CARRY×32, MOVE×16] (giant hauler)

**Strategic Benefits**:
- Haulers dedicated to transport = faster energy delivery
- No wasted WORK parts on transport creeps
- Scales efficiently with source distance
- Works in miner/hauler coordination pattern

**Upgraders** (UPDATED)
**Strategic Role**: Controller progression (now specialized at RCL 4+)
**Action Priority**: Same as before, but optimized body composition

**Body Composition**:
- RCL 1-3: Generalist [WORK×1-3, CARRY×1-3, MOVE×1-3]
- RCL 4-7: WORK-heavy [WORK×4, CARRY×2, MOVE×3]
- RCL 8+: Giant [WORK×15, CARRY×3, MOVE×6]

**Strategic Benefits**: More WORK parts = faster upgrading

**Builders** (UPDATED)
**Strategic Role**: Infrastructure development (specialized at RCL 4+)
**Action Priority**: Same as before

**Body Composition**:
- RCL 1-3: Generalist [WORK×1-3, CARRY×1-3, MOVE×1-3]
- RCL 4+: Balanced [WORK×3, CARRY×3, MOVE×3]

**Strategic Benefits**: Equal WORK/CARRY for efficient building

#### Legacy Roles (Deprecated at RCL 4+)

**Transporters**
**Strategic Role**: Bulk energy movement (replaced by haulers at RCL 4+)
**Status**: Only used in RCL 1-3 if storage exists early
**Replaced By**: Hauler role (more efficient, no WORK parts)

**Claimers**
**Strategic Role**: Room expansion (currently configured for E3S53)
**Behavior**: Navigate to target room and claim controller
**Strategic Note**: Enables multi-room empire expansion
**Body Composition**: Minimal [MOVE×2, CLAIM]

### Dynamic Roster Scaling

The bot uses a **RCL-tiered roster system** that fundamentally changes workforce composition at strategic breakpoints:

#### Tier 1: RCL 1-3 - Energy-Proportional Generalists

**Formula**: Base workers = energyCapacity ÷ 300 (minimum 1)
**Distribution**:
- Harvesters: ~50% of base workforce (min 2)
- Builders: ~25% of base workforce (min 1)  
- Upgraders: ~25% of base workforce (min 1)

**Example Scaling**:
- **RCL 1** (300 capacity): 1 harvester, 1 builder, 1 upgrader
- **RCL 2** (550 capacity): 2 harvesters, 1 builder, 1 upgrader  
- **RCL 3** (800 capacity): 2 harvesters, 1 builder, 1 upgrader

**Strategic Rationale**: Swarm of small generalists for flexibility and redundancy

#### Tier 2: RCL 4-7 - Source-Based Specialists

**Major Shift**: Transition from generalists to miner/hauler system

**Formula**: Based on sources and distance, not just energy capacity
- Miners: 1 per source (static)
- Haulers: 2 per source (baseline, scales with distance)
- Upgraders: energyCapacity ÷ 800, capped at 4
- Builders: 1-3 based on construction sites

**Example Scaling** (2 sources):
- **RCL 4** (1300 capacity): 2 miners, 4 haulers, 2 upgraders, 1-2 builders
- **RCL 5** (1800 capacity): 2 miners, 4 haulers, 2 upgraders, 1-2 builders  
- **RCL 6** (2300 capacity): 2 miners, 4 haulers, 3 upgraders, 1-2 builders
- **RCL 7** (5600 capacity): 2 miners, 4 haulers, 4 upgraders, 1-3 builders

**Strategic Rationale**: 
- Miner/hauler split dramatically increases efficiency
- Hauler count adjustable based on source distance
- Upgraders scale with energy surplus
- Builders spawn only when needed

#### Tier 3: RCL 8+ - Minimal Giant Workforce

**Philosophy**: Reduce creep count to minimize CPU, maximize individual power

**Formula**: Minimum viable creeps with maximum body sizes
- Miners: 1 per source (giant bodies)
- Haulers: 1 per source (giant capacity)
- Upgraders: 2 giants (sufficient for sustained upgrading)
- Builders: 0-2 (on-demand only)

**Example Scaling** (2 sources):
- **RCL 8** (12900 capacity): 2 miners, 2 haulers, 2 upgraders, 0-2 builders

**Strategic Benefits**:
- **CPU Efficiency**: ~10 creeps instead of 40+ (4x CPU reduction)
- **Traffic Reduction**: Less congestion, faster pathfinding
- **Energy Throughput**: Each creep processes more energy per tick
- **Spawn Freedom**: Spawn idle most of the time for emergency respawns

**Comparison**:
- RCL 7 (old system): 10 harvesters, 5 builders, 5 upgraders = 20 creeps
- RCL 8 (new system): 2 miners, 2 haulers, 2 upgraders = 6 creeps
- Result: 70% reduction in creep count, same or better performance

#### Transition Mechanics

**When RCL increases** (e.g., 3 → 4 or 7 → 8):
1. Roster calculation detects new RCL tier
2. Spawn procedure stops creating old role types (e.g., no more harvesters at RCL 4)
3. New role types begin spawning (e.g., miners and haulers)
4. Old creeps live out their 1500-tick lifespan naturally
5. After ~25 minutes, room fully transitioned to new strategy

**Benefits**:
- No energy wasted despawning creeps
- Smooth transition prevents productivity gaps
- Room remains operational throughout upgrade
- Automatic without manual intervention

#### Builder Scaling Logic (All Tiers)

**Dynamic adjustment based on construction demand**:
- **10+ sites**: 3-4 builders (construction blitz)
- **3-10 sites**: 2 builders (steady construction)
- **1-2 sites**: 1 builder (maintenance)
- **0 sites**: 0-1 builder (RCL 8 spawns 0, earlier RCLs keep 1)

**Strategic Rationale**: Prevents over-staffing when construction is light

#### Emergency Protocols (All Tiers)

**Harvester/Miner Emergency**:
- If harvesters + miners = 0, immediately spawn one with any available energy
- Prevents colony death from energy starvation
- Overrides all other roster calculations

**Example**:
- All miners die unexpectedly → Next spawn creates emergency miner at minimum energy cost
- Ensures colony survival even after catastrophic losses

### Spawning Strategy

The bot uses an adaptive spawning algorithm that responds to colony needs:

#### Emergency Spawning
- **Trigger**: No harvesters exist
- **Action**: Immediately spawn harvester with any available energy
- **Rationale**: Prevents colony death from energy starvation

#### Priority-Based Spawning
When spawning capacity exists, roles are spawned in order of deficit:
1. Harvesters (ensure energy collection)
2. Builders (respond to construction needs)
3. Upgraders (maintain controller progress)
4. Transporters (optimize energy logistics)

#### Energy Efficiency Rules
- **Early Game** (< 450 capacity): Spawn when energy ≥ 200 to maintain workforce
- **Mid-Late Game**: Spawn when energy ≥ 50% of capacity for cost-effective scaling
- **Energy Full**: Spawn extra workers to utilize excess energy

#### Bonus Spawning (Energy Full)
When energy is at maximum capacity, spawn additional creeps based on current needs:
- Construction sites exist → Spawn builder
- Otherwise → Balance workforce ratios (1 harvester : 0.7 builders : 0.5 upgraders)

### Creep Body Composition Strategy

The bot uses a **RCL-tiered body composition system** that fundamentally changes creep design at each strategic phase:

#### Tier 1: RCL 1-3 - Generalist Bodies
**Philosophy**: Versatile workers that can perform any task

**Generalist Design** (used by harvesters, upgraders, builders):
- **Base Components**: WORK (action speed), CARRY (capacity), MOVE (mobility)
- **Scaling Tiers**: 
  - Minimum: [WORK, CARRY, MOVE] @ 200 energy
  - Small: [WORK×2, CARRY, MOVE×2] @ 400 energy
  - Medium: [WORK×3, CARRY×2, MOVE×3] @ 650 energy
  - Large: [WORK×3, CARRY×3, MOVE×3] @ 800 energy

**Strategic Benefits**:
- Low spawn energy threshold (works at RCL 1)
- Flexible task assignment
- Fast to spawn and replace
- Redundancy through numbers

#### Tier 2: RCL 4-7 - Specialized Medium Bodies
**Philosophy**: Role-specific optimization for maximum efficiency

**Miner Bodies** (stationary harvesters):
- [WORK×2, MOVE] @ 250 energy (minimum)
- [WORK×3, MOVE] @ 350 energy (medium)
- [WORK×5, MOVE] @ 550 energy (optimal)
- **Design Rationale**: Minimal MOVE (doesn't travel), maximum WORK (harvest rate)
- **Harvest Rate**: 5 WORK parts = 10 energy/tick (source maximum)

**Hauler Bodies** (pure transport):
- [CARRY×2, MOVE] sets repeated (150 energy per set)
- RCL 4-7 cap: 8 sets = [CARRY×16, MOVE×8] @ 1200 energy
- **Design Rationale**: No WORK parts (haulers don't harvest), 1 MOVE per 2 CARRY (optimal for roads)
- **Capacity**: 800 energy capacity at max medium size

**Upgrader Bodies** (controller specialists):
- [WORK×4, CARRY×2, MOVE×3] @ 800 energy (standard)
- [WORK×3, CARRY×2, MOVE×3] @ 650 energy (fallback)
- **Design Rationale**: More WORK than generalist (faster upgrading), enough CARRY for energy storage

**Builder Bodies** (construction specialists):
- [WORK×3, CARRY×3, MOVE×3] @ 800 energy (balanced)
- [WORK×2, CARRY×2, MOVE×2] @ 500 energy (fallback)
- **Design Rationale**: Equal WORK/CARRY for build+repair efficiency

#### Tier 3: RCL 8+ - Giant Bodies
**Philosophy**: Minimum creep count, maximum throughput, optimize CPU

**Giant Miner** (unchanged from RCL 4+):
- [WORK×5, MOVE] @ 550 energy
- **Rationale**: Already optimal (can't exceed source output of 10 energy/tick)

**Giant Hauler**:
- [CARRY×32, MOVE×16] @ 2400 energy (48 parts, near 50 limit)
- **Capacity**: 1600 energy per trip
- **Design Rationale**: Massive cargo reducing number of trips needed

**Giant Upgrader**:
- [WORK×15, CARRY×3, MOVE×6] @ 1950 energy (Primary)
- [WORK×10, CARRY×2, MOVE×4] @ 1300 energy (Fallback)
- **Upgrade Rate**: 15 WORK = 15 energy/tick controller progress
- **Design Rationale**: Maximize controller upgrade throughput

**Giant Builder** (on-demand):
- [WORK×3, CARRY×3, MOVE×3] @ 800 energy (medium is sufficient)
- **Rationale**: Construction is less frequent at RCL 8, medium bodies adequate

**Giant Defender**:
- [TOUGH×10, ATTACK×10, RANGED_ATTACK×5, MOVE×25] @ 2900 energy
- **Design Rationale**: Tank with massive damage output and survivability

#### Dynamic Body Selection Algorithm

The bot automatically selects the appropriate body for each role:

```javascript
function getBodyForRole(role, rcl, energyAvailable) {
  const tier = getRCLTier(rcl); // "early", "mid", or "late"
  
  switch (role) {
    case "harvester":
      return getGeneralistBody(rcl, energyAvailable); // RCL 1-3 only
    case "miner":
      return getMinerBody(rcl, energyAvailable); // RCL 4+ only
    case "hauler":
      return getHaulerBody(rcl, energyAvailable); // RCL 4+ only
    // ... other roles
  }
}
```

**Benefits of RCL-Based Bodies**:
- Automatically adapts to room progression
- No manual intervention required
- Optimal efficiency at each development stage
- Smooth transitions between tiers (old creeps live out lifespan)

#### Combat Body Scaling

**Defender bodies scale with RCL**:
- **RCL 1-3**: [TOUGH, ATTACK, MOVE] × 2-3 sets (cheap, fast)
- **RCL 4-7**: [TOUGH×2, ATTACK×2, RANGED_ATTACK, MOVE×5] (medium)
- **RCL 8+**: Giant tank composition (see above)

**Strategic Benefits**: Defense capability grows with room, CPU-efficient giants at endgame

## Combat and Defense Strategy

### Threat Detection
- Continuous scanning for hostile creeps in owned rooms
- Immediate alerts when invaders detected
- All creeps made aware of threat status

### Defense Response

#### Worker Combat Mode
When invaders are present:
- **Fighters** (creeps with ATTACK or RANGED_ATTACK parts): Engage hostiles directly
- **Non-fighters**: Avoid hostile creeps by increasing pathfinding costs in 3x3 area around enemies
- **All workers**: Spawn with combat parts for self-defense

#### Tower Defense
- Towers automatically engage hostiles
- Positioned for overlapping coverage of critical areas
- 6 towers total at RCL 8 provide comprehensive room defense

#### Rampart Protection
- Critical structures (spawns, storage, towers) protected by ramparts
- Ramparts planned in 3-tile perimeter around key infrastructure
- Maintained at 50% health minimum
- Walls built to 1M hits minimum for additional security

### Pathfinding Evasion
Non-combat creeps avoid hostile creeps by:
- Detecting enemies in current room
- Modifying cost matrix to mark danger zones
- Routing around threats while maintaining efficiency

## Base Layout Strategy

### Core Design Philosophy
The bot uses a stamp-based central core design that maximizes efficiency and defensibility:

#### Central Core (5x5 area)
- **Storage**: Center position for minimal travel distance
- **Spawns**: 3 total spawns positioned around storage (RCL 1, 7, 8)
- **Link**: Adjacent to storage for energy distribution
- **Terminal**: Near storage for market operations
- **Towers**: Surrounding core for 360° defense coverage

**Strategic Advantages**:
- Minimizes creep travel time
- Centralizes defense
- Compact footprint leaves room for expansion
- All critical structures within tower protection range

#### Extension Layout
- **Pattern**: Checkerboard/grid pattern radiating from core
- **Distribution**: 60 extensions spread in concentric rings
- **Stage Planning**: Extensions flagged by RCL requirement (5-10 per level)
- **Goal**: Maximize energy capacity while maintaining compact footprint

#### Road Network
The bot plans three interconnected road networks:

1. **Core Roads**: Cross and diagonal roads connecting central structures
2. **Source Roads**: Pathfinding-based roads from spawn to each source
3. **Controller Roads**: Pathfinding-based roads from spawn to controller
4. **Inter-Network Roads**: Roads connecting controller to sources

**Benefits**:
- Reduces creep fatigue on swamps
- Increases movement speed
- Lowers CPU usage from pathfinding
- Improves overall colony efficiency

#### Advanced Structures
- **Labs**: 10-lab cluster for reaction chains (3x3 grid + booster)
- **Factory**: Positioned near storage for manufacturing
- **Power Spawn**: Near core for power processing
- **Nuker**: Protected within rampart network
- **Observer**: Positioned for scouting adjacent rooms

### Container Placement Strategy

#### Source Containers
- **Position**: Adjacent to each source (optimal harvesting position)
- **Purpose**: 
  - Store excess energy from harvesting
  - Provide pickup point for transporters
  - Enable stationary harvesting (more efficient)
- **Built**: RCL 1 for early efficiency gains

#### Controller Container
- **Position**: Within range 2 of controller
- **Purpose**:
  - Store energy for upgraders
  - Reduce upgrader travel time
  - Enable continuous upgrading
- **Built**: RCL 2 when upgrading becomes priority

### Rampart Defense Network
- **Coverage**: All critical structures (spawns, storage, terminal, towers, labs)
- **Pattern**: 3-tile perimeter around spawn (expandable)
- **Health Target**: 50% of max health minimum
- **Strategy**: Prevents hostile creeps from damaging core infrastructure

## Resource Management Strategy

### Energy Distribution Priority

The bot employs a sophisticated energy priority system:

#### Phase 1: Critical Infrastructure
1. **Spawns** - Ensure workforce continuity
2. **Extensions** - Maximize spawn energy capacity
3. **Towers** - Maintain defense capability

#### Phase 2: Storage Economy
- Energy above capacity threshold stored in storage
- Enables sustained operations during source depletion
- Provides buffer for expensive spawns

#### Phase 3: Upgrading
- Controller receives energy when all other needs met
- Prevents downgrade while maintaining infrastructure
- Scales with available workforce

### Energy Collection Strategy

#### Source Selection Algorithm
Workers select sources using multi-factor scoring:
- **Energy Available**: Prefer sources with more energy
- **Distance**: Closer sources ranked higher
- **Contention**: Avoid overcrowded sources
- **Weighting**: Energy² / (1 + creeps) / (1 + distance)²

**Result**: Automatic load balancing across sources without explicit coordination

#### Gathering Behavior
Workers exhibit state-based gathering:
- **Empty**: Find and move to best source, begin harvesting
- **Gathering**: Continue until full
- **Full**: Switch to action mode (building, upgrading, etc.)
- **Transporter Mode**: Gather from containers at 50%+ capacity

### Construction Priority

When multiple construction sites exist:

#### Type Prioritization
- **Extensions** prioritized first when multiple types present
- **Rationale**: Energy capacity directly impacts colony growth rate

#### Contention Distribution
- Calculate how many creeps targeting each site
- Distribute builders to minimize overcrowding
- Maintain original priority within same type

#### Critical Repairs
Structures below 1000 hits receive absolute priority:
- All worker types can perform critical repairs
- Interrupts current action to prevent structure loss
- Ensures colony survival over optimization

## Defensive Structure Maintenance

### Repair Priority System

The bot uses a sophisticated repair targeting algorithm:

#### Repair Categories
1. **Critical**: Structures < 1000 hits (emergency)
2. **Regular Structures**: < 50% of max health
3. **Ramparts**: < 50% of max health
4. **Walls**: < 1M hits

#### Selection Algorithm
When choosing repair targets:
- Critical repairs always prioritized
- Among same category: Score = hits × (1 + distance/50)
- Lower score = higher priority
- Result: Repair most damaged structures first, with distance tie-breaking

### Wall and Rampart Strategy
- **Walls**: Maintained to 1M hits for perimeter defense
- **Ramparts**: Maintained to 50% health for structure protection
- **Reasoning**: Provides substantial defense without excessive repair costs
- **Scaling**: Thresholds can be increased as colony matures

## Advanced Strategic Features

### Dynamic Workforce Scaling

The roster adapts to colony conditions and scales with energy capacity:

**Base Roster Formula**: 
- Workers needed = energyCapacity ÷ 300 (minimum 1)
- Harvester count = 50% of workers (minimum 2)
- Builder count = 25% of workers (minimum 1)
- Upgrader count = 25% of workers (minimum 1)

**Adaptations**:
- **No harvesters**: Emergency spawn, halt all other activities
- **RCL 1**: Focus on upgraders to race to RCL 2
- **10+ construction sites**: Boost builders to 4 (construction blitz)
- **1-10 sites**: Maintain 2 builders (steady construction)
- **No sites**: Keep 1 builder (maintenance mode)
- **Storage + full containers**: Add 1 transporter (logistics optimization)
- **Workforce < 75% of target**: Spawn small creeps (200-400 energy) for rapid workforce expansion
- **Workforce ≥ 75% of target**: Spawn large creeps (650-800 energy) for maximum efficiency

### Multi-Action Creep Intelligence

All workers utilize a fallback action system:

**Example: Builder Actions**
1. Repair critical damage (colony survival)
2. Build construction sites (primary role)
3. Repair structures (maintenance)
4. Harvest energy (self-sufficiency)
5. Upgrade controller (productive fallback)

**Strategic Value**: No idle creeps - always productive even when primary task unavailable

### Memory Management

To prevent memory bloat and maintain performance:
- Dead creep memory immediately cleared each tick
- Stale room memory cleaned for unowned rooms
- Only active game objects tracked
- Planning data preserved for owned rooms

### Error Handling
- Each room processed in try-catch block
- Errors logged with stack traces for debugging
- Failed room skipped to prevent cascade failures
- Colony continues operating despite individual room errors

## Planning System Strategy

### Flag-Based Planning
The bot uses an intelligent flag naming system:
- **Format**: `XXX_S_N` (Type_Stage_Index)
- **Example**: `EXT_2_5` = Extension, build at RCL 2, index 5
- **Advantage**: Persistent, visual, queryable planning system

### Incremental Planning
- Plans update when RCL increases
- Only structures for current RCL flagged
- Prevents premature construction attempts
- Enables visualization of future development

### Execution Strategy
Each tick the bot:
1. Checks which flagged structures should exist at current RCL
2. Verifies if structure exists or construction site placed
3. Places construction sites for missing structures
4. Removes flags when structures complete
5. Builders automatically target new sites

**Result**: Fully automated base construction from planning to completion

## Room Mode Transition Strategy

### When to Use Planning Mode
- **New Room**: Initial base design
- **RCL Increase**: Validate new structure placements
- **Reorganization**: Test layout changes before committing
- **Analysis**: Study planned development path

### When to Use Executing Mode
- **Active Development**: Normal colony operations
- **Construction Phase**: Building planned structures
- **Steady State**: Maintaining established colony
- **Combat**: Active defense or expansion

### Transition Process
1. Set room mode: `Memory.rooms[roomName].mode = 'planning'` or `'executing'`
2. Planning mode creates/updates flags based on current RCL
3. Review visualization to validate layout
4. Switch to executing mode to begin construction
5. Flags guide automatic construction until complete

## Optimization Strategies

### CPU Efficiency
- Pure functional approach reduces side effects
- Memoization available for expensive calculations
- Pathfinding results cached by game engine
- Periodic logging reduces console spam
- Early exits prevent unnecessary processing

### Creep Efficiency
- Roads reduce fatigue and increase speed
- Links eliminate long-distance travel
- Containers enable stationary harvesting
- Multi-tasking prevents idle time
- Smart source selection prevents overcrowding
- **Intelligent body scaling**: Small creeps when building workforce, large creeps when optimizing efficiency

### Economic Efficiency
- **Dynamic roster scaling**: Workforce proportional to energy capacity (1 per 300 capacity)
- **Phased spawning**: Prioritize quantity until 75% of target, then prioritize quality
- Body composition scales with available energy
- Energy-full spawning prevents waste
- Storage enables sustained operations
- Balanced worker ratios maximize throughput

### Construction Efficiency
- Extension prioritization accelerates capacity growth
- Contention distribution prevents builder bottlenecks
- Critical repairs prevent catastrophic structure loss
- Incremental planning prevents construction gridlock
- Automated flag cleanup reduces memory usage

## Strategic Objectives by Phase

### Tier 1: Early Game (RCL 1-3) - Swarm Phase
**Primary Goal**: Establish sustainable energy economy with generalist workers

**RCL 1-2: Bootstrap**
- Spawn many small generalist creeps [WORK, CARRY, MOVE]
- Build first extensions ASAP for better spawns
- Connect infrastructure with roads
- Focus on quantity over quality
- Reach RCL 3 to unlock towers

**RCL 3: Preparation**
- Maximum generalist bodies [WORK×3, CARRY×3, MOVE×3]
- Build containers at sources in preparation for RCL 4 transition
- Establish tower defense
- Complete road network
- Prepare for miner/hauler transition

**Success Metrics**: 
- Energy capacity ≥ 800
- Continuous controller upgrading
- Roads connecting key structures
- Containers at sources ready
- Ready for RCL 4 strategic shift

**CPU Profile**: Medium-high (many small creeps)

### Tier 2: Mid Game (RCL 4-7) - Specialization Phase
**Primary Goal**: Transition to specialized roles and optimize efficiency

**RCL 4: Strategic Transition**
- **Major Change**: Shift from harvesters to miners + haulers
- Stop spawning harvesters, start spawning miners and haulers
- Miners assigned to specific sources (1 per source)
- Haulers transport energy (2+ per source)
- Build storage for bulk energy management
- Gradual transition over ~25 minutes as old creeps expire

**RCL 5-6: Optimization**
- Increase body sizes for all roles
- Miners reach optimal [WORK×5, MOVE] composition
- Haulers scale to [CARRY×16, MOVE×8]
- Deploy link network for energy distribution
- Build terminal and labs
- Complete extension network

**RCL 7: Advanced Specialization**
- Near-maximum specialized body sizes
- Factory and additional spawn
- Prepare for RCL 8 giant transition
- Test CPU profile with fewer, larger creeps

**Success Metrics**:
- Miner/hauler system operational
- Can defend against NPC invaders
- Storage accumulating surplus energy
- All extensions built
- Links operational
- CPU usage stable or decreasing

**CPU Profile**: Medium (fewer creeps than RCL 3, but larger)

### Tier 3: Late Game (RCL 8+) - Giant Phase
**Primary Goal**: Minimize CPU usage, maximize individual creep efficiency

**RCL 8: Maximum Optimization**
- **Major Change**: Reduce total creep count by ~70%
- Giant haulers [CARRY×32, MOVE×16] @ 1600 capacity
- Giant upgraders [WORK×15, CARRY×3, MOVE×6] @ 15 energy/tick
- Minimal workforce: typically 6-10 creeps total
- Build power spawn, nuker, observer
- All structures at maximum

**Advanced Operations**:
- Lab reactions (when implemented)
- Terminal trading (when implemented)
- Power processing
- Remote mining expansion (future)
- Multi-room coordination (future)

**Success Metrics**:
- **CPU Usage**: < 50% of RCL 7 usage (fewer creeps to process)
- Total creep count: < 15
- Storage surplus: > 500k energy
- All structures built and operational
- Controller continuously upgrading
- Ready for GCL increase

**CPU Profile**: Low (minimal creep count, maximum efficiency)

### Strategy Summary by Tier

| Tier | RCL | Strategy | Creep Count | Body Size | CPU Cost |
|------|-----|----------|-------------|-----------|----------|
| 1 | 1-3 | Swarm generalists | 15-20 | Small | High |
| 2 | 4-7 | Specialized medium | 10-15 | Medium | Medium |
| 3 | 8+ | Giant specialists | 6-10 | Giant | Low |

**Key Insight**: The strategy document's philosophy is fully implemented - "fewer, smarter creeps almost always beat more, dumber ones" once past bootstrapping.

## Expansion Strategy

### Room Claiming Process
1. Identify target room (currently hardcoded as E3S53)
2. Spawn claimer creep when energy > 700 and GCL allows
3. Claimer navigates to target room
4. Claims controller to establish ownership
5. New room enters planning mode automatically
6. Design base layout for new room
7. Switch to executing mode to develop

### Multi-Room Coordination
- Each room operates independently
- Main loop processes all owned rooms
- Shared memory for cross-room data
- Potential for creep transfers between rooms
- Centralized spawning decisions per room

## Strategic Weaknesses and Mitigations

### Current Limitations
1. **Single-Room Focus**: Limited multi-room optimization
   - *Mitigation*: Room-independent design allows scaling
   
2. **Hardcoded Expansion**: Claimer target room not dynamic
   - *Mitigation*: Easy to modify target in roleClaimer
   
3. **No Market Trading**: Terminal built but not utilized
   - *Future Enhancement*: Market monitoring and trading logic
   
4. **No Lab Reactions**: Labs planned but reactions not automated
   - *Future Enhancement*: Reaction queue and resource management
   
5. **Basic Combat**: Workers defend but no dedicated military
   - *Mitigation*: Sufficient for NPC invaders, towers provide main defense

### Risk Mitigation
- **Energy Starvation**: Emergency harvester spawning prevents death spiral
- **Structure Loss**: Critical repair priority prevents collapse
- **Invader Damage**: Combat-capable workers and towers defend
- **Construction Gridlock**: Dynamic builder scaling handles varying loads
- **Memory Bloat**: Automatic cleanup maintains performance

## Conclusion

This Screeps bot implements a comprehensive autonomous development strategy that:
- Automatically plans optimal base layouts
- Dynamically adapts workforce to colony needs
- Responds intelligently to threats
- Scales efficiently from RCL 1 to RCL 8
- Maintains infrastructure health
- Prevents common failure modes
- Requires minimal manual intervention

The strategy prioritizes sustainable growth, defensive capability, and economic efficiency while maintaining the flexibility to handle unexpected situations. The two-mode system (planning/executing) provides control over development while the automated systems handle routine operations.
