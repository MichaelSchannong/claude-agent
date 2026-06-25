# 🤖 Claude Pi Agent – Samlet løsning

> Python Worker + Node.js GUI/API der arbejder **sammen** på Raspberry Pi via Portainer CE

```
┌─────────────────────────────────────────────┐
│           Browser / Portainer GUI            │
│         http://<pi-ip>:3000                  │
└────────────────────┬────────────────────────┘
                     │ HTTP
         ┌───────────▼───────────┐
         │   Node.js API          │  :3000
         │   Web GUI + REST API   │
         └───────────┬───────────┘
                     │ HTTP (intern Docker-netværk)
         ┌───────────▼───────────┐
         │   Python Worker        │  :5000
         │   Claude + Scheduler   │
         └───────────┬───────────┘
                     │ Anthropic API
                  ☁️  Claude
         
         Begge services deler:
         📁 /app/data   (rapporter, input, output)
         📁 /app/logs   (fælles logs)
```

## 📦 Struktur

```
claude-pi-agent/
├── docker-compose.yml          ← Start begge services med ét klik
├── .env.example
├── python-worker/
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── app/
│   │   └── main.py             ← Scheduler + Flask API (:5000)
│   └── scripts/
│       ├── task_runner.py
│       └── tasks/
│           ├── status_rapport.py
│           ├── fil_analyse.py
│           └── ryd_logs.py
└── node-api/
    ├── Dockerfile
    ├── package.json
    └── src/
        └── server.js           ← Express API + Web GUI (:3000)
```

## 🚀 Deploy via Portainer

1. **Klargør Pi** – opret mapper:
   ```bash
   sudo mkdir -p /opt/claude-agent/{data/{input,output,rapporter},logs}
   sudo chmod -R 755 /opt/claude-agent
   ```

2. **Portainer → Stacks → Add Stack → Repository**
   - URL: `https://github.com/MichaelSchannong/claude-agent`
   - Compose-fil: `docker-compose.yml`
   - Miljøvariabler:
     ```
     ANTHROPIC_API_KEY = sk-ant-din-nøgle
     CLAUDE_MODEL      = claude-sonnet-4-6
     ```

3. **Deploy** → Åbn `http://<pi-ip>:3000`

## 🔌 Hvad kan hvad?

| Node.js (port 3000)             | Python Worker (port 5000, intern) |
|---------------------------------|-----------------------------------|
| Web GUI dashboard               | Kører Claude-opgaver              |
| Modtager klik fra browser       | Scheduler (dagligt/interval)      |
| Videresender til Python Worker  | Taler med Anthropic API           |
| Viser rapporter fra delt volume | Gemmer resultater til delt volume |

## ➕ Tilføj egne opgaver

Opret `python-worker/scripts/tasks/min_opgave.py`:

```python
def run(runner):
    svar = runner.ask_claude("Dit spørgsmål her")
    print(svar)
```

Tilføj til scheduler i `python-worker/app/main.py`:
```python
schedule.every().day.at("10:00").do(runner.run, task_name="min_opgave")
```

Trigger også fra GUI via knap i `node-api/src/server.js`.

## 🔐 Sikkerhed
- `.env` må **aldrig** committes til GitHub
- Python Worker er ikke eksponeret eksternt (kun intern port 5000)
- Node.js GUI er på port 3000 – beskyt med Portainer's netværksregler hvis nødvendigt
