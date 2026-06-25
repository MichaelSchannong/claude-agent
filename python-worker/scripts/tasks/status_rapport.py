"""Opgave: status_rapport – daglig AI-rapport."""
from datetime import datetime
from pathlib import Path
from loguru import logger

def run(runner):
    dato = datetime.now().strftime("%Y-%m-%d %H:%M")
    svar = runner.ask_claude(
        prompt=f"Dato: {dato}\nGenerer en kort daglig statusrapport på dansk for en Raspberry Pi Claude-agent. Inkluder: 1) Hvad agenten kan, 2) 3 automatiseringsforslag, 3) Påminding om logs og disk. Max 200 ord.",
        system="Du er en præcis dansk assistent der laver statusrapporter.",
        max_tokens=500
    )
    rapport_dir = Path("/app/data/rapporter")
    rapport_dir.mkdir(parents=True, exist_ok=True)
    fil = rapport_dir / f"status_{datetime.now().strftime('%Y-%m-%d')}.txt"
    fil.write_text(f"STATUSRAPPORT – {dato}\n{'='*50}\n\n{svar}\n", encoding="utf-8")
    logger.info(f"📄 Rapport gemt: {fil}")
