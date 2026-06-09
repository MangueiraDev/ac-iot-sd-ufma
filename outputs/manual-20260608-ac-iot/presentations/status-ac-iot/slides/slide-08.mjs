import { C, bg, footer, kicker, title, pill } from "./common.mjs";

function bar(slide, ctx, label, y, start, end, color, status) {
  const x0 = 300;
  const scale = 78;
  ctx.addText(slide, { text: label, x: 74, y: y - 4, w: 195, h: 26, fontSize: 14, color: C.ink, bold: true });
  ctx.addShape(slide, { x: x0 + start * scale, y, w: Math.max(14, (end - start) * scale), h: 20, fill: color });
  ctx.addText(slide, { text: status, x: 1000, y: y - 4, w: 170, h: 26, fontSize: 13, color: C.muted });
}

export async function slide08(presentation, ctx) {
  const slide = presentation.slides.add();
  bg(slide, ctx);
  kicker(slide, ctx, "GANTT RESUMO");
  title(slide, ctx, "Base operacional concluída; dados automáticos substituem a etapa física.");
  const months = ["28/05", "01/06", "05/06", "09/06", "13/06", "17/06", "21/06", "25/06"];
  months.forEach((m, i) => {
    const x = 300 + i * 78;
    ctx.addText(slide, { text: m, x: x - 22, y: 226, w: 62, h: 20, fontSize: 11, color: C.muted, align: "center" });
    ctx.addShape(slide, { x, y: 252, w: 1, h: 288, fill: C.rule });
  });
  ctx.addShape(slide, { x: 300, y: 252, w: 625, h: 1, fill: C.rule });
  bar(slide, ctx, "Docker + Mosquitto", 274, 0.0, 0.9, C.green, "concluído");
  bar(slide, ctx, "Simulador C++ MQTT", 314, 0.0, 3.0, C.blue, "concluído em 07/06");
  bar(slide, ctx, "Node-RED automação", 354, 0.0, 3.0, C.blue, "concluído em 07/06");
  bar(slide, ctx, "Painel web", 394, 0.0, 3.0, C.blue, "concluído em 07/06");
  bar(slide, ctx, "Bridge InterSCity", 434, 0.0, 4.0, C.green, "implementado");
  bar(slide, ctx, "Geração automática", 474, 3.0, 5.2, C.green, "escopo definido");
  bar(slide, ctx, "Escalabilidade dos dados", 514, 4.0, 6.2, C.amber, "validar carga");
  bar(slide, ctx, "Testes finais", 554, 6.0, 7.5, C.amber, "previsto");
  pill(slide, ctx, "verde: concluído", 74, 610, 158, C.paleGreen, C.green);
  pill(slide, ctx, "azul: concluído fora do prazo", 250, 610, 240, C.paleBlue, C.blue);
  pill(slide, ctx, "amarelo: validação final", 508, 610, 210, C.paleAmber, C.amber);
  footer(slide, ctx, 8);
  return slide;
}
