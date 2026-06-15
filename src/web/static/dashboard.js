'use strict';

const MQTT_HOST = window.location.hostname;
const MQTT_PORT = window.location.port
  ? parseInt(window.location.port, 10)
  : (window.location.protocol === 'https:' ? 443 : 80);
const MQTT_PATH = '/mqtt';
const MQTT_TOPIC = 'ac-iot/#';
const OFFLINE_AFTER_MS = 70000;
const CRITICAL_TEMP_FACTOR = 1.3;
const HIGH_AC_SETPOINT = 26;
const HISTORY_SIZE = 90;
const RATE_WINDOW_MS = 60000;

const rooms = {};
const events = [];
const mqttSamples = [];
const history = {
  messages: [],
  traffic: [],
  icThroughput: [],
  rooms: [],
};

let client = null;
let reconnectTimer = null;
let lastMqttAt = 0;
let bridgeMetrics = null;
let previousBridgeMetrics = null;
let bridgeMetricsAt = 0;
let bridgeRate = { sentPerSec: 0, bytesPerSec: 0 };

const metrics = {
  sensorRx: 0,
  commandRx: 0,
  bytesRx: 0,
  badPayload: 0,
  icRequests: 0,
  icSuccess: 0,
  icFail: 0,
  icBytes: 0,
  icLatencySum: 0,
  icLastMs: null,
  icLastStatus: '--',
  icLastOkAt: 0,
};

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
        if (msg) this.onMessageArrived?.({ ...msg, packetBytes: bytes.length });
      }
    };
  }

  subscribe(topic) {
    this.ws.send(this.subscribePacket(topic));
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

function $(id) {
  return document.getElementById(id);
}

function fmtInt(v) {
  return Math.round(v).toLocaleString('pt-BR');
}

function fmtBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function addEvent(type, msg) {
  events.unshift({ type, msg, ts: new Date().toLocaleTimeString('pt-BR') });
  if (events.length > 120) events.pop();
  renderLog();
}

function renderLog() {
  const feed = $('dash-log');
  if (!feed) return;
  feed.innerHTML = events.slice(0, 60).map(e =>
    `<div class="event event-${e.type}">
      <span>${e.ts}</span>
      <strong>${e.msg}</strong>
    </div>`
  ).join('');
}

window.clearDashboardLog = () => {
  events.length = 0;
  renderLog();
};

function setMqttStatus(ok) {
  $('dot-mqtt').className = 'dot ' + (ok ? 'ok' : 'err');
  $('lbl-mqtt').textContent = ok ? 'MQTT ao vivo' : 'MQTT off';
}

function setIcStatus(state, label = '') {
  const status = state === true ? 'ok' : (state === 'warn' ? 'warn' : 'idle');
  $('dot-ic').className = `dot ${status}`;
  $('lbl-ic').textContent = label || (state === true ? 'InterSCity via bridge' : 'InterSCity sem metrica');
}

function roomIndex(roomId) {
  const m = String(roomId).match(/(\d+)/);
  return m ? parseInt(m[1], 10) : 0;
}

function roomUuid(roomId) {
  const idx = roomIndex(roomId);
  if (!idx) return null;
  return '00000000-0000-4000-8000-' + String(100 + idx).padStart(12, '0');
}

function isOffline(room) {
  return !room?._seenAt || Date.now() - room._seenAt > OFFLINE_AFTER_MS;
}

function isCriticalTemp(room) {
  if (!room?.presenca) return false;
  if (typeof room.temperatura !== 'number' || typeof room.setpoint_ac !== 'number') return false;
  const acOff = room.status_ac !== 'ligado';
  const highSetpoint = room.setpoint_ac >= HIGH_AC_SETPOINT;
  return room.temperatura >= room.setpoint_ac * CRITICAL_TEMP_FACTOR && (acOff || highSetpoint);
}

function roomTotals() {
  const ids = Object.keys(rooms);
  const total = {
    known: ids.length,
    online: 0,
    presence: 0,
    ac: 0,
    light: 0,
    critical: 0,
  };
  ids.forEach(id => {
    const room = rooms[id];
    if (!isOffline(room)) total.online++;
    if (room.presenca) total.presence++;
    if (room.status_ac === 'ligado') total.ac++;
    if (room.status_luz === 'ligado') total.light++;
    if (isCriticalTemp(room)) total.critical++;
  });
  return total;
}

function connectMqtt() {
  clearTimeout(reconnectTimer);
  const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
  const url = `${proto}://${MQTT_HOST}:${MQTT_PORT}${MQTT_PATH}`;
  client = new MqttWsClient(url, 'dash_' + Math.random().toString(36).slice(2, 9));

  client.onConnectionLost = ({ errorCode, errorMessage }) => {
    setMqttStatus(false);
    if (errorCode !== 0) {
      addEvent('warn', `MQTT desconectado: ${errorMessage || 'erro'}`);
      reconnectTimer = setTimeout(connectMqtt, 4000);
    }
  };

  client.onMessageArrived = ({ destinationName, payloadString, packetBytes }) => {
    const now = Date.now();
    const bytes = packetBytes || payloadString.length;
    lastMqttAt = now;
    metrics.bytesRx += bytes;
    mqttSamples.push({ at: now, bytes });
    pruneSamples(now);

    if (destinationName === 'ac-iot/system/bridge_metrics') {
      try {
        handleBridgeMetrics(JSON.parse(payloadString), now);
      } catch {
        metrics.badPayload++;
      }
      return;
    }

    if (destinationName.endsWith('/sensores')) {
      metrics.sensorRx++;
      try {
        const data = JSON.parse(payloadString);
        const id = data.id_sala || destinationName.split('/')[1];
        rooms[id] = { ...rooms[id], ...data, _seenAt: Date.now() };
      } catch {
        metrics.badPayload++;
      }
    } else if (destinationName.endsWith('/comando')) {
      metrics.commandRx++;
    }
  };

  client.connect({
    onSuccess: () => {
      setMqttStatus(true);
      client.subscribe(MQTT_TOPIC);
      addEvent('ok', `MQTT conectado em ${url}`);
    },
    onFailure: ({ errorMessage }) => {
      setMqttStatus(false);
      addEvent('warn', `falha MQTT: ${errorMessage || 'timeout'}`);
      reconnectTimer = setTimeout(connectMqtt, 5000);
    },
  });
}

function pruneSamples(now = Date.now()) {
  while (mqttSamples.length && now - mqttSamples[0].at > RATE_WINDOW_MS) mqttSamples.shift();
}

function windowStats(now = Date.now()) {
  pruneSamples(now);
  const bytes = mqttSamples.reduce((sum, s) => sum + s.bytes, 0);
  return {
    messagesPerSec: mqttSamples.length / (RATE_WINDOW_MS / 1000),
    kbPerSec: (bytes / 1024) / (RATE_WINDOW_MS / 1000),
  };
}

function handleBridgeMetrics(data, now) {
  previousBridgeMetrics = bridgeMetrics;
  bridgeMetrics = data;
  bridgeMetricsAt = now;

  if (previousBridgeMetrics) {
    const prevTs = Number(previousBridgeMetrics.timestamp_ms) || now - 2000;
    const currTs = Number(data.timestamp_ms) || now;
    const seconds = Math.max(1, (currTs - prevTs) / 1000);
    const sentDelta = Math.max(0, Number(data.sent || 0) - Number(previousBridgeMetrics.sent || 0));
    const prevBytes = Number(previousBridgeMetrics.request_bytes || 0) + Number(previousBridgeMetrics.response_bytes || 0);
    const currBytes = Number(data.request_bytes || 0) + Number(data.response_bytes || 0);
    bridgeRate = {
      sentPerSec: sentDelta / seconds,
      bytesPerSec: Math.max(0, currBytes - prevBytes) / seconds,
    };
  } else {
    bridgeRate = {
      sentPerSec: Number(data.sent_per_sec || 0),
      bytesPerSec: Number(data.bytes_per_sec || 0),
    };
  }

  metrics.icRequests = Number(data.total_attempted || 0);
  metrics.icSuccess = Number(data.sent || 0);
  metrics.icFail = Number(data.failed || 0);
  metrics.icBytes = Number(data.request_bytes || 0) + Number(data.response_bytes || 0);
  metrics.icLastMs = Number(data.latency_ms_avg || 0);
  metrics.icLastStatus = data.last_ok ? `ok HTTP ${data.last_status || 0}` : `falha HTTP ${data.last_status || 0}`;
  if (data.last_ok) metrics.icLastOkAt = now;
  if (data.last_ok) {
    setIcStatus(true, 'InterSCity via bridge');
  } else if (metrics.icSuccess > 0 || metrics.icRequests > 0) {
    setIcStatus('warn', 'InterSCity instavel');
  } else {
    setIcStatus(false, 'InterSCity sem metrica');
  }
}

function pushHistory(name, value) {
  history[name].push(value);
  if (history[name].length > HISTORY_SIZE) history[name].shift();
}

function updateTick() {
  const stats = windowStats();
  const totals = roomTotals();

  pushHistory('messages', stats.messagesPerSec);
  pushHistory('traffic', stats.kbPerSec);
  pushHistory('icThroughput', bridgeRate.sentPerSec);
  pushHistory('rooms', totals.critical);

  render(totals, stats);
}

function render(totals = roomTotals(), stats = windowStats()) {
  const processed = metrics.sensorRx + metrics.commandRx;
  const icOkRate = metrics.icRequests ? (metrics.icSuccess * 100 / metrics.icRequests) : 0;
  const icAvg = bridgeMetrics ? Number(bridgeMetrics.latency_ms_avg || 0) : null;
  const mqttLive = lastMqttAt && Date.now() - lastMqttAt < OFFLINE_AFTER_MS;

  $('footer-time').textContent = new Date().toLocaleTimeString('pt-BR');
  $('lbl-mqtt').textContent = mqttLive ? `MQTT ao vivo · ${fmtInt(processed)}` : 'MQTT aguardando';
  $('dot-mqtt').className = 'dot ' + (mqttLive ? 'ok' : 'warn');

  $('dash-processed').textContent = fmtInt(processed);
  $('dash-sensor-rx').textContent = fmtInt(metrics.sensorRx);
  $('dash-command-rx').textContent = fmtInt(metrics.commandRx);
  $('dash-rate').textContent = `${stats.messagesPerSec.toFixed(1)}/s`;
  $('dash-traffic').textContent = fmtBytes(metrics.bytesRx);
  $('dash-online').textContent = fmtInt(totals.online);
  $('dash-critical').textContent = fmtInt(totals.critical);
  $('dash-ic-ok-rate').textContent = `${icOkRate.toFixed(0)}%`;

  $('ic-requests').textContent = fmtInt(metrics.icRequests);
  $('ic-success').textContent = fmtInt(metrics.icSuccess);
  $('ic-fail').textContent = fmtInt(metrics.icFail);
  $('ic-latency').textContent = icAvg ? `${Math.round(icAvg)} ms` : '--';
  $('ic-bytes').textContent = fmtBytes(metrics.icBytes);
  $('ic-last').textContent = metrics.icLastStatus;
  $('ic-caption').textContent = bridgeMetrics
    ? `${bridgeRate.sentPerSec.toFixed(1)} envios/s · fila ${bridgeMetrics.queue_size || 0}/${bridgeMetrics.queue_max || 0} · RPS limite ${bridgeMetrics.max_rps || '--'}`
    : 'aguardando ac-iot/system/bridge_metrics';
  $('rooms-caption').textContent = `${fmtInt(totals.known)} salas vistas · ${fmtInt(totals.presence)} com presenca · ${fmtInt(totals.ac)} AC ligados`;

  drawLineChart('chart-messages', history.messages, '#4da6ff', 'msg/s');
  drawLineChart('chart-traffic', history.traffic, '#2dd98f', 'KB/s');
  drawLineChart('chart-ic', history.icThroughput, '#a78bfa', 'envios/s');
  drawLineChart('chart-rooms', history.rooms, '#f05252', 'criticas');
}

function drawLineChart(id, values, color, label) {
  const canvas = $(id);
  if (!canvas) return;
  const box = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  const width = Math.max(240, Math.floor(box.width));
  const height = Math.max(120, Math.floor(box.height));
  if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
    canvas.width = width * dpr;
    canvas.height = height * dpr;
  }

  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = '#081017';
  ctx.fillRect(0, 0, width, height);

  const plot = {
    left: 46,
    right: width - 18,
    top: 34,
    bottom: height - 30,
  };
  const maxRaw = Math.max(1, ...values);
  const max = maxRaw <= 10 ? Math.ceil(maxRaw + 1) : Math.ceil(maxRaw * 1.12);
  const min = 0;

  ctx.strokeStyle = 'rgba(123,144,165,.16)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 5; i++) {
    const y = plot.top + i * ((plot.bottom - plot.top) / 4);
    ctx.beginPath();
    ctx.moveTo(plot.left, y);
    ctx.lineTo(plot.right, y);
    ctx.stroke();
  }

  ctx.strokeStyle = 'rgba(123,144,165,.22)';
  ctx.beginPath();
  ctx.moveTo(plot.left, plot.top);
  ctx.lineTo(plot.left, plot.bottom);
  ctx.lineTo(plot.right, plot.bottom);
  ctx.stroke();

  const points = values.map((value, i) => {
    const x = plot.left + i * ((plot.right - plot.left) / Math.max(1, HISTORY_SIZE - 1));
    const y = plot.bottom - ((value - min) / (max - min || 1)) * (plot.bottom - plot.top);
    return { x, y, value };
  });

  if (points.length > 1) {
    const gradient = ctx.createLinearGradient(0, plot.top, 0, plot.bottom);
    gradient.addColorStop(0, `${color}55`);
    gradient.addColorStop(1, `${color}08`);
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.moveTo(points[0].x, plot.bottom);
    points.forEach(p => ctx.lineTo(p.x, p.y));
    ctx.lineTo(points[points.length - 1].x, plot.bottom);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = color;
    ctx.lineWidth = 2.4;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.beginPath();
    points.forEach(({ x, y }, i) => {
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    const lastPoint = points[points.length - 1];
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(lastPoint.x, lastPoint.y, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }

  const last = values.length ? values[values.length - 1] : 0;
  ctx.fillStyle = '#edf2f7';
  ctx.font = '700 13px Inter, system-ui, sans-serif';
  ctx.fillText(`${last.toFixed(last >= 10 ? 0 : 1)} ${label}`, plot.left, 20);
  ctx.fillStyle = '#7b90a5';
  ctx.font = '11px Inter, system-ui, sans-serif';
  ctx.fillText(`max ${maxRaw.toFixed(maxRaw >= 10 ? 0 : 1)}`, plot.right - 72, 20);
  ctx.fillText('0', 18, plot.bottom + 4);
  ctx.fillText(maxRaw.toFixed(maxRaw >= 10 ? 0 : 1), 12, plot.top + 4);
}

setMqttStatus(false);
setIcStatus(false);
render();
connectMqtt();
setInterval(updateTick, 1000);
window.addEventListener('resize', () => render());
