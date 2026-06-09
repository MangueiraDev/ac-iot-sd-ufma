import { C, bg, footer, kicker, title } from "./common.mjs";

export async function slide05(presentation, ctx) {
  const slide = presentation.slides.add();
  bg(slide, ctx);
  kicker(slide, ctx, "EVIDÊNCIA 1");
  title(slide, ctx, "Painel web mostra o sistema operando em tempo real.");

  await ctx.addImage(slide, {
    path: `${ctx.workspaceDir}/assets/painel-web.png`,
    x: 70, y: 228, w: 735, h: 408, fit: "cover",
    alt: "Captura do painel web AC-IoT com salas, eventos MQTT e InterSCity",
  });

  ctx.addText(slide, {
    text: "O que comprova",
    x: 850, y: 232, w: 310, h: 30, fontSize: 22, color: C.ink, bold: true,
  });
  const items = [
    ["MQTT conectado", "painel recebe eventos em ac-iot/+/sensores via WebSocket 9001."],
    ["Três salas", "sala01, sala02 e sala03 aparecem com temperatura, umidade, luz, presença e estado."],
    ["Controle operacional", "permite aplicar sensores, controle direto e modo de automação."],
    ["InterSCity visível", "área lateral exibe status, UUID e última leitura consultada."],
  ];
  items.forEach(([label, text], i) => {
    const y = 292 + i * 78;
    ctx.addShape(slide, { x: 852, y: y + 7, w: 7, h: 7, fill: C.blue });
    ctx.addText(slide, { text: label, x: 870, y, w: 290, h: 20, fontSize: 16, color: C.ink, bold: true });
    ctx.addText(slide, { text, x: 870, y: y + 24, w: 300, h: 38, fontSize: 13, color: C.muted });
  });
  footer(slide, ctx, 5);
  return slide;
}
