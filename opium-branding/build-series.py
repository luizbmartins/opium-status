#!/usr/bin/env python3
"""Mantem tres series por site pras barras de uptime do status page:
- history/<slug>-recent.json: 1 ponto por check (5 min), ultimos 2 dias
- history/<slug>-hourly.json: 1 bucket por hora (up/down = qtd de checks), ultimos 4 dias
- history/<slug>-daily.json: 1 bucket por dia (up/down = qtd de checks), ultimos 35 dias
Rodado pelo uptime.yml logo apos o comando "update" do Upptime, lendo o
status que ele acabou de gravar em history/<slug>.yml.

O -daily.json existe porque o summary.json do proprio Upptime (dailyMinutesDown)
so grava uma entrada em dias com incidente de verdade -- um dia 100% no ar fica
sem entrada nenhuma, o que faria a barra de 30 dias parecer "sem dado" mesmo em
dias saudaveis. Aqui contamos todo check (up ou down), entao um dia so fica
"sem dado" se realmente nao foi monitorado (ex: antes do site existir)."""
import json
import os
from datetime import datetime, timedelta, timezone

SITES = ["plataforma", "api", "banco-de-dados"]
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

        dpath = f"history/{slug}-daily.json"
        daily = load(dpath, [])
        day_key = NOW.strftime("%Y-%m-%d")
        if daily and daily[-1]["d"] == day_key:
            daily[-1]["up" if up else "down"] += 1
        else:
            daily.append({"d": day_key, "up": 1 if up else 0, "down": 0 if up else 1})
        cutoff_d = NOW - timedelta(days=35)
        daily = [b for b in daily if datetime.strptime(b["d"], "%Y-%m-%d").replace(tzinfo=timezone.utc) > cutoff_d]
        save(dpath, daily)


if __name__ == "__main__":
    main()
