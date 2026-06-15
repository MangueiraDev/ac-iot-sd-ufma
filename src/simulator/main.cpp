#include <cstdio>
#include <cstdlib>
#include <cctype>
#include <iomanip>
#include <iostream>
#include <map>
#include <sstream>
#include <string>
#include <thread>
#include <chrono>

#include <mosquitto.h>
#include <nlohmann/json.hpp>
#include <yaml-cpp/yaml.h>

#include "simulation.hpp"

using json = nlohmann::json;

// ── Globals ───────────────────────────────────────────────────────────────────

static std::map<std::string, RoomState> g_rooms;
static struct mosquitto* g_mosq = nullptr;

static std::string g_broker;
static int         g_port     = 1883;
static int         g_interval = 30;
static int         g_room_count = 0;
static int         g_shard_index = 0;
static int         g_shard_count = 1;

static std::string getenv_or(const char* key, const char* def) {
    const char* v = std::getenv(key);
    return v ? std::string(v) : std::string(def);
}

static int getenv_int(const char* key, int def) {
    const char* v = std::getenv(key);
    if (!v || !*v) return def;
    try { return std::stoi(v); }
    catch (...) { return def; }
}

static int shard_index_from_hostname() {
    const char* h = std::getenv("HOSTNAME");
    if (!h || !*h) return 0;
    std::string host(h);
    auto pos = host.find_last_of('-');
    if (pos == std::string::npos || pos + 1 >= host.size()) return 0;
    try { return std::stoi(host.substr(pos + 1)); }
    catch (...) { return 0; }
}

static std::string room_id_for_index(int idx) {
    std::ostringstream ss;
    if (idx <= 99) {
        ss << "sala" << std::setw(2) << std::setfill('0') << idx;
    } else {
        ss << "sala" << std::setw(4) << std::setfill('0') << idx;
    }
    return ss.str();
}

static int room_index_from_id(const std::string& id) {
    std::string digits;
    for (char c : id) {
        if (std::isdigit(static_cast<unsigned char>(c))) digits.push_back(c);
    }
    if (digits.empty()) return 0;
    try { return std::stoi(digits); }
    catch (...) { return 0; }
}

static bool belongs_to_shard(const std::string& id) {
    if (g_shard_count <= 1) return true;
    const int idx = room_index_from_id(id);
    if (idx <= 0) return true;
    return ((idx - 1) % g_shard_count) == g_shard_index;
}

// ── Carregamento de salas via YAML ────────────────────────────────────────────

static void load_rooms(const std::string& path) {
    auto root = YAML::LoadFile(path);
    if (root["rooms"]) {
        for (const auto& item : root["rooms"]) {
            RoomState s;
            s.id = item.first.as<std::string>();
            if (belongs_to_shard(s.id)) g_rooms[s.id] = s;
        }
    }

    for (int i = 1; i <= g_room_count; ++i) {
        RoomState s;
        s.id = room_id_for_index(i);
        if (belongs_to_shard(s.id)) g_rooms.emplace(s.id, s);
    }

    std::cout << "[INFO] " << g_rooms.size() << " sala(s) carregada(s)"
              << " room_count=" << g_room_count
              << " shard=" << g_shard_index << "/" << g_shard_count
              << " config=" << path << "\n";
}

// ── Publicação MQTT ───────────────────────────────────────────────────────────

static void publish_room(RoomState& sala) {
    update_state(sala);
    std::string payload = build_payload(sala).dump();
    std::string topic   = "ac-iot/" + sala.id + "/sensores";
    int rc = mosquitto_publish(g_mosq, nullptr, topic.c_str(),
                               static_cast<int>(payload.size()), payload.c_str(), 0, true);
    if (rc != MOSQ_ERR_SUCCESS)
        std::cerr << "[WARN] Falha ao publicar " << topic << ": " << mosquitto_strerror(rc) << "\n";
    else
        std::cout << "[PUB] " << sala.id
                  << " temp="    << std::fixed << std::setprecision(1) << sala.temp    << "°C"
                  << " umidade=" << sala.umidade << "%"
                  << " luz="     << sala.luz     << "lx"
                  << " presença=" << (sala.presenca ? "sim" : "não")
                  << std::endl;
}

static void publish_all() {
    for (auto& [id, sala] : g_rooms)
        publish_room(sala);
}

// ── Callbacks MQTT ────────────────────────────────────────────────────────────

static void on_connect(struct mosquitto*, void*, int rc) {
    if (rc != 0) { std::cerr << "[ERROR] Conexão MQTT: rc=" << rc << "\n"; return; }
    mosquitto_subscribe(g_mosq, nullptr, "ac-iot/+/comando", 0);
    mosquitto_subscribe(g_mosq, nullptr, "ac-iot/all/comando", 0);
    std::cout << "[INFO] Conectado ao broker. Publicando a cada " << g_interval << "s\n";
    publish_all();
}

static void on_message(struct mosquitto*, void*, const struct mosquitto_message* msg) {
    if (!msg || !msg->payload) return;
    try {
        std::string topic(msg->topic);
        auto data = json::parse(std::string(static_cast<const char*>(msg->payload), msg->payloadlen));

        // Extrai alvo do tópico: ac-iot/{alvo}/comando
        std::string alvo;
        {
            auto p1 = topic.find('/');
            auto p2 = (p1 != std::string::npos) ? topic.find('/', p1 + 1) : std::string::npos;
            if (p1 != std::string::npos && p2 != std::string::npos)
                alvo = topic.substr(p1 + 1, p2 - p1 - 1);
        }

        // Constrói lista de salas alvo
        std::vector<std::string> alvos;
        if (alvo == "all") {
            for (auto& [id, _] : g_rooms) alvos.push_back(id);
        } else if (g_rooms.count(alvo)) {
            alvos.push_back(alvo);
        }

        for (const auto& id : alvos) {
            auto& s = g_rooms[id];
            bool mudou = false;
            auto set_str = [&](const char* key, std::string& field) {
                if (data.contains(key) && data[key].is_string()) { field = data[key]; mudou = true; }
            };
            auto set_dbl = [&](const char* key, double& field) {
                if (data.contains(key)) { field = data[key].get<double>(); mudou = true; }
            };
            auto set_int = [&](const char* key, int& field) {
                if (data.contains(key)) { field = data[key].get<int>(); mudou = true; }
            };

            if (data.contains("comando")) {
                std::string cmd = data["comando"];
                if (cmd == "ligar")   { s.status_ac = "ligado";    mudou = true; }
                if (cmd == "desligar") { s.status_ac = "desligado"; mudou = true; }
            }
            if (data.contains("luz")) {
                std::string cmd = data["luz"];
                if (cmd == "ligar")   { s.status_luz = "ligado";    mudou = true; }
                if (cmd == "desligar") { s.status_luz = "desligado"; mudou = true; }
            }
            if (data.contains("modo_ac")) {
                std::string modo = data["modo_ac"];
                if (modo == "ativo" || modo == "desativado") { s.modo_ac = modo; mudou = true; }
            }
            set_dbl("setpoint",         s.setpoint_ac);
            set_dbl("setpoint_ac",      s.setpoint_ac);
            set_dbl("setpoint_umidade", s.setpoint_umidade);
            set_int("setpoint_luz",     s.setpoint_luz);
            if (data.contains("temperatura")) { s.temp    = data["temperatura"].get<double>(); mudou = true; }
            if (data.contains("umidade"))      { s.umidade = data["umidade"].get<double>();      mudou = true; }
            if (data.contains("luminosidade")) { s.luz     = data["luminosidade"].get<int>();    mudou = true; }
            if (data.contains("presenca"))     { s.presenca = data["presenca"].get<bool>();       mudou = true; }

            if (mudou) {
                s.operador_ate = static_cast<long>(std::time(nullptr)) + OPERATOR_OVERRIDE_SECONDS;
                std::cout << "[CMD] " << id << " AC=" << s.status_ac
                          << " setpoint=" << s.setpoint_ac << "°C modo=" << s.modo_ac << "\n";
                publish_room(s);
            }
        }
    } catch (const std::exception& e) {
        std::cerr << "[WARN] Comando inválido: " << e.what() << "\n";
    }
}

// ── Main ──────────────────────────────────────────────────────────────────────

int main() {
    // Docker captura stdout em pipe (fully-buffered). Forçar line-buffer para logs imediatos.
    setvbuf(stdout, nullptr, _IOLBF, 0);
    setvbuf(stderr, nullptr, _IONBF, 0);

    g_broker   = getenv_or("MQTT_BROKER",      "mosquitto");
    g_port     = std::atoi(getenv_or("MQTT_PORT",         "1883").c_str());
    g_interval = getenv_int("PUBLISH_INTERVAL", 30);
    if (g_interval <= 0) g_interval = 30;
    g_room_count  = getenv_int("ROOM_COUNT", 0);
    g_shard_index = getenv_int("SHARD_INDEX", shard_index_from_hostname());
    g_shard_count = getenv_int("SHARD_COUNT", 1);
    if (g_shard_index < 0) g_shard_index = 0;
    if (g_shard_count <= 0) g_shard_count = 1;
    if (g_shard_index >= g_shard_count) g_shard_index = g_shard_count - 1;

    std::string config_path = getenv_or("CONFIG_PATH", "/config/rooms.yaml");
    load_rooms(config_path);
    if (g_rooms.empty()) { std::cerr << "[ERROR] Nenhuma sala no config.\n"; return EXIT_FAILURE; }

    mosquitto_lib_init();
    g_mosq = mosquitto_new("ac_iot_simulator", true, nullptr);
    if (!g_mosq) { std::cerr << "[ERROR] mosquitto_new falhou\n"; return EXIT_FAILURE; }

    mosquitto_connect_callback_set(g_mosq, on_connect);
    mosquitto_message_callback_set(g_mosq, on_message);
    mosquitto_reconnect_delay_set(g_mosq, 2, 30, true);

    // Reconecta até ter sucesso
    while (true) {
        int rc = mosquitto_connect(g_mosq, g_broker.c_str(), g_port, 60);
        if (rc == MOSQ_ERR_SUCCESS) break;
        std::cerr << "[WARN] Aguardando broker MQTT (" << g_broker << ":" << g_port
                  << "): " << mosquitto_strerror(rc) << "\n";
        std::this_thread::sleep_for(std::chrono::seconds(5));
    }

    mosquitto_loop_start(g_mosq);

    // Loop principal de publicação periódica
    while (true) {
        publish_all();
        std::this_thread::sleep_for(std::chrono::seconds(g_interval));
    }

    mosquitto_loop_stop(g_mosq, true);
    mosquitto_destroy(g_mosq);
    mosquitto_lib_cleanup();
    return EXIT_SUCCESS;
}
