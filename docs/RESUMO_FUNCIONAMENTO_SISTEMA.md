# Resumo do Funcionamento do Sistema

Este documento explica, de forma objetiva, o que e o sistema AC IoT UFMA e qual e a funcao de cada componente.

## 1. O que e o sistema

O sistema AC IoT UFMA e uma solucao de monitoramento e automacao para salas de aula.

Ele acompanha dados ambientais das salas, como temperatura, umidade, luminosidade e presenca, e usa esses dados para apoiar o controle de ar-condicionado e iluminacao.

O objetivo principal e:

- monitorar as condicoes das salas em tempo real;
- reduzir desperdicio de energia;
- automatizar decisoes de ligar/desligar ar-condicionado e luz;
- registrar dados na plataforma InterSCity;
- permitir testes pelo simulador web, Node-RED e MQTT.

## 2. Visao geral do fluxo

```text
Simulador C++ / Painel Web
        |
        | MQTT
        v
Mosquitto Broker
        |
        |--> Painel Web
        |--> Node-RED
        |--> Bridge InterSCity
                    |
                    | HTTP/REST
                    v
              InterSCity
```

Fluxo resumido:

1. O simulador C++ gera leituras automaticas das salas, ou o painel web injeta leituras manuais.
2. Os dados sao publicados no MQTT.
3. O Mosquitto distribui as mensagens para quem estiver inscrito.
4. O painel web mostra as leituras em tempo real.
5. O Node-RED aplica regras de automacao.
6. O bridge InterSCity envia os dados para a plataforma InterSCity.

## 3. Docker

Docker e a ferramenta que sobe os servicos do projeto em containers.

No projeto, ele e usado para executar:

- Mosquitto, que e o broker MQTT;
- Node-RED, que executa fluxos e regras;
- simulador C++, que gera leituras automaticas das salas;
- bridge InterSCity, que envia dados MQTT para a API REST;
- servicos locais da InterSCity, quando usados.

Com Docker, todos os servicos sobem juntos com:

```bash
docker compose up -d --build
```

Para ver o estado dos containers:

```bash
docker compose ps -a
```

Resumo: Docker organiza e executa a infraestrutura do sistema.

## 4. MQTT

MQTT e o protocolo de comunicacao usado entre sensores, simulador, painel web, Node-RED e bridge InterSCity.

Ele funciona com publicacao e assinatura:

- quem tem dados publica em um topico;
- quem precisa dos dados assina esse topico;
- o Mosquitto entrega as mensagens.

Topicos principais:

```text
ac-iot/sala01/sensores
ac-iot/sala02/sensores
ac-iot/sala03/sensores
```

Esses topicos carregam leituras dos sensores.

Exemplo de mensagem:

```json
{
  "id_sala": "sala01",
  "temperatura": 24.8,
  "umidade": 55,
  "luminosidade": 420,
  "presenca": true,
  "status_ac": "ligado",
  "status_luz": "desligado",
  "modo_ac": "ativo"
}
```

Topicos de comando:

```text
ac-iot/sala01/comando
ac-iot/sala02/comando
ac-iot/sala03/comando
ac-iot/all/comando
```

Esses topicos enviam comandos para alterar estado do ar, luz, setpoints ou modo de automacao.

Resumo: MQTT e o canal rapido de troca de mensagens do sistema.

## 5. Node-RED

Node-RED e a ferramenta visual usada para criar fluxos de automacao.

No sistema, ele:

- recebe mensagens MQTT dos sensores;
- interpreta temperatura, umidade, luminosidade e presenca;
- aplica regras de controle;
- gera comandos para ar-condicionado e luz;
- permite testes manuais por botoes e fluxos;
- ajuda a visualizar e depurar a automacao.

Exemplos de regras:

- se ha presenca e a temperatura esta acima do setpoint, ligar o ar-condicionado;
- se nao ha presenca por um tempo, desligar ar-condicionado e luz;
- se a luminosidade esta baixa e ha presenca, ligar a luz;
- se a automacao esta desativada, nao atuar automaticamente.

Abrir Node-RED:

```bash
open http://localhost:1880
```

Resumo: Node-RED e o motor de regras e automacao do projeto.

## 6. InterSCity

InterSCity e a plataforma usada para registrar e consultar dados IoT.

No sistema, ela recebe as informacoes das salas como recursos e capacidades.

Recursos:

```text
sala01
sala02
sala03
```

UUIDs dos recursos:

```text
sala01 = 00000000-0000-4000-8000-000000000101
sala02 = 00000000-0000-4000-8000-000000000102
sala03 = 00000000-0000-4000-8000-000000000103
```

O UUID e o identificador unico de cada sala dentro do InterSCity. Ele e usado para cadastrar, atualizar e consultar o recurso correto.

Neste projeto, o UUID e fixo. Ele nao muda a cada conexao, reinicio do Docker ou nova leitura MQTT. A `sala01` sempre usa o UUID terminado em `0101`, a `sala02` usa `0102` e a `sala03` usa `0103`.

Esses UUIDs nao sao gerados automaticamente em cada execucao. Eles foram definidos manualmente no codigo para manter sempre a mesma identidade das salas no InterSCity. Isso evita que a plataforma crie um recurso novo a cada subida do sistema.

Onde o UUID e usado:

- no bridge `interscity`, para cadastrar e enviar dados da sala correta;
- no painel web, para consultar a ultima leitura da sala no Data Collector;
- nas URLs REST do InterSCity, como `/resources/<uuid>/data/last`.

Exemplo:

```text
https://cidadesinteligentes.lsdi.ufma.br/interscity_lh/collector/resources/00000000-0000-4000-8000-000000000101/data/last
```

Essa URL consulta a ultima leitura da `sala01`.

Capabilities monitoradas:

```text
temperatura
umidade
luminosidade
presenca
status_ac
setpoint_ac
setpoint_umidade
setpoint_luz
status_luz
modo_ac
```

O envio para InterSCity e feito pelo bridge `interscity`.

O bridge:

- assina o topico MQTT `ac-iot/+/sensores`;
- cadastra as salas no Resource Cataloguer;
- cadastra as capabilities;
- envia as leituras para o Resource Adaptor;
- permite consultar a ultima leitura pelo Data Collector.

Endpoints UFMA usados:

```text
https://cidadesinteligentes.lsdi.ufma.br/interscity_lh/catalog
https://cidadesinteligentes.lsdi.ufma.br/interscity_lh/adaptor
https://cidadesinteligentes.lsdi.ufma.br/interscity_lh/collector
```

Resumo: InterSCity e a camada de plataforma IoT, onde os dados das salas ficam registrados e consultaveis.

## 7. Monitoramento das salas

O monitoramento acompanha o estado ambiental e operacional de cada sala.

Dados monitorados:

| Dado | O que representa |
|---|---|
| `temperatura` | Temperatura atual da sala em graus Celsius |
| `umidade` | Umidade relativa do ar |
| `luminosidade` | Nivel de luz ambiente em lux |
| `presenca` | Se ha pessoas na sala |
| `status_ac` | Se o ar-condicionado esta ligado ou desligado |
| `status_luz` | Se a iluminacao esta ligada ou desligada |
| `setpoint_ac` | Temperatura alvo do ar-condicionado |
| `setpoint_umidade` | Umidade alvo usada na automacao |
| `setpoint_luz` | Luminosidade alvo |
| `modo_ac` | Se a automacao esta ativa ou desativada |

O painel web permite:

- ver as salas em tempo real;
- acompanhar MQTT e InterSCity;
- alterar sensores manualmente;
- ligar/desligar ar-condicionado;
- ligar/desligar luz;
- ativar ou desativar automacao;
- aplicar setpoints globais.

Abrir painel web:

```bash
open simulador-web/index.html
```

Resumo: o monitoramento mostra o estado das salas e permite testar cenarios de uso.

## 8. Papel de cada componente

| Componente | Funcao no sistema |
|---|---|
| Docker | Sobe e organiza os servicos em containers |
| Mosquitto/MQTT | Faz a troca de mensagens entre simulador, painel, Node-RED e bridge |
| Simulador C++ | Gera leituras automaticas das salas |
| Painel Web | Mostra dados em tempo real e permite testes manuais |
| Node-RED | Executa regras de automacao e publica comandos |
| Bridge InterSCity | Converte MQTT em chamadas REST para InterSCity |
| InterSCity | Registra resources, capabilities e leituras das salas |
| Sensores simulados | Representam temperatura, umidade, luminosidade e presenca no ambiente de teste |
| Ar-condicionado | Atuador controlado conforme regra ou comando manual |
| Luz | Atuador controlado conforme presenca e luminosidade |

## 9. Exemplo pratico de funcionamento

1. O simulador gera para a `sala01` uma leitura com temperatura de `28 C`, presenca `true` e luminosidade baixa.
2. O simulador publica essa leitura em `ac-iot/sala01/sensores`.
3. O Mosquitto entrega essa mensagem ao painel, ao Node-RED e ao bridge InterSCity.
4. O painel atualiza os valores da sala.
5. O Node-RED verifica as regras.
6. Se a automacao estiver ativa, o Node-RED publica comandos para ligar ar e luz.
7. O simulador recebe os comandos e atualiza o estado da sala.
8. O bridge envia a leitura para InterSCity.
9. A ultima leitura pode ser consultada no Data Collector.

## 10. Resumo final

O sistema funciona como uma cadeia de monitoramento e automacao:

```text
Simulador C++ ou painel web geram dados
MQTT distribui mensagens
Painel Web mostra o estado
Node-RED decide a automacao
Bridge envia para InterSCity
InterSCity registra o historico
```

Em termos simples: o sistema simula e monitora o estado da sala, comunica os dados, toma decisoes automaticas, mostra tudo em tempo real e registra as informacoes em uma plataforma IoT.
