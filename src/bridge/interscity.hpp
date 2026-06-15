#pragma once
// Cliente REST para a plataforma InterSCity UFMA.
// Registra capabilities/recursos e envia telemetria via HTTP.
#include <curl/curl.h>
#include <nlohmann/json.hpp>

#include <chrono>
#include <ctime>
#include <iomanip>
#include <iostream>
#include <sstream>
#include <string>
#include <thread>
#include <vector>

#include "config.hpp"

using json = nlohmann::json;

// ── Helpers internos ──────────────────────────────────────────────────────────

namespace ic_detail {

struct Response { int status = 0; std::string body; };

struct TelemetryResult {
    bool ok = false;
    int status = 0;
    int attempts = 0;
    unsigned long long request_bytes = 0;
    unsigned long long response_bytes = 0;
    unsigned long long latency_ms = 0;
};

static size_t write_cb(char* ptr, size_t sz, size_t n, void* ud) {
    static_cast<std::string*>(ud)->append(ptr, sz * n);
    return sz * n;
}

static std::string iso8601_now() {
    auto t = std::time(nullptr);
    std::tm tm{};
    gmtime_r(&t, &tm);
    std::ostringstream ss;
    ss << std::put_time(&tm, "%Y-%m-%dT%H:%M:%SZ");
    return ss.str();
}

static Response http_request(const std::string& url,
                              const std::string& method,    // "GET","POST","PUT"
                              const json*        body,
                              bool               ssl_verify) {
    Response result;
    CURL* curl = curl_easy_init();
    if (!curl) return result;

    struct curl_slist* headers = nullptr;
    headers = curl_slist_append(headers, "Accept: application/json");
    headers = curl_slist_append(headers, "Content-Type: application/json");

    std::string req_body, res_body;
    if (body) req_body = body->dump();

    curl_easy_setopt(curl, CURLOPT_URL,            url.c_str());
    curl_easy_setopt(curl, CURLOPT_HTTPHEADER,     headers);
    curl_easy_setopt(curl, CURLOPT_USERAGENT,      "ac-iot-bridge/2.0");
    curl_easy_setopt(curl, CURLOPT_WRITEFUNCTION,  write_cb);
    curl_easy_setopt(curl, CURLOPT_WRITEDATA,      &res_body);
    curl_easy_setopt(curl, CURLOPT_CONNECTTIMEOUT, 10L);
    curl_easy_setopt(curl, CURLOPT_TIMEOUT,        20L);

    if (!ssl_verify) {
        curl_easy_setopt(curl, CURLOPT_SSL_VERIFYPEER, 0L);
        curl_easy_setopt(curl, CURLOPT_SSL_VERIFYHOST, 0L);
    }

    if (method == "POST" || method == "PUT") {
        if (method == "POST") curl_easy_setopt(curl, CURLOPT_POST, 1L);
        else                  curl_easy_setopt(curl, CURLOPT_CUSTOMREQUEST, "PUT");
        curl_easy_setopt(curl, CURLOPT_POSTFIELDS,    req_body.c_str());
        curl_easy_setopt(curl, CURLOPT_POSTFIELDSIZE, static_cast<long>(req_body.size()));
    }

    if (curl_easy_perform(curl) == CURLE_OK) {
        long s = 0;
        curl_easy_getinfo(curl, CURLINFO_RESPONSE_CODE, &s);
        result.status = static_cast<int>(s);
        result.body   = res_body;
    }

    curl_slist_free_all(headers);
    curl_easy_cleanup(curl);
    return result;
}

} // namespace ic_detail

// ── InterSCityClient ──────────────────────────────────────────────────────────

class InterSCityClient {
public:
    InterSCityClient(const std::string& base_url, bool ssl_verify)
        : catalog_(base_url + "/catalog"),
          adaptor_(base_url + "/adaptor"),
          ssl_verify_(ssl_verify) {
        curl_global_init(CURL_GLOBAL_DEFAULT);
    }
    ~InterSCityClient() { curl_global_cleanup(); }

    // Aguarda o Cataloguer estar disponível (chama em loop)
    void wait_ready(int max_attempts = 120) const {
        for (int i = 1; i <= max_attempts; ++i) {
            auto r = get(catalog_ + "/capabilities");
            if (r.status == 200) {
                std::cout << "[INFO] InterSCity disponível: " << catalog_ << "\n";
                return;
            }
            std::cerr << "[WAIT] Cataloguer (" << i << "/" << max_attempts
                      << "): status=" << r.status << "\n";
            std::this_thread::sleep_for(std::chrono::seconds(5));
        }
        throw std::runtime_error("InterSCity não ficou disponível no tempo esperado");
    }

    void ensure_capability(const CapabilityConfig& cap) const {
        auto r = get(catalog_ + "/capabilities/" + cap.name);
        if (r.status == 200) return; // já existe

        json body{{"name", cap.name}, {"description", cap.description}, {"capability_type", cap.type}};
        auto pr = post(catalog_ + "/capabilities", body);
        if (pr.status == 201 || pr.status == 200) {
            std::cout << "[CAP] Registrada: " << cap.name << "\n";
        } else if (pr.status == 422 || (pr.status == 400 && pr.body.find("taken") != std::string::npos)) {
            // já existia — ok
        } else {
            std::cerr << "[WARN] Capability " << cap.name << ": status=" << pr.status << "\n";
        }
    }

    void ensure_resource(const std::string& id, const RoomConfig& room,
                         const std::vector<std::string>& cap_names) const {
        json body{{"data", {
            {"uuid",         room.uuid},
            {"description",  room.description},
            {"lat",          room.lat},
            {"lon",          room.lon},
            {"status",       "active"},
            {"capabilities", cap_names}
        }}};

        std::string url = catalog_ + "/resources/" + room.uuid;
        auto gr = get(url);
        if (gr.status == 200) {
            if (env_flag(getenv_or("INTERSCITY_UPDATE_RESOURCES", "false"))) {
                put(url, body);
                std::cout << "[REC] Atualizado: " << id << "\n";
            }
        } else {
            auto cr = post(catalog_ + "/resources", body);
            if (cr.status == 201 || cr.status == 200) {
                std::cout << "[REC] Registrado: " << id << "\n";
            } else if (cr.status == 422) {
                put(url, body);
            } else {
                std::cerr << "[WARN] Recurso " << id << ": status=" << cr.status << "\n";
            }
        }
    }

    // Envia telemetria de uma sala para o InterSCity Adaptor (até 3 tentativas)
    ic_detail::TelemetryResult send_telemetry_result(const std::string& uuid, const json& data) const {
        const auto started = std::chrono::steady_clock::now();
        const std::string ts = ic_detail::iso8601_now();
        json payload{{"data", json::object()}};
        for (const auto& [key, val] : data.items()) {
            if (!val.is_null())
                payload["data"][key] = json::array({{{"value", val}, {"timestamp", ts}}});
        }

        ic_detail::TelemetryResult result;
        result.request_bytes = payload.dump().size();
        std::string url = adaptor_ + "/resources/" + uuid + "/data";
        for (int attempt = 1; attempt <= 3; ++attempt) {
            result.attempts = attempt;
            auto r = post(url, payload);
            result.status = r.status;
            result.response_bytes += r.body.size();
            if (r.status >= 200 && r.status < 300) {
                result.ok = true;
                break;
            }
            if (r.status != 0 && r.status < 500) { // erro de cliente — não retenta
                std::cerr << "[WARN] Telemetria rejeitada (status=" << r.status << ")\n";
                break;
            }
            std::cerr << "[WARN] Telemetria falhou (tentativa " << attempt
                      << "/3, status=" << r.status << ")\n";
            std::this_thread::sleep_for(std::chrono::seconds(attempt * 2));
        }
        result.latency_ms = static_cast<unsigned long long>(
            std::chrono::duration_cast<std::chrono::milliseconds>(
                std::chrono::steady_clock::now() - started).count());
        return result;
    }

    bool send_telemetry(const std::string& uuid, const json& data) const {
        return send_telemetry_result(uuid, data).ok;
    }

private:
    std::string catalog_;
    std::string adaptor_;
    bool        ssl_verify_;

    ic_detail::Response get (const std::string& url) const
        { return ic_detail::http_request(url, "GET",  nullptr, ssl_verify_); }
    ic_detail::Response post(const std::string& url, const json& b) const
        { return ic_detail::http_request(url, "POST", &b,      ssl_verify_); }
    ic_detail::Response put (const std::string& url, const json& b) const
        { return ic_detail::http_request(url, "PUT",  &b,      ssl_verify_); }
};
