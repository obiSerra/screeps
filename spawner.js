/**
 * Spawner Module - Main Orchestrator
 * Coordinates spawn procedure using modular components
 */

const utils = require("./utils");
const { displaySpawningVisual, trySpawn } = require("./spawnerCore");
const {
  countCreepsByRole,
  getRequiredFighterCount,
  findBestRoleToSpawn,
} = require("./spawnerRoster");

/**
 * Main spawn procedure - simplified spawning logic
 * Priority 1: Fighter (if hostiles) or minimum fleet (2 harvesters, 2 builders, 1 upgrader)
 * Priority 2: Spawn from roster only if energy >= 80% capacity
 * @param {StructureSpawn} spawn - The spawn structure
 * @param {Object} roster - Target roster {role: count}
 * @param {Object} roomStatus - Current room status
 * @returns {Object} Spawn result info
 */
const spawnProcedure = (spawn, roster, roomStatus) => {
  if (!spawn || spawn.spawning) {
    displaySpawningVisual(spawn);
    return {
      spawned: false,
      reason: spawn && spawn.spawning ? "busy" : "no_spawn",
    };
  }

  const currentCreeps = countCreepsByRole(Game.creeps, roomStatus.roomName);
  const room = Game.rooms[roomStatus.roomName];
  const hasHostiles = room && utils.areThereInvaders(room);

  // PRIORITY 1: Fighters for combat (hostiles, attack, or prepare_attack flags)
  const requiredFighters = getRequiredFighterCount(hasHostiles);
  if (requiredFighters > 0 && (currentCreeps.fighter || 0) < requiredFighters) {
    const flagType = Game.flags["attack"]
      ? "attack"
      : Object.keys(Game.flags).some((n) => n.startsWith("prepare_attack"))
        ? "prepare_attack"
        : "defense";
    console.log(
      `⚔️ Spawning fighter (${(currentCreeps.fighter || 0) + 1}/${requiredFighters}) for ${flagType}`,
    );
    const result = trySpawn(spawn, "fighter", roomStatus, room);
    displaySpawningVisual(spawn);
    return result;
  }

  // PRIORITY 1: Minimum fleet
  const minimumFleet = { harvester: 2, builder: 2, upgrader: 1 };
  for (const [role, min] of Object.entries(minimumFleet)) {
    if ((currentCreeps[role] || 0) < min) {
      console.log(
        `Spawning ${role} (${(currentCreeps[role] || 0) + 1}/${min}) to maintain minimum fleet`,
      );
      const result = trySpawn(spawn, role, roomStatus, room);
      displaySpawningVisual(spawn);
      return result;
    }
  }

  // PRIORITY 1.5: Explorer for claiming/exploration flags
  if (Game.flags["claim"] && !currentCreeps.claimer) {
    const role = "claimer";
    const result = trySpawn(spawn, role, roomStatus, room);
    displaySpawningVisual(spawn);
    return result;
  }

  // PRIORITY 2: Only spawn if energy >= 80% capacity
  const energyRatio = roomStatus.energyAvailable / roomStatus.energyCapacity;
  const minEnergyRatio = 0.7;
  if (energyRatio < minEnergyRatio) {
    displaySpawningVisual(spawn);
    utils.periodicLogger(
      `Energy at ${Math.round(energyRatio * 100)}% - waiting to spawn until >= ${minEnergyRatio * 100}% - ${roomStatus.roomName}`,
      10,
    );
    return { spawned: false, reason: "waiting_for_energy" };
  }

  console.log(
    `Energy sufficient for spawning - checking roster priorities - ${roomStatus.roomName}`,
  );

  // Find best role from roster (biggest deficit)
  const bestRole = findBestRoleToSpawn(roster, currentCreeps, roomStatus);
  if (bestRole) {
    const result = trySpawn(spawn, bestRole, roomStatus, room);
    displaySpawningVisual(spawn);
    return result;
  }

  displaySpawningVisual(spawn);
  // console.log(
  //   `Roster is currently full - no spawn needed - ${roomStatus.roomName}`,
  // );
  return { spawned: false, reason: "roster_full" };
};

module.exports = {
  spawnProcedure,
  countCreepsByRole,
};
