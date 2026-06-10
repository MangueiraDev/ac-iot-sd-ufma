#pragma once
// Pipeline assíncrono: thread MQTT (produtor) → fila → thread HTTP (consumidor).
// O loop MQTT nunca bloqueia em chamadas HTTP.
#include <atomic>
#include <condition_variable>
#include <iostream>
#include <map>
#include <mutex>
#include <queue>
#include <set>
#include <string>
#include <thread>

#include <nlohmann/json.hpp>

#include "config.hpp"
#include "interscity.hpp"

using json = nlohmann::json;

// Campos aceitos pelo InterSCity (filtragem do payload MQTT)
static const std::set<std::string> TELEMETRY_FIELDS = {
    "temperatura", "umidade", "luminosidade", "presenca",
    "status_ac", "setpoint_ac", "setpoint_umidade",
    "setpoint_luz", "status_luz", "modo_ac"
};

static constexpr size_t QUEUE_MAX = 500; // descarta se pipeline travar por InterSCity lento

class Pipeline {
public:
    Pipeline(const std::map<std::string, RoomConfig>& rooms,
             const InterSCityClient& client)
        : rooms_(rooms), client_(client) {}

    // Chamado pelo callback MQTT (thread segura)
    void enqueue(const std::string& room_id, const json& raw_payload) {
        // Extrai UUID e filtra apenas campos conhecidos
        auto it = rooms_.find(room_id);
        if (it == rooms_.end()) {
            std::cerr << "[SKIP] Sala desconhecida: " << room_id << "\n";
            return;
        }
        json filtered;
        for (const auto& [k, v] : raw_payload.items())
            if (TELEMETRY_FIELDS.count(k) && !v.is_null())
                filtered[k] = v;

        if (filtered.empty()) return;

        std::unique_lock lock(mutex_);
        if (queue_.size() >= QUEUE_MAX) {
            std::cerr << "[WARN] Fila cheia (" << QUEUE_MAX << ") — mensagem descartada\n";
            return;
        }
        queue_.push({it->second.uuid, std::move(filtered)});
        cv_.notify_one();
    }

    // Inicia o worker thread consumidor
    void start() {
        running_ = true;
        worker_  = std::thread([this] { worker_loop(); });
    }

    void stop() {
        running_ = false;
        cv_.notify_all();
        if (worker_.joinable()) worker_.join();
    }

private:
    struct Item { std::string uuid; json payload; };

    std::map<std::string, RoomConfig> rooms_;
    const InterSCityClient&           client_;
    std::queue<Item>                  queue_;
    std::mutex                        mutex_;
    std::condition_variable           cv_;
    std::atomic<bool>                 running_{false};
    std::thread                       worker_;

    void worker_loop() {
        std::cout << "[INFO] Worker InterSCity iniciado\n";
        while (running_) {
            std::unique_lock lock(mutex_);
            cv_.wait(lock, [this] { return !queue_.empty() || !running_; });

            while (!queue_.empty()) {
                auto item = std::move(queue_.front());
                queue_.pop();
                lock.unlock();

                bool ok = client_.send_telemetry(item.uuid, item.payload);
                if (ok) std::cout << "[OK] Telemetria enviada: " << item.uuid << "\n";

                lock.lock();
            }
        }
        std::cout << "[INFO] Worker InterSCity encerrado\n";
    }
};
