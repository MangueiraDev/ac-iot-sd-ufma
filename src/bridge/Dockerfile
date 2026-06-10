# ── Estágio de build ──────────────────────────────────────────────────────────
FROM debian:bookworm-slim AS builder

RUN apt-get update && apt-get install -y --no-install-recommends \
        g++ \
        libmosquitto-dev \
        libcurl4-openssl-dev \
        nlohmann-json3-dev \
        libyaml-cpp-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /build
COPY config.hpp interscity.hpp pipeline.hpp main.cpp ./

RUN g++ -O2 -std=c++17 \
        main.cpp \
        -o bridge \
        -lmosquitto \
        -lcurl \
        -lyaml-cpp \
        -lpthread

# ── Imagem de runtime (mínima) ────────────────────────────────────────────────
FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
        libmosquitto1 \
        libcurl4 \
        libyaml-cpp0.7 \
        ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY --from=builder /build/bridge .

CMD ["./bridge"]
