// ============================================================
// Node.js API Server + Web GUI
// Taler med Python Worker via intern Docker-netværk
// Tilgå på http://<pi-ip>:3000
// ============================================================

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

// ── Logger ────────────────────────────────────────────────
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

// ── Hjælpefunktion: kald Python Worker ────────────────────
async function callPython(endpoint, body = null) {
  const opts = { method: body ? "POST" : "GET",
                 headers: { "Content-Type": "application/json" } };
  if (body) opts.body = JSON.stringify(body);
  const res  = await fetch(`${PYTHON_URL}${endpoint}`, opts);
  return res.json();
}

// ── REST API endpoints ─────────────────────────────────────

// Helbredscheck
app.get("/health", (_, res) => res.json({ status: "ok", service: "node-api" }));

// Status fra Python Worker
app.get("/api/status", async (_, res) => {
  try {
    const data = await callPython("/status");
    res.json({ node: "ok", python: data });
  } catch {
    res.json({ node: "ok", python: "unreachable" });
  }
});

// Kør en opgave via Python Worker
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

// Spørg Claude direkte via Python Worker
app.post("/api/ask", async (req, res) => {
  const { prompt, system } = req.body;
  if (!prompt) return res.status(400).json({ error: "Mangler 'prompt'" });
  try {
    const data = await callPython("/ask", { prompt, system });
    res.json(data);
  } catch (err) {
    res.status(502).json({ error: "Kan ikke nå Python Worker", detail: err.message });
  }
});

// Hent rapporter fra delt volume
app.get("/api/rapporter", async (_, res) => {
  try {
    const dir = path.join(DATA_DIR, "rapporter");
    await fs.ensureDir(dir);
    const filer = (await fs.readdir(dir))
      .filter(f => f.endsWith(".txt"))
      .sort().reverse().slice(0, 20);

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

// Hent liste over output-filer
app.get("/api/output", async (_, res) => {
  try {
    const dir = path.join(DATA_DIR, "output");
    await fs.ensureDir(dir);
    const filer = (await fs.readdir(dir)).filter(f => f.endsWith(".txt")).sort().reverse();
    res.json(filer);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Web GUI (HTML dashboard) ───────────────────────────────
app.get("/", (_, res) => {
  res.send(`<!DOCTYPE html>
<html lang="da">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Claude Pi Agent</title>
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
    .btn.green { background: #22c55e; color: #000 }
    textarea { width: 100%; background: #0f172a; color: #e2e8f0; border: 1px solid #334155; border-radius: 8px; padding: .8rem; font-size: .9rem; resize: vertical; min-height: 80px }
    #svar { background: #0f172a; border: 1px solid #334155; border-radius: 8px; padding: 1rem; white-space: pre-wrap; font-size: .9rem; min-height: 60px; color: #a3e635 }
    #rapporter { max-height: 300px; overflow-y: auto }
    .rapport { border-bottom: 1px solid #334155; padding: .8rem 0; font-size: .85rem; color: #94a3b8 }
    .rapport strong { color: #e2e8f0 }
    #status-box { display: flex; gap: 1rem; flex-wrap: wrap }
    .stat { background: #0f172a; border-radius: 8px; padding: .8rem 1.2rem; font-size: .85rem }
    .stat span { color: #22c55e; font-weight: 700 }
    .log-line { font-family: monospace; font-size: .8rem; color: #64748b; padding: .1rem 0 }
  </style>
</head>
<body>
  <header>
    <span style="font-size:1.8rem">🤖</span>
    <h1>Claude Pi Agent</h1>
    <span class="badge" id="status-badge">Tjekker...</span>
  </header>
  <main>

    <!-- Status -->
    <div class="card">
      <h2>System Status</h2>
      <div id="status-box">
        <div class="stat">Node.js API <span id="node-ok">✓</span></div>
        <div class="stat">Python Worker <span id="py-ok">...</span></div>
        <div class="stat">Claude Model <span id="model">...</span></div>
      </div>
    </div>

    <!-- Kør opgaver -->
    <div class="card">
      <h2>Kør Opgave</h2>
      <div class="tasks">
        <button class="btn" onclick="runTask('status_rapport')">📊 Status Rapport</button>
        <button class="btn" onclick="runTask('fil_analyse')">🔍 Fil Analyse</button>
        <button class="btn" onclick="runTask('ryd_logs')">🧹 Ryd Logs</button>
      </div>
      <div id="task-svar" style="margin-top:1rem; color:#22c55e; font-size:.85rem"></div>
    </div>

    <!-- Spørg Claude direkte -->
    <div class="card">
      <h2>Spørg Claude Direkte</h2>
      <textarea id="prompt" placeholder="Skriv dit spørgsmål til Claude..."></textarea>
      <button class="btn green" style="margin-top:.8rem" onclick="spørg()">Send til Claude</button>
      <div id="svar" style="margin-top:1rem">Svar vises her...</div>
    </div>

    <!-- Seneste rapporter -->
    <div class="card">
      <h2>Seneste Rapporter</h2>
      <div id="rapporter"><div class="log-line">Indlæser...</div></div>
    </div>

  </main>

  <script>
    async function checkStatus() {
      try {
        const d = await fetch('/api/status').then(r => r.json());
        document.getElementById('node-ok').textContent = '✓ OK';
        document.getElementById('py-ok').textContent = d.python?.status === 'ok' ? '✓ OK' : '✗ Offline';
        document.getElementById('model').textContent = d.python?.model ?? '?';
        document.getElementById('status-badge').textContent = 'Online';
        document.getElementById('status-badge').style.background = '#22c55e';
      } catch { document.getElementById('status-badge').textContent = 'Fejl'; }
    }

    async function runTask(task) {
      document.getElementById('task-svar').textContent = '⏳ Starter ' + task + '...';
      const d = await fetch('/api/run-task', {
        method: 'POST', headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ task })
      }).then(r => r.json());
      document.getElementById('task-svar').textContent = d.started
        ? '✅ ' + d.started + ' er startet (kører i baggrunden)'
        : '❌ ' + (d.error ?? 'Ukendt fejl');
    }

    async function spørg() {
      const prompt = document.getElementById('prompt').value.trim();
      if (!prompt) return;
      document.getElementById('svar').textContent = '⏳ Venter på Claude...';
      const d = await fetch('/api/ask', {
        method: 'POST', headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ prompt })
      }).then(r => r.json());
      document.getElementById('svar').textContent = d.response ?? d.error ?? 'Ingen svar';
    }

    async function loadRapporter() {
      const rapporter = await fetch('/api/rapporter').then(r => r.json());
      const el = document.getElementById('rapporter');
      if (!rapporter.length) { el.innerHTML = '<div class="log-line">Ingen rapporter endnu</div>'; return; }
      el.innerHTML = rapporter.slice(0,5).map(r =>
        '<div class="rapport"><strong>' + r.navn + '</strong><br>' +
        r.indhold.slice(0, 300).replace(/</g,'&lt;') + '...</div>'
      ).join('');
    }

    checkStatus();
    loadRapporter();
    setInterval(checkStatus, 30000);
    setInterval(loadRapporter, 60000);
  </script>
</body>
</html>`);
});

// ── Start server ───────────────────────────────────────────
app.listen(PORT, "0.0.0.0", () => {
  logger.info(`🌐 Node.js API kører på port ${PORT}`);
  logger.info(`🖥️  GUI tilgængelig på http://0.0.0.0:${PORT}`);
});
