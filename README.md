# AC-IoT SD UFMA

Sistema distribuído de monitoramento e automação de ar-condicionado em salas de aula, integrado à plataforma **InterSCity UFMA**.

## Estrutura

```
ac-iot-sd-ufma/
├── config/
│   └── rooms.yaml            # Salas e capabilities — edite aqui para adicionar salas
├── src/
│   ├── simulator/            # Simula sensores IoT (C++17)
│   │   ├── simulation.hpp    # Física e automação (puro, sem I/O)
│   │   ├── main.cpp          # Loop MQTT + carregamento YAML
│   │   └── Dockerfile
│   ├── bridge/               # Bridge MQTT → InterSCity UFMA (C++17, async)
│   │   ├── config.hpp        # Tipos + carregamento YAML
│   │   ├── interscity.hpp    # Cliente REST InterSCity (libcurl)
│   │   ├── pipeline.hpp      # Fila assíncrona: thread MQTT → thread HTTP
│   │   ├── main.cpp          # Entry point
│   │   └── Dockerfile
│   └── web/
│       └── static/           # Dashboard (Nginx, MQTT via WebSocket)
│           ├── index.html
│           ├── app.js
│           └── style.css
├── docker/
│   ├── mosquitto/config/     # mosquitto.conf (TCP 1883 + WS 9001)
│   └── nodered/data/         # Flows Node-RED (perfil opcional)
├── docs/                     # Documentação
├── docker-compose.local.yml
└── .env.example
```

## Subir o sistema

```bash
docker compose -f docker-compose.local.yml up -d --build
```

## Acessos

| Interface             | URL                                                                         |
|-----------------------|-----------------------------------------------------------------------------|
| Dashboard web         | http://localhost:8080                                                       |
| Node-RED (opcional)   | http://localhost:1880                                                       |
| InterSCity Cataloguer | https://cidadesinteligentes.lsdi.ufma.br/interscity_lh/catalog/resources   |

## Documentação

- [`docs/operacional.md`](docs/operacional.md) — arquitetura, comandos de operação e diagnóstico
- [`docs/acesso.md`](docs/acesso.md) — referência rápida de comandos
- [`docs/gantt.md`](docs/gantt.md) — status de implementação e cronograma
