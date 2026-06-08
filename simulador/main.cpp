#include <cstdlib>
#include <cstring>
#include <algorithm>
#include <cmath>
#include <iostream>
#include <map>
#include <random>
#include <string>
#include <thread>
#include <chrono>
#include <ctime>

#include <mosquitto.h>
#include <nlohmann/json.hpp>

using json = nlohmann::json;

struct RoomConfig {
    std::string id;
    std::string topic;
    std::string status;
    double setpoint;
    double setpoint_umidade;
    int setpoint_luz;
    std::string luz;
    double temp_min;
    double temp_max;
    double umidade_min;
    double umidade_max;
    int luz_min;
    int luz_max;
    double temp_simulada; // Temperatura atual do sensor
    bool presenca; // Sensor de presença humana
    double umidade_simulada; // Umidade atual do sensor
    int luz_simulada; // Luminosidade atual do sensor
    std::string modo_ac; // "ativo" ou "desativado"
    long presenca_desde;
    long ausencia_desde;
};

static std::map<std::string, RoomConfig> SALAS;
static std::mt19937_64 RNG(std::random_device{}());
static std::string BROKER;
static int PORT;
static int INTERVALO;
static struct mosquitto* MOSQ = nullptr;
static constexpr long DELAY_AC_PRESENCA_SEG = 20;
static constexpr long DELAY_AUSENCIA_SEG = 10;
static constexpr double CHANCE_SAIR_SALA = 0.04;
static constexpr double CHANCE_ENTRAR_SALA = 0.06;

static std::string getenv_or(const char* key, const char* def) {
    const char* value = std::getenv(key);
    return value ? std::string(value) : std::string(def);
}

static double random_double(double a, double b) {
    std::uniform_real_distribution<double> dist(a, b);
    return dist(RNG);
}

static int random_int(int a, int b) {
    std::uniform_int_distribution<int> dist(a, b);
    return dist(RNG);
}

static bool chance(double probability) {
    std::bernoulli_distribution dist(probability);
    return dist(RNG);
}

static double approach(double current, double target, double step) {
    if (current < target) {
        return std::min(current + step, target);
    }
    return std::max(current - step, target);
}

static void atualizar_ambiente(RoomConfig& sala) {
    const long agora = static_cast<long>(std::time(nullptr));

    if (sala.temp_simulada <= 0.0) {
        sala.temp_simulada = random_double(sala.temp_min, sala.temp_max);
    }
    if (sala.umidade_simulada <= 0.0) {
        sala.umidade_simulada = random_double(sala.umidade_min, sala.umidade_max);
    }
    if (sala.luz_simulada < 0) {
        sala.luz_simulada = random_int(sala.luz_min, sala.luz_max);
    }

    if (chance(sala.presenca ? CHANCE_SAIR_SALA : CHANCE_ENTRAR_SALA)) {
        sala.presenca = !sala.presenca;
        sala.presenca_desde = sala.presenca ? agora : 0;
        sala.ausencia_desde = sala.presenca ? 0 : agora;
    }
    if (sala.presenca && sala.presenca_desde <= 0) {
        sala.presenca_desde = agora;
    }
    if (!sala.presenca && sala.ausencia_desde <= 0) {
        sala.ausencia_desde = agora;
    }

    if (sala.modo_ac == "ativo") {
        if (!sala.presenca) {
            sala.presenca_desde = 0;
            const bool ausencia_longa = (agora - sala.ausencia_desde) >= DELAY_AUSENCIA_SEG;
            if (ausencia_longa) {
                sala.status = "desligado";
                sala.luz = "desligado";
            }
        } else {
            sala.ausencia_desde = 0;
            sala.luz = "ligado";
            const bool ac_liberado = (agora - sala.presenca_desde) >= DELAY_AC_PRESENCA_SEG;
            if (ac_liberado && (sala.temp_simulada > sala.setpoint + 1.0 || sala.umidade_simulada > sala.setpoint_umidade + 6.0)) {
                sala.status = "ligado";
            } else if (sala.temp_simulada < sala.setpoint - 1.5 && sala.umidade_simulada <= sala.setpoint_umidade + 2.0) {
                sala.status = "desligado";
            }
        }
    }

    double temperatura_alvo;
    if (sala.status == "ligado") {
        temperatura_alvo = sala.setpoint + random_double(-0.4, 0.6);
    } else {
        temperatura_alvo = random_double(sala.temp_min + 2.0, sala.temp_max + 2.5) + (sala.presenca ? 0.8 : 0.0);
    }

    sala.temp_simulada = approach(sala.temp_simulada, temperatura_alvo, random_double(0.8, 1.8));
    sala.temp_simulada += random_double(-0.45, 0.45);
    sala.temp_simulada = std::clamp(sala.temp_simulada, 10.0, 45.0);

    double umidade_alvo = sala.status == "ligado"
        ? sala.setpoint_umidade + random_double(-4.0, 2.0)
        : random_double(sala.umidade_min, sala.umidade_max + (sala.presenca ? 5.0 : 0.0));
    sala.umidade_simulada = approach(sala.umidade_simulada, umidade_alvo, random_double(2.5, 6.0));
    sala.umidade_simulada += random_double(-2.0, 2.0);
    sala.umidade_simulada = std::clamp(sala.umidade_simulada, 20.0, 90.0);

    int luz_alvo;
    if (sala.luz == "ligado") {
        luz_alvo = random_int(std::max(350, sala.setpoint_luz + 80), 1100);
    } else {
        luz_alvo = random_int(sala.luz_min, std::max(sala.luz_min + 20, sala.luz_max / 3));
    }
    sala.luz_simulada = static_cast<int>(approach(static_cast<double>(sala.luz_simulada), static_cast<double>(luz_alvo), random_double(80.0, 220.0)));
    sala.luz_simulada += random_int(-35, 35);
    sala.luz_simulada = std::clamp(sala.luz_simulada, 0, 1500);
}

static json gerar_dados(RoomConfig& sala) {
    atualizar_ambiente(sala);

    return json{
        {"id_sala", sala.id},
        {"status_ac", sala.status},
        {"setpoint_ac", sala.setpoint},
        {"setpoint_umidade", sala.setpoint_umidade},
        {"setpoint_luz", sala.setpoint_luz},
        {"status_luz", sala.luz},
        {"temperatura", std::round(sala.temp_simulada * 100.0) / 100.0},
        {"umidade", std::round(sala.umidade_simulada * 100.0) / 100.0},
        {"luminosidade", sala.luz_simulada},
        {"temperatura_forcada", false},
        {"umidade_forcada", false},
        {"luminosidade_forcada", false},
        {"presenca", sala.presenca},
        {"modo_ac", sala.modo_ac},
        {"timestamp", static_cast<long>(std::time(nullptr))}
    };
}

static void publish_room(RoomConfig& sala) {
    json dados = gerar_dados(sala);
    std::string payload = dados.dump();
    int ret = mosquitto_publish(MOSQ, nullptr, sala.topic.c_str(), static_cast<int>(payload.size()), payload.c_str(), 0, true);
    if (ret != MOSQ_ERR_SUCCESS) {
        std::cerr << "Falha ao publicar mensagem MQTT para " << sala.topic << ": " << mosquitto_strerror(ret) << "\n";
    }
}

static void publish_all_rooms() {
    for (auto& [id, sala] : SALAS) {
        publish_room(sala);
    }
}

static void on_connect(struct mosquitto* mosq, void* userdata, int rc) {
    if (rc == 0) {
        std::cout << "Conectado ao Broker MQTT em " << BROKER << ":" << PORT << "\n";
        mosquitto_subscribe(mosq, nullptr, "ac-iot/+/comando", 0);
        mosquitto_subscribe(mosq, nullptr, "ac-iot/all/comando", 0);
        std::cout << "Inscrito em ac-iot/+/comando e ac-iot/all/comando\n";
        publish_all_rooms();
    } else {
        std::cerr << "Falha de conexão MQTT: rc=" << rc << "\n";
    }
}

static void on_message(struct mosquitto* mosq, void* userdata, const struct mosquitto_message* message) {
    try {
        if (!message || !message->payload || message->payloadlen <= 0) {
            return;
        }

        std::string payload(reinterpret_cast<const char*>(message->payload), message->payloadlen);
        json dados = json::parse(payload);
        std::string topic = message->topic ? message->topic : "";
        std::vector<std::string> partes;
        std::string alvo;
        {
            size_t start = 0;
            size_t end;
            while ((end = topic.find('/', start)) != std::string::npos) {
                partes.push_back(topic.substr(start, end - start));
                start = end + 1;
            }
            if (start < topic.size()) partes.push_back(topic.substr(start));
        }

        if (partes.size() >= 2) {
            alvo = partes[1];
        }

        if (alvo.empty()) {
            return;
        }

        std::vector<std::string> salas_para_atualizar;
        if (alvo == "all") {
            for (const auto& [id, sala] : SALAS) {
                salas_para_atualizar.push_back(id);
            }
        } else if (SALAS.count(alvo)) {
            salas_para_atualizar.push_back(alvo);
        }

        for (const auto& id_sala : salas_para_atualizar) {
            auto& sala = SALAS[id_sala];
            bool mudou = false;

            if (dados.contains("comando") && dados["comando"].is_string()) {
                std::string cmd = dados["comando"].get<std::string>();
                if (cmd == "ligar" || cmd == "desligar") {
                    std::string novo_status = (cmd == "ligar") ? "ligado" : "desligado";
                    if (sala.status != novo_status) {
                        sala.status = novo_status;
                        mudou = true;
                    }
                }
            }

            if (dados.contains("setpoint")) {
                try {
                    sala.setpoint = dados["setpoint"].get<double>();
                    mudou = true;
                } catch (...) {
                }
            }

            if (dados.contains("setpoint_umidade")) {
                try {
                    sala.setpoint_umidade = dados["setpoint_umidade"].get<double>();
                    mudou = true;
                } catch (...) {
                }
            }

            if (dados.contains("setpoint_luz")) {
                try {
                    sala.setpoint_luz = dados["setpoint_luz"].get<int>();
                    mudou = true;
                } catch (...) {
                }
            }

            if (dados.contains("luz") && dados["luz"].is_string()) {
                std::string cmd_luz = dados["luz"].get<std::string>();
                if (cmd_luz == "ligar" || cmd_luz == "desligar") {
                    std::string novo_status_luz = (cmd_luz == "ligar") ? "ligado" : "desligado";
                    if (sala.luz != novo_status_luz) {
                        sala.luz = novo_status_luz;
                        mudou = true;
                    }
                }
            }

            if (dados.contains("temperatura")) {
                try {
                    sala.temp_simulada = dados["temperatura"].get<double>();
                    mudou = true;
                } catch (...) {
                }
            }

            if (dados.contains("presenca")) {
                try {
                    sala.presenca = dados["presenca"].get<bool>();
                    sala.presenca_desde = sala.presenca ? static_cast<long>(std::time(nullptr)) : 0;
                    sala.ausencia_desde = sala.presenca ? 0 : static_cast<long>(std::time(nullptr));
                    mudou = true;
                } catch (...) {
                }
            }

            if (dados.contains("umidade")) {
                try {
                    sala.umidade_simulada = dados["umidade"].get<double>();
                    mudou = true;
                } catch (...) {
                }
            }

            if (dados.contains("luminosidade")) {
                try {
                    sala.luz_simulada = dados["luminosidade"].get<int>();
                    mudou = true;
                } catch (...) {
                }
            }

            if (dados.contains("modo_ac") && dados["modo_ac"].is_string()) {
                std::string modo = dados["modo_ac"].get<std::string>();
                if (modo == "ativo" || modo == "desativado") {
                    if (sala.modo_ac != modo) {
                        sala.modo_ac = modo;
                        const long agora = static_cast<long>(std::time(nullptr));
                        sala.presenca_desde = sala.presenca ? agora : 0;
                        sala.ausencia_desde = sala.presenca ? 0 : agora;
                        mudou = true;
                    }
                }
            }

            if (mudou) {
                std::cout << "[COMANDO] " << id_sala << " atualizado: AC=" << sala.status
                          << ", Setpoint=" << sala.setpoint << "°C"
                          << ", SetpointUmidade=" << sala.setpoint_umidade << "%"
                          << ", SetpointLuz=" << sala.setpoint_luz << "lx"
                          << ", Luz=" << sala.luz
                          << ", Presenca=" << (sala.presenca ? "sim" : "nao")
                          << ", Modo=" << sala.modo_ac << "\n";
            }

            publish_room(sala);
        }
    } catch (const std::exception& exc) {
        std::cerr << "Erro ao processar mensagem MQTT: " << exc.what() << "\n";
    }
}

int main() {
    BROKER = getenv_or("MQTT_BROKER", "mosquitto");
    PORT = std::atoi(getenv_or("MQTT_PORT", "1883").c_str());
    INTERVALO = std::atoi(getenv_or("PUBLISH_INTERVAL", "60").c_str());
    if (INTERVALO <= 0) INTERVALO = 20;

    SALAS = {
        {"sala01", {"sala01", "ac-iot/sala01/sensores", "ligado", 22.0, 55.0, 300, "desligado", 20.0, 27.0, 40.0, 58.0, 20, 600, 24.8, false, 48.0, 180, "ativo", 0, static_cast<long>(std::time(nullptr))}},
        {"sala02", {"sala02", "ac-iot/sala02/sensores", "desligado", 24.0, 60.0, 500, "desligado", 23.0, 35.0, 48.0, 72.0, 15, 900, 30.5, true, 63.0, 220, "ativo", static_cast<long>(std::time(nullptr)), 0}},
        {"sala03", {"sala03", "ac-iot/sala03/sensores", "desligado", 23.0, 55.0, 300, "desligado", 21.0, 30.0, 42.0, 65.0, 10, 800, 27.2, false, 56.0, 140, "ativo", 0, static_cast<long>(std::time(nullptr))}}
    };

    mosquitto_lib_init();
    MOSQ = mosquitto_new("simulador_esp32_multisala", true, nullptr);
    if (!MOSQ) {
        std::cerr << "Falha ao criar cliente MQTT\n";
        return EXIT_FAILURE;
    }

    mosquitto_connect_callback_set(MOSQ, on_connect);
    mosquitto_message_callback_set(MOSQ, on_message);

    while (true) {
        int rc = mosquitto_connect(MOSQ, BROKER.c_str(), PORT, 60);
        if (rc == MOSQ_ERR_SUCCESS) {
            break;
        }
        std::cerr << "Erro ao conectar em " << BROKER << ":" << PORT << " -> " << mosquitto_strerror(rc)
                  << ". Tentando novamente em 5 segundos...\n";
        std::this_thread::sleep_for(std::chrono::seconds(5));
    }

    mosquitto_loop_start(MOSQ);
    std::cout << "Iniciando simulação MQTT. Publicando a cada " << INTERVALO << " segundos...\n";

    bool running = true;
    while (running) {
        publish_all_rooms();
        std::this_thread::sleep_for(std::chrono::seconds(INTERVALO));
    }

    mosquitto_loop_stop(MOSQ, true);
    mosquitto_destroy(MOSQ);
    mosquitto_lib_cleanup();
    return EXIT_SUCCESS;
}
