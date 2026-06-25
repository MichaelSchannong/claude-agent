"""Opgave: ryd_logs – slet gamle logfiler."""
from pathlib import Path
from datetime import datetime, timedelta
from loguru import logger

def run(runner):
    log_dir = Path("/app/logs")
    grænse  = datetime.now() - timedelta(days=14)
    slettet = 0
    for fil in log_dir.rglob("*.log*"):
        if fil.is_file() and datetime.fromtimestamp(fil.stat().st_mtime) < grænse:
            fil.unlink(); slettet += 1
    logger.info(f"🧹 Slettede {slettet} gamle logfil(er)")
