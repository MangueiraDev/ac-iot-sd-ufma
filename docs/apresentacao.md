# AC-IoT UFMA — Apresentação do Sistema Atualizado

**Equipe:** Cleila Monteiro · Guilherme de Aquino · Nilton Mangueira · Raniere Mendes · Tereza Clarice

---

## 01 · OBJETIVO

### AC-IoT UFMA

Monitoramento e controle inteligente de ar-condicionado em salas de aula
com IoT, MQTT, automação e painel web operacional em larga escala.

> Esta apresentação cobre o estado **atual** do sistema após as evoluções
> implementadas sobre o protótipo 01.

---

## 02 · ARQUITETURA ATUAL

### O fluxo conecta simulação, automação, painel e InterSCity — em escala.

```
Simulador C++             Mosquitto            Painel Web (Nginx)
1 000 salas           broker MQTT TCP 1883     cockpit operacional
sharding por pod  ──► WebSocket 9001      ◄──  MQTT WebSocket
                            │
                            ▼
                        Bridge C++
                    8 workers HTTP
                    rate limit 20 req/s
                    fila 20 000 itens
                            │ HTTPS REST
                            ▼
                    InterSCity UFMA
                    catalog · adaptor · collector
```

**Tópicos MQTT:**
`ac-iot/+/sensores` · `ac-iot/{sala}/comando` · `ac-iot/all/comando`

---

## 03 · O QUE FOI IMPLEMENTADO

### Evoluções desde o protótipo 01.

**Simulador C++**
- Suporte a `ROOM_COUNT=1000` — geração dinâmica sem editar YAML
- Sharding por pod: `SHARD_INDEX` / `SHARD_COUNT` lido do hostname K8s
- UUID determinístico por índice — bridge e simulador usam a mesma fórmula
- Física de automação: delays reais de AC (20 s presença / 10 s ausência)

**Bridge C++**
- Pool de 8 workers HTTP paralelos (`HTTP_WORKERS`)
- Fila assíncrona com backpressure (`QUEUE_MAX=20000`)
- Rate limit configurável para o InterSCity (`MAX_INTERSCITY_RPS=20`)
- Retry automático com backoff (3 tentativas, erros 5xx)
- Modo degradado: IC offline no startup não para o bridge

**Painel Web**
- Cockpit para 1 000 salas com blocos operacionais (B01…B40)
- Tabela de Telemetria ao Vivo com filtro, busca e estados
- Comando em massa por escopo: todas, bloco, filtro atual ou sala selecionada
- Log de Eventos com alertas de temperatura crítica
- Painel de setpoints de automação com sliders
- Painel do operador para controle direto por sala

**Infraestrutura**
- `docker-compose.local.yml` para desenvolvimento local
- Manifests Kubernetes em `k8s/` (EMQX StatefulSet, bridge HPA, Ingress)

---

## 04 · PAINEL OPERACIONAL

### Cockpit projetado para operar 1 000 salas em tempo real.

**KPIs globais (topo)**

| Salas Online | Sem Heartbeat | Com Presença | AR Ligado | Luz Ligada | Umidade Média | Temp Média | Temp Crítica |
|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| 1 000 | 0 | 594 | 602 | 625 | 54% | 24.0°C | 98 salas |

**Blocos Operacionais**
- 40 blocos · 25 salas por bloco · temperatura média e alertas por bloco

**Telemetria ao Vivo**
- Tabela com todas as salas: temp, umidade, lux, presença, AC, modo, última leitura
- Filtro por nome/bloco e por estado (alerta, online, offline, com presença)

**Comando em Massa**
- Escopo: todas as salas · bloco selecionado · filtro atual · sala individual
- Sliders de setpoint AC, umidade, luminosidade
- Toggles: Automático · AC · Luz

**Sala Selecionada + Log de Eventos**
- Detalhe de leitura e consulta sob demanda ao InterSCity

---

## 05 · SIMULADOR E ESCALA

### Geração automática mantém o fluxo ativo e escalável.

**Local (Docker Compose)**
```
ROOM_COUNT=1000  →  1 simulador · 1 000 salas · 1 shard
```

**Kubernetes (produção)**
```
StatefulSet x10  →  100 salas por pod · SHARD_INDEX=hostname
```

**Física simulada por sala**

1. Presença detectada → liga a luz
2. Presença contínua por 20 s → avalia AC
3. Temperatura/umidade acima do setpoint → liga AC
4. Ausência por 10 s → desliga AC e luz

> Modo manual: `modo_ac = desativado` preserva comandos do operador.

**Sem hardware físico:**
ESP32, Wokwi, SCT-013, IR e relé não são necessários neste escopo.
O padrão de telemetria é idêntico ao de dispositivos reais.

---

## 06 · BRIDGE E INTERSCITY

### Integração conforme o guia técnico UFMA — validada no código.

**Fluxo de dados**
```
Simulador C++ ──MQTT──► Bridge C++ ──HTTPS REST──► InterSCity UFMA
                         8 workers                  catalog
                         rate limit                 adaptor
                         retry 3×                   collector
```

**Conformidade com o guia InterSCity**

| Operação | Endpoint | Status |
|---|---|:---:|
| Registrar capability | `POST /catalog/capabilities` | ✅ |
| Registrar recurso | `POST /catalog/resources` | ✅ |
| Enviar telemetria | `POST /adaptor/resources/{uuid}/data` | ✅ |
| Consultar última leitura | `GET /collector/resources/{uuid}/data/last` | ✅ |
| Timestamp ISO 8601 com `Z` | `%Y-%m-%dT%H:%M:%SZ` | ✅ |
| SSL verify off (regra UFMA) | `CURLOPT_SSL_VERIFYPEER=0` | ✅ |

**Payload enviado ao Adaptor**
```json
{
  "data": {
    "temperatura":  [{"value": 24.1, "timestamp": "2026-06-10T22:00:00Z"}],
    "umidade":      [{"value": 53.0, "timestamp": "2026-06-10T22:00:00Z"}],
    "luminosidade": [{"value": 612,  "timestamp": "2026-06-10T22:00:00Z"}]
  }
}
```

**Status atual do servidor UFMA**
> `200.137.134.98:443` — timeout no SSL handshake.
> O sistema local funciona; IC retoma automaticamente quando o servidor voltar.

---

## 07 · STATUS ATUAL

### Todos os componentes locais operacionais.

| Componente | Estado | Detalhe |
|---|:---:|---|
| Simulador C++ | ✅ | 1 000 salas · publicação a cada 30 s |
| Mosquitto | ✅ | TCP 1883 · WebSocket 9001 · healthy |
| Bridge C++ | ✅ | 8 workers · modo degradado ativo |
| Painel Web (Nginx) | ✅ | localhost:8080 · healthy |
| InterSCity UFMA | ❌ | SSL handshake timeout — servidor UFMA fora do ar |

**Integração InterSCity: correta — bloqueada por indisponibilidade externa.**

---

## 08 · GANTT — CRONOGRAMA

### Implementação prevista, realizada e replanejada.

**Legenda:** ✅ Concluído no prazo · 🔵 Concluído fora do prazo · 🟡 Previsto / em andamento · 🔴 Atrasado

| Atividade | Prazo original | Status | 28/05–31/05 | 01/06–08/06 | 09/06–12/06 | 13/06–16/06 | 17/06–20/06 | 21/06–25/06 | 26/06–30/06 |
|---|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| Docker + Mosquitto | mai/26 | ✅ | ✅ | | | | | | |
| Simulador C++ MQTT | mai/26 | 🔵 | 🔴 | 🔵 | | | | | |
| Node-RED automação | mai/26 | 🔵 | 🔴 | 🔵 | | | | | |
| Painel web | mai/26 | 🔵 | 🔴 | 🔵 | | | | | |
| Bridge InterSCity | 03/jun | 🔵 | 🔴 | 🔵 | 🔵 | | | | |
| Validar IC remoto | 03/jun | 🔵 | 🔴 | 🔴 | 🔵 | | | | |
| Painel escala 1 000 salas | não previsto | 🔵 | | 🔵 | 🔵 | | | | |
| Roteiro de testes | 16/jun | 🟡 | | | 🟡 | 🟡 | | | |
| Evidências (prints/logs) | 20/jun | 🟡 | | | | 🟡 | 🟡 | | |
| ESP32 / Wokwi | 01/jun | 🔴 | 🔴 | 🔴 | | 🟡 | 🟡 | | |
| Corrente / SCT-013 / IR | 08/jun | 🔴 | | 🔴 | 🔴 | | 🟡 | 🟡 | |
| Testes finais C1–C5 | 21/jun | 🟡 | | | | | 🟡 | 🟡 | |
| Documentação final | 25/jun | 🟡 | | | | | | 🟡 | 🟡 |

**Resumo:** base de software entregue (fora do prazo original) · hardware físico replanejado · testes e documentação em curso

---

## 09 · PRÓXIMOS PASSOS

### Para fechar a demonstração validada.

**1. Validar integração InterSCity**
Aguardar restabelecimento do servidor UFMA · confirmar telemetria no Data Collector

**2. Testar escala**
Validar estabilidade com 1 000 salas · medir consumo de mensagens e latência bridge → IC

**3. Evidenciar regras de automação**
Registrar ciclos completos: presença → AC liga → ausência → AC desliga

**4. Fechar entrega**
Roteiro de testes · prints · logs do bridge com `[OK] telemetria enviada` · documentação final

---

> **Sistema já demonstra o fluxo completo com 1 000 salas e dados automáticos.**
> O fechamento depende da recuperação do IC UFMA, testes de escala e evidências finais.
