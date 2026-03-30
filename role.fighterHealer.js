/**
 * Healer Fighter Role
 * Support units with HEAL parts
 * Stays behind front line to heal damaged allies
 */

const baseCreep = require("./baseCreep");

var roleFighterHealer = () => {
  const base = baseCreep.baseCreep;
  
  return {
    /** @param {Creep} creep **/
    run: function (creep) {
      // Healer fighters prioritize healing damaged allies
      // Priority: healing > rally (stay with squad)
      base.workerActions(creep, ["healing", "rally"]);
      
      // Perform the assigned action
      base.performAction(creep, creep.memory.action);
    },
  };
};

module.exports = roleFighterHealer();
