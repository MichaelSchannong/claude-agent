import express from "express";
import fetch from "node-fetch";
import fs from "fs-extra";
import path from "path";
import winston from "winston";

const app        = express();
const PORT       = process.env.PORT ?? 3000;
const PYTHON_URL = process.env.PYTHON_WORKER_URL ?? "http://python-worker:5000";
const LOG_DIR    = "/app/logs";

const logger = winston.createLogger({
  level: "info",
  format: winston.format.combine(
    winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
    winston.format.printf(({ timestamp, level, message }) => `${timestamp} | ${level.toUpperCase()} | ${message}`)
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: path.join(LOG_DIR, "node-api.log"), maxsize: 50*1024*1024 })
  ]
});

app.use(express.json({ limit: "2mb" }));

async function py(endpoint, body = null) {
  const opts = { method: body ? "POST" : "GET", headers: { "Content-Type": "application/json" } };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${PYTHON_URL}${endpoint}`, opts);
  return res.json();
}

app.get("/health",        (_, res) => res.json({ status: "ok" }));
app.get("/api/status",    async (_, res) => { try { res.json({ node:"ok", python: await py("/status") }); } catch { res.json({ node:"ok", python:"unreachable" }); }});
app.post("/api/run-task", async (req, res) => { try { res.json(await py("/run-task", req.body)); } catch(e) { res.status(502).json({ error: e.message }); }});
app.post("/api/run-python", async (req, res) => { try { res.json(await py("/run-python", req.body)); } catch(e) { res.status(502).json({ error: e.message }); }});
app.post("/api/scrape",   async (req, res) => { try { res.json(await py("/scrape", req.body)); } catch(e) { res.status(502).json({ error: e.message }); }});
app.get("/api/rapporter", async (_, res) => { try { res.json(await py("/rapporter")); } catch(e) { res.status(502).json({ error: e.message }); }});

app.get("/", (_, res) => res.send(`<!DOCTYPE html>
<html lang="da">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Pi Agent</title>
<style>
  :root{--bg:#0f172a;--surface:#1e293b;--border:#334155;--text:#e2e8f0;--muted:#94a3b8;--blue:#3b82f6;--green:#22c55e;--red:#ef4444;--yellow:#f59e0b;--purple:#a855f7}
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:system-ui,sans-serif;background:var(--bg);color:var(--text);min-height:100vh}
  /* Sidebar */
  .layout{display:flex;min-height:100vh}
  .sidebar{width:220px;background:var(--surface);border-right:1px solid var(--border);display:flex;flex-direction:column;padding:1rem 0;flex-shrink:0}
  .sidebar-logo{padding:.8rem 1.2rem 1.5rem;display:flex;align-items:center;gap:.6rem;border-bottom:1px solid var(--border);margin-bottom:1rem}
  .sidebar-logo h1{font-size:1rem;font-weight:700}
  .badge{background:var(--green);color:#000;font-size:.6rem;padding:.15rem .5rem;border-radius:99px;font-weight:800}
  .nav-item{display:flex;align-items:center;gap:.8rem;padding:.7rem 1.2rem;cursor:pointer;color:var(--muted);font-size:.9rem;border-left:3px solid transparent;transition:all .15s}
  .nav-item:hover{background:rgba(255,255,255,.04);color:var(--text)}
  .nav-item.active{color:var(--blue);border-left-color:var(--blue);background:rgba(59,130,246,.08)}
  .nav-item span{font-size:1.1rem}
  /* Main */
  .main{flex:1;display:flex;flex-direction:column;overflow:hidden}
  .topbar{background:var(--surface);border-bottom:1px solid var(--border);padding:.8rem 1.5rem;display:flex;align-items:center;justify-content:space-between}
  .topbar h2{font-size:1rem;font-weight:600}
  .status-dots{display:flex;gap:1rem;font-size:.8rem}
  .dot{display:flex;align-items:center;gap:.4rem}
  .dot-circle{width:8px;height:8px;border-radius:50%;background:var(--green)}
  .dot-circle.off{background:var(--red)}
  .content{flex:1;padding:1.5rem;overflow-y:auto;display:none}
  .content.active{display:block}
  /* Cards */
  .card{background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:1.2rem;margin-bottom:1rem}
  .card-title{font-size:.8rem;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:1rem;font-weight:600}
  /* Buttons */
  .btn{border:none;padding:.55rem 1.1rem;border-radius:8px;cursor:pointer;font-size:.85rem;font-weight:600;transition:opacity .15s}
  .btn:hover{opacity:.85}
  .btn-blue{background:var(--blue);color:#fff}
  .btn-green{background:var(--green);color:#000}
  .btn-purple{background:var(--purple);color:#fff}
  .btn-red{background:var(--red);color:#fff}
  .btn-row{display:flex;gap:.6rem;flex-wrap:wrap}
  /* Editor */
  .editor{width:100%;background:#0d1117;color:#c9d1d9;border:1px solid var(--border);border-radius:8px;padding:1rem;font-family:'Fira Code',Consolas,monospace;font-size:.85rem;line-height:1.6;resize:vertical;min-height:200px;outline:none;tab-size:4}
  .editor:focus{border-color:var(--blue)}
  /* Output */
  .output{background:#0d1117;border:1px solid var(--border);border-radius:8px;padding:1rem;font-family:monospace;font-size:.82rem;line-height:1.6;min-height:80px;white-space:pre-wrap;color:#a3e635;max-height:300px;overflow-y:auto}
  .output.error{color:var(--red)}
  /* Scraper */
  .input-row{display:flex;gap:.6rem;margin-bottom:.8rem}
  input[type=text],select{background:#0d1117;color:var(--text);border:1px solid var(--border);border-radius:8px;padding:.55rem .9rem;font-size:.85rem;outline:none;flex:1}
  input[type=text]:focus,select:focus{border-color:var(--blue)}
  select{flex:0;min-width:130px}
  /* Tasks */
  .task-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:.8rem}
  .task-card{background:#0d1117;border:1px solid var(--border);border-radius:10px;padding:1rem;cursor:pointer;transition:border-color .15s;text-align:center}
  .task-card:hover{border-color:var(--blue)}
  .task-card .icon{font-size:1.8rem;margin-bottom:.5rem}
  .task-card .name{font-size:.85rem;font-weight:600}
  .task-card .desc{font-size:.75rem;color:var(--muted);margin-top:.3rem}
  /* Rapporter */
  .rapport-item{border-bottom:1px solid var(--border);padding:.8rem 0}
  .rapport-item strong{display:block;color:var(--text);margin-bottom:.3rem;font-size:.85rem}
  .rapport-item pre{font-size:.78rem;color:var(--muted);white-space:pre-wrap;max-height:120px;overflow-y:auto}
  /* Scraper result */
  .scrape-result{background:#0d1117;border:1px solid var(--border);border-radius:8px;padding:1rem;max-height:400px;overflow-y:auto;font-size:.82rem;line-height:1.7;white-space:pre-wrap;color:#e2e8f0}
  .link-item{padding:.3rem 0;border-bottom:1px solid #1e293b}
  .link-item a{color:var(--blue);text-decoration:none;font-size:.82rem}
  .link-item .link-text{color:var(--muted);font-size:.75rem}
  /* Loader */
  .loader{display:inline-block;width:14px;height:14px;border:2px solid var(--border);border-top-color:var(--blue);border-radius:50%;animation:spin .6s linear infinite;vertical-align:middle;margin-right:.4rem}
  @keyframes spin{to{transform:rotate(360deg)}}
  .msg{font-size:.82rem;margin-top:.7rem;padding:.5rem .8rem;border-radius:6px}
  .msg.ok{background:rgba(34,197,94,.1);color:var(--green)}
  .msg.err{background:rgba(239,68,68,.1);color:var(--red)}
</style>
</head>
<body>
<div class="layout">

  <!-- Sidebar -->
  <nav class="sidebar">
    <div class="sidebar-logo">
      <span style="font-size:1.5rem">🖥️</span>
      <div>
        <h1>Pi Agent</h1>
        <span class="badge" id="main-badge">Online</span>
      </div>
    </div>
    <div class="nav-item active" onclick="nav('dashboard')"><span>📊</span> Dashboard</div>
    <div class="nav-item" onclick="nav('python')"><span>🐍</span> Python Runner</div>
    <div class="nav-item" onclick="nav('scraper')"><span>🕷️</span> Web Scraper</div>
    <div class="nav-item" onclick="nav('tasks')"><span>⚙️</span> Opgaver</div>
    <div class="nav-item" onclick="nav('rapporter')"><span>📄</span> Rapporter</div>
    <div style="margin-top:auto;padding:1rem 1.2rem;font-size:.72rem;color:var(--muted)">
      VS Code: <a href="http://localhost:8080" target="_blank" style="color:var(--blue)">port 8080</a>
    </div>
  </nav>

  <!-- Main -->
  <div class="main">
    <div class="topbar">
      <h2 id="page-title">Dashboard</h2>
      <div class="status-dots">
        <div class="dot"><div class="dot-circle" id="dot-node"></div>Node.js</div>
        <div class="dot"><div class="dot-circle off" id="dot-python"></div>Python Worker</div>
      </div>
    </div>

    <!-- DASHBOARD -->
    <div class="content active" id="page-dashboard">
      <div class="card">
        <div class="card-title">System Oversigt</div>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:.8rem">
          <div style="background:#0d1117;border-radius:8px;padding:1rem;text-align:center">
            <div style="font-size:1.8rem">🐍</div>
            <div style="font-size:.8rem;color:var(--muted);margin-top:.3rem">Python Worker</div>
            <div style="font-size:.9rem;font-weight:700;margin-top:.2rem" id="dash-python">Tjekker...</div>
          </div>
          <div style="background:#0d1117;border-radius:8px;padding:1rem;text-align:center">
            <div style="font-size:1.8rem">🟢</div>
            <div style="font-size:.8rem;color:var(--muted);margin-top:.3rem">Node.js API</div>
            <div style="font-size:.9rem;font-weight:700;margin-top:.2rem;color:var(--green)">Online</div>
          </div>
          <div style="background:#0d1117;border-radius:8px;padding:1rem;text-align:center">
            <div style="font-size:1.8rem">💻</div>
            <div style="font-size:.8rem;color:var(--muted);margin-top:.3rem">VS Code</div>
            <div style="font-size:.9rem;font-weight:700;margin-top:.2rem"><a href="http://localhost:8080" target="_blank" style="color:var(--blue)">Åbn →</a></div>
          </div>
        </div>
      </div>
      <div class="card">
        <div class="card-title">Hurtig Adgang</div>
        <div class="btn-row">
          <button class="btn btn-blue" onclick="nav('python')">🐍 Kør Python</button>
          <button class="btn btn-purple" onclick="nav('scraper')">🕷️ Web Scraper</button>
          <button class="btn btn-green" onclick="nav('tasks')">⚙️ Kør Opgave</button>
        </div>
      </div>
    </div>

    <!-- PYTHON RUNNER -->
    <div class="content" id="page-python">
      <div class="card">
        <div class="card-title">Python Script Runner</div>
        <div class="btn-row" style="margin-bottom:.8rem">
          <button class="btn btn-blue" style="font-size:.75rem" onclick="indsætEksempel('hello')">Hello World</button>
          <button class="btn btn-blue" style="font-size:.75rem" onclick="indsætEksempel('filer')">List filer</button>
          <button class="btn btn-blue" style="font-size:.75rem" onclick="indsætEksempel('dato')">Dato/tid</button>
          <button class="btn btn-blue" style="font-size:.75rem" onclick="indsætEksempel('matematik')">Matematik</button>
        </div>
        <textarea class="editor" id="python-kode" placeholder="Skriv Python kode her..." spellcheck="false">print("Hej fra Pi Agent! 🤖")
print(f"2 + 2 = {2 + 2}")</textarea>
        <div class="btn-row" style="margin-top:.8rem">
          <button class="btn btn-green" onclick="kørPython()">▶ Kør Script</button>
          <button class="btn btn-red" style="font-size:.8rem" onclick="document.getElementById('python-kode').value='';document.getElementById('python-output').textContent='';document.getElementById('python-output').className='output'">Ryd</button>
        </div>
        <div id="python-msg"></div>
      </div>
      <div class="card">
        <div class="card-title">Output</div>
        <div class="output" id="python-output">Output vises her...</div>
      </div>
    </div>

    <!-- WEB SCRAPER -->
    <div class="content" id="page-scraper">
      <div class="card">
        <div class="card-title">Web Scraper</div>
        <div class="input-row">
          <input type="text" id="scrape-url" placeholder="https://eksempel.dk" />
          <select id="scrape-mode">
            <option value="tekst">Tekst</option>
            <option value="links">Links</option>
            <option value="overskrifter">Overskrifter</option>
            <option value="tabeller">Tabeller</option>
          </select>
          <button class="btn btn-purple" onclick="kørScraper()">🕷️ Scrape</button>
        </div>
        <div class="btn-row" style="margin-bottom:.5rem">
          <button class="btn btn-blue" style="font-size:.75rem" onclick="document.getElementById('scrape-url').value='https://www.dr.dk'">dr.dk</button>
          <button class="btn btn-blue" style="font-size:.75rem" onclick="document.getElementById('scrape-url').value='https://www.tv2.dk'">tv2.dk</button>
          <button class="btn btn-blue" style="font-size:.75rem" onclick="document.getElementById('scrape-url').value='https://www.berlingske.dk'">berlingske.dk</button>
          <button class="btn btn-blue" style="font-size:.75rem" onclick="document.getElementById('scrape-url').value='https://news.ycombinator.com'">Hacker News</button>
        </div>
        <div id="scrape-msg"></div>
      </div>
      <div class="card">
        <div class="card-title">Resultat <span id="scrape-count" style="color:var(--muted);font-weight:400"></span></div>
        <div class="scrape-result" id="scrape-result">Resultat vises her...</div>
      </div>
    </div>

    <!-- OPGAVER -->
    <div class="content" id="page-tasks">
      <div class="card">
        <div class="card-title">Kør Opgave</div>
        <div class="task-grid">
          <div class="task-card" onclick="kørOpgave('status_rapport')">
            <div class="icon">📊</div>
            <div class="name">Status Rapport</div>
            <div class="desc">Generer systemrapport</div>
          </div>
          <div class="task-card" onclick="kørOpgave('fil_analyse')">
            <div class="icon">🔍</div>
            <div class="name">Fil Analyse</div>
            <div class="desc">Analyser input-filer</div>
          </div>
          <div class="task-card" onclick="kørOpgave('ryd_logs')">
            <div class="icon">🧹</div>
            <div class="name">Ryd Logs</div>
            <div class="desc">Slet gamle logfiler</div>
          </div>
        </div>
        <div id="task-msg"></div>
      </div>
    </div>

    <!-- RAPPORTER -->
    <div class="content" id="page-rapporter">
      <div class="card">
        <div class="card-title">Seneste Rapporter</div>
        <div id="rapport-liste"><div style="color:var(--muted);font-size:.85rem">Indlæser...</div></div>
      </div>
    </div>

  </div>
</div>

<script>
// ── Navigation ───────────────────────────────────────────
const sider = ['dashboard','python','scraper','tasks','rapporter'];
const titler = {dashboard:'Dashboard',python:'Python Runner',scraper:'Web Scraper',tasks:'Opgaver',rapporter:'Rapporter'};

function nav(side) {
  sider.forEach(s => {
    document.getElementById('page-'+s).classList.remove('active');
    document.querySelectorAll('.nav-item').forEach((el,i) => {
      if(el.getAttribute('onclick')?.includes("'"+s+"'")) el.classList.remove('active');
    });
  });
  document.getElementById('page-'+side).classList.add('active');
  document.querySelectorAll('.nav-item').forEach(el => {
    if(el.getAttribute('onclick')?.includes("'"+side+"'")) el.classList.add('active');
  });
  document.getElementById('page-title').textContent = titler[side];
  if(side === 'rapporter') loadRapporter();
}

// ── Status ───────────────────────────────────────────────
async function checkStatus() {
  try {
    const d = await fetch('/api/status').then(r=>r.json());
    const ok = d.python?.status === 'ok';
    document.getElementById('dot-python').className = 'dot-circle' + (ok ? '' : ' off');
    document.getElementById('dash-python').textContent = ok ? '✓ Online' : '✗ Offline';
    document.getElementById('dash-python').style.color = ok ? 'var(--green)' : 'var(--red)';
  } catch {}
}

// ── Python Runner ────────────────────────────────────────
const eksempler = {
  hello: 'print("Hej fra Pi Agent! 🤖")\nprint(f"2 + 2 = {2 + 2}")',
  filer: 'import os\nfiler = os.listdir("/app/data")\nprint(f"Filer i /app/data: {len(filer)}")\nfor f in filer:\n    print(f"  - {f}")',
  dato:  'from datetime import datetime\nnu = datetime.now()\nprint(f"Dato: {nu.strftime(\'%d/%m/%Y\')}")\nprint(f"Tid:  {nu.strftime(\'%H:%M:%S\')}")\nprint(f"Dag:  {nu.strftime(\'%A\')}")',
  matematik: 'import math\ntal = [1,4,9,16,25,36,49,64,81,100]\nprint("Kvadratrødder:")\nfor t in tal:\n    print(f"  √{t:3d} = {math.sqrt(t):.1f}")'
};

function indsætEksempel(navn) {
  document.getElementById('python-kode').value = eksempler[navn];
}

async function kørPython() {
  const kode = document.getElementById('python-kode').value.trim();
  if (!kode) return;
  const msg = document.getElementById('python-msg');
  const out = document.getElementById('python-output');
  msg.innerHTML = '<span class="loader"></span> Kører...';
  out.textContent = '';
  out.className = 'output';
  try {
    const d = await fetch('/api/run-python', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ code: kode })
    }).then(r=>r.json());

    if (d.error) { msg.innerHTML = '<div class="msg err">❌ ' + d.error + '</div>'; return; }
    msg.innerHTML = d.returncode === 0
      ? '<div class="msg ok">✅ Færdig</div>'
      : '<div class="msg err">⚠️ Exit code: ' + d.returncode + '</div>';

    const output = (d.stdout || '') + (d.stderr ? '\n--- STDERR ---\n' + d.stderr : '');
    out.textContent = output || '(ingen output)';
    if (d.returncode !== 0) out.className = 'output error';
  } catch(e) {
    msg.innerHTML = '<div class="msg err">❌ Kan ikke nå Python Worker</div>';
  }
}

// Tab i editor
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('python-kode').addEventListener('keydown', e => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const s = e.target.selectionStart;
      e.target.value = e.target.value.slice(0,s) + '    ' + e.target.value.slice(e.target.selectionEnd);
      e.target.selectionStart = e.target.selectionEnd = s + 4;
    }
  });
});

// ── Web Scraper ──────────────────────────────────────────
async function kørScraper() {
  const url  = document.getElementById('scrape-url').value.trim();
  const mode = document.getElementById('scrape-mode').value;
  if (!url) return;
  const msg = document.getElementById('scrape-msg');
  const res = document.getElementById('scrape-result');
  const cnt = document.getElementById('scrape-count');
  msg.innerHTML = '<div class="msg ok"><span class="loader"></span> Henter ' + url + '...</div>';
  res.textContent = '';
  cnt.textContent = '';
  try {
    const d = await fetch('/api/scrape', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ url, mode })
    }).then(r=>r.json());

    if (d.error) { msg.innerHTML = '<div class="msg err">❌ ' + d.error + '</div>'; return; }
    msg.innerHTML = '<div class="msg ok">✅ Hentet – ' + (d.count ?? '') + ' resultater</div>';
    cnt.textContent = '(' + (d.count ?? 0) + ')';

    if (mode === 'links' && Array.isArray(d.result)) {
      res.innerHTML = d.result.map(l =>
        '<div class="link-item"><a href="'+l.url+'" target="_blank">'+l.url+'</a><div class="link-text">'+l.tekst+'</div></div>'
      ).join('');
    } else if (mode === 'overskrifter' && Array.isArray(d.result)) {
      res.textContent = d.result.map(h => h.niveau + ': ' + h.tekst).join('\n');
    } else if (mode === 'tabeller' && Array.isArray(d.result)) {
      res.textContent = d.result.map(tbl => tbl.map(r => r.join(' | ')).join('\n')).join('\n\n---\n\n');
    } else {
      res.textContent = typeof d.result === 'string' ? d.result : JSON.stringify(d.result, null, 2);
    }
  } catch(e) {
    msg.innerHTML = '<div class="msg err">❌ Fejl: ' + e.message + '</div>';
  }
}

// ── Opgaver ──────────────────────────────────────────────
async function kørOpgave(task) {
  document.getElementById('task-msg').innerHTML = '<div class="msg ok"><span class="loader"></span> Starter ' + task + '...</div>';
  try {
    const d = await fetch('/api/run-task', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ task })
    }).then(r=>r.json());
    document.getElementById('task-msg').innerHTML = d.started
      ? '<div class="msg ok">✅ ' + d.started + ' er startet</div>'
      : '<div class="msg err">❌ ' + (d.error ?? 'Fejl') + '</div>';
  } catch {
    document.getElementById('task-msg').innerHTML = '<div class="msg err">❌ Kan ikke nå Python Worker</div>';
  }
}

// ── Rapporter ────────────────────────────────────────────
async function loadRapporter() {
  try {
    const raps = await fetch('/api/rapporter').then(r=>r.json());
    const el = document.getElementById('rapport-liste');
    if (!raps.length) { el.innerHTML = '<div style="color:var(--muted);font-size:.85rem">Ingen rapporter endnu – kør en Status Rapport opgave</div>'; return; }
    el.innerHTML = raps.map(r =>
      '<div class="rapport-item"><strong>'+r.navn+'</strong><pre>'+r.indhold.replace(/</g,'&lt;')+'</pre></div>'
    ).join('');
  } catch {}
}

checkStatus();
setInterval(checkStatus, 15000);
</script>
</body>
</html>`));

app.listen(PORT, "0.0.0.0", () => logger.info(\`🌐 Node.js kører på port \${PORT}\`));
