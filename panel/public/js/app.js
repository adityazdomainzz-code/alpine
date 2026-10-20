/* RedPanel front-end (no build step, vanilla JS) */
'use strict';
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmtBytes = (b) => { if (!b) return '0 B'; const u = ['B', 'KB', 'MB', 'GB', 'TB']; const i = Math.min(4, Math.floor(Math.log(b) / Math.log(1024))); return (b / 1024 ** i).toFixed(i ? 1 : 0) + ' ' + u[i]; };
const fmtDate = (t) => (t ? new Date(t).toLocaleString() : '-');

const I = {
  server: '<path d="M4 4h16v6H4zM4 14h16v6H4z"/><circle cx="8" cy="7" r=".6" fill="currentColor"/><circle cx="8" cy="17" r=".6" fill="currentColor"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/>',
  shield: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/>',
  node: '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2 20c0-3.5 3-5.5 7-5.5s7 2 7 5.5"/><path d="M16 4.5a3.5 3.5 0 010 7M18 14.6c2.4.6 4 2.4 4 5.4"/>',
  cloud: '<path d="M7 18a5 5 0 01-.6-9.96A6 6 0 0118 9a4.5 4.5 0 01-.5 9z"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z"/>',
  home: '<path d="M3 11l9-8 9 8v9a1 1 0 01-1 1h-5v-6H9v6H4a1 1 0 01-1-1z"/>',
  logout: '<path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"/>',
  menu: '<path d="M3 6h18M3 12h18M3 18h18"/>',
  x: '<path d="M18 6L6 18M6 6l12 12"/>',
  terminal: '<path d="M4 17l6-6-6-6M12 19h8"/>',
  folder: '<path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>',
  file: '<path d="M14 3H6a2 2 0 00-2 2v14a2 2 0 002 2h12a2 2 0 002-2V9z"/><path d="M14 3v6h6"/>',
  puzzle: '<path d="M10 3h4v3a2 2 0 104 0V3h3v7h-3a2 2 0 100 4h3v7h-7v-3a2 2 0 10-4 0v3H3v-7h3a2 2 0 100-4H3V3z"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 010 18M12 3a14 14 0 000 18"/>',
  tag: '<path d="M20.6 13.4L13.4 20.6a2 2 0 01-2.8 0L3 13V3h10l7.6 7.6a2 2 0 010 2.8z"/><circle cx="7.5" cy="7.5" r="1.2" fill="currentColor"/>',
  box: '<path d="M21 8l-9-5-9 5 9 5 9-5zM3 8v8l9 5 9-5V8M12 13v8"/>',
  image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/>',
  chat: '<path d="M21 12a8 8 0 01-11.6 7.1L3 21l1.9-6.4A8 8 0 1121 12z"/>',
  play: '<path d="M6 4l14 8-14 8z"/>',
  stop: '<rect x="5" y="5" width="14" height="14" rx="2"/>',
  refresh: '<path d="M21 12a9 9 0 11-3-6.7L21 8M21 3v5h-5"/>',
  zap: '<path d="M13 2L3 14h9l-1 8 10-12h-9z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  trash: '<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/>',
  upload: '<path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12"/>',
  download: '<path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/>',
  edit: '<path d="M12 20h9M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>',
  arrowUp: '<path d="M12 19V5M5 12l7-7 7 7"/>',
};
const icon = (n) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${I[n] || ''}</svg>`;
const FLOWER = '<svg viewBox="0 0 100 100"><g fill="#d90429"><circle cx="50" cy="25" r="20"/><circle cx="75" cy="45" r="20"/><circle cx="65" cy="75" r="20"/><circle cx="35" cy="75" r="20"/><circle cx="25" cy="45" r="20"/></g><circle cx="50" cy="52" r="12" fill="#fff"/></svg>';

const SOFTWARE = {
  paper: { name: 'Paper', desc: 'Fast, plugins (recommended)' },
  purpur: { name: 'Purpur', desc: 'Paper fork, extra features' },
  spigot: { name: 'Spigot', desc: 'Classic Bukkit plugins' },
  fabric: { name: 'Fabric', desc: 'Lightweight mods' },
  forge: { name: 'Forge', desc: 'Big modpacks' },
};

// ---------- api ----------
async function api(method, url, body) {
  const opt = { method, headers: {} };
  if (body instanceof FormData) opt.body = body;
  else if (body !== undefined) { opt.headers['Content-Type'] = 'application/json'; opt.body = JSON.stringify(body); }
  const r = await fetch(url, opt);
  let j = null; try { j = await r.json(); } catch {}
  if (r.status === 401 && !url.includes('/auth/')) { state.me = null; render(); }
  if (!r.ok) throw new Error((j && j.error) || 'Request failed (' + r.status + ')');
  return j;
}
function toast(msg, ok) {
  const t = document.createElement('div');
  t.className = 'toast' + (ok ? ' ok' : '');
  t.textContent = msg;
  $('#toasts').appendChild(t);
  setTimeout(() => t.remove(), 4200);
}
async function act(btn, fn, okMsg) {
  if (btn) btn.disabled = true;
  try { const r = await fn(); if (okMsg) toast(okMsg, true); return r; }
  catch (e) { toast(e.message); throw e; }
  finally { if (btn) btn.disabled = false; }
}
function modal({ title, body, footer, wide, onMount }) {
  const root = $('#modal-root');
  root.innerHTML = `<div class="modal-bg"><div class="modal ${wide ? 'wide' : ''}"><div class="modal-h"><h3>${esc(title)}</h3><button class="icon-btn" data-close>${icon('x')}</button></div><div class="modal-b">${body}</div>${footer ? `<div class="modal-f">${footer}</div>` : ''}</div></div>`;
  const bg = root.firstElementChild;
  const close = () => { root.innerHTML = ''; };
  bg.addEventListener('mousedown', (e) => { if (e.target === bg) close(); });
  $$('[data-close]', bg).forEach((b) => (b.onclick = close));
  if (onMount) onMount(bg, close);
  const f = $('input,select,textarea', bg); if (f) f.focus();
  return close;
}
function confirmBox(title, text, okLabel = 'Delete') {
  return new Promise((res) => {
    modal({
      title, body: `<p style="margin:0">${text}</p>`,
      footer: `<button class="btn ghost" data-close>Cancel</button><button class="btn" id="cf-ok">${esc(okLabel)}</button>`,
      onMount: (el, close) => { $('#cf-ok', el).onclick = () => { close(); res(true); }; $$('[data-close]', el).forEach((b) => b.addEventListener('click', () => res(false))); },
    });
  });
}
const formData = (form) => Object.fromEntries(new FormData(form).entries());

// ---------- state / router ----------
const state = { me: null, panelName: 'RedPanel', servers: [], cleanup: [], flowers: null };
function cleanup() { state.cleanup.forEach((f) => { try { f(); } catch {} }); state.cleanup = []; }
const route = () => (location.hash.replace(/^#\/?/, '') || 'servers').split('/');

window.addEventListener('hashchange', () => { document.body.classList.remove('nav-open'); render(); });

async function boot() {
  try {
    const j = await api('GET', '/api/me');
    state.me = j.user; state.panelName = j.panelName; state.registration = j.registration; state.domain = j.domain; state.cfOn = j.cloudflare;
  } catch {
    try { const p = await api('GET', '/api/settings/public'); state.panelName = p.panelName; state.registration = p.registration; } catch {}
  }
  render();
}

function render() {
  cleanup();
  document.title = state.panelName;
  if (!state.me) return renderLogin();
  if (!$('.layout')) renderShell();
  renderNav();
  const [a, b, c] = route();
  const main = $('#content');
  main.innerHTML = '<div class="boot" style="height:50vh"><div class="spinner"></div></div>';
  const pages = {
    servers: pageServers, server: () => pageServer(b, c || 'console'), account: pageAccount,
    admin: () => {
      if (!state.me.admin) return pageServers();
      return ({ overview: pageAdminOverview, nodes: pageNodes, servers: pageAdminServers, users: pageUsers, cloudflare: pageCloudflare, settings: pageSettings }[b || 'overview'] || pageAdminOverview)();
    },
  };
  (pages[a] || pageServers)().catch((e) => { main.innerHTML = `<div class="card"><h3>Error</h3><p class="muted">${esc(e.message)}</p></div>`; });
}

// ---------- login ----------
function renderLogin(mode = 'login') {
  if (state.flowers) { state.flowers.stop(); state.flowers = null; }
  const reg = mode === 'register' && state.registration;
  $('#app').innerHTML = `
  <div class="login">
    <div class="login-art"><canvas></canvas>
      <h2>Host Minecraft<br>servers, beautifully.</h2>
      <p>Paper, Purpur, Spigot, Fabric & Forge on Docker. One click to start, free subdomains, full file manager.</p>
    </div>
    <div class="login-form"><form class="box" id="login">
      <div class="brand" style="padding:0 0 26px;color:var(--ink)"><div class="brand-mark" style="background:var(--red-soft)">${FLOWER}</div><div>${esc(state.panelName)}<small style="color:var(--muted)">Game Panel</small></div></div>
      ${reg ? `
      <h1>Create account</h1><p class="muted" style="margin:0 0 22px">Join ${esc(state.panelName)} in a few seconds.</p>
      <label class="f"><span>Username</span><input class="input" name="username" autocomplete="username" pattern="[A-Za-z0-9_.\\-]{3,24}" title="3-24 letters, numbers, _ . -" required></label>
      <label class="f"><span>Email</span><input class="input" type="email" name="email" autocomplete="email" required></label>
      <label class="f"><span>Password</span><input class="input" type="password" name="password" minlength="6" autocomplete="new-password" required></label>
      <label class="f"><span>Confirm password</span><input class="input" type="password" name="password2" minlength="6" autocomplete="new-password" required></label>
      <button class="btn" style="width:100%;padding:12px">Create account</button>
      <p class="muted" style="text-align:center;margin:18px 0 0;font-size:14px">Already have an account? <a href="#" id="to-login">Sign in</a></p>` : `
      <h1>Welcome back</h1><p class="muted" style="margin:0 0 22px">Sign in to manage your servers.</p>
      <label class="f"><span>Username or email</span><input class="input" name="username" autocomplete="username" required></label>
      <label class="f"><span>Password</span><input class="input" type="password" name="password" autocomplete="current-password" required></label>
      <button class="btn" style="width:100%;padding:12px">Sign in</button>
      ${state.registration ? `<p class="muted" style="text-align:center;margin:18px 0 0;font-size:14px">New here? <a href="#" id="to-register">Create an account</a></p>` : ''}`}
    </form></div>
  </div>`;
  state.flowers = FlowerRain($('.login-art canvas'), { count: 60 });
  if ($('#to-register')) $('#to-register').onclick = (e) => { e.preventDefault(); renderLogin('register'); };
  if ($('#to-login')) $('#to-login').onclick = (e) => { e.preventDefault(); renderLogin('login'); };
  $('#login').onsubmit = async (e) => {
    e.preventDefault();
    const d = formData(e.target);
    if (reg && d.password !== d.password2) return toast('Passwords do not match');
    await act($('#login button'), async () => {
      if (reg) { delete d.password2; await api('POST', '/api/auth/register', d); toast('Welcome! Your account is ready.', true); }
      else await api('POST', '/api/auth/login', d);
      $('#app').innerHTML = '';
      if (state.flowers) state.flowers.stop(); state.flowers = null;
      await boot();
    });
  };
}

// ---------- shell ----------
function renderShell() {
  $('#app').innerHTML = `
  <div class="layout">
    <aside class="sidebar"><canvas></canvas>
      <div class="brand"><div class="brand-mark">${FLOWER}</div><div><span id="panel-name">${esc(state.panelName)}</span><small>Game Panel</small></div></div>
      <nav class="nav" id="nav"></nav>
      <div class="side-user"><div class="avatar">${esc(state.me.username[0].toUpperCase())}</div>
        <div class="who"><b>${esc(state.me.username)}</b><span>${state.me.admin ? 'Administrator' : 'User'}</span></div>
        <button class="icon-btn" id="logout" title="Log out">${icon('logout')}</button></div>
    </aside>
    <div class="main">
      <div class="topbar"><button class="icon-btn" id="burger">${icon('menu')}</button><span id="panel-name-m">${esc(state.panelName)}</span></div>
      <div class="content" id="content"></div>
    </div>
  </div>`;
  state.flowers = FlowerRain($('.sidebar canvas'));
  $('#logout').onclick = async () => { await api('POST', '/api/auth/logout'); state.me = null; location.hash = ''; render(); };
  $('#burger').onclick = () => document.body.classList.toggle('nav-open');
  document.addEventListener('click', (e) => { if (document.body.classList.contains('nav-open') && !e.target.closest('.sidebar,#burger')) document.body.classList.remove('nav-open'); });
}
async function renderNav() {
  const [a, b, c] = route();
  const link = (href, ic, label, active) => `<a href="#/${href}" class="${active ? 'active' : ''}">${ic}<span class="truncate">${esc(label)}</span></a>`;
  try { state.servers = await api('GET', '/api/servers'); } catch {}
  let html = `<div class="nav-label">Servers</div>`;
  html += link('servers', icon('home'), 'All my servers', a === 'servers');
  html += state.servers.length ? state.servers.map((s) => link(`server/${s.id}`, '<i class="dot"></i>', s.name, a === 'server' && b === s.id)).join('') : '<div class="empty">No servers yet</div>';
  html += `<div class="nav-label">Account</div>` + link('account', icon('user'), 'Account info', a === 'account');
  if (state.me.admin) {
    html += `<div class="nav-label">Admin panel</div>`;
    html += link('admin/overview', icon('shield'), 'Overview', a === 'admin' && (!b || b === 'overview'));
    html += link('admin/nodes', icon('node'), 'Nodes', b === 'nodes');
    html += link('admin/servers', icon('server'), 'Servers', a === 'admin' && b === 'servers');
    html += link('admin/users', icon('users'), 'User management', b === 'users');
    html += link('admin/cloudflare', icon('cloud'), 'Cloudflare', b === 'cloudflare');
    html += link('admin/settings', icon('gear'), 'Settings', b === 'settings');
  }
  $('#nav').innerHTML = html;
}
function head(title, sub, actions = '', crumbs = '') {
  return `<div class="page-head"><div>${crumbs ? `<div class="crumbs">${crumbs}</div>` : ''}<h1>${esc(title)}</h1>${sub ? `<p>${sub}</p>` : ''}</div><div class="btn-row">${actions}</div></div>`;
}
function stateBadge(st) {
  const map = { running: 'ok', installing: 'warn', starting: 'warn', restarting: 'warn', created: 'off', exited: 'off', missing: '' };
  const label = { running: 'online', exited: 'offline', created: 'offline' }[st] || st || 'unknown';
  return `<span class="badge ${map[st] ?? ''}"><i class="pulse"></i>${esc(label)}</span>`;
}
function swIcon(s, withLogo = true) {
  const letter = (SOFTWARE[s.software]?.name || '?')[0];
  return `<div class="sw-icon" data-icon="${s.id}">${letter}</div>`;
}
function loadIcons(root) {
  $$('[data-icon]', root).forEach((el) => {
    const img = new Image();
    img.onload = () => { el.innerHTML = ''; el.appendChild(img); };
    img.src = `/api/servers/${el.dataset.icon}/files/download?path=/server-icon.png&inline=1&t=${Date.now()}`;
  });
}

// ---------- servers list ----------
async function pageServers() {
  const list = await api('GET', '/api/servers');
  const c = $('#content');
  c.innerHTML = head('My servers', `${list.length} server${list.length === 1 ? '' : 's'}`, state.me.admin ? `<a class="btn" href="#/admin/servers">${icon('plus')}Create server</a>` : '') +
    (list.length ? `<div class="grid g3">${list.map((s) => `
      <a class="card server-card" href="#/server/${s.id}">
        <div class="top"><div style="display:flex;gap:12px;align-items:center;min-width:0">${swIcon(s)}<div style="min-width:0"><h3 class="truncate">${esc(s.name)}</h3><span class="muted mono">${esc(s.subdomains[0] || s.address)}</span></div></div><span data-st="${s.id}"><span class="badge">…</span></span></div>
        <div class="meta"><span><b>${esc(SOFTWARE[s.software]?.name)}</b> ${esc(s.version)}</span><span><b>${s.memory}</b> MB</span><span>${esc(s.nodeName)}</span></div>
      </a>`).join('')}</div>`
      : `<div class="card empty-state">${icon('server')}<h3>No servers yet</h3><p>${state.me.admin ? 'Create your first server from the admin panel.' : 'Ask an admin to create a server for you.'}</p></div>`);
  loadIcons(c);
  list.forEach(async (s) => {
    try { const st = await api('GET', `/api/servers/${s.id}/status`); const el = $(`[data-st="${s.id}"]`); if (el) el.innerHTML = stateBadge(st.state); }
    catch { const el = $(`[data-st="${s.id}"]`); if (el) el.innerHTML = '<span class="badge">node offline</span>'; }
  });
}

// ---------- single server ----------
const TABS = [
  ['console', 'terminal', 'Console'], ['files', 'folder', 'File manager'], ['plugins', 'puzzle', 'Plugins'],
  ['subdomain', 'globe', 'Subdomain'], ['version', 'tag', 'Version'], ['software', 'box', 'Software'],
  ['logo', 'image', 'Server logo'], ['motd', 'chat', 'Server MOTD'],
];
async function pageServer(id, tab) {
  const s = await api('GET', `/api/servers/${id}`);
  const c = $('#content');
  const addr = s.subdomains[0] || s.address;
  c.innerHTML = head(s.name, `<span class="mono">${esc(addr)}</span> · ${esc(SOFTWARE[s.software]?.name)} ${esc(s.version)} · ${esc(s.nodeName)}`,
    `<button class="btn ghost sm" id="copy-ip">Copy IP</button>`, `<a href="#/servers">Servers</a> / ${esc(s.name)}`) +
    `<div class="tabs">${TABS.map(([k, ic, l]) => `<a href="#/server/${id}/${k}" class="${tab === k ? 'active' : ''}">${icon(ic)}${l}</a>`).join('')}</div><div id="tab"></div>`;
  $('#copy-ip').onclick = () => { navigator.clipboard?.writeText(addr); toast('Copied ' + addr, true); };
  const t = $('#tab');
  const fn = { console: tabConsole, files: tabFiles, plugins: tabPlugins, subdomain: tabSubdomain, version: tabVersion, software: tabSoftware, logo: tabLogo, motd: tabMotd }[tab] || tabConsole;
  await fn(s, t);
}

function tabConsole(s, t) {
  t.innerHTML = `
  <div class="grid g4" style="margin-bottom:18px">
    <div class="card stat"><div class="k">Status</div><div class="v" id="st-state" style="font-size:20px;margin-top:8px"><span class="badge">…</span></div></div>
    <div class="card stat"><div class="k">CPU</div><div class="v" id="st-cpu">0%</div></div>
    <div class="card stat"><div class="k">Memory</div><div class="v" id="st-mem">0 MB</div><div class="bar"><i id="st-membar" style="width:0"></i></div></div>
    <div class="card stat"><div class="k">Address</div><div class="v mono" style="font-size:15px;margin-top:10px;word-break:break-all">${esc(s.subdomains[0] || s.address)}</div></div>
  </div>
  <div class="btn-row" style="margin-bottom:12px">
    <button class="btn ok" data-p="start">${icon('play')}Start</button>
    <button class="btn" data-p="restart">${icon('refresh')}Restart</button>
    <button class="btn dark" data-p="stop">${icon('stop')}Stop</button>
    <button class="btn ghost" data-p="kill">${icon('zap')}Kill</button>
  </div>
  <div class="console" id="console"></div>
  <form class="console-input" id="cmd"><span>&gt;</span><input placeholder="Type a command, e.g. op Steve" autocomplete="off"></form>`;
  const out = $('#console');
  const write = (txt) => {
    const atBottom = out.scrollHeight - out.scrollTop - out.clientHeight < 40;
    txt.replace(/\x1b\[[0-9;]*[A-Za-z]/g, '').split(/\r?\n/).forEach((line, i, arr) => {
      if (i === arr.length - 1 && line === '') return;
      const d = document.createElement('div');
      d.className = /\[RedPanel\]/.test(line) ? 's' : /ERROR|SEVERE|Exception/.test(line) ? 'e' : /WARN/.test(line) ? 'w' : 'i';
      d.textContent = line;
      out.appendChild(d);
    });
    while (out.childElementCount > 1500) out.firstChild.remove();
    if (atBottom) out.scrollTop = out.scrollHeight;
  };
  let ws, closed = false, retry;
  const connect = () => {
    ws = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws/servers/${s.id}/console`);
    ws.onopen = () => { out.innerHTML = ''; };
    ws.onmessage = (e) => write(e.data);
    ws.onclose = () => { if (!closed) retry = setTimeout(connect, 3000); };
  };
  connect();
  $('#cmd').onsubmit = (e) => {
    e.preventDefault();
    const inp = $('#cmd input'); const v = inp.value.trim(); if (!v) return;
    if (ws && ws.readyState === 1) ws.send(JSON.stringify({ type: 'cmd', data: v }));
    else api('POST', `/api/servers/${s.id}/command`, { command: v }).catch((er) => toast(er.message));
    write('> ' + v + '\n'); inp.value = '';
  };
  $$('[data-p]', t).forEach((b) => (b.onclick = () => act(b, () => api('POST', `/api/servers/${s.id}/power`, { action: b.dataset.p }), 'Sent ' + b.dataset.p).then(() => setTimeout(() => { if (ws) ws.close(); poll(); }, 1200)).catch(() => {})));
  const poll = async () => {
    try {
      const st = await api('GET', `/api/servers/${s.id}/status`);
      $('#st-state').innerHTML = stateBadge(st.state) + (st.error ? `<div class="muted" style="font-size:12px;font-weight:400;margin-top:6px">${esc(st.error)}</div>` : '');
      $('#st-cpu').textContent = st.cpu + '%';
      $('#st-mem').textContent = fmtBytes(st.memory);
      $('#st-membar').style.width = Math.min(100, (st.memory / st.memLimit) * 100) + '%';
    } catch (e) { if ($('#st-state')) $('#st-state').innerHTML = '<span class="badge">node offline</span>'; }
  };
  poll();
  const iv = setInterval(poll, 4000);
  state.cleanup.push(() => { closed = true; clearInterval(iv); clearTimeout(retry); if (ws) ws.close(); });
}

async function tabFiles(s, t, startPath) {
  let cwd = startPath || '/';
  t.innerHTML = `<div class="card">
    <div style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:14px">
      <div class="path" id="path"></div>
      <div class="btn-row">
        <button class="btn ghost sm" id="f-newdir">${icon('folder')}New folder</button>
        <button class="btn ghost sm" id="f-newfile">${icon('file')}New file</button>
        <label class="btn sm">${icon('upload')}Upload<input type="file" multiple hidden id="f-up"></label>
      </div>
    </div>
    <div class="drop" id="drop" style="margin-bottom:14px">Drag & drop files here to upload</div>
    <div class="table-wrap"><table class="t"><thead><tr><th>Name</th><th>Size</th><th>Modified</th><th></th></tr></thead><tbody id="flist"></tbody></table></div>
  </div>`;
  const join = (a, b) => (a.replace(/\/$/, '') + '/' + b).replace(/\/+/g, '/');
  const load = async () => {
    const parts = cwd.split('/').filter(Boolean);
    $('#path').innerHTML = `<a href="#" data-go="/">/home/container</a>` + parts.map((p, i) => ` / <a href="#" data-go="/${parts.slice(0, i + 1).join('/')}">${esc(p)}</a>`).join('');
    $$('[data-go]', t).forEach((a) => (a.onclick = (e) => { e.preventDefault(); cwd = a.dataset.go; load(); }));
    const tb = $('#flist');
    tb.innerHTML = `<tr><td colspan="4" class="muted">Loading…</td></tr>`;
    let files;
    try { files = await api('GET', `/api/servers/${s.id}/files?path=${encodeURIComponent(cwd)}`); }
    catch (e) { tb.innerHTML = `<tr><td colspan="4" class="muted">${esc(e.message)}</td></tr>`; return; }
    const up = cwd !== '/' ? `<tr class="file-row" data-up><td><div class="fname">${icon('arrowUp')}..</div></td><td></td><td></td><td></td></tr>` : '';
    tb.innerHTML = up + (files.length ? files.map((f) => `
      <tr class="file-row" data-name="${esc(f.name)}" data-dir="${f.dir ? 1 : ''}">
        <td><div class="fname">${icon(f.dir ? 'folder' : 'file')}<span>${esc(f.name)}</span></div></td>
        <td class="muted">${f.dir ? '-' : fmtBytes(f.size)}</td><td class="muted">${fmtDate(f.mtime)}</td>
        <td class="right" style="white-space:nowrap">
          ${f.dir ? '' : `<button class="icon-btn" data-dl title="Download" style="color:var(--red)">${icon('download')}</button>`}
          <button class="icon-btn" data-rn title="Rename" style="color:var(--red)">${icon('edit')}</button>
          <button class="icon-btn" data-del title="Delete" style="color:var(--red)">${icon('trash')}</button>
        </td></tr>`).join('') : (up ? '' : `<tr><td colspan="4" class="muted">Empty folder — start the server once to generate files.</td></tr>`));
    const upRow = $('[data-up]', tb); if (upRow) upRow.onclick = () => { cwd = cwd.split('/').slice(0, -1).join('/') || '/'; load(); };
    $$('tr[data-name]', tb).forEach((tr) => {
      const name = tr.dataset.name, p = join(cwd, name);
      tr.onclick = (e) => { if (e.target.closest('button')) return; if (tr.dataset.dir) { cwd = p; load(); } else openEditor(p); };
      const dl = $('[data-dl]', tr); if (dl) dl.onclick = () => { location.href = `/api/servers/${s.id}/files/download?path=${encodeURIComponent(p)}`; };
      $('[data-rn]', tr).onclick = () => promptBox('Rename', 'New name', name, async (v) => { await api('POST', `/api/servers/${s.id}/files/rename`, { from: p, to: join(cwd, v) }); load(); });
      $('[data-del]', tr).onclick = async () => { if (await confirmBox('Delete ' + name + '?', 'This cannot be undone.')) act(null, () => api('POST', `/api/servers/${s.id}/files/delete`, { paths: [p] }), 'Deleted').then(load); };
    });
  };
  const openEditor = async (p) => {
    if (/\.(jar|zip|png|jpg|gz|dat|mca|db|exe|bin)$/i.test(p)) { location.href = `/api/servers/${s.id}/files/download?path=${encodeURIComponent(p)}`; return; }
    let content = '';
    try { content = (await api('GET', `/api/servers/${s.id}/files/content?path=${encodeURIComponent(p)}`)).content; } catch (e) { return toast(e.message); }
    modal({
      title: p, wide: true, body: `<textarea class="editor" spellcheck="false" id="ed"></textarea>`,
      footer: `<button class="btn ghost" data-close>Close</button><button class="btn" id="ed-save">Save file</button>`,
      onMount: (el, close) => {
        const ed = $('#ed', el); ed.value = content;
        ed.addEventListener('keydown', (e) => { if (e.key === 'Tab') { e.preventDefault(); ed.setRangeText('  ', ed.selectionStart, ed.selectionEnd, 'end'); } if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); $('#ed-save', el).click(); } });
        $('#ed-save', el).onclick = () => act($('#ed-save', el), () => api('POST', `/api/servers/${s.id}/files/write`, { path: p, content: ed.value }), 'Saved').then(load);
      },
    });
  };
  const uploadFiles = async (files) => {
    if (!files.length) return;
    const fd = new FormData(); [...files].forEach((f) => fd.append('files', f));
    toast(`Uploading ${files.length} file(s)…`, true);
    await act(null, () => api('POST', `/api/servers/${s.id}/files/upload?path=${encodeURIComponent(cwd)}`, fd), 'Uploaded').catch(() => {});
    load();
  };
  $('#f-up').onchange = (e) => uploadFiles(e.target.files);
  const drop = $('#drop');
  drop.ondragover = (e) => { e.preventDefault(); drop.classList.add('over'); };
  drop.ondragleave = () => drop.classList.remove('over');
  drop.ondrop = (e) => { e.preventDefault(); drop.classList.remove('over'); uploadFiles(e.dataTransfer.files); };
  $('#f-newdir').onclick = () => promptBox('New folder', 'Folder name', '', async (v) => { await api('POST', `/api/servers/${s.id}/files/mkdir`, { path: join(cwd, v) }); load(); });
  $('#f-newfile').onclick = () => promptBox('New file', 'File name', '', async (v) => { await api('POST', `/api/servers/${s.id}/files/write`, { path: join(cwd, v), content: '' }); load(); openEditor(join(cwd, v)); });
  load();
}
function promptBox(title, label, value, onOk) {
  modal({
    title, body: `<form id="pb"><label class="f"><span>${esc(label)}</span><input class="input" name="v" value="${esc(value)}" required></label></form>`,
    footer: `<button class="btn ghost" data-close>Cancel</button><button class="btn" form="pb">OK</button>`,
    onMount: (el, close) => { $('#pb', el).onsubmit = (e) => { e.preventDefault(); act(null, () => onOk(e.target.v.value.trim())).then(close).catch(() => {}); }; },
  });
}

async function tabPlugins(s, t) {
  const info = await api('GET', `/api/servers/${s.id}/plugins`);
  const word = info.type === 'mod' ? 'mods' : 'plugins';
  t.innerHTML = `<div class="grid g2" style="align-items:start">
    <div class="card"><h3>Installed ${word}</h3><p class="sub">Folder <span class="mono">${info.folder}</span> · restart the server after changes.</p>
      <label class="btn ghost sm" style="margin-bottom:12px">${icon('upload')}Upload .jar<input type="file" accept=".jar" multiple hidden id="pl-up"></label>
      <div class="list" id="pl-installed">${info.installed.length ? info.installed.map((f) => `
        <div class="plug"><div class="ph" style="display:grid;place-items:center;color:var(--red)">${icon('puzzle')}</div><div class="info"><b>${esc(f.name.replace(/\.jar(\.disabled)?$/, ''))}</b><p>${fmtBytes(f.size)}</p></div>
        <button class="icon-btn" style="color:var(--red)" data-rm="${esc(f.name)}">${icon('trash')}</button></div>`).join('') : `<div class="muted">No ${word} installed yet.</div>`}</div>
    </div>
    <div class="card"><h3>Browse ${word}</h3><p class="sub">From Modrinth, filtered for ${esc(SOFTWARE[s.software].name)} ${esc(s.version)}.</p>
      <form id="pl-search" class="input-group" style="margin-bottom:14px"><input class="input" name="q" placeholder="Search ${word}…"><button class="addon" style="cursor:pointer;color:var(--red)">${icon('search')}</button></form>
      <div class="list" id="pl-results"><div class="muted">Loading…</div></div>
    </div></div>`;
  const reload = () => tabPlugins(s, t);
  $('#pl-up').onchange = async (e) => {
    const fd = new FormData(); [...e.target.files].forEach((f) => fd.append('files', f));
    await act(null, () => api('POST', `/api/servers/${s.id}/files/upload?path=${encodeURIComponent(info.folder)}`, fd), 'Uploaded').catch(() => {});
    reload();
  };
  $$('[data-rm]', t).forEach((b) => (b.onclick = async () => {
    if (await confirmBox('Remove ' + b.dataset.rm + '?', 'The file will be deleted.', 'Remove')) act(b, () => api('POST', `/api/servers/${s.id}/files/delete`, { paths: [info.folder + '/' + b.dataset.rm] }), 'Removed').then(reload);
  }));
  const search = async (q) => {
    const box = $('#pl-results');
    box.innerHTML = '<div class="muted">Searching…</div>';
    try {
      const hits = await api('GET', `/api/servers/${s.id}/plugins/search?q=${encodeURIComponent(q || '')}`);
      box.innerHTML = hits.length ? hits.map((h) => `
        <div class="plug">${h.icon ? `<img src="${esc(h.icon)}" alt="" loading="lazy">` : '<div class="ph"></div>'}
          <div class="info"><b>${esc(h.title)}</b><p title="${esc(h.description)}">${esc(h.description)}</p><p>${(h.downloads / 1000).toFixed(0)}k downloads · ${esc(h.author)}</p></div>
          <button class="btn sm" data-inst="${esc(h.id)}">Install</button></div>`).join('') : '<div class="muted">Nothing found.</div>';
      $$('[data-inst]', box).forEach((b) => (b.onclick = () => act(b, () => api('POST', `/api/servers/${s.id}/plugins/install`, { projectId: b.dataset.inst }), 'Installed! Restart to load it.').then(reload).catch(() => {})));
    } catch (e) { box.innerHTML = `<div class="muted">${esc(e.message)}</div>`; }
  };
  $('#pl-search').onsubmit = (e) => { e.preventDefault(); search(e.target.q.value); };
  search('');
}

async function tabSubdomain(s, t) {
  const sd = await api('GET', '/api/subdomains');
  const mine = sd.list.filter((d) => d.serverId === s.id);
  const used = sd.list.length;
  if (!sd.domain) { t.innerHTML = `<div class="card empty-state">${icon('cloud')}<h3>Subdomains are not set up</h3><p>${state.me.admin ? 'Connect Cloudflare in <a href="#/admin/cloudflare">Admin → Cloudflare</a> first.' : 'The admin has not connected Cloudflare yet.'}</p></div>`; return; }
  t.innerHTML = `<div class="grid g2" style="align-items:start">
    <div class="card"><h3>Create subdomain</h3><p class="sub">Players can join with a name instead of IP:port. You have used <b>${used}/${sd.max}</b>.</p>
      <form id="sd-form"><label class="f"><span>Subdomain</span><div class="input-group"><input class="input" name="name" placeholder="myserver" pattern="[a-zA-Z0-9-]+" required ${used >= sd.max && !state.me.admin ? 'disabled' : ''}><span class="addon">.${esc(sd.domain)}</span></div>
      <small>Creates an A + SRV record on Cloudflare (DNS only) pointing to ${esc(s.address)}.</small></label>
      <button class="btn" ${used >= sd.max && !state.me.admin ? 'disabled' : ''}>${icon('plus')}Create</button></form>
      ${used >= sd.max && !state.me.admin ? `<div class="alert" style="margin:14px 0 0">Limit reached — delete one to create another.</div>` : ''}
    </div>
    <div class="card"><h3>This server's subdomains</h3><p class="sub">DNS can take a minute to work.</p>
      <div class="list">${mine.length ? mine.map((d) => `<div class="plug"><div class="ph" style="display:grid;place-items:center;color:var(--red)">${icon('globe')}</div><div class="info"><b class="mono">${esc(d.fqdn)}</b><p>Created ${fmtDate(d.createdAt)}</p></div><button class="icon-btn" style="color:var(--red)" data-sdel="${d.id}">${icon('trash')}</button></div>`).join('') : '<div class="muted">None yet.</div>'}</div>
    </div></div>`;
  $('#sd-form').onsubmit = (e) => { e.preventDefault(); act($('#sd-form button'), () => api('POST', `/api/servers/${s.id}/subdomains`, formData(e.target)), 'Subdomain created').then(() => render()).catch(() => {}); };
  $$('[data-sdel]', t).forEach((b) => (b.onclick = async () => { if (await confirmBox('Delete subdomain?', 'The DNS records will be removed from Cloudflare.')) act(b, () => api('DELETE', `/api/subdomains/${b.dataset.sdel}`), 'Deleted').then(() => render()); }));
}

function rebuildNote() { return `<div class="alert info">Saving recreates the server container with the new setting. Your world and files are kept. If the server is running it restarts automatically.</div>`; }

async function tabVersion(s, t) {
  t.innerHTML = `<div class="card" style="max-width:560px"><h3>Minecraft version</h3><p class="sub">Currently <b>${esc(s.version)}</b>.</p>${rebuildNote()}
    <form id="vf"><label class="f"><span>Version</span><select class="input" name="version"><option>Loading…</option></select></label><button class="btn">Save version</button></form></div>`;
  const versions = await api('GET', '/api/versions');
  $('#vf select').innerHTML = versions.map((v) => `<option ${v === s.version ? 'selected' : ''}>${esc(v)}</option>`).join('');
  $('#vf').onsubmit = (e) => { e.preventDefault(); act($('#vf button'), () => api('PATCH', `/api/servers/${s.id}/settings`, formData(e.target)), 'Version saved').then(() => render()).catch(() => {}); };
}
function softwarePicker(current) {
  return `<div class="sw-grid">${Object.entries(SOFTWARE).map(([k, v]) => `<button type="button" class="sw-opt ${k === current ? 'sel' : ''}" data-sw="${k}"><b>${v.name}</b><span>${v.desc}</span></button>`).join('')}</div><input type="hidden" name="software" value="${esc(current || '')}">`;
}
function bindPicker(root) {
  $$('[data-sw]', root).forEach((b) => (b.onclick = () => { $$('[data-sw]', root).forEach((x) => x.classList.remove('sel')); b.classList.add('sel'); $('[name=software]', root).value = b.dataset.sw; }));
}
async function tabSoftware(s, t) {
  t.innerHTML = `<div class="card"><h3>Server software</h3><p class="sub">Currently <b>${esc(SOFTWARE[s.software].name)}</b>. Plugins work on Paper/Purpur/Spigot, mods on Fabric/Forge.</p>${rebuildNote()}
    <form id="swf">${softwarePicker(s.software)}<button class="btn" style="margin-top:16px">Save software</button></form></div>`;
  bindPicker(t);
  $('#swf').onsubmit = (e) => { e.preventDefault(); act($('#swf > button'), () => api('PATCH', `/api/servers/${s.id}/settings`, formData(e.target)), 'Software saved').then(() => render()).catch(() => {}); };
}
async function tabLogo(s, t) {
  t.innerHTML = `<div class="card" style="max-width:640px"><h3>Server logo</h3><p class="sub">Shown in the Minecraft multiplayer list. Any image is resized to 64×64 PNG automatically.</p>
    <div style="display:flex;gap:22px;align-items:center;flex-wrap:wrap">
      <div class="logo-big" id="logo-prev">No logo</div>
      <div><label class="btn">${icon('upload')}Choose image<input type="file" accept="image/*" hidden id="logo-in"></label>
      <button class="btn ghost" id="logo-del" style="margin-left:6px">Remove</button>
      <p class="muted" style="font-size:13px;margin:10px 0 0">Saved as <span class="mono">server-icon.png</span>. Restart the server to see it.</p></div>
    </div></div>`;
  const prev = $('#logo-prev');
  const show = () => { const img = new Image(); img.onload = () => { prev.innerHTML = ''; prev.appendChild(img); }; img.onerror = () => { prev.textContent = 'No logo'; }; img.src = `/api/servers/${s.id}/files/download?path=/server-icon.png&inline=1&t=${Date.now()}`; };
  show();
  $('#logo-in').onchange = async (e) => {
    const f = e.target.files[0]; if (!f) return;
    const img = new Image(); img.src = URL.createObjectURL(f); await img.decode();
    const cv = document.createElement('canvas'); cv.width = cv.height = 64;
    const ctx = cv.getContext('2d'); const sc = Math.max(64 / img.width, 64 / img.height);
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, (64 - img.width * sc) / 2, (64 - img.height * sc) / 2, img.width * sc, img.height * sc);
    const blob = await new Promise((r) => cv.toBlob(r, 'image/png'));
    const fd = new FormData(); fd.append('files', blob, 'server-icon.png');
    await act(null, () => api('POST', `/api/servers/${s.id}/files/upload?path=/`, fd), 'Logo saved — restart to apply').catch(() => {});
    show();
  };
  $('#logo-del').onclick = () => act($('#logo-del'), () => api('POST', `/api/servers/${s.id}/files/delete`, { paths: ['/server-icon.png'] }), 'Logo removed').then(show).catch(() => {});
}
const MC = { 0: '#000', 1: '#00a', 2: '#0a0', 3: '#0aa', 4: '#a00', 5: '#a0a', 6: '#fa0', 7: '#aaa', 8: '#555', 9: '#55f', a: '#5f5', b: '#5ff', c: '#f55', d: '#f5f', e: '#ff5', f: '#fff' };
function motdHtml(txt) {
  let color = '#aaa', bold = false, italic = false, under = false, out = '';
  const parts = String(txt).replace(/\\n/g, '\n').split(/[§&]([0-9a-fk-or])/i);
  parts.forEach((p, i) => {
    if (i % 2) { const c = p.toLowerCase(); if (MC[c]) { color = MC[c]; bold = italic = under = false; } else if (c === 'l') bold = true; else if (c === 'o') italic = true; else if (c === 'n') under = true; else if (c === 'r') { color = '#aaa'; bold = italic = under = false; } return; }
    if (p) out += `<span style="color:${color};${bold ? 'font-weight:700;' : ''}${italic ? 'font-style:italic;' : ''}${under ? 'text-decoration:underline;' : ''}">${esc(p).replace(/\n/g, '<br>')}</span>`;
  });
  return out;
}
async function tabMotd(s, t) {
  t.innerHTML = `<div class="card" style="max-width:720px"><h3>Server MOTD</h3><p class="sub">The message under your server name. Use <span class="mono">&amp;c</span> for red, <span class="mono">&amp;f</span> white, <span class="mono">&amp;l</span> bold, <span class="mono">\\n</span> for a second line.</p>
    <form id="mf"><label class="f"><span>MOTD</span><input class="input mono" name="motd" maxlength="200" value="${esc(s.motd)}"></label>
    <div class="motd-preview" style="margin-bottom:16px"><div class="ph" id="mp-icon"></div><div><div class="name">${esc(s.name)}</div><div id="mp"></div></div></div>
    <div class="btn-row"><button class="btn">Save MOTD</button><button type="button" class="btn ghost" data-ins="&c">&amp;c red</button><button type="button" class="btn ghost" data-ins="&f">&amp;f white</button><button type="button" class="btn ghost" data-ins="&l">&amp;l bold</button></div></form></div>`;
  const inp = $('#mf input');
  const upd = () => { $('#mp').innerHTML = motdHtml(inp.value); };
  inp.oninput = upd; upd();
  const img = new Image(); img.onload = () => $('#mp-icon').replaceWith(img); img.src = `/api/servers/${s.id}/files/download?path=/server-icon.png&inline=1`;
  $$('[data-ins]', t).forEach((b) => (b.onclick = () => { inp.setRangeText(b.dataset.ins, inp.selectionStart, inp.selectionEnd, 'end'); inp.focus(); upd(); }));
  $('#mf').onsubmit = (e) => { e.preventDefault(); act($('#mf .btn'), () => api('PATCH', `/api/servers/${s.id}/settings`, { motd: inp.value }), 'MOTD saved').then(() => render()).catch(() => {}); };
}

// ---------- account ----------
async function pageAccount() {
  const u = state.me;
  const sd = await api('GET', '/api/subdomains').catch(() => ({ list: [], max: 2 }));
  $('#content').innerHTML = head('Account info', 'Your profile and security') + `
  <div class="grid g2" style="align-items:start">
    <div class="card"><div style="display:flex;gap:14px;align-items:center;margin-bottom:18px"><div class="avatar" style="width:56px;height:56px;font-size:22px;background:var(--red);color:#fff">${esc(u.username[0].toUpperCase())}</div><div><h3>${esc(u.username)}</h3><span class="badge">${u.admin ? 'Administrator' : 'User'}</span></div></div>
      <dl class="kv"><dt>Username</dt><dd>${esc(u.username)}</dd><dt>Email</dt><dd>${esc(u.email || '-')}</dd><dt>Member since</dt><dd>${fmtDate(u.createdAt)}</dd><dt>Servers</dt><dd>${state.servers.length}</dd><dt>Subdomains</dt><dd>${sd.list.length} / ${sd.max}</dd></dl>
      <form id="em" style="margin-top:20px"><label class="f"><span>Email</span><input class="input" type="email" name="email" value="${esc(u.email)}"></label><button class="btn ghost">Update email</button></form>
    </div>
    <div class="card"><h3>Change password</h3><p class="sub">Use at least 6 characters.</p>
      <form id="pw"><label class="f"><span>Current password</span><input class="input" type="password" name="currentPassword" required></label>
      <label class="f"><span>New password</span><input class="input" type="password" name="newPassword" minlength="6" required></label>
      <button class="btn">Change password</button></form></div>
  </div>`;
  $('#em').onsubmit = (e) => { e.preventDefault(); act($('#em button'), () => api('PATCH', '/api/me', formData(e.target)), 'Email updated').then((r) => { state.me = r.user; }); };
  $('#pw').onsubmit = (e) => { e.preventDefault(); act($('#pw button'), () => api('PATCH', '/api/me', formData(e.target)), 'Password changed').then(() => e.target.reset()).catch(() => {}); };
}

// ---------- admin ----------
async function pageAdminOverview() {
  const o = await api('GET', '/api/admin/overview');
  const card = (k, v, href, ic) => `<a class="card stat server-card" href="#/admin/${href}" style="border-top-width:4px"><div class="k">${k}</div><div class="v">${v}</div></a>`;
  $('#content').innerHTML = head('Admin overview', `Manage ${esc(state.panelName)}`) +
    `<div class="grid g4">${card('Servers', o.servers, 'servers')}${card('Nodes', o.nodes, 'nodes')}${card('Users', o.users, 'users')}${card('Subdomains', o.subdomains, 'cloudflare')}</div>
     <div class="card" style="margin-top:18px"><h3>Quick actions</h3><p class="sub">Common admin tasks</p><div class="btn-row">
     <a class="btn" href="#/admin/servers">${icon('plus')}Create server</a><a class="btn ghost" href="#/admin/users">${icon('users')}Add user</a><a class="btn ghost" href="#/admin/nodes">${icon('node')}Add node</a><a class="btn ghost" href="#/admin/cloudflare">${icon('cloud')}Connect Cloudflare</a></div></div>`;
}

async function pageNodes() {
  const nodes = await api('GET', '/api/admin/nodes');
  $('#content').innerHTML = head('Nodes', 'Machines that run your Minecraft containers', `<button class="btn" id="add-node">${icon('plus')}Add node</button>`) +
    `<div class="grid g2">${nodes.map((n) => `<div class="card server-card">
      <div class="top"><div><h3>${esc(n.name)} ${n.local ? '<span class="badge" style="margin-left:6px">local</span>' : ''}</h3><span class="mono muted">${esc(n.url)}</span></div>${n.online ? '<span class="badge ok"><i class="pulse"></i>online</span>' : '<span class="badge">offline</span>'}</div>
      <dl class="kv" style="margin-top:14px"><dt>Public IP</dt><dd class="mono">${esc(n.ip)}</dd><dt>Ports</dt><dd class="mono">${n.portStart} – ${n.portEnd}</dd><dt>Servers</dt><dd>${n.servers}</dd>
      ${n.system ? `<dt>Host</dt><dd>${esc(n.system.hostname)} · ${n.system.cpus} CPU · ${fmtBytes(n.system.memTotal)} RAM</dd>
        <dt>Runtime</dt><dd>${n.system.runtime === 'process' ? `Java process (no Docker) · ${(n.system.java || []).length ? 'Java ' + n.system.java.join(', ') : '<span style="color:var(--red)">Java not installed</span>'}` : (n.system.docker ? 'Docker · connected' : '<span style="color:var(--red)">Docker not reachable</span>')}</dd>` : ''}</dl>
      <div class="btn-row" style="margin-top:14px"><button class="btn ghost sm" data-edit="${n.id}">${icon('edit')}Edit</button>${n.local ? '' : `<button class="btn ghost sm" data-del="${n.id}">${icon('trash')}Delete</button>`}</div>
    </div>`).join('')}</div>
    <div class="card" style="margin-top:18px"><h3>Add another machine</h3><p class="sub" style="margin:0">On the new VPS run <span class="mono">bash install.sh --node-only</span>. It prints the daemon URL and token — paste them in <b>Add node</b>.</p></div>`;
  const form = (n = {}) => `<form id="nf">
    <label class="f"><span>Name</span><input class="input" name="name" value="${esc(n.name || '')}" required></label>
    <label class="f"><span>Daemon URL</span><input class="input mono" name="url" value="${esc(n.url || 'http://')}" required><small>Example: http://1.2.3.4:8080</small></label>
    <label class="f"><span>Daemon token</span><input class="input mono" name="token" placeholder="${n.id ? 'leave empty to keep' : ''}" ${n.id ? '' : 'required'}></label>
    <label class="f"><span>Public IP / hostname for players</span><input class="input mono" name="ip" value="${esc(n.ip || '')}" required></label>
    <div class="grid g2"><label class="f"><span>Port start</span><input class="input" type="number" name="portStart" value="${n.portStart || 25565}"></label><label class="f"><span>Port end</span><input class="input" type="number" name="portEnd" value="${n.portEnd || 25665}"></label></div></form>`;
  $('#add-node').onclick = () => modal({ title: 'Add node', body: form(), footer: `<button class="btn ghost" data-close>Cancel</button><button class="btn" form="nf">Add node</button>`,
    onMount: (el, close) => { $('#nf', el).onsubmit = (e) => { e.preventDefault(); act(null, () => api('POST', '/api/admin/nodes', formData(e.target)), 'Node added').then(() => { close(); render(); }).catch(() => {}); }; } });
  $$('[data-edit]').forEach((b) => (b.onclick = () => { const n = nodes.find((x) => x.id === b.dataset.edit); modal({ title: 'Edit node', body: form(n), footer: `<button class="btn ghost" data-close>Cancel</button><button class="btn" form="nf">Save</button>`,
    onMount: (el, close) => { $('#nf', el).onsubmit = (e) => { e.preventDefault(); act(null, () => api('PATCH', `/api/admin/nodes/${n.id}`, formData(e.target)), 'Saved').then(() => { close(); render(); }).catch(() => {}); }; } }); }));
  $$('[data-del]').forEach((b) => (b.onclick = async () => { if (await confirmBox('Delete node?', 'The node will be removed from the panel.')) act(b, () => api('DELETE', `/api/admin/nodes/${b.dataset.del}`), 'Node removed').then(() => render()).catch(() => {}); }));
}

async function pageAdminServers() {
  const list = await api('GET', '/api/admin/servers');
  $('#content').innerHTML = head('Servers', 'Every server on every node', `<button class="btn" id="new-srv">${icon('plus')}Create server</button>`) +
    `<div class="card"><div class="table-wrap"><table class="t"><thead><tr><th>Name</th><th>Owner</th><th>Software</th><th>Node</th><th>Address</th><th>RAM</th><th></th></tr></thead><tbody>
    ${list.length ? list.map((s) => `<tr><td><a href="#/server/${s.id}"><b>${esc(s.name)}</b></a></td><td>${esc(s.ownerName)}</td><td>${esc(SOFTWARE[s.software]?.name)} ${esc(s.version)}</td><td>${esc(s.nodeName)}</td><td class="mono">${esc(s.address)}</td><td>${s.memory} MB</td>
      <td class="right" style="white-space:nowrap"><a class="btn ghost sm" href="#/server/${s.id}">Manage</a> <button class="btn ghost sm" data-edit="${s.id}">${icon('edit')}</button> <button class="btn ghost sm" data-del="${s.id}" data-name="${esc(s.name)}">${icon('trash')}</button></td></tr>`).join('') : '<tr><td colspan="7" class="muted">No servers yet — click Create server.</td></tr>'}
    </tbody></table></div></div>`;
  $('#new-srv').onclick = createServerModal;
  $$('[data-edit]').forEach((b) => (b.onclick = async () => {
    const s = list.find((x) => x.id === b.dataset.edit);
    const users = await api('GET', '/api/admin/users');
    modal({
      title: 'Edit ' + s.name,
      body: `<form id="es">
        <label class="f"><span>Name</span><input class="input" name="name" maxlength="40" value="${esc(s.name)}" required></label>
        <label class="f"><span>Owner</span><select class="input" name="ownerId">${users.map((u) => `<option value="${u.id}" ${u.id === s.ownerId ? 'selected' : ''}>${esc(u.username)}</option>`).join('')}</select></label>
        <label class="f"><span>Memory (MB)</span><input class="input" type="number" name="memory" min="512" step="256" value="${s.memory}"><small>Applies on next restart.</small></label>
        <label class="f"><span>Public address (optional)</span><input class="input mono" name="publicAddress" value="${esc(s.publicAddress || '')}" placeholder="e.g. shortline.proxy.rlwy.net:12345"><small>Use when players connect through a proxy (Railway TCP proxy, playit.gg). Leave empty to use node IP:port.</small></label>
      </form>`,
      footer: `<button class="btn ghost" data-close>Cancel</button><button class="btn" form="es">Save</button>`,
      onMount: (el, close) => { $('#es', el).onsubmit = (e) => { e.preventDefault(); const d = formData(e.target); if (+d.memory === s.memory) delete d.memory; act(null, () => api('PATCH', `/api/admin/servers/${s.id}`, d), 'Saved').then(() => { close(); render(); }).catch(() => {}); }; },
    });
  }));
  $$('[data-del]').forEach((b) => (b.onclick = async () => {
    if (!(await confirmBox(`Delete ${b.dataset.name}?`, 'The container, world and all files will be permanently deleted.'))) return;
    try { await act(b, () => api('DELETE', `/api/admin/servers/${b.dataset.del}`), 'Server deleted'); render(); }
    catch (e) { if (/force/.test(e.message) && (await confirmBox('Force delete?', 'The node could not be reached. Remove the server from the panel anyway?', 'Force delete'))) act(b, () => api('DELETE', `/api/admin/servers/${b.dataset.del}?force=1`), 'Removed').then(() => render()); }
  }));
}
async function createServerModal() {
  const [nodes, users, versions] = await Promise.all([api('GET', '/api/admin/nodes'), api('GET', '/api/admin/users'), api('GET', '/api/versions')]);
  modal({
    title: 'Create server', wide: true,
    body: `<form id="cs"><div class="grid g2">
      <label class="f"><span>Server name</span><input class="input" name="name" maxlength="40" placeholder="Survival SMP" required></label>
      <label class="f"><span>Owner</span><select class="input" name="ownerId">${users.map((u) => `<option value="${u.id}" ${u.id === state.me.id ? 'selected' : ''}>${esc(u.username)}${u.admin ? ' (admin)' : ''}</option>`).join('')}</select></label>
      <label class="f"><span>Node</span><select class="input" name="nodeId">${nodes.map((n) => `<option value="${n.id}">${esc(n.name)}${n.online ? '' : ' (offline)'}</option>`).join('')}</select></label>
      <label class="f"><span>Allocation (IP : port)</span><select class="input" name="port"></select></label>
      <label class="f"><span>Minecraft version</span><select class="input" name="version">${versions.map((v, i) => `<option ${i === 1 ? 'selected' : ''}>${esc(v)}</option>`).join('')}</select></label>
      <label class="f"><span>Memory (MB)</span><input class="input" type="number" name="memory" value="2048" min="512" step="256"></label>
    </div>
    <label class="f"><span>MOTD</span><input class="input" name="motd" placeholder="&cWelcome to my server!"></label>
    <div class="f"><span style="display:block;font-weight:600;font-size:13px;margin-bottom:8px">Software</span>${softwarePicker('paper')}</div></form>`,
    footer: `<button class="btn ghost" data-close>Cancel</button><button class="btn" form="cs">${icon('plus')}Create server</button>`,
    onMount: (el, close) => {
      bindPicker(el);
      const loadAlloc = async () => {
        const sel = $('[name=port]', el); sel.innerHTML = '<option>Loading…</option>';
        const nid = $('[name=nodeId]', el).value;
        if (!nid) { sel.innerHTML = '<option value="">Add a node first</option>'; return; }
        const al = await api('GET', `/api/admin/nodes/${nid}/allocations`);
        sel.innerHTML = al.length ? al.map((a) => `<option value="${a.port}">${esc(a.ip)}:${a.port}</option>`).join('') : '<option value="">No free ports</option>';
      };
      $('[name=nodeId]', el).onchange = loadAlloc; loadAlloc();
      $('#cs', el).onsubmit = (e) => {
        e.preventDefault();
        act($('.modal-f .btn:last-child', el), () => api('POST', '/api/admin/servers', formData(e.target)), 'Server created — installing (first start downloads the Docker image)')
          .then((s) => { close(); location.hash = `#/server/${s.id}/console`; render(); }).catch(() => {});
      };
    },
  });
}

async function pageUsers() {
  const users = await api('GET', '/api/admin/users');
  $('#content').innerHTML = head('User management', `${users.length} users`, `<button class="btn" id="new-user">${icon('plus')}Create user</button>`) +
    `<div class="card"><div class="table-wrap"><table class="t"><thead><tr><th>User</th><th>Email</th><th>Role</th><th>Servers</th><th>Joined</th><th></th></tr></thead><tbody>
    ${users.map((u) => `<tr><td><div style="display:flex;gap:10px;align-items:center"><div class="avatar" style="width:30px;height:30px;font-size:13px;background:var(--red-soft)">${esc(u.username[0].toUpperCase())}</div><b>${esc(u.username)}</b></div></td><td>${esc(u.email || '-')}</td>
      <td>${u.admin ? '<span class="badge">admin</span>' : '<span class="badge off">user</span>'}</td><td>${u.servers}</td><td class="muted">${fmtDate(u.createdAt)}</td>
      <td class="right" style="white-space:nowrap"><button class="btn ghost sm" data-edit="${u.id}">${icon('edit')}Edit</button> ${u.id === state.me.id ? '' : `<button class="btn ghost sm" data-del="${u.id}">${icon('trash')}</button>`}</td></tr>`).join('')}
    </tbody></table></div></div>`;
  $('#new-user').onclick = () => modal({
    title: 'Create user',
    body: `<form id="uf"><label class="f"><span>Username</span><input class="input" name="username" required></label><label class="f"><span>Email</span><input class="input" type="email" name="email"></label><label class="f"><span>Password</span><input class="input" type="password" name="password" minlength="6" required></label><label class="check"><input type="checkbox" name="admin"> Administrator</label></form>`,
    footer: `<button class="btn ghost" data-close>Cancel</button><button class="btn" form="uf">Create user</button>`,
    onMount: (el, close) => { $('#uf', el).onsubmit = (e) => { e.preventDefault(); const d = formData(e.target); d.admin = !!d.admin; act(null, () => api('POST', '/api/admin/users', d), 'User created').then(() => { close(); render(); }).catch(() => {}); }; },
  });
  $$('[data-edit]').forEach((b) => (b.onclick = () => {
    const u = users.find((x) => x.id === b.dataset.edit);
    modal({
      title: 'Edit ' + u.username,
      body: `<form id="uf"><label class="f"><span>Email</span><input class="input" type="email" name="email" value="${esc(u.email)}"></label><label class="f"><span>New password</span><input class="input" type="password" name="password" placeholder="leave empty to keep"></label><label class="check"><input type="checkbox" name="admin" ${u.admin ? 'checked' : ''}> Administrator</label></form>`,
      footer: `<button class="btn ghost" data-close>Cancel</button><button class="btn" form="uf">Save</button>`,
      onMount: (el, close) => { $('#uf', el).onsubmit = (e) => { e.preventDefault(); const d = formData(e.target); d.admin = !!d.admin; if (!d.password) delete d.password; act(null, () => api('PATCH', `/api/admin/users/${u.id}`, d), 'Saved').then(() => { close(); render(); }).catch(() => {}); }; },
    });
  }));
  $$('[data-del]').forEach((b) => (b.onclick = async () => { if (await confirmBox('Delete user?', 'Their subdomains are removed too.')) act(b, () => api('DELETE', `/api/admin/users/${b.dataset.del}`), 'User deleted').then(() => render()).catch(() => {}); }));
}

async function pageCloudflare() {
  const c = await api('GET', '/api/admin/cloudflare');
  const connected = c.hasToken && c.zoneId;
  $('#content').innerHTML = head('Cloudflare', 'Let users create subdomains for their servers (max 2 per user)', connected ? '<span class="badge ok"><i class="pulse"></i>connected</span>' : '<span class="badge">not connected</span>') + `
  <div class="grid g2" style="align-items:start">
    <div class="card"><h3>Connect your domain</h3><p class="sub">Create an API token in Cloudflare → My Profile → API Tokens with <b>Zone · DNS · Edit</b> permission for your domain.</p>
      <form id="cff">
        <label class="f"><span>API token</span><input class="input mono" name="apiToken" type="password" placeholder="${c.hasToken ? 'saved ' + esc(c.tokenHint) + ' — leave empty to keep' : 'Paste token'}"></label>
        <label class="f"><span>Zone ID</span><input class="input mono" name="zoneId" value="${esc(c.zoneId)}" required><small>Domain overview page → right side → Zone ID</small></label>
        <label class="f"><span>Domain</span><input class="input mono" name="domain" value="${esc(c.domain)}" placeholder="example.com"></label>
        <div class="btn-row"><button class="btn">Save</button><button type="button" class="btn ghost" id="cf-test">Test connection</button>${connected ? '<button type="button" class="btn ghost" id="cf-dis">Disconnect</button>' : ''}</div>
      </form></div>
    <div class="card"><h3>All subdomains</h3><p class="sub">${c.subdomains.length} created</p>
      <div class="table-wrap"><table class="t"><thead><tr><th>Subdomain</th><th>Owner</th><th>Server</th><th></th></tr></thead><tbody>
      ${c.subdomains.length ? c.subdomains.map((d) => `<tr><td class="mono">${esc(d.fqdn)}</td><td>${esc(d.owner || '-')}</td><td>${esc(d.server || '-')}</td><td class="right"><button class="icon-btn" style="color:var(--red)" data-sdel="${d.id}">${icon('trash')}</button></td></tr>`).join('') : '<tr><td colspan="4" class="muted">None yet</td></tr>'}
      </tbody></table></div></div>
  </div>`;
  $('#cff').onsubmit = (e) => { e.preventDefault(); const d = formData(e.target); if (!d.apiToken) delete d.apiToken; act($('#cff .btn'), () => api('PUT', '/api/admin/cloudflare', d), 'Saved').then(() => render()); };
  $('#cf-test').onclick = () => act($('#cf-test'), () => api('POST', '/api/admin/cloudflare/test')).then((r) => { toast(`Connected to ${r.zone} (${r.status})`, true); render(); }).catch(() => {});
  if ($('#cf-dis')) $('#cf-dis').onclick = async () => { if (await confirmBox('Disconnect Cloudflare?', 'Existing DNS records stay in Cloudflare.', 'Disconnect')) act(null, () => api('DELETE', '/api/admin/cloudflare'), 'Disconnected').then(() => render()); };
  $$('[data-sdel]').forEach((b) => (b.onclick = async () => { if (await confirmBox('Delete subdomain?', 'DNS records will be removed.')) act(b, () => api('DELETE', `/api/subdomains/${b.dataset.sdel}`), 'Deleted').then(() => render()); }));
}

async function pageSettings() {
  const s = await api('GET', '/api/admin/settings');
  $('#content').innerHTML = head('Settings', 'Only admins can change these') + `
  <div class="card" style="max-width:560px"><h3>Panel name</h3><p class="sub">Shown in the sidebar, login page and browser tab.</p>
    <form id="sf"><label class="f"><span>Name</span><input class="input" name="panelName" maxlength="40" value="${esc(s.panelName)}" required></label><button class="btn">Save</button></form></div>
  <div class="card" style="max-width:560px"><h3>Registration</h3><p class="sub">Let people create their own account from the login page. New accounts are normal users (never admin) and have no servers until you give them one.</p>
    <label class="check"><input type="checkbox" id="reg" ${s.registration ? 'checked' : ''}> Allow new users to register</label></div>`;
  $('#reg').onchange = (e) => act(null, () => api('PUT', '/api/admin/settings', { registration: e.target.checked }), e.target.checked ? 'Registration opened' : 'Registration closed').catch(() => { e.target.checked = !e.target.checked; });
  $('#sf').onsubmit = (e) => { e.preventDefault(); act($('#sf button'), () => api('PUT', '/api/admin/settings', formData(e.target)), 'Panel name updated').then((r) => {
    state.panelName = r.panelName; document.title = r.panelName; $('#panel-name').textContent = r.panelName; $('#panel-name-m').textContent = r.panelName;
  }).catch(() => {}); };
}

boot();
