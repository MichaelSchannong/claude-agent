"""Opgave: fil_analyse – analyser filer i /app/data/input/"""
from pathlib import Path
from datetime import datetime
from loguru import logger

TYPER = [".txt", ".md", ".csv", ".log"]

def run(runner):
    input_dir  = Path("/app/data/input");  input_dir.mkdir(parents=True, exist_ok=True)
    output_dir = Path("/app/data/output"); output_dir.mkdir(parents=True, exist_ok=True)
    behandlet  = input_dir / "behandlet";  behandlet.mkdir(exist_ok=True)

    filer = [f for f in input_dir.iterdir() if f.is_file() and f.suffix.lower() in TYPER]
    if not filer:
        logger.info("📂 Ingen filer – springer over"); return

    for fil in filer:
        try:
            tekst = fil.read_text(encoding="utf-8", errors="replace")[:3000]
            analyse = runner.ask_claude(
                prompt=f"Analyser:\nFil: {fil.name}\n\n{tekst}\n\nGiv: 1) Opsummering, 2) Vigtigste punkter, 3) Anomalier",
                max_tokens=600
            )
            ts  = datetime.now().strftime('%Y%m%d_%H%M')
            out = output_dir / f"{fil.stem}_analyse_{ts}.txt"
            out.write_text(f"ANALYSE: {fil.name}\n{'='*50}\n\n{analyse}\n", encoding="utf-8")
            logger.info(f"✅ {out.name}")
            fil.rename(behandlet / fil.name)
        except Exception as e:
            logger.error(f"❌ {fil.name}: {e}")
