#pragma once
// Tipos de configuração e carregamento do rooms.yaml.
#include <cstdlib>
#include <map>
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

inline std::map<std::string, RoomConfig> load_rooms(const std::string& path) {
    auto root = YAML::LoadFile(path);
    std::map<std::string, RoomConfig> rooms;
    for (const auto& item : root["rooms"]) {
        const auto cfg = item.second;
        RoomConfig r;
        r.uuid        = cfg["uuid"].as<std::string>();
        r.description = cfg["description"].as<std::string>();
        r.lat         = cfg["lat"].as<double>();
        r.lon         = cfg["lon"].as<double>();
        rooms[item.first.as<std::string>()] = r;
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
