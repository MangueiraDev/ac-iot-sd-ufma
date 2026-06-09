# Acesso Rapido do Sistema

Passo a passo objetivo para resetar, reconstruir, abrir as interfaces e testar a conexao com InterSCity.

Execute tudo na raiz do projeto:

```bash
cd /Users/mangueira/mangueira-dev/ac-iot-sd-ufma
```

## 1. Resetar Docker e remover cache

Use quando o sistema estiver travado, com containers antigos, build inconsistente ou dados persistidos causando erro.

Parar e remover containers, redes e volumes do projeto:

```bash
docker compose down -v --remove-orphans
```

Remover cache de build Docker:

```bash
docker builder prune -af
```

Remover imagens Docker nao usadas:

```bash
docker image prune -af
```

Opcional: remover volumes Docker nao usados fora deste projeto:

```bash
docker volume prune -f
```

## 2. Reiniciar e reconstruir build Docker

Reconstruir e subir tudo em segundo plano:

```bash
docker compose up -d --build
```

Verificar se os containers subiram:

```bash
docker compose ps -a
```

Esperado: `mosquitto`, `simulador`, `nodered` e `interscity` em execucao.

Se quiser reiniciar sem rebuild:

```bash
docker compose restart
```

Se quiser reconstruir apenas o bridge InterSCity:

```bash
docker compose up -d --build interscity
```

## 3. Abrir paginas web e Node-RED

Painel web do simulador:

```bash
open simulador-web/index.html
```

Node-RED:

```bash
open http://localhost:1880
```

Cataloguer InterSCity UFMA:

```bash
open https://cidadesinteligentes.lsdi.ufma.br/interscity_lh/catalog/resources
```

Ultima leitura da `sala01` no Data Collector:

```bash
open https://cidadesinteligentes.lsdi.ufma.br/interscity_lh/collector/resources/00000000-0000-4000-8000-000000000101/data/last
```

Servicos InterSCity locais, se estiver usando a stack local:

```bash
open http://localhost:3000/resources
```

```bash
open http://localhost:4000/resources/00000000-0000-4000-8000-000000000101/data/last
```

## 4. Conectar com InterSCity

O bridge `interscity` ja sobe configurado para a base UFMA:

```text
https://cidadesinteligentes.lsdi.ufma.br/interscity_lh
```

Subir ou reiniciar apenas o bridge:

```bash
docker compose up -d --build interscity
```

Acompanhar conexao MQTT e envio REST para InterSCity:

```bash
docker compose logs -f interscity
```

Mensagens esperadas nos logs:

```text
Conectado ao broker MQTT
Bridge MQTT -> InterSCity iniciado
Telemetria enviada ao InterSCity
```

Testar Cataloguer UFMA:

```bash
curl -k https://cidadesinteligentes.lsdi.ufma.br/interscity_lh/catalog/resources
```

Testar ultima leitura da `sala01`:

```bash
curl -k https://cidadesinteligentes.lsdi.ufma.br/interscity_lh/collector/resources/00000000-0000-4000-8000-000000000101/data/last
```

UUIDs das salas:

```text
sala01 = 00000000-0000-4000-8000-000000000101
sala02 = 00000000-0000-4000-8000-000000000102
sala03 = 00000000-0000-4000-8000-000000000103
```

## 5. Testes rapidos do fluxo MQTT -> InterSCity

Ver mensagens MQTT geradas pelo simulador:

```bash
docker compose exec mosquitto mosquitto_sub -h localhost -t 'ac-iot/+/sensores' -C 3
```

Publicar uma leitura manual para `sala01`:

```bash
docker compose exec mosquitto mosquitto_pub -h localhost -t 'ac-iot/sala01/sensores' -m '{"sala":"sala01","temperatura":23.5,"umidade":55,"luminosidade":420,"presenca":true}'
```

Verificar se o bridge recebeu e enviou:

```bash
docker compose logs interscity
```

Verificar ultima leitura no Data Collector:

```bash
curl -k https://cidadesinteligentes.lsdi.ufma.br/interscity_lh/collector/resources/00000000-0000-4000-8000-000000000101/data/last
```

## 6. Problemas comuns de conexao ou acesso

Docker nao responde:

```bash
docker compose ps -a
```

```bash
docker compose restart
```

Node-RED nao abre em `localhost:1880`:

```bash
docker compose logs -f nodered
```

Porta `1880` ocupada:

```bash
lsof -i :1880
```

MQTT falhou no painel web:

```bash
docker compose logs -f mosquitto
```

```bash
docker compose exec mosquitto mosquitto_sub -h localhost -t 'ac-iot/+/sensores' -C 1
```

Bridge InterSCity nao envia dados:

```bash
docker compose logs -f interscity
```

```bash
docker compose restart interscity
```

InterSCity UFMA nao responde ou da erro HTTPS:

```bash
curl -k -i --max-time 10 https://cidadesinteligentes.lsdi.ufma.br/interscity_lh/catalog/resources
```

Data Collector retorna `Resource not found`:

```bash
docker compose logs -f interscity
```

Aguarde uma nova telemetria do simulador ou publique uma leitura manual via MQTT.

Reconstruir tudo do zero quando nada resolver:

```bash
docker compose down -v --remove-orphans
docker builder prune -af
docker compose up -d --build
docker compose ps -a
```
