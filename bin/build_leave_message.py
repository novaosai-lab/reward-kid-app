#!/usr/bin/env python3
"""
build_leave_message.py — pure data transform for team-leave-google-chat cron
Reads Members + Leave Requests (already fetched via gog) and emits the chat message.
No google-api-python-client dependency — uses gogcli (with encrypted-file keyring).
"""
from __future__ import annotations

import json
import sys
from datetime import date, datetime


def parse_iso(s: str) -> date:
    return datetime.strptime(s[:10], "%Y-%m-%d").date()


def to_records(vals: list) -> list[dict[str, str]]:
    if not vals:
        return []
    headers = [str(v).strip() for v in vals[0]]
    records = []
    for row in vals[1:]:
        padded = list(row) + [""] * (len(headers) - len(row))
        records.append({headers[i]: str(padded[i]).strip() for i in range(len(headers))})
    return records


def main() -> int:
    target_str = sys.argv[1]
    members_path = sys.argv[2]
    requests_path = sys.argv[3]

    target = parse_iso(target_str)
    with open(members_path) as f:
        members_data = json.load(f)
    with open(requests_path) as f:
        requests_data = json.load(f)

    members = {m["ID"]: m for m in to_records(members_data.get("values", [])) if m.get("ID")}
    requests = to_records(requests_data.get("values", []))

    active = []
    for item in requests:
        if not item.get("Request ID") or not item.get("Member ID"):
            continue
        if not item.get("Start Date") or not item.get("End Date"):
            continue
        try:
            start = parse_iso(item["Start Date"])
            end = parse_iso(item["End Date"])
        except ValueError:
            continue
        if start <= target <= end:
            m = members.get(item["Member ID"], {})
            active.append({
                "name": m.get("Name", item["Member ID"]),
                "department": m.get("Department", "-"),
                "role": m.get("Role", "-"),
                "start": item["Start Date"],
                "end": item["End Date"],
                "duration": item.get("Duration Days", "-"),
                "reason": item.get("Reason", "-"),
            })

    active.sort(key=lambda r: (r["department"], r["name"]))

    label = target.strftime("%Y-%m-%d")
    if not active:
        print(f"Team Leave Summary - {label}\nNo approved leave scheduled today.")
        return 0

    lines = [
        f"Team Leave Summary - {label}",
        f"People on leave today: {len(active)}",
        "",
    ]
    for row in active:
        lines.append(
            f"- {row['name']} ({row['department']}) | {row['start']} to {row['end']} | {row['duration']} day(s) | {row['reason']}"
        )
    print("\n".join(lines))
    return 0


if __name__ == "__main__":
    sys.exit(main())
