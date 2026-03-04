```
// ---- Room spawn-scout ----
// Paste in console while you have vision of the room.
// Example: scoutRoom('W8N3')

function scoutRoom(roomName) {
    const room   = Game.rooms[roomName];
    if (!room) return console.log(`No vision of ${roomName}`);

    const terrain = Game.map.getRoomTerrain(roomName);
    const size    = 50;

    // Helpers
    const getExitDist = (x, y) => {
        return Math.min(x, y, size - 1 - x, size - 1 - y);
    };
    const isPlain = (x, y) => terrain.get(x, y) !== TERRAIN_MASK_WALL;
    const isSwamp = (x, y) => terrain.get(x, y) === TERRAIN_MASK_SWAMP;

    // Key objects
    const sources   = room.find(FIND_SOURCES);
    const controller = room.controller;
    if (!controller) return console.log('No controller in room');

    // Distance transform to nearest wall (cheap open-space check)
    const open = new Array(size).fill(0).map(_ => new Array(size).fill(0));
    for (let x = 0; x < size; x++) {
        for (let y = 0; y < size; y++) {
            if (!isPlain(x, y)) open[x][y] = -1;
        }
    }
    for (let x = 1; x < size - 1; x++) {
        for (let y = 1; y < size - 1; y++) {
            if (open[x][y] === 0)
                open[x][y] = Math.min(
                    open[x-1][y] + 1,
                    open[x][y-1] + 1,
                    open[x+1][y] + 1,
                    open[x][y+1] + 1
                );
        }
    }

    // Score every tile
    let best = {score:-Infinity, x:0, y:0};
    for (let x = 1; x < size - 1; x++) {
        for (let y = 1; y < size - 1; y++) {
            if (!isPlain(x, y)) continue;

            // 3×3 must be clear
            let clear = true;
            for (let dx = -1; dx <= 1; dx++) {
                for (let dy = -1; dy <= 1; dy++) {
                    if (!isPlain(x + dx, y + dy)) { clear = false; break; }
                }
                if (!clear) break;
            }
            if (!clear) continue;

            const exitDist = getExitDist(x, y);
            if (exitDist < 4) continue; // too close to exit

            // Sum linear distances to sources + controller
            let distSum = 0;
            sources.forEach(s => distSum += Math.abs(s.pos.x - x) + Math.abs(s.pos.y - y));
            distSum += Math.abs(controller.pos.x - x) + Math.abs(controller.pos.y - y);

            // Score: low distSum is good, high exitDist is good, swamp is bad
            const score = -distSum * 3          // closer = better
                        + exitDist * 2          // farther from exit = better
                        - (isSwamp(x, y) ? 5 : 0);

            if (score > best.score) best = {score, x, y};
        }
    }

    // Visualize
    new RoomVisual(roomName)
        .circle(best.x, best.y, {radius:1, fill:'#00ff00', stroke:'#ffffff'})
        .text('SPAWN', best.x, best.y-1, {color:'#ffffff', font:0.8});

    console.log(`Best spawn spot in ${roomName}: ${best.x},${best.y}  (score ${best.score.toFixed(1)})`);
}
```