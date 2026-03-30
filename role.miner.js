const utils = require("utils");
const baseCreep = require("baseCreep");
const flagManager = require("flagManager");

/**
 * Miner role - stationary harvester at source
 * Sits at assigned source and harvests continuously
 * Drops energy to container or ground for haulers to collect
 * Used in RCL 4+ specialized strategy
 * Supports remote harvesting via remoteSourceId memory property
 */
var roleMiner = () => {
  const base = baseCreep.baseCreep;
  return {
    /** @param {Creep} creep **/
    run: function (creep) {
      // Check if this is a remote miner
      if (creep.memory.remoteSourceId !== undefined) {
        const flagName = 'source_' + creep.memory.remoteSourceId;
        const flag = flagManager.getFlag(flagName);
        
        if (!flag) {
          console.log(`Remote miner ${creep.name} has no flag: ${flagName}`);
          // Flag removed, switch to local mining
          delete creep.memory.remoteSourceId;
          delete creep.memory.remoteFlagName;
        } else {
          // Navigate to remote room if not there yet
          if (creep.room.name !== flag.pos.roomName) {
            creep.moveTo(flag, {
              visualizePathStyle: { stroke: '#ffaa00', opacity: 0.5 }
            });
            return;
          }
          
          // In remote room - find source near flag if not assigned
          if (!creep.memory.assignedSource) {
            const sources = flag.pos.findInRange(FIND_SOURCES, 2);
            if (sources.length > 0) {
              creep.memory.assignedSource = sources[0].id;
            }
          }
        }
      }
      
      // Miners focus exclusively on mining at their assigned source
      base.workerActions(creep, ["rally", "mining"]);
      
      base.performAction(creep, creep.memory.action);
    },
  };
};

module.exports = roleMiner();
