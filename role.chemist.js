/**
 * Chemist Role
 * Handles lab logistics - fills input labs, empties output labs
 * Small dedicated logistics role for lab operations
 * Works with labManager to keep reactions running
 */

const labManager = require("./labManager");

/**
 * Execute chemist tasks for lab management
 * @param{Creep} creep - The chemist creep
 */
const runChemist = (creep) => {
  const room = creep.room;
  const storage = room.storage;

  if (!storage) {
    creep.say("❌ no storage");
    return;
  }

  // Get lab tasks from lab manager
  const tasks = labManager.getLabTasks(room);

  if (tasks.length === 0) {
    // No tasks - idle near storage
    if (!creep.pos.inRangeTo(storage, 3)) {
      creep.moveTo(storage, { visualizePathStyle: { stroke: "#ffffff" } });
    }
    creep.say("💤 idle");
    return;
  }

  // Determine current state
  const isEmpty = creep.store.getUsedCapacity() === 0;
  const isFull = creep.store.getFreeCapacity() === 0;

  if (isEmpty) {
    // Find fill task (need to get resources from storage)
    const fillTask = tasks.find((t) => t.action === "fill");
    
    if (fillTask) {
      const lab = Game.getObjectById(fillTask.labId);
      const resourceType = fillTask.resourceType;
      const amount = Math.min(fillTask.amount, creep.store.getCapacity());

      // Withdraw from storage
      if (creep.pos.isNearTo(storage)) {
        const result = creep.withdraw(storage, resourceType, amount);
        if (result === OK) {
          creep.say(`📦 ${resourceType}`);
          creep.memory.task = { action: "fill", labId: fillTask.labId, resourceType };
        } else if (result === ERR_NOT_ENOUGH_RESOURCES) {
          creep.say(`❌ no ${resourceType}`);
        }
      } else {
        creep.moveTo(storage, { visualizePathStyle: { stroke: "#00ff00" } });
      }
      return;
    }

    // Find empty task (need to empty lab to storage)
    const emptyTask = tasks.find((t) => t.action === "empty");
    
    if (emptyTask) {
      const lab = Game.getObjectById(emptyTask.labId);
      const resourceType = emptyTask.resourceType;

      if (!lab) return;

      // Withdraw from lab
      if (creep.pos.isNearTo(lab)) {
        const amount = Math.min(emptyTask.amount, creep.store.getCapacity());
        const result = creep.withdraw(lab, resourceType, amount);
        if (result === OK) {
          creep.say(`⬇️ ${resourceType}`);
          creep.memory.task = { action: "empty", labId: emptyTask.labId, resourceType };
        }
      } else {
        creep.moveTo(lab, { visualizePathStyle: { stroke: "#ff0000" } });
      }
      return;
    }
  } else {
    // Carrying resources - complete the task
    const task = creep.memory.task;
    
    if (!task) {
      // No task assigned - probably just picked up, go to storage and deposit
      if (creep.pos.isNearTo(storage)) {
        for (const resourceType in creep.store) {
          creep.transfer(storage, resourceType);
        }
        delete creep.memory.task;
      } else {
        creep.moveTo(storage, { visualizePathStyle: { stroke: "#ffff00" } });
      }
      return;
    }

    if (task.action === "fill") {
      // Transfer to lab
      const lab = Game.getObjectById(task.labId);
      if (!lab) {
        delete creep.memory.task;
        return;
      }

      if (creep.pos.isNearTo(lab)) {
        const result = creep.transfer(lab, task.resourceType);
        if (result === OK || result === ERR_FULL) {
          creep.say(`⬆️ filled`);
          delete creep.memory.task;
        }
      } else {
        creep.moveTo(lab, { visualizePathStyle: { stroke: "#00ff00" } });
      }
    } else if (task.action === "empty") {
      // Transfer to storage
      if (creep.pos.isNearTo(storage)) {
        for (const resourceType in creep.store) {
          creep.transfer(storage, resourceType);
        }
        creep.say(`⬇️ emptied`);
        delete creep.memory.task;
      } else {
        creep.moveTo(storage, { visualizePathStyle: { stroke: "#ff0000" } });
      }
    }
  }
};

const roleChemist = () => {
  return {
    /** @param {Creep} creep **/
    run: function (creep) {
      runChemist(creep);
    },
  };
};

module.exports = roleChemist();
