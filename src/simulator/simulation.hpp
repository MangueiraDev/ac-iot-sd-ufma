#pragma once
// Lógica de física e automação das salas — sem I/O, sem side effects.
#include <algorithm>
#include <cctype>
#include <cmath>
#include <ctime>
#include <random>
#include <string>
#include <nlohmann/json.hpp>

using json = nlohmann::json;

static std::mt19937_64 g_rng{std::random_device{}()};

inline double rnd(double a, double b) { return std::uniform_real_distribution<double>(a, b)(g_rng); }
inline int    rnd(int a, int b)       { return std::uniform_int_distribution<int>(a, b)(g_rng); }
inline bool   chance(double p)        { return std::bernoulli_distribution(p)(g_rng); }
inline double approach(double c, double t, double step) {
    return c < t ? std::min(c + step, t) : std::max(c - step, t);
}

// Delays de automação (segundos)
static constexpr long DELAY_AC_LIGAR   = 20; // presença antes do AC ligar
static constexpr long DELAY_AC_DESLIGAR = 10; // ausência antes do AC desligar
static constexpr long CRITICAL_WINDOW_SECONDS = 180;
static constexpr long OPERATOR_OVERRIDE_SECONDS = 300;
static constexpr double CRITICAL_TEMP_FACTOR = 1.3;

struct RoomState {
    std::string id;

    // Setpoints (controláveis via MQTT)
    double      setpoint_ac       = 22.0;
    double      setpoint_umidade  = 55.0;
    int         setpoint_luz      = 300;
    std::string status_ac         = "desligado";
    std::string status_luz        = "desligado";
    std::string modo_ac           = "ativo";

    // Sensores simulados
    double temp     = 0.0;
    double umidade  = 0.0;
    int    luz      = -1;
    bool   presenca = false;

    // Temporizadores de automação
    long presenca_desde = 0;
    long ausencia_desde = 0;
    long operador_ate   = 0;

    // Limites físicos (constantes de simulação)
    double temp_min = 20.0, temp_max = 30.0;
    double umid_min = 40.0, umid_max = 70.0;
    int    luz_min  = 10,   luz_max  = 900;
};

inline int room_index(const std::string& id) {
    std::string digits;
    for (char c : id) {
        if (std::isdigit(static_cast<unsigned char>(c))) digits.push_back(c);
    }
    if (digits.empty()) return 0;
    try { return std::stoi(digits); }
    catch (...) { return 0; }
}

inline bool is_critical_candidate(const RoomState& s, long now) {
    if (s.operador_ate > now) return false;
    const int idx = room_index(s.id);
    if (idx <= 0) return false;

    const long bucket = now / CRITICAL_WINDOW_SECONDS;
    const int target_percent = 3 + static_cast<int>(bucket % 2); // 3% ou 4%; críticas naturais completam a variação
    const int offset = static_cast<int>((bucket * 37) % 100);
    return ((idx + offset) % 100) < target_percent;
}

inline void update_state(RoomState& s) {
    long now = static_cast<long>(std::time(nullptr));
    const bool critical_candidate = is_critical_candidate(s, now);

    // Inicialização na primeira chamada
    if (s.temp    <= 0.0) s.temp    = rnd(s.temp_min, s.temp_max);
    if (s.umidade <= 0.0) s.umidade = rnd(s.umid_min, s.umid_max);
    if (s.luz     <  0  ) s.luz     = rnd(s.luz_min,  s.luz_max);

    // Simulação de presença aleatória
    double p_change = s.presenca ? 0.04 : 0.06;
    if (chance(p_change)) {
        s.presenca        = !s.presenca;
        s.presenca_desde  =  s.presenca ? now : 0;
        s.ausencia_desde  =  s.presenca ? 0   : now;
    }
    if (critical_candidate) {
        s.presenca = true;
        if (!s.presenca_desde) s.presenca_desde = now;
        s.ausencia_desde = 0;
    }
    if ( s.presenca && !s.presenca_desde) s.presenca_desde = now;
    if (!s.presenca && !s.ausencia_desde) s.ausencia_desde = now;

    // Automação AC/luz
    if (s.modo_ac == "ativo") {
        if (!s.presenca) {
            s.presenca_desde = 0;
            if (s.ausencia_desde && (now - s.ausencia_desde) >= DELAY_AC_DESLIGAR) {
                s.status_ac  = "desligado";
                s.status_luz = "desligado";
            }
        } else {
            s.ausencia_desde = 0;
            s.status_luz     = "ligado";
            bool ac_ok = s.presenca_desde && (now - s.presenca_desde) >= DELAY_AC_LIGAR;
            if (ac_ok)
                s.status_ac = "ligado";
        }
    }

    // Atualização física da temperatura
    double tgt_t = critical_candidate
        ? (s.setpoint_ac * CRITICAL_TEMP_FACTOR) + rnd(0.3, 1.2)
        : (s.status_ac == "ligado")
        ? s.setpoint_ac + rnd(-0.4, 0.6)
        : rnd(s.temp_min + 2.0, s.temp_max + 2.5) + (s.presenca ? 0.8 : 0.0);
    s.temp = std::clamp(approach(s.temp, tgt_t, rnd(0.8, 1.8)) + rnd(-0.45, 0.45), 10.0, 45.0);

    if (critical_candidate) {
        if (s.temp < s.setpoint_ac * CRITICAL_TEMP_FACTOR)
            s.temp = s.setpoint_ac * CRITICAL_TEMP_FACTOR + rnd(0.1, 0.8);
        s.status_ac = "desligado";
        s.status_luz = "ligado";
    }

    // Atualização física da umidade
    double tgt_u = (s.status_ac == "ligado")
        ? s.setpoint_umidade + rnd(-4.0, 2.0)
        : rnd(s.umid_min, s.umid_max + (s.presenca ? 5.0 : 0.0));
    s.umidade = std::clamp(approach(s.umidade, tgt_u, rnd(2.5, 6.0)) + rnd(-2.0, 2.0), 20.0, 90.0);

    // Atualização física da luminosidade
    int tgt_l = (s.status_luz == "ligado")
        ? rnd(std::max(350, s.setpoint_luz + 80), 1100)
        : rnd(s.luz_min, std::max(s.luz_min + 20, s.luz_max / 3));
    s.luz = std::clamp(
        static_cast<int>(approach(s.luz, tgt_l, rnd(80.0, 220.0))) + rnd(-35, 35),
        0, 1500);
}

inline json build_payload(const RoomState& s) {
    return {
        {"id_sala",          s.id},
        {"temperatura",      std::round(s.temp    * 100.0) / 100.0},
        {"umidade",          std::round(s.umidade * 100.0) / 100.0},
        {"luminosidade",     s.luz},
        {"presenca",         s.presenca},
        {"status_ac",        s.status_ac},
        {"status_luz",       s.status_luz},
        {"setpoint_ac",      s.setpoint_ac},
        {"setpoint_umidade", s.setpoint_umidade},
        {"setpoint_luz",     s.setpoint_luz},
        {"modo_ac",          s.modo_ac},
        {"timestamp",        static_cast<long>(std::time(nullptr))}
    };
}
