#!/usr/bin/env python3
"""Mantem duas series por site pras barras de uptime do status page:
- history/<slug>-recent.json: 1 ponto por check (5 min), ultimos 2 dias
- history/<slug>-hourly.json: 1 bucket por hora (up/down = qtd de checks), ultimos 4 dias
Rodado pelo uptime.yml logo apos o comando "update" do Upptime, lendo o
status que ele acabou de gravar em history/<slug>.yml."""
import json
import os
from datetime import datetime, timedelta, timezone

SITES = ["sistema-site", "api", "banco-de-dados"]
NOW = datetime.now(timezone.utc)


def load(path, default):
    if os.path.exists(path):
        with open(path) as f:
            return json.load(f)
    return default


def save(path, data):
    with open(path, "w") as f:
        json.dump(data, f)


def main():
    for slug in SITES:
        ypath = f"history/{slug}.yml"
        if not os.path.exists(ypath):
            continue
        status = None
        with open(ypath) as f:
            for line in f:
                if line.startswith("status:"):
                    status = line.split(":", 1)[1].strip()
                    break
        if status is None:
            continue
        up = status == "up"

        rpath = f"history/{slug}-recent.json"
        recent = load(rpath, [])
        recent.append({"t": NOW.isoformat(), "up": up})
        cutoff = NOW - timedelta(days=2)
        recent = [p for p in recent if datetime.fromisoformat(p["t"]) > cutoff]
        save(rpath, recent)

        hpath = f"history/{slug}-hourly.json"
        hourly = load(hpath, [])
        bucket = NOW.replace(minute=0, second=0, microsecond=0).isoformat()
        if hourly and hourly[-1]["h"] == bucket:
            hourly[-1]["up" if up else "down"] += 1
        else:
            hourly.append({"h": bucket, "up": 1 if up else 0, "down": 0 if up else 1})
        cutoff_h = NOW - timedelta(days=4)
        hourly = [b for b in hourly if datetime.fromisoformat(b["h"]) > cutoff_h]
        save(hpath, hourly)


if __name__ == "__main__":
    main()
