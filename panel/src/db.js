// Tiny JSON-file database (no native modules -> works on any VPS / container)
'use strict';
const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '..', 'data', 'db.json');
const DEFAULTS = {
  users: [],
  sessions: {},
  nodes: [],
  servers: [],
  subdomains: [],
  settings: { panelName: 'RedPanel' },
  cloudflare: { apiToken: '', zoneId: '', domain: '' },
};

let data;
function load() {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  try { data = JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch { data = {}; }
  for (const [k, v] of Object.entries(DEFAULTS)) if (data[k] === undefined) data[k] = JSON.parse(JSON.stringify(v));
  save();
  return data;
}
let timer = null;
function save() {
  clearTimeout(timer);
  timer = null;
  fs.writeFileSync(FILE + '.tmp', JSON.stringify(data, null, 2));
  fs.renameSync(FILE + '.tmp', FILE);
}
module.exports = { load, save, get data() { return data; } };
