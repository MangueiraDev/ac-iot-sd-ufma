import { C, bg, footer, kicker, title, node, line } from "./common.mjs";

export async function slide02(presentation, ctx) {
  const slide = presentation.slides.add();
  bg(slide, ctx);
  kicker(slide, ctx, "ARQUITETURA");
  title(slide, ctx, "O fluxo atual conecta simulação, automação, painel e InterSCity.");
  node(slide, ctx, "Simulador C++", "gera sensores e recebe comandos para sala01, sala02 e sala03", 64, 275, 190, 120, C.white, C.blue);
  node(slide, ctx, "Mosquitto", "broker MQTT TCP 1883 e WebSocket 9001", 312, 275, 180, 120, C.white, C.green);
  node(slide, ctx, "Node-RED", "regras de presença, setpoints e temporizadores", 552, 210, 190, 120, C.white, C.amber);
  node(slide, ctx, "Painel Web", "monitoramento, controle direto e eventos MQTT", 552, 395, 190, 120, C.white, C.blue);
  node(slide, ctx, "Bridge", "encaminha telemetria MQTT para REST", 802, 275, 170, 120, C.white, C.slate);
  node(slide, ctx, "InterSCity UFMA", "catálogo de recursos e última leitura por UUID", 1032, 275, 184, 120, C.white, C.green);
  line(slide, ctx, 254, 335, 312, 335, C.slate, 3);
  line(slide, ctx, 492, 335, 520, 335, C.slate, 3);
  line(slide, ctx, 520, 270, 520, 455, C.slate, 3);
  line(slide, ctx, 520, 270, 552, 270, C.slate, 3);
  line(slide, ctx, 520, 455, 552, 455, C.slate, 3);
  line(slide, ctx, 742, 270, 772, 270, C.slate, 3);
  line(slide, ctx, 772, 270, 772, 335, C.slate, 3);
  line(slide, ctx, 772, 335, 802, 335, C.slate, 3);
  line(slide, ctx, 972, 335, 1032, 335, C.slate, 3);
  ctx.addText(slide, { text: "Tópicos principais: ac-iot/+/sensores | ac-iot/{sala}/comando | ac-iot/all/comando", x: 96, y: 585, w: 1040, h: 30, fontSize: 16, color: C.muted, typeface: ctx.fonts.mono, align: "center" });
  footer(slide, ctx, 2);
  return slide;
}
