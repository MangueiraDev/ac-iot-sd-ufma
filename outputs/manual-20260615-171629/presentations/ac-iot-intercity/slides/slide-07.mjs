import { C, slideBase, node, connector, card } from './theme.mjs';

export async function slide07(presentation, ctx) {
  const slide = slideBase(presentation, ctx, '06 | Logica operacional', 'Automacao por presenca e conforto termico reduz acao manual', 'sala a sala');
  node(ctx, slide, 90, 170, 190, 88, 'Sensor', 'presenca\ntemperatura\numidade/lux', C.blue2, C.blue);
  node(ctx, slide, 350, 120, 210, 82, 'Sala ocupada', 'liga luz\napos segundos avalia AC', C.green2, C.green);
  node(ctx, slide, 350, 296, 210, 82, 'Sala vazia', 'apos segundos\napaga luz e AC', C.red2, C.red);
  node(ctx, slide, 650, 120, 230, 82, 'Temperatura critica', '>= 30% acima do setpoint\ncom presenca', C.amber2, C.amber);
  node(ctx, slide, 650, 296, 230, 82, 'Comando operador', 'corrige setpoint\npara escopo escolhido', C.purple2, C.purple);
  connector(ctx, slide, 280, 214, 350, 161, C.green);
  connector(ctx, slide, 280, 214, 350, 337, C.red);
  connector(ctx, slide, 560, 161, 650, 161, C.amber);
  connector(ctx, slide, 560, 337, 650, 337, C.purple);
  card(ctx, slide, 950, 128, 250, 120, 'Criterio critico', 'Somente conta quando ha pessoas presentes e o AC esta desligado ou com setpoint alto.', C.amber);
  card(ctx, slide, 950, 296, 250, 120, 'Atualizacao dinamica', 'A lista de salas criticas muda conforme novas medicoes dos sensores chegam pelo MQTT.', C.blue);
  ctx.addText(slide, { x: 120, y: 520, w: 980, h: 38, text: 'O objetivo e operar automaticamente o normal e deixar para o operador apenas as excecoes relevantes.', fontSize: 22, bold: true, color: C.ink, align: 'center', insets: { left: 0, right: 0, top: 0, bottom: 0 } });
  return slide;
}
