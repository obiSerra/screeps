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

The bot employs a phased development strategy that adapts to each Room Control Level (RCL):

**RCL 1 - Bootstrap Phase**
- Primary focus: Upgrade controller to unlock extensions
- Workforce: Minimal harvesters, maximum upgraders
- Infrastructure: Source containers for efficient harvesting
- Emergency protocol: If no harvesters exist, spawn one immediately

**RCL 2 - Early Expansion**
- Primary focus: Build first extensions, establish road network
- Workforce: Balance between harvesting, upgrading, and building
- Infrastructure: 
  - First 5 extensions for increased energy capacity
  - Road network connecting spawn, sources, and controller
  - Ramparts for basic defense
- Strategy: Begin structured base layout implementation

**RCL 3 - Fortification Phase**
- Primary focus: Establish defense and increase energy throughput
- Workforce: Add builders when construction sites exceed threshold
- Infrastructure:
  - First towers for automated defense
  - Additional extensions (up to 10 total)
  - Expanded road network
  - Controller container for upgrader efficiency
- Defense: Towers handle invaders; workers gain combat capabilities

**RCL 4 - Storage Economy**
- Primary focus: Transition to storage-based economy
- Workforce: Maintain balanced workforce with adaptive builder count
- Infrastructure:
  - Central storage for bulk energy management
  - Complete extension network (up to 20)
  - Additional towers for improved defense
- Economic shift: Begin using stored energy for sustained operations

**RCL 5 - Link Network**
- Primary focus: Establish energy distribution network
- Infrastructure:
  - Links at storage, controller, and sources
  - More towers for complete room defense
  - Additional extensions (up to 30)
- Efficiency gain: Reduce creep travel time through link usage

**RCL 6-8 - Advanced Infrastructure**
- Primary focus: Unlock and build advanced structures
- Infrastructure by level:
  - RCL 6: Terminal, labs, extractor
  - RCL 7: Factory, additional spawn, more towers
  - RCL 8: Observer, power spawn, nuker, full extension count (60)
- Strategy: Maximize room efficiency and combat capability

## Workforce Management Strategy

### Creep Roles and Responsibilities

The bot employs specialized creep roles, each with distinct strategic priorities:

#### Harvesters
**Strategic Role**: Primary energy collection and distribution
**Action Priority**:
1. Harvest energy from sources
2. Upgrade controller when energy stores are empty
3. Repair damaged structures
4. Assist with construction if needed

**Adaptation**: When storage exists and containers are full, harvesters focus more on distribution

#### Upgraders
**Strategic Role**: Controller progression and emergency response
**Action Priority**:
1. Repair critical damage (structures below 1000 hits)
2. Upgrade controller
3. Harvest energy when empty
4. Repair non-critical damage
5. Assist with construction

**Strategic Importance**: Maintains continuous controller upgrade to prevent downgrade

#### Builders
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

#### Transporters
**Strategic Role**: Bulk energy movement in advanced economies
**Activation**: Only spawned when storage exists AND containers are at 50%+ capacity
**Behavior**: Move energy from full source containers to central storage
**Strategy**: Reduces harvester travel time, increases overall efficiency

#### Claimers
**Strategic Role**: Room expansion (currently configured for E3S53)
**Behavior**: Navigate to target room and claim controller
**Strategic Note**: Enables multi-room empire expansion

### Dynamic Roster Scaling

The bot uses an intelligent roster system that scales with room capacity:

#### Energy-Proportional Workforce
- **Formula**: Base workers = energyCapacity ÷ 300 (minimum 1)
- **Rationale**: More energy capacity = can support more workers
- **Distribution**:
  - Harvesters: ~50% of base workforce (min 2)
  - Builders: ~25% of base workforce (min 1)  
  - Upgraders: ~25% of base workforce (min 1)

#### Example Scaling by RCL
- **RCL 1** (300 capacity): 1 harvester, 1 builder, 1 upgrader
- **RCL 2** (550 capacity): 2 harvesters, 1 builder, 1 upgrader  
- **RCL 3** (800 capacity): 2 harvesters, 1 builder, 1 upgrader
- **RCL 4** (1300 capacity): 3 harvesters, 2 builders, 2 upgraders
- **RCL 5** (1800 capacity): 3 harvesters, 2 builders, 2 upgraders
- **RCL 6** (2300 capacity): 4 harvesters, 2 builders, 2 upgraders
- **RCL 7** (5600 capacity): 10 harvesters, 5 builders, 5 upgraders
- **RCL 8** (12900 capacity): 22 harvesters, 11 builders, 11 upgraders

**Strategic Benefits**:
- Prevents over-spawning in small rooms
- Automatically scales workforce as room grows
- Maintains balanced role distribution
- Adapts to room infrastructure development

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

#### Worker Design Philosophy
Workers use a balanced design that scales with available energy **and workforce needs**:
- **Base Components**: WORK (action speed), CARRY (capacity), MOVE (mobility)
- **Scaling Tiers**: 
  - Minimum: [WORK, CARRY, MOVE] @ 200 energy
  - Small: [WORK, WORK, CARRY, MOVE, MOVE] @ 400 energy
  - Medium: [WORK, WORK, WORK, CARRY, CARRY, MOVE, MOVE, MOVE] @ 650 energy
  - Large: [WORK, WORK, WORK, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE] @ 800 energy

#### Intelligent Size Scaling
**Key Innovation**: Creep size increases **only when workforce is sufficient**
- **When workforce < 75% of target**: Spawn small bodies (≤400 energy) to build numbers quickly
- **When workforce ≥ 75% of target**: Spawn largest affordable bodies for efficiency
- **Strategic Benefit**: Ensures task coverage before optimizing individual creep power

**Example**:
- Target: 4 harvesters, 2 builders, 2 upgraders (8 total)
- Current: 4 workers → 50% of target → spawn small (200-400 energy) creeps
- Current: 6 workers → 75% of target → spawn large (650-800 energy) creeps

This prevents:
- Having 2 large creeps that can't cover all tasks
- Energy waste on expensive creeps when more workers needed
- Gaps in base coverage during growth phases

#### Combat Enhancements
When invaders are detected or energy is abundant, workers receive combat upgrades:
- **Added Parts**: [TOUGH, TOUGH, ATTACK] (placed at body front for damage absorption)
- **Strategy**: All workers can defend, preventing creep loss during attacks
- **Cost Consideration**: Combat parts only added if energy budget allows

#### Specialized Bodies
- **Transporter**: Maximizes [WORK, CARRY, MOVE] sets up to 16 (48 parts total)
- **Fighter-Upgrader**: High-energy composition with [TOUGH, RANGED_ATTACK] for combat while upgrading
- **Claimer**: Minimal design [MOVE, MOVE, CLAIM] for room expansion

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

### Early Game (RCL 1-2)
**Primary Goal**: Establish sustainable energy economy
- Bootstrap workforce with minimal creeps
- Build first extensions ASAP for better spawns
- Connect infrastructure with roads
- Reach RCL 3 to unlock towers

**Success Metrics**: 
- Energy capacity > 800
- Continuous controller upgrading
- Roads connecting key structures

### Mid Game (RCL 3-5)
**Primary Goal**: Build defensive capability and storage economy
- Establish tower defense network
- Build storage for energy buffering
- Complete extension network for max capacity
- Deploy link network for efficiency

**Success Metrics**:
- Can defend against NPC invaders
- Storage accumulating energy
- All extensions built
- Sustainable construction progress

### Late Game (RCL 6-8)
**Primary Goal**: Unlock and utilize advanced capabilities
- Build labs for reaction production
- Establish terminal for market access
- Deploy factory for commodities
- Install observer for scouting
- Build power spawn and nuker

**Success Metrics**:
- All structures built for current RCL
- Energy surplus for power processing
- Lab reactions running
- Terminal active for trading
- Preparing for GCL increase

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
