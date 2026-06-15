# Escalar o AC-IoT — Análise Crítica e Plano Real

> Veredito baseado na leitura direta do código-fonte:
> `src/bridge/pipeline.hpp`, `interscity.hpp`, `config.hpp`,
> `src/simulator/main.cpp`, `simulation.hpp`.

---

## O que o sistema JÁ faz (e o doc anterior subestimou)

Antes de listar o que falta, é honesto registrar o que já está implementado:

| Recurso | Onde está no código | Nota |
|---|---|---|
| Multi-worker HTTP para IC | `pipeline.hpp` — `HTTP_WORKERS` (padrão 8) | Workers paralelos consumindo a fila |
| Fila com backpressure | `pipeline.hpp` — `QUEUE_MAX` (padrão 20 000) | Dropa com aviso, não trava o MQTT |
| Rate limit para IC | `pipeline.hpp` — `MAX_INTERSCITY_RPS` (padrão 20 req/s) | Distribuído entre workers |
| Retry com backoff | `interscity.hpp` — 3 tentativas, espera `attempt × 2 s` | Só para erros 5xx |
| Modo degradado | `bridge/main.cpp` linha 88 | IC down no startup → continua consumindo MQTT |
| Registro idempotente no IC | `interscity.hpp` — `ensure_capability`, `ensure_resource` | GET antes de POST, trata 422 |
| Sharding do simulador | `simulator/main.cpp` — `SHARD_INDEX` / `SHARD_COUNT` | Lê índice do hostname K8s automaticamente |
| Geração dinâmica de salas | `config.hpp` — `ROOM_COUNT` | Sem precisar de YAML; UUID determinístico |
| UUID consistente | `config.hpp:room_uuid_for_index()` | Bridge e simulador compartilham a mesma fórmula |
| Reconexão MQTT | `bridge/main.cpp` linha 117 | Exponential backoff nativo da libmosquitto |
| Automação física real | `simulation.hpp` | Delays AC ligar/desligar, física de temperatura |

O código é um **protótipo bem estruturado**, não um "Docker Compose ingênuo".
Várias premissas do doc anterior estavam erradas.

---

## Veredito: o que funciona hoje (3 salas, Docker Compose)

```
Status atual: FUNCIONANDO — com uma dependência externa quebrada
```

| Componente | Estado | Detalhe |
|---|---|---|
| Simulador C++ | ✅ OK | Publica telemetria MQTT a cada 30 s |
| Broker Mosquitto | ✅ OK | TCP 1883 + WebSocket 9001 |
| Bridge C++ | ✅ OK | Consome MQTT, tenta IC, modo degradado ativo |
| Dashboard web | ✅ OK | Nginx saudável, MQTT WebSocket funcionando |
| InterSCity UFMA | ❌ Fora do ar | `200.137.134.98:443` — timeout no SSL handshake |

O sistema local funciona corretamente. O IC externo está inacessível.

---

## O que FALTA para escalar para 1 000+ salas

Apenas 4 lacunas reais bloqueiam a escalabilidade:

### 1. Shared subscriptions MQTT — crítico

**Problema:** O bridge subscreve `ac-iot/+/sensores` com subscrição normal.
Se você rodar 2 replicas do bridge, **ambas recebem todas as mensagens** → IC
recebe telemetria duplicada.

**Solução:** Trocar para shared subscription (MQTT 5 / EMQX):

```bash
# variável de ambiente no bridge
MQTT_TOPIC=$share/bridge-workers/ac-iot/+/sensores
```

O broker distribui cada mensagem para apenas 1 worker do grupo.
Mosquitto não suporta — requer **EMQX** ou HiveMQ.

```yaml
# docker-compose — trocar mosquitto por EMQX
emqx:
  image: emqx/emqx:5
  ports:
    - "1883:1883"
    - "8083:8083"   # WebSocket (mesmo que Mosquitto 9001)
    - "18083:18083" # dashboard admin
```

### 2. Dashboard sem paginação — crítico acima de ~50 salas

**Problema:** O browser subscreve `ac-iot/+/sensores` e renderiza um card
por sala. Com 1 000 salas isso trava o browser.

**Solução mínima em `app.js`:**

```javascript
const PAGE = 20;
let page = 0, filter = '';

function visibleRooms() {
  return Object.keys(rooms)
    .filter(id => id.includes(filter))
    .sort()
    .slice(page * PAGE, (page + 1) * PAGE);
}
```

Adicionar filtro e paginação no `index.html` antes de subir para mais de 50 salas.

### 3. Autenticação MQTT — ausente

**Problema:** Qualquer processo pode publicar nos tópicos das salas.
Hoje `allow_anonymous true` no Mosquitto.

**Solução mínima:**

```bash
# Gerar senha para o simulador
docker exec ac_iot_mosquitto mosquitto_passwd -c /mosquitto/config/passwd simulator
```

```ini
# mosquitto.conf
allow_anonymous false
password_file /mosquitto/config/passwd
```

### 4. Métricas internas não expostas

**Situação:** Os contadores `sent_`, `failed_`, `dropped_` já existem em
`pipeline.hpp` mas só aparecem nos logs, não como endpoint HTTP.

**Impacto:** Sem Prometheus/Grafana, não há alerta automático quando o bridge
começa a descartar mensagens (fila cheia) ou quando a taxa de erro IC sobe.

**Solução mínima:** Adicionar um endpoint `/metrics` no bridge em formato
simples (texto), ou exportar via MQTT tópico `ac-iot/_metrics/bridge`.

---

## Como escalar para 1 000 salas HOJE (sem Kubernetes)

Com apenas Docker Compose, usando recursos já implementados:

```yaml
# docker-compose.override.yml

# Simulador particionado em 4 shards (250 salas cada)
simulator-0:
  build: ./src/simulator
  environment:
    ROOM_COUNT: "1000"
    SHARD_INDEX: "0"
    SHARD_COUNT: "4"

simulator-1:
  build: ./src/simulator
  environment:
    ROOM_COUNT: "1000"
    SHARD_INDEX: "1"
    SHARD_COUNT: "4"

simulator-2:
  build: ./src/simulator
  environment:
    ROOM_COUNT: "1000"
    SHARD_INDEX: "2"
    SHARD_COUNT: "4"

simulator-3:
  build: ./src/simulator
  environment:
    ROOM_COUNT: "1000"
    SHARD_INDEX: "3"
    SHARD_COUNT: "4"

# Bridge: 1 instância (sem shared sub ainda = não replicar)
bridge:
  build: ./src/bridge
  environment:
    ROOM_COUNT: "1000"
    HTTP_WORKERS: "16"
    MAX_INTERSCITY_RPS: "50"
    QUEUE_MAX: "50000"
```

Carga estimada com 1 000 salas a cada 30 s:
- **~33 msg/s MQTT** — tranquilo para Mosquitto
- **~33 req/s para IC** — controlado pelo `MAX_INTERSCITY_RPS`
- **Fila bridge máxima:** 50 000 itens ≈ 25 min de acumulação sem IC

Esse cenário funciona hoje, **exceto pelo IC estar fora do ar**.

---

## Quando Kubernetes é necessário de verdade

Kubernetes traz valor real quando:

1. Você precisa de **2+ replicas do bridge** sem duplicar telemetria
   (depende de shared subscriptions no EMQX)
2. O **IC precisa de alta disponibilidade** (StatefulSet com réplicas)
3. Você quer **HPA** para o bridge escalar com carga automaticamente
4. O sistema precisa sobreviver a falha de nó físico

Para projetos acadêmicos com SLA relaxado, Docker Compose em 1 VM com
EMQX + bridge único cobre bem até ~5 000 salas com os ajustes acima.

---

## Topologia K8s mínima (quando chegar lá)

```
Ingress (TLS)
    ├── /           → Deployment: web (nginx) x2
    ├── /api/ic/    → Service: ic-gateway
    └── /ws         → Service: emqx (porta 8083)

StatefulSet: emqx x3 (cluster automático via K8s discovery)

Deployment: bridge x4
    HPA: CPU > 60% → até 20 replicas
    env: MQTT_TOPIC=$share/bridge-workers/ac-iot/+/sensores
    env: ROOM_COUNT=1000

StatefulSet: simulator x4 (pods 0..3)
    env: ROOM_COUNT=1000
    env: SHARD_COUNT=4
    env: SHARD_INDEX=<auto via hostname>  ← já implementado

StatefulSet: InterSCity (api-gateway, catalog, adaptor, data-collector)
    + PostgreSQL / MongoDB
```

---

## Checklist de migração por prioridade

**Curto prazo (implementar antes de apresentação com muitas salas):**
- [ ] Adicionar paginação e filtro no dashboard (`app.js` + `index.html`)
- [ ] Habilitar autenticação MQTT no Mosquitto

**Médio prazo (para escalar a bridge):**
- [ ] Trocar Mosquitto por EMQX (compatível com Paho/Mosquitto clients)
- [ ] Atualizar `MQTT_TOPIC` no bridge para shared subscription
- [ ] Testar com `ROOM_COUNT=100` → `ROOM_COUNT=500` → `ROOM_COUNT=1000`

**Longo prazo (produção / K8s):**
- [ ] Manifests Kubernetes (StatefulSet EMQX, Deployment bridge com HPA)
- [ ] Endpoint `/metrics` no bridge (Prometheus)
- [ ] InterSCity em instância dedicada
- [ ] Credenciais MQTT por sala (Secret K8s)

---

## Integração InterSCity — estado e o que falta

**O que já funciona (quando IC está acessível):**
- Registro automático de capabilities e resources no startup
- Telemetria no formato correto: `{data:{cap:[{value, timestamp}]}}`
- Retry 3× com backoff em erros 5xx
- Modo degradado: IC down não para o sistema

**O que falta para produção com IC:**
- IC próprio (o servidor UFMA é compartilhado e tem SLA desconhecido)
- Reenvio de telemetria perdida durante downtime (fila persistente)
- Verificação periódica se o recurso ainda está registrado

**Estado atual do servidor UFMA:**
```
cidadesinteligentes.lsdi.ufma.br (200.137.134.98:443)
→ Timeout no SSL handshake — servidor inacessível
→ Contatar equipe LSDi/UFMA para verificar status
```

---

## Atualizacao complementar — 15/06/2026

Esta atualizacao nao substitui a avaliacao anterior; ela registra a evolucao
apos nova rodada de ajustes e validacoes.

### Estado observado apos ajustes

- A plataforma InterSCity voltou a responder via proxy do web container.
- Consultas testadas:
  - `/api/ic/catalog/capabilities` retornando `HTTP 200`;
  - `/api/ic/collector/resources/00000000-0000-4000-8000-000000000101/data/last`
    retornando `HTTP 200`.
- A bridge passou a publicar metricas reais em
  `ac-iot/system/bridge_metrics`.
- Amostra observada da bridge:
  - `sent`: 956 envios;
  - `sent_per_sec`: aproximadamente 17 envios/s;
  - `request_bytes`: aproximadamente 646 KB;
  - `queue_size`: 534;
  - `latency_ms_avg`: 442 ms;
  - `last_status`: 201.

### Impacto na escalabilidade

- O dashboard agora mede a comunicacao real Bridge -> InterSCity, e nao apenas
  pequenas consultas feitas pelo navegador.
- O topico retido de metricas permite observabilidade imediata apos abrir a
  pagina.
- A fila coalescente continua reduzindo backlog, mantendo somente a ultima
  leitura pendente por recurso.
- O limite `MAX_INTERSCITY_RPS=20` permanece como protecao da API remota.

### Pendencias atualizadas

- [ ] Persistir telemetria quando InterSCity estiver indisponivel por longos
      periodos.
- [ ] Exportar as metricas da bridge tambem em formato Prometheus quando a
      arquitetura migrar para Kubernetes.
- [ ] Definir SLA esperado para a instancia InterSCity UFMA ou usar instancia
      dedicada.
