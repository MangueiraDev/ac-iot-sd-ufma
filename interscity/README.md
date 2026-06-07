# InterSCity bridge

Servico C++ que integra o sistema AC IoT UFMA com a plataforma InterSCity da
UFMA, usando os endpoints do tutorial em
`https://cidadesinteligentes.lsdi.ufma.br/interscity_lh`.

O bridge:

- assina o topico MQTT `ac-iot/+/sensores`;
- garante o cadastro das capabilities usadas pelo simulador;
- cadastra `sala01`, `sala02` e `sala03` como resources do InterSCity;
- envia cada leitura para o Resource Adaptor em `POST /resources/:uuid/data`.

O bridge usa diretamente as APIs REST dos microsservicos `catalog`, `adaptor` e
`collector`. O gateway Kong legado nao e necessario para o fluxo MQTT ->
InterSCity.

## Como executar

O servico sobe junto com a pilha principal:

```bash
docker compose up -d --build
```

Para acompanhar o bridge:

```bash
docker compose logs -f interscity
```

## Endpoints uteis

### UFMA

- Resource Cataloguer: `https://cidadesinteligentes.lsdi.ufma.br/interscity_lh/catalog`
- Resource Adaptor: `https://cidadesinteligentes.lsdi.ufma.br/interscity_lh/adaptor`
- Data Collector: `https://cidadesinteligentes.lsdi.ufma.br/interscity_lh/collector`

### Local

- Resource Cataloguer: `http://localhost:3000`
- Resource Adaptor: `http://localhost:3002`
- Data Collector: `http://localhost:4000`
- Actuator Controller: `http://localhost:5001`
- Resource Discoverer: `http://localhost:3004`
- Kong: `http://localhost:8000`
- RabbitMQ Management: `http://localhost:15672`

## Configuracao

O `docker-compose.yml` ja define a URL base da UFMA:
`INTERSCITY_BASE_URL=https://cidadesinteligentes.lsdi.ufma.br/interscity_lh`.

Com essa URL base, o bridge deriva automaticamente:

- `catalog`: cadastro/consulta de capabilities e resources;
- `adaptor`: envio das leituras em `POST /resources/:uuid/data`;
- `collector`: consulta da ultima leitura em `GET /resources/:uuid/data/last`.

Para rodar o bridge fora do Compose, copie `config.example.env` para `.env` e
ajuste os hosts conforme o ambiente.
