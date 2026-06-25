"""
Python Worker – Flask API
- Kør Python scripts
- Web scraper
- Task scheduler
"""

import os, sys, time, threading, subprocess, traceback
from pathlib import Path
from loguru import logger
from flask import Flask, jsonify, request
from flask_cors import CORS
import schedule
import requests
from bs4 import BeautifulSoup

LOG_DIR = Path("/app/logs")
LOG_DIR.mkdir(parents=True, exist_ok=True)

logger.remove()
logger.add(sys.stdout, level="INFO",
           format="<green>{time:YYYY-MM-DD HH:mm:ss}</green> | <level>{level}</level> | {message}")
logger.add(LOG_DIR / "python-worker.log", rotation="50 MB", retention="14 days")

sys.path.insert(0, "/app")
from scripts.task_runner import TaskRunner
runner = TaskRunner()

api = Flask(__name__)
CORS(api)

# ── Status ────────────────────────────────────────────────
@api.route("/status", methods=["GET"])
def status():
    return jsonify({"status": "ok"})

# ── Kør opgave ────────────────────────────────────────────
@api.route("/run-task", methods=["POST"])
def run_task():
    data = request.get_json(silent=True) or {}
    task_name = data.get("task")
    if not task_name:
        return jsonify({"error": "Mangler 'task'"}), 400
    threading.Thread(target=runner.run, args=(task_name,), daemon=True).start()
    return jsonify({"started": task_name})

# ── Kør Python kode direkte ───────────────────────────────
@api.route("/run-python", methods=["POST"])
def run_python():
    data = request.get_json(silent=True) or {}
    kode = data.get("code", "").strip()
    if not kode:
        return jsonify({"error": "Ingen kode"}), 400
    try:
        script_fil = Path("/tmp/script_run.py")
        script_fil.write_text(kode, encoding="utf-8")
        result = subprocess.run(
            ["python3", str(script_fil)],
            capture_output=True, text=True, timeout=30
        )
        return jsonify({
            "stdout": result.stdout,
            "stderr": result.stderr,
            "returncode": result.returncode
        })
    except subprocess.TimeoutExpired:
        return jsonify({"error": "Timeout – script kørte i over 30 sekunder"}), 408
    except Exception as e:
        return jsonify({"error": str(e), "trace": traceback.format_exc()}), 500

# ── Web scraper ───────────────────────────────────────────
@api.route("/scrape", methods=["POST"])
def scrape():
    data = request.get_json(silent=True) or {}
    url  = data.get("url", "").strip()
    mode = data.get("mode", "tekst")   # tekst | links | tabeller | overskrifter

    if not url:
        return jsonify({"error": "Mangler 'url'"}), 400
    if not url.startswith("http"):
        url = "https://" + url

    try:
        headers = {"User-Agent": "Mozilla/5.0 (compatible; PiAgent/1.0)"}
        r = requests.get(url, headers=headers, timeout=15)
        r.raise_for_status()
        soup = BeautifulSoup(r.text, "lxml")

        # Fjern script/style tags
        for tag in soup(["script", "style", "nav", "footer"]):
            tag.decompose()

        if mode == "tekst":
            tekst = soup.get_text(separator="\n", strip=True)
            linjer = [l for l in tekst.splitlines() if len(l.strip()) > 20]
            return jsonify({"result": "\n".join(linjer[:100]), "count": len(linjer)})

        elif mode == "links":
            links = []
            for a in soup.find_all("a", href=True):
                href = a["href"]
                if href.startswith("http"):
                    links.append({"tekst": a.get_text(strip=True)[:80], "url": href})
            return jsonify({"result": links[:50], "count": len(links)})

        elif mode == "overskrifter":
            overskrifter = []
            for tag in soup.find_all(["h1","h2","h3","h4"]):
                tekst = tag.get_text(strip=True)
                if tekst:
                    overskrifter.append({"niveau": tag.name.upper(), "tekst": tekst})
            return jsonify({"result": overskrifter, "count": len(overskrifter)})

        elif mode == "tabeller":
            tabeller = []
            for tbl in soup.find_all("table")[:5]:
                rows = []
                for tr in tbl.find_all("tr"):
                    row = [td.get_text(strip=True) for td in tr.find_all(["td","th"])]
                    if row: rows.append(row)
                if rows: tabeller.append(rows)
            return jsonify({"result": tabeller, "count": len(tabeller)})

        return jsonify({"error": "Ukendt mode"}), 400

    except requests.exceptions.RequestException as e:
        return jsonify({"error": f"Kunne ikke hente siden: {e}"}), 502
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# ── Hent rapporter ────────────────────────────────────────
@api.route("/rapporter", methods=["GET"])
def rapporter():
    rapport_dir = Path("/app/data/rapporter")
    rapport_dir.mkdir(parents=True, exist_ok=True)
    filer = sorted(rapport_dir.glob("*.txt"), reverse=True)[:10]
    return jsonify([{"navn": f.name, "indhold": f.read_text(encoding="utf-8")} for f in filer])

def vent_paa_node():
    node_url = os.getenv("NODE_API_URL", "http://node-api:3000")
    for i in range(20):
        try:
            if requests.get(f"{node_url}/health", timeout=3).status_code == 200:
                logger.info("✅ Node.js er klar"); return
        except: pass
        logger.info(f"⏳ Venter på Node.js... ({i+1}/20)")
        time.sleep(5)

def start_flask():
    logger.info("🌐 Flask API starter på port 5000")
    api.run(host="0.0.0.0", port=5000, debug=False, use_reloader=False)

def main():
    logger.info("🤖 Pi Agent starter...")
    threading.Thread(target=start_flask, daemon=True).start()
    vent_paa_node()

    schedule.every(30).minutes.do(runner.run, task_name="fil_analyse")
    schedule.every().sunday.at("02:00").do(runner.run, task_name="ryd_logs")
    logger.info("✅ Scheduler klar")

    while True:
        schedule.run_pending()
        time.sleep(60)

if __name__ == "__main__":
    main()
