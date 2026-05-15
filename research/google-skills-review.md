# Google skills repo review

Source: https://github.com/google/skills
Local clone: `/Users/nova/.openclaw/workspace/external/google-skills`
Reviewed: 2026-05-13
License: Apache-2.0
Status: active development per README

## Repo summary
Google's Agent Skills repository for Google products/technologies, especially Google Cloud. Install path advertised by upstream: `npx skills add google/skills`.

## Available skills found
- `gemini-api` — Gemini API on Agent Platform / Vertex AI, Gen AI SDK patterns, structured output, tools, embeddings, Live API, media generation, tuning.
- `alloydb-basics` — AlloyDB clusters, instances, backups, MCP patterns.
- `bigquery-basics` — BigQuery datasets/tables/jobs, SQL, ML/Gemini analytics, IAM, MCP.
- `cloud-run-basics` — Cloud Run services/jobs/worker pools, deploy, IAM, MCP.
- `cloud-sql-basics` — Cloud SQL for MySQL/Postgres/SQL Server, proxy, backups, IAM, MCP.
- `firebase-basics` — Firebase project/dev workflow, CLI, security rules, App Check, MCP; points to firebase/agent-skills for fuller Firebase coverage.
- `gke-basics` — production-ready GKE Autopilot golden path, networking, security, observability, scaling, cost, inference, DR. Most detailed skill in repo.
- `google-cloud-recipe-onboarding` — first steps on Google Cloud.
- `google-cloud-recipe-auth` — auth/ADC/service identity guidance.
- `google-cloud-networking-observability` — VPC/firewall/NAT/logging/network diagnostics.
- `google-cloud-waf-security` — Well-Architected Framework security guidance.
- `google-cloud-waf-reliability` — Well-Architected Framework reliability guidance.
- `google-cloud-waf-cost-optimization` — Well-Architected Framework cost guidance.

## Fit for Nova/OpenClaw
High value to adapt:
1. `gemini-api` — directly useful for Gemini / Agent Platform coding patterns. Strong directive to use `google-genai`, avoid deprecated SDKs.
2. `cloud-run-basics` — useful if Nova builds/deploys lightweight services or webhooks.
3. `firebase-basics` — useful for web/mobile app backend work; must be careful because it triggers npm installs and login flows.
4. `gke-basics` — high-quality production checklist, but probably overkill unless Nick starts GKE/enterprise cloud infra work.
5. WAF security/reliability/cost — useful as review checklists for architecture reviews.

Medium value:
- BigQuery / Cloud SQL / AlloyDB if Nick starts data/backend work on GCP.
- Auth recipe is useful whenever Google Cloud credentials/ADC break.

Low immediate value:
- Onboarding recipe unless setting up a new GCP account/project.

## Safety / install notes
- Apache-2.0 license is friendly for copying/adapting.
- Do not blindly install all skills yet; several contain external command/login guidance (`gcloud`, `npx`, Firebase CLI) and could affect local environment.
- Best path: keep repo cloned as reference, selectively copy/adapt the few skills that match Nova's real workflows.
- If installing into OpenClaw skills, copy real directories rather than symlink, consistent with previous lesson that OpenClaw rejects skill symlink escapes.

## Recommendation
Keep this as a reference repo now. Next useful step: selectively adapt `gemini-api`, `cloud-run-basics`, and `firebase-basics` into Nova's workspace skills, with local safety notes added for credentials, billing, and deploy approvals.
