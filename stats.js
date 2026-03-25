/**
 * Statistics tracking module for monitoring game progression over 24-hour periods.
 * Tracks spawning, resource collection, work output, and system health.
 */

const CONFIG = require("./config");

const stats = {
    /**
     * Configuration for statistics tracking
     */
    config: {
        intervalTicks: CONFIG.STATS.INTERVAL_LENGTH,  // ~75 minutes per interval
        maxIntervals: CONFIG.STATS.MAX_INTERVALS,     // Keep 10 intervals = ~30 hours of history
    },

    /**
     * Initialize the statistics structure for a room if it doesn't exist
     */
    initRoom: function(roomName) {
        if (!Memory.stats) {
            Memory.stats = {
                rooms: {},
                config: this.config
            };
        }

        if (!Memory.stats.rooms[roomName]) {
            Memory.stats.rooms[roomName] = {
                intervals: [],
                current: this.createEmptyInterval(Game.time)
            };
        }
    },

    /**
     * Create an empty interval structure
     */
    createEmptyInterval: function(startTick) {
        return {
            startTick: startTick,
            endTick: null,
            spawns: [],
            spawnFailures: 0,
            resources: {
                sources: {},
                totalHarvested: 0,
                totalSpent: 0,
                energyStart: 0,
                energyEnd: 0,
                // Rolling energy collection tracking (last 100 ticks)
                rollingHarvest: [],
                rollingWindow: CONFIG.STATS.ROLLING_HARVEST_WINDOW
            },
            work: {
                controllerProgress: 0,
                constructionProgress: 0,
                repairProgress: 0,
                towerAttacks: 0,
                towerHeals: 0,
                towerRepairs: 0
            },
            creeps: {
                totalCount: 0,   // Sum of creep counts per tick
                ticksCounted: 0, // Number of ticks counted (for averaging)
                byRole: {},
                deaths: []
            },
            system: {
                cpuTotal: 0,
                cpuCount: 0,
                peakCPU: 0,
                bucketTotal: 0,
                bucketCount: 0,
                minBucket: 10000
            },
            rcl: 0,
            gclProgress: 0
        };
    },

    /**
     * Check if we need to roll over to a new interval
     */
    checkIntervalRollover: function(roomName) {
        const room = Memory.stats.rooms[roomName];
        const current = room.current;
        const ticksElapsed = Game.time - current.startTick;

        if (ticksElapsed >= this.config.intervalTicks) {
            // Finalize current interval
            current.endTick = Game.time - 1;
            
            // Calculate averages for system stats
            if (current.system.cpuCount > 0) {
                current.system.avgCPU = current.system.cpuTotal / current.system.cpuCount;
            }
            if (current.system.bucketCount > 0) {
                current.system.avgBucket = current.system.bucketTotal / current.system.bucketCount;
            }
            
            // Calculate average creep count
            if (current.creeps.ticksCounted > 0) {
                current.creeps.avgCount = current.creeps.totalCount / current.creeps.ticksCounted;
            }

            // Archive the interval
            room.intervals.push(current);

            // Prune old intervals
            if (room.intervals.length > this.config.maxIntervals) {
                room.intervals.shift();
            }

            // Start new interval
            room.current = this.createEmptyInterval(Game.time);
            
            // Record starting energy for new interval
            const gameRoom = Game.rooms[roomName];
            if (gameRoom && gameRoom.storage) {
                room.current.resources.energyStart = gameRoom.storage.store.energy;
            }
        }
    },

    /**
     * Record a successful spawn
     */
    recordSpawn: function(roomName, role, body, energyCost) {
        this.initRoom(roomName);
        this.checkIntervalRollover(roomName);
        
        const current = Memory.stats.rooms[roomName].current;
        current.spawns.push({
            tick: Game.time,
            role: role,
            body: body,
            cost: energyCost
        });
        current.resources.totalSpent += energyCost;
    },

    /**
     * Record a spawn failure (not enough energy)
     */
    recordSpawnFailure: function(roomName) {
        this.initRoom(roomName);
        this.checkIntervalRollover(roomName);
        
        const current = Memory.stats.rooms[roomName].current;
        current.spawnFailures++;
    },

    /**
     * Record energy harvested from a source
     */
    recordHarvest: function(roomName, sourceId, amount) {
        if (amount <= 0) return;
        
        this.initRoom(roomName);
        this.checkIntervalRollover(roomName);
        
        const current = Memory.stats.rooms[roomName].current;
        
        if (!current.resources.sources[sourceId]) {
            current.resources.sources[sourceId] = { harvested: 0 };
        }
        
        current.resources.sources[sourceId].harvested += amount;
        current.resources.totalHarvested += amount;
    },

    /**
     * Update rolling energy collection tracking - call once per tick
     * Tracks energy harvested this tick for rolling average calculation
     */
    updateEnergyCollection: function(roomName) {
        this.initRoom(roomName);
        this.checkIntervalRollover(roomName);
        
        const current = Memory.stats.rooms[roomName].current;
        const resources = current.resources;
        
        // Initialize rolling harvest array if not present
        if (!resources.rollingHarvest) {
            resources.rollingHarvest = [];
            resources.rollingWindow = CONFIG.STATS.ROLLING_HARVEST_WINDOW;
            resources.lastTickHarvested = 0;
        }
        
        // Calculate energy harvested this tick
        const harvestedThisTick = current.resources.totalHarvested - (resources.lastTickHarvested || 0);
        resources.lastTickHarvested = current.resources.totalHarvested;
        
        // Add to rolling window
        resources.rollingHarvest.push(harvestedThisTick);
        
        // Trim to window size
        if (resources.rollingHarvest.length > resources.rollingWindow) {
            resources.rollingHarvest.shift();
        }
    },

    /**
     * Record controller upgrade work
     */
    recordUpgrade: function(roomName, amount) {
        if (amount <= 0) return;
        
        this.initRoom(roomName);
        this.checkIntervalRollover(roomName);
        
        const current = Memory.stats.rooms[roomName].current;
        current.work.controllerProgress += amount;
    },

    /**
     * Record construction work
     */
    recordConstruction: function(roomName, amount) {
        if (amount <= 0) return;
        
        this.initRoom(roomName);
        this.checkIntervalRollover(roomName);
        
        const current = Memory.stats.rooms[roomName].current;
        current.work.constructionProgress += amount;
    },

    /**
     * Record repair work
     */
    recordRepair: function(roomName, amount) {
        if (amount <= 0) return;
        
        this.initRoom(roomName);
        this.checkIntervalRollover(roomName);
        
        const current = Memory.stats.rooms[roomName].current;
        current.work.repairProgress += amount;
    },

    /**
     * Record tower actions
     */
    recordTowerAction: function(roomName, actionType) {
        this.initRoom(roomName);
        this.checkIntervalRollover(roomName);
        
        const current = Memory.stats.rooms[roomName].current;
        
        if (actionType === 'attack') {
            current.work.towerAttacks++;
        } else if (actionType === 'heal') {
            current.work.towerHeals++;
        } else if (actionType === 'repair') {
            current.work.towerRepairs++;
        }
    },

    /**
     * Record creep death
     */
    recordCreepDeath: function(roomName, creepName, role, ticksLived) {
        this.initRoom(roomName);
        this.checkIntervalRollover(roomName);
        
        const current = Memory.stats.rooms[roomName].current;
        current.creeps.deaths.push({
            name: creepName,
            role: role,
            tick: Game.time,
            lifetime: ticksLived
        });
    },

    /**
     * Update system statistics (CPU, bucket, etc.) - call once per tick
     */
    updateSystemStats: function(roomName) {
        this.initRoom(roomName);
        this.checkIntervalRollover(roomName);
        
        const current = Memory.stats.rooms[roomName].current;
        const cpu = Game.cpu.getUsed();
        const bucket = Game.cpu.bucket;
        
        // Track CPU
        current.system.cpuTotal += cpu;
        current.system.cpuCount++;
        if (cpu > current.system.peakCPU) {
            current.system.peakCPU = cpu;
        }
        
        // Track bucket
        current.system.bucketTotal += bucket;
        current.system.bucketCount++;
        if (bucket < current.system.minBucket) {
            current.system.minBucket = bucket;
        }
        
        // Track room info
        const room = Game.rooms[roomName];
        if (room && room.controller && room.controller.my) {
            current.rcl = room.controller.level;
            current.gclProgress = Game.gcl.progress;
            
            // Track energy in storage
            if (room.storage) {
                current.resources.energyEnd = room.storage.store.energy;
            }
        }
    },

    /**
     * Update creep count statistics - call once per tick
     */
    updateCreepStats: function(roomName) {
        this.initRoom(roomName);
        
        const current = Memory.stats.rooms[roomName].current;
        const room = Game.rooms[roomName];
        
        if (!room) return;
        
        const creeps = room.find(FIND_MY_CREEPS);
        current.creeps.totalCount += creeps.length;
        current.creeps.ticksCounted++;
        
        // Count by role
        for (const creep of creeps) {
            const role = creep.memory.role;
            if (role) {
                current.creeps.byRole[role] = (current.creeps.byRole[role] || 0) + 1;
            }
        }
    },

    /**
     * Get a summary of the current interval for a room
     */
    getCurrentSummary: function(roomName) {
        if (!Memory.stats || !Memory.stats.rooms[roomName]) {
            return null;
        }
        
        const current = Memory.stats.rooms[roomName].current;
        const ticksElapsed = Game.time - current.startTick;
        
        return {
            ticksElapsed: ticksElapsed,
            spawns: current.spawns.length,
            spawnFailures: current.spawnFailures,
            totalHarvested: current.resources.totalHarvested,
            totalSpent: current.resources.totalSpent,
            netEnergy: current.resources.totalHarvested - current.resources.totalSpent,
            energyInStorage: current.resources.energyEnd,
            controllerProgress: current.work.controllerProgress,
            constructionProgress: current.work.constructionProgress,
            avgCreeps: current.creeps.ticksCounted > 0 ? 
                (current.creeps.totalCount / current.creeps.ticksCounted).toFixed(1) : 0,
            deaths: current.creeps.deaths.length,
            avgCPU: current.system.cpuCount > 0 ? 
                (current.system.cpuTotal / current.system.cpuCount).toFixed(2) : 0,
            peakCPU: current.system.peakCPU.toFixed(2),
            avgBucket: current.system.bucketCount > 0 ? 
                Math.floor(current.system.bucketTotal / current.system.bucketCount) : 0,
            minBucket: current.system.minBucket,
            rcl: current.rcl
        };
    },

    /**
     * Display statistics report in console
     */
    report: function(roomName) {
        const summary = this.getCurrentSummary(roomName);
        
        if (!summary) {
            console.log(`No statistics available for room ${roomName}`);
            return;
        }
        
        console.log(`\n═══════════════════════════════════════════`);
        console.log(`  STATISTICS REPORT - ${roomName}`);
        console.log(`  RCL: ${summary.rcl} | Ticks: ${summary.ticksElapsed}/${this.config.intervalTicks}`);
        console.log(`═══════════════════════════════════════════`);
        console.log(`\n📊 SPAWNING:`);
        console.log(`  • Spawns: ${summary.spawns}`);
        console.log(`  • Failures: ${summary.spawnFailures}`);
        console.log(`  • Energy spent: ${summary.totalSpent}`);
        console.log(`\n⚡ RESOURCES:`);
        console.log(`  • Harvested: ${summary.totalHarvested}`);
        console.log(`  • Net gain: ${summary.netEnergy > 0 ? '+' : ''}${summary.netEnergy}`);
        console.log(`  • In storage: ${summary.energyInStorage}`);
        console.log(`\n🔨 WORK OUTPUT:`);
        console.log(`  • Controller: ${summary.controllerProgress}`);
        console.log(`  • Construction: ${summary.constructionProgress}`);
        console.log(`\n👥 CREEPS:`);
        console.log(`  • Average count: ${summary.avgCreeps}`);
        console.log(`  • Deaths: ${summary.deaths}`);
        console.log(`\n⚙️  SYSTEM:`);
        console.log(`  • CPU: ${summary.avgCPU} avg / ${summary.peakCPU} peak`);
        console.log(`  • Bucket: ${summary.avgBucket} avg / ${summary.minBucket} min`);
        console.log(`═══════════════════════════════════════════\n`);
    },

    /**
     * Display historical trend over all intervals
     */
    reportTrends: function(roomName) {
        if (!Memory.stats || !Memory.stats.rooms[roomName]) {
            console.log(`No statistics available for room ${roomName}`);
            return;
        }
        
        const room = Memory.stats.rooms[roomName];
        const intervals = room.intervals;
        
        if (intervals.length === 0) {
            console.log(`No completed intervals yet for room ${roomName}`);
            return;
        }
        
        console.log(`\n═══════════════════════════════════════════`);
        console.log(`  TRENDS REPORT - ${roomName}`);
        console.log(`  ${intervals.length} intervals (${intervals.length * this.config.intervalTicks} ticks)`);
        console.log(`═══════════════════════════════════════════\n`);
        
        // Calculate totals and averages
        let totalSpawns = 0;
        let totalHarvested = 0;
        let totalSpent = 0;
        let totalDeaths = 0;
        let avgCPU = 0;
        
        for (const interval of intervals) {
            totalSpawns += interval.spawns.length;
            totalHarvested += interval.resources.totalHarvested;
            totalSpent += interval.resources.totalSpent;
            totalDeaths += interval.creeps.deaths.length;
            if (interval.system.avgCPU) {
                avgCPU += interval.system.avgCPU;
            }
        }
        
        const avgSpawnsPerInterval = (totalSpawns / intervals.length).toFixed(1);
        const avgHarvestPerInterval = Math.floor(totalHarvested / intervals.length);
        const avgCPUOverall = (avgCPU / intervals.length).toFixed(2);
        const netEnergyPerInterval = Math.floor((totalHarvested - totalSpent) / intervals.length);
        
        console.log(`📈 OVERALL TRENDS:`);
        console.log(`  • Avg spawns/interval: ${avgSpawnsPerInterval}`);
        console.log(`  • Avg harvest/interval: ${avgHarvestPerInterval}`);
        console.log(`  • Avg net energy/interval: ${netEnergyPerInterval > 0 ? '+' : ''}${netEnergyPerInterval}`);
        console.log(`  • Total deaths: ${totalDeaths}`);
        console.log(`  • Avg CPU: ${avgCPUOverall}`);
        
        console.log(`\n📊 RECENT INTERVALS (last 5):`);
        const recent = intervals.slice(-5);
        for (let i = 0; i < recent.length; i++) {
            const interval = recent[i];
            const netEnergy = interval.resources.totalHarvested - interval.resources.totalSpent;
            console.log(`  ${i + 1}. Tick ${interval.startTick}-${interval.endTick}:`);
            console.log(`     Spawns: ${interval.spawns.length} | Harvest: ${interval.resources.totalHarvested} | Net: ${netEnergy > 0 ? '+' : ''}${netEnergy}`);
        }
        console.log(`═══════════════════════════════════════════\n`);
    },

    /**
     * Export statistics data for external analysis
     */
    exportData: function(roomName) {
        if (!Memory.stats || !Memory.stats.rooms[roomName]) {
            return null;
        }
        
        return JSON.stringify(Memory.stats.rooms[roomName], null, 2);
    },

    /**
     * Get energy collection metrics for adaptive spawning
     * @param {string} roomName - Room name
     * @returns {Object} Collection metrics including rate, efficiency tier, and threshold
     */
    getCollectionMetrics: function(roomName) {
        this.initRoom(roomName);
        
        const current = Memory.stats.rooms[roomName].current;
        const room = Game.rooms[roomName];
        
        if (!room) {
            return {
                energyCollectionRate: 0,
                timeToFillCapacity: Infinity,
                efficiencyTier: 'bootstrapping',
                spawnThreshold: 0.3
            };
        }
        
        const resources = current.resources;
        
        // Calculate rolling average energy collection rate
        let energyCollectionRate = 0;
        if (resources.rollingHarvest && resources.rollingHarvest.length > 0) {
            const sum = resources.rollingHarvest.reduce((a, b) => a + b, 0);
            energyCollectionRate = sum / resources.rollingHarvest.length;
        } else if (current.creeps.ticksCounted > CONFIG.EFFICIENCY.OPTIMIZED_THRESHOLD) {
            // Fallback: use overall average if rolling data not available
            energyCollectionRate = resources.totalHarvested / current.creeps.ticksCounted;
        }
        
        // Calculate time to fill capacity
        const energyCapacity = room.energyCapacityAvailable || 300;
        const timeToFillCapacity = energyCollectionRate > 0 ? 
            energyCapacity / energyCollectionRate : Infinity;
        
        // Determine efficiency tier based on collection rate
        let efficiencyTier = 'bootstrapping';
        let spawnThreshold = CONFIG.EFFICIENCY.SPAWN_CAPACITY.BOOTSTRAPPING;
        
        if (energyCollectionRate >= CONFIG.EFFICIENCY.OPTIMIZED_THRESHOLD) {
            efficiencyTier = 'optimized';
            spawnThreshold = CONFIG.EFFICIENCY.SPAWN_CAPACITY.OPTIMIZED;
        } else if (energyCollectionRate >= CONFIG.EFFICIENCY.ESTABLISHED_THRESHOLD) {
            efficiencyTier = 'established';
            spawnThreshold = CONFIG.EFFICIENCY.SPAWN_CAPACITY.ESTABLISHED;
        } else if (energyCollectionRate >= CONFIG.EFFICIENCY.DEVELOPING_THRESHOLD) {
            efficiencyTier = 'developing';
            spawnThreshold = CONFIG.EFFICIENCY.SPAWN_CAPACITY.DEVELOPING;
        }
        
        return {
            energyCollectionRate: energyCollectionRate,
            timeToFillCapacity: timeToFillCapacity,
            efficiencyTier: efficiencyTier,
            spawnThreshold: spawnThreshold,
            collectionEfficiency: energyCapacity / timeToFillCapacity
        };
    }
};

module.exports = stats;
