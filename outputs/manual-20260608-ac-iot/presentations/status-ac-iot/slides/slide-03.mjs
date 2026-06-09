import { C, bg, footer, kicker, title, bullet, pill } from "./common.mjs";

export async function slide03(presentation, ctx) {
  const slide = presentation.slides.add();
  bg(slide, ctx);
  kicker(slide, ctx, "ATUALIZACOES");
  title(slide, ctx, "As atualizações consolidam a base funcional do protótipo.");
  pill(slide, ctx, "Concluído para protótipo", 82, 234, 250, C.paleGreen, C.green);
  bullet(slide, ctx, "Docker Compose integrando Mosquitto, Node-RED, simulador e bridge.", 88, 296, 470);
  bullet(slide, ctx, "Simulador C++ com tres salas e estados independentes.", 88, 358, 470);
  bullet(slide, ctx, "MQTT separado entre sensores, comandos por sala e comando global.", 88, 420, 470);
  bullet(slide, ctx, "Painel web reorganizado para operação e testes.", 88, 482, 470);
  pill(slide, ctx, "Concluído para protótipo", 708, 234, 250, C.paleGreen, C.green);
  bullet(slide, ctx, "Node-RED com temporizadores estáveis para presença e ausência.", 714, 296, 430);
  bullet(slide, ctx, "Bridge InterSCity implementada para envio de telemetria.", 714, 358, 430);
  bullet(slide, ctx, "Painel consulta catálogo, UUID e última leitura InterSCity.", 714, 420, 430);
  bullet(slide, ctx, "Geração automática de dados mantém o fluxo ativo sem hardware físico.", 714, 482, 430);
  footer(slide, ctx, 3);
  return slide;
}
