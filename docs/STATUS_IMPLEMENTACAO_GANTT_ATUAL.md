# Status Atual de Implementação e Gantt

Atualização em: 07/06/2026.

Este documento registra o estado atual do projeto sem substituir o status/Gantt anterior.

## 1. Resumo

| Área | Status | Observação |
|---|---|---|
| Docker/Mosquitto | Concluído | Broker MQTT `1883` e WebSocket `9001` |
| Simulador C++ | Concluído para protótipo | Três salas simuladas |
| MQTT sensores/comandos | Concluído para protótipo | `ac-iot/+/sensores` e `ac-iot/+/comando` |
| Node-RED | Parcial avançado | Automação com timers estáveis |
| Painel Web | Concluído para protótipo | Novo layout operacional |
| InterSCity UFMA | Parcial avançado | Bridge e consulta no painel |
| ESP32/PlatformIO | Pendente | Firmware final ainda não criado |
| Wokwi | Pendente | Circuito final ainda não criado |
| Energia/SCT-013 | Pendente | Corrente e potência ainda não implementadas |
| IR/relé | Pendente | Controle físico ainda não implementado |
| Testes formais | Parcial | Falta roteiro final com evidências |

## 2. Tabela de Implementação

| Etapa | Previsto | Status atual | Evidência | Falta |
|---|---|---|---|---|
| 01 | Ambiente Docker | Concluído | `docker-compose.yml` | Documentação final |
| 02 | Broker MQTT | Concluído | Mosquitto `1883/9001` | Autenticação opcional |
| 03 | Simular salas | Concluído | `simulador/main.cpp` | Expansão opcional |
| 04 | Sensores MQTT | Concluído | `ac-iot/+/sensores` | Corrente/potência |
| 05 | Comandos MQTT | Concluído | `ac-iot/+/comando` | Payload final padronizado |
| 06 | Automação | Parcial avançado | Node-RED | Dashboard energético |
| 07 | Presença/setpoints | Concluído para protótipo | 20s presença, 10s ausência | Testes formais |
| 08 | Painel web | Concluído para protótipo | `simulador-web/index.html` | Ajustes finos |
| 09 | InterSCity bridge | Parcial avançado | `interscity/main.cpp` | Validação contínua |
| 10 | InterSCity no painel | Concluído para protótipo | UUID e última leitura | Fallbacks remotos |
| 11 | ESP32 | Pendente | Não há firmware final | Criar PlatformIO |
| 12 | Wokwi | Pendente | Não há circuito final | Criar `diagram.json` |
| 13 | SCT-013/energia | Pendente | Não implementado | Corrente/potência/consumo |
| 14 | IR/relé | Pendente | Não implementado | Atuação física/simulada |
| 15 | Testes finais | Parcial | Testes manuais | Criar C1-C5 |

## 3. Gantt em Tabela

Legenda:

| Símbolo | Significado |
|---|---|
| 🟩 | Concluído dentro do período |
| 🟦 | Concluído, mas fora do prazo original |
| 🟨 | Em andamento ou previsto no novo cronograma |
| 🟥 | Atrasado: não ocorreu no prazo original |
| ⬜ | Sem atividade no período |

| Atividade | Prazo original | Nova data / status | 28/05-31/05 | 01/06-04/06 | 05/06-08/06 | 09/06-12/06 | 13/06-16/06 | 17/06-20/06 | 21/06-24/06 | 25/06-30/06 |
|---|---:|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| Docker + Mosquitto | 13/05-20/05 | Concluído | 🟩 | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| Simulador C++ MQTT | 15/05-24/05 | Concluído em 07/06 | 🟥 | 🟥 | 🟦 | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| Node-RED automação | 24/05-27/05 | Concluído em 07/06 | 🟥 | 🟥 | 🟦 | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| Painel web novo layout | 18/05-24/05 | Concluído em 07/06 | 🟥 | 🟥 | 🟦 | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| Separar sensores/atuadores/automação | Não previsto | Concluído em 07/06 | ⬜ | ⬜ | 🟦 | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| Bridge InterSCity | 28/05-03/06 | Parcial avançado | 🟥 | 🟥 | 🟦 | 🟨 | ⬜ | ⬜ | ⬜ | ⬜ |
| Consulta InterSCity no painel | 28/05-03/06 | Concluído em 07/06 | 🟥 | 🟥 | 🟦 | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| Validar InterSCity remota | 28/05-03/06 | Replanejado | 🟥 | 🟥 | 🟥 | 🟨 | ⬜ | ⬜ | ⬜ | ⬜ |
| Roteiro de testes MQTT/Node-RED/Web | 16/06-18/06 | Previsto | ⬜ | ⬜ | ⬜ | 🟨 | 🟨 | ⬜ | ⬜ | ⬜ |
| Evidências de testes | 18/06-20/06 | Previsto | ⬜ | ⬜ | ⬜ | ⬜ | 🟨 | 🟨 | ⬜ | ⬜ |
| Criar projeto ESP32 PlatformIO | 01/06-02/06 | Replanejado | ⬜ | 🟥 | 🟥 | 🟨 | ⬜ | ⬜ | ⬜ | ⬜ |
| Criar circuito Wokwi | 03/06-04/06 | Replanejado | ⬜ | 🟥 | 🟥 | 🟨 | 🟨 | ⬜ | ⬜ | ⬜ |
| Implementar DHT22 e PIR | 05/06-06/06 | Replanejado | ⬜ | ⬜ | 🟥 | ⬜ | 🟨 | ⬜ | ⬜ | ⬜ |
| Implementar SCT-013 | 05/06-07/06 | Replanejado | ⬜ | ⬜ | 🟥 | ⬜ | 🟨 | 🟨 | ⬜ | ⬜ |
| Publicar MQTT pelo ESP32 | 10/06-11/06 | Previsto/replanejado | ⬜ | ⬜ | ⬜ | 🟨 | ⬜ | 🟨 | ⬜ | ⬜ |
| Corrente/potência/consumo | 08/06-10/06 | Replanejado | ⬜ | ⬜ | 🟥 | 🟥 | ⬜ | 🟨 | ⬜ | ⬜ |
| Relé virtual | 10/06-12/06 | Replanejado | ⬜ | ⬜ | ⬜ | 🟥 | ⬜ | ⬜ | 🟨 | ⬜ |
| Comandos IR | 12/06-15/06 | Replanejado | ⬜ | ⬜ | ⬜ | 🟥 | 🟥 | ⬜ | 🟨 | ⬜ |
| Testes finais C1-C5 | 16/06-21/06 | Previsto | ⬜ | ⬜ | ⬜ | ⬜ | 🟨 | 🟨 | ⬜ | ⬜ |
| Ajustes finais | 21/06-23/06 | Previsto | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | 🟨 | ⬜ |
| Documentação final | 23/06-25/06 | Previsto | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | 🟨 | 🟨 |

## 4. Diagrama de Gantt

```mermaid
gantt
    title AC-IoT UFMA - Previsto, Atrasado e Replanejado
    dateFormat  YYYY-MM-DD
    axisFormat  %d/%m

    section Concluído fora do prazo original
    Docker + Mosquitto                         :done, a1, 2026-05-13, 2026-05-20
    Simulador C++ MQTT                         :done, a2, 2026-05-24, 2026-06-07
    Node-RED automação                         :done, a3, 2026-05-27, 2026-06-07
    Painel web novo layout                     :done, a4, 2026-05-24, 2026-06-07
    Separar sensores/atuadores/automação       :done, a5, 2026-06-07, 2026-06-07
    Bridge InterSCity                          :done, a6, 2026-06-07, 2026-06-07

    section Atrasado e replanejado
    Validar InterSCity remota                  :active, b1, 2026-06-08, 2d
    Roteiro de testes MQTT/Node-RED/Web        :b2, after b1, 2d
    Evidências de testes                       :b3, after b2, 1d

    section Firmware e Wokwi
    Criar projeto ESP32 PlatformIO             :c1, 2026-06-11, 2d
    Criar circuito Wokwi                       :c2, after c1, 2d
    Implementar DHT22 e PIR                    :c3, after c2, 2d
    Implementar SCT-013                        :c4, after c3, 3d
    Publicar MQTT pelo ESP32                   :c5, after c4, 2d

    section Energia e atuação
    Corrente/potência/consumo                  :d1, 2026-06-20, 2d
    Relé virtual                               :d2, after d1, 1d
    Comandos IR                                :d3, after d2, 3d

    section Finalização
    Testes C1-C5                               :e1, 2026-06-25, 3d
    Ajustes finais                             :e2, after e1, 2d
    Documentação final                         :e3, after e2, 2d
```

## 5. Feito

- Docker, Mosquitto, Node-RED e simulador.
- MQTT sensores e comandos.
- Automação por presença e setpoints.
- Timers estáveis: AC em 20s, ausência em 10s.
- Novo painel web.
- Eventos MQTT com rolagem.
- Sensores separados de controle direto.
- Modo de automação separado.
- Bridge InterSCity.
- Consulta de recursos e última leitura InterSCity.

## 6. Falta

- Validar integração InterSCity de forma contínua.
- Criar roteiro de testes com evidências.
- Implementar ESP32/PlatformIO.
- Criar circuito Wokwi.
- Adicionar corrente, potência e energia.
- Implementar IR/relé.
- Consolidar documentação final.
