"""TaskRunner – motor der kører scripts og taler med Claude."""

import os, importlib.util
from pathlib import Path
from loguru import logger
import anthropic

class TaskRunner:
    def __init__(self):
        self.api_key = os.getenv("ANTHROPIC_API_KEY")
        self.model   = os.getenv("CLAUDE_MODEL", "claude-sonnet-4-6")
        self.tasks_dir = Path("/app/scripts/tasks")
        self.data_dir  = Path("/app/data")
        self.tasks_dir.mkdir(parents=True, exist_ok=True)
        self.data_dir.mkdir(parents=True, exist_ok=True)

        if not self.api_key:
            raise ValueError("ANTHROPIC_API_KEY ikke sat")

        self.client = anthropic.Anthropic(api_key=self.api_key)
        logger.info(f"✅ Claude klient klar (model: {self.model})")

    def ask_claude(self, prompt: str, system: str = None, max_tokens: int = 1000) -> str:
        kwargs = {"model": self.model, "max_tokens": max_tokens,
                  "messages": [{"role": "user", "content": prompt}]}
        if system:
            kwargs["system"] = system
        response = self.client.messages.create(**kwargs)
        return response.content[0].text

    def run(self, task_name: str):
        task_file = self.tasks_dir / f"{task_name}.py"
        if not task_file.exists():
            logger.warning(f"⚠️  Opgave '{task_name}' ikke fundet")
            return
        logger.info(f"▶️  Starter: {task_name}")
        try:
            spec   = importlib.util.spec_from_file_location(task_name, task_file)
            module = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(module)
            if hasattr(module, "run"):
                module.run(runner=self)
                logger.info(f"✅ Færdig: {task_name}")
            else:
                logger.error(f"❌ {task_name}.py mangler run(runner)")
        except Exception as e:
            logger.error(f"❌ Fejl i {task_name}: {e}")
