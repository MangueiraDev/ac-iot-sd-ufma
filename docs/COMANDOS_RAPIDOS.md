# Comandos Rapidos

Execute os comandos na raiz do projeto.

```bash
cd /Users/mangueira/mangueira-dev/ac-iot-sd-ufma
```

## Iniciar

```bash
docker compose up -d --build
```

```bash
docker compose ps -a
```

## Parar

```bash
docker compose down
```

## Resetar tudo

Use somente quando quiser apagar dados persistidos do projeto.

```bash
docker compose down -v --remove-orphans
```

## Abrir interfaces

Painel web:

```bash
open simulador-web/index.html
```

Node-RED:

```bash
open http://localhost:1880
```

InterSCity UFMA - recursos cadastrados:

```bash
open https://cidadesinteligentes.lsdi.ufma.br/interscity_lh/catalog/resources
```

InterSCity UFMA - ultima leitura da SALA01:

```bash
open https://cidadesinteligentes.lsdi.ufma.br/interscity_lh/collector/resources/00000000-0000-4000-8000-000000000101/data/last
```

## Logs principais

Bridge MQTT -> InterSCity:

```bash
docker compose logs -f interscity
```

Simulador automatico:

```bash
docker compose logs -f simulador
```

Mosquitto:

```bash
docker compose logs -f mosquitto
```

Pressione `Ctrl + C` para sair dos logs.

## Testar todo o sistema

1. Subir o sistema:

```bash
docker compose up -d --build
```

2. Confirmar containers:

```bash
docker compose ps -a
```

Esperado: `mosquitto`, `simulador`, `nodered` e `interscity` rodando.

3. Confirmar mensagens MQTT do simulador:

```bash
docker compose exec mosquitto mosquitto_sub -h localhost -t 'ac-iot/+/sensores' -C 3
```

Esperado: 3 mensagens JSON das salas.

4. Confirmar envio para InterSCity:

```bash
docker compose logs interscity
```

Esperado: mensagens como `Telemetria enviada ao InterSCity`.

5. Confirmar Cataloguer UFMA:

```bash
curl -k https://cidadesinteligentes.lsdi.ufma.br/interscity_lh/catalog/resources
```

Esperado: JSON com lista de `resources`.

6. Confirmar Data Collector da SALA01:

```bash
curl -k https://cidadesinteligentes.lsdi.ufma.br/interscity_lh/collector/resources/00000000-0000-4000-8000-000000000101/data/last
```

Esperado: JSON com leituras recentes. Se retornar `Resource not found`, aguarde o bridge cadastrar/enviar dados e tente novamente.

7. Abrir o painel web:

```bash
open simulador-web/index.html
```

Esperado no painel:

- `Salas 3`
- MQTT conectado quando o Mosquitto WebSocket `9001` estiver ativo
- InterSCity sincronizado depois que o Data Collector receber leitura

## Testar envio manual pelo painel

1. Abra o painel web.
2. Selecione uma sala.
3. Ajuste temperatura, umidade, luminosidade ou presenca.
4. Clique em `Aplicar`.
5. Veja os eventos em `Eventos MQTT`.
6. Confira o bridge:

```bash
docker compose logs -f interscity
```

## Celular ou outro computador

Descobrir IP do Mac:

```bash
ipconfig getifaddr en0
```

Servir a pagina web:

```bash
python3 -m http.server 8080 --bind 0.0.0.0
```

Abrir no celular, trocando `IP_DO_MAC` pelo IP encontrado:

```text
http://IP_DO_MAC:8080/simulador-web/
```

Observacao: no celular, `localhost` e o proprio celular. Use sempre o IP do Mac.

## Problemas comuns

- `MQTT falhou`: verifique se o Mosquitto esta rodando e se a porta `9001` esta aberta.
- `InterSCity indisponivel` no navegador: o certificado HTTPS da UFMA pode estar expirado. O bridge usa `INTERSCITY_SSL_VERIFY=false`, mas o navegador pode bloquear consultas diretas.
- `Resource not found` no Data Collector: a sala ainda nao foi cadastrada ou ainda nao recebeu telemetria.
- Docker nao responde: abra o Docker Desktop e rode `docker compose ps -a` novamente.
