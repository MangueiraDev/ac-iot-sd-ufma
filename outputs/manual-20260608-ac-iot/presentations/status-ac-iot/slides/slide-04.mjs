import { C, bg, footer, kicker, title, node, line } from "./common.mjs";

export async function slide04(presentation, ctx) {
  const slide = presentation.slides.add();
  bg(slide, ctx);
  kicker(slide, ctx, "FUNCIONAMENTO");
  title(slide, ctx, "A automação já aplica regras de conforto e economia.");
  node(slide, ctx, "1. Presença", "presença detectada liga a luz", 90, 285, 220, 110, C.white, C.green);
  node(slide, ctx, "2. Espera 20s", "presença contínua libera avaliação do AC", 365, 285, 220, 110, C.white, C.amber);
  node(slide, ctx, "3. Setpoints", "temperatura/umidade acima do limite acionam AC", 640, 285, 220, 110, C.white, C.blue);
  node(slide, ctx, "4. Ausência 10s", "desliga AC e luz automaticamente", 915, 285, 220, 110, C.white, C.red);
  line(slide, ctx, 310, 340, 365, 340, C.slate, 3);
  line(slide, ctx, 585, 340, 640, 340, C.slate, 3);
  line(slide, ctx, 860, 340, 915, 340, C.slate, 3);
  ctx.addShape(slide, { x: 112, y: 490, w: 1012, h: 72, fill: C.white, line: ctx.line(C.rule, 1) });
  ctx.addText(slide, { text: "Modo manual preserva os comandos do usuário quando modo_ac = desativado.", x: 142, y: 512, w: 940, h: 32, fontSize: 22, color: C.ink, bold: true, align: "center" });
  footer(slide, ctx, 4);
  return slide;
}
