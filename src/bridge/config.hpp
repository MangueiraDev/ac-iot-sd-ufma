#pragma once
// Tipos de configuração e carregamento do rooms.yaml.
#include <algorithm>
#include <cctype>
#include <cstdlib>
#include <iomanip>
#include <map>
#include <sstream>
#include <stdexcept>
#include <string>
#include <vector>
#include <yaml-cpp/yaml.h>

struct RoomConfig {
    std::string uuid;
    std::string description;
    double lat{};
    double lon{};
};

struct CapabilityConfig {
    std::string name;
    std::string description;
    std::string type; // "sensor" | "actuator"
};

inline std::string getenv_or(const char* key, const char* def = "") {
    const char* v = std::getenv(key);
    return v ? std::string(v) : std::string(def);
}

inline bool env_flag(const std::string& val) {
    return val == "1" || val == "true" || val == "yes" || val == "sim";
}

inline int getenv_int(const char* key, int def) {
    const char* v = std::getenv(key);
    if (!v || !*v) return def;
    try { return std::stoi(v); }
    catch (...) { return def; }
}

inline std::string room_id_for_index(int idx) {
    std::ostringstream ss;
    if (idx <= 99) {
        ss << "sala" << std::setw(2) << std::setfill('0') << idx;
    } else {
        ss << "sala" << std::setw(4) << std::setfill('0') << idx;
    }
    return ss.str();
}

inline int room_index_from_id(const std::string& id) {
    std::string digits;
    for (char c : id) {
        if (std::isdigit(static_cast<unsigned char>(c))) digits.push_back(c);
    }
    if (digits.empty()) return 0;
    try { return std::stoi(digits); }
    catch (...) { return 0; }
}

inline std::string room_uuid_for_index(int idx) {
    std::ostringstream ss;
    ss << "00000000-0000-4000-8000-"
       << std::setw(12) << std::setfill('0') << (100 + idx);
    return ss.str();
}

inline RoomConfig generated_room(int idx) {
    RoomConfig r;
    r.uuid = room_uuid_for_index(idx);
    std::ostringstream desc;
    desc << "Sala " << std::setw(4) << std::setfill('0') << idx << " - AC IoT UFMA";
    r.description = desc.str();
    r.lat = -2.5589 + (idx % 40) * 0.00001;
    r.lon = -44.3095 + (idx / 40) * 0.00001;
    return r;
}

inline std::map<std::string, RoomConfig> load_rooms(const std::string& path) {
    auto root = YAML::LoadFile(path);
    std::map<std::string, RoomConfig> rooms;
    if (root["rooms"]) {
        for (const auto& item : root["rooms"]) {
            const auto cfg = item.second;
            RoomConfig r;
            const std::string id = item.first.as<std::string>();
            const int idx = room_index_from_id(id);
            const RoomConfig fallback = generated_room(idx);
            r.uuid        = cfg["uuid"]        ? cfg["uuid"].as<std::string>()        : fallback.uuid;
            r.description = cfg["description"] ? cfg["description"].as<std::string>() : fallback.description;
            r.lat         = cfg["lat"]         ? cfg["lat"].as<double>()              : fallback.lat;
            r.lon         = cfg["lon"]         ? cfg["lon"].as<double>()              : fallback.lon;
            rooms[id] = r;
        }
    }

    const int requested = getenv_int("ROOM_COUNT", static_cast<int>(rooms.size()));
    for (int i = 1; i <= requested; ++i) {
        const std::string id = room_id_for_index(i);
        if (!rooms.count(id)) rooms[id] = generated_room(i);
    }

    if (rooms.empty()) throw std::runtime_error("rooms.yaml sem salas definidas");
    return rooms;
}

inline std::vector<CapabilityConfig> load_capabilities(const std::string& path) {
    auto root = YAML::LoadFile(path);
    std::vector<CapabilityConfig> caps;
    for (const auto& item : root["capabilities"]) {
        CapabilityConfig c;
        c.name        = item["name"].as<std::string>();
        c.description = item["description"].as<std::string>();
        c.type        = item["type"].as<std::string>("sensor");
        caps.push_back(c);
    }
    return caps;
}
