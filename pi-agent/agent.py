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
POLL = int(os.getenv("POLL_SECONDS", "5"))

def poll():
    r = requests.get(f"{API_BASE}/api/pi/next", params={"printerSlug": SLUG}, timeout=15)
    r.raise_for_status()
    return r.json()

def confirm(job_id: str, ok: bool):
    r = requests.post(f"{API_BASE}/api/pi/next", json={"jobId": job_id, "ok": ok}, timeout=15)
    print("confirm:", r.json())

def print_file(job):
    # MVP: se veio fileDataUrl (imagem), salva e imprime. PDF vai como bytes.
    data_url = job.get("fileDataUrl")
    suffix = ".pdf" if job.get("fileType") == "pdf" else ".jpg"
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as f:
        if data_url and "," in data_url:
            f.write(base64.b64decode(data_url.split(",", 1)[1]))
        else:
            # sem bytes (produção usa URL S3) — nada a imprimir
            print(f"job {job['id']} sem bytes, marcando como falha")
            return False
        path = f.name
    copies = job.get("copies", 1)
    # Somente frente: 1 página por folha (impressora sem duplex)
    opts = ["sides=one-sided"]
    if job.get("landscape"):
        opts.append("landscape")
    pps = job.get("pagesPerSheet") or 1
    if pps and int(pps) > 1:
        opts.append(f"number-up-pages={int(pps)}")
    cmd = ["lp", "-d", CUPS_PRINTER, "-n", str(copies), "-o", " ".join(opts), path]
    print("exec:", " ".join(cmd))
    try:
        subprocess.run(cmd, check=True, timeout=60)
        return True
    except Exception as e:
        print("erro lp:", e)
        return False

def main():
    print(f"SafePrint agent slug={SLUG} api={API_BASE} cups={CUPS_PRINTER}")
    while True:
        try:
            data = poll()
            for job in data.get("jobs", []):
                print(f"imprimindo {job['id']} {job['fileName']} pgs={job['pages']} copias={job['copies']}")
                ok = print_file(job)
                confirm(job["id"], ok)
        except Exception as e:
            print("loop erro:", e)
        time.sleep(POLL)

if __name__ == "__main__":
    main()
