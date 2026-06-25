"""Opgave: fil_analyse – tæl og log filer i /app/data/input/"""
from pathlib import Path
from loguru import logger

def run(runner):
    input_dir = Path("/app/data/input")
    input_dir.mkdir(parents=True, exist_ok=True)
    filer = list(input_dir.iterdir())
    logger.info(f"📂 {len(filer)} fil(er) i input-mappen")
