# Gestão Energética dos Ar-Condicionados das Salas de Aula do Prédio Paulo Freire via IoT

**Acompanhamento da implementação**

**Código:** UFMA-EC-SD-2026-001

**Natureza:** Projeto Acadêmico — Disciplina de Sistemas Distribuídos

**Curso / Instituição:** Engenharia da Computação — Universidade Federal do Maranhão (UFMA)

**Equipe:** Nilton Maciel Mangueira | Cleila Monteiro Dutra Galiza | Guilherme de Aquino Pacheco | Raniere Mendes dos Santos | Tereza Clarice da Silva Rocha

**Professor:** Prof. Luiz Henrique Neves Rodrigues

**Local:** Prédio Paulo Freire — Campus Dom Delgado, UFMA, São Luís — MA

---

## Objetivo

- Monitorar temperatura, umidade, luminosidade e presença.
- Controlar ar-condicionado e iluminação automaticamente.
- Reduzir desperdício energético em salas de aula.
- Integrar MQTT, Node-RED, ESP32/Wokwi e InterSCity.

---

## O que já está funcionando

- Infraestrutura Docker com Mosquitto, Node-RED e simulador.
- Simulador C++ com três salas.
- Painel web para monitoramento e controle.
- Comunicação MQTT via tópicos de sensores e comandos.
- Automação por presença, setpoints e temporização.

---

## Automação implementada

- Com presença: luz liga imediatamente.
- Com presença contínua por 30s: AC liga.
- Sem presença por 30s: luz e AC desligam.
- Setpoints controlam:
  - temperatura do AC;
  - umidade;
  - luminosidade.

---

## Status atual

| Item | Status |
|---|---|
| Docker + Mosquitto | Concluído |
| Simulador C++ | Concluído |
| Painel web | Funcional |
| Node-RED | Parcial |
| Documentação | Parcial |
| Testes formais | Parcial |
| InterSCity | Parcial / prioridade alta |
| ESP32 + PlatformIO + Wokwi | Pendente crítico |

---

## Pendência crítica

**Simulação ESP32 com PlatformIO e Wokwi**

Ainda falta implementar:

- projeto PlatformIO;
- circuito Wokwi;
- DHT22 para temperatura e umidade;
- PIR para presença;
- SCT-013 para corrente elétrica;
- relé virtual;
- transmissor IR;
- firmware MQTT no ESP32.

---

## Prioridades

1. Ativar comunicação com InterSCity.
2. Cadastrar salas e UUIDs.
3. Enviar telemetria e eventos de controle.
4. Criar simulação ESP32 com PlatformIO/Wokwi.
5. Consolidar payload MQTT/HTTP.
6. Documentar e executar testes C1 a C5.

---

## Cronograma resumido

| Período | Entrega |
|---|---|
| 28/05 a 03/06 | InterSCity |
| 01/06 a 12/06 | ESP32, Wokwi e MQTT final |
| 05/06 a 12/06 | Node-RED e dashboard |
| 16/06 a 21/06 | Testes finais e ajustes |

---

## Próximos passos

- Validar InterSCity com envio real de telemetria.
- Implementar ESP32/Wokwi como simulação oficial do projeto.
- Alinhar payloads finais entre MQTT, Node-RED e InterSCity.
- Formalizar testes com evidências.
- Preparar demonstração final.
