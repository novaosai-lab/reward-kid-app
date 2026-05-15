# Nova Skills Catalog

_Updated: 2026-05-07 · Total skills: 36_

> สรุป skills ที่ Nova ใช้ได้ใน workspace แบ่งตามงาน เพื่อเลือกใช้เร็วขึ้นค่ะ

## Quick Pick

| Need | Use skills |
|---|---|
| ทำหน้า/สรุปให้สวย มี design direction | `design-system-ui` |
| เคส support / incident / RCA | `support-ticket-triage`, `incident-workflow`, `incident-timeline-writer`, `root-cause-tracing`, `sentry-triage` |
| n8n / workflow automation | `n8n-openclaw-automation`, `n8n-orchestration-pattern` |
| YouTube relax/content | `youtube-content-pipeline`, `youtube-analysis-pro`, `content-research-writer` |
| Coda/Obsidian knowledge base | `coda-knowledge-automation`, `obsidian-knowledge-workflow`, `obsidian-markdown`, `obsidian-bases` |
| Web/mobile/code testing | `webapp-testing`, `mobile-app-testing`, `qa-release`, `codebase-migrate` |
| Skill safety / community repo vetting | `skill-security-vetting`, `skill-creator` |

## Design / Presentation

- **`coda-knowledge-automation`** — Work with Coda.io docs, tables, rows, pages, and automations as a support knowledge source. Use for Coda read-only RAG planning, App Support SOP/RCA/known-issue lookup, Coda API sync design, table export analysis, and safe idempotent Coda update workflows.  
  _skills/coda-knowledge-automation/SKILL.md_
- **`design-system-ui`** — Create or adapt DESIGN.md-style design systems and visually polished UI/catalog pages. Use when Nick asks for beautiful presentation, dashboards, landing pages, skill catalogs, brand mood, component styling, color palettes, typography, layout rules, or AI-agent-readable design guidance.  
  _skills/design-system-ui/SKILL.md_
- **`json-canvas`** — Create and edit Obsidian JSON Canvas (.canvas) files with text, file, link, and group nodes plus edges. Use for visual maps, incident flow diagrams, architecture maps, project boards, support process maps, and Obsidian Canvas automation.  
  _skills/json-canvas/SKILL.md_
- **`mcp-builder`** — Design, build, review, or plan MCP servers and agent tool integrations. Use for external API tooling, agent-centric tool design, schema validation, auth/rate-limit handling, FastMCP/TypeScript MCP SDK planning, evaluation scenarios, and safe tool surface design.  
  _skills/mcp-builder/SKILL.md_
- **`mobile-app-testing`** — Android app testing with APK/XAPK, adb, emulator workflows, launch diagnostics, screenshots, logcat analysis, and practical smoke-test guidance. Use when installing mobile builds, checking app launch behavior, reproducing issues, capturing evidence, or debugging why an app opens, crashes, or closes on emulator/device.  
  _skills/mobile-app-testing/SKILL.md_
- **`n8n-openclaw-automation`** — Build, troubleshoot, and refine n8n workflows that use OpenClaw, Google Sheets, Google Chat, HTTP nodes, schedules, and automation glue. Use when creating digests, alerts, workflow logic, node expressions, cron timing, env/credential handling, or OpenClaw-powered automation in n8n.  
  _skills/n8n-openclaw-automation/SKILL.md_
- **`n8n-orchestration-pattern`** — Design OpenClaw + n8n orchestration where OpenClaw delegates deterministic or credentialed external actions to n8n webhooks. Use for Google Chat/Sheets/Slides, YouTube upload/logging, Coda, email, Slack, Jira, and any automation where credentials should stay in n8n.  
  _skills/n8n-orchestration-pattern/SKILL.md_
- **`qa-release`** — QA sign-off, smoke testing, regression risk review, reproduction analysis, release confidence summaries, and blocker tracking. Use when assessing build quality, summarizing test results, deciding release confidence, or structuring expected-vs-actual findings.  
  _skills/qa-release/SKILL.md_
- **`support-engineering`** — End-to-end support leadership for Application Support, Incident Management, SRE, DevOps, and QA work. Use when handling incidents, triage, RCA, SLA risk, production support, release risk, observability gaps, reliability reviews, runbook design, test strategy, smoke/regression planning, stakeholder updates, or cross-functional operations decisions.  
  _skills/support-engineering/SKILL.md_
- **`webapp-testing`** — Test local or deployed web apps with browser automation, smoke tests, screenshots, console/network inspection, DOM checks, and user-flow validation. Use for frontend QA, debugging UI behavior, verifying local dev servers, checking deploys, and producing evidence-backed test summaries.  
  _skills/webapp-testing/SKILL.md_

## Support / Incident / RCA

- **`application-support`** — Ticket triage, backlog review, SLA risk assessment, recurring issue analysis, stakeholder summaries, and production support decision-making. Use when working support queues, operational dashboards, support digests, aging cases, service-impact reviews, or application-support leadership tasks.  
  _skills/application-support/SKILL.md_
- **`engineering-partner`** — Technical execution partner for debugging, code changes, implementation planning, refactoring, verification, testing strategy, and engineering decision support. Use when coding, reviewing technical options, debugging systems, planning implementations, or turning ideas into verified technical work.  
  _skills/engineering-partner/SKILL.md_
- **`incident-manager`** — Incident command, major incident coordination, severity assessment, stakeholder updates, mitigation tracking, and post-incident follow-up. Use when handling outages, degraded services, cross-team incidents, executive updates, rollback decisions, or operational command during live incidents.  
  _skills/incident-manager/SKILL.md_
- **`incident-timeline-writer`** — Create precise incident timelines from logs, alerts, chat notes, ticket updates, deploy history, monitoring screenshots, and rough post-incident notes. Use for RCA preparation, stakeholder review, mitigation tracking, evidence-backed action plans, and production incident reconstruction.  
  _skills/incident-timeline-writer/SKILL.md_
- **`incident-workflow`** — Structured incident command workflow for severity assessment, fact/risk tracking, stakeholder updates, mitigation, handoff, and RCA preparation. Use for live incidents, degraded services, urgent support escalations, or post-incident follow-up when a durable operational cadence is needed.  
  _skills/incident-workflow/SKILL.md_
- **`meeting-notes-and-actions`** — Turn meeting transcripts, rough notes, call logs, chat discussions, or pasted meeting text into concise summaries, decisions, risks, open questions, and owner-tagged action items. Use for Zoom/Meet/Teams transcripts, support syncs, incident reviews, stakeholder meetings, and follow-up drafting.  
  _skills/meeting-notes-and-actions/SKILL.md_
- **`obsidian-knowledge-workflow`** — Work with Obsidian vaults as a knowledge system: create, edit, organize, link, search, refactor, and maintain Markdown notes, daily notes, project notes, SOP/RCA/runbook libraries, and personal knowledge bases. Use when planning or operating an Obsidian-based second brain or support knowledge vault.  
  _skills/obsidian-knowledge-workflow/SKILL.md_
- **`root-cause-tracing`** — Trace errors back to their original trigger across logs, stack traces, async jobs, API calls, database writes, deploys, config changes, and user actions. Use for deep debugging, RCA preparation, recurring defects, hidden upstream causes, and production issue investigation.  
  _skills/root-cause-tracing/SKILL.md_
- **`sentry-triage`** — Diagnose Sentry issues, alerts, stack traces, event payloads, breadcrumbs, releases, suspect commits, source-map problems, and recurring production errors. Use when investigating Sentry links, copied stack traces, crash spikes, regression alerts, or preparing fix recommendations with local code inspection.  
  _skills/sentry-triage/SKILL.md_
- **`spreadsheet-formula-helper`** — Write, debug, explain, and translate Excel or Google Sheets formulas, pivot logic, array formulas, QUERY/FILTER/XLOOKUP/VLOOKUP/INDEX-MATCH, date/time formulas, SLA calculations, dashboard metrics, and reporting formulas. Use for spreadsheet automation, support KPI reports, and CSV/Sheet data cleanup.  
  _skills/spreadsheet-formula-helper/SKILL.md_
- **`sre-review`** — Reliability, observability, alert quality, blast-radius, toil, resilience, and service hardening reviews. Use when reviewing recurring incidents, alert noise, missing telemetry, reliability risks, error-budget pressure, or resilience improvement opportunities.  
  _skills/sre-review/SKILL.md_
- **`support-report-to-slides`** — Turn support KPI reports from Google Sheets/CSV into Google Slides decks using an OAuth token, optional template copy, Thai operational narrative, and safe dry-run checks. Use for SupportDev catch-up decks, weekly/monthly support summaries, SLA/first-response slides, and Google Sheet to Google Slides automation.  
  _skills/support-report-to-slides/SKILL.md_
- **`support-reporting`** — Daily, weekly, and monthly support reporting for ticket trends, backlog health, SLA risk, recurring issues, executive summaries, and operational recommendations. Use when summarizing support performance, creating management updates, reviewing issue trends, or translating operational data into leadership-ready reporting.  
  _skills/support-reporting/SKILL.md_
- **`support-ticket-triage`** — Triage customer support tickets, emails, chats, or exported cases into category, priority, SLA risk, impact, next actions, internal notes, and customer-ready reply drafts. Use for App Support/L3 queues, Zendesk/Intercom/Salesforce/Jira exports, pasted customer threads, backlog sweeps, and escalation routing.  
  _skills/support-ticket-triage/SKILL.md_

## Automation / Content / Reporting

- **`content-research-writer`** — Research, outline, draft, and refine high-quality content with citations and source grounding. Use for articles, newsletters, YouTube scripts, technical explainers, case studies, content calendars, hooks, titles, and section-by-section editing while preserving Nick/Nova voice.  
  _skills/content-research-writer/SKILL.md_
- **`devops-review`** — Deployment risk, rollback readiness, environment parity, CI/CD issues, configuration safety, and release operations review. Use when evaluating deploy risk, production changes, rollback plans, pipeline failures, config drift, or operational automation opportunities.  
  _skills/devops-review/SKILL.md_
- **`youtube-analysis-pro`** — Analyze YouTube videos, channels, transcripts, metadata, titles, descriptions, tags, thumbnails, comments, and content strategy. Use for YouTube research, relax-channel optimization, competitor analysis, transcript summaries, timestamp extraction, and metadata improvement.  
  _skills/youtube-analysis-pro/SKILL.md_
- **`youtube-content-pipeline`** — Plan, generate, track, analyze, and safely operate YouTube content pipelines. Use for Nova/Nick's relax channel, idea queues, metadata, thumbnails, private uploads, publish approval, performance tracking, deduplication, and n8n/OpenClaw YouTube automation.  
  _skills/youtube-content-pipeline/SKILL.md_

## Knowledge / Obsidian / State

- **`obsidian-bases`** — Create and edit Obsidian Bases (.base) files with YAML views, filters, formulas, summaries, table/card/list/map views, and note-property dashboards. Use for database-like views of Markdown notes in Obsidian, especially SOP/RCA/runbook/task dashboards.  
  _skills/obsidian-bases/SKILL.md_
- **`obsidian-markdown`** — Create and edit Obsidian-flavored Markdown notes with frontmatter properties, wikilinks, embeds, callouts, tags, aliases, highlights, footnotes, Mermaid diagrams, and task lists. Use when writing notes intended to render well inside Obsidian.  
  _skills/obsidian-markdown/SKILL.md_
- **`project-state-management`** — Maintain lightweight project state across OpenClaw/Nova work: goals, decisions, current status, blockers, next actions, artifacts, links, and handoff notes. Use for multi-project tracking, overnight work, subagent coordination, STATE files, memory updates, and replacing ad-hoc Kanban with evidence-backed project context.  
  _skills/project-state-management/SKILL.md_

## Engineering / QA / Tooling

- **`codebase-migrate`** — Plan and execute large codebase migrations, framework upgrades, API renames, config rewrites, and multi-file refactors in safe reviewable batches with git diffs, tests, CI checks, and rollback notes. Use when changing many files or modernizing repos.  
  _skills/codebase-migrate/SKILL.md_

## Productivity / Research / Ops

- **`meeting-insights-analyzer`** — Analyze meeting transcripts or recurring meeting notes for communication patterns, leadership signals, risks, unresolved tension, decision quality, follow-through, speaking balance, and improvement opportunities. Use beyond basic notes when the goal is insight, coaching, or team/process improvement.  
  _skills/meeting-insights-analyzer/SKILL.md_
- **`morning-briefing`** — Create, tune, or run personalized morning/daily briefings for Nick. Use for scheduled briefs that combine priorities, calendar/tasks, workflow/system health, weather/news, overnight work, risks, and recommended next actions. Also use when improving HEARTBEAT.md or briefing prompts.  
  _skills/morning-briefing/SKILL.md_
- **`personal-ops`** — Personal assistant operations for planning, reminders, calendar-aware follow-up, errands, travel prep, life admin, and reducing daily mental load. Use when organizing tasks, planning days, preparing checklists, managing reminders, or helping Nick stay on top of personal and work-life logistics.  
  _skills/personal-ops/SKILL.md_

## Security / Governance

- **`skill-security-vetting`** — Vet, audit, and risk-classify OpenClaw/Agent skills before installation or adaptation. Use for community skill review, prompt-injection checks, tool poisoning, credential leakage, suspicious scripts, network calls, binaries, unsafe permissions, and install/adapt/skip recommendations.  
  _skills/skill-security-vetting/SKILL.md_
