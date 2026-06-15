import { C, slideBase, node, connector, card } from './theme.mjs';

export async function slide04(presentation, ctx) {
  const slide = slideBase(presentation, ctx, '03 | Comunicacao InterSCity', 'A bridge traduz MQTT em chamadas REST para catalog, adaptor e collector', 'ponto de integracao');
  node(ctx, slide, 72, 160, 190, 96, 'MQTT sensores', 'payload por sala\nac-iot/+/sensores', C.blue2, C.blue);
  node(ctx, slide, 326, 160, 210, 96, 'Bridge C++', 'normaliza dados\nUUID deterministico', C.purple2, C.purple);
  node(ctx, slide, 610, 120, 220, 86, 'Catalog', 'capabilities\nresources', C.amber2, C.amber);
  node(ctx, slide, 610, 262, 220, 86, 'Adaptor', 'POST data\ntelemetria atual', C.amber2, C.amber);
  node(ctx, slide, 610, 404, 220, 86, 'Collector', 'GET data/last\nconsulta do operador', C.amber2, C.amber);
  connector(ctx, slide, 262, 208, 326, 208, C.blue);
  ctx.addShape(slide, { x: 536, y: 206, w: 42, h: 4, fill: C.purple });
  ctx.addShape(slide, { x: 576, y: 163, w: 4, h: 284, fill: C.purple });
  [163, 305, 447].forEach((y) => {
    ctx.addShape(slide, { x: 576, y: y - 2, w: 34, h: 4, fill: C.purple });
    ctx.addText(slide, { x: 596, y: y - 13, w: 24, h: 24, text: '>', fontSize: 18, bold: true, color: C.purple, align: 'center', insets: { left: 0, right: 0, top: 0, bottom: 0 } });
  });
  card(ctx, slide, 902, 140, 274, 126, 'Controle de carga', '8 workers HTTP\nrate limit 20 req/s\nretry em falhas 5xx', C.purple);
  card(ctx, slide, 902, 304, 274, 126, 'Observabilidade', 'metricas no topico\nac-iot/system/bridge_metrics\nconsumidas pelo dashboard', C.blue);
  card(ctx, slide, 902, 468, 274, 92, 'Estado visual', 'verde = sucesso atual\namarelo = instavel\ncinza = sem metrica', C.amber);
  ctx.addText(slide, { x: 74, y: 560, w: 720, h: 34, text: 'A integracao nao bloqueia o MQTT: quando o InterSCity oscila, o sistema local continua operando e a bridge tenta retomar.', fontSize: 18, bold: true, color: C.ink, insets: { left: 0, right: 0, top: 0, bottom: 0 } });
  return slide;
}
