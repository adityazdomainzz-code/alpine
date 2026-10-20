# ❀ AlpinePanel — Minecraft Hosting Panel

Red & white Minecraft hosting panel with falling flowers in the sidebar. Servers run in **Docker** (no KVM needed — works on a normal VPS *or* a Docker-container VPS). A **local node is set up automatically**.

## Install (1 command)

```1. On the VPS (as root):
 git clone https://github.com/adityazdomainzz-code/alpine.git
   bash
   curl -fsSL https://raw.githubusercontent.com/adityazdomainzz-code/alpine/main/install.sh -o install.sh
   sudo bash install.sh
  
   
   #if server startup show a error run this cmd in your vps 
   
   mkdir -p /project/workspace/redpanel-data/volumes
sed -i 's#"dataDir": *"[^"]*"#"dataDir": "/project/workspace/redpanel-data/volumes"#' /opt/redpanel/node/config.json
cat /opt/redpanel/node/config.json
pm2 restart redpanel-node
   ```
2. Choose how to open the panel:
   - **1) Public IP** → `http://YOUR_IP:8000`
   - **2) Cloudflare Tunnel** → paste a tunnel token, add a Public Hostname pointing to `http://localhost:8000`

`install.sh` clones the repo, checks every file and folder, installs Docker / Node.js / pm2, then starts **Docker → node daemon → panel → tunnel** one by one.

## Features
| User | Admin panel |
|---|---|
| Servers list, Account info | Overview, Nodes (local node ready), Servers (create like Pterodactyl: node + IP:port allocation) |
| Console (live logs + commands, start/stop/restart/kill, CPU/RAM) | User management |
| File manager (edit, upload, drag & drop, rename, delete, download) | Cloudflare (API token + Zone ID) |
| Plugins / mods (Modrinth search + install, upload .jar) | Settings (panel name — admin only) |
| Subdomain (max **2 per user**, A + SRV records) | |
| Version, Software (Fabric, Forge, Purpur, Paper, Spigot), Server logo, MOTD | |

## Ports
- `8000` panel · `8080` node daemon (local only on the main machine) · `25565-25665` Minecraft

## Extra node (another VPS)
```bash
sudo bash install.sh --node-only
```
It prints a Daemon URL + token → Admin → Nodes → Add node.

## Useful commands
```bash
pm2 logs redpanel          # panel logs
pm2 logs redpanel-node     # node logs
pm2 restart redpanel redpanel-node
cd /opt/redpanel/panel && node src/cli.js admin NewPass123 && pm2 restart redpanel   # reset admin
```
Data: `/opt/redpanel/panel/data/db.json` · server files: `/var/lib/redpanel/volumes/<server-id>`

## Cloudflare subdomains
Cloudflare → My Profile → API Tokens → Create token with **Zone · DNS · Edit**. Paste it with the Zone ID in Admin → Cloudflare, click **Test connection**. Players then join with `name.yourdomain.com` (no port needed — SRV record).
