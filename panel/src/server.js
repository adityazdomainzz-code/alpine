// RedPanel - Minecraft hosting panel
'use strict';
const express = require('express');
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const { WebSocketServer, WebSocket } = require('ws');
const { Readable } = require('stream');
const db = require('./db');

const CONFIG_FILE = path.join(__dirname, '..', 'config.json');
const cfg = fs.existsSync(CONFIG_FILE) ? JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')) : {};
const PORT = process.env.PORT || cfg.port || 8000;
const D = db.load();

// ---------- first boot seeding ----------
if (!D.users.length && cfg.admin && cfg.admin.username) {
  D.users.push({
    id: crypto.randomUUID(), username: cfg.admin.username, email: cfg.admin.email || '',
    password: bcrypt.hashSync(cfg.admin.password, 10), admin: true, createdAt: Date.now(),
  });
  console.log('[panel] admin user created:', cfg.admin.username);
}
if (cfg.localNode && cfg.localNode.token && !D.nodes.some((n) => n.local)) {
  D.nodes.push({
    id: crypto.randomUUID(), name: 'Local Node', local: true,
    url: cfg.localNode.url || 'http://127.0.0.1:8080', token: cfg.localNode.token,
    ip: cfg.localNode.publicIp || '127.0.0.1', portStart: 25565, portEnd: 25665, createdAt: Date.now(),
  });
  console.log('[panel] local node registered');
}
// strip the plain admin password from config after first boot
if (cfg.admin && cfg.admin.password) {
  delete cfg.admin.password;
  try { fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2)); } catch {}
}
db.save();

const SOFTWARE = ['fabric', 'forge', 'purpur', 'paper', 'spigot'];
const MAX_SUBDOMAINS = 2;

// ---------- helpers ----------
const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '12mb' }));

const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch((e) => {
  console.error('[panel]', req.method, req.path, e.message);
  res.status(e.status || 500).json({ error: e.message || 'Server error' });
});
const fail = (status, msg) => Object.assign(new Error(msg), { status });
const pubUser = (u) => u && ({ id: u.id, username: u.username, email: u.email, admin: !!u.admin, createdAt: u.createdAt });

function parseCookies(h) {
  const out = {};
  (h || '').split(';').forEach((p) => { const i = p.indexOf('='); if (i > 0) out[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim()); });
  return out;
}
function userFromReq(req) {
  const t = parseCookies(req.headers.cookie).rp_session;
  const s = t && D.sessions[t];
  if (!s || s.expires < Date.now()) return null;
  return D.users.find((u) => u.id === s.userId) || null;
}
const auth = (req, res, next) => { req.user = userFromReq(req); if (!req.user) return res.status(401).json({ error: 'Not logged in' }); next(); };
const admin = (req, res, next) => (req.user && req.user.admin ? next() : res.status(403).json({ error: 'Admin only' }));

function nodeById(id) { return D.nodes.find((n) => n.id === id); }
async function nodeReq(node, method, p, body, opts = {}) {
  if (!node) throw fail(500, 'Node not found');
  const headers = { Authorization: 'Bearer ' + node.token };
  let payload;
  if (body instanceof FormData) payload = body;
  else if (body !== undefined) { headers['Content-Type'] = 'application/json'; payload = JSON.stringify(body); }
  let r;
  try {
    r = await fetch(node.url.replace(/\/$/, '') + p, { method, headers, body: payload, signal: AbortSignal.timeout(opts.timeout || 20000) });
  } catch (e) { throw fail(502, `Node "${node.name}" is unreachable`); }
  if (opts.raw) return r;
  const text = await r.text();
  let j; try { j = JSON.parse(text); } catch { j = { raw: text }; }
  if (!r.ok) throw fail(r.status, j.error || `Node error ${r.status}`);
  return j;
}
function getServer(req) {
  const s = D.servers.find((x) => x.id === req.params.id);
  if (!s || (!req.user.admin && s.ownerId !== req.user.id)) throw fail(404, 'Server not found');
  return s;
}
function serverView(s) {
  const n = nodeById(s.nodeId);
  const owner = D.users.find((u) => u.id === s.ownerId);
  return {
    ...s, nodeName: n ? n.name : 'deleted node', address: n ? `${n.ip}:${s.port}` : '-',
    ownerName: owner ? owner.username : '-',
    subdomains: D.subdomains.filter((d) => d.serverId === s.id).map((d) => d.fqdn),
  };
}
function contentFolder(s) { return s.software === 'fabric' || s.software === 'forge' ? '/mods' : '/plugins'; }

// ---------- public ----------
app.get('/api/settings/public', (req, res) => res.json({ panelName: D.settings.panelName }));

app.post('/api/auth/login', wrap(async (req, res) => {
  const { username, password } = req.body || {};
  const u = D.users.find((x) => x.username.toLowerCase() === String(username || '').toLowerCase() || (x.email && x.email.toLowerCase() === String(username || '').toLowerCase()));
  if (!u || !bcrypt.compareSync(String(password || ''), u.password)) throw fail(401, 'Wrong username or password');
  const token = crypto.randomBytes(32).toString('hex');
  for (const [k, v] of Object.entries(D.sessions)) if (v.expires < Date.now()) delete D.sessions[k];
  D.sessions[token] = { userId: u.id, expires: Date.now() + 7 * 864e5 };
  db.save();
  res.setHeader('Set-Cookie', `rp_session=${token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${7 * 86400}${req.secure || req.headers['x-forwarded-proto'] === 'https' ? '; Secure' : ''}`);
  res.json({ user: pubUser(u) });
}));
app.post('/api/auth/logout', (req, res) => {
  const t = parseCookies(req.headers.cookie).rp_session;
  if (t) { delete D.sessions[t]; db.save(); }
  res.setHeader('Set-Cookie', 'rp_session=; Path=/; Max-Age=0');
  res.json({ ok: true });
});

// ---------- account ----------
app.get('/api/me', auth, (req, res) => res.json({ user: pubUser(req.user), panelName: D.settings.panelName, domain: D.cloudflare.domain, cloudflare: !!(D.cloudflare.apiToken && D.cloudflare.zoneId) }));
app.patch('/api/me', auth, wrap(async (req, res) => {
  const { email, currentPassword, newPassword } = req.body;
  if (email !== undefined) req.user.email = String(email).slice(0, 120);
  if (newPassword) {
    if (!bcrypt.compareSync(String(currentPassword || ''), req.user.password)) throw fail(400, 'Current password is wrong');
    if (String(newPassword).length < 6) throw fail(400, 'Password must be at least 6 characters');
    req.user.password = bcrypt.hashSync(String(newPassword), 10);
  }
  db.save();
  res.json({ user: pubUser(req.user) });
}));

// ---------- versions ----------
let versionCache = { at: 0, list: [] };
app.get('/api/versions', auth, wrap(async (req, res) => {
  if (Date.now() - versionCache.at > 3600e3) {
    try {
      const r = await fetch('https://piston-meta.mojang.com/mc/game/version_manifest_v2.json', { signal: AbortSignal.timeout(10000) });
      const j = await r.json();
      versionCache = { at: Date.now(), list: j.versions.filter((v) => v.type === 'release').map((v) => v.id) };
    } catch {
      if (!versionCache.list.length) versionCache.list = ['1.21.4', '1.21.1', '1.20.6', '1.20.4', '1.20.1', '1.19.4', '1.18.2', '1.16.5', '1.12.2', '1.8.9'];
    }
  }
  res.json(['LATEST', ...versionCache.list]);
}));

// ---------- servers (user) ----------
app.get('/api/servers', auth, (req, res) => {
  const list = D.servers.filter((s) => s.ownerId === req.user.id || (req.user.admin && req.query.all));
  res.json(list.map(serverView));
});
app.get('/api/servers/:id', auth, wrap(async (req, res) => res.json(serverView(getServer(req)))));
app.get('/api/servers/:id/status', auth, wrap(async (req, res) => {
  const s = getServer(req);
  res.json(await nodeReq(nodeById(s.nodeId), 'GET', `/api/servers/${s.id}/status`));
}));
app.post('/api/servers/:id/power', auth, wrap(async (req, res) => {
  const s = getServer(req);
  res.json(await nodeReq(nodeById(s.nodeId), 'POST', `/api/servers/${s.id}/power`, { action: req.body.action }, { timeout: 60000 }));
}));
app.post('/api/servers/:id/command', auth, wrap(async (req, res) => {
  const s = getServer(req);
  res.json(await nodeReq(nodeById(s.nodeId), 'POST', `/api/servers/${s.id}/command`, { command: req.body.command }));
}));

// settings: version / software / motd
app.patch('/api/servers/:id/settings', auth, wrap(async (req, res) => {
  const s = getServer(req);
  const patch = {};
  if (req.body.software !== undefined) {
    if (!SOFTWARE.includes(req.body.software)) throw fail(400, 'Unknown software');
    patch.software = req.body.software;
  }
  if (req.body.version !== undefined) {
    if (!/^[\w.\-]{1,32}$/.test(req.body.version)) throw fail(400, 'Bad version');
    patch.version = req.body.version;
  }
  if (req.body.motd !== undefined) patch.motd = String(req.body.motd).slice(0, 200);
  if (!Object.keys(patch).length) throw fail(400, 'Nothing to change');
  await nodeReq(nodeById(s.nodeId), 'PATCH', `/api/servers/${s.id}`, patch);
  Object.assign(s, patch);
  db.save();
  res.json(serverView(s));
}));

// files
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 200 * 1048576 } });
app.get('/api/servers/:id/files', auth, wrap(async (req, res) => {
  const s = getServer(req);
  res.json(await nodeReq(nodeById(s.nodeId), 'GET', `/api/servers/${s.id}/files?path=${encodeURIComponent(req.query.path || '/')}`));
}));
app.get('/api/servers/:id/files/content', auth, wrap(async (req, res) => {
  const s = getServer(req);
  res.json(await nodeReq(nodeById(s.nodeId), 'GET', `/api/servers/${s.id}/files/content?path=${encodeURIComponent(req.query.path)}`));
}));
app.get('/api/servers/:id/files/download', auth, wrap(async (req, res) => {
  const s = getServer(req);
  const r = await nodeReq(nodeById(s.nodeId), 'GET', `/api/servers/${s.id}/files/download?path=${encodeURIComponent(req.query.path)}`, undefined, { raw: true, timeout: 600000 });
  if (!r.ok) return res.status(r.status).json({ error: 'Download failed' });
  res.setHeader('Content-Type', r.headers.get('content-type') || 'application/octet-stream');
  if (!req.query.inline) res.setHeader('Content-Disposition', `attachment; filename="${path.basename(req.query.path).replace(/"/g, '')}"`);
  Readable.fromWeb(r.body).pipe(res);
}));
for (const action of ['write', 'mkdir', 'rename', 'delete']) {
  app.post(`/api/servers/:id/files/${action}`, auth, wrap(async (req, res) => {
    const s = getServer(req);
    res.json(await nodeReq(nodeById(s.nodeId), 'POST', `/api/servers/${s.id}/files/${action}`, req.body));
  }));
}
app.post('/api/servers/:id/files/upload', auth, upload.array('files'), wrap(async (req, res) => {
  const s = getServer(req);
  const fd = new FormData();
  for (const f of req.files || []) fd.append('files', new Blob([f.buffer]), f.originalname);
  res.json(await nodeReq(nodeById(s.nodeId), 'POST', `/api/servers/${s.id}/files/upload?path=${encodeURIComponent(req.query.path || '/')}`, fd, { timeout: 600000 }));
}));

// plugins / mods (Modrinth)
const LOADERS = { paper: ['paper', 'spigot', 'bukkit'], purpur: ['purpur', 'paper', 'spigot', 'bukkit'], spigot: ['spigot', 'bukkit'], fabric: ['fabric'], forge: ['forge'] };
app.get('/api/servers/:id/plugins', auth, wrap(async (req, res) => {
  const s = getServer(req);
  const folder = contentFolder(s);
  let files = [];
  try { files = await nodeReq(nodeById(s.nodeId), 'GET', `/api/servers/${s.id}/files?path=${encodeURIComponent(folder)}`); } catch {}
  res.json({ folder, type: folder === '/mods' ? 'mod' : 'plugin', installed: files.filter((f) => !f.dir && /\.jar(\.disabled)?$/i.test(f.name)) });
}));
app.get('/api/servers/:id/plugins/search', auth, wrap(async (req, res) => {
  const s = getServer(req);
  const type = contentFolder(s) === '/mods' ? 'mod' : 'plugin';
  const facets = [[`project_type:${type}`], LOADERS[s.software].map((l) => `categories:${l}`)];
  if (s.version && s.version !== 'LATEST') facets.push([`versions:${s.version}`]);
  const q = new URLSearchParams({ query: String(req.query.q || ''), limit: '20', index: req.query.q ? 'relevance' : 'downloads', facets: JSON.stringify(facets) });
  const r = await fetch('https://api.modrinth.com/v2/search?' + q, { headers: { 'User-Agent': 'RedPanel/1.0' }, signal: AbortSignal.timeout(10000) });
  if (!r.ok) throw fail(502, 'Modrinth search failed');
  const j = await r.json();
  res.json(j.hits.map((h) => ({ id: h.project_id, slug: h.slug, title: h.title, description: h.description, icon: h.icon_url, downloads: h.downloads, author: h.author })));
}));
app.post('/api/servers/:id/plugins/install', auth, wrap(async (req, res) => {
  const s = getServer(req);
  const pid = String(req.body.projectId || '');
  if (!/^[\w-]{4,64}$/.test(pid)) throw fail(400, 'bad project');
  const q = new URLSearchParams({ loaders: JSON.stringify(LOADERS[s.software]) });
  if (s.version && s.version !== 'LATEST') q.set('game_versions', JSON.stringify([s.version]));
  const r = await fetch(`https://api.modrinth.com/v2/project/${pid}/version?` + q, { headers: { 'User-Agent': 'RedPanel/1.0' }, signal: AbortSignal.timeout(10000) });
  const versions = r.ok ? await r.json() : [];
  if (!versions.length) throw fail(404, `No build of this ${contentFolder(s) === '/mods' ? 'mod' : 'plugin'} for ${s.software} ${s.version}`);
  const file = versions[0].files.find((f) => f.primary) || versions[0].files[0];
  await nodeReq(nodeById(s.nodeId), 'POST', `/api/servers/${s.id}/download`, { url: file.url, folder: contentFolder(s), filename: file.filename }, { timeout: 120000 });
  res.json({ ok: true, filename: file.filename });
}));

// ---------- Cloudflare subdomains (max 2 per user) ----------
async function cf(method, p, body) {
  const c = D.cloudflare;
  if (!c.apiToken || !c.zoneId) throw fail(400, 'Cloudflare is not connected yet (Admin → Cloudflare)');
  const r = await fetch(`https://api.cloudflare.com/client/v4/zones/${c.zoneId}${p}`, {
    method, headers: { Authorization: 'Bearer ' + c.apiToken, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(15000),
  });
  const j = await r.json().catch(() => ({}));
  if (!j.success) throw fail(400, 'Cloudflare: ' + ((j.errors || []).map((e) => e.message).join(', ') || r.status));
  return j.result;
}
app.get('/api/subdomains', auth, (req, res) => {
  res.json({ max: MAX_SUBDOMAINS, domain: D.cloudflare.domain, list: D.subdomains.filter((d) => d.userId === req.user.id) });
});
app.post('/api/servers/:id/subdomains', auth, wrap(async (req, res) => {
  const s = getServer(req);
  const name = String(req.body.name || '').toLowerCase().trim();
  if (!/^[a-z0-9]([a-z0-9-]{0,30}[a-z0-9])?$/.test(name)) throw fail(400, 'Use only a-z, 0-9 and "-" (max 32 chars)');
  if (['www', 'panel', 'mail', 'api', 'node', 'admin'].includes(name)) throw fail(400, 'That name is reserved');
  if (!req.user.admin && D.subdomains.filter((d) => d.userId === req.user.id).length >= MAX_SUBDOMAINS) throw fail(400, `You can create maximum ${MAX_SUBDOMAINS} subdomains`);
  const fqdn = `${name}.${D.cloudflare.domain}`;
  if (D.subdomains.some((d) => d.fqdn === fqdn)) throw fail(400, 'Subdomain already taken');
  const node = nodeById(s.nodeId);
  const isIp = /^\d+\.\d+\.\d+\.\d+$/.test(node.ip);
  const a = isIp
    ? await cf('POST', '/dns_records', { type: 'A', name: fqdn, content: node.ip, proxied: false, ttl: 1, comment: 'RedPanel' })
    : await cf('POST', '/dns_records', { type: 'CNAME', name: fqdn, content: node.ip, proxied: false, ttl: 1, comment: 'RedPanel' });
  let srvRec;
  try {
    srvRec = await cf('POST', '/dns_records', { type: 'SRV', name: `_minecraft._tcp.${fqdn}`, data: { priority: 0, weight: 5, port: s.port, target: fqdn }, ttl: 1, comment: 'RedPanel' });
  } catch (e) { await cf('DELETE', `/dns_records/${a.id}`).catch(() => {}); throw e; }
  const rec = { id: crypto.randomUUID(), name, fqdn, serverId: s.id, userId: req.user.id, recordIds: [a.id, srvRec.id], createdAt: Date.now() };
  D.subdomains.push(rec);
  db.save();
  res.json(rec);
}));
async function removeSubdomain(rec) {
  for (const rid of rec.recordIds || []) await cf('DELETE', `/dns_records/${rid}`).catch(() => {});
  D.subdomains = D.subdomains.filter((d) => d.id !== rec.id);
}
app.delete('/api/subdomains/:sid', auth, wrap(async (req, res) => {
  const rec = D.subdomains.find((d) => d.id === req.params.sid && (d.userId === req.user.id || req.user.admin));
  if (!rec) throw fail(404, 'Not found');
  await removeSubdomain(rec);
  db.save();
  res.json({ ok: true });
}));

// ---------- ADMIN ----------
app.get('/api/admin/overview', auth, admin, (req, res) => {
  res.json({ users: D.users.length, servers: D.servers.length, nodes: D.nodes.length, subdomains: D.subdomains.length });
});

// settings (only admin can rename the panel)
app.get('/api/admin/settings', auth, admin, (req, res) => res.json(D.settings));
app.put('/api/admin/settings', auth, admin, wrap(async (req, res) => {
  const name = String(req.body.panelName || '').trim();
  if (!name || name.length > 40) throw fail(400, 'Panel name must be 1-40 characters');
  D.settings.panelName = name;
  db.save();
  res.json(D.settings);
}));

// cloudflare
app.get('/api/admin/cloudflare', auth, admin, (req, res) => {
  const c = D.cloudflare;
  res.json({ zoneId: c.zoneId, domain: c.domain, hasToken: !!c.apiToken, tokenHint: c.apiToken ? '••••' + c.apiToken.slice(-4) : '', subdomains: D.subdomains.map((d) => ({ ...d, owner: (D.users.find((u) => u.id === d.userId) || {}).username, server: (D.servers.find((s) => s.id === d.serverId) || {}).name })) });
});
app.put('/api/admin/cloudflare', auth, admin, wrap(async (req, res) => {
  const { apiToken, zoneId, domain } = req.body;
  if (apiToken) D.cloudflare.apiToken = String(apiToken).trim();
  if (zoneId !== undefined) D.cloudflare.zoneId = String(zoneId).trim();
  if (domain !== undefined) D.cloudflare.domain = String(domain).trim().toLowerCase().replace(/^\*?\./, '');
  db.save();
  res.json({ ok: true });
}));
app.post('/api/admin/cloudflare/test', auth, admin, wrap(async (req, res) => {
  const z = await cf('GET', '');
  if (!D.cloudflare.domain) { D.cloudflare.domain = z.name; db.save(); }
  res.json({ ok: true, zone: z.name, status: z.status });
}));
app.delete('/api/admin/cloudflare', auth, admin, (req, res) => {
  D.cloudflare = { apiToken: '', zoneId: '', domain: '' };
  db.save();
  res.json({ ok: true });
});

// nodes
app.get('/api/admin/nodes', auth, admin, wrap(async (req, res) => {
  const out = await Promise.all(D.nodes.map(async (n) => {
    let system = null;
    try { system = await nodeReq(n, 'GET', '/api/system', undefined, { timeout: 5000 }); } catch {}
    return { id: n.id, name: n.name, url: n.url, ip: n.ip, portStart: n.portStart, portEnd: n.portEnd, local: !!n.local, online: !!system, system, servers: D.servers.filter((s) => s.nodeId === n.id).length };
  }));
  res.json(out);
}));
app.post('/api/admin/nodes', auth, admin, wrap(async (req, res) => {
  const { name, url, token, ip, portStart, portEnd } = req.body;
  if (!name || !/^https?:\/\/.+/.test(url || '') || !token || !ip) throw fail(400, 'Name, daemon URL, token and public IP are required');
  const n = { id: crypto.randomUUID(), name: String(name).slice(0, 40), url: url.replace(/\/$/, ''), token, ip: String(ip).trim(), portStart: +portStart || 25565, portEnd: +portEnd || 25665, createdAt: Date.now() };
  await nodeReq(n, 'GET', '/api/system', undefined, { timeout: 6000 });
  D.nodes.push(n);
  db.save();
  res.json({ id: n.id });
}));
app.patch('/api/admin/nodes/:nid', auth, admin, wrap(async (req, res) => {
  const n = nodeById(req.params.nid);
  if (!n) throw fail(404, 'Node not found');
  for (const k of ['name', 'url', 'token', 'ip']) if (req.body[k]) n[k] = String(req.body[k]).trim();
  if (req.body.portStart) n.portStart = +req.body.portStart;
  if (req.body.portEnd) n.portEnd = +req.body.portEnd;
  db.save();
  res.json({ ok: true });
}));
app.delete('/api/admin/nodes/:nid', auth, admin, wrap(async (req, res) => {
  if (D.servers.some((s) => s.nodeId === req.params.nid)) throw fail(400, 'Delete the servers on this node first');
  D.nodes = D.nodes.filter((n) => n.id !== req.params.nid);
  db.save();
  res.json({ ok: true });
}));
app.get('/api/admin/nodes/:nid/allocations', auth, admin, (req, res) => {
  const n = nodeById(req.params.nid);
  if (!n) return res.status(404).json({ error: 'Node not found' });
  const used = new Set(D.servers.filter((s) => s.nodeId === n.id).map((s) => s.port));
  const free = [];
  for (let p = n.portStart; p <= n.portEnd; p++) if (!used.has(p)) free.push({ ip: n.ip, port: p });
  res.json(free);
});

// servers
app.get('/api/admin/servers', auth, admin, (req, res) => res.json(D.servers.map(serverView)));
app.post('/api/admin/servers', auth, admin, wrap(async (req, res) => {
  const { name, ownerId, nodeId, port, software, version, memory, motd } = req.body;
  if (!name || String(name).length > 40) throw fail(400, 'Server name required (max 40)');
  const owner = D.users.find((u) => u.id === ownerId);
  if (!owner) throw fail(400, 'Select an owner');
  const node = nodeById(nodeId);
  if (!node) throw fail(400, 'Select a node');
  const p = +port;
  if (!(p >= node.portStart && p <= node.portEnd)) throw fail(400, 'Select an allocation (IP:port)');
  if (D.servers.some((s) => s.nodeId === node.id && s.port === p)) throw fail(400, 'Port already in use');
  if (!SOFTWARE.includes(software)) throw fail(400, 'Select software');
  const s = {
    id: crypto.randomUUID(), name: String(name), ownerId, nodeId, port: p, software,
    version: version || 'LATEST', memory: Math.max(512, +memory || 2048), motd: motd || `${name} - powered by ${D.settings.panelName}`, createdAt: Date.now(),
  };
  await nodeReq(node, 'POST', '/api/servers', s);
  D.servers.push(s);
  db.save();
  res.json(serverView(s));
}));
app.patch('/api/admin/servers/:id', auth, admin, wrap(async (req, res) => {
  const s = D.servers.find((x) => x.id === req.params.id);
  if (!s) throw fail(404, 'Not found');
  if (req.body.name) s.name = String(req.body.name).slice(0, 40);
  if (req.body.ownerId && D.users.some((u) => u.id === req.body.ownerId)) s.ownerId = req.body.ownerId;
  if (req.body.memory) { s.memory = Math.max(512, +req.body.memory); await nodeReq(nodeById(s.nodeId), 'PATCH', `/api/servers/${s.id}`, { memory: s.memory }); }
  db.save();
  res.json(serverView(s));
}));
app.delete('/api/admin/servers/:id', auth, admin, wrap(async (req, res) => {
  const s = D.servers.find((x) => x.id === req.params.id);
  if (!s) throw fail(404, 'Not found');
  try { await nodeReq(nodeById(s.nodeId), 'DELETE', `/api/servers/${s.id}`, undefined, { timeout: 60000 }); }
  catch (e) { if (!req.query.force) throw fail(e.status || 502, e.message + ' (use force delete to remove from panel anyway)'); }
  for (const d of D.subdomains.filter((x) => x.serverId === s.id)) await removeSubdomain(d).catch(() => {});
  D.servers = D.servers.filter((x) => x.id !== s.id);
  db.save();
  res.json({ ok: true });
}));

// users
app.get('/api/admin/users', auth, admin, (req, res) => res.json(D.users.map((u) => ({ ...pubUser(u), servers: D.servers.filter((s) => s.ownerId === u.id).length }))));
app.post('/api/admin/users', auth, admin, wrap(async (req, res) => {
  const { username, email, password, admin: isAdmin } = req.body;
  if (!/^[\w.-]{3,24}$/.test(username || '')) throw fail(400, 'Username: 3-24 letters, numbers, _ . -');
  if (D.users.some((u) => u.username.toLowerCase() === username.toLowerCase())) throw fail(400, 'Username taken');
  if (!password || password.length < 6) throw fail(400, 'Password must be at least 6 characters');
  const u = { id: crypto.randomUUID(), username, email: email || '', password: bcrypt.hashSync(password, 10), admin: !!isAdmin, createdAt: Date.now() };
  D.users.push(u);
  db.save();
  res.json(pubUser(u));
}));
app.patch('/api/admin/users/:uid', auth, admin, wrap(async (req, res) => {
  const u = D.users.find((x) => x.id === req.params.uid);
  if (!u) throw fail(404, 'User not found');
  if (req.body.email !== undefined) u.email = String(req.body.email);
  if (req.body.password) { if (req.body.password.length < 6) throw fail(400, 'Password too short'); u.password = bcrypt.hashSync(req.body.password, 10); }
  if (req.body.admin !== undefined) {
    if (u.id === req.user.id && !req.body.admin) throw fail(400, 'You cannot remove your own admin');
    u.admin = !!req.body.admin;
  }
  db.save();
  res.json(pubUser(u));
}));
app.delete('/api/admin/users/:uid', auth, admin, wrap(async (req, res) => {
  if (req.params.uid === req.user.id) throw fail(400, 'You cannot delete yourself');
  if (D.servers.some((s) => s.ownerId === req.params.uid)) throw fail(400, 'This user still owns servers');
  for (const d of D.subdomains.filter((x) => x.userId === req.params.uid)) await removeSubdomain(d).catch(() => {});
  D.users = D.users.filter((u) => u.id !== req.params.uid);
  for (const [k, v] of Object.entries(D.sessions)) if (v.userId === req.params.uid) delete D.sessions[k];
  db.save();
  res.json({ ok: true });
}));

// ---------- static ----------
app.get('/health', (req, res) => res.json({ ok: true }));
app.use(express.static(path.join(__dirname, '..', 'public'), { index: 'index.html', maxAge: '1h' }));
app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'index.html')));

// ---------- console websocket proxy ----------
const server = http.createServer(app);
const wss = new WebSocketServer({ noServer: true });
server.on('upgrade', (req, socket, head) => {
  const m = /^\/ws\/servers\/([a-f0-9-]{36})\/console/.exec(req.url);
  const user = userFromReq(req);
  const s = m && D.servers.find((x) => x.id === m[1]);
  if (!user || !s || (!user.admin && s.ownerId !== user.id)) { socket.destroy(); return; }
  wss.handleUpgrade(req, socket, head, (client) => {
    const node = nodeById(s.nodeId);
    const wsUrl = node.url.replace(/^http/, 'ws') + `/api/servers/${s.id}/console?token=${encodeURIComponent(node.token)}`;
    const upstream = new WebSocket(wsUrl);
    upstream.on('message', (d) => client.readyState === 1 && client.send(d.toString()));
    upstream.on('close', () => client.close());
    upstream.on('error', () => { if (client.readyState === 1) client.send('[RedPanel] Cannot reach node.\n'); client.close(); });
    client.on('message', (d) => upstream.readyState === 1 && upstream.send(d.toString()));
    client.on('close', () => upstream.close());
  });
});

server.listen(PORT, cfg.host || '0.0.0.0', () => console.log(`[panel] ${D.settings.panelName} running on http://0.0.0.0:${PORT}`));
