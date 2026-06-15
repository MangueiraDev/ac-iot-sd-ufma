import { C, slideBase, node, connector, statusPill } from './theme.mjs';

export async function slide03(presentation, ctx) {
  const slide = slideBase(presentation, ctx, '02 | Arquitetura', 'Fluxo distribuido: sensores, broker, cockpit, bridge e InterSCity', '1.000 salas');
  node(ctx, slide, 70, 150, 185, 102, 'Simulador C++', '1.000 salas\npublicacao a cada 30 s', C.blue2, C.blue);
  node(ctx, slide, 315, 150, 185, 102, 'Mosquitto', 'broker MQTT\nTCP 1883 / WS 9001', C.teal2, C.teal);
  node(ctx, slide, 560, 150, 185, 102, 'Painel Web', 'Nginx + WebSocket\noperacao ao vivo', C.green2, C.green);
  node(ctx, slide, 315, 358, 185, 108, 'Bridge C++', '8 workers HTTP\nfila 20.000 itens', C.purple2, C.purple);
  node(ctx, slide, 560, 358, 185, 108, 'InterSCity UFMA', 'catalog\nadaptor\ncollector', C.amber2, C.amber);
  node(ctx, slide, 865, 230, 250, 110, 'Operador', 'consulta sala\naplica comandos\nanalisa metricas', C.paper, C.slate);
  connector(ctx, slide, 255, 201, 315, 201, C.blue);
  connector(ctx, slide, 500, 201, 560, 201, C.teal);
  connector(ctx, slide, 408, 252, 408, 358, C.purple);
  connector(ctx, slide, 500, 412, 560, 412, C.purple);
  connector(ctx, slide, 865, 285, 745, 205, C.green);
  connector(ctx, slide, 865, 304, 745, 412, C.amber);
  statusPill(ctx, slide, 84, 276, 'ac-iot/+/sensores', C.blue2, C.blue);
  statusPill(ctx, slide, 324, 276, 'MQTT WebSocket', C.teal2, C.teal);
  statusPill(ctx, slide, 326, 490, '$share bridge', C.purple2, C.purple);
  statusPill(ctx, slide, 572, 490, 'HTTPS REST', C.amber2, C.amber);
  ctx.addText(slide, { x: 76, y: 570, w: 1090, h: 42, text: 'A separacao em processos independentes permite evoluir simulacao, broker, bridge, painel e automacao sem acoplamento direto.', fontSize: 19, bold: true, color: C.ink, align: 'center', insets: { left: 0, right: 0, top: 0, bottom: 0 } });
  return slide;
}
