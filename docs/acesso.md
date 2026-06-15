# Acesso Rápido — AC-IoT SD UFMA

```bash
cd /Users/mangueira/mangueira-dev/ac-iot-sd-ufma
```

---

## Iniciar / Parar

```bash
docker compose -f docker-compose.local.yml up -d --build          # subir (com rebuild)
docker compose -f docker-compose.local.yml up -d                  # subir (sem rebuild)
docker compose -f docker-compose.local.yml down                   # parar
docker compose -f docker-compose.local.yml ps -a                  # checar status
```

---

## Reiniciar serviços

```bash
docker compose -f docker-compose.local.yml restart                # reinicia tudo
docker compose -f docker-compose.local.yml restart simulator bridge  # reinicia só os serviços C++
```

---

## Reset completo

Quando build quebrado, volumes antigos ou comportamento inesperado:

```bash
docker compose -f docker-compose.local.yml down -v --remove-orphans && \
docker builder prune -af && \
docker image prune -af && \
docker compose -f docker-compose.local.yml up -d --build && \
docker compose -f docker-compose.local.yml ps -a
```

---

## Logs ao vivo

```bash
docker compose -f docker-compose.local.yml logs -f bridge         # telemetria → InterSCity
docker compose -f docker-compose.local.yml logs -f simulator      # publicações das salas
docker compose -f docker-compose.local.yml logs -f                # tudo junto
```

Saída esperada no bridge:
```
[OK] Telemetria enviada: 00000000-0000-4000-8000-000000000101
[OK] Telemetria enviada: 00000000-0000-4000-8000-000000000102
[OK] Telemetria enviada: 00000000-0000-4000-8000-000000000103
```

---

## Acessos

**Desktop:**
```bash
open http://localhost:8080
open http://localhost:1880
```

**Celular / outro dispositivo:**
```bash
ipconfig getifaddr en0
```
Acessar no navegador: `http://IP_DO_MAC:8080`

**InterSCity UFMA (remoto):**
```bash
open https://cidadesinteligentes.lsdi.ufma.br/interscity_lh/catalog/resources
```

---

## Testar rapidamente

```bash
# MQTT chegando?
docker compose -f docker-compose.local.yml exec mosquitto mosquitto_sub -h localhost -t 'ac-iot/+/sensores' -C 3

# Última leitura sala01 no InterSCity:
curl -k -s https://cidadesinteligentes.lsdi.ufma.br/interscity_lh/collector/resources/00000000-0000-4000-8000-000000000101/data/last | jq .

# Web respondendo?
curl -s -o /dev/null -w "HTTP %{http_code}\n" http://localhost:8080/
```

---

## Problemas comuns

| Sintoma | Solução |
|---|---|
| Bridge não envia dados | `docker compose -f docker-compose.local.yml restart bridge` |
| Build falhou | `docker compose -f docker-compose.local.yml build --no-cache simulator bridge` |
| Dashboard sem dados | Verificar WebSocket 9001 — `docker compose -f docker-compose.local.yml restart mosquitto` |
| InterSCity não responde | `curl -k -i --max-time 10 https://cidadesinteligentes.lsdi.ufma.br/interscity_lh/catalog/resources` |
| Nada funciona | Reset completo (seção acima) |

---

## Adicionar sala

Editar `config/rooms.yaml` e reiniciar — sem recompilar:

```yaml
sala04:
  uuid: "00000000-0000-4000-8000-000000000104"
  description: "Sala 04 — AC IoT UFMA"
  lat: -2.5586
  lon: -44.3092
```

```bash
docker compose -f docker-compose.local.yml restart simulator bridge
```

---

## Atualizacao complementar — 15/06/2026

### Novas paginas web

```bash
open http://localhost:8080              # painel operacional
open http://localhost:8080/dashboard.html # dashboard de metricas
```

### Consultar metricas reais da bridge

```bash
docker compose -f docker-compose.local.yml exec mosquitto \
  mosquitto_sub -h localhost -t 'ac-iot/system/bridge_metrics' -C 1 -W 3
```

Campos principais:

- `sent`: envios realizados ao InterSCity.
- `failed`: falhas de envio.
- `sent_per_sec`: taxa recente de envio da bridge.
- `request_bytes` e `response_bytes`: trafego real com InterSCity.
- `queue_size`: fila atual da bridge.
- `latency_ms_avg`: latencia media de envio.
- `last_status`: ultimo status HTTP retornado pelo InterSCity.

### Testar consulta InterSCity pela rota do web

```bash
docker compose -f docker-compose.local.yml exec web sh -c \
  "wget -qO- -S http://127.0.0.1/api/ic/catalog/capabilities 2>&1 | head -12"

docker compose -f docker-compose.local.yml exec web sh -c \
  "wget -qO- -S http://127.0.0.1/api/ic/collector/resources/00000000-0000-4000-8000-000000000101/data/last 2>&1 | head -20"
```

### Fluxo correto da consulta IC na interface

1. Abrir `http://localhost:8080`.
2. Selecionar uma sala na tabela **Telemetria ao Vivo**.
3. No painel **Sala Selecionada**, clicar em **Consultar IC**.
4. Conferir os campos retornados do InterSCity no mesmo painel.
