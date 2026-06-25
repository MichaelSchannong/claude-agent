import express from "express";
import fetch from "node-fetch";
import fs from "fs-extra";
import path from "path";
import winston from "winston";

const app  = express();
const PORT = process.env.PORT ?? 3000;
const PYTHON_URL = process.env.PYTHON_WORKER_URL ?? "http://python-worker:5000";
const DATA_DIR   = "/app/data";
const LOG_DIR    = "/app/logs";

const logger = winston.createLogger({
  level: "info",
  format: winston.format.combine(
    winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
    winston.format.printf(({ timestamp, level, message }) =>
      `${timestamp} | ${level.toUpperCase()} | ${message}`)
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: path.join(LOG_DIR, "node-api.log"), maxsize: 50*1024*1024 })
  ]
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

async function callPython(endpoint, body = null) {
  const opts = { method: body ? "POST" : "GET", headers: { "Content-Type": "application/json" } };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${PYTHON_URL}${endpoint}`, opts);
  return res.json();
}

app.get("/health", (_, res) => res.json({ status: "ok" }));

app.get("/api/status", async (_, res) => {
  try {
    const data = await callPython("/status");
    res.json({ node: "ok", python: data });
  } catch {
    res.json({ node: "ok", python: "unreachable" });
  }
});

app.post("/api/run-task", async (req, res) => {
  const { task } = req.body;
  if (!task) return res.status(400).json({ error: "Mangler 'task'" });
  try {
    const data = await callPython("/run-task", { task });
    logger.info(`Opgave trigget: ${task}`);
    res.json(data);
  } catch (err) {
    res.status(502).json({ error: "Kan ikke nå Python Worker", detail: err.message });
  }
});

app.get("/api/rapporter", async (_, res) => {
  try {
    const dir = path.join(DATA_DIR, "rapporter");
    await fs.ensureDir(dir);
    const filer = (await fs.readdir(dir)).filter(f => f.endsWith(".txt")).sort().reverse().slice(0, 20);
    const rapporter = await Promise.all(filer.map(async (fil) => ({
      navn: fil,
      indhold: await fs.readFile(path.join(dir, fil), "utf8"),
      dato: (await fs.stat(path.join(dir, fil))).mtime
    })));
    res.json(rapporter);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/", (_, res) => {
  res.send(`<!DOCTYPE html>
<html lang="da">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Pi Agent</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0 }
    body { font-family: system-ui, sans-serif; background: #0f172a; color: #e2e8f0; min-height: 100vh }
    header { background: #1e293b; padding: 1.2rem 2rem; display: flex; align-items: center; gap: 1rem; border-bottom: 1px solid #334155 }
    header h1 { font-size: 1.4rem; color: #f1f5f9 }
    .badge { background: #22c55e; color: #000; font-size: .7rem; padding: .2rem .6rem; border-radius: 99px; font-weight: 700 }
    main { max-width: 1000px; margin: 2rem auto; padding: 0 1rem; display: grid; gap: 1.5rem }
    .card { background: #1e293b; border: 1px solid #334155; border-radius: 12px; padding: 1.5rem }
    .card h2 { font-size: 1rem; color: #94a3b8; margin-bottom: 1rem; text-transform: uppercase; letter-spacing: .05em }
    .tasks { display: flex; flex-wrap: wrap; gap: .8rem }
    .btn { background: #3b82f6; color: #fff; border: none; padding: .6rem 1.2rem; border-radius: 8px; cursor: pointer; font-size: .9rem; transition: background .2s }
    .btn:hover { background: #2563eb }
    #task-svar { margin-top: 1rem; font-size: .85rem; color: #22c55e; min-height: 1.2rem }
    #rapporter { max-height: 300px; overflow-y: auto }
    .rapport { border-bottom: 1px solid #334155; padding: .8rem 0; font-size: .85rem; color: #94a3b8 }
    .rapport strong { color: #e2e8f0; display: block; margin-bottom: .3rem }
    .stat { background: #0f172a; border-radius: 8px; padding: .8rem 1.2rem; font-size: .85rem; display: inline-block; margin-right: .8rem; margin-bottom: .5rem }
    .stat span { color: #22c55e; font-weight: 700 }
    .offline { color: #ef4444 !important }
  </style>
</head>
<body>
  <header>
    <span style="font-size:1.8rem">🖥️</span>
    <h1>Pi Agent</h1>
    <span class="badge" id="status-badge">Tjekker...</span>
  </header>
  <main>

    <div class="card">
      <h2>System Status</h2>
      <div class="stat">Node.js API <span id="node-ok">✓</span></div>
      <div class="stat">Python Worker <span id="py-ok">...</span></div>
    </div>

    <div class="card">
      <h2>Kør Opgave</h2>
      <div class="tasks">
        <button class="btn" onclick="runTask('status_rapport')">📊 Status Rapport</button>
        <button class="btn" onclick="runTask('fil_analyse')">🔍 Fil Analyse</button>
        <button class="btn" onclick="runTask('ryd_logs')">🧹 Ryd Logs</button>
      </div>
      <div id="task-svar"></div>
    </div>

    <div class="card">
      <h2>Seneste Rapporter</h2>
      <div id="rapporter"><div style="color:#64748b;font-size:.85rem">Indlæser...</div></div>
    </div>

  </main>

  <script>
    async function checkStatus() {
      try {
        const d = await fetch('/api/status').then(r => r.json());
        const pyOk = d.python?.status === 'ok';
        document.getElementById('node-ok').textContent = '✓ OK';
        const pyEl = document.getElementById('py-ok');
        pyEl.textContent = pyOk ? '✓ OK' : '✗ Offline';
        pyEl.className = pyOk ? '' : 'offline';
        document.getElementById('status-badge').textContent = pyOk ? 'Online' : 'Delvist online';
        document.getElementById('status-badge').style.background = pyOk ? '#22c55e' : '#f59e0b';
      } catch {}
    }

    async function runTask(task) {
      document.getElementById('task-svar').textContent = '⏳ Starter ' + task + '...';
      try {
        const d = await fetch('/api/run-task', {
          method: 'POST', headers: {'Content-Type':'application/json'},
          body: JSON.stringify({ task })
        }).then(r => r.json());
        document.getElementById('task-svar').textContent = d.started
          ? '✅ ' + d.started + ' er startet'
          : '❌ ' + (d.error ?? 'Fejl');
      } catch { document.getElementById('task-svar').textContent = '❌ Kan ikke nå Python Worker'; }
    }

    async function loadRapporter() {
      try {
        const rapporter = await fetch('/api/rapporter').then(r => r.json());
        const el = document.getElementById('rapporter');
        if (!rapporter.length) { el.innerHTML = '<div style="color:#64748b;font-size:.85rem">Ingen rapporter endnu</div>'; return; }
        el.innerHTML = rapporter.slice(0,5).map(r =>
          '<div class="rapport"><strong>' + r.navn + '</strong>' +
          r.indhold.replace(/</g,'&lt;') + '</div>'
        ).join('');
      } catch {}
    }

    checkStatus();
    loadRapporter();
    setInterval(checkStatus, 30000);
    setInterval(loadRapporter, 60000);
  </script>
</body>
</html>`);
});

app.listen(PORT, "0.0.0.0", () => {
  logger.info(`🌐 Node.js API kører på port ${PORT}`);
});
