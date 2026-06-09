import { C, bg, footer, kicker, metric } from "./common.mjs";

export async function slide02(presentation, ctx) {
  const slide = presentation.slides.add();
  bg(slide, ctx);
  kicker(slide, ctx, "STATUS ATUAL");
  ctx.addText(slide, {
    text: "AC-IoT UFMA: protótipo integrado em funcionamento",
    x: 64, y: 116, w: 920, h: 130, fontSize: 50, color: C.ink, bold: true, typeface: ctx.fonts.title,
  });
  ctx.addText(slide, {
    text: "Resumo objetivo das atualizações realizadas, do funcionamento atual e dos próximos ajustes para fechamento do sistema.",
    x: 66, y: 260, w: 860, h: 58, fontSize: 22, color: C.muted,
  });
  metric(slide, ctx, "3", "salas simuladas publicando dados", 66, 390, 250, C.blue);
  metric(slide, ctx, "MQTT", "sensores e comandos operacionais", 346, 390, 250, C.green);
  metric(slide, ctx, "Node-RED", "regras de automação ativas", 626, 390, 250, C.amber);
  metric(slide, ctx, "InterSCity", "bridge e consulta implementadas", 906, 390, 250, C.slate);
  footer(slide, ctx, 2);
  return slide;
}
