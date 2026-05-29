# Support AI RCA / Triage Automation Guardrails

Purpose: adapt useful n8n/support-engineering patterns without letting AI create unsafe ticket actions or misleading RCA reporting.

## Safe pattern to reuse

1. **Ingest** resolved support tickets or incoming requests from a read-only/export source first.
2. **Classify to a fixed schema**: category, priority, customer impact, suspected root cause, confidence, evidence snippets, human-review flag.
3. **Separate facts from model judgment**: keep raw ticket IDs/summaries linked, and label any RCA as `suspected` until reviewed.
4. **Human-in-the-loop queue** for low confidence, security/access issues, production incidents, VIP/customer-facing regressions, or any recommended external message.
5. **Report trends, not blame**: aggregate recurring causes, product areas, gaps in docs/runbooks, and prevention ideas.
6. **Write only to a sandbox first**: local CSV/Markdown/Coda draft/Google Sheet draft; no direct customer replies, ticket status changes, or escalation changes until approved.

## Closed-loop support operating model

Adapt public n8n/support automation repos as layered patterns, not import-ready workflows:

1. **Triage**: category, priority, product area, customer impact, and evidence IDs.
2. **Escalation/SLA risk**: deterministic thresholds first, AI summaries second.
3. **Weekly intelligence**: metrics plus reviewed AI narrative; report-only by default.
4. **RCA review**: known/matched root causes go to trend reporting; unknown/low-confidence cases go to review.
5. **Action routing**: engineering, knowledge base, automation, monitoring, or training suggestions stay drafts until approved.
6. **Validation**: later compare recurrence, SLA impact, and customer repeats before marking a prevention action effective.

Do not let the weekly report or action suggestion silently rewrite the taxonomy. Taxonomy changes need a reviewer, date, rationale, and examples.

## Minimum output schema

```yaml
ticket_id: string
category: enum
priority: enum
customer_impact: low|medium|high|unknown
suspected_root_cause: string
confidence: 0.0-1.0
evidence: [short quoted snippets or ticket fields]
recommended_action: string
needs_human_review: boolean
review_reason: string
```

## Safety checks before adoption

- No secrets or PII in prompts/logs; redact emails, tokens, account IDs where possible.
- Test against historical tickets and compare to known labels before enabling live use.
- Track false positives/false negatives weekly.
- Keep an audit trail: model, prompt version, workflow version, reviewer, approval outcome.
- Prefer deterministic code nodes for SLA/queue rules; use AI only for summarization/classification where ambiguity exists.
- Add a policy gate before any write action. Treat customer messages, ticket status changes, escalation routing, production changes, and database writes as `require_approval` until a reviewer explicitly approves that exact action.
- Log every allowed/denied/review-required decision with: actor, source workflow, action type, policy version, evidence IDs, reviewer, timestamp, and rollback or close note.

## Good first Nova/OpenClaw adaptation

Create a local `support_rca_draft.csv -> Markdown weekly RCA digest` workflow before connecting n8n. The digest should list: top recurring themes, example ticket IDs, confidence, owner/team suggestion, and docs/runbook improvement opportunities.

## Evaluation pattern learned from AI-SRE repos

Before trusting any AI RCA workflow, create a tiny benchmark set from historical incidents/tickets:

- 10-20 known cases with accepted root cause, impact, mitigation, and final owner.
- Include red herrings: noisy logs, downstream symptoms, duplicate reports, and incomplete tickets.
- Score outputs on: evidence citation, root-cause accuracy, impact accuracy, safe next action, and whether it correctly asks for human review.
- Require the workflow to say `insufficient evidence` instead of guessing when facts are missing.
- Keep remediation read-only by default; any action that changes infrastructure, customer comms, ticket status, or access needs explicit human approval.

Minimum pass gate before live use: no unsafe auto-action recommendations, and ≥80% evidence-backed classification accuracy on the benchmark set.

## Simulation Benchmark Pattern

Pattern learned from incident-response benchmark repos: a useful SRE/RCA evaluator should reward the whole response trajectory, not only the final diagnosis.

For Nova pilots, model the incident review as a replayable sequence:

- initial alert and business impact
- evidence gathered, in order
- false leads or stale runbook steps that should be rejected
- mitigation options and blast-radius tradeoffs
- escalation/team communication
- final RCA and prevention action

Score each run on:

- asks for the right missing evidence before concluding
- avoids unsafe remediation when impact or authority is unclear
- separates confirmed facts, likely causes, and unknowns
- communicates current impact and next update clearly
- chooses bounded mitigation before broad production changes
- cites the evidence that supports final RCA

Do not connect simulation scoring to live remediation. Use it to improve prompts, runbooks, and review checklists first.

## Action validation fields

Track these before moving beyond report-only mode:

```yaml
proposed_owner: engineering|knowledge_base|automation|monitoring|training|support_ops|unknown
proposed_action_type: ticket|kb_update|runbook_update|monitoring_alert|automation_candidate|process_change|none
approval_status: draft|approved|rejected|needs_more_evidence
expected_signal: string
review_after_date: YYYY-MM-DD
recurrence_delta: improved|unchanged|worse|unknown
rollback_or_close_note: string
```

## Agent Governance Pattern

Use the Microsoft Agent Governance Toolkit idea as a design pattern even when Nova is not using the library directly:

1. Define the action taxonomy first: `read`, `draft`, `notify_private`, `send_external`, `update_ticket`, `change_infra`, `delete`.
2. Set the default policy to report-only or approval-required for anything outside Nova-owned local files.
3. Make destructive or externally visible actions impossible to reach by prompt alone; the workflow should branch through a policy/approval node.
4. Keep policy versions immutable in reports. If the rules change, old decisions must still cite the policy that produced them.
5. Prefer small, auditable allowlists over broad tool access. For example, allow `create_draft_digest` before allowing `send_email`.
