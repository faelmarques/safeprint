#!/usr/bin/env python3
"""
SafePrint Pi Agent — roda no Raspberry Pi dentro da caixa.
Polling a cada 5s: busca jobs 'queued', imprime via CUPS, confirma.

Uso:
  pip install -r requirements.txt
  PRINTER_SLUG=unifacef-bloco-a-x7k2 API_BASE=https://seu-site.com python agent.py

Escala nacional: 1 Pi por impressora, cada um com seu PRINTER_SLUG.
"""
import os, time, subprocess, tempfile, base64, requests

API_BASE = os.getenv("API_BASE", "http://localhost:3000")
SLUG = os.getenv("PRINTER_SLUG", "unifacef-bloco-a-x7k2")
CUPS_PRINTER = os.getenv("CUPS_PRINTER", "Brother")
PI_KEY = os.getenv("PI_API_KEY", "")
POLL = int(os.getenv("POLL_SECONDS", "5"))
ALLOWED_PPS = {1, 2, 4, 6, 9, 16}

def _headers():
    return {"x-pi-key": PI_KEY} if PI_KEY else {}

def poll():
    r = requests.get(f"{API_BASE}/api/pi/next", params={"printerSlug": SLUG}, headers=_headers(), timeout=15)
    r.raise_for_status()
    return r.json()

def confirm(job_id: str, ok: bool):
    r = requests.post(f"{API_BASE}/api/pi/next", json={"jobId": job_id, "ok": ok}, headers=_headers(), timeout=15)
    try:
        d = r.json()
        job = d.get("job", {}) if isinstance(d, dict) else {}
        print("confirm:", job.get("id"), job.get("status"), "refunded=" + str(d.get("refunded")) if isinstance(d, dict) and "refunded" in d else "")
    except Exception:
        print("confirm ok, resposta ilegível")

def print_file(job):
    job_id = job.get("id", "?")
    try:
        data_url = job.get("fileDataUrl")
        suffix = ".pdf" if job.get("fileType") == "pdf" else ".jpg"
        if not (data_url and "," in data_url):
            print(f"job {job_id} sem bytes, marcando como falha")
            return False
        try:
            raw = base64.b64decode(data_url.split(",", 1)[1])
        except Exception:
            print(f"job {job_id} base64 inválido, marcando como falha")
            return False
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as f:
            f.write(raw)
            path = f.name
        try:
            try:
                copies = int(job.get("copies", 1))
            except Exception:
                copies = 1
            copies = max(1, min(20, copies))
            opts = ["sides=one-sided"]
            if job.get("landscape") is True:
                opts.append("landscape")
            try:
                pps = int(job.get("pagesPerSheet") or 1)
            except Exception:
                pps = 1
            if pps not in ALLOWED_PPS:
                pps = 1
            cmd = ["lp", "-d", CUPS_PRINTER, "-n", str(copies)]
            for o in opts:
                cmd += ["-o", o]
            if pps > 1:
                cmd += ["-o", f"number-up={pps}"]
            # intervalo de páginas do pedido (ex: [1,2,3,5] -> -P 1-3,5). Erro aqui = falha fechada.
            pages = job.get("pages") or []
            if job.get("fileType") == "pdf" and pages:
                s = sorted(set(int(p) for p in pages))
                if not s:
                    print(f"job {job_id} sem páginas válidas, marcando como falha")
                    return False
                ranges = []
                a = prev = s[0]
                for p in s[1:]:
                    if p == prev + 1:
                        prev = p
                        continue
                    ranges.append(str(a) if a == prev else f"{a}-{prev}")
                    a = prev = p
                ranges.append(str(a) if a == prev else f"{a}-{prev}")
                cmd += ["-P", ",".join(ranges)]
            print("exec: lp", f"-n {copies}", f"-P {','.join(ranges)}" if job.get("fileType") == "pdf" and pages else "", f"-> {CUPS_PRINTER}")
            subprocess.run(cmd + [path], check=True, timeout=120)
            return True
        finally:
            try:
                os.unlink(path)
            except Exception:
                pass
    except Exception as e:
        print(f"job {job_id} erro interno, marcando como falha:", e)
        return False

def main():
    print(f"SafePrint agent slug={SLUG} api={API_BASE} cups={CUPS_PRINTER}")
    while True:
        try:
            data = poll()
            for job in data.get("jobs", []):
                print(f"imprimindo {job.get('id')} {job.get('fileName')} pgs={job.get('pages')} copias={job.get('copies')}")
                ok = print_file(job)
                try:
                    confirm(job.get("id"), ok)
                except Exception as e:
                    print("confirm falhou (job continua queued, reimprime no próximo poll):", e)
        except Exception as e:
            print("loop erro:", e)
        time.sleep(POLL)

if __name__ == "__main__":
    main()
