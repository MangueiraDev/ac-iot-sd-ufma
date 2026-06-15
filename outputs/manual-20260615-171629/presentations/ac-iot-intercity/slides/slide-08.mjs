import { C, slideBase, card, node, connector } from './theme.mjs';

export async function slide08(presentation, ctx) {
  const slide = slideBase(presentation, ctx, '07 | Sistemas distribuidos', 'A solucao ja separa responsabilidades e permite escalar por componentes', 'Docker e Kubernetes');
  card(ctx, slide, 62, 116, 330, 128, 'Servicos independentes', 'simulator, mosquitto, bridge, web e Node-RED sobem separadamente e se comunicam por rede.', C.blue);
  card(ctx, slide, 474, 116, 330, 128, 'Acoplamento por mensageria', 'MQTT desacopla produtores, consumidores, dashboard e bridge InterSCity.', C.teal);
  card(ctx, slide, 886, 116, 330, 128, 'Escala controlada', 'Bridge usa fila, workers e rate limit; Kubernetes inclui HPA para o bridge.', C.purple);
  node(ctx, slide, 124, 344, 170, 72, 'Pod simulador', 'shard 0', C.blue2, C.blue);
  node(ctx, slide, 124, 454, 170, 72, 'Pod simulador', 'shard N', C.blue2, C.blue);
  node(ctx, slide, 394, 398, 170, 72, 'EMQX/MQTT', 'broker', C.teal2, C.teal);
  node(ctx, slide, 664, 344, 170, 72, 'Bridge replica', 'workers HTTP', C.purple2, C.purple);
  node(ctx, slide, 664, 454, 170, 72, 'Bridge replica', 'workers HTTP', C.purple2, C.purple);
  node(ctx, slide, 934, 398, 170, 72, 'InterSCity', 'API remota', C.amber2, C.amber);
  connector(ctx, slide, 294, 380, 394, 434, C.blue);
  connector(ctx, slide, 294, 490, 394, 434, C.blue);
  connector(ctx, slide, 564, 434, 664, 380, C.purple);
  connector(ctx, slide, 564, 434, 664, 490, C.purple);
  connector(ctx, slide, 834, 380, 934, 434, C.amber);
  connector(ctx, slide, 834, 490, 934, 434, C.amber);
  return slide;
}
