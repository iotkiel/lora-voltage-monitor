/*
 * ttn-dashboard-server.js — Multi-Node: Time-Sync-Backend + lokaler Logger
 * + Mini-Web-Dashboard für TTN v3
 * ---------------------------------------------------------------------
 * MQTT-Bridge pro Node (eigene TTN-Application + eigener API-Key):
 *  - schiebt einen 4-Byte Big-Endian Unix-Timestamp als Downlink auf
 *    FPort 2, wenn ein Uplink "time_request" gesetzt hat
 *  - loggt jeden Uplink pro Node in eigene Dateien:
 *      uplinks_<id>.csv / uplinks_<id>.jsonl
 *  - plus read-only HTTP-Dashboard (z. B. hinter Reverse Proxy)
 *
 * HTTP-Endpunkte (read-only, nur GET):
 *   GET /                        -> Dashboard (HTML, Auto-Refresh)
 *   GET /api/nodes               -> Liste der konfigurierten Nodes
 *   GET /api/uplinks?node=<id>&n=-> letzte n Uplinks des Nodes (def. 200)
 *   GET /api/latest?node=<id>    -> letzter Uplink des Nodes
 *
 * Nodes konfigurieren: unten in der NODES-Liste oder per .env
 * (NODE1_LABEL / NODE1_TTN_APP_ID / NODE1_TTN_API_KEY, NODE2_* ...).
 * Zum Tauschen eines Nodes nur den entsprechenden Block aendern.
 *
 * Setup:
 *   1. npm install mqtt
 *   2. .env.example nach .env kopieren und TTN-Werte eintragen
 *      (optional: DASHBOARD_PORT, default 8080)
 *   3. node ttn-dashboard-server.js
 *   4. Reverse Proxy auf http://<vm>:8080/ zeigen lassen
 */

const mqtt = require('mqtt');
const fs   = require('fs');
const path = require('path');
const http = require('http');

// --- minimaler .env-Loader (keine externe Abhaengigkeit) ---
function loadEnvFile(file) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq < 1) continue;
    const key = t.slice(0, eq).trim();
    const val = t.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
    if (process.env[key] === undefined) process.env[key] = val;
  }
}
loadEnvFile(path.join(__dirname, '.env'));

// ---------------- KONFIGURATION ----------------
const TENANT      = process.env.TTN_TENANT || 'ttn';
const HOST        = process.env.TTN_HOST   || 'eu1.cloud.thethings.network';
const TIME_FPORT  = 2;
const HTTP_PORT   = parseInt(process.env.DASHBOARD_PORT || '8080', 10);
const MAX_POINTS  = 2000;                  // Ringpuffer-Groesse pro Node
const LOG_DIR     = __dirname;

// ---- Nodes: hier anpassen/tauschen oder per .env (NODE1_*, NODE2_*) ----
// id    = interner Key (Log-Dateien + API), frei waehlbar, [a-z0-9-]
// label = Anzeigename im Dashboard
// timeSync = true -> Node bekommt Zeit-Downlink auf FPort 2 bei
//           time_request-Flag im Payload
const NODES = [
  {
    id:      process.env.NODE1_ID    || 'node1',
    label:   process.env.NODE1_LABEL || 'Node 1',
    appId:   process.env.NODE1_TTN_APP_ID  || '',
    apiKey:  process.env.NODE1_TTN_API_KEY || '',
    timeSync: true,
  },
  {
    id:      process.env.NODE2_ID    || 'node2',
    label:   process.env.NODE2_LABEL || 'Node 2',
    appId:   process.env.NODE2_TTN_APP_ID  || '',
    apiKey:  process.env.NODE2_TTN_API_KEY || '',
    timeSync: true,
  },
];
// --------------------------------------------------------------------

const CSV_HEADER = 'iso_time,device_id,f_port,payload_b64,raw_adc,battery_v,' +
                   'soc_pct,time_request,low_battery,rssi,snr,sf,freq_hz,gateway_id\n';

// ---------------- State pro Node ----------------

const nodes = new Map();   // id -> { cfg, client, uplinks[] }

for (const cfg of NODES) {
  if (!cfg.appId || !cfg.apiKey) {
    console.warn(`Node "${cfg.id}" (${cfg.label}): TTN_APP_ID/API_KEY fehlt -> uebersprungen`);
    continue;
  }
  nodes.set(cfg.id, {
    cfg,
    uplinks: [],
    csvFile:   path.join(LOG_DIR, `uplinks_${cfg.id}.csv`),
    jsonlFile: path.join(LOG_DIR, `uplinks_${cfg.id}.jsonl`),
  });
}

if (nodes.size === 0) {
  console.error('Kein Node konfiguriert: NODE1_TTN_APP_ID / NODE1_TTN_API_KEY in .env setzen');
  process.exit(1);
}

function pushUplink(node, rec) {
  node.uplinks.push(rec);
  if (node.uplinks.length > MAX_POINTS) {
    node.uplinks.splice(0, node.uplinks.length - MAX_POINTS);
  }
}

// Historie aus CSV seeden, damit der Graph nach Neustart erhalten bleibt.
function seedFromCsv(node) {
  try {
    const lines = fs.readFileSync(node.csvFile, 'utf8').trim().split('\n').slice(1);
    for (const l of lines.slice(-MAX_POINTS)) {
      const c = l.split(',');
      if (c.length < 14) continue;
      node.uplinks.push({
        t: c[0], dev: c[1], raw_adc: +c[4] || null,
        battery_v: +c[5] || null, soc_pct: +c[6] || null,
        time_request: c[7] === 'true', low_battery: c[8] === 'true',
        rssi: +c[9] || null, snr: +c[10] || null,
        sf: +c[11] || null, freq_hz: +c[12] || null, gw: c[13],
      });
    }
    console.log(`[${node.cfg.id}] ${node.uplinks.length} Uplinks aus CSV geladen.`);
  } catch (e) { /* noch kein Log vorhanden */ }
}

function logCsv(node, fields) {
  if (!fs.existsSync(node.csvFile)) fs.writeFileSync(node.csvFile, CSV_HEADER);
  fs.appendFileSync(node.csvFile, fields.join(',') + '\n');
}

// ---------------- MQTT pro Node ----------------

function startNode(node) {
  const cfg  = node.cfg;
  const base = `v3/${cfg.appId}@${TENANT}`;

  seedFromCsv(node);

  node.client = mqtt.connect(`mqtts://${HOST}:8883`, {
    username: `${cfg.appId}@${TENANT}`,
    password: cfg.apiKey,
  });

  node.client.on('connect', () => {
    console.log(`[${cfg.id}] mit TTN MQTT verbunden (${cfg.appId}), abonniere Uplinks...`);
    node.client.subscribe(`${base}/devices/+/up`);
  });

  node.client.on('error', (err) =>
    console.error(`[${cfg.id}] MQTT-Fehler:`, err.message));

  node.client.on('message', (topic, message) => {
    let data;
    try { data = JSON.parse(message.toString()); } catch (e) { return; }
    try { handleUplink(node, data); } catch (e) {
      console.error(`[${cfg.id}] Fehler im Uplink-Handling:`, e.message);
    }
  });
}

function handleUplink(node, data) {
  const devId = data.end_device_ids && data.end_device_ids.device_id;
  const up    = data.uplink_message;
  if (!devId || !up) return;
  // beide Payload-Varianten akzeptieren: alt FPort 1, neu FPort 10
  if (up.f_port !== 1 && up.f_port !== 10) return;

  const f    = up.decoded_payload || {};
  const meta = (up.rx_metadata && up.rx_metadata[0]) || {};
  const gwId = (meta.gateway_ids && meta.gateway_ids.gateway_id) || '';
  const lora = (up.settings && up.settings.data_rate && up.settings.data_rate.lora) || {};
  const iso  = up.received_at || data.received_at || new Date().toISOString();

  const rec = {
    t: iso, dev: devId,
    raw_adc:   f.raw_adc != null ? f.raw_adc : null,
    // alt: battery_v | neu (unsere Nodes): busspannung_v
    battery_v: f.battery_v != null ? f.battery_v
               : (f.busspannung_v != null ? f.busspannung_v : null),
    // neu (unsere Nodes): batterieladung_pct
    soc_pct:   f.batterieladung_pct != null ? f.batterieladung_pct
               : (f.soc_pct != null ? f.soc_pct : null),
    time_request: !!f.time_request,
    low_battery:  !!f.low_battery,
    rssi: meta.rssi != null ? meta.rssi : null,
    snr:  meta.snr  != null ? meta.snr  : null,
    sf:   lora.spreading_factor != null ? lora.spreading_factor : null,
    freq_hz: up.settings && up.settings.frequency ? +up.settings.frequency : null,
    gw: gwId,
  };
  pushUplink(node, rec);

  logCsv(node, [iso, devId, up.f_port, up.frm_payload || '',
          rec.raw_adc ?? '', rec.battery_v ?? '', rec.soc_pct ?? '',
          rec.time_request, rec.low_battery,
          rec.rssi ?? '', rec.snr ?? '', rec.sf ?? '', rec.freq_hz ?? '', gwId]);
  fs.appendFileSync(node.jsonlFile, JSON.stringify(data) + '\n');
  console.log(`${iso}  [${node.cfg.id}] uplink ${devId}  batt=${rec.battery_v}V` +
              `  rssi=${rec.rssi}  time_req=${rec.time_request}`);

  // Zeit-Downlink nur wenn der Node das Feature nutzt
  if (!node.cfg.timeSync || !rec.time_request) return;
  const epoch = Math.floor(Date.now() / 1000);
  const buf = Buffer.alloc(4);
  buf.writeUInt32BE(epoch, 0);
  const downlink = { downlinks: [{ f_port: TIME_FPORT,
    frm_payload: buf.toString('base64'), priority: 'NORMAL' }] };
  const base = `v3/${node.cfg.appId}@${TENANT}`;
  node.client.publish(`${base}/devices/${devId}/down/push`,
    JSON.stringify(downlink), (err) => {
      if (err) console.error(`[${node.cfg.id}] Downlink fehlgeschlagen fuer ${devId}:`, err.message);
      else console.log(`${new Date().toISOString()}  [${node.cfg.id}] Zeit-Downlink -> ${devId}  epoch=${epoch}`);
    });
}

for (const node of nodes.values()) startNode(node);

// ---------------- HTTP-Dashboard ----------------

// Node-Liste wird serverseitig ins HTML injiziert (nur id + label,
// keine Keys/Credentials!).
const NODE_LIST_JSON = JSON.stringify(
  [...nodes.values()].map(n => ({ id: n.cfg.id, label: n.cfg.label }))
);

const PAGE = `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="refresh" content="60">
<title>LoRa Voltage Monitor</title>
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body { margin:0; font:15px/1.45 system-ui,sans-serif; background:#0e1117; color:#d7dce4; }
  header { padding:14px 20px; border-bottom:1px solid #232a35; display:flex;
           flex-wrap:wrap; gap:8px 24px; align-items:baseline; }
  h1 { font-size:17px; margin:0; font-weight:600; }
  .dim { color:#7d8694; font-size:13px; }
  main { max-width:960px; margin:0 auto; padding:20px; }
  section.node { margin-bottom:36px; }
  section.node h2 { font-size:15px; margin:0 0 4px; font-weight:600; }
  section.node .sub { color:#7d8694; font-size:12px; margin-bottom:12px; }
  .cards { display:flex; flex-wrap:wrap; gap:12px; margin-bottom:16px; }
  .card { background:#161b24; border:1px solid #232a35; border-radius:10px;
          padding:12px 16px; min-width:140px; flex:1; }
  .card .v { font-size:26px; font-weight:650; }
  .card .l { font-size:12px; color:#7d8694; text-transform:uppercase;
             letter-spacing:.06em; }
  .ok  { color:#4cc38a; } .warn { color:#e5484d; }
  svg.chart { width:100%; height:280px; background:#161b24;
           border:1px solid #232a35; border-radius:10px; }
  table { width:100%; border-collapse:collapse; margin-top:16px; font-size:13px; }
  th,td { text-align:left; padding:6px 8px; border-bottom:1px solid #232a35; }
  th { color:#7d8694; font-weight:500; }
</style>
</head>
<body>
<header>
  <h1>LoRa Voltage Monitor</h1>
  <span class="dim">read-only &middot; auto-refresh 60s</span>
</header>
<main id="main"></main>
<script>
const NODES = ${NODE_LIST_JSON};
const main = document.getElementById('main');

// eine Sektion (Karten + Graph + Tabelle) pro Node aufbauen
for (const n of NODES) {
  main.insertAdjacentHTML('beforeend', \`
    <section class="node" id="sec-\${n.id}">
      <h2>\${n.label}</h2>
      <div class="sub" id="sub-\${n.id}"></div>
      <div class="cards">
        <div class="card"><div class="l">Battery</div><div class="v" id="v-\${n.id}">–</div></div>
        <div class="card"><div class="l">SoC</div><div class="v" id="soc-\${n.id}">–</div></div>
        <div class="card"><div class="l">RSSI / SNR</div><div class="v" id="rf-\${n.id}">–</div></div>
        <div class="card"><div class="l">Status</div><div class="v" id="st-\${n.id}">–</div></div>
      </div>
      <svg class="chart" id="chart-\${n.id}" preserveAspectRatio="none"></svg>
      <table><thead><tr>
        <th>Zeit (UTC)</th><th>V</th><th>%</th><th>RSSI</th><th>SNR</th><th>SF</th><th>Flags</th>
      </tr></thead><tbody id="tb-\${n.id}"></tbody></table>
    </section>\`);
}

async function loadNode(n) {
  const r = await fetch('/api/uplinks?node=' + encodeURIComponent(n.id) + '&n=288');
  const d = await r.json();
  if (!d.length) {
    document.getElementById('sub-' + n.id).textContent = 'noch keine Daten';
    return;
  }
  const last = d[d.length-1];
  document.getElementById('sub-' + n.id).textContent =
    last.dev + ' · last seen ' + last.t;
  if (last.battery_v != null)
    document.getElementById('v-' + n.id).textContent = last.battery_v.toFixed(2) + ' V';
  document.getElementById('v-' + n.id).className = 'v ' + (last.low_battery ? 'warn' : 'ok');
  document.getElementById('soc-' + n.id).textContent =
    last.soc_pct != null ? last.soc_pct + ' %' : '–';
  document.getElementById('rf-' + n.id).textContent =
    (last.rssi != null ? last.rssi + ' dBm' : '–') + ' / ' +
    (last.snr != null ? last.snr + ' dB' : '–');
  document.getElementById('st-' + n.id).textContent =
    last.low_battery ? 'LOW BATT' : (last.time_request ? 'time req' : 'ok');
  document.getElementById('st-' + n.id).className =
    'v ' + (last.low_battery ? 'warn' : 'ok');
  draw(n.id, d);
  fillTable(n.id, d.slice(-12).reverse());
}

function draw(id, d) {
  const svg = document.getElementById('chart-' + id);
  const W = svg.clientWidth || 900, H = svg.clientHeight || 280, P = 34;
  const pts = d.filter(p => p.battery_v != null);
  if (pts.length < 2) return;
  const vs = pts.map(p => p.battery_v);
  let lo = Math.min.apply(null, vs), hi = Math.max.apply(null, vs);
  lo = Math.min(lo, 11.5) - 0.2; hi = Math.max(hi, 13) + 0.2;
  const x = i => P + i * (W - 2*P) / (pts.length - 1);
  const y = v => H - P - (v - lo) * (H - 2*P) / (hi - lo);
  let out = '';
  for (let g = Math.ceil(lo); g <= hi; g++) {
    out += '<line x1="'+P+'" y1="'+y(g)+'" x2="'+(W-P)+'" y2="'+y(g)+
           '" stroke="#232a35"/><text x="4" y="'+(y(g)+4)+
           '" fill="#7d8694" font-size="11">'+g+'V</text>';
  }
  out += '<line x1="'+P+'" y1="'+y(11.8)+'" x2="'+(W-P)+'" y2="'+y(11.8)+
         '" stroke="#e5484d" stroke-dasharray="4 4"/>';
  const path = pts.map((p,i) => (i?'L':'M')+x(i).toFixed(1)+' '+y(p.battery_v).toFixed(1)).join(' ');
  out += '<path d="'+path+'" fill="none" stroke="#4cc38a" stroke-width="2"/>';
  out += '<text x="'+P+'" y="'+(H-8)+'" fill="#7d8694" font-size="11">'+pts[0].t.slice(5,16).replace('T',' ')+'</text>';
  out += '<text x="'+(W-P)+'" y="'+(H-8)+'" text-anchor="end" fill="#7d8694" font-size="11">'+pts[pts.length-1].t.slice(5,16).replace('T',' ')+'</text>';
  svg.innerHTML = out;
}

function fillTable(id, rows) {
  document.getElementById('tb-' + id).innerHTML = rows.map(p =>
    '<tr><td>'+p.t.replace('T',' ').slice(0,19)+'</td><td>'+
    (p.battery_v!=null?p.battery_v.toFixed(2):'')+'</td><td>'+
    (p.soc_pct!=null?p.soc_pct:'')+'</td><td>'+
    (p.rssi!=null?p.rssi:'')+'</td><td>'+
    (p.snr!=null?p.snr:'')+'</td><td>'+
    (p.sf!=null?'SF'+p.sf:'')+'</td><td>'+
    (p.low_battery?'LOW ':'')+(p.time_request?'time':'')+'</td></tr>'
  ).join('');
}

NODES.forEach(loadNode);
</script>
</body>
</html>`;

const server = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  if (req.method !== 'GET') { res.writeHead(405); return res.end(); }

  if (u.pathname === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end(PAGE);
  }
  if (u.pathname === '/api/nodes') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(NODE_LIST_JSON);
  }

  // node-gebundene Endpunkte
  const nodeId = u.searchParams.get('node');
  const node = nodeId ? nodes.get(nodeId) : nodes.values().next().value;
  if (!node) { res.writeHead(404); return res.end(); }

  if (u.pathname === '/api/latest') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify(node.uplinks[node.uplinks.length - 1] || null));
  }
  if (u.pathname === '/api/uplinks') {
    const n = Math.min(parseInt(u.searchParams.get('n') || '200', 10) || 200, MAX_POINTS);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify(node.uplinks.slice(-n)));
  }
  res.writeHead(404); res.end();
});

server.listen(HTTP_PORT, () => {
  console.log(`Dashboard: http://localhost:${HTTP_PORT}/  (GET-only, read-only)`);
  console.log(`Nodes: ${[...nodes.values()].map(n => `${n.cfg.id}="${n.cfg.label}"`).join(', ')}`);
});
