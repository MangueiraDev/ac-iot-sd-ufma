import { C, bg, footer, kicker, title, node } from "./common.mjs";

export async function slide09(presentation, ctx) {
  const slide = presentation.slides.add();
  bg(slide, ctx);
  kicker(slide, ctx, "GERAÇÃO DE DADOS");
  title(slide, ctx, "Os dados são gerados automaticamente para manter o sistema ativo e escalável.");
  node(slide, ctx, "Origem dos dados", "o simulador C++ publica leituras periódicas de três salas em ac-iot/+/sensores", 82, 250, 330, 128, C.white, C.blue);
  node(slide, ctx, "Sem etapa física", "ESP32, Wokwi, SCT-013, IR e relé deixam de ser implementados neste escopo", 475, 250, 330, 128, C.paleAmber, C.amber);
  node(slide, ctx, "Fluxo preservado", "MQTT, Node-RED, painel web e InterSCity continuam recebendo o mesmo padrão de telemetria", 868, 250, 330, 128, C.white, C.green);
  node(slide, ctx, "Escala horizontal", "novas salas podem ser adicionadas mantendo o padrão ac-iot/{sala}/sensores", 82, 438, 330, 128, C.white, C.slate);
  node(slide, ctx, "Baixo acoplamento", "publicação assíncrona por MQTT evita travar painel, regras e bridge", 475, 438, 330, 128, C.white, C.green);
  node(slide, ctx, "Validação restante", "medir estabilidade com mais salas, maior frequência e roteiro de testes", 868, 438, 330, 128, C.paleAmber, C.amber);
  footer(slide, ctx, 9);
  return slide;
}
