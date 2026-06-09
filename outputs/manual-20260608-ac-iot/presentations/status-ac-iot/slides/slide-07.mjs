import { C, bg, footer, kicker, title } from "./common.mjs";

export async function slide07(presentation, ctx) {
  const slide = presentation.slides.add();
  bg(slide, ctx);
  kicker(slide, ctx, "EVIDÊNCIA 3");
  title(slide, ctx, "InterSCity UFMA recebe a telemetria enviada pela bridge.");

  ctx.addShape(slide, { x: 70, y: 230, w: 410, h: 350, fill: C.white, line: ctx.line(C.rule, 1) });
  ctx.addText(slide, { text: "Comprovação operacional", x: 94, y: 254, w: 340, h: 26, fontSize: 22, color: C.ink, bold: true });
  const checks = [
    ["Resource Cataloguer", "salas cadastradas com UUID fixo e capabilities."],
    ["Resource Adaptor", "bridge publica /resources/{uuid}/data."],
    ["Data Collector", "última leitura pode ser consultada por UUID."],
    ["Painel web", "consulta /catalog/resources e /collector/resources/{uuid}/data/last."],
  ];
  checks.forEach(([label, text], i) => {
    const y = 310 + i * 62;
    ctx.addShape(slide, { x: 96, y: y + 7, w: 7, h: 7, fill: C.green });
    ctx.addText(slide, { text: label, x: 114, y, w: 300, h: 20, fontSize: 15, color: C.ink, bold: true });
    ctx.addText(slide, { text, x: 114, y: y + 23, w: 310, h: 30, fontSize: 12.5, color: C.muted });
  });

  ctx.addShape(slide, { x: 520, y: 226, w: 670, h: 390, fill: "#101828", line: ctx.line("#101828", 0) });
  ctx.addText(slide, { text: "Trechos essenciais da bridge InterSCity", x: 546, y: 248, w: 560, h: 24, fontSize: 15, color: "#D1E9FF", bold: true });
  ctx.addText(slide, {
    text:
`// interscity/main.cpp
mqtt_topic = get_env("MQTT_TOPIC", "ac-iot/+/sensores");
mosquitto_subscribe(mosq, nullptr, mqtt_topic.c_str(), 0);

static bool post_room_telemetry(const RoomConfig& room,
                                const json& payload) {
  json intercity_payload = {{"data", json::object()}};
  for (const auto& field : field_names) {
    if (payload.contains(field)) {
      add_capability_value(intercity_payload,
          field, payload[field], date);
    }
  }
  auto path = "/resources/" + room.uuid + "/data";
  auto response = send_http(adaptor_url, HttpMethod::Post,
      path, &intercity_payload);
  return is_success(response.status);
}`,
    x: 546, y: 286, w: 610, h: 302, fontSize: 12.5, color: "#F9FAFB", typeface: ctx.fonts.mono,
  });
  footer(slide, ctx, 7);
  return slide;
}
