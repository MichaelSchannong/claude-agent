"""Opgave: ryd_logs – slet gamle logfiler."""
from pathlib import Path
from datetime import datetime, timedelta
from loguru import logger

def run(runner):
    log_dir = Path("/app/logs"); log_dir.mkdir(parents=True, exist_ok=True)
    grænse  = datetime.now() - timedelta(days=14)
    slettet = 0; total = 0

    for fil in log_dir.rglob("*.log*"):
        if not fil.is_file(): continue
        total += fil.stat().st_size
        if datetime.fromtimestamp(fil.stat().st_mtime) < grænse:
            fil.unlink(); slettet += 1

    mb = total / (1024*1024)
    logger.info(f"🧹 Slettede {slettet} fil(er). Total: {mb:.1f} MB")
    if mb > 100:
        svar = runner.ask_claude(f"Log-mappen fylder {mb:.1f} MB. Giv 3 råd til at reducere størrelsen.", max_tokens=200)
        logger.info(f"Claude: {svar}")
