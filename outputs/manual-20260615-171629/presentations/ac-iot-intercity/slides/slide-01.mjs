import { C, titleBlock, bodyText, metric, node, connector } from './theme.mjs';

export async function slide01(presentation, ctx) {
  const slide = presentation.slides.add();
  ctx.addShape(slide, { x: 0, y: 0, w: ctx.W, h: ctx.H, fill: C.bg });
  ctx.addShape(slide, { x: 0, y: 0, w: 440, h: ctx.H, fill: '#EAF2FF' });
  ctx.addShape(slide, { x: 68, y: 88, w: 122, h: 122, geometry: 'ellipse', fill: C.blue2, line: ctx.line(C.blue, 2) });
  ctx.addText(slide, { x: 88, y: 124, w: 82, h: 54, text: 'AC\nIoT', fontSize: 26, bold: true, color: C.blue, align: 'center', insets: { left: 0, right: 0, top: 0, bottom: 0 } });
  titleBlock(ctx, slide, 'AC-IoT UFMA', 520, 100, 590, 58, 44);
  titleBlock(ctx, slide, 'Operacao distribuida para 1.000 salas', 520, 164, 650, 98, 34);
  bodyText(ctx, slide, 'Monitoramento, automacao e controle de ar-condicionado com MQTT, dashboard web e integracao InterSCity.', 522, 280, 610, 70, 18);
  metric(ctx, slide, 520, 390, 160, 104, '1.000', 'salas simuladas', C.blue);
  metric(ctx, slide, 704, 390, 160, 104, '40', 'blocos operacionais', C.teal);
  metric(ctx, slide, 888, 390, 160, 104, '8', 'workers HTTP', C.purple);
  metric(ctx, slide, 1072, 390, 160, 104, '20/s', 'limite IC', C.amber);
  node(ctx, slide, 86, 304, 250, 82, 'Sensores', 'telemetria por sala', C.paper, C.blue);
  node(ctx, slide, 86, 428, 250, 82, 'MQTT + Bridge', 'fluxo assíncrono', C.paper, C.teal);
  node(ctx, slide, 86, 552, 250, 82, 'InterSCity', 'catalog/adaptor/collector', C.paper, C.purple);
  connector(ctx, slide, 211, 386, 211, 428, C.blue);
  connector(ctx, slide, 211, 510, 211, 552, C.blue);
  ctx.addText(slide, { x: 520, y: 616, w: 610, h: 22, text: 'Deck atualizado em 15/06/2026', fontSize: 12, color: C.muted, insets: { left: 0, right: 0, top: 0, bottom: 0 } });
  return slide;
}
