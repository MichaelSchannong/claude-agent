"""TaskRunner – kører scripts og returnerer resultater."""

import os, importlib.util
from pathlib import Path
from loguru import logger

class TaskRunner:
    def __init__(self):
        self.tasks_dir = Path("/app/scripts/tasks")
        self.data_dir  = Path("/app/data")
        self.tasks_dir.mkdir(parents=True, exist_ok=True)
        self.data_dir.mkdir(parents=True, exist_ok=True)
        logger.info("✅ TaskRunner klar")

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
