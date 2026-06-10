# Escalar o AC-IoT para Larga Escala

> Referência prática para transformar o sistema atual (3 salas, Docker local)
> em uma infraestrutura distribuída com **1 000+ salas**, integração total com
> a plataforma **InterSCity UFMA** e orquestração via **Kubernetes**.

---

## Estado atual vs. estado alvo

| Aspecto | Atual | Alvo (1 000+ salas) |
|---|---|---|
| Salas | 3 (YAML local) | 1 000+ (registro dinâmico) |
| Broker MQTT | 1 instância local | Cluster MQTT (EMQX / HiveMQ) |
| Bridge → IC | 1 processo monolítico | N workers horizontais |
| InterSCity | Projeto UFMA remoto | InterSCity próprio ou federado |
| Orquestração | Docker Compose | Kubernetes |
| Dashboard | Nginx + MQTT WS | Nginx/CDN + agregação por grupo |
| Escalabilidade | Manual (`rooms.yaml`) | Auto-provisionamento via API IC |

---

## 1. InterSCity — pré-requisitos

### 1.1 Registro em massa de recursos

Com 1 000+ salas, o registro manual via YAML não escala.
Crie um script de provisionamento que use a API REST do IC:

```bash
# Registrar recurso via API
curl -X POST https://IC_HOST/catalog/resources \
  -H "Content-Type: application/json" \
  -d '{
    "data": {
      "description": "Sala 042 — Bloco D",
      "capabilities": ["temperatura","umidade","luminosidade",
                        "presenca","status_ac","status_luz",
                        "setpoint_ac","setpoint_umidade","setpoint_luz","modo_ac"],
      "lat": -2.5589, "lon": -44.3095
    }
  }'
# Retorna uuid — salvar no banco de salas
```

**Necessidade:** banco de dados (PostgreSQL) mapeando `sala_id → uuid_ic`.
O simulador/bridge passa a consultar esse banco em vez do YAML.

### 1.2 InterSCity próprio ou federado

O servidor público `cidadesinteligentes.lsdi.ufma.br` é compartilhado e
**não suportará** carga de 1 000 salas publicando a cada 30 s (~33 req/s só
de telemetria). Opções:

| Opção | Quando usar |
|---|---|
| Instância IC dedicada (Docker Compose) | Teste, projetos menores |
| IC no Kubernetes UFMA | Produção acadêmica com SLA |
| IC federado (múltiplas instâncias) | Multi-campus / multi-órgão |

```bash
# Clonar e subir IC localmente (para testes de carga)
git clone https://github.com/smart-city-platform/smart_city_platform
docker compose up -d
```

---

## 2. MQTT — cluster de alta disponibilidade

Um único Mosquitto não suporta 1 000 sensores + dashboard + bridge sem degradação.

### Substituir por EMQX (compatível com Mosquitto, horizontalmente escalável)

```yaml
# docker-compose (nó único EMQX para início)
emqx:
  image: emqx/emqx:5
  ports:
    - "1883:1883"    # MQTT TCP
    - "8083:8083"    # MQTT WebSocket
    - "18083:18083"  # Dashboard EMQX
  environment:
    EMQX_NAME: emqx@node1
    EMQX_HOST: 127.0.0.1
```

Em Kubernetes, o EMQX StatefulSet forma cluster automaticamente — cada Pod
conhece os outros via headless Service.

**Capacidade orientativa:**
- 1 nó EMQX (2 vCPU / 4 GB): ~100 000 conexões simultâneas
- Para 1 000 salas com publish a cada 30 s: bem dentro do limite de 1 nó

---

## 3. Bridge — workers paralelos

O bridge atual é um processo único que processa mensagens sequencialmente.
Com muitas salas, a fila de telemetria acumula.

### Estratégia: N workers via variável de ambiente

```yaml
# docker-compose (ou Deployment K8s)
bridge:
  build: ./src/bridge
  replicas: 4          # ou scale via K8s HPA
  environment:
    MQTT_BROKER: emqx
    INTERSCITY_BASE_URL: https://IC_HOST/interscity_lh
    WORKER_ID: "{{.Task.Slot}}"   # diferencia instâncias no log
```

Cada worker subscreve `ac-iot/+/sensores` — o broker distribui as mensagens
entre os consumers do mesmo grupo (MQTT shared subscriptions, suportado por
EMQX):

```
MQTT_TOPIC=ac-iot/+/sensores
MQTT_SHARE_GROUP=bridge-workers
# → tópico efetivo: $share/bridge-workers/ac-iot/+/sensores
```

---

## 4. Kubernetes — topologia mínima

```
┌─────────────────────────────────────────────────────┐
│  Kubernetes Cluster                                 │
│                                                     │
│  ┌──────────────┐   ┌──────────────────────────┐   │
│  │ StatefulSet  │   │  Deployment              │   │
│  │  EMQX x3    │   │  bridge workers x4       │   │
│  │  (cluster)  │   │  (HPA: CPU > 60%)        │   │
│  └──────────────┘   └──────────────────────────┘   │
│                                                     │
│  ┌──────────────┐   ┌──────────────────────────┐   │
│  │ Deployment   │   │  Deployment              │   │
│  │  simulator  │   │  web (nginx) x2          │   │
│  │  (ou externo│   │  + Ingress               │   │
│  └──────────────┘   └──────────────────────────┘   │
│                                                     │
│  ┌──────────────────────────────────────────────┐   │
│  │  StatefulSet — InterSCity (IC)               │   │
│  │  api-gateway · catalog · actuator-adaptor    │   │
│  │  · resource-adaptor · data-collector         │   │
│  │  + PostgreSQL / MongoDB                      │   │
│  └──────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

### Manifests mínimos

```yaml
# emqx-statefulset.yaml (trecho)
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: emqx
spec:
  replicas: 3
  serviceName: emqx-headless
  selector:
    matchLabels: { app: emqx }
  template:
    spec:
      containers:
        - name: emqx
          image: emqx/emqx:5
          ports:
            - { name: mqtt,    containerPort: 1883 }
            - { name: mqttws,  containerPort: 8083 }
          env:
            - name: EMQX_CLUSTER__DISCOVERY_STRATEGY
              value: k8s
            - name: EMQX_CLUSTER__K8S__APISERVER
              value: https://kubernetes.default.svc
            - name: EMQX_CLUSTER__K8S__SERVICE_NAME
              value: emqx-headless
```

```yaml
# bridge-deployment.yaml (trecho)
apiVersion: apps/v1
kind: Deployment
metadata:
  name: bridge
spec:
  replicas: 4
  template:
    spec:
      containers:
        - name: bridge
          image: ac-iot-bridge:latest
          env:
            - { name: MQTT_BROKER, value: emqx-headless }
            - { name: MQTT_TOPIC,  value: "$share/bridge-workers/ac-iot/+/sensores" }
            - { name: INTERSCITY_BASE_URL, value: http://ic-gateway/interscity_lh }
---
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: bridge-hpa
spec:
  scaleTargetRef: { apiVersion: apps/v1, kind: Deployment, name: bridge }
  minReplicas: 2
  maxReplicas: 20
  metrics:
    - type: Resource
      resource: { name: cpu, target: { type: Utilization, averageUtilization: 60 } }
```

```yaml
# web-deployment.yaml (trecho)
apiVersion: apps/v1
kind: Deployment
metadata:
  name: web
spec:
  replicas: 2
  template:
    spec:
      containers:
        - name: nginx
          image: ac-iot-web:latest
          ports: [{ containerPort: 80 }]
---
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: ac-iot-ingress
  annotations:
    nginx.ingress.kubernetes.io/proxy-read-timeout: "15"
spec:
  rules:
    - host: aciot.ufma.br
      http:
        paths:
          - path: /api/ic/
            pathType: Prefix
            backend: { service: { name: ic-gateway, port: { number: 80 } } }
          - path: /
            pathType: Prefix
            backend: { service: { name: web, port: { number: 80 } } }
```

---

## 5. Dashboard — adaptações para grande volume

Com 1 000 salas, renderizar todos os cards no browser é inviável.
Mudanças necessárias no frontend:

### 5.1 Agrupamento e paginação

```javascript
// app.js — filtrar salas visíveis
const PAGE_SIZE = 20;
let currentPage = 0;
let filterText  = '';

function visibleRooms() {
  const ids = Object.keys(rooms)
    .filter(id => id.includes(filterText))
    .sort();
  return ids.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);
}
```

Adicionar no `index.html`:
```html
<input id="room-search" placeholder="Filtrar sala..." oninput="filterText=this.value;renderGrid()">
<div class="pagination">
  <button onclick="prevPage()">‹</button>
  <span id="page-info"></span>
  <button onclick="nextPage()">›</button>
</div>
```

### 5.2 MQTT seletivo (não subscrever tudo)

Ao invés de subscrever `ac-iot/+/sensores` (recebe todas as 1 000 salas),
subscrever apenas as salas visíveis ou de interesse:

```javascript
// Subscrever só salas filtradas
function subscribeVisible() {
  visibleRooms().forEach(id => {
    client.subscribe(`ac-iot/${id}/sensores`);
  });
}
```

### 5.3 Painel de setpoints — aplicar por grupo/bloco

Adicionar campo de grupo no `rooms.yaml`:

```yaml
sala042:
  uuid: "..."
  grupo: "bloco-d"   # novo campo
```

No dashboard, o seletor de salas passa a ter opções:
- Sala específica
- Grupo/bloco
- Todas as salas visíveis
- **Broadcast total** (publicar no tópico `ac-iot/broadcast/comando`)

---

## 6. Pontos críticos para produção

### Autenticação MQTT

Mosquitto/EMQX sem autenticação = qualquer dispositivo publica dados falsos.

```yaml
# mosquitto.conf
allow_anonymous false
password_file /mosquitto/config/passwd
```

Em K8s: Secret com credenciais por sala, rotação automática via Vault ou
External Secrets Operator.

### Rate limiting no bridge

Evitar que 1 000 salas publiquem ao mesmo tempo e derrubem a API IC:

```python
# bridge — limitar a N req/s para IC
import asyncio
semaphore = asyncio.Semaphore(20)  # máx 20 req simultâneas ao IC

async def post_telemetry(uuid, payload):
    async with semaphore:
        await http.post(f"{IC_BASE}/collector/resources/{uuid}/data", json=payload)
```

### Persistência de setpoints

Atualmente os setpoints existem só no browser (estado do slider).
Com muitos operadores, é necessário persistir:
- Redis para estado atual (TTL curto, acesso rápido)
- PostgreSQL para histórico de comandos

### Monitoramento do próprio sistema

```yaml
# Adicionar ao docker-compose / K8s
prometheus:
  image: prom/prometheus
grafana:
  image: grafana/grafana
```

Métricas essenciais:
- Taxa de telemetria enviada ao IC (req/s, erros)
- Mensagens MQTT processadas por segundo
- Latência bridge → IC por sala
- Número de salas ativas (heartbeat < 60 s)

---

## 7. Checklist de migração

- [ ] Banco de dados de salas (PostgreSQL) com `sala_id → uuid_ic`
- [ ] Script de provisionamento em massa no IC
- [ ] Substituir Mosquitto por EMQX
- [ ] Bridge: shared subscriptions + múltiplos workers
- [ ] Autenticação MQTT por sala (certificado ou user/pass)
- [ ] InterSCity próprio (instância dedicada ou K8s)
- [ ] Manifests Kubernetes (StatefulSet EMQX, Deployment bridge/web, HPA)
- [ ] Dashboard: paginação + filtro por sala/grupo
- [ ] Rate limiting no bridge (semáforo async)
- [ ] Prometheus + Grafana para observabilidade
- [ ] Testes de carga antes de produção (`mqttx bench`)

---

## Referências

- EMQX K8s Operator: `github.com/emqx/emqx-operator`
- InterSCity platform: `github.com/smart-city-platform/smart_city_platform`
- MQTT shared subscriptions (MQTT 5): `docs.emqx.com/shared-subscriptions`
- `cidadesinteligentes.lsdi.ufma.br` — instância UFMA (compartilhada, uso acadêmico)
