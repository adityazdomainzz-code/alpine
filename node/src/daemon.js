// RedPanel Node Daemon
// Runs Minecraft servers inside Docker (itzg/minecraft-server) and exposes a
// token-protected HTTP + WebSocket API that the panel talks to.
'use strict';
const express = require('express');
const Docker = require('dockerode');
const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const http = require('http');
const os = require('os');
const crypto = require('crypto');
const multer = require('multer');
const { WebSocketServer } = require('ws');
const { Readable, PassThrough } = require('stream');
const { pipeline } = require('stream/promises');

const CONFIG_FILE = path.join(__dirname, '..', 'config.json');
if (!fs.existsSync(CONFIG_FILE)) {
  console.error('[node] config.json missing. Run install.sh first.');
  process.exit(1);
}
const cfg = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
const PORT = cfg.port || 8080;
const DATA = cfg.dataDir || '/var/lib/redpanel/volumes';
const META_FILE = path.join(path.dirname(DATA), 'node-servers.json');
fs.mkdirSync(DATA, { recursive: true });

const docker = new Docker({ socketPath: cfg.dockerSocket || '/var/run/docker.sock' });

// ---------- server metadata (kept on node so it can rebuild containers) ----------
let meta = {};
try { meta = JSON.parse(fs.readFileSync(META_FILE, 'utf8')); } catch { meta = {}; }
function saveMeta() {
  fs.writeFileSync(META_FILE + '.tmp', JSON.stringify(meta, null, 2));
  fs.renameSync(META_FILE + '.tmp', META_FILE);
}
const runtime = {}; // id -> { installing, error }

const TYPES = { fabric: 'FABRIC', forge: 'FORGE', purpur: 'PURPUR', paper: 'PAPER', spigot: 'SPIGOT' };
const ID_RE = /^[a-f0-9-]{36}$/;
const cname = (id) => 'rp-' + id.slice(0, 8);

// Pick the right Java image for the Minecraft version
function pickImage(version) {
  const base = 'itzg/minecraft-server:';
  const m = /^1\.(\d+)(?:\.(\d+))?/.exec(version || '');
  if (!m) return base + 'latest'; // LATEST or new year-style versions (26.x)
  const minor = +m[1], patch = +(m[2] || 0);
  if (minor <= 16) return base + 'java8';
  if (minor <= 19 || (minor === 20 && patch <= 4)) return base + 'java17';
  if (minor === 20) return base + 'java21';
  return base + 'latest';
}

async function ensureImage(img) {
  try { await docker.getImage(img).inspect(); return; } catch {}
  console.log('[node] pulling', img);
  await new Promise((resolve, reject) => {
    docker.pull(img, (err, stream) => {
      if (err) return reject(err);
      docker.modem.followProgress(stream, (e) => (e ? reject(e) : resolve()));
    });
  });
}

async function getContainer(id) {
  const c = docker.getContainer(cname(id));
  try { const info = await c.inspect(); return { c, info }; } catch { return null; }
}

async function buildContainer(id, startAfter) {
  const s = meta[id];
  runtime[id] = { installing: true, error: null };
  try {
    const img = pickImage(s.version);
    await ensureImage(img);
    const existing = await getContainer(id);
    if (existing) {
      if (existing.info.State.Running) await existing.c.stop({ t: 30 }).catch(() => {});
      await existing.c.remove({ force: true });
    }
    const dir = path.join(DATA, id);
    fs.mkdirSync(dir, { recursive: true });
    const env = [
      'EULA=TRUE',
      `TYPE=${TYPES[s.software] || 'PAPER'}`,
      `VERSION=${s.version || 'LATEST'}`,
      `MEMORY=${s.memory || 1024}M`,
      `MOTD=${(s.motd || 'A RedPanel Minecraft Server').replace(/\n/g, '\\n').replace(/&([0-9a-fk-or])/gi, '\u00a7$1')}`,
      'ENABLE_RCON=true',
      `RCON_PASSWORD=${s.rcon}`,
      'CREATE_CONSOLE_IN_PIPE=true',
      'OVERRIDE_SERVER_PROPERTIES=true',
      'TZ=Asia/Kolkata',
    ];
    await docker.createContainer({
      name: cname(id),
      Image: img,
      Env: env,
      Tty: false,
      OpenStdin: true,
      ExposedPorts: { '25565/tcp': {}, '25565/udp': {} },
      Labels: { 'redpanel.server': id },
      HostConfig: {
        Binds: [`${dir}:/data`],
        PortBindings: {
          '25565/tcp': [{ HostPort: String(s.port) }],
          '25565/udp': [{ HostPort: String(s.port) }],
        },
        RestartPolicy: { Name: 'unless-stopped' },
      },
    });
    runtime[id] = { installing: false, error: null };
    if (startAfter) await docker.getContainer(cname(id)).start();
  } catch (e) {
    console.error('[node] build failed', id, e.message);
    runtime[id] = { installing: false, error: e.message };
  }
}

// ---------- express ----------
const app = express();
app.use(express.json({ limit: '10mb' }));

app.get('/health', (req, res) => res.json({ ok: true }));

function tokenOk(t) {
  if (!t || typeof t !== 'string') return false;
  const a = Buffer.from(t), b = Buffer.from(cfg.token);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
app.use('/api', (req, res, next) => {
  const t = (req.headers.authorization || '').replace(/^Bearer /, '');
  if (!tokenOk(t)) return res.status(401).json({ error: 'Invalid node token' });
  next();
});

const wrap = (fn) => (req, res) => Promise.resolve(fn(req, res)).catch((e) => {
  res.status(e.status || 500).json({ error: e.message });
});
function srv(req) {
  const id = req.params.id;
  if (!ID_RE.test(id) || !meta[id]) throw Object.assign(new Error('Server not found on node'), { status: 404 });
  return id;
}
function safePath(id, p) {
  const base = path.join(DATA, id);
  const full = path.resolve(base, '.' + path.posix.normalize('/' + (p || '')));
  if (full !== base && !full.startsWith(base + path.sep)) throw Object.assign(new Error('Bad path'), { status: 400 });
  return full;
}

app.get('/api/system', wrap(async (req, res) => {
  let dockerOk = true, containers = 0;
  try { containers = (await docker.listContainers({ all: true, filters: { label: ['redpanel.server'] } })).length; }
  catch { dockerOk = false; }
  res.json({
    hostname: os.hostname(), platform: os.platform(), arch: os.arch(),
    cpus: os.cpus().length, memTotal: os.totalmem(), memFree: os.freemem(),
    load: os.loadavg(), uptime: os.uptime(), docker: dockerOk, containers,
  });
}));

// create
app.post('/api/servers', wrap(async (req, res) => {
  const { id, software, version, memory, port, motd } = req.body;
  if (!ID_RE.test(id)) return res.status(400).json({ error: 'bad id' });
  if (!TYPES[software]) return res.status(400).json({ error: 'bad software' });
  meta[id] = { software, version: version || 'LATEST', memory: +memory || 1024, port: +port, motd: motd || '', rcon: crypto.randomBytes(12).toString('hex') };
  saveMeta();
  buildContainer(id, true); // background (image pull can take a while)
  res.json({ ok: true });
}));

// change software / version / motd / memory -> rebuild container (data kept)
app.patch('/api/servers/:id', wrap(async (req, res) => {
  const id = srv(req);
  for (const k of ['software', 'version', 'memory', 'motd', 'port']) if (req.body[k] !== undefined) meta[id][k] = req.body[k];
  saveMeta();
  const ex = await getContainer(id);
  buildContainer(id, ex ? ex.info.State.Running : false);
  res.json({ ok: true });
}));

app.delete('/api/servers/:id', wrap(async (req, res) => {
  const id = srv(req);
  const ex = await getContainer(id);
  if (ex) await ex.c.remove({ force: true });
  await fsp.rm(path.join(DATA, id), { recursive: true, force: true });
  delete meta[id]; delete runtime[id]; saveMeta();
  res.json({ ok: true });
}));

app.post('/api/servers/:id/power', wrap(async (req, res) => {
  const id = srv(req);
  const ex = await getContainer(id);
  if (!ex) {
    if (runtime[id]?.installing) return res.status(409).json({ error: 'Server is still installing, please wait' });
    if (req.body.action === 'start' || req.body.action === 'restart') { buildContainer(id, true); return res.json({ ok: true, rebuilding: true }); }
    return res.json({ ok: true });
  }
  const running = ex.info.State.Running;
  switch (req.body.action) {
    case 'start': if (!running) await ex.c.start(); break;
    case 'stop': if (running) await ex.c.stop({ t: 30 }); break;
    case 'restart': await ex.c.restart({ t: 30 }); break;
    case 'kill': if (running) await ex.c.kill(); break;
    default: return res.status(400).json({ error: 'bad action' });
  }
  res.json({ ok: true });
}));

app.get('/api/servers/:id/status', wrap(async (req, res) => {
  const id = srv(req);
  const rt = runtime[id] || {};
  const ex = await getContainer(id);
  const out = { state: ex ? ex.info.State.Status : (rt.installing ? 'installing' : 'missing'), installing: !!rt.installing, error: rt.error || null, cpu: 0, memory: 0, memLimit: (meta[id].memory || 1024) * 1048576, startedAt: ex?.info.State.StartedAt };
  if (rt.installing) out.state = 'installing';
  if (ex && ex.info.State.Running) {
    try {
      const st = await ex.c.stats({ stream: false });
      const cpuDelta = st.cpu_stats.cpu_usage.total_usage - st.precpu_stats.cpu_usage.total_usage;
      const sysDelta = (st.cpu_stats.system_cpu_usage || 0) - (st.precpu_stats.system_cpu_usage || 0);
      const n = st.cpu_stats.online_cpus || 1;
      out.cpu = sysDelta > 0 ? +((cpuDelta / sysDelta) * n * 100).toFixed(1) : 0;
      out.memory = (st.memory_stats.usage || 0) - (st.memory_stats.stats?.cache || 0);
    } catch {}
  }
  res.json(out);
}));

app.post('/api/servers/:id/command', wrap(async (req, res) => {
  const id = srv(req);
  await sendCommand(id, String(req.body.command || ''));
  res.json({ ok: true });
}));

async function sendCommand(id, cmd) {
  cmd = cmd.replace(/^\//, '').trim();
  if (!cmd) return;
  const c = docker.getContainer(cname(id));
  const run = async (Cmd) => {
    const ex = await c.exec({ Cmd, AttachStdout: true, AttachStderr: true });
    const stream = await ex.start({});
    await new Promise((r) => { stream.on('end', r); stream.on('close', r); stream.resume(); setTimeout(r, 5000); });
    return (await ex.inspect()).ExitCode;
  };
  const code = await run(['mc-send-to-console', ...cmd.split(' ')]);
  if (code !== 0) await run(['rcon-cli', ...cmd.split(' ')]);
}

// ---------- files ----------
app.get('/api/servers/:id/files', wrap(async (req, res) => {
  const id = srv(req);
  const dir = safePath(id, req.query.path);
  await fsp.mkdir(path.join(DATA, id), { recursive: true });
  const ents = await fsp.readdir(dir, { withFileTypes: true });
  const list = await Promise.all(ents.map(async (e) => {
    let st = {}; try { st = await fsp.stat(path.join(dir, e.name)); } catch {}
    return { name: e.name, dir: e.isDirectory(), size: st.size || 0, mtime: st.mtimeMs || 0 };
  }));
  list.sort((a, b) => (b.dir - a.dir) || a.name.localeCompare(b.name));
  res.json(list);
}));
app.get('/api/servers/:id/files/content', wrap(async (req, res) => {
  const id = srv(req);
  const f = safePath(id, req.query.path);
  const st = await fsp.stat(f);
  if (st.size > 5 * 1048576) return res.status(413).json({ error: 'File too large to edit (5MB max)' });
  res.json({ content: await fsp.readFile(f, 'utf8') });
}));
app.get('/api/servers/:id/files/download', wrap(async (req, res) => {
  const id = srv(req);
  res.download(safePath(id, req.query.path));
}));
app.post('/api/servers/:id/files/write', wrap(async (req, res) => {
  const id = srv(req);
  const f = safePath(id, req.body.path);
  await fsp.mkdir(path.dirname(f), { recursive: true });
  await fsp.writeFile(f, req.body.content ?? '');
  res.json({ ok: true });
}));
app.post('/api/servers/:id/files/mkdir', wrap(async (req, res) => {
  const id = srv(req);
  await fsp.mkdir(safePath(id, req.body.path), { recursive: true });
  res.json({ ok: true });
}));
app.post('/api/servers/:id/files/rename', wrap(async (req, res) => {
  const id = srv(req);
  await fsp.rename(safePath(id, req.body.from), safePath(id, req.body.to));
  res.json({ ok: true });
}));
app.post('/api/servers/:id/files/delete', wrap(async (req, res) => {
  const id = srv(req);
  for (const p of req.body.paths || []) {
    const f = safePath(id, p);
    if (f === path.join(DATA, id)) continue;
    await fsp.rm(f, { recursive: true, force: true });
  }
  res.json({ ok: true });
}));
const upload = multer({ dest: path.join(os.tmpdir(), 'redpanel-up'), limits: { fileSize: 1024 * 1048576 } });
app.post('/api/servers/:id/files/upload', upload.array('files'), wrap(async (req, res) => {
  const id = srv(req);
  const dir = safePath(id, req.query.path);
  await fsp.mkdir(dir, { recursive: true });
  for (const f of req.files || []) {
    const dest = safePath(id, path.posix.join(req.query.path || '/', path.basename(f.originalname)));
    await fsp.copyFile(f.path, dest); await fsp.rm(f.path, { force: true });
  }
  res.json({ ok: true, count: (req.files || []).length });
}));

// download a plugin/mod jar from a URL straight into the server folder
app.post('/api/servers/:id/download', wrap(async (req, res) => {
  const id = srv(req);
  const { url, folder, filename } = req.body;
  if (!/^https:\/\/cdn\.modrinth\.com\//.test(url || '')) return res.status(400).json({ error: 'Only Modrinth CDN downloads allowed' });
  if (!/^[\w.+\-() ]+\.jar$/.test(filename || '')) return res.status(400).json({ error: 'bad filename' });
  const dir = safePath(id, folder);
  await fsp.mkdir(dir, { recursive: true });
  const r = await fetch(url);
  if (!r.ok) return res.status(502).json({ error: 'Download failed: ' + r.status });
  await pipeline(Readable.fromWeb(r.body), fs.createWriteStream(path.join(dir, filename)));
  res.json({ ok: true });
}));

// ---------- console websocket ----------
const server = http.createServer(app);
const wss = new WebSocketServer({ noServer: true });
server.on('upgrade', (req, socket, head) => {
  const u = new URL(req.url, 'http://x');
  const m = /^\/api\/servers\/([a-f0-9-]{36})\/console$/.exec(u.pathname);
  if (!m || !tokenOk(u.searchParams.get('token')) || !meta[m[1]]) { socket.destroy(); return; }
  wss.handleUpgrade(req, socket, head, (ws) => onConsole(ws, m[1]));
});

async function onConsole(ws, id) {
  const say = (t) => { if (ws.readyState === 1) ws.send(t); };
  ws.on('message', (msg) => {
    try { const d = JSON.parse(msg); if (d.type === 'cmd') sendCommand(id, d.data).catch((e) => say('\x1b[31m[RedPanel] ' + e.message + '\n')); } catch {}
  });
  const ex = await getContainer(id);
  if (!ex) {
    say(runtime[id]?.installing ? '[RedPanel] Server is installing (downloading Docker image)...\n' : '[RedPanel] Container not found.\n');
    setTimeout(() => ws.close(), 4000);
    return;
  }
  try {
    const stream = await ex.c.logs({ follow: true, stdout: true, stderr: true, tail: 300 });
    const out = new PassThrough();
    docker.modem.demuxStream(stream, out, out);
    out.on('data', (d) => say(d.toString('utf8')));
    stream.on('end', () => { say('[RedPanel] Server is offline.\n'); setTimeout(() => ws.close(), 3000); });
    ws.on('close', () => { try { stream.destroy(); } catch {} });
  } catch (e) { say('[RedPanel] ' + e.message + '\n'); ws.close(); }
}

server.listen(PORT, cfg.host || '0.0.0.0', () => console.log(`[node] RedPanel daemon listening on :${PORT}`));
