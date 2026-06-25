"""
Python Worker – Hoved-app
Scheduler + Flask API (ingen AI/Claude)
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

logger.remove()
logger.add(sys.stdout, level="INFO",
           format="<green>{time:YYYY-MM-DD HH:mm:ss}</green> | <level>{level}</level> | {message}")
logger.add(LOG_DIR / "python-worker.log", rotation="50 MB", retention="14 days")

sys.path.insert(0, "/app")
from scripts.task_runner import TaskRunner

runner = TaskRunner()

# ── Flask API ─────────────────────────────────────────────
api = Flask(__name__)

@api.route("/status", methods=["GET"])
def status():
    return jsonify({"status": "ok"})

@api.route("/run-task", methods=["POST"])
def run_task():
    data = request.get_json(silent=True) or {}
    task_name = data.get("task")
    if not task_name:
        return jsonify({"error": "Mangler 'task' felt"}), 400
    threading.Thread(target=runner.run, args=(task_name,), daemon=True).start()
    return jsonify({"started": task_name})

def start_flask():
    logger.info("🌐 Flask API starter på port 5000")
    api.run(host="0.0.0.0", port=5000, debug=False, use_reloader=False)

def vent_paa_node():
    node_url = os.getenv("NODE_API_URL", "http://node-api:3000")
    for i in range(20):
        try:
            r = requests.get(f"{node_url}/health", timeout=3)
            if r.status_code == 200:
                logger.info("✅ Node.js er klar")
                return
        except Exception:
            pass
        logger.info(f"⏳ Venter på Node.js... ({i+1}/20)")
        time.sleep(5)
    logger.warning("⚠️  Node.js svarede ikke – fortsætter alligevel")

def main():
    logger.info("🤖 Pi Agent starter...")
    threading.Thread(target=start_flask, daemon=True).start()
    vent_paa_node()

    # Planlagte opgaver
    schedule.every(30).minutes.do(runner.run, task_name="fil_analyse")
    schedule.every().sunday.at("02:00").do(runner.run, task_name="ryd_logs")

    logger.info("✅ Scheduler klar")

    while True:
        schedule.run_pending()
        time.sleep(60)

if __name__ == "__main__":
    main()
