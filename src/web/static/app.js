'use strict';

// ── Config ────────────────────────────────────────────────────────────────────
const MQTT_HOST  = window.location.hostname;
const MQTT_PORT  = 9001;
const MQTT_TOPIC = 'ac-iot/+/sensores';

const ROOM_UUIDS = {
  sala01: '00000000-0000-4000-8000-000000000101',
  sala02: '00000000-0000-4000-8000-000000000102',
  sala03: '00000000-0000-4000-8000-000000000103',
};

// ── Estado ────────────────────────────────────────────────────────────────────
const rooms    = {};       // último payload MQTT por sala
const icData   = {};       // última resposta IC parseada por sala
const icTimers = {};       // debounce timers IC

let client         = null;
let reconnectTimer = null;
let icEverOk       = false;

// (seleção de sala via <select> — sem Sets)

// ── Log ───────────────────────────────────────────────────────────────────────
const LOG_MAX  = 120;
const logItems = [];
let   logFilter = 'all';

function addLog(type, msg) {
  logItems.unshift({ ts: new Date().toLocaleTimeString('pt-BR'), type, msg });
  if (logItems.length > LOG_MAX) logItems.pop();
  renderLog();
}

function renderLog() {
  const feed = document.getElementById('log-feed');
  const shown = logFilter === 'all'
    ? logItems
    : logItems.filter(e =>
        e.type === logFilter ||
        (logFilter !== 'cmd' && (e.type === 'ok' || e.type === 'warn'))
      );

  feed.innerHTML = shown.map(e =>
    `<div class="log-entry log-${e.type}">
       <span class="log-ts">${e.ts}</span>
       <span class="log-msg">${e.msg}</span>
     </div>`
  ).join('');
}

window.clearLog  = () => { logItems.length = 0; renderLog(); };
window.filterLog = (f) => {
  logFilter = f;
  document.querySelectorAll('.ltab').forEach(t => t.classList.remove('active'));
  document.getElementById('tab-' + f)?.classList.add('active');
  renderLog();
};

// ── InterSCity — normaliza todos os formatos conhecidos ───────────────────────
//
// Retorna { cap: [{value, date|timestamp}] } independente do formato de origem.
//
function normalizeIC(raw) {
  if (!raw || typeof raw !== 'object') return null;

  // Formato UFMA confirmado: {resources:[{uuid, capabilities:{cap:[{value,date}]}}]}
  if (Array.isArray(raw.resources) && raw.resources.length > 0) {
    const caps = raw.resources[0]?.capabilities;
    if (caps && typeof caps === 'object') return caps;
  }

  // Formato A: {data: {capabilities: {cap: [{value, date}] | number}}}
  if (raw.data?.capabilities && typeof raw.data.capabilities === 'object') {
    return raw.data.capabilities;
  }

  // Formato B: {data: [{uuid, capabilities:{cap:val}, timestamp}]}
  if (Array.isArray(raw.data) && raw.data.length > 0 && raw.data[0].capabilities) {
    const first = raw.data[0];
    const ts    = first.timestamp || first.date || null;
    const out   = {};
    for (const [k, v] of Object.entries(first.capabilities)) {
      if (Array.isArray(v) && v.length) out[k] = v;
      else if (typeof v === 'number')   out[k] = [{ value: v, date: ts }];
    }
    return Object.keys(out).length ? out : null;
  }

  // Formato C: {data: [{capability, value, date}]}
  if (Array.isArray(raw.data) && raw.data.length > 0 && raw.data[0].capability != null) {
    const out = {};
    for (const item of raw.data) {
      const cap = item.capability || item.name;
      if (cap && item.value != null)
        out[cap] = [{ value: item.value, date: item.date || item.timestamp }];
    }
    return Object.keys(out).length ? out : null;
  }

  // Formato D: {data: {cap: [{value, date}]}} ou {data: {cap: number}}
  if (raw.data && typeof raw.data === 'object' && !Array.isArray(raw.data)) {
    const inner = raw.data;
    const ts    = inner.timestamp || inner.date || null;
    const skip  = new Set(['timestamp', 'date', 'uuid', 'resource_uuid', 'id', 'status']);
    const out   = {};
    for (const [k, v] of Object.entries(inner)) {
      if (skip.has(k)) continue;
      if (Array.isArray(v) && v.length && v[0].value != null) out[k] = v;
      else if (typeof v === 'number') out[k] = [{ value: v, date: ts }];
    }
    return Object.keys(out).length ? out : null;
  }

  // Formato E: plano {cap: value, date/timestamp: "..."} no root
  {
    const ts   = raw.timestamp || raw.date || null;
    const skip = new Set(['timestamp', 'date', 'uuid', 'data', 'id', 'resources']);
    const out  = {};
    for (const [k, v] of Object.entries(raw)) {
      if (skip.has(k)) continue;
      if (typeof v === 'number') out[k] = [{ value: v, date: ts }];
    }
    return Object.keys(out).length ? out : null;
  }
}

function icGet(d, cap) {
  const arr = d?.[cap];
  if (!arr) return null;
  if (Array.isArray(arr) && arr.length) return arr[0]?.value ?? null;
  if (typeof arr === 'number') return arr;
  return null;
}

function icGetTs(d, cap) {
  const arr = d?.[cap];
  if (Array.isArray(arr) && arr.length) return arr[0]?.date ?? arr[0]?.timestamp ?? null;
  return null;
}

function fmtIcTs(ts) {
  if (!ts) return '—';
  try {
    return new Date(ts).toLocaleString('pt-BR', {
      day: '2-digit', month: '2-digit',
      hour: '2-digit', minute: '2-digit',
    });
  } catch { return String(ts); }
}

// ── IC status visual ──────────────────────────────────────────────────────────
function setICStatus(ok) {
  const dot = document.getElementById('dot-ic');
  const lbl = document.getElementById('lbl-ic');
  if (!dot) return;
  if (ok) {
    dot.className = 'dot ok';
    lbl.textContent = 'InterSCity';
    icEverOk = true;
  } else {
    dot.className = icEverOk ? 'dot warn' : 'dot idle';
    lbl.textContent = 'InterSCity';
  }
}

// ── InterSCity fetch (proxy Nginx /api/ic/) ───────────────────────────────────
function fetchIC(roomId) {
  const uuid = ROOM_UUIDS[roomId];
  if (!uuid) return;
  clearTimeout(icTimers[roomId]);
  icTimers[roomId] = setTimeout(async () => {
    try {
      const res = await fetch(`/api/ic/collector/resources/${uuid}/data/last`, {
        signal: AbortSignal.timeout(10000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const raw = await res.json();

      // Debug: log raw response ao console para diagnóstico de formato
      console.debug(`IC[${roomId}] raw:`, raw);

      const d = normalizeIC(raw);
      icData[roomId] = d;

      if (d) {
        setICStatus(true);
        const t  = icGet(d, 'temperatura');
        const u  = icGet(d, 'umidade');
        const ts = icGetTs(d, 'temperatura');
        addLog('ic',
          `${roomId} · ${t  != null ? t.toFixed(1) + '°C' : '—'} · ` +
          `${u  != null ? u.toFixed(0) + '%'   : '—'} · ` +
          `${fmtIcTs(ts)}`
        );
      } else {
        // Parsing falhou — mostra fragmento do raw para diagnóstico
        setICStatus(false);
        const preview = JSON.stringify(raw).slice(0, 120);
        addLog('ic', `${roomId} · formato não reconhecido → ${preview}`);
      }
    } catch (e) {
      icData[roomId] = null;
      setICStatus(false);
      if (!e.name?.includes('Abort')) addLog('warn', `IC erro [${roomId}]: ${e.message}`);
    }
    refreshCard(roomId);
  }, 2000);
}

// ── MQTT ──────────────────────────────────────────────────────────────────────
function connect() {
  clearTimeout(reconnectTimer);
  const cid = 'dash_' + Math.random().toString(36).slice(2, 8);
  client = new Paho.MQTT.Client(MQTT_HOST, MQTT_PORT, cid);

  client.onConnectionLost = ({ errorCode, errorMessage }) => {
    setMQTT(false);
    if (errorCode !== 0) {
      addLog('warn', 'MQTT desconectado: ' + (errorMessage || 'erro'));
      reconnectTimer = setTimeout(connect, 4000);
    }
  };

  client.onMessageArrived = ({ destinationName: topic, payloadString }) => {
    try {
      const data = JSON.parse(payloadString);
      const sala = data.id_sala || topic.split('/')[1];
      const isNew = !rooms[sala];
      rooms[sala] = data;
      upsertCard(sala, data);
      if (isNew) {
        updateCounter();
        populateRoomSelects();
        updatePanelState();
      }
      fetchIC(sala);

      addLog('mqtt',
        `${sala} · ${data.temperatura?.toFixed(1) ?? '—'}°C · ` +
        `${data.umidade?.toFixed(0) ?? '—'}% · ` +
        `${data.luminosidade ?? '—'} lx · ` +
        `${data.presenca ? '● pres.' : '○ vazio'} · ` +
        `AC ${data.status_ac === 'ligado' ? 'on' : 'off'} · ` +
        `Luz ${data.status_luz === 'ligado' ? 'on' : 'off'}`
      );
    } catch (e) { console.warn('payload inválido', e); }
  };

  client.connect({
    onSuccess: () => {
      setMQTT(true);
      client.subscribe(MQTT_TOPIC);
      addLog('ok', `MQTT conectado · ${MQTT_HOST}:${MQTT_PORT}`);
    },
    onFailure: ({ errorMessage }) => {
      setMQTT(false);
      addLog('warn', 'Falha MQTT: ' + (errorMessage || 'timeout'));
      reconnectTimer = setTimeout(connect, 5000);
    },
    useSSL: false, keepAliveInterval: 30, cleanSession: true,
  });
}

// pub: publica no tópico de COMANDO (simulator processa)
function pub(roomId, payload) {
  if (!client?.isConnected()) { addLog('warn', 'MQTT não conectado'); return; }
  const msg = new Paho.MQTT.Message(JSON.stringify(payload));
  msg.destinationName = `ac-iot/${roomId}/comando`;
  client.send(msg);
}

// pubSensor: publica no tópico de SENSORES (bridge → IC; usado no teste)
function pubSensor(roomId, payload) {
  if (!client?.isConnected()) { addLog('warn', 'MQTT não conectado'); return; }
  const msg = new Paho.MQTT.Message(JSON.stringify(payload));
  msg.destinationName = `ac-iot/${roomId}/sensores`;
  client.send(msg);
}

// ── Helpers de seleção via <select> ──────────────────────────────────────────

function populateRoomSelects() {
  const known = Object.keys(rooms).sort();
  const allOpt  = known.length > 1 ? `<option value="__all__">Todas as salas</option>` : '';
  const roomOpts = known.map(id => {
    const n = id.replace(/^sala(\d+)$/, (_, n) => `Sala ${+n}`);
    return `<option value="${id}">${n}</option>`;
  }).join('');

  // Setpoints: default Todas
  const selSp = document.getElementById('sp-room');
  if (selSp) selSp.innerHTML = allOpt + roomOpts;

  // Operador: lembra seleção anterior
  const selOp = document.getElementById('op-room');
  if (selOp) {
    const prev = selOp.value;
    selOp.innerHTML = `<option value="">Escolha a sala</option>` + allOpt + roomOpts;
    if (prev && [...selOp.options].some(o => o.value === prev)) selOp.value = prev;
  }
}

function getTargetRooms(elId) {
  const val = document.getElementById(elId)?.value;
  if (!val) { addLog('warn', 'Escolha onde aplicar'); return null; }
  if (val === '__all__') return Object.keys(rooms);
  return rooms[val] ? [val] : null;
}

function targetLabel(ids) {
  const known = Object.keys(rooms);
  return ids.length === known.length ? 'todas' : ids.sort().join(', ');
}

function updatePanelState() {
  const ready = Object.keys(rooms).length > 0;
  document.querySelectorAll('.op-panel .btn, .sp-panel .btn').forEach(b => {
    b.disabled = !ready;
    b.style.opacity = ready ? '1' : '0.4';
  });
}

// ── Painel de Setpoints ───────────────────────────────────────────────────────

window.spApply = () => {
  const ids  = getTargetRooms('sp-room'); if (!ids) return;
  const temp = parseFloat(document.getElementById('sp-temp')?.value);
  const umid = parseFloat(document.getElementById('sp-umid')?.value);
  const lux  = parseFloat(document.getElementById('sp-lux')?.value);

  const payload = {};
  if (!isNaN(temp)) payload.setpoint_ac      = temp;
  if (!isNaN(umid)) payload.setpoint_umidade  = umid;
  if (!isNaN(lux))  payload.setpoint_luz      = lux;

  ids.forEach(id => pub(id, payload));
  addLog('cmd', `Setpoints → ${targetLabel(ids)} · AC ${temp}°C · umid ${umid}% · lux ${lux}`);
};

// ── Painel do Operador ────────────────────────────────────────────────────────

window.opApply = () => {
  const ids  = getTargetRooms('op-room'); if (!ids) return;
  const temp = parseFloat(document.getElementById('op-temp')?.value);
  const lux  = parseFloat(document.getElementById('op-lux')?.value);
  const umid = parseFloat(document.getElementById('op-umid')?.value);
  const togOn = id => document.getElementById(id)?.classList.contains('tog-on') ?? false;
  const auto  = togOn('op-auto');
  const pres  = togOn('op-pres');
  const ac    = togOn('op-ac');
  const luz   = togOn('op-luz');

  const payload = {
    setpoint_ac:      isNaN(temp) ? undefined : temp,
    setpoint_luz:     isNaN(lux)  ? undefined : lux,
    setpoint_umidade: isNaN(umid) ? undefined : umid,
    modo_ac:        auto ? 'ativo' : 'desativado',
    presenca_auto:  pres,
    comando:        ac  ? 'ligar' : 'desligar',
    luz:            luz ? 'ligar' : 'desligar',
  };
  Object.keys(payload).forEach(k => payload[k] === undefined && delete payload[k]);

  ids.forEach(id => pub(id, payload));
  addLog('cmd',
    `Operador → ${targetLabel(ids)} · ` +
    `${temp}°C · ${umid}% · ${lux}lx · ${auto ? 'auto' : 'manual'} · ` +
    `presença:${pres ? 'on' : 'off'} · AC:${ac ? 'on' : 'off'} · Luz:${luz ? 'on' : 'off'}`
  );
};

window.opSimular = () => {
  const ids = getTargetRooms('op-room'); if (!ids) return;
  ids.forEach(id => {
    const rnd = n => Math.random() * n;
    pubSensor(id, {
      id_sala:          id,
      temperatura:      +(20 + rnd(12)).toFixed(1),
      umidade:          +(40 + rnd(40)).toFixed(1),
      luminosidade:     Math.round(50 + rnd(800)),
      presenca:         Math.random() > 0.4,
      status_ac:        Math.random() > 0.5 ? 'ligado' : 'desligado',
      status_luz:       Math.random() > 0.5 ? 'ligado' : 'desligado',
      setpoint_ac:      +(20 + rnd(6)).toFixed(1),
      setpoint_umidade: 55,
      setpoint_luz:     300,
      modo_ac:          Math.random() > 0.3 ? 'ativo' : 'desativado',
      timestamp:        Math.floor(Date.now() / 1000),
    });
  });
  addLog('cmd', `Simulação → ${targetLabel(ids)} · temp, umid, lux, presença, AC, luz, modo`);
};

// ── UI helpers ────────────────────────────────────────────────────────────────
function setMQTT(ok) {
  const dot = document.getElementById('dot-mqtt');
  const lbl = document.getElementById('lbl-mqtt');
  if (!dot) return;
  dot.className = 'dot ' + (ok ? 'ok' : 'err');
  lbl.textContent = ok ? 'MQTT' : 'MQTT off';
}

function updateCounter() {
  document.getElementById('stat-rooms').textContent = Object.keys(rooms).length;
}

function tempClass(t) {
  if (t == null) return '';
  if (t < 20)  return 'cold';
  if (t < 24)  return 'cok';
  if (t < 28)  return 'warm';
  return 'hot';
}

function fmtTs(ts) {
  return ts ? new Date(ts * 1000).toLocaleTimeString('pt-BR') : '—';
}

// ── Card (apenas monitoramento) ───────────────────────────────────────────────
function cardHTML(id, d) {
  const acOn  = d.status_ac  === 'ligado';
  const luzOn = d.status_luz === 'ligado';
  const auto  = d.modo_ac    === 'ativo';
  const ic    = icData[id];

  const icT   = ic ? icGet(ic, 'temperatura') : null;
  const icU   = ic ? icGet(ic, 'umidade')     : null;
  const icTsv = ic ? icGetTs(ic, 'temperatura') : null;

  const title = id.replace(/^sala(\d+)$/, (_, n) => `Sala ${n.padStart(2, '0')}`);

  let icContent;
  if (ic === undefined) {
    icContent = `<span class="ic-nd">aguardando…</span>`;
  } else if (ic === null) {
    icContent = `<span class="ic-nd">sem resposta</span>`;
  } else if (icT != null) {
    icContent = `<span class="ic-val">${icT.toFixed(1)}°C · ${icU != null ? icU.toFixed(0) + '%' : '—'}</span>
                 <span class="ic-ts">${fmtIcTs(icTsv)}</span>`;
  } else {
    icContent = `<span class="ic-nd">recebido · sem valores</span>`;
  }

  const nd = (v, dec, u) => v != null ? `${typeof dec === 'number' ? v.toFixed(dec) : v}<small>${u}</small>` : `—`;

  return `
  <div class="card-head">
    <span class="card-title">${title}</span>
    <div class="card-tags">
      <span class="badge ${d.presenca ? 'b-pres' : 'b-off'}">${d.presenca ? '● Presente' : '○ Vazio'}</span>
      <span class="badge ${auto ? 'b-auto' : 'b-manual'}">${auto ? 'Auto' : 'Manual'}</span>
    </div>
  </div>

  <!-- Medidas atuais -->
  <div class="metrics">
    <div class="metric">
      <span class="mlbl">Temperatura</span>
      <span class="mval ${tempClass(d.temperatura)}">${nd(d.temperatura, 1, '°C')}</span>
    </div>
    <div class="metric">
      <span class="mlbl">Umidade</span>
      <span class="mval">${nd(d.umidade, 0, '%')}</span>
    </div>
    <div class="metric">
      <span class="mlbl">Luminosidade</span>
      <span class="mval">${nd(d.luminosidade, null, ' lx')}</span>
    </div>
  </div>

  <!-- Setpoints definidos -->
  <div class="sp-metrics">
    <div class="sp-metric">
      <span class="sp-mlbl">SP Temperatura</span>
      <span class="sp-mval">${d.setpoint_ac != null ? d.setpoint_ac + '<small>°C</small>' : '—'}</span>
    </div>
    <div class="sp-metric">
      <span class="sp-mlbl">SP Umidade</span>
      <span class="sp-mval">${d.setpoint_umidade != null ? d.setpoint_umidade + '<small>%</small>' : '—'}</span>
    </div>
    <div class="sp-metric">
      <span class="sp-mlbl">SP Luminosidade</span>
      <span class="sp-mval">${d.setpoint_luz != null ? d.setpoint_luz + '<small> lx</small>' : '—'}</span>
    </div>
  </div>

  <!-- Status operacional -->
  <div class="status-row">
    <span class="stag ${acOn  ? 'st-on' : 'st-off'}">AC ${acOn  ? 'Ligado' : 'Desligado'}</span>
    <span class="stag ${luzOn ? 'st-on' : 'st-off'}">Luz ${luzOn ? 'Ligada' : 'Desligada'}</span>
  </div>

  <div class="ic-row">
    <span class="ic-lbl">IC</span>
    ${icContent}
  </div>

  <div class="card-foot">
    <span>${id}</span>
    <span>↻ ${fmtTs(d.timestamp)}</span>
  </div>`;
}

function upsertCard(id, data) {
  document.getElementById('empty-state')?.remove();
  let card = document.getElementById(`card-${id}`);
  if (!card) {
    card = document.createElement('div');
    card.className = 'room-card';
    card.id = `card-${id}`;
    const grid  = document.getElementById('room-grid');
    const cards = [...grid.querySelectorAll('.room-card')];
    const next  = cards.find(c => c.id > `card-${id}`);
    grid.insertBefore(card, next || null);
  }
  card.innerHTML = cardHTML(id, data);
  card.classList.remove('flash');
  void card.offsetWidth;
  card.classList.add('flash');
}

function refreshCard(id) {
  if (rooms[id]) upsertCard(id, rooms[id]);
}

// ── Relógio ───────────────────────────────────────────────────────────────────
setInterval(() => {
  document.getElementById('footer-time').textContent = new Date().toLocaleTimeString('pt-BR');
}, 1000);

// ── Init ──────────────────────────────────────────────────────────────────────
setICStatus(false);
updatePanelState();
connect();
