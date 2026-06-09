# Implementacao da Comunicacao com InterSCity UFMA

Este documento explica como foi implementada a comunicacao entre o sistema AC IoT UFMA e a plataforma InterSCity da UFMA.

## 1. Objetivo da integracao

A integracao envia as leituras MQTT das salas para a InterSCity UFMA usando HTTP/REST.

Fluxo implementado:

```text
Simulador C++ / Painel Web
        |
        | MQTT: ac-iot/+/sensores
        v
Mosquitto
        |
        v
Bridge interscity
        |
        | HTTP/REST
        v
InterSCity UFMA
```

O servico responsavel por essa comunicacao e o container `interscity`, implementado em C++ no arquivo:

```text
interscity/main.cpp
```

## 2. Configuracao no Docker Compose

O bridge sobe junto com a stack Docker e recebe as variaveis de ambiente necessarias para conectar no MQTT e na InterSCity UFMA.

Trecho principal:

```yaml
interscity:
  build:
    context: ./interscity
  container_name: ac_iot_interscity
  environment:
    - MQTT_BROKER=mosquitto
    - MQTT_PORT=1883
    - MQTT_TOPIC=ac-iot/+/sensores
    - INTERSCITY_BASE_URL=https://cidadesinteligentes.lsdi.ufma.br/interscity_lh
    - INTERSCITY_SSL_VERIFY=false
```

Significado:

- `MQTT_BROKER=mosquitto`: o bridge se conecta ao broker MQTT local.
- `MQTT_PORT=1883`: porta MQTT usada dentro do Docker.
- `MQTT_TOPIC=ac-iot/+/sensores`: topico assinado pelo bridge.
- `INTERSCITY_BASE_URL`: URL base da InterSCity UFMA.
- `INTERSCITY_SSL_VERIFY=false`: desativa verificacao SSL por causa do ambiente/certificado da API UFMA.

## 3. Bibliotecas usadas

O bridge usa tres bibliotecas principais:

```cpp
#include <curl/curl.h>
#include <mosquitto.h>
#include <nlohmann/json.hpp>
```

Funcao de cada uma:

- `libcurl`: faz requisicoes HTTP para a InterSCity;
- `libmosquitto`: conecta no MQTT e recebe mensagens;
- `nlohmann/json`: monta e interpreta JSON.

## 4. Salas e UUIDs cadastrados

As salas sao definidas manualmente no bridge com UUID fixo, descricao e coordenadas.

Trecho principal:

```cpp
static const std::map<std::string, RoomConfig> rooms = {
    {"sala01", {"sala01", "00000000-0000-4000-8000-000000000101", "Sala 01 - AC IoT UFMA", -2.5589, -44.3095}},
    {"sala02", {"sala02", "00000000-0000-4000-8000-000000000102", "Sala 02 - AC IoT UFMA", -2.5588, -44.3094}},
    {"sala03", {"sala03", "00000000-0000-4000-8000-000000000103", "Sala 03 - AC IoT UFMA", -2.5587, -44.3093}}
};
```

Esses UUIDs nao sao gerados pela InterSCity. O sistema envia os UUIDs prontos para manter a identidade fixa das salas.

## 5. Capabilities cadastradas

As capabilities representam os dados que cada sala pode enviar para a InterSCity.

Trecho principal:

```cpp
static const std::vector<CapabilityConfig> capabilities = {
    {"temperatura", "Temperatura da sala"},
    {"umidade", "Umidade relativa da sala"},
    {"luminosidade", "Luminosidade da sala"},
    {"presenca", "Presenca detectada na sala"},
    {"status_ac", "Estado do ar-condicionado"},
    {"setpoint_ac", "Setpoint do ar-condicionado"},
    {"setpoint_umidade", "Setpoint de umidade da sala"},
    {"setpoint_luz", "Setpoint de luminosidade da sala"},
    {"status_luz", "Estado da iluminacao"},
    {"modo_ac", "Modo de automacao do ar-condicionado"}
};
```

Essas capabilities sao cadastradas no Resource Cataloguer antes do envio das leituras.

## 6. Montagem das URLs InterSCity

A URL base vem do Docker Compose:

```text
https://cidadesinteligentes.lsdi.ufma.br/interscity_lh
```

O codigo deriva automaticamente os tres endpoints:

```cpp
const std::string default_cataloguer_url = intercity_base_url.empty()
    ? "http://interscity-resource-cataloguer:3000"
    : intercity_base_url + "/catalog";

const std::string default_adaptor_url = intercity_base_url.empty()
    ? "http://interscity-resource-adaptor:3000"
    : intercity_base_url + "/adaptor";

const std::string default_collector_url = intercity_base_url.empty()
    ? "http://interscity-data-collector:3000"
    : intercity_base_url + "/collector";
```

Resultado:

```text
Cataloguer: https://cidadesinteligentes.lsdi.ufma.br/interscity_lh/catalog
Adaptor:   https://cidadesinteligentes.lsdi.ufma.br/interscity_lh/adaptor
Collector: https://cidadesinteligentes.lsdi.ufma.br/interscity_lh/collector
```

## 7. Cliente HTTP

A funcao `send_http` centraliza as chamadas REST.

Ela configura:

- URL final;
- headers JSON;
- timeout de conexao;
- timeout total;
- metodo `GET`, `POST` ou `PUT`;
- corpo JSON da requisicao;
- verificacao SSL opcional.

Trecho principal:

```cpp
headers = curl_slist_append(headers, "Accept: application/json");
headers = curl_slist_append(headers, "Content-Type: application/json");

curl_easy_setopt(curl, CURLOPT_CONNECTTIMEOUT, 10L);
curl_easy_setopt(curl, CURLOPT_TIMEOUT, 20L);

if (url.scheme == "https" && !intercity_ssl_verify) {
    curl_easy_setopt(curl, CURLOPT_SSL_VERIFYPEER, 0L);
    curl_easy_setopt(curl, CURLOPT_SSL_VERIFYHOST, 0L);
}
```

Essa funcao retorna:

```cpp
struct HttpResponse {
    int status = 0;
    std::string body;
};
```

Quando ha timeout ou erro de rede, o status fica `0` e o corpo recebe a mensagem de erro.

## 8. Verificacao de disponibilidade

Antes de processar MQTT, o bridge espera o Cataloguer e o Data Collector ficarem disponiveis.

Cataloguer:

```cpp
static void wait_for_cataloguer() {
    for (int attempt = 1; attempt <= 120; ++attempt) {
        auto response = send_http(cataloguer_url, HttpMethod::Get, "/capabilities");
        if (response.status == 200) {
            std::cout << "Cataloguer disponivel\n";
            return;
        }
        std::this_thread::sleep_for(std::chrono::seconds(5));
    }
}
```

Data Collector:

```cpp
static void wait_for_data_collector() {
    const auto first_room = rooms.begin();
    const std::string path = "/resources/" + first_room->second.uuid + "/data/last";
    auto response = send_http(collector_url, HttpMethod::Get, path);
    if (response.status > 0 && response.status < 500) {
        std::cout << "Data Collector disponivel\n";
        return;
    }
}
```

Isso evita iniciar o envio antes de a API estar minimamente acessivel.

## 9. Cadastro das capabilities

Para cada capability, o bridge primeiro consulta se ela ja existe.

Se nao existir, faz `POST /capabilities`.

Trecho principal:

```cpp
auto get_response = send_http(cataloguer_url, HttpMethod::Get, "/capabilities/" + capability.name);
if (get_response.status == 200) {
    std::cout << "Capability ja cadastrada: " << capability.name << "\n";
    return true;
}

json payload = {
    {"name", capability.name},
    {"description", capability.description},
    {"capability_type", "sensor"}
};

auto post_response = send_http(cataloguer_url, HttpMethod::Post, "/capabilities", &payload);
```

## 10. Cadastro das salas como resources

Cada sala e cadastrada como um resource da InterSCity.

Payload gerado:

```cpp
return json{
    {"data", {
        {"uuid", room.uuid},
        {"description", room.description},
        {"lat", room.lat},
        {"lon", room.lon},
        {"status", "active"},
        {"capabilities", capability_names}
    }}
};
```

Fluxo de cadastro:

1. Consulta `GET /resources/<uuid>`.
2. Se existir, atualiza com `PUT /resources/<uuid>`.
3. Se nao existir, cadastra com `POST /resources`.

Trecho principal:

```cpp
auto get_response = send_http(cataloguer_url, HttpMethod::Get, resource_path);
if (get_response.status == 200) {
    auto put_response = send_http(cataloguer_url, HttpMethod::Put, resource_path, &payload);
}
else if (get_response.status == 404) {
    auto post_response = send_http(cataloguer_url, HttpMethod::Post, "/resources", &payload);
}
```

## 11. Assinatura MQTT

Depois de preparar o catalogo da InterSCity, o bridge conecta no Mosquitto.

Ao conectar, assina o topico configurado:

```cpp
static void on_connect(struct mosquitto* mosq, void*, int rc) {
    if (rc == 0) {
        std::cout << "Conectado ao broker MQTT. Assinando " << mqtt_topic << "\n";
        mosquitto_subscribe(mosq, nullptr, mqtt_topic.c_str(), 0);
    }
}
```

Topico usado:

```text
ac-iot/+/sensores
```

O `+` aceita qualquer sala:

```text
ac-iot/sala01/sensores
ac-iot/sala02/sensores
ac-iot/sala03/sensores
```

## 12. Recebimento da mensagem MQTT

Quando uma mensagem chega, o bridge:

1. le o topico;
2. le o payload;
3. converte o JSON;
4. identifica a sala por `id_sala`;
5. se `id_sala` nao existir, tenta extrair a sala do topico;
6. envia a telemetria para a InterSCity.

Trecho principal:

```cpp
const std::string topic = message->topic ? message->topic : "";
const std::string body(static_cast<const char*>(message->payload), message->payloadlen);
const json payload = json::parse(body);

std::string room_id;
if (payload.contains("id_sala") && payload["id_sala"].is_string()) {
    room_id = payload["id_sala"].get<std::string>();
}
if (room_id.empty()) {
    room_id = room_from_topic(topic);
}

auto room_it = rooms.find(room_id);
if (room_it == rooms.end()) {
    std::cerr << "Sala ignorada pelo bridge InterSCity: " << room_id << "\n";
    return;
}

post_room_telemetry(room_it->second, payload);
```

## 13. Conversao do payload MQTT para payload InterSCity

O payload MQTT vem em formato simples:

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

Para a InterSCity, cada capability precisa ser enviada no formato:

```json
{
  "data": {
    "temperatura": [
      {
        "value": 24.8,
        "timestamp": "2026-06-08T20:00:00Z"
      }
    ]
  }
}
```

A funcao que monta esse formato:

```cpp
static void add_capability_value(json& data, const std::string& capability, const json& value, const std::string& date) {
    data["data"][capability] = json::array({
        {
            {"value", value},
            {"timestamp", date}
        }
    });
}
```

## 14. Envio da telemetria para InterSCity

A funcao `post_room_telemetry` monta o JSON final e envia para o Resource Adaptor.

Trecho principal:

```cpp
const auto path = "/resources/" + room.uuid + "/data";

auto response = send_http(adaptor_url, HttpMethod::Post, path, &intercity_payload);
if (is_success(response.status)) {
    std::cout << "Telemetria enviada ao InterSCity: " << room.id << "\n";
    return true;
}
```

Endpoint final para a `sala01`:

```text
POST /resources/00000000-0000-4000-8000-000000000101/data
```

URL completa:

```text
https://cidadesinteligentes.lsdi.ufma.br/interscity_lh/adaptor/resources/00000000-0000-4000-8000-000000000101/data
```

## 15. Tratamento de falhas

O bridge tem algumas protecoes:

- aguarda Cataloguer e Data Collector antes de iniciar;
- tenta cadastrar capability e resource mais de uma vez;
- usa timeout HTTP;
- reconecta automaticamente no MQTT;
- recadastra a sala se o Adaptor retornar `404`;
- ignora salas desconhecidas;
- registra erros nos logs.

Exemplo de reconexao MQTT:

```cpp
mosquitto_reconnect_delay_set(mosq, 2, 30, true);
```

Exemplo de recadastro se o resource nao for encontrado:

```cpp
if (response.status == 404) {
    std::cerr << "Recurso nao encontrado no adaptor, recadastrando " << room.id << "\n";
    ensure_room(room);
}
```

## 16. Como acompanhar a comunicacao

Ver logs do bridge:

```bash
docker compose logs -f interscity
```

Mensagens esperadas quando esta funcionando:

```text
Cataloguer disponivel
Data Collector disponivel
Capability cadastrada
Recurso cadastrado
Conectado ao broker MQTT
Bridge MQTT -> InterSCity iniciado
Telemetria enviada ao InterSCity
```

Testar o Cataloguer UFMA:

```bash
curl -k -i --max-time 10 https://cidadesinteligentes.lsdi.ufma.br/interscity_lh/catalog/resources
```

Testar ultima leitura da `sala01`:

```bash
curl -k -i --max-time 10 https://cidadesinteligentes.lsdi.ufma.br/interscity_lh/collector/resources/00000000-0000-4000-8000-000000000101/data/last
```

## 17. Resumo da implementacao

A comunicacao com a InterSCity UFMA foi implementada como um bridge MQTT/REST.

O bridge:

1. conecta no Mosquitto;
2. assina `ac-iot/+/sensores`;
3. cadastra capabilities no Cataloguer;
4. cadastra `sala01`, `sala02` e `sala03` como resources;
5. recebe mensagens MQTT;
6. identifica a sala;
7. converte o JSON MQTT para o formato da InterSCity;
8. envia a telemetria para o Resource Adaptor;
9. permite consulta posterior pelo Data Collector.

Em termos simples: o sistema pega dados MQTT das salas e transforma esses dados em registros REST compativeis com a InterSCity UFMA.
