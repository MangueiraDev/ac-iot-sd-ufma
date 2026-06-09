import { C, bg, footer, kicker, title, node } from "./common.mjs";

export async function slide06(presentation, ctx) {
  const slide = presentation.slides.add();
  bg(slide, ctx);
  kicker(slide, ctx, "PAINEL E INTERSCITY");
  title(slide, ctx, "O painel virou a superfície principal de operação e validação.");
  node(slide, ctx, "Status no topo", "MQTT e InterSCity visíveis para diagnóstico rápido", 92, 250, 300, 120, C.white, C.blue);
  node(slide, ctx, "Salas", "presença, AC, luz, setpoints e modo da automação", 490, 250, 300, 120, C.white, C.green);
  node(slide, ctx, "Eventos MQTT", "histórico com rolagem interna para acompanhar testes", 888, 250, 300, 120, C.white, C.amber);
  node(slide, ctx, "Controle direto", "atuadores separados dos cenarios de sensores", 92, 430, 300, 120, C.white, C.slate);
  node(slide, ctx, "InterSCity", "Resource Cataloguer, Data Collector, UUID e última leitura", 490, 430, 300, 120, C.white, C.green);
  node(slide, ctx, "Validação", "dados de temperatura, umidade, luz, presença, AC e data", 888, 430, 300, 120, C.white, C.blue);
  footer(slide, ctx, 6);
  return slide;
}
