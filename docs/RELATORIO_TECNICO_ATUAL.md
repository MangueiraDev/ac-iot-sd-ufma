# Relatório Técnico Atual

## AC-IoT Salas de Aula UFMA

Este documento resume o funcionamento atual do protótipo AC-IoT, sem substituir o relatório técnico anterior.

## 1. Sistema Atual

O sistema monitora e controla três salas simuladas:

- `sala01`;
- `sala02`;
- `sala03`.

Cada sala publica dados de temperatura, umidade, luminosidade, presença, estado do ar-condicionado, estado da luz, setpoints e modo da automação.

## 2. Componentes

| Componente | Função |
|---|---|
| Mosquitto | Broker MQTT TCP/WebSocket |
| Simulador C++ | Gera sensores e recebe comandos |
| Node-RED | Executa regras de automação |
| Simulador Web | Painel de monitoramento e testes |
| Bridge InterSCity | Envia telemetria MQTT para REST |
| Docker Compose | Sobe e integra os serviços |

## 3. Comunicação

Fluxo principal:

```text
Simulador C++ -> MQTT -> Node-RED
Simulador C++ -> MQTT -> Simulador Web
Simulador C++ -> MQTT -> Bridge InterSCity -> InterSCity UFMA
Node-RED/Web -> MQTT -> Simulador C++
```

Tópicos:

| Tipo | Tópico |
|---|---|
| Sensores | `ac-iot/+/sensores` |
| Comando por sala | `ac-iot/{sala}/comando` |
| Comando global | `ac-iot/all/comando` |

## 4. Automação Atual

Com `modo_ac = ativo`:

| Condição | Ação |
|---|---|
| Presença detectada | Liga luz |
| Presença contínua por 20s | Libera AC se temperatura/umidade estiverem acima dos setpoints |
| Ausência contínua por 10s | Desliga AC e luz |
| Sem presença | Não liga AC/luz automaticamente |

Com `modo_ac = desativado`, os comandos manuais preservam o estado enviado pelo usuário.

## 5. Novo Layout Web

O painel web atual possui:

- status MQTT e InterSCity no topo;
- lista de salas com presença, AC, luz e automação;
- eventos MQTT com rolagem interna;
- cenário de sensores separado do controle direto;
- controle direto apenas para atuadores;
- modo da automação separado;
- painel InterSCity com Resource Cataloguer, Data Collector, UUID, capabilities e última leitura.

## 6. Integração InterSCity UFMA

A integração atual usa bridge local:

```text
MQTT sensores -> Bridge InterSCity -> Resource Cataloguer/Adaptor -> Data Collector UFMA
```

O painel consulta:

| Consulta | Endpoint |
|---|---|
| Recursos cadastrados | `/catalog/resources` |
| Última leitura | `/collector/resources/{uuid}/data/last` |

O painel exibe a última leitura InterSCity com:

- temperatura;
- umidade;
- luminosidade;
- presença;
- AC;
- luz;
- data.

## 7. Estado Atual

Implementado:

- comunicação MQTT operacional;
- três salas simuladas;
- automação por presença e setpoints;
- controle manual separado;
- painel web reorganizado;
- bridge InterSCity;
- consulta de última leitura por UUID.

Ainda falta:

- firmware ESP32;
- circuito Wokwi;
- SCT-013;
- corrente, potência e energia;
- IR/relé real;
- testes finais documentados.
