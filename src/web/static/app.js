'use strict';

const MQTT_HOST = window.location.hostname;
const MQTT_PORT = window.location.port
  ? parseInt(window.location.port, 10)
  : (window.location.protocol === 'https:' ? 443 : 80);
const MQTT_PATH = '/mqtt';
const MQTT_TOPIC = 'ac-iot/+/sensores';
const DEFAULT_ZONE_SIZE = 25;
const OFFLINE_AFTER_MS = 70000;
const CRITICAL_TEMP_FACTOR = 1.3;
const HIGH_AC_SETPOINT = 26;

const rooms = {};
const icData = {};
const logItems = [];

let client = null;
let reconnectTimer = null;
let renderTimer = null;
let roomFilter = '';
let statusFilter = 'all';
let zoneSize = DEFAULT_ZONE_SIZE;
let selectedZone = null;
let selectedRoom = null;
let icEverOk = false;
let lastIcOk = false;
let received = 0;
let lastMqttAt = 0;

class MqttWsClient {
  constructor(url, clientId) {
    this.url = url;
    this.clientId = clientId;
    this.ws = null;
    this.packetId = 1;
    this.onConnectionLost = null;
    this.onMessageArrived = null;
    this.keepAliveTimer = null;
  }

  isConnected() {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  connect(opts) {
    this.ws = new WebSocket(this.url, 'mqtt');
    this.ws.binaryType = 'arraybuffer';
    this.ws.onopen = () => this.ws.send(this.connectPacket());
    this.ws.onerror = () => opts.onFailure?.({ errorMessage: 'WebSocket MQTT falhou' });
    this.ws.onclose = () => {
      clearInterval(this.keepAliveTimer);
      this.onConnectionLost?.({ errorCode: 1, errorMessage: 'conexao fechada' });
    };
    this.ws.onmessage = (ev) => {
      const bytes = new Uint8Array(ev.data);
      const type = bytes[0] >> 4;
      if (type === 2) {
        this.keepAliveTimer = setInterval(() => this.ping(), 25000);
        opts.onSuccess?.();
      } else if (type === 3) {
        const msg = this.parsePublish(bytes);
        if (msg) this.onMessageArrived?.(msg);
      }
    };
  }

  subscribe(topic) {
    this.ws.send(this.subscribePacket(topic));
  }

  sendMessage(topic, payload) {
    this.ws.send(this.publishPacket(topic, payload));
  }

  ping() {
    if (this.isConnected()) this.ws.send(new Uint8Array([0xc0, 0x00]));
  }

  encodeString(value) {
    const enc = new TextEncoder().encode(value);
    return [enc.length >> 8, enc.length & 255, ...enc];
  }

  encodeLength(len) {
    const out = [];
    do {
      let digit = len % 128;
      len = Math.floor(len / 128);
      if (len > 0) digit |= 128;
      out.push(digit);
    } while (len > 0);
    return out;
  }

  connectPacket() {
    const vh = [...this.encodeString('MQTT'), 4, 2, 0, 30];
    const payload = this.encodeString(this.clientId);
    const rem = [...vh, ...payload];
    return new Uint8Array([0x10, ...this.encodeLength(rem.length), ...rem]);
  }

  subscribePacket(topic) {
    const id = this.packetId++ & 0xffff;
    const payload = [...this.encodeString(topic), 0];
    const rem = [id >> 8, id & 255, ...payload];
    return new Uint8Array([0x82, ...this.encodeLength(rem.length), ...rem]);
  }

  publishPacket(topic, payload) {
    const body = new TextEncoder().encode(payload);
    const rem = [...this.encodeString(topic), ...body];
    return new Uint8Array([0x30, ...this.encodeLength(rem.length), ...rem]);
  }

  parsePublish(bytes) {
    let mul = 1, len = 0, pos = 1, digit;
    do {
      digit = bytes[pos++];
      len += (digit & 127) * mul;
      mul *= 128;
    } while (digit & 128);
    const topicLen = (bytes[pos] << 8) + bytes[pos + 1];
    pos += 2;
    const topic = new TextDecoder().decode(bytes.slice(pos, pos + topicLen));
    pos += topicLen;
    const payload = new TextDecoder().decode(bytes.slice(pos, 1 + this.encodeLength(len).length + len));
    return { destinationName: topic, payloadString: payload };
  }
}

function roomIndex(roomId) {
  const m = String(roomId).match(/(\d+)/);
  return m ? parseInt(m[1], 10) : 0;
}

function roomLabel(roomId) {
  const idx = roomIndex(roomId);
  return idx ? `Sala ${String(idx).padStart(4, '0')}` : roomId;
}

function roomUuid(roomId) {
  const idx = roomIndex(roomId);
  if (!idx) return null;
  return '00000000-0000-4000-8000-' + String(100 + idx).padStart(12, '0');
}

function icCaps(raw) {
  if (!raw || typeof raw !== 'object') return null;
  if (Array.isArray(raw.resources) && raw.resources[0]?.capabilities) return raw.resources[0].capabilities;
  if (raw.data?.capabilities) return raw.data.capabilities;
  if (Array.isArray(raw.data) && raw.data[0]?.capabilities) return raw.data[0].capabilities;
  return raw.capabilities || raw.data || raw;
}

function icValue(caps, name) {
  const value = caps?.[name];
  if (Array.isArray(value)) return value[0]?.value ?? '--';
  if (value && typeof value === 'object' && 'value' in value) return value.value;
  return value ?? '--';
}

function icSummary(raw) {
  const caps = icCaps(raw);
  if (!caps) return '<div class="empty-detail">InterSCity sem dados normalizados para esta sala.</div>';
  return `<div class="ic-grid">
    <div><span>Temperatura</span><strong>${icValue(caps, 'temperatura')}</strong></div>
    <div><span>Umidade</span><strong>${icValue(caps, 'umidade')}</strong></div>
    <div><span>Luminosidade</span><strong>${icValue(caps, 'luminosidade')}</strong></div>
    <div><span>Presenca</span><strong>${icValue(caps, 'presenca')}</strong></div>
    <div><span>AC</span><strong>${icValue(caps, 'status_ac')}</strong></div>
    <div><span>Luz</span><strong>${icValue(caps, 'status_luz')}</strong></div>
  </div>`;
}

function seedInventory(count = 1000) {
  for (let i = 1; i <= count; i++) {
    const id = i <= 99 ? `sala${String(i).padStart(2, '0')}` : `sala${String(i).padStart(4, '0')}`;
    rooms[id] = rooms[id] || {
      id_sala: id,
      temperatura: null,
      umidade: null,
      luminosidade: null,
      presenca: false,
      status_ac: 'desconhecido',
      status_luz: 'desconhecido',
      modo_ac: 'desconhecido',
      _seenAt: 0,
    };
  }
}

function zoneOf(roomId) {
  const idx = roomIndex(roomId);
  if (!idx) return 'sem-bloco';
  return `B${String(Math.ceil(idx / zoneSize)).padStart(2, '0')}`;
}

function sortedRoomIds() {
  return Object.keys(rooms).sort((a, b) => roomIndex(a) - roomIndex(b));
}

function isOffline(room) {
  return !room?._seenAt || Date.now() - room._seenAt > OFFLINE_AFTER_MS;
}

function isAlert(room) {
  if (!room) return false;
  return isOffline(room) || isCriticalTemp(room) || room.umidade >= 75 || room.luminosidade < 20;
}

function isCriticalTemp(room) {
  if (!room?.presenca) return false;
  if (typeof room.temperatura !== 'number' || typeof room.setpoint_ac !== 'number') return false;
  const acOff = room.status_ac !== 'ligado';
  const highSetpoint = room.setpoint_ac >= HIGH_AC_SETPOINT;
  return room.temperatura >= room.setpoint_ac * CRITICAL_TEMP_FACTOR && (acOff || highSetpoint);
}

function criticalRoomIds() {
  return sortedRoomIds().filter(id => isCriticalTemp(rooms[id]));
}

function filteredRoomIds() {
  const q = roomFilter.trim().toLowerCase();
  return sortedRoomIds().filter(id => {
    const room = rooms[id];
    const zone = zoneOf(id).toLowerCase();
    const matchesText = !q || id.toLowerCase().includes(q) || roomLabel(id).toLowerCase().includes(q) || zone.includes(q);
    if (!matchesText) return false;
    if (statusFilter === 'alert') return isAlert(room);
    if (statusFilter === 'critical-temp') return isCriticalTemp(room);
    if (statusFilter === 'online') return !isOffline(room);
    if (statusFilter === 'offline') return isOffline(room);
    if (statusFilter === 'presence') return !!room.presenca;
    return true;
  });
}

function fmtNum(v, dec = 1, suffix = '') {
  return typeof v === 'number' ? `${v.toFixed(dec)}${suffix}` : '--';
}

function fmtHeartbeat(room) {
  if (!room?._seenAt) return '--';
  const age = Math.floor((Date.now() - room._seenAt) / 1000);
  return age < 2 ? 'agora' : `${age}s`;
}

function addLog(type, msg) {
  logItems.unshift({ type, msg, ts: new Date().toLocaleTimeString('pt-BR') });
  if (logItems.length > 180) logItems.pop();
  renderLog();
}

function renderLog() {
  const feed = document.getElementById('log-feed');
  if (!feed) return;
  feed.innerHTML = logItems.slice(0, 80).map(e =>
    `<div class="event event-${e.type}">
      <span>${e.ts}</span>
      <strong>${e.msg}</strong>
    </div>`
  ).join('');
}

window.clearLog = () => {
  logItems.length = 0;
  renderLog();
};

function setMQTT(ok) {
  document.getElementById('dot-mqtt').className = 'dot ' + (ok ? 'ok' : 'err');
  document.getElementById('lbl-mqtt').textContent = ok ? 'MQTT ao vivo' : 'MQTT off';
}

function refreshMqttStatus() {
  const live = lastMqttAt && Date.now() - lastMqttAt < OFFLINE_AFTER_MS;
  if (live) {
    document.getElementById('dot-mqtt').className = 'dot ok';
    document.getElementById('lbl-mqtt').textContent = `MQTT ao vivo · ${received}`;
  }
}

function setICStatus(ok) {
  lastIcOk = ok;
  const dot = document.getElementById('dot-ic');
  dot.className = 'dot ' + (ok ? 'ok' : (icEverOk ? 'warn' : 'idle'));
  document.getElementById('lbl-ic').textContent = ok ? 'InterSCity conectado' : 'InterSCity off';
  if (ok) icEverOk = true;
}

async function checkInterSCityStatus({ log = false } = {}) {
  try {
    const res = await fetch('/api/ic/catalog/capabilities', {
      cache: 'no-store',
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok && res.status !== 304) throw new Error(`HTTP ${res.status}`);
    if (res.status !== 304) await res.json();
    const changed = !lastIcOk;
    setICStatus(true);
    if (log || changed) addLog('ic', 'InterSCity conectado');
  } catch (e) {
    const changed = lastIcOk;
    setICStatus(false);
    if (log || changed) addLog('warn', `InterSCity indisponivel: ${e.message}`);
  }
}

function connect() {
  clearTimeout(reconnectTimer);
  const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
  const hosts = [MQTT_HOST];
  const paths = [MQTT_PATH];
  const candidates = hosts.flatMap(host => paths.map(path => `${proto}://${host}:${MQTT_PORT}${path}`));
  let candidateIndex = 0;

  const tryCandidate = () => {
    const url = candidates[candidateIndex % candidates.length];
    candidateIndex++;
    client = new MqttWsClient(url, 'ops_' + Math.random().toString(36).slice(2, 9));

    client.onConnectionLost = ({ errorCode, errorMessage }) => {
      setMQTT(false);
      if (errorCode !== 0) {
        addLog('warn', `MQTT desconectado: ${errorMessage || 'erro'}`);
        reconnectTimer = setTimeout(connect, 4000);
      }
    };

    client.onMessageArrived = ({ destinationName, payloadString }) => {
      try {
        const data = JSON.parse(payloadString);
        const id = data.id_sala || destinationName.split('/')[1];
        const previous = rooms[id];
        rooms[id] = { ...previous, ...data, _seenAt: Date.now() };
        selectedRoom = selectedRoom || id;
        received++;
        lastMqttAt = Date.now();
        refreshMqttStatus();

        if (isCriticalTemp(rooms[id]) && !isCriticalTemp(previous)) {
          addLog('warn', `${roomLabel(id)} temp. critica ${data.temperatura.toFixed(1)}C`);
        } else if (received <= 8 || received % 250 === 0) {
          addLog('mqtt', `${received} mensagens MQTT recebidas`);
        }
        scheduleRender();
      } catch (e) {
        addLog('warn', `payload invalido: ${e.message}`);
      }
    };

    client.connect({
      onSuccess: () => {
        setMQTT(true);
        client.subscribe(MQTT_TOPIC);
        addLog('ok', `MQTT conectado em ${url}`);
      },
      onFailure: ({ errorMessage }) => {
        setMQTT(false);
        addLog('warn', `falha MQTT em ${url}: ${errorMessage || 'timeout'}`);
        if (candidateIndex < candidates.length) setTimeout(tryCandidate, 600);
        else reconnectTimer = setTimeout(connect, 5000);
      },
    });
  };

  tryCandidate();
}

function scheduleRender() {
  clearTimeout(renderTimer);
  renderTimer = setTimeout(renderAll, 250);
}

function aggregate() {
  const ids = sortedRoomIds();
  const zones = {};
  const totals = {
    total: ids.length,
    offline: 0,
    presence: 0,
    ac: 0,
    light: 0,
    hot: 0,
    tempSum: 0,
    tempCount: 0,
    hotTempSum: 0,
    hotTempCount: 0,
    humiditySum: 0,
    humidityCount: 0,
  };

  ids.forEach(id => {
    const room = rooms[id];
    const zone = zoneOf(id);
    if (!zones[zone]) {
      zones[zone] = {
        id: zone,
        total: 0,
        offline: 0,
        presence: 0,
        ac: 0,
        light: 0,
        hot: 0,
        tempSum: 0,
        tempCount: 0,
        humiditySum: 0,
        humidityCount: 0,
      };
    }
    const z = zones[zone];
    z.total++;
    if (isOffline(room)) { totals.offline++; z.offline++; }
    if (room.presenca) { totals.presence++; z.presence++; }
    if (room.status_ac === 'ligado') { totals.ac++; z.ac++; }
    if (room.status_luz === 'ligado') { totals.light++; z.light++; }
    if (isCriticalTemp(room)) {
      totals.hot++;
      totals.hotTempSum += room.temperatura;
      totals.hotTempCount++;
      z.hot++;
    }
    if (typeof room.temperatura === 'number') {
      totals.tempSum += room.temperatura; totals.tempCount++;
      z.tempSum += room.temperatura; z.tempCount++;
    }
    if (typeof room.umidade === 'number') {
      totals.humiditySum += room.umidade; totals.humidityCount++;
      z.humiditySum += room.umidade; z.humidityCount++;
    }
  });

  return { ids, zones: Object.values(zones).sort((a, b) => a.id.localeCompare(b.id)), totals };
}

function renderAll() {
  const data = aggregate();
  renderKpis(data.totals);
  renderZones(data.zones);
  renderTable(filteredRoomIds());
  renderSelected();
  syncScopeLabel();
}

function renderKpis(t) {
  document.getElementById('kpi-total').textContent = t.total;
  document.getElementById('kpi-offline').textContent = t.offline;
  document.getElementById('kpi-presence').textContent = t.presence;
  document.getElementById('kpi-ac').textContent = t.ac;
  document.getElementById('kpi-light').textContent = t.light;
  document.getElementById('kpi-humidity').textContent = t.humidityCount ? `${(t.humiditySum / t.humidityCount).toFixed(0)}%` : '--';
  document.getElementById('kpi-temp').textContent = t.tempCount ? `${(t.tempSum / t.tempCount).toFixed(1)}C` : '--';
  document.getElementById('kpi-hot').textContent = t.hot;
  document.getElementById('kpi-hot-avg').textContent = t.hotTempCount ? `${(t.hotTempSum / t.hotTempCount).toFixed(1)}C` : '--';
}

function renderZones(zones) {
  const criticalMode = statusFilter === 'critical-temp';
  const criticalIds = criticalMode ? criticalRoomIds() : [];
  const visibleZones = criticalMode ? zones.filter(z => z.hot > 0) : zones;
  document.getElementById('zone-caption').textContent = criticalMode
    ? `${criticalIds.length} salas criticas · ${visibleZones.length} blocos afetados`
    : `${zones.length} blocos · ${zoneSize} salas por bloco`;
  const board = document.getElementById('zone-board');
  if (!visibleZones.length) {
    board.innerHTML = '<div class="empty-detail">Nenhuma sala com temperatura critica agora.</div>';
    return;
  }
  board.innerHTML = visibleZones.map(z => {
    const avg = z.tempCount ? z.tempSum / z.tempCount : null;
    const humidity = z.humidityCount ? z.humiditySum / z.humidityCount : null;
    const level = z.offline || z.hot ? 'bad' : (z.presence || z.ac ? 'busy' : 'ok');
    const active = selectedZone === z.id ? 'active' : '';
    return `<button class="zone-tile ${level} ${active}" onclick="selectZone('${z.id}')">
      <span class="zone-id">${z.id}</span>
      <span class="zone-temp">${avg ? avg.toFixed(1) + 'C' : '--'}</span>
      <span class="zone-line">${z.total} salas · ${z.presence} pres.</span>
      <span class="zone-line">${z.ac} ar · ${z.light} luz · ${humidity ? humidity.toFixed(0) + '% umid' : '--'}</span>
      <span class="zone-line">${z.hot} crit · ${z.offline} off</span>
    </button>`;
  }).join('');
}

function renderTable(ids) {
  const tbody = document.getElementById('room-tbody');
  document.getElementById('table-caption').textContent = `${ids.length} salas filtradas`;
  tbody.innerHTML = ids.map(id => {
    const r = rooms[id];
    const cls = isAlert(r) ? 'row-alert' : '';
    const selected = selectedRoom === id ? 'selected' : '';
    return `<tr class="${cls} ${selected}" onclick="selectRoom('${id}')">
      <td><strong>${roomLabel(id)}</strong><small>${id}</small></td>
      <td>${zoneOf(id)}</td>
      <td>${fmtNum(r.temperatura, 1, 'C')}</td>
      <td>${fmtNum(r.umidade, 0, '%')}</td>
      <td>${fmtNum(r.luminosidade, 0, ' lx')}</td>
      <td>${r.presenca ? 'sim' : 'nao'}</td>
      <td>${r.status_ac || '--'}</td>
      <td>${r.modo_ac || '--'}</td>
      <td>${isOffline(r) ? '<b>offline</b>' : fmtHeartbeat(r)}</td>
    </tr>`;
  }).join('');
}

function renderSelected() {
  const body = document.getElementById('selected-body');
  const title = document.getElementById('selected-title');
  if (!selectedRoom || !rooms[selectedRoom]) {
    title.textContent = 'nenhuma sala';
    body.innerHTML = '<div class="empty-detail">Selecione uma sala na tabela para consultar o InterSCity.</div>';
    return;
  }
  const r = rooms[selectedRoom];
  const ic = icData[selectedRoom];
  title.textContent = `${roomLabel(selectedRoom)} · ${zoneOf(selectedRoom)}`;
  body.innerHTML = `
    <div class="detail-grid">
      <div><span>Temperatura</span><strong>${fmtNum(r.temperatura, 1, 'C')}</strong></div>
      <div><span>Umidade</span><strong>${fmtNum(r.umidade, 0, '%')}</strong></div>
      <div><span>Luminosidade</span><strong>${fmtNum(r.luminosidade, 0, ' lx')}</strong></div>
      <div><span>Presenca</span><strong>${r.presenca ? 'sim' : 'nao'}</strong></div>
      <div><span>AC</span><strong>${r.status_ac || '--'}</strong></div>
      <div><span>Luz</span><strong>${r.status_luz || '--'}</strong></div>
      <div><span>Modo</span><strong>${r.modo_ac || '--'}</strong></div>
      <div><span>Heartbeat</span><strong>${fmtHeartbeat(r)}</strong></div>
    </div>
    <div class="ic-detail">
      <strong>InterSCity</strong>
      <div class="ic-state" id="ic-query-state">${ic ? 'Ultima consulta carregada.' : 'Clique em Consultar IC para buscar a leitura registrada.'}</div>
      ${ic ? icSummary(ic) : '<div class="empty-detail">Sem consulta carregada para esta sala.</div>'}
    </div>
  `;
}

function publish(roomId, payload) {
  if (!client?.isConnected()) {
    addLog('warn', 'MQTT nao conectado');
    return;
  }
  client.sendMessage(`ac-iot/${roomId}/comando`, JSON.stringify(payload));
}

function targetRooms() {
  const scope = document.getElementById('cmd-scope').value;
  if (scope === 'selected') return selectedRoom ? [selectedRoom] : [];
  if (scope === 'zone') return selectedZone ? sortedRoomIds().filter(id => zoneOf(id) === selectedZone) : [];
  if (scope === 'filtered') return filteredRoomIds();
  if (scope === 'critical-temp') return criticalRoomIds();
  return sortedRoomIds();
}

window.applyCommand = () => {
  const ids = targetRooms();
  if (!ids.length) {
    addLog('warn', 'nenhuma sala no escopo do comando');
    return;
  }
  const payload = {
    setpoint_ac: parseFloat(document.getElementById('cmd-temp').value),
    setpoint_umidade: parseFloat(document.getElementById('cmd-umid').value),
    setpoint_luz: parseInt(document.getElementById('cmd-lux').value, 10),
    modo_ac: document.getElementById('cmd-auto').classList.contains('active') ? 'ativo' : 'desativado',
    comando: document.getElementById('cmd-ac').classList.contains('active') ? 'ligar' : 'desligar',
    luz: document.getElementById('cmd-light').classList.contains('active') ? 'ligar' : 'desligar',
  };
  ids.forEach(id => publish(id, payload));
  addLog('cmd', `comando aplicado em ${ids.length} salas`);
};

window.syncCommandRanges = () => {
  const temp = document.getElementById('cmd-temp').value;
  const umid = document.getElementById('cmd-umid').value;
  const lux = document.getElementById('cmd-lux').value;
  document.getElementById('cmd-temp-value').textContent = `${Number(temp).toFixed(Number(temp) % 1 ? 1 : 0)}C`;
  document.getElementById('cmd-umid-value').textContent = `${umid}%`;
  document.getElementById('cmd-lux-value').textContent = `${lux} lx`;
};

window.requestSelectedIC = async () => {
  const roomId = selectedRoom;
  const state = document.getElementById('ic-query-state');
  const button = document.getElementById('btn-ic-query');
  if (!roomId) {
    if (state) state.textContent = 'Selecione uma sala antes de consultar.';
    addLog('warn', 'selecione uma sala para consultar o InterSCity');
    return;
  }
  const uuid = roomUuid(roomId);
  if (!uuid) return addLog('warn', `UUID invalido para ${roomId}`);
  if (state) state.textContent = `Consultando ${roomLabel(roomId)}...`;
  if (button) button.disabled = true;
  try {
    const res = await fetch(`/api/ic/collector/resources/${uuid}/data/last`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    icData[roomId] = await res.json();
    setICStatus(true);
    if (state) state.textContent = `${roomLabel(roomId)} atualizada via InterSCity.`;
    addLog('ic', `${roomLabel(roomId)} atualizado via InterSCity`);
  } catch (e) {
    setICStatus(false);
    if (state) state.textContent = `Falha na consulta: ${e.message}`;
    addLog('warn', `InterSCity falhou para ${roomLabel(roomId)}: ${e.message}`);
  } finally {
    if (button) button.disabled = false;
  }
  renderAll();
};

window.selectZone = (zone) => {
  selectedZone = selectedZone === zone ? null : zone;
  document.getElementById('cmd-scope').value = selectedZone ? 'zone' : 'all';
  if (selectedZone) roomFilter = selectedZone.toLowerCase();
  document.getElementById('room-filter').value = selectedZone || '';
  renderAll();
};

window.selectRoom = (id) => {
  selectedRoom = id;
  renderAll();
};

window.setRoomFilter = (value) => {
  roomFilter = value || '';
  selectedZone = null;
  renderAll();
};

window.setStatusFilter = (value) => {
  statusFilter = value;
  if (value === 'critical-temp') document.getElementById('cmd-scope').value = 'critical-temp';
  renderAll();
};

window.setZoneSize = (value) => {
  if (value === 'critical-temp') {
    statusFilter = 'critical-temp';
    selectedZone = null;
    roomFilter = '';
    document.getElementById('status-filter').value = 'critical-temp';
    document.getElementById('cmd-scope').value = 'critical-temp';
    document.getElementById('room-filter').value = '';
    renderAll();
    return;
  }
  statusFilter = 'all';
  document.getElementById('status-filter').value = 'all';
  zoneSize = parseInt(value, 10) || DEFAULT_ZONE_SIZE;
  selectedZone = null;
  renderAll();
};

window.toggleButton = (button) => {
  button.classList.toggle('active');
};

window.syncScopeLabel = () => {
  const ids = targetRooms();
  document.getElementById('command-scope-label').textContent = `escopo: ${ids.length} salas`;
};

setInterval(() => {
  document.getElementById('footer-time').textContent = new Date().toLocaleTimeString('pt-BR');
  refreshMqttStatus();
  renderAll();
}, 5000);

setInterval(() => checkInterSCityStatus(), 30000);

seedInventory(1000);
syncCommandRanges();
setICStatus(false);
setMQTT(false);
renderAll();
connect();
checkInterSCityStatus({ log: true });
