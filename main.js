const roleHarvester = require('role.harvester');
const roleUpgrader = require('role.upgrader');
const roleBuilder = require('role.builder');

const utils = require('utils');

module.exports.loop = function () {

const base_name = 'FirstBase'
const roster = {
    'harvester': 2,
    'builder': 0,
    'upgrader': 0
}




function spawnProcedure() {
    Object.keys(roster).forEach(role => {
        const creeps = _.filter(Game.creeps, (creep) => creep.memory.role == role);
        // console.log(`${role}s: ${creeps.length}`);

        if (creeps.length < roster[role]) {
            const newName = `${role.charAt(0).toUpperCase() + role.slice(1)}${Game.time}`;
            // console.log(`Spawning new ${role}: ${newName}`);
            Game.spawns[base_name].spawnCreep([WORK, CARRY, MOVE], newName, { memory: { role: role } });
        }
    });

}


for(var name in Memory.creeps) {
        if(!Game.creeps[name]) {
            delete Memory.creeps[name];
            // console.log('Clearing non-existing creep memory:', name);
        }
    }

    spawnProcedure();

    if(Game.spawns[base_name].spawning) {
        var spawningCreep = Game.creeps[Game.spawns['Spawn1'].spawning.name];
        Game.spawns[base_name].room.visual.text(
            '🛠️' + spawningCreep.memory.role,
            Game.spawns[base_name].pos.x + 1,
            Game.spawns[base_name].pos.y,
            {align: 'left', opacity: 0.8});
    }


    for(var name in Game.creeps) {
        var creep = Game.creeps[name];
        if(creep.memory.role == 'harvester') {
            roleHarvester.run(creep);
        }
        if(creep.memory.role == 'upgrader') {
            roleUpgrader.run(creep);
        }
        if(creep.memory.role == 'builder') {
            roleBuilder.run(creep);
        }
    }
}