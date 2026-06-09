import { C, bg, footer, kicker } from "./common.mjs";

export async function slide01(presentation, ctx) {
  const slide = presentation.slides.add();
  bg(slide, ctx);
  kicker(slide, ctx, "OBJETIVO");
  ctx.addText(slide, {
    text: "AC-IoT UFMA",
    x: 64, y: 128, w: 880, h: 82, fontSize: 58, color: C.ink, bold: true,
    typeface: ctx.fonts.title,
  });
  ctx.addText(slide, {
    text: "Monitoramento e controle inteligente de ar-condicionado em salas de aula com IoT, MQTT, automação e painel web.",
    x: 68, y: 228, w: 980, h: 76, fontSize: 25, color: C.muted,
  });
  ctx.addShape(slide, { x: 68, y: 370, w: 760, h: 1, fill: C.rule });
  ctx.addText(slide, {
    text: "Equipe",
    x: 68, y: 404, w: 200, h: 34, fontSize: 18, color: C.blue, bold: true,
  });
  ctx.addText(slide, {
    text: "Cleila; Guilherme; Nilton; Rniere; Tereza",
    x: 68, y: 452, w: 900, h: 48, fontSize: 30, color: C.ink, bold: true,
    typeface: ctx.fonts.title,
  });
  footer(slide, ctx, 1);
  return slide;
}
