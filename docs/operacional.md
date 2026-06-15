# AC-IoT SD UFMA — Sistema Operacional

Visão geral, arquitetura e comandos para operar o sistema de gerenciamento em larga escala de salas com integração em tempo real à plataforma InterSCity UFMA.

---

## Arquitetura atual

```
Kubernetes (producao / larga escala)

simulator C++ StatefulSet x10 ──MQTT──▶ EMQX StatefulSet x3
                                             │
                                             ├── shared subscription
                                             ▼
                                  bridge C++ Deployment x4..30
                                             │ HTTPS REST com rate limit
                                             ▼
                                  InterSCity UFMA / dedicado

web Deployment x2..10 ──MQTT WebSocket──▶ EMQX
                  └── /api/ic proxy ────▶ InterSCity
```

Docker Compose continua existindo apenas como modo local de desenvolvimento e
validacao. Para escala real, use os manifests em `k8s/`.

### Componentes

| Componente | Desenvolvimento | Kubernetes |
|---|---|---|
| Broker MQTT | Mosquitto | EMQX `StatefulSet` x3 |
| Simulador | C++ com `ROOM_COUNT=1000` | C++ `StatefulSet` x10 com shards |
| Bridge IC | C++ com pool HTTP | C++ `Deployment` x4..30 + HPA |
| Web | Nginx local | `Deployment` x2..10 + Ingress |
| InterSCity | UFMA remota | UFMA remota ou instancia dedicada |

### Código-fonte

```
config/
  rooms.yaml              ← salas e capabilities (editar aqui para adicionar salas)
src/
  simulator/
    simulation.hpp        ← física e automação das salas (puro, sem I/O)
    main.cpp              ← MQTT + loop de publicação
    Dockerfile
  bridge/
    config.hpp            ← tipos + carregamento do YAML
    interscity.hpp        ← cliente REST InterSCity (libcurl)
    pipeline.hpp          ← fila assíncrona: thread MQTT → queue → thread HTTP
    main.cpp              ← entry point
    Dockerfile
  web/
    Dockerfile
    nginx.conf             ← Nginx + proxy /api/ic
    static/
      index.html          ← cockpit operacional em escala
      app.js              ← MQTT WebSocket + agregacao por blocos
      style.css           ← UI densa para operacao
k8s/
  kustomization.yaml       ← entrada Kubernetes
  emqx.yaml                ← cluster MQTT
  simulator.yaml           ← shards C++
  bridge.yaml              ← workers C++ + HPA
  web.yaml                 ← cockpit web
```

### Tópicos MQTT

| Tópico                      | Direção        | Conteúdo                        |
|-----------------------------|----------------|---------------------------------|
| `ac-iot/{sala}/sensores`    | simulator → *  | JSON com todos os sensores      |
| `ac-iot/{sala}/comando`     | browser → sim  | Comandos: ligar, setpoint, etc. |
| `ac-iot/all/comando`        | browser → sim  | Comando para todas as salas     |

### UUIDs das salas (InterSCity)

```
sala01 = 00000000-0000-4000-8000-000000000101
sala02 = 00000000-0000-4000-8000-000000000102
sala03 = 00000000-0000-4000-8000-000000000103
```

---

## Modo local — desenvolvimento

Execute na raiz do projeto:

```bash
cd /Users/mangueira/mangueira-dev/ac-iot-sd-ufma
```

Subir broker, simulador de 1 000 salas e web:

```bash
docker compose -f docker-compose.local.yml up -d --build mosquitto simulator web
```

Ativar envio ao InterSCity UFMA:

```bash
docker compose -f docker-compose.local.yml up -d --build bridge
```

> O bridge registra/atualiza recursos e envia telemetria com `MAX_INTERSCITY_RPS=20`.
> Use com cuidado contra a instancia UFMA compartilhada.

Reset completo local:

```bash
docker compose -f docker-compose.local.yml down -v --remove-orphans && \
docker compose -f docker-compose.local.yml up -d --build mosquitto simulator web
```

---

## Modo Kubernetes — larga escala

Renderizar os manifests:

```bash
kubectl kustomize k8s
```

Aplicar no cluster:

```bash
kubectl apply -k k8s
```

Verificar pods:

```bash
kubectl -n ac-iot get pods -o wide
kubectl -n ac-iot get hpa
kubectl -n ac-iot get ingress
```

Escala esperada:

```
emqx         StatefulSet   3 pods
simulator    StatefulSet  10 pods, 100 salas por pod
bridge       Deployment    4 a 30 pods via HPA
web          Deployment    2 a 10 pods via HPA
```

---

## Verificar status dos containers

```bash
docker compose -f docker-compose.local.yml ps -a
```

Esperado no modo local:

```
mosquitto   healthy   0.0.0.0:1883->1883, 0.0.0.0:9001->9001
simulator   running   ROOM_COUNT=1000
web         healthy   0.0.0.0:8080->80
bridge      running   apenas quando ativado
```

---

## Testar serviços individualmente

### Mosquitto — confirmar broker MQTT

Receber 1 000 mensagens retidas das salas e sair automaticamente:

```bash
docker compose -f docker-compose.local.yml exec mosquitto mosquitto_sub -h localhost -t 'ac-iot/+/sensores' -C 1000 -W 15 | wc -l
```

Esperado: `1000`

### Simulator — log ao vivo das publicações

```bash
docker compose -f docker-compose.local.yml logs -f simulator
```

Esperado:

```
[INFO] 1000 sala(s) carregada(s) room_count=1000 shard=0/1
[INFO] Conectado ao broker. Publicando a cada 30s
[PUB] sala01 temp=25.9°C umidade=48.1% luz=99lx presença=não
[PUB] sala0100 temp=26.7°C umidade=43.6% luz=337lx presença=não
[PUB] sala1000 temp=30.8°C umidade=56.6% luz=256lx presença=não
```

### Bridge — confirmar envio ao InterSCity

```bash
docker compose -f docker-compose.local.yml logs -f bridge
```

Esperado:

```
[INFO] InterSCity disponível: https://cidadesinteligentes.lsdi.ufma.br/...
[INFO] Pipeline InterSCity: workers=8 queue_max=20000 max_rps=20
[INFO] Bridge MQTT → InterSCity iniciado
[OK] Worker #0 telemetria enviada: 00000000-0000-4000-8000-000000000101 total=1
```

> `Ctrl+C` para sair dos logs.

### Web — verificar servidor Nginx

```bash
curl -s -o /dev/null -w "HTTP %{http_code}\n" http://localhost:8080/
```

Esperado: `HTTP 200`

---

## Testar InterSCity UFMA

### Recursos cadastrados no Cataloguer

```bash
curl -k -s https://cidadesinteligentes.lsdi.ufma.br/interscity_lh/catalog/resources | jq . | head -40
```

### Última leitura de cada sala (Data Collector)

```bash
curl -k -s https://cidadesinteligentes.lsdi.ufma.br/interscity_lh/collector/resources/00000000-0000-4000-8000-000000000101/data/last | jq .
```

```bash
curl -k -s https://cidadesinteligentes.lsdi.ufma.br/interscity_lh/collector/resources/00000000-0000-4000-8000-000000000102/data/last | jq .
```

```bash
curl -k -s https://cidadesinteligentes.lsdi.ufma.br/interscity_lh/collector/resources/00000000-0000-4000-8000-000000000103/data/last | jq .
```

### Leitura manual ponta a ponta (MQTT → InterSCity)

Publica manualmente e confirma chegada no InterSCity:

```bash
docker compose -f docker-compose.local.yml exec mosquitto mosquitto_pub \
  -h localhost -t 'ac-iot/sala01/sensores' \
  -m '{"id_sala":"sala01","temperatura":28.5,"umidade":62,"luminosidade":500,"presenca":true,"status_ac":"ligado","status_luz":"ligado","setpoint_ac":22.0,"setpoint_umidade":55.0,"setpoint_luz":300,"modo_ac":"ativo"}' && \
sleep 4 && \
curl -k -s https://cidadesinteligentes.lsdi.ufma.br/interscity_lh/collector/resources/00000000-0000-4000-8000-000000000101/data/last | jq . | grep -A3 '"temperatura"'
```

---

## Abrir interfaces web

### Cockpit operacional em tempo real (local)

```bash
open http://localhost:8080
```

O painel exibe:

- KPIs globais para 1 000 salas;
- blocos operacionais agregados;
- inventario vivo com todas as salas filtradas;
- incidentes e eventos relevantes;
- comando por todas as salas, bloco, filtro atual ou sala selecionada;
- consulta InterSCity sob demanda por sala.

### Dashboard via rede (celular / outro computador)

```bash
open http://192.168.0.128:8080
```

### InterSCity UFMA — visualização direta

```bash
open https://cidadesinteligentes.lsdi.ufma.br/interscity_lh/catalog/resources && \
open https://cidadesinteligentes.lsdi.ufma.br/interscity_lh/collector/resources/00000000-0000-4000-8000-000000000101/data/last
```

### Node-RED (opcional — só com `--profile nodered`)

```bash
docker compose -f docker-compose.local.yml --profile nodered up -d && open http://localhost:1880
```

---

## Monitorar todo o sistema ao vivo

```bash
docker compose -f docker-compose.local.yml logs -f simulator bridge
```

---

## Adicionar nova sala

Edite `config/rooms.yaml` — sem recompilar:

```yaml
rooms:
  sala04:
    uuid: "00000000-0000-4000-8000-000000000104"
    description: "Sala 04 — AC IoT UFMA"
    lat: -2.5586
    lon: -44.3092
```

Reiniciar para carregar:

```bash
docker compose -f docker-compose.local.yml restart simulator bridge
```

---

## Diagnóstico de problemas

**Build falha (dependência não encontrada):**

```bash
docker compose -f docker-compose.local.yml build --no-cache simulator bridge
```

**Bridge não envia telemetria:**

```bash
docker compose -f docker-compose.local.yml logs bridge && docker compose -f docker-compose.local.yml restart bridge
```

**MQTT falhou no painel web (WebSocket 9001):**

```bash
docker compose -f docker-compose.local.yml exec mosquitto mosquitto_sub -h localhost -t 'ac-iot/+/sensores' -C 1
```

**InterSCity UFMA não responde:**

```bash
curl -k -i --max-time 10 https://cidadesinteligentes.lsdi.ufma.br/interscity_lh/catalog/resources
```

**`Resource not found` no Data Collector:**

O bridge ainda não enviou telemetria para essa sala. Aguarde ou publique manualmente (seção acima).

**Reset total quando nada resolver:**

```bash
docker compose -f docker-compose.local.yml down -v --remove-orphans && \
docker builder prune -af && \
docker image prune -af && \
docker compose -f docker-compose.local.yml up -d --build && \
docker compose -f docker-compose.local.yml ps -a
```
