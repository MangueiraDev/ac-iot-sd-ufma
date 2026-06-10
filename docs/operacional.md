# AC-IoT SD UFMA — Sistema Operacional

Visão geral, arquitetura e comandos para operar o sistema distribuído de monitoramento de salas com integração à plataforma InterSCity UFMA.

---

## Arquitetura

```
┌─────────────────────────────────────────────────────────────────┐
│  Docker Compose (host local / servidor UFMA)                    │
│                                                                  │
│  ┌─────────────┐   MQTT TCP    ┌──────────────┐                 │
│  │  simulator  │──────1883────▶│  mosquitto   │                 │
│  │   (C++)     │               │   (broker)   │                 │
│  └─────────────┘               └──────┬───────┘                 │
│                                       │ MQTT TCP                │
│                                       ▼                         │
│                               ┌──────────────┐   HTTPS REST     │
│                               │    bridge    │─────────────────▶│ InterSCity UFMA
│                               │    (C++)     │  cidadesinteli-  │ (remota)
│                               └──────────────┘  gentes.lsdi.   │
│                                       │          ufma.br        │
│                               MQTT WS 9001                      │
│                                       ▼                         │
│                               ┌──────────────┐                  │
│                               │     web      │◀── browser       │
│                               │   (Nginx)    │    :8080         │
│                               └──────────────┘                  │
└─────────────────────────────────────────────────────────────────┘
```

### Serviços

| Container         | Imagem                   | Função                                         | Porta       |
|-------------------|--------------------------|------------------------------------------------|-------------|
| ac_iot_mosquitto  | eclipse-mosquitto:latest | Broker MQTT (TCP + WebSocket)                  | 1883 / 9001 |
| ac_iot_simulator  | ac-iot-sd-ufma-simulator | Simula sensores IoT das salas (C++)            | —           |
| ac_iot_bridge     | ac-iot-sd-ufma-bridge    | Bridge MQTT → InterSCity UFMA (C++ async)      | —           |
| ac_iot_web        | nginx:alpine             | Dashboard tempo real (HTML/JS → MQTT WebSocket) | 8080        |
| ac_iot_nodered    | nodered/node-red:latest  | Automações Node-RED (perfil opcional)          | 1880        |

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
    static/
      index.html          ← dashboard principal
      app.js              ← MQTT WebSocket + UI em tempo real
      style.css           ← tema escuro profissional
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

## Reset total e inicialização

Execute na raiz do projeto:

```bash
cd /Users/mangueira/mangueira-dev/ac-iot-sd-ufma
```

**Reset completo — remove containers, volumes, cache de build e imagens:**

```bash
docker compose down -v --remove-orphans && \
docker builder prune -af && \
docker image prune -af && \
docker compose up -d --build
```

**Apenas reiniciar (sem rebuild):**

```bash
docker compose restart && docker compose ps -a
```

**Reiniciar e reconstruir só o bridge:**

```bash
docker compose up -d --build bridge && docker compose logs -f bridge
```

---

## Verificar status dos containers

```bash
docker compose ps -a
```

Esperado — todos `Up` ou `healthy`:

```
ac_iot_mosquitto   healthy   0.0.0.0:1883->1883, 0.0.0.0:9001->9001
ac_iot_simulator   running   —
ac_iot_bridge      running   —
ac_iot_web         healthy   0.0.0.0:8080->80
```

---

## Testar serviços individualmente

### Mosquitto — confirmar broker MQTT

Receber 3 mensagens das salas e sair automaticamente:

```bash
docker compose exec mosquitto mosquitto_sub -h localhost -t 'ac-iot/+/sensores' -C 3
```

### Simulator — log ao vivo das publicações

```bash
docker compose logs -f simulator
```

Esperado:

```
[INFO] 3 sala(s) carregadas de /config/rooms.yaml
[INFO] Conectado ao broker. Publicando a cada 30s
[PUB] sala01 temp=25.9°C umidade=48.1% luz=99lx presença=não
[PUB] sala02 temp=26.7°C umidade=43.6% luz=337lx presença=não
[PUB] sala03 temp=30.8°C umidade=56.6% luz=256lx presença=não
```

### Bridge — confirmar envio ao InterSCity

```bash
docker compose logs -f bridge
```

Esperado:

```
[INFO] InterSCity disponível: https://cidadesinteligentes.lsdi.ufma.br/...
[REC]  Atualizado: sala01
[REC]  Atualizado: sala02
[REC]  Atualizado: sala03
[INFO] Bridge MQTT → InterSCity iniciado
[OK]   Telemetria enviada: 00000000-0000-4000-8000-000000000101
[OK]   Telemetria enviada: 00000000-0000-4000-8000-000000000102
[OK]   Telemetria enviada: 00000000-0000-4000-8000-000000000103
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
curl -k -s https://cidadesinteligentes.lsdi.ufma.br/interscity_lh/catalog/resources | python3 -m json.tool | head -40
```

### Última leitura de cada sala (Data Collector)

```bash
curl -k -s https://cidadesinteligentes.lsdi.ufma.br/interscity_lh/collector/resources/00000000-0000-4000-8000-000000000101/data/last | python3 -m json.tool
```

```bash
curl -k -s https://cidadesinteligentes.lsdi.ufma.br/interscity_lh/collector/resources/00000000-0000-4000-8000-000000000102/data/last | python3 -m json.tool
```

```bash
curl -k -s https://cidadesinteligentes.lsdi.ufma.br/interscity_lh/collector/resources/00000000-0000-4000-8000-000000000103/data/last | python3 -m json.tool
```

### Leitura manual ponta a ponta (MQTT → InterSCity)

Publica manualmente e confirma chegada no InterSCity:

```bash
docker compose exec mosquitto mosquitto_pub \
  -h localhost -t 'ac-iot/sala01/sensores' \
  -m '{"id_sala":"sala01","temperatura":28.5,"umidade":62,"luminosidade":500,"presenca":true,"status_ac":"ligado","status_luz":"ligado","setpoint_ac":22.0,"setpoint_umidade":55.0,"setpoint_luz":300,"modo_ac":"ativo"}' && \
sleep 4 && \
curl -k -s https://cidadesinteligentes.lsdi.ufma.br/interscity_lh/collector/resources/00000000-0000-4000-8000-000000000101/data/last | python3 -m json.tool | grep -A3 '"temperatura"'
```

---

## Abrir interfaces web

### Dashboard em tempo real (local)

```bash
open http://localhost:8080
```

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
docker compose --profile nodered up -d && open http://localhost:1880
```

---

## Monitorar todo o sistema ao vivo

```bash
docker compose logs -f simulator bridge
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
docker compose restart simulator bridge
```

---

## Diagnóstico de problemas

**Build falha (dependência não encontrada):**

```bash
docker compose build --no-cache simulator bridge
```

**Bridge não envia telemetria:**

```bash
docker compose logs bridge && docker compose restart bridge
```

**MQTT falhou no painel web (WebSocket 9001):**

```bash
docker compose exec mosquitto mosquitto_sub -h localhost -t 'ac-iot/+/sensores' -C 1
```

**InterSCity UFMA não responde:**

```bash
curl -k -i --max-time 10 https://cidadesinteligentes.lsdi.ufma.br/interscity_lh/catalog/resources
```

**`Resource not found` no Data Collector:**

O bridge ainda não enviou telemetria para essa sala. Aguarde ou publique manualmente (seção acima).

**Reset total quando nada resolver:**

```bash
docker compose down -v --remove-orphans && \
docker builder prune -af && \
docker image prune -af && \
docker compose up -d --build && \
docker compose ps -a
```
