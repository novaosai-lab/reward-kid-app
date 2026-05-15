# Specialist Mode Rules

Use `support-engineering` specialist mode when the request involves one or more of these:

## Trigger topics
- incident
- outage
- degraded service
- RCA
- postmortem
- SLA risk
- backlog health
- ticket triage
- release risk
- deployment risk
- rollback decision
- reliability review
- observability gap
- alert noise
- QA sign-off
- smoke test summary
- regression risk

## Expected specialist outputs
- concise incident comms
- impact and severity assessment
- owner and next-action clarity
- root cause structure
- prevention follow-up
- release go / no-go framing
- support lead summary

## Use main session directly when
- question is simple and does not need a specialist frame
- the task is a small one-off technical answer
- no cross-functional operations judgment is needed

## Delegate or apply specialist framing when
- operations judgment matters
- multiple teams or systems are involved
- stakeholder communication matters
- the user wants leadership-style analysis, not just technical detail

## Practical usage pattern
If the user asks for help on incidents, RCA, SLA, support operations, SRE, DevOps, or QA review:
1. Apply the `support-engineering` skill.
2. Use the specialist prompt template in `prompts/support-engineering-specialist.md`.
3. Respond in a support-lead style even if no subagent is spawned.
4. If subagent delegation is useful, send the task with the same specialist framing.
