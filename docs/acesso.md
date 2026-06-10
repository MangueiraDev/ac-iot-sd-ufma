# Acesso Rápido — AC-IoT SD UFMA

```bash
cd /Users/mangueira/mangueira-dev/ac-iot-sd-ufma
```

---

## Iniciar / Parar

```bash
docker compose up -d --build          # subir (com rebuild)
docker compose up -d                  # subir (sem rebuild)
docker compose down                   # parar
docker compose ps -a                  # checar status
```

---

## Reiniciar serviços

```bash
docker compose restart                # reinicia tudo
docker compose restart simulator bridge  # reinicia só os serviços C++
```

---

## Reset completo

Quando build quebrado, volumes antigos ou comportamento inesperado:

```bash
docker compose down -v --remove-orphans && \
docker builder prune -af && \
docker image prune -af && \
docker compose up -d --build && \
docker compose ps -a
```

---

## Logs ao vivo

```bash
docker compose logs -f bridge         # telemetria → InterSCity
docker compose logs -f simulator      # publicações das salas
docker compose logs -f                # tudo junto
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
docker compose exec mosquitto mosquitto_sub -h localhost -t 'ac-iot/+/sensores' -C 3

# Última leitura sala01 no InterSCity:
curl -k -s https://cidadesinteligentes.lsdi.ufma.br/interscity_lh/collector/resources/00000000-0000-4000-8000-000000000101/data/last | python3 -m json.tool

# Web respondendo?
curl -s -o /dev/null -w "HTTP %{http_code}\n" http://localhost:8080/
```

---

## Problemas comuns

| Sintoma | Solução |
|---|---|
| Bridge não envia dados | `docker compose restart bridge` |
| Build falhou | `docker compose build --no-cache simulator bridge` |
| Dashboard sem dados | Verificar WebSocket 9001 — `docker compose restart mosquitto` |
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
docker compose restart simulator bridge
```
