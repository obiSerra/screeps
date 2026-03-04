# Instruction for refactoring

## General instructions
Use functional programming principles, like composition


## Instructions

The file `main.js` should be the entry point, but it should not contain much logic


### Room Orchestration
The file `roomOrchestrator.js` should contain the logic that manage the room status and goals.

It should check inside the global memory if exists an entry `rooms.<roomName>.mode`; if not is should create the entry with value `planning`.

If the `rooms.<roomName>.mode` is `planning` it should plan the room layout using `planner.js` functions and visualize it on the map with an overlay, without performing any action. It should log in the console a message that warns the user that the room is in planning mode and that it must be changed manually `executing` to make it start.

If the `rooms.<roomName>.mode` is `executing` it should proceed with the normal implementation:

- I should gather the room status (controller level, max resources, available resources). This status should be calculate every tick and should drive the decision for each other component of the project.

### Planner

The planner should accept a `currentControllerLevel` parameter, and only place the flag appropriate for that controller level.

### Creeps handling

The spawing logic of the creeps and their behaviour should be the current one, but the code must be refactored and improved. All the spawing logic should be moved in a specific module