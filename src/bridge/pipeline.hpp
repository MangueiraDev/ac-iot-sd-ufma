#pragma once
// Pipeline assíncrono: thread MQTT (produtor) → fila coalescente → pool HTTP.
// O loop MQTT nunca bloqueia em chamadas HTTP.
#include <atomic>
#include <chrono>
#include <condition_variable>
#include <cstdlib>
#include <deque>
#include <iostream>
#include <map>
#include <mutex>
#include <set>
#include <string>
#include <thread>
#include <vector>

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

class Pipeline {
public:
    Pipeline(const std::map<std::string, RoomConfig>& rooms,
             const InterSCityClient& client)
        : rooms_(rooms),
          client_(client),
          worker_count_(std::max(1, getenv_int("HTTP_WORKERS", 8))),
          queue_max_(static_cast<size_t>(std::max(100, getenv_int("QUEUE_MAX", 20000)))),
          max_rps_(std::max(1, getenv_int("MAX_INTERSCITY_RPS", 20))) {}

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
        const std::string& uuid = it->second.uuid;
        auto pending = pending_payloads_.find(uuid);
        if (pending != pending_payloads_.end()) {
            pending->second = std::move(filtered);
            coalesced_++;
            return;
        }

        if (pending_order_.size() >= queue_max_) {
            dropped_++;
            std::cerr << "[WARN] Fila cheia (" << queue_max_
                      << ") — mensagem descartada. dropped=" << dropped_.load() << "\n";
            return;
        }
        pending_order_.push_back(uuid);
        pending_payloads_[uuid] = std::move(filtered);
        cv_.notify_one();
    }

    // Inicia o worker thread consumidor
    void start() {
        running_ = true;
        for (int i = 0; i < worker_count_; ++i)
            workers_.emplace_back([this, i] { worker_loop(i); });
        std::cout << "[INFO] Pipeline InterSCity: workers=" << worker_count_
                  << " queue_max=" << queue_max_
                  << " max_rps=" << max_rps_
                  << " coalesce=latest-per-resource\n";
    }

    void stop() {
        running_ = false;
        cv_.notify_all();
        for (auto& worker : workers_)
            if (worker.joinable()) worker.join();
    }

    json metrics() const {
        size_t queue_size = 0;
        {
            std::lock_guard lock(mutex_);
            queue_size = pending_order_.size();
        }
        const auto sent = sent_.load();
        const auto failed = failed_.load();
        const auto total = sent + failed;
        const auto latency_samples = latency_samples_.load();
        const auto latency_sum = latency_ms_sum_.load();
        const auto avg_latency = latency_samples ? (latency_sum / latency_samples) : 0;
        return {
            {"type", "bridge_metrics"},
            {"sent", sent},
            {"failed", failed},
            {"total_attempted", total},
            {"dropped", dropped_.load()},
            {"coalesced", coalesced_.load()},
            {"queue_size", queue_size},
            {"queue_max", queue_max_},
            {"workers", worker_count_},
            {"max_rps", max_rps_},
            {"request_bytes", request_bytes_.load()},
            {"response_bytes", response_bytes_.load()},
            {"latency_ms_avg", avg_latency},
            {"latency_ms_max", latency_ms_max_.load()},
            {"last_status", last_status_.load()},
            {"last_ok", last_ok_.load()}
        };
    }

private:
    std::map<std::string, RoomConfig> rooms_;
    const InterSCityClient&           client_;
    std::deque<std::string>           pending_order_;
    std::map<std::string, json>       pending_payloads_;
    mutable std::mutex                mutex_;
    std::condition_variable           cv_;
    std::atomic<bool>                 running_{false};
    std::vector<std::thread>          workers_;
    int                               worker_count_;
    size_t                            queue_max_;
    int                               max_rps_;
    std::mutex                        rate_mutex_;
    std::chrono::steady_clock::time_point next_send_{std::chrono::steady_clock::now()};
    std::atomic<unsigned long long>   sent_{0};
    std::atomic<unsigned long long>   failed_{0};
    std::atomic<unsigned long long>   dropped_{0};
    std::atomic<unsigned long long>   coalesced_{0};
    std::atomic<unsigned long long>   request_bytes_{0};
    std::atomic<unsigned long long>   response_bytes_{0};
    std::atomic<unsigned long long>   latency_ms_sum_{0};
    std::atomic<unsigned long long>   latency_samples_{0};
    std::atomic<unsigned long long>   latency_ms_max_{0};
    std::atomic<int>                  last_status_{0};
    std::atomic<bool>                 last_ok_{false};

    void worker_loop(int worker_id) {
        std::cout << "[INFO] Worker InterSCity #" << worker_id << " iniciado\n";
        while (true) {
            std::unique_lock lock(mutex_);
            cv_.wait(lock, [this] { return !pending_order_.empty() || !running_; });
            if (!running_ && pending_order_.empty()) break;

            while (!pending_order_.empty()) {
                const std::string uuid = std::move(pending_order_.front());
                pending_order_.pop_front();
                auto payload_it = pending_payloads_.find(uuid);
                if (payload_it == pending_payloads_.end()) continue;
                json payload = std::move(payload_it->second);
                pending_payloads_.erase(payload_it);
                lock.unlock();

                throttle();
                auto result = client_.send_telemetry_result(uuid, payload);
                request_bytes_.fetch_add(result.request_bytes);
                response_bytes_.fetch_add(result.response_bytes);
                latency_ms_sum_.fetch_add(result.latency_ms);
                latency_samples_.fetch_add(1);
                last_status_ = result.status;
                last_ok_ = result.ok;
                unsigned long long prev_max = latency_ms_max_.load();
                while (result.latency_ms > prev_max &&
                       !latency_ms_max_.compare_exchange_weak(prev_max, result.latency_ms)) {}

                if (result.ok) {
                    const auto n = ++sent_;
                    if (n <= 20 || n % 100 == 0)
                        std::cout << "[OK] Worker #" << worker_id
                                  << " telemetria enviada: " << uuid
                                  << " total=" << n
                                  << " coalesced=" << coalesced_.load() << "\n";
                } else {
                    const auto n = ++failed_;
                    std::cerr << "[WARN] Worker #" << worker_id
                              << " falha InterSCity: " << uuid
                              << " status=" << result.status
                              << " failed=" << n << "\n";
                }

                lock.lock();
            }
        }
        std::cout << "[INFO] Worker InterSCity #" << worker_id << " encerrado\n";
    }

    void throttle() {
        const auto spacing = std::chrono::microseconds(1000000 / max_rps_);
        std::unique_lock lock(rate_mutex_);
        const auto now = std::chrono::steady_clock::now();
        if (now < next_send_) {
            const auto wait_until = next_send_;
            next_send_ += spacing;
            lock.unlock();
            std::this_thread::sleep_until(wait_until);
            return;
        }
        next_send_ = now + spacing;
    }
};
