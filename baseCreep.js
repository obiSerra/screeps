const utils = require("./utils");

const baseCreep = {
  findSource: utils.findBestSourceForCreep,
  gatherResource: function (creep) {
    const source = utils.findNearestEnergySource(creep);

      if (creep.harvest(source) == ERR_NOT_IN_RANGE) {
        creep.moveTo(source, { visualizePathStyle: { stroke: "#ffaa00" } });
      }
  },
};

exports.baseCreep = baseCreep;
