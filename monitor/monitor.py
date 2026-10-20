#!/usr/bin/env python3
"""SafePrint monitor — avisos no grupo do WhatsApp via Evolution API.

Cron (a cada hora):
  0 * * * * cd /home/fael/Área\ de\ trabalho/safeprint/monitor && python3 monitor.py

Relatório diário: REPORT_HOUR (padrão 20h), dentro do mesmo cron.
Configurações: monitor/config.env (exemplo em config.env.example).
"""
import json
import os
import subprocess
import urllib.request
from datetime import datetime
from pathlib import Path

BASE = Path(__file__).resolve().parent.parent
DATA = BASE / "web" / "data"
STATE_FILE = Path(__file__).resolve().parent / "state.json"
CONFIG_FILE = Path(__file__).resolve().parent / "config.env"


def load_config() -> dict:
    cfg = {
        "EVOLUTION_URL": "http://localhost:8080",
        "EVOLUTION_API_KEY": "",
        "INSTANCE": "safeprint",
        "GROUP_ID": "",  # ex: 5516999999999-123456@g.us
        "REPORT_HOUR": "20",
        "SPEED_EVERY_HOURS": "6",
        "PING_TARGET": "8.8.8.8",
    }
    if CONFIG_FILE.exists():
        for line in CONFIG_FILE.read_text().splitlines():
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                cfg[k.strip()] = v.strip()
    # env var vence (útil no cron/docker)
    for k in cfg:
        if os.getenv(k):
            cfg[k] = os.environ[k]
    return cfg


def load_state() -> dict:
    if STATE_FILE.exists():
        return json.loads(STATE_FILE.read_text())
    return {"failed_seen": [], "paper_alerted": {}, "offline_since": None, "last_daily": ""}


def save_state(s: dict) -> None:
    STATE_FILE.write_text(json.dumps(s, indent=2, ensure_ascii=False))


def read_json(name: str, default):
    f = DATA / name
    try:
        return json.loads(f.read_text())
    except Exception:
        return default


def ping(target: str) -> tuple[float, float]:
    """→ (perda %, latência média ms)"""
    try:
        out = subprocess.run(
            ["ping", "-c", "5", "-W", "2", target], capture_output=True, text=True, timeout=20
        ).stdout
        loss = 100.0
        avg = 0.0
        for line in out.splitlines():
            if "packet loss" in line:
                loss = float(line.split("%")[0].split()[-1].replace(",", "."))
            if "rtt" in line or "round-trip" in line:
                avg = float(line.split("=")[1].split("/")[1])
        return loss, avg
    except Exception:
        return 100.0, 0.0


def speed_down_mbps() -> float | None:
    try:
        t0 = __import__("time").monotonic()
        subprocess.run(
            ["curl", "-s", "-o", "/dev/null", "--max-time", "20",
             "https://speed.cloudflare.com/__down?bytes=10000000"],
            check=True, timeout=25,
        )
        dt = __import__("time").monotonic() - t0
        return round((10_000_000 * 8) / dt / 1_000_000, 1)
    except Exception:
        return None


def send_whatsapp(cfg: dict, text: str) -> bool:
    if not cfg["GROUP_ID"] or not cfg["EVOLUTION_API_KEY"]:
        print("[LOG SEM GRUPO]\n" + text)
        return True
    url = f"{cfg['EVOLUTION_URL']}/message/sendText/{cfg['INSTANCE']}"
    body = json.dumps({"number": cfg["GROUP_ID"], "text": text}).encode()
    req = urllib.request.Request(url, data=body, method="POST", headers={
        "Content-Type": "application/json",
        "apikey": cfg["EVOLUTION_API_KEY"],
    })
    try:
        with urllib.request.urlopen(req, timeout=15) as r:
            return r.status in (200, 201)
    except Exception as e:
        print("erro ao enviar:", e)
        return False


def printer_lines() -> list[str]:
    printers = read_json("printers.json", [])
    paper = read_json("paper.json", {})
    meta = read_json("printers-meta.json", {})
    lines = []
    for p in printers:
        cur = paper.get(p["id"], p.get("paperCurrent", 0))
        alert_at = (meta.get(p["id"]) or {}).get("paperAlertAt", p.get("paperAlertAt", 50))
        icon = "⚠️" if cur <= alert_at else "✅"
        lines.append(f"{icon} {p['name']}: {cur}/{p.get('paperCapacity', '?')} folhas (alerta ≤{alert_at})")
    return lines


def jobs_today() -> dict:
    jobs = read_json("jobs.json", [])
    today = datetime.now().strftime("%Y-%m-%d")
    paid = [j for j in jobs if j.get("createdAt", "")[:10] == today and j.get("status") in ("queued", "printing", "done")]
    failed = [j for j in jobs if j.get("status") == "failed"]
    revenue = sum(j.get("totalCents", 0) for j in paid)
    sheets = sum(j.get("sheets", 0) for j in paid)
    pages = sum(len(j.get("pages", [])) * j.get("copies", 1) for j in paid)
    return {"paid": len(paid), "revenue": revenue, "sheets": sheets, "pages": pages, "failed": failed}


def brl(cents: int) -> str:
    return f"R$ {cents/100:.2f}".replace(".", ",")


def main() -> None:
    cfg = load_config()
    state = load_state()
    now = datetime.now()
    loss, avg = ping(cfg["PING_TARGET"])
    do_speed = now.hour % max(1, int(cfg["SPEED_EVERY_HOURS"])) == 0
    mbps = speed_down_mbps() if do_speed else None

    online = loss < 100.0

    # voltou do offline?
    back = ""
    if online and state.get("offline_since"):
        back = f"📶 De volta! Sem conexão desde {state['offline_since']}\n"
    if online:
        state["offline_since"] = None
    elif not state.get("offline_since"):
        state["offline_since"] = now.strftime("%H:%M")

    # alerta de papel (1x por dia por impressora)
    alerts = []
    printers = read_json("printers.json", [])
    paper = read_json("paper.json", {})
    meta = read_json("printers-meta.json", {})
    today = now.strftime("%Y-%m-%d")
    for p in printers:
        cur = paper.get(p["id"], p.get("paperCurrent", 0))
        alert_at = (meta.get(p["id"]) or {}).get("paperAlertAt", p.get("paperAlertAt", 50))
        key = f"{p['id']}:{today}"
        if cur <= alert_at and state["paper_alerted"].get(p["id"]) != today:
            alerts.append(f"🧻 ALERTA: {p['name']} com {cur} folhas — recarregue!")
            state["paper_alerted"][p["id"]] = today
        elif cur > alert_at:
            state["paper_alerted"].pop(p["id"], None)

    # falhas novas
    j = jobs_today()
    new_failed = [f for f in j["failed"] if f.get("id") not in state["failed_seen"]]
    for f in new_failed:
        alerts.append(f"❌ Falha ao imprimir: {f.get('fileName', '?')} ({f.get('sheets', '?')} folhas)")
    state["failed_seen"] = (state["failed_seen"] + [f.get("id") for f in new_failed])[-200:]

    # relatório diário
    daily = ""
    if now.hour == int(cfg["REPORT_HOUR"]) and state.get("last_daily") != today:
        daily = (
            f"📊 Relatório SafePrint — {now.strftime('%d/%m')}\n"
            f"Impressões pagas: {j['paid']} • {j['sheets']} folhas • {j['pages']} páginas\n"
            f"Faturamento: {brl(j['revenue'])} • Falhas hoje: {len([f for f in j['failed'] if f.get('createdAt','')[:10]==today])}\n"
        )
        state["last_daily"] = today

    net = f"Ping: {loss:.0f}% perda • {avg:.0f}ms"
    if mbps is not None:
        net += f" • 📥 {mbps} Mbps"

    msg = (
        f"{back}"
        f"📶 SafePrint — {now.strftime('%H:%M')}\n"
        f"{net}\n"
        + "\n".join(printer_lines()) + "\n"
        f"Jobs hoje: {j['paid']} pagos • {brl(j['revenue'])}\n"
        + "\n".join(alerts)
    )
    if daily:
        msg += "\n\n" + daily

    ok = send_whatsapp(cfg, msg)
    if ok and state.get("offline_since") and online:
        state["offline_since"] = None
    save_state(state)
    print("OK enviado" if ok else "FALHA envio")


if __name__ == "__main__":
    main()
