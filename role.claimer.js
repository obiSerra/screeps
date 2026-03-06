const utils = require("utils");
const baseCreep = require("baseCreep");

var roleClaimer = () => {
  const base = baseCreep.baseCreep;
  return {
    run: function (creep) {
      // If not in target room, move there

      if (creep.room.name !== "E3S53") {
        const targetPos = new RoomPosition(25, 25, "E3S53");
        creep.moveTo(targetPos, { visualizePathStyle: { stroke: "#ffffff" } });
        return;
      } else {
        if (creep.claimController(creep.room.controller) === ERR_NOT_IN_RANGE) {
          creep.moveTo(creep.room.controller, {
            visualizePathStyle: { stroke: "#ffffff" },
          });
        }
      }
    },
  };
};

module.exports = roleClaimer();
