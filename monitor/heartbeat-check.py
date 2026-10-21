#!/usr/bin/env python3
"""SafePrint heartbeat-check — detecta offline/online do notebook-vigia (armário).

O notebook manda heartbeat via POST /api/relay a cada ~30s.
Este script (cron a cada minuto na VPS) avisa o grupo quando para/recomeça.

Cron:
  * * * * * cd /root/safeprint/monitor && python3 heartbeat-check.py

Estado: data/net-heartbeat.json (escrito pelo relay) + state-hb.json (offline_since).
"""
import json
import sys
from datetime import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from monitor import load_config, send_whatsapp  # noqa: E402

BASE = Path(__file__).resolve().parent.parent
HB_FILE = BASE / "web" / "data" / "net-heartbeat.json"
STATE_FILE = Path(__file__).resolve().parent / "state-hb.json"

OFFLINE_AFTER_S = 300  # 5 min sem heartbeat = caiu


def load(p, default):
    try:
        return json.loads(p.read_text())
    except Exception:
        return default


def main():
    hb = load(HB_FILE, None)
    if not hb or not hb.get("ts"):
        return  # nunca recebeu heartbeat (notebook ainda não instalado)
    state = load(STATE_FILE, {"offline_since": None})
    now = datetime.now()
    age = (datetime.now().timestamp() - hb["ts"] / 1000)
    offline_since = state.get("offline_since")
    m = hb.get("metrics") or {}
    mtxt = ""
    if m:
        mtxt = f"\nPing: {m.get('loss_pct', '?')}% perda | {m.get('avg_ms', '?')}ms | ↓{m.get('down_mbps', '?')} ↑{m.get('up_mbps', '?')} Mbps"

    if age > OFFLINE_AFTER_S and not offline_since:
        offline_since = now.strftime("%H:%M")
        state["offline_since"] = offline_since
        STATE_FILE.write_text(json.dumps(state))
        send_whatsapp(load_config(),
                      f"🚨 Notebook do armário OFFLINE\nSem {int(age / 60)} min de conexão (desde {offline_since})." + mtxt)
    elif age <= OFFLINE_AFTER_S and offline_since:
        state["offline_since"] = None
        STATE_FILE.write_text(json.dumps(state))
        send_whatsapp(load_config(),
                      f"📶 Notebook do armário de volta!\nSem conexão de {offline_since} até {now.strftime('%H:%M')}." + mtxt)
    print(f"hb age={int(age)}s offline={offline_since}")


if __name__ == "__main__":
    main()
