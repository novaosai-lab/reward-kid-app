# Session and Specialist Strategy

## Use main session when
- the task is straightforward
- context from the current chat matters most
- no specialist framing is needed

## Use specialist framing in main session when
- support leadership judgment matters
- the user wants incident, RCA, SRE, DevOps, QA, or support analysis
- a persistent subagent is unavailable but consistent specialist behavior is still useful

## Delegate to a subagent when
- the work is long, parallelizable, or context-heavy
- a fresh context helps
- the task is a self-contained analysis or build effort

## Practical default
1. Stay in main session for most work.
2. Apply specialist prompts when the domain needs it.
3. Spawn subagents only when the complexity justifies it.
