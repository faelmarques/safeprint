#!/usr/bin/env python3
"""SafePrint netwatch — roda NO NOTEBOOK DO ARMÁRIO (vigia da rede da Facef).

A cada 30s: mede ping + perda, manda heartbeat pra VPS.
A cada 1h: testa velocidade (download/upload) e manda relatório pro grupo WhatsApp.
Quando cai/volta: a VPS detecta pelo heartbeat parado (heartbeat-check.py) e avisa o grupo.

Uso:
  RELAY_URL=https://safeprint.enviofacil.pro/api/relay \
  RELAY_SECRET=xxx python3 netwatch.py

Systemd (opcional): safeprint-netwatch.service ao lado deste arquivo.
"""
import json
import os
import subprocess
import time
import urllib.request
from datetime import datetime
from pathlib import Path

RELAY_URL = os.getenv("RELAY_URL", "https://safeprint.enviofacil.pro/api/relay")
RELAY_SECRET = os.getenv("RELAY_SECRET", "")
HB_SECONDS = int(os.getenv("HB_SECONDS", "30"))
REPORT_EVERY_S = int(os.getenv("REPORT_EVERY_S", "3600"))
PING_TARGET = os.getenv("PING_TARGET", "8.8.8.8")
CONFIG_FILE = Path(__file__).resolve().parent / "netwatch.env"

if not RELAY_SECRET and CONFIG_FILE.exists():
    for line in CONFIG_FILE.read_text().splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, v = line.split("=", 1)
            if k.strip() == "RELAY_SECRET":
                RELAY_SECRET = v.strip()


def ping(target=PING_TARGET, count=4):
    """→ (perda %, latência média ms)"""
    try:
        out = subprocess.run(
            ["ping", "-c", str(count), "-W", "2", target],
            capture_output=True, text=True, timeout=20,
        ).stdout
        loss, avg = 100.0, 0.0
        for line in out.splitlines():
            if "packet loss" in line:
                loss = float(line.split("%")[0].split()[-1].replace(",", "."))
            if "rtt" in line or "round-trip" in line:
                avg = float(line.split("=")[1].split("/")[1])
        return loss, avg
    except Exception:
        return 100.0, 0.0


def speed(direction: str, seconds_limit: float = 25.0):
    """→ Mbps (ou None). direction: down|up — Cloudflare speed test."""
    url = ("https://speed.cloudflare.com/__down?bytes=10000000" if direction == "down"
           else "https://speed.cloudflare.com/__up")
    try:
        t0 = time.monotonic()
        if direction == "down":
            req = urllib.request.Request(url)
            with urllib.request.urlopen(req, timeout=seconds_limit) as r:
                data = r.read()
            nbytes = len(data)
        else:
            req = urllib.request.Request(url, data=b"0" * 2_000_000, method="POST")
            req.add_header("Content-Type", "application/octet-stream")
            with urllib.request.urlopen(req, timeout=seconds_limit) as r:
                r.read()
            nbytes = 2_000_000
        dt = time.monotonic() - t0
        return round((nbytes * 8) / dt / 1_000_000, 1)
    except Exception:
        return None


def relay(payload: dict) -> bool:
    body = json.dumps({**payload, "secret": RELAY_SECRET}).encode()
    req = urllib.request.Request(
        RELAY_URL, data=body, method="POST",
        headers={"Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as r:
            return r.status == 200
    except Exception as e:
        print("relay falhou:", e)
        return False


def main():
    print(f"netwatch → {RELAY_URL} (hb a cada {HB_SECONDS}s)")
    last_report = 0.0
    while True:
        loss, avg = ping()
        metrics = {"loss_pct": loss, "avg_ms": avg}
        relay({"action": "hb", "metrics": metrics})

        if time.monotonic() - last_report >= REPORT_EVERY_S:
            last_report = time.monotonic()
            down, up = speed("down"), speed("up")
            metrics.update({"down_mbps": down, "up_mbps": up})
            relay({"action": "hb", "metrics": metrics})
            now = datetime.now().strftime("%H:%M")
            relay({
                "action": "text",
                "text": (
                    f"📶 Relatório da rede do armário — {now}\n"
                    f"Ping: {loss}% perda | {avg}ms\n"
                    f"↓ Download: {down or '?'} Mbps\n"
                    f"↑ Upload: {up or '?'} Mbps"
                ),
            })
        time.sleep(HB_SECONDS)


if __name__ == "__main__":
    main()
