# Explicação dos Slides da Apresentação

## 1. Finalidade do Documento

Este documento complementa a apresentação de acompanhamento do projeto **Gestão Energética dos Ar-Condicionados das Salas de Aula do Prédio Paulo Freire via IoT**.

A proposta aqui não é repetir o conteúdo visual dos slides, mas explicar o significado técnico de cada parte da apresentação e justificar por que os componentes e decisões mostrados são relevantes para o sistema.

---

## 2. Definições Breves dos Componentes

### Docker

Docker é uma tecnologia de conteinerização que permite executar serviços isolados em ambientes reproduzíveis. No projeto, ele reduz problemas de configuração local e facilita subir rapidamente os serviços necessários para testar a arquitetura.

### Docker Compose

Docker Compose é usado para coordenar vários containers ao mesmo tempo. Ele define quais serviços fazem parte do ambiente, quais portas são expostas, quais dependências existem entre eles e quais variáveis de configuração serão usadas.

### Mosquitto

Mosquitto é o broker MQTT adotado no projeto. Ele funciona como o ponto central de troca de mensagens entre sensores, automações e interfaces de controle. Sem o broker, cada componente precisaria se comunicar diretamente com os outros, aumentando o acoplamento do sistema.

### MQTT

MQTT é um protocolo leve baseado em publicação e assinatura. Ele foi escolhido porque combina bem com sistemas IoT: as mensagens são pequenas, a comunicação é assíncrona e os dispositivos não precisam conhecer diretamente todos os consumidores dos dados.

### Node-RED

Node-RED é a camada de automação do protótipo. Ele recebe mensagens MQTT, interpreta os dados das salas, aplica regras de decisão e publica comandos de controle. Sua interface visual facilita validar fluxos antes de consolidar uma implementação mais definitiva.

### Simulador C++

O simulador C++ representa as salas enquanto a etapa ESP32/Wokwi ainda não está pronta. Ele permite testar comunicação, mensagens MQTT, estados dos atuadores e regras de automação sem depender inicialmente do circuito eletrônico simulado.

### Painel Web

O painel web é a interface de acompanhamento e controle manual. Ele permite observar o estado das salas em tempo real, alterar setpoints e simular condições ambientais, servindo como ferramenta de demonstração e validação.

### PlatformIO

PlatformIO é a plataforma prevista para desenvolver o firmware do ESP32. Ela organiza bibliotecas, ambiente de compilação, placas e dependências do código embarcado.

### Wokwi

Wokwi é a ferramenta prevista para simular o circuito com ESP32 e sensores. Essa etapa é importante porque aproxima o protótipo da arquitetura original, que considera sensores e atuadores conectados a uma placa embarcada.

### InterSCity

InterSCity é a plataforma externa de integração. No contexto do projeto, ela deve receber dados e eventos do sistema, permitindo registrar telemetria e integrar a solução a uma visão mais ampla de cidades inteligentes e gestão urbana.

---

## 3. Explicação dos Slides

## Slide 2 — Objetivo

Este slide estabelece a motivação do projeto: transformar dados ambientais das salas em decisões automáticas de controle. A ideia central é que o sistema não apenas mostre informações, mas também reaja a elas.

Na apresentação, este slide deve ser usado para deixar claro que o problema tratado é de eficiência energética. A presença humana, a temperatura, a umidade e a luminosidade são variáveis que ajudam o sistema a decidir quando equipamentos devem permanecer ligados ou desligados.

Também é importante destacar que a integração entre MQTT, Node-RED, ESP32/Wokwi e InterSCity representa a natureza distribuída do projeto: cada componente tem uma responsabilidade específica e se comunica por mensagens.

## Slide 3 — O Que Já Está Funcionando

Este slide demonstra que o projeto já possui uma base executável. O ponto principal não é apresentar uma entrega final, mas mostrar que os elementos fundamentais de comunicação e controle já foram validados.

O uso do simulador C++ foi uma estratégia prática para antecipar testes. Com ele, foi possível desenvolver o painel web, testar mensagens MQTT e ajustar regras de automação antes da conclusão do firmware ESP32 e do circuito Wokwi.

Esse slide deve ser lido como evidência de progresso: a arquitetura distribuída já funciona localmente, mesmo que ainda faltem componentes previstos no plano original.

## Slide 4 — Automação Implementada

Este slide explica o comportamento operacional do sistema. As regras de automação foram definidas para evitar respostas abruptas e tornar o controle mais próximo de um cenário real.

A temporização de 30 segundos é relevante porque impede que pequenas variações ou mudanças rápidas de presença gerem comandos excessivos. Isso reduz oscilações e torna o controle mais estável.

Os setpoints foram incluídos para permitir parametrização do comportamento. Em vez de valores fixos no código, o sistema pode reagir conforme limites definidos para temperatura, umidade e luminosidade.

## Slide 5 — Status Atual

Este slide organiza o andamento do projeto em categorias de maturidade. Ele ajuda a separar o que já pode ser demonstrado daquilo que ainda precisa ser desenvolvido ou consolidado.

A principal leitura é que o protótipo local está funcional, mas ainda não representa completamente o escopo original. A parte de infraestrutura e comunicação avançou mais rápido, enquanto a simulação com ESP32/Wokwi e a integração InterSCity ainda exigem atenção.

Esse slide também serve para orientar decisões de prioridade. Ele evidencia que a comunicação com InterSCity e a simulação embarcada são pontos críticos para a próxima fase.

## Slide 6 — Pendência Crítica

Este slide destaca a maior diferença entre o protótipo atual e o projeto inicialmente planejado. O sistema já simula salas e sensores em C++, mas o plano original previa uma simulação baseada em ESP32, PlatformIO e Wokwi.

Essa diferença é importante porque o ESP32/Wokwi valida aspectos que o simulador C++ não cobre completamente, como estrutura de firmware, leitura de sensores embarcados, organização de pinos, bibliotecas e comportamento do circuito.

Portanto, este slide não invalida o que foi desenvolvido. Ele apenas mostra que o simulador C++ deve ser entendido como uma etapa intermediária de validação da arquitetura, não como substituto definitivo da simulação embarcada.

## Slide 7 — Prioridades

Este slide transforma o diagnóstico em plano de execução. A ordem das prioridades foi definida considerando risco técnico, dependências e alinhamento com o projeto inicial.

A comunicação com InterSCity aparece como prioridade alta porque representa a integração externa do sistema. Validá-la cedo reduz o risco de descobrir incompatibilidades somente no final.

A simulação ESP32/Wokwi também é prioritária porque aproxima o projeto do escopo acadêmico original. Já a consolidação dos payloads é necessária para que MQTT, Node-RED, painel web e InterSCity passem a usar uma linguagem comum de dados.

## Slide 8 — Cronograma Resumido

Este slide apresenta uma visão executiva do planejamento. Em vez de detalhar todas as tarefas, ele mostra os blocos principais de trabalho e a janela esperada para cada um.

O cronograma indica que InterSCity deve ser antecipada, enquanto ESP32/Wokwi e Node-RED seguem em paralelo parcial. Essa organização permite continuar evoluindo a automação enquanto a simulação oficial é construída.

Na apresentação, este slide ajuda a responder duas perguntas práticas: o que vem primeiro e até quando cada frente deve avançar.

## Slide 9 — Próximos Passos

Este slide fecha a apresentação com encaminhamentos técnicos. Ele mostra quais ações devem ser tomadas para sair do protótipo funcional e chegar a uma entrega mais alinhada ao projeto inicial.

O foco deve estar em três frentes: validar integração externa, implementar a simulação embarcada e formalizar evidências de teste. Esses pontos aumentam a robustez da solução e tornam a apresentação final mais defensável tecnicamente.

Também é neste slide que se reforça a necessidade de preparar uma demonstração objetiva, mostrando comunicação MQTT, automação, controle web e, futuramente, envio para InterSCity.

---

## 4. Por Que Esses Componentes Foram Usados

| Componente | Justificativa |
|---|---|
| Docker | Garante um ambiente reproduzível para executar os serviços do sistema |
| Mosquitto | Centraliza a comunicação MQTT entre sensores, automação e painel |
| MQTT | Permite troca leve e assíncrona de mensagens entre componentes IoT |
| Node-RED | Facilita criação e ajuste das regras de automação |
| Simulador C++ | Permite testar o comportamento do sistema antes da simulação ESP32/Wokwi |
| Painel Web | Oferece visualização e controle em tempo real para demonstração |
| PlatformIO | Estrutura o desenvolvimento do firmware ESP32 |
| Wokwi | Simula o circuito eletrônico previsto no projeto original |
| InterSCity | Permite integração com uma plataforma externa de dados urbanos |

---

## 5. Síntese

A apresentação mostra que o projeto já possui uma base funcional para comunicação, monitoramento e automação. Essa base é suficiente para demonstrar o fluxo distribuído entre sensores simulados, broker MQTT, Node-RED e painel web.

O ponto mais importante para o acompanhamento é reconhecer a diferença entre o protótipo atual e a implementação final prevista. O protótipo atual valida a arquitetura e as regras de controle; a próxima etapa deve completar a simulação ESP32/Wokwi e a integração InterSCity.

Com esses avanços, o sistema passa a ficar mais próximo do escopo original e ganha melhores condições para uma demonstração final tecnicamente consistente.

