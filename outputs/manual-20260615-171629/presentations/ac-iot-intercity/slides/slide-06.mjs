import { C, slideBase, metric, statusPill } from './theme.mjs';

export async function slide06(presentation, ctx) {
  const slide = slideBase(presentation, ctx, '05 | Metricas do sistema', 'Indicadores amarram operacao local e estado do InterSCity', 'amostra runtime');
  metric(ctx, slide, 62, 118, 178, 112, '1.000', 'salas simuladas', C.blue, 'publicacao MQTT ativa');
  metric(ctx, slide, 260, 118, 178, 112, '61.330', 'envios IC historicos', C.green, 'sent acumulado');
  metric(ctx, slide, 458, 118, 178, 112, '2.966', 'falhas IC', C.red, 'failed acumulado');
  metric(ctx, slide, 656, 118, 178, 112, '1.000', 'fila bridge', C.amber, 'queue_size atual');
  metric(ctx, slide, 854, 118, 178, 112, '8', 'workers HTTP', C.purple, 'paralelismo');
  metric(ctx, slide, 1052, 118, 148, 112, '20/s', 'rate limit', C.teal, 'MAX_RPS');
  ctx.addShape(slide, { x: 72, y: 300, w: 520, h: 210, fill: C.paper, line: ctx.line(C.line, 1) });
  ctx.addText(slide, { x: 98, y: 326, w: 300, h: 24, text: 'Saude atual da integracao', fontSize: 20, bold: true, color: C.ink, insets: { left: 0, right: 0, top: 0, bottom: 0 } });
  statusPill(ctx, slide, 98, 370, 'MQTT local OK', C.green2, C.green);
  statusPill(ctx, slide, 270, 370, 'IC instavel', C.amber2, C.amber);
  statusPill(ctx, slide, 442, 370, 'last_ok=false', C.red2, C.red);
  ctx.addText(slide, { x: 98, y: 426, w: 430, h: 52, text: 'Leitura correta: o sistema distribuido local segue em tempo real; o InterSCity tem historico de sucesso, mas a API remota nao respondeu na verificacao atual.', fontSize: 16, bold: true, color: C.slate, insets: { left: 0, right: 0, top: 0, bottom: 0 } });
  ctx.addShape(slide, { x: 680, y: 300, w: 460, h: 210, fill: C.paper, line: ctx.line(C.line, 1) });
  ctx.addText(slide, { x: 706, y: 326, w: 320, h: 24, text: 'Fila e capacidade', fontSize: 20, bold: true, color: C.ink, insets: { left: 0, right: 0, top: 0, bottom: 0 } });
  ctx.addShape(slide, { x: 706, y: 382, w: 360, h: 22, fill: C.blue2 });
  ctx.addShape(slide, { x: 706, y: 382, w: 18, h: 22, fill: C.amber });
  ctx.addText(slide, { x: 1075, y: 379, w: 70, h: 24, text: '5%', fontSize: 13, bold: true, color: C.amber, insets: { left: 0, right: 0, top: 0, bottom: 0 } });
  ctx.addText(slide, { x: 706, y: 426, w: 370, h: 50, text: 'queue_size=1.000 de queue_max=20.000. Ha margem de fila, mas a taxa atual ao IC e 0/s enquanto a API remota nao responde.', fontSize: 15, color: C.slate, insets: { left: 0, right: 0, top: 0, bottom: 0 } });
  return slide;
}
