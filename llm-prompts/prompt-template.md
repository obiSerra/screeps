# Screep project update

## Context

This is a project for the game screeps (ref: https://docs.screeps.com/)

## Task

Update the flags-driven behaviour by:
- make sure the `remote_source` flag is actually used
- fix the `attack` flag behaviour, currently some category of fighter creeps (lile `RANGED_ATTACK`) ignore the attack target and start behave like  normal workers.

Once done, update all the related `md` files in the `llm-prompts` directory

## Agent instructions

Split the task in smaller sub-task when appropriate
Look for established tactics and strategies for the game Screep on internet
Generate a md file in the `llm-prompts` directory with the details of your update; the file will be used by human for review and by other LLM agents to perform further implementations


## Tech Requirements

Keep the code as clean as possible, preferring small reusable function over complicate logic
Apply functional programming principle
Reuse code when is possible and try to write reusable code
