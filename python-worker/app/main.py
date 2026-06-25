"""
Python Worker – Hoved-app
Scheduler + Flask API
Venter på Node.js er klar før den starter
"""

import os, sys, time, threading
from pathlib import Path
from loguru import logger
from flask import Flask, jsonify, request
import schedule
import requests
from dotenv import load_dotenv

load_dotenv()

LOG_DIR = Path("/app/logs")
LOG_DIR.mkdir(parents=True, exist_ok=True)
LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")

logger.remove()
logger.add(sys.stdout, level=LOG_LEVEL,
           format="<green>{time:YYYY-MM-DD HH:mm:ss}</green> | <level>{level}</level> | {message}")
logger.add(LOG_DIR / "python-worker.log", rotation="50 MB", retention="14 days", level=LOG_LEVEL)

sys.path.insert(0, "/app")
from scripts.task_runner import TaskRunner

# ── Vent på Node.js er klar ───────────────────────────────
def vent_paa_node(url, max_forsøg=20, ventetid=5):
    node_url = os.getenv("NODE_API_URL", "http://node-api:3000")
    for i in range(max_forsøg):
        try:
            r = requests.get(f"{node_url}/health", timeout=3)
            if r.status_code == 200:
                logger.info("✅ Node.js er klar")
                return True
        except Exception:
            pass
        logger.info(f"⏳ Venter på Node.js... ({i+1}/{max_forsøg})")
        time.sleep(ventetid)
    logger.warning("⚠️  Node.js svarede ikke – fortsætter alligevel")
    return False

runner = None

# ── Flask API ─────────────────────────────────────────────
api = Flask(__name__)

@api.route("/status", methods=["GET"])
def status():
    return jsonify({"status": "ok", "model": runner.model if runner else "ikke klar"})

@api.route("/run-task", methods=["POST"])
def run_task():
    data = request.get_json(silent=True) or {}
    task_name = data.get("task")
    if not task_name:
        return jsonify({"error": "Mangler 'task' felt"}), 400
    threading.Thread(target=runner.run, args=(task_name,), daemon=True).start()
    return jsonify({"started": task_name})

@api.route("/ask", methods=["POST"])
def ask():
    data = request.get_json(silent=True) or {}
    prompt = data.get("prompt")
    system = data.get("system")
    if not prompt:
        return jsonify({"error": "Mangler 'prompt' felt"}), 400
    try:
        svar = runner.ask_claude(prompt=prompt, system=system, max_tokens=800)
        return jsonify({"response": svar})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

def start_flask():
    logger.info("🌐 Flask API starter på port 5000")
    api.run(host="0.0.0.0", port=5000, debug=False, use_reloader=False)

# ── Hoved ─────────────────────────────────────────────────
def main():
    global runner
    logger.info("🤖 Python Worker starter...")

    # Start Flask straks (Node.js skal kunne nå /status)
    threading.Thread(target=start_flask, daemon=True).start()

    # Vent på Node.js
    node_url = os.getenv("NODE_API_URL", "http://node-api:3000")
    vent_paa_node(node_url)

    # Initialiser Claude
    runner = TaskRunner()

    # Planlagte opgaver
    schedule.every().day.at("08:00").do(runner.run, task_name="status_rapport")
    schedule.every(30).minutes.do(runner.run, task_name="fil_analyse")
    schedule.every().sunday.at("02:00").do(runner.run, task_name="ryd_logs")

    logger.info("✅ Scheduler klar")
    runner.run(task_name="status_rapport")

    while True:
        schedule.run_pending()
        time.sleep(60)

if __name__ == "__main__":
    main()
