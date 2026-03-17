# Statistics Tracking System

## Overview

A comprehensive 24-hour progression tracking system has been implemented to monitor your Screeps game performance. The system automatically tracks:

- **Spawning**: Creep spawns, body compositions, energy costs, and spawn failures
- **Resource Collection**: Energy harvested per source, total harvested, energy spent
- **Work Output**: Controller upgrades, construction progress, repairs, tower actions
- **Creep Lifecycle**: Creep counts by role, deaths, lifetimes
- **System Health**: CPU usage, bucket levels, RCL progression

## How It Works

### Automatic Tracking

The tracking system runs automatically in the background. Statistics are collected in time intervals:

- **Interval Duration**: 3000 ticks (~75 minutes)
- **History Kept**: 10 intervals (~30 hours of data)
- **Storage**: All data is stored in `Memory.stats` per room

### Data Collection Points

Statistics are collected at key points throughout your code:

1. **Spawns** - Tracked in `spawner.js` when creeps are spawned
2. **Harvesting** - Tracked in `baseCreep.js` when creeps harvest from sources
3. **Upgrading** - Tracked when creeps upgrade the controller
4. **Building** - Tracked when creeps build construction sites
5. **Repairing** - Tracked when creeps repair structures
6. **Tower Actions** - Tracked in `roomOrchestrator.js` for attack/heal/repair
7. **Deaths** - Tracked in `main.js` when creeps die
8. **System Stats** - CPU and bucket tracked every tick in `main.js`

## Console Commands

Three global functions are available in the Screeps console:

### 1. Current Statistics Report

```javascript
statsReport()          // Show report for all rooms
statsReport('W1N1')    // Show report for specific room
```

Displays current interval statistics including:
- Spawns and failures
- Energy harvested vs spent
- Work output (controller, construction, repairs)
- Average creep count and deaths
- CPU and bucket metrics

### 2. Historical Trends Report

```javascript
statsTrends()          // Show trends for all rooms
statsTrends('W1N1')    // Show trends for specific room
```

Displays trends across all completed intervals:
- Average spawns per interval
- Average harvest rate
- Net energy gain/loss trends
- Recent interval breakdown

### 3. Export Raw Data

```javascript
statsExport('W1N1')    // Export JSON data for room
```

Exports the complete statistics data in JSON format for external analysis or backup.

## Memory Structure

Statistics are stored in `Memory.stats` with the following structure:

```javascript
Memory.stats = {
  rooms: {
    'W1N1': {
      intervals: [
        {
          startTick: 12000,
          endTick: 14999,
          spawns: [{tick, role, body, cost}, ...],
          spawnFailures: 2,
          resources: {
            sources: {'sourceId': {harvested: 5000}},
            totalHarvested: 5000,
            totalSpent: 2000,
            energyStart: 10000,
            energyEnd: 15000
          },
          work: {
            controllerProgress: 1000,
            constructionProgress: 500,
            repairProgress: 200,
            towerAttacks: 5,
            towerHeals: 2,
            towerRepairs: 10
          },
          creeps: {
            totalCount: 240,
            ticksCounted: 20,
            avgCount: 12,
            byRole: {harvester: 60, miner: 40, ...},
            deaths: [{name, role, tick, lifetime}, ...]
          },
          system: {
            cpuTotal: 304.5,
            cpuCount: 20,
            avgCPU: 15.2,
            peakCPU: 24.8,
            bucketTotal: 190000,
            bucketCount: 20,
            avgBucket: 9500,
            minBucket: 8800
          },
          rcl: 5,
          gclProgress: 12500
        }
      ],
      current: { /* Same structure for ongoing interval */ }
    }
  },
  config: {
    intervalTicks: 3000,
    maxIntervals: 10
  }
}
```

## Usage Tips

### Regular Monitoring

Check your statistics every few hours to identify issues:

```javascript
statsReport()  // Quick snapshot of current performance
```

### Optimization Analysis

After making changes to your strategy, use trends to see the impact:

```javascript
statsTrends('W1N1')  // Compare before/after over multiple intervals
```

### Identifying Problems

Watch for these indicators:

- **High spawn failures**: You're trying to spawn too often with insufficient energy
- **Negative net energy**: You're spending more than harvesting (unsustainable)
- **Low bucket**: CPU usage is too high, risk of throttling
- **High creep deaths**: Creeps dying prematurely, inefficient spawning strategy
- **Low controller progress**: Not enough upgraders or they're not working efficiently

### Performance Benchmarking

Use the export function to save snapshots at key moments:

```javascript
// Before optimization
statsExport('W1N1')  // Save baseline

// ... make changes ...

// After optimization
statsExport('W1N1')  // Compare results
```

## Advanced Usage

### Direct Access

You can access the stats module directly in your code:

```javascript
const stats = require('./stats');

// Get current summary programmatically
const summary = stats.getCurrentSummary('W1N1');
console.log(`Net energy: ${summary.netEnergy}`);

// Check if you should optimize spawning
if (summary.spawnFailures > 10) {
  console.log('Warning: High spawn failure rate!');
}
```

### Custom Alerts

Add monitoring logic to detect anomalies:

```javascript
// In main.js loop
const summary = stats.getCurrentSummary(room.name);
if (summary && summary.avgCPU > 15) {
  console.log(`⚠️ High CPU usage in ${room.name}: ${summary.avgCPU}`);
}
if (summary && summary.minBucket < 5000) {
  console.log(`⚠️ Low bucket warning in ${room.name}: ${summary.minBucket}`);
}
```

## Troubleshooting

### "No statistics available"

If you see this message, wait a few ticks for the system to initialize and collect data.

### Memory Size Concerns

The statistics system is designed to keep a limited amount of data:
- 10 intervals × ~1KB per interval ≈ 10KB per room
- For multiple rooms, expect ~10-50KB total

If memory becomes an issue:
1. Reduce `intervalTicks` config (less granular data)
2. Reduce `maxIntervals` config (less history)
3. Disable per-source tracking if not needed

### Inaccurate Numbers

Some metrics are estimates based on body part counts:
- **Harvest**: Assumes 2 energy per WORK part per tick
- **Build**: Assumes 5 energy worth per WORK part per tick  
- **Repair**: Assumes 100 hits per WORK part per tick
- **Upgrade**: 1 energy per WORK part per tick

Actual values may vary due to:
- Source depletion
- Construction site completion
- Boosted creeps
- Energy shortages

These estimates are sufficient for trend analysis and optimization.

## Next Steps

1. **Run your game** for at least one full interval (3000 ticks / ~75 minutes)
2. **Check the report**: `statsReport()`
3. **Analyze trends**: Look for inefficiencies in spawning, harvesting, or CPU
4. **Optimize**: Adjust your roster calculations, body compositions, or priorities
5. **Compare**: Use `statsTrends()` to see if your changes improved performance

Happy optimizing! 📊
