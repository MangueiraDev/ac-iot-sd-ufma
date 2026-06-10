#include <csignal>
#include <cstdlib>
#include <iostream>
#include <string>
#include <thread>
#include <chrono>

#include <mosquitto.h>
#include <nlohmann/json.hpp>

#include "config.hpp"
#include "interscity.hpp"
#include "pipeline.hpp"

using json = nlohmann::json;

// ── Globals (acessíveis nos callbacks MQTT) ───────────────────────────────────

static Pipeline*     g_pipeline = nullptr;
static std::string   g_mqtt_topic;

// ── Callbacks MQTT ────────────────────────────────────────────────────────────

static void on_connect(struct mosquitto* mosq, void*, int rc) {
    if (rc != 0) { std::cerr << "[ERROR] Conexão MQTT: rc=" << rc << "\n"; return; }
    mosquitto_subscribe(mosq, nullptr, g_mqtt_topic.c_str(), 0);
    std::cout << "[INFO] Conectado. Subscrito em: " << g_mqtt_topic << "\n";
}

static void on_disconnect(struct mosquitto*, void*, int rc) {
    if (rc != 0) std::cerr << "[WARN] MQTT desconectado (rc=" << rc << "). Reconectando...\n";
}

static void on_message(struct mosquitto*, void*, const struct mosquitto_message* msg) {
    if (!msg || !msg->payload) return;
    try {
        auto data = json::parse(std::string(static_cast<const char*>(msg->payload), msg->payloadlen));

        // Extrai room_id do payload ou do tópico
        std::string room_id;
        if (data.contains("id_sala") && data["id_sala"].is_string())
            room_id = data["id_sala"].get<std::string>();
        if (room_id.empty()) {
            std::string topic(msg->topic);
            auto p1 = topic.find('/');
            auto p2 = (p1 != std::string::npos) ? topic.find('/', p1 + 1) : std::string::npos;
            if (p1 != std::string::npos && p2 != std::string::npos)
                room_id = topic.substr(p1 + 1, p2 - p1 - 1);
        }

        if (!room_id.empty()) g_pipeline->enqueue(room_id, data);
    } catch (const std::exception& e) {
        std::cerr << "[WARN] Mensagem inválida: " << e.what() << "\n";
    }
}

// ── Main ──────────────────────────────────────────────────────────────────────

int main() {
    setvbuf(stdout, nullptr, _IOLBF, 0);
    setvbuf(stderr, nullptr, _IONBF, 0);

    std::string config_path  = getenv_or("CONFIG_PATH",          "/config/rooms.yaml");
    std::string broker       = getenv_or("MQTT_BROKER",          "mosquitto");
    int         port         = std::atoi(getenv_or("MQTT_PORT",  "1883").c_str());
    g_mqtt_topic             = getenv_or("MQTT_TOPIC",           "ac-iot/+/sensores");
    std::string ic_base      = getenv_or("INTERSCITY_BASE_URL",  "https://cidadesinteligentes.lsdi.ufma.br/interscity_lh");
    bool        ssl_verify   = env_flag(getenv_or("INTERSCITY_SSL_VERIFY", "false"));

    std::cout << "[INFO] InterSCity base: " << ic_base << "\n";
    std::cout << "[INFO] SSL verify: "      << (ssl_verify ? "sim" : "não") << "\n";

    // Carrega configuração
    auto rooms = load_rooms(config_path);
    auto caps  = load_capabilities(config_path);
    std::cout << "[INFO] " << rooms.size() << " sala(s), "
              << caps.size() << " capability(ies) carregadas\n";

    // Constrói cliente InterSCity e registra recursos
    InterSCityClient ic_client(ic_base, ssl_verify);
    ic_client.wait_ready();

    for (const auto& cap  : caps)   ic_client.ensure_capability(cap);
    std::vector<std::string> cap_names;
    for (const auto& cap  : caps)   cap_names.push_back(cap.name);
    for (const auto& [id, room] : rooms) ic_client.ensure_resource(id, room, cap_names);

    // Inicia pipeline assíncrono
    Pipeline pipeline(rooms, ic_client);
    g_pipeline = &pipeline;
    pipeline.start();

    // Inicializa MQTT
    mosquitto_lib_init();
    struct mosquitto* mosq = mosquitto_new("ac_iot_bridge", true, nullptr);
    if (!mosq) { std::cerr << "[ERROR] mosquitto_new falhou\n"; return EXIT_FAILURE; }

    mosquitto_connect_callback_set(mosq, on_connect);
    mosquitto_disconnect_callback_set(mosq, on_disconnect);
    mosquitto_message_callback_set(mosq, on_message);
    mosquitto_reconnect_delay_set(mosq, 2, 30, true);

    // Conecta com retentativas
    while (true) {
        int rc = mosquitto_connect(mosq, broker.c_str(), port, 60);
        if (rc == MOSQ_ERR_SUCCESS) break;
        std::cerr << "[WAIT] Broker " << broker << ":" << port
                  << " - " << mosquitto_strerror(rc) << ". Tentando em 5s...\n";
        std::this_thread::sleep_for(std::chrono::seconds(5));
    }

    std::cout << "[INFO] Bridge MQTT → InterSCity iniciado\n";

    // Loop MQTT (bloqueante — nunca mais bloqueia em HTTP)
    int rc = mosquitto_loop_forever(mosq, -1, 1);
    std::cerr << "[INFO] Loop MQTT encerrado: " << mosquitto_strerror(rc) << "\n";

    pipeline.stop();
    mosquitto_destroy(mosq);
    mosquitto_lib_cleanup();
    return rc == MOSQ_ERR_SUCCESS ? EXIT_SUCCESS : EXIT_FAILURE;
}
