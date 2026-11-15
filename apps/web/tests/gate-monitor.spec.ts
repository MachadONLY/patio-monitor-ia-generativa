import { expect, test } from "@playwright/test";

const checkedAt = "2026-11-10T04:00:00Z";
const row = (id: number, event: string, date: string) => ({
  id, dispositivo: "SMART_BUS_GATE_01", evento: event, distancia_cm: 13.11975,
  movimento: false, tipo_registro: event, data_hora: date,
});

test("consulta, filtra e atualiza a auditoria, preservando o histórico em caso de falha", async ({ page }) => {
  const first = row(1, "CANCELA_ABERTA", "2026-11-09T23:35:31Z");
  const added = row(2, "CANCELA_FECHADA", "2026-11-10T01:00:00Z");
  const warning = row(3, "POSSIVEL_OBSTRUCAO", "2026-11-10T02:00:00Z");
  let apiCalls = 0;
  await page.route("**/api/rpa/gate-events", async (route) => {
    apiCalls += 1;
    expect(route.request().headers()["x-api-key"]).toBeUndefined();
    const events = apiCalls === 1 ? [first] : [warning, added, first];
    await route.fulfill({ json: {
      status: apiCalls < 3 ? "available" : "stale", checked_at: checkedAt,
      total: events.length, eventos: events,
    } });
  });
  await page.goto("/");
  const trigger = page.getByRole("button", { name: /Monitoramento da Cancela/ });
  await trigger.click();
  const monitor = page.getByRole("dialog", { name: "Monitoramento da Cancela" });
  await expect(monitor.getByText("Último estado registrado: aberta")).toBeVisible();
  await expect(monitor.getByRole("cell", { name: "13,12 cm" })).toBeVisible();
  await monitor.getByRole("button", { name: "Atualizar dados" }).click();
  await expect(monitor.getByText("Último estado registrado: fechada")).toBeVisible();
  await expect(monitor.getByRole("cell", { name: "Possível obstrução" })).toBeVisible();
  await monitor.getByLabel("Data", { exact: true }).fill("2026-11-09");
  await expect(monitor.getByText("3 de 3 registros")).toBeVisible();
  await monitor.getByLabel("Evento", { exact: true }).selectOption("CANCELA_FECHADA");
  await expect(monitor.getByText("1 de 3 registros")).toBeVisible();
  await monitor.getByRole("button", { name: "Atualizar dados" }).click();
  await expect(monitor.getByText(/dados da última consulta bem-sucedida/)).toBeVisible();
  await expect(monitor.getByRole("cell", { name: "Cancela fechada" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(monitor).toHaveCount(0);
  await expect(trigger).toBeFocused();
});

test("link direto funciona no celular e distingue consulta vazia de integração desativada", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 640 });
  await page.route("**/api/rpa/gate-events", async (route) => {
    await route.fulfill({ json: { status: "available", checked_at: checkedAt, total: 0, eventos: [] } });
  }, { times: 1 });
  await page.goto("/?cancela=1");
  const monitor = page.getByRole("dialog", { name: "Monitoramento da Cancela" });
  await expect(monitor.getByText("Estado indisponível")).toBeVisible();
  await expect(monitor.getByText("A consulta ainda não retornou eventos.")).toBeVisible();
  expect(await monitor.evaluate((el) => el.scrollWidth)).toBeLessThanOrEqual(360);
  await monitor.getByRole("button", { name: "Atualizar dados" }).click();
  await expect(monitor.getByText("A integração com o n8n ainda não foi configurada neste servidor.")).toBeVisible();
  await monitor.getByRole("button", { name: "Fechar monitoramento da cancela" }).click();
  await expect(page).toHaveURL(/\/$/);
});
