"""
============================================================
Python Worker – Hoved-app
  • Kører Claude-opgaver via scheduler
  • Eksponerer /run-task og /status via Flask
    så Node.js kan trigge opgaver via HTTP
============================================================
"""

import os, sys, time, threading
from pathlib import Path
from loguru import logger
from flask import Flask, jsonify, request
import schedule
from dotenv import load_dotenv

load_dotenv()

# ── Logging ───────────────────────────────────────────────
LOG_DIR = Path("/app/logs")
LOG_DIR.mkdir(parents=True, exist_ok=True)
LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")

logger.remove()
logger.add(sys.stdout, level=LOG_LEVEL,
           format="<green>{time:YYYY-MM-DD HH:mm:ss}</green> | <level>{level}</level> | {message}")
logger.add(LOG_DIR / "python-worker.log", rotation="50 MB", retention="14 days", level=LOG_LEVEL)

# ── Importer TaskRunner ────────────────────────────────────
sys.path.insert(0, "/app")
from scripts.task_runner import TaskRunner

runner = TaskRunner()

# ── Flask API (lytter på :5000) ───────────────────────────
api = Flask(__name__)

@api.route("/status", methods=["GET"])
def status():
    """Node.js tjekker om worker kører."""
    return jsonify({"status": "ok", "model": runner.model})

@api.route("/run-task", methods=["POST"])
def run_task():
    """Node.js kan trigge en opgave via POST /run-task {"task": "status_rapport"}"""
    data = request.get_json(silent=True) or {}
    task_name = data.get("task")
    if not task_name:
        return jsonify({"error": "Mangler 'task' felt"}), 400

    # Kør i baggrundstråd så HTTP-svaret ikke blokerer
    threading.Thread(target=runner.run, args=(task_name,), daemon=True).start()
    logger.info(f"📨 Opgave '{task_name}' trigget fra Node.js")
    return jsonify({"started": task_name})

@api.route("/ask", methods=["POST"])
def ask():
    """Node.js kan sende et spørgsmål direkte til Claude."""
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

# ── Scheduler ─────────────────────────────────────────────
def main():
    logger.info("🤖 Python Worker starter...")

    # Start Flask i baggrundstråd
    threading.Thread(target=start_flask, daemon=True).start()

    # Planlagte opgaver
    schedule.every().day.at("08:00").do(runner.run, task_name="status_rapport")
    schedule.every(30).minutes.do(runner.run, task_name="fil_analyse")
    schedule.every().sunday.at("02:00").do(runner.run, task_name="ryd_logs")

    logger.info("✅ Scheduler klar")
    runner.run(task_name="status_rapport")  # Kør ved opstart

    while True:
        schedule.run_pending()
        time.sleep(60)

if __name__ == "__main__":
    main()
