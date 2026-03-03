var roleHarvester = require('role.harvester');
var roleUpgrader = require('role.upgrader');
var roleBuilder = require('role.builder');

module.exports.loop = function () {

const base_name = 'FirstBase'

for(var name in Memory.creeps) {
        if(!Game.creeps[name]) {
            delete Memory.creeps[name];
            console.log('Clearing non-existing creep memory:', name);
        }
    }

    var harvesters = _.filter(Game.creeps, (creep) => creep.memory.role == 'harvester');
    console.log('Harvesters: ' + harvesters.length);

    if(harvesters.length < 2) {
        var newName = 'Harvester' + Game.time;
        console.log('Spawning new harvester: ' + newName);
        Game.spawns[base_name].spawnCreep([WORK,CARRY,MOVE], newName,
            {memory: {role: 'harvester'}});
    }

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