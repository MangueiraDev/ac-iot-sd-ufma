import { C, bg, footer, kicker, title } from "./common.mjs";

function evidenceItem(slide, ctx, label, text, x, y) {
  ctx.addShape(slide, { x, y: y + 8, w: 7, h: 7, fill: C.blue });
  ctx.addText(slide, { text: label, x: x + 18, y, w: 390, h: 22, fontSize: 16, color: C.ink, bold: true });
  ctx.addText(slide, { text, x: x + 18, y: y + 26, w: 430, h: 42, fontSize: 13, color: C.muted });
}

export async function slide10(presentation, ctx) {
  const slide = presentation.slides.add();
  bg(slide, ctx);
  kicker(slide, ctx, "EVIDÊNCIAS");
  title(slide, ctx, "Capturas e código comprovam que o sistema existe e está funcionando.");

  ctx.addText(slide, {
    text: "Capturas recomendadas",
    x: 78, y: 226, w: 440, h: 30, fontSize: 22, color: C.ink, bold: true,
  });
  evidenceItem(slide, ctx, "Painel web operacional", "status MQTT, salas, presença, AC, luz, automação e eventos recebidos.", 82, 286);
  evidenceItem(slide, ctx, "Node-RED", "fluxos ativos e debug mostrando regras de presença/setpoint sendo executadas.", 82, 374);
  evidenceItem(slide, ctx, "Logs Docker/MQTT", "simulador publicando ac-iot/+/sensores e bridge enviando telemetria.", 82, 462);
  evidenceItem(slide, ctx, "InterSCity UFMA", "Resource Cataloguer com salas e Data Collector com última leitura por UUID.", 82, 550);

  ctx.addShape(slide, { x: 602, y: 226, w: 590, h: 354, fill: "#101828", line: ctx.line("#101828", 0) });
  ctx.addText(slide, {
    text: "Trecho-chave da integração InterSCity",
    x: 626, y: 246, w: 520, h: 24, fontSize: 15, color: "#D1E9FF", bold: true,
  });
  ctx.addText(slide, {
    text:
`// interscity/main.cpp
mosquitto_subscribe(mosq, nullptr,
    "ac-iot/+/sensores", 0);

static void on_message(..., message) {
  json payload = json::parse(body);
  room_id = payload["id_sala"];
  post_room_telemetry(room, payload);
}

// POST /resources/{uuid}/data
add_capability_value(data, "temperatura", ...);
send_http(adaptor_url, HttpMethod::Post,
    "/resources/" + uuid + "/data", &data);`,
    x: 626, y: 284, w: 528, h: 260, fontSize: 14, color: "#F9FAFB", typeface: ctx.fonts.mono,
  });

  ctx.addShape(slide, { x: 602, y: 602, w: 590, h: 38, fill: C.paleGreen, line: ctx.line(C.paleGreen, 0) });
  ctx.addText(slide, {
    text: "Mensagem para a apresentação: mostrar 2 ou 3 prints e este trecho de código basta para evidenciar operação fim a fim.",
    x: 622, y: 612, w: 548, h: 20, fontSize: 13, color: C.green, bold: true, align: "center",
  });

  footer(slide, ctx, 10);
  return slide;
}
