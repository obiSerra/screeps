/**
 * Centralized configuration for the Screeps AI
 * All tunable parameters are organized by functional category
 */

const CONFIG = {
    // ===========================
    // EFFICIENCY TIERS
    // ===========================
    EFFICIENCY: {
        // Energy collection efficiency tiers (energy/tick)
        OPTIMIZED_THRESHOLD: 10,      // ≥10 energy/tick
        ESTABLISHED_THRESHOLD: 5,     // ≥5 energy/tick
        DEVELOPING_THRESHOLD: 2,      // ≥2 energy/tick
        // Below DEVELOPING_THRESHOLD is considered bootstrapping

        // Spawn capacity percentages by tier
        SPAWN_CAPACITY: {
            BOOTSTRAPPING: 0.3,       // Spawn at 30% capacity
            DEVELOPING: 0.5,          // Spawn at 50% capacity
            ESTABLISHED: 0.7,         // Spawn at 70% capacity
            OPTIMIZED: 0.85           // Spawn at 85% capacity
        },

        // Body set counts by efficiency tier (for generalist creeps)
        BODY_SETS: {
            BOOTSTRAPPING: 2,         // 1-2 sets
            DEVELOPING: 4,            // 2-4 sets
            ESTABLISHED: 8            // 4-8 sets
            // OPTIMIZED uses maxAffordable
        }
    },

    // ===========================
    // SPAWNING PARAMETERS
    // ===========================
    SPAWNING: {
        // RCL multipliers for body sizing
        RCL_MULTIPLIERS: {
            1: 1,
            2: 1,
            3: 1,
            4: 1.5,
            5: 1.5,
            6: 2,
            7: 2,
            8: 2.5
        },

        // Emergency reserve system
        RESERVES: {
            MIN_CAPACITY_FOR_RESERVE: 500,
            BASIC_FIGHTER_THRESHOLD: 1500,      // Reserve 300 energy
            MEDIUM_FIGHTER_THRESHOLD: 2500,     // Reserve 500 energy
            BASIC_RESERVE_AMOUNT: 300,
            MEDIUM_RESERVE_AMOUNT: 500,
            LARGE_RESERVE_AMOUNT: 800
        },

        // Body part limits
        BODY_LIMITS: {
            SOFT_LIMIT: 47,                     // Add TOUGH/MOVE before this
            HARD_LIMIT: 50,                     // Screeps API maximum
            MAX_GENERALIST_SETS: 16,            // Max [WORK,CARRY,MOVE] sets
            MAX_MINER_WORK_PARTS: 5,            // Source cap: 10 energy/tick
            MINER_SETS_BEFORE_EXTRA_WORK: 2,    // Add 5th WORK after this
            MAX_HAULER_SETS_MID: 8,
            MAX_HAULER_SETS_LATE: 16,
            MAX_UPGRADER_SETS_MID: 10,
            MAX_UPGRADER_SETS_LATE: 8,
            MAX_BUILDER_SETS: 10,
            MAX_DEFENDER_SETS_EARLY: 3
        },

        // Body set costs
        BODY_COSTS: {
            GENERALIST_SET: 200,                // [WORK, CARRY, MOVE]
            MINER_SET: 250,                     // [WORK, WORK, MOVE]
            HAULER_SET: 150,                    // [CARRY, CARRY, MOVE]
            BUILDER_SET: 350,                   // [WORK, CARRY×2, MOVE×2]
            UPGRADER_MID_SET: 500,              // [WORK×2, CARRY, MOVE×2]
            UPGRADER_LATE_SET: 700,             // [WORK×3, CARRY, MOVE×2]
            DEFENDER_EARLY_SET: 140,            // [TOUGH, ATTACK, MOVE]
            FIGHTER_TOUGHNESS_SET: 70,          // [TOUGH×2, MOVE]
            EXPLORER_MIN_ENERGY: 800            // Min for [CLAIM, RANGED_ATTACK, MOVE]
        },

        // Fighter/Combat (deprecated - see FIGHTER_CLASSES in COMBAT section)
        FIGHTER: {
            MAX_ATTACK_PARTS: 2,
            RESERVED_CARRY: 1,
            MOVE_RATIO: 0.5                     // 1 MOVE per 2 non-MOVE parts
        },

        // Explorer ratios
        EXPLORER: {
            MOVE_TO_TOUGH_RATIO: 2              // 2 MOVE per 1 TOUGH
        }
    },

    // ===========================
    // ROSTER MANAGEMENT
    // ===========================
    ROSTERS: {
        // Base roster counts by RCL (before scaling adjustments)
        RCL_1_3: {
            HARVESTERS: 2,
            BUILDERS: 1,
            UPGRADERS: 1,
            UPGRADERS_ESTABLISHED: 3            // If established efficiency
        },
        RCL_4_5: {
            HARVESTERS: 2,
            // MINERS: sourceCount (dynamic)
            HAULER_OFFSET: 1,                   // sourceCount + 1
            BUILDERS: 1,
            UPGRADERS: 1
        },
        RCL_6_7: {
            // MINERS: sourceCount (dynamic)
            HAULER_OFFSET: 2,                   // sourceCount + 2
            BUILDERS: 2,
            UPGRADERS: 2,
            MINERAL_EXTRACTORS: 1,
            CHEMISTS: 1
        },
        RCL_8: {
            // MINERS: sourceCount (dynamic)
            HAULER_OFFSET: 4,                   // sourceCount + 4 (maximum)
            BUILDERS: 2,
            UPGRADERS: 4,                       // Maximum upgraders
            MINERAL_EXTRACTORS: 1,
            CHEMISTS: 1
        },

        // Dynamic scaling
        SCALING: {
            CONSTRUCTION_SITES_PER_BUILDER: 10, // Add builder per 10 sites
            MAX_BUILDERS: 4                     // Builder cap
        },

        // Tower management
        TOWER: {
            REPAIR_THRESHOLD: 0.2,              // Repair below 20% health
            RAMPART_PRIORITY_THRESHOLD: 0.5     // Prioritize ramparts below 50%
        }
    },

    // ===========================
    // ENERGY MANAGEMENT
    // ===========================
    ENERGY: {
        // Terminal energy reserves
        TERMINAL: {
            MIN_ENERGY: 50000,
            MAX_ENERGY: 200000
        },

        // Storage thresholds
        STORAGE: {
            MIN_FOR_PICKUP: 50000            // Min storage energy before upgraders pull from it
        },

        // Link transfers
        LINK: {
            MIN_TRANSFER_AMOUNT: 400,           // Min energy to transfer from source
            MIN_STORAGE_FREE_CAPACITY: 100,     // Stop transfers if storage link < this
            STORAGE_TO_CONTROLLER_THRESHOLD: 400, // Transfer when storage > this
            STORAGE_RANGE: 2,                   // Range to find storage link
            SOURCE_RANGE: 2,                    // Range to find source link
            CONTROLLER_RANGE: 3,                // Range to find controller link
            DEFAULT_RANGE: 1                    // Default getLinkNearPosition range
        },

        // Container thresholds (baseCreep.js)
        CONTAINER: {
            TARGET_THRESHOLD: 0.5,              // Target containers > 50% full
            HIGH_FILL_THRESHOLD: 0.75,          // High-fill containers
            MIN_DROPPED_RESOURCE: 50,           // Min dropped resource to collect
            MIN_FOR_PICKUP: 100                 // Min container energy for gathering
        },

        // Energy fill priority mode
        PRIORITY_MODE: {
            CRITICAL_TIME_TO_FILL_CAPACITY: 100,  // Activate priority mode if time to fill > this (ticks)
            HARVESTER_BOOST: 0,                  // Additional harvesters to spawn in priority mode
            MIN_TOWER_ENERGY_PERCENT: 0.10       // Minimum tower energy (10%) even in priority mode
        }
    },

    // ===========================
    // REPAIR & MAINTENANCE
    // ===========================
    REPAIR: {
        CRITICAL_HITS: 1000,                    // Structures below this = critical
        WALL_MIN_HITS: 1000000,                 // Minimum wall hits to maintain
        RAMPART_MIN_HEALTH_PERCENT: 0.5,        // Repair ramparts below 50%
        STRUCTURE_MIN_HEALTH_PERCENT: 0.5,      // Repair structures below 50%
        
        // Targeting/scoring
        CRITICAL_PRIORITY_BONUS: -1000000,      // Score bonus for critical repairs
        DISTANCE_DIVISOR: 50,                   // Distance factor in scoring
        CONTROLLER_LINK_RANGE: 3                // Range for finding controller link
    },

    // ===========================
    // TRADING (Terminal Manager)
    // ===========================
    TRADING: {
        // Resource reserves (min/max)
        MINERALS: {
            MIN: 5000,
            MAX: 20000
        },
        COMPOUNDS: {
            MIN: 2000,
            MAX: 10000
        },
        POWER: {
            MIN: 500,
            MAX: 5000
        },
        GHODIUM: {
            MIN: 2000,
            MAX: 10000
        },

        // Trading controls
        MIN_CREDITS: 10000,
        MAX_ORDER_UNITS: 5000,
        MIN_ORDER_VALUE: 100,
        MIN_ORDER_AMOUNT: 100,
        
        // Distance calculations
        ENERGY_COST_DIVISOR: 1000               // Energy cost per distance unit
    },

    // ===========================
    // COMPOUNDS (Lab Manager)
    // ===========================
    COMPOUNDS: {
        MIN_STOCK: 1000,                        // Produce if below this
        TARGET_STOCK: 5000,                     // Stop producing at this
        MIN_INPUT: 1000,                        // Min input minerals before reaction
        REACTION_INPUT_UNITS: 5,                // Units consumed per reaction
        MIN_LAB_FREE_CAPACITY: 10,
        BOOST_MULTIPLIER: 30,                   // 30 × body length units needed
        
        // Lab configuration
        LABS: {
            INPUT_LABS: 2,                      // First 2 labs are inputs
            RESERVED_BOOST_LABS: 2              // Last 2 labs reserved for boosts
        }
    },

    // ===========================
    // COMBAT & EXPLORATION
    // ===========================
    COMBAT: {
        ATTACK_RANGE: 3,                        // Attack hostiles within this range
        DEFENSIVE_RANGE: 5,                     // Defensive engagement range
        PATROL_MODULO: 4,                       // Patrol pattern variation
        PATROL_OFFSET: 2                        // Patrol position offset
    },

    // ===========================
    // OFFENSIVE FIGHTERS
    // ===========================
    OFFENSIVE: {
        // Default attack force size when no number specified (e.g., "attack" flag)
        DEFAULT_ATTACK_COUNT: 4,

        // Fighter class specifications
        FIGHTER_CLASSES: {
            // Fodder: Cheap disposable melee units (TOUGH + minimal ATTACK + MOVE)
            FODDER: {
                MAX_ATTACK_PARTS: 1,                // Only 1 ATTACK part
                MAX_TOUGH_PARTS: 10,                // Up to 10 TOUGH for damage absorption
                MOVE_RATIO: 0.5,                    // 1 MOVE per 2 non-MOVE parts
                MIN_COST: 140,                      // [TOUGH, ATTACK, MOVE] = 140
                TOUGH_MOVE_SET_COST: 60,            // [TOUGH, MOVE] = 60
                ICON: '💀',
                COLOR: '#FF6B6B'
            },
            // Invader: Balanced melee units (current fighter design)
            INVADER: {
                MAX_ATTACK_PARTS: 2,                // Up to 2 ATTACK parts
                MAX_TOUGH_PARTS: 20,                // More TOUGH than fodder
                RESERVED_CARRY: 1,                  // 1 CARRY for utility
                MOVE_RATIO: 0.5,                    // 1 MOVE per 2 non-MOVE parts
                MIN_COST: 280,                      // [ATTACK, CARRY, WORK, MOVE] = 280
                TOUGH_MOVE_SET_COST: 70,            // [TOUGH×2, MOVE] = 70
                ICON: '⚔️',
                COLOR: '#FF4444'
            },
            // Healer: Support units with HEAL parts
            HEALER: {
                MAX_HEAL_PARTS: 10,                 // Up to 10 HEAL parts
                RESERVED_CARRY: 1,                  // 1 CARRY to pick up energy
                MOVE_RATIO: 1.0,                    // 1 MOVE per 1 HEAL (fast movement)
                MIN_COST: 350,                      // [HEAL, CARRY, MOVE×2] = 350
                HEAL_MOVE_SET_COST: 300,            // [HEAL, MOVE] = 300
                OPTIMAL_RANGE: 3,                   // Stay 3 tiles behind front line
                ICON: '💊',
                COLOR: '#4CAF50'
            },
            // Shooter: Ranged damage dealers
            SHOOTER: {
                MAX_RANGED_ATTACK_PARTS: 10,        // Up to 10 RANGED_ATTACK parts
                RESERVED_CARRY: 1,                  // 1 CARRY to pick up energy
                MOVE_RATIO: 1.0,                    // 1 MOVE per 1 RANGED_ATTACK (kiting)
                MIN_COST: 300,                      // [RANGED_ATTACK, CARRY, MOVE×2] = 300
                RANGED_MOVE_SET_COST: 200,          // [RANGED_ATTACK, MOVE] = 200
                OPTIMAL_RANGE: 3,                   // Maintain range 3 for safety
                ICON: '🎯',
                COLOR: '#2196F3'
            }
        },

        // Fighter composition ratios per RCL (percentages, must sum to 1.0)
        // Format: { fodder: 0.5, invader: 0.3, healer: 0.1, shooter: 0.1 }
        FIGHTER_RATIOS: {
            1: { fodder: 0.0, invader: 0.0, healer: 0.0, shooter: 0.0 },    // Early: cheap fodder only
            2: { fodder: 0.0, invader: 0.0, healer: 0.0, shooter: 0.0 },
            3: { fodder: 0.0, invader: 0.0, healer: 0.0, shooter: 0.0 },
            4: { fodder: 0.0, invader: 0.0, healer: 0.0, shooter: 0.0 },  // Mid: introduce support
            5: { fodder: 0.5, invader: 0.3, healer: 0.1, shooter: 0.1 },
            6: { fodder: 0.0, invader: 0.0, healer: 0.0, shooter: 1 },  // Late: balanced composition
            7: { fodder: 0.3, invader: 0.4, healer: 0.15, shooter: 0.15 },
            8: { fodder: 0.25, invader: 0.4, healer: 0.2, shooter: 0.15 }   // End: strong invaders + support
        }
    },

    DEFENDER: {
        TOWER_EFFECTIVENESS_FACTOR: 2.0,        // 1 tower ≈ 2 defenders worth of power
        MIN_TOWER_ENERGY_PERCENT: 0.3,          // Spawn defenders if towers < 30% energy
        THREAT_MULTIPLIER_IF_ATTACKS: 1.5,      // Threat × 1.5 if invaders near structures
        THREAT_MULTIPLIER_IF_KILLS: 2.5,        // Threat × 2.5 if killed creeps in last 50 ticks
        MAX_DEFENDERS: 5,                       // Cap on simultaneous defenders
        EMERGENCY_SPAWN_OVERRIDE: true,         // Skip 70% energy threshold for defenders
        CREEP_LOSS_MEMORY_TICKS: 50            // How long to remember deaths
    },

    // ===========================
    // PATHFINDING & REUSE
    // ===========================
    PATHFINDING: {
        PATH_REUSE_TICKS: 20,                   // Reuse paths for this many ticks
        MINERAL_EXTRACTOR_REUSE: 50             // Longer reuse for mineral extractors
    },

    // ===========================
    // STATISTICS TRACKING
    // ===========================
    STATS: {
        INTERVAL_LENGTH: 3000,                  // ~75 minutes per interval
        MAX_INTERVALS: 10,                      // Keep ~30 hours history
        ROLLING_HARVEST_WINDOW: 100             // Rolling window size
    },

    // ===========================
    // UTILITY WEIGHTS
    // ===========================
    UTILITY: {
        // Source selection weights
        DISTANCE_WEIGHT: 2,                     // 2× distance multiplier
        CREEP_WEIGHT: 1,                        // 1× creeps targeting weight
        ENERGY_WEIGHT: 1,                       // 1× available energy weight
        
        // Distance transform
        DISTANCE_TRANSFORM_INITIAL: 256,        // 1 << 8
        DISTANCE_FALLBACK: 100,                 // Out-of-bounds fallback
        
        // Logging
        INVADER_LOG_FREQUENCY: 10,
        DEFAULT_LOG_FREQUENCY: 100
    },

    // ===========================
    // REMOTE HARVESTING
    // ===========================
    REMOTE_HARVESTING: {
        ENABLED: true,                          // Enable remote harvesting via source_X flags
        DISTANCE_PENALTY_MULTIPLIER: 1.5,       // Multiply distance weight by this for remote sources
        AVOID_HOSTILE_ROOMS: false,              // Skip remote sources in rooms with hostiles
        FLAG_PATTERN: /^source_\d+$/,            // Flag naming pattern: source_1, source_2, etc.
        DEFAULT_DISTANCE: 100
    }
};

module.exports = CONFIG;
