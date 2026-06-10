# ── Estágio de build ──────────────────────────────────────────────────────────
FROM debian:bookworm-slim AS builder

RUN apt-get update && apt-get install -y --no-install-recommends \
        g++ \
        libmosquitto-dev \
        nlohmann-json3-dev \
        libyaml-cpp-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /build
COPY simulation.hpp main.cpp ./

RUN g++ -O2 -std=c++17 \
        main.cpp \
        -o simulator \
        -lmosquitto \
        -lyaml-cpp \
        -lpthread

# ── Imagem de runtime (mínima) ────────────────────────────────────────────────
FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
        libmosquitto1 \
        libyaml-cpp0.7 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY --from=builder /build/simulator .

CMD ["./simulator"]
