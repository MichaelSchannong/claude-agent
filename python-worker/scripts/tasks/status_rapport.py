"""Opgave: status_rapport – systeminfo rapport."""
from datetime import datetime
from pathlib import Path
from loguru import logger
import platform, os

def run(runner):
    dato = datetime.now().strftime("%Y-%m-%d %H:%M")
    rapport_dir = Path("/app/data/rapporter")
    rapport_dir.mkdir(parents=True, exist_ok=True)

    indhold = f"""STATUSRAPPORT – {dato}
{'='*50}
System:    {platform.system()} {platform.release()}
Python:    {platform.python_version()}
Processor: {platform.processor() or 'ARM (Raspberry Pi)'}
Hostname:  {platform.node()}
"""
    fil = rapport_dir / f"status_{datetime.now().strftime('%Y-%m-%d')}.txt"
    fil.write_text(indhold, encoding="utf-8")
    logger.info(f"📄 Rapport gemt: {fil}")
