const utils = require("utils");
const baseCreep = require("baseCreep");

var roleClaimer = () => {
  const base = baseCreep.baseCreep;
  return {
    run: function (creep) {
      // Find the claim flag
      const claimFlag = Game.flags['claim'];
      
      if (!claimFlag) {
        creep.say('No flag');
        return;
      }
      
      // If not in target room, move there
      if (creep.room.name !== claimFlag.pos.roomName) {
        creep.moveTo(claimFlag, { visualizePathStyle: { stroke: "#ffffff" } });
        return;
      } else {
        console.log(`Creep ${creep.name} is in the target room ${creep.room.name}`);
        if (creep.claimController(creep.room.controller) === ERR_NOT_IN_RANGE) {
          creep.moveTo(creep.room.controller, {
            visualizePathStyle: { stroke: "#ffffff" },
          });
        } else {
          console.log(`Error claiming ${creep.claimController(creep.room.controller)}`);
        }
      }
    },
  };
};

module.exports = roleClaimer();
