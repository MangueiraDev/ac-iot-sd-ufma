import { C, bg, footer, kicker, title, node, line } from "./common.mjs";

export async function slide10(presentation, ctx) {
  const slide = presentation.slides.add();
  bg(slide, ctx);
  kicker(slide, ctx, "PROXIMOS PASSOS");
  title(slide, ctx, "A prioridade é transformar o protótipo integrado em demonstração validada.");
  node(slide, ctx, "1. Validar integração", "InterSCity, recursos cadastrados e última leitura", 105, 286, 230, 120, C.white, C.green);
  node(slide, ctx, "2. Testar escala", "mais salas, maior frequência e consumo de mensagens", 385, 286, 230, 120, C.white, C.amber);
  node(slide, ctx, "3. Evidenciar regras", "presença, setpoints, ausência e comandos manuais", 665, 286, 230, 120, C.white, C.blue);
  node(slide, ctx, "4. Fechar entrega", "roteiro, prints, logs e documentação final", 945, 286, 230, 120, C.white, C.slate);
  line(slide, ctx, 335, 346, 385, 346, C.slate, 3);
  line(slide, ctx, 615, 346, 665, 346, C.slate, 3);
  line(slide, ctx, 895, 346, 945, 346, C.slate, 3);
  ctx.addText(slide, {
    text: "Mensagem final: o sistema já demonstra o fluxo completo com dados automáticos; o fechamento agora depende de testes, escala e evidências.",
    x: 150, y: 510, w: 980, h: 70, fontSize: 24, color: C.ink, bold: true, align: "center",
  });
  footer(slide, ctx, 10);
  return slide;
}
