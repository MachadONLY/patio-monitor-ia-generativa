import { expect, test, type Page } from "@playwright/test";

async function open(page: Page, path = "/") {
  const r = await page.goto(path, { waitUntil: "domcontentloaded", timeout: 35_000 });
  expect(r?.status()).toBe(200);
  await expect(page.getByRole("button", { name: "Iniciar teste guiado" })).toBeVisible();
}
function errors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", err => errors.push(err.message));
  return () => expect(errors).toEqual([]);
}
async function playable(video: ReturnType<Page["locator"]>) {
  await expect.poll(() => video.evaluate((el: HTMLVideoElement) =>
    el.error === null && el.readyState >= 1 && el.duration > 7.44 && el.videoWidth > 0
  ), { timeout: 35_000 }).toBe(true);
}
async function seek(video: ReturnType<Page["locator"]>) {
  await expect.poll(() => video.evaluate((el: HTMLVideoElement) =>
    Math.abs(el.currentTime - 7.44)
  )).toBeLessThan(0.1);
}

test("A01 · todas as APIs publicas retornam contratos reais e o n8n devolve eventos", async ({ request }) => {
  const expected = ["/", "/health", "/api/gs/vision", "/api/vehicles/snapshot?mode=LIVE",
    "/api/vehicles/terminal-crossings", "/api/rpa/gate-events"];
  const data: Record<string, any> = {};
  for (const path of expected) {
    const res = await request.get(path, { timeout: 30_000 });
    expect(res.status(), path).toBe(200);
    expect(res.headers()["x-content-type-options"], path).toBe("nosniff");
    data[path] = path === "/" ? await res.text() : await res.json();
  }
  expect(data["/"]).toContain("Pátio Monitor");
  expect(data["/health"].status).toBe("ok");
  const vision = data["/api/gs/vision"];
  expect(vision.data_origin).toBe("PUBLIC_VIDEO");
  expect(vision.events.length).toBeGreaterThan(0);
  expect(vision.events[0].timestamp_seconds).toBeCloseTo(7.44, 1);
  const video = await request.get(vision.video.url, { timeout: 30_000 });
  expect(video.status()).toBe(200);
  const bytes = await video.body();
  expect(bytes.length).toBeGreaterThan(100_000);
  expect(bytes.subarray(4, 8).toString("ascii")).toBe("ftyp");
  const snapshot = data["/api/vehicles/snapshot?mode=LIVE"];
  expect(snapshot.mode).toBe("LIVE");
  expect(snapshot.source).toBe("rio_mobi_gtfs_rt");
  expect(Array.isArray(snapshot.vehicles)).toBe(true);
  const crossings = data["/api/vehicles/terminal-crossings"];
  expect(crossings.status).toMatch(/active|unavailable/);
  expect(Array.isArray(crossings.events)).toBe(true);
  const n8n = data["/api/rpa/gate-events"];
  expect(n8n.status).toBe("available");
  expect(n8n.total).toBeGreaterThan(0);
  expect(n8n.eventos.length).toBe(n8n.total);
  expect(new Set(n8n.eventos.map((x: any) => x.id)).size).toBe(n8n.total);
  console.log("LIVE_CONTRACTS", JSON.stringify({
    gpsState: snapshot.state, gpsCount: snapshot.vehicles.length,
    crossingState: crossings.status, crossingCount: crossings.events.length,
    rpaCount: n8n.total, newestIds: n8n.eventos.slice(0, 3).map((x: any) => x.id),
  }));
});

test("A02 · fluxo completo do professor com Qwen e Vision reais no browser", async ({ page }) => {
  test.setTimeout(160_000);
  const checkErrors = errors(page);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await open(page);
  await expect(page.locator(".viewport")).toHaveAttribute("data-ready", "true", { timeout: 50_000 });
  await page.getByRole("button", { name: "Iniciar teste guiado" }).click();
  const guide = page.getByRole("dialog");
  await expect(guide.getByRole("heading", { name: "Confira uma saída de garagem" })).toBeVisible();
  await guide.getByRole("button", { name: "Abrir caso de exemplo" }).click();
  const example = page.getByRole("region", { name: "Conferência do caso de exemplo" });
  await expect(example).toContainText("8 2361");
  await expect(example).toContainText("7 8042");
  await guide.getByRole("button", { name: "Ir para a explicação" }).click();
  await expect(example.getByRole("region", { name: "Diagnóstico operacional" }))
    .toContainText("Divergência de identificação comprovada");
  const call = page.waitForResponse(r => new URL(r.url()).pathname === "/api/gs/explain"
    && r.request().method() === "POST", { timeout: 65_000 });
  await example.getByRole("button", { name: "Explicar ocorrência" }).click();
  const response = await call;
  expect(response.status()).toBe(200);
  const output = await response.json();
  expect(output.refused).toBe(false);
  expect(output.answer.length).toBeGreaterThan(20);
  expect(output.citations.some((c: any) => c.id === "p02")).toBe(true);
  await expect(example.getByText("Fontes consultadas")).toBeVisible();
  await page.screenshot({ path: test.info().outputPath("real-qwen-tour.png") });
  await guide.getByRole("button", { name: "Ver gravação" }).click();
  const visual = page.getByRole("region", { name: "Evidência em vídeo" });
  const video = visual.locator("video");
  await playable(video);
  const event = visual.getByRole("button", { name: /Esquerda.*direita.*00:07,4/ });
  await event.click();
  await expect(event).toHaveAttribute("aria-pressed", "true");
  await seek(video);
  await page.screenshot({ path: test.info().outputPath("real-vision-tour.png") });
  await guide.getByRole("button", { name: "Concluir teste" }).click();
  await expect(guide).toHaveCount(0);
  checkErrors();
});

test("A03 · camera independente carrega a midia, vai ao cruzamento e fecha", async ({ page }) => {
  const checkErrors = errors(page);
  await open(page);
  await page.getByRole("button", { name: "Câmera do portão", exact: true }).click();
  const modal = page.getByRole("dialog", { name: "Câmera do portão" });
  await expect(modal.getByText("Cruzamentos detectados")).toBeVisible();
  const video = modal.locator("video");
  await playable(video);
  await modal.getByRole("button", { name: /Esquerda.*direita.*00:07,4/ }).click();
  await seek(video);
  await expect(modal.getByRole("link", { name: /Gravação original/ })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(modal).toHaveCount(0);
  checkErrors();
});

test("A04 · n8n real: eventos, indicadores, gráficos, filtros, update e fechamento", async ({ page, request }) => {
  const checkErrors = errors(page);
  const sourceResponse = await request.get("/api/rpa/gate-events", { timeout: 25_000 });
  expect(sourceResponse.status()).toBe(200);
  const source = await sourceResponse.json();
  expect(source.status).toBe("available");
  expect(source.total).toBeGreaterThan(0);
  await open(page, "/?cancela=1");
  const dialog = page.getByRole("dialog", { name: "Monitoramento da Cancela" });
  await expect(dialog.getByText("Total de eventos")).toBeVisible({ timeout: 30_000 });
  await expect(dialog.locator(".gate-monitor-metrics dd").first())
    .toContainText(new Intl.NumberFormat("pt-BR").format(source.total));
  await expect(dialog.getByText("Aberturas e fechamentos por dia")).toBeVisible();
  await expect(dialog.getByText("Distribuição dos eventos")).toBeVisible();
  await expect(dialog.getByRole("region", { name: "Tabela de registros da cancela" })
    .locator("tbody tr").first()).toBeVisible();
  await expect(dialog.getByText("#" + source.eventos[0].id, { exact: true })).toBeVisible();
  await page.screenshot({ path: test.info().outputPath("real-n8n.png") });
  await dialog.getByLabel("Evento", { exact: true }).selectOption(source.eventos[0].evento);
  await expect(dialog.getByText(/de \d+ registros/)).toBeVisible();
  await dialog.getByRole("button", { name: "Limpar" }).click();
  const refresh = page.waitForResponse(r => new URL(r.url()).pathname === "/api/rpa/gate-events"
    && r.request().method() === "GET", { timeout: 25_000 });
  await dialog.getByRole("button", { name: "Atualizar dados" }).click();
  const res = await refresh;
  expect(res.status()).toBe(200);
  expect((await res.json()).status).toBe("available");
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  checkErrors();
});

test("A05 · a falha externa e sinalizada sem quebrar a tela (falha induzida)", async ({ page }) => {
  await page.route("**/api/rpa/gate-events", route => route.fulfill({
    status: 503, contentType: "application/json",
    body: JSON.stringify({ status: "unavailable", checked_at: null, total: 0, eventos: [] }),
  }));
  await open(page, "/?cancela=1");
  const dialog = page.getByRole("dialog", { name: "Monitoramento da Cancela" });
  await expect(dialog.getByText("Não foi possível consultar o histórico da cancela.")).toBeVisible();
  await dialog.getByRole("button", { name: "Fechar monitoramento da cancela" }).click();
  await expect(page.getByRole("button", { name: "Iniciar teste guiado" })).toBeVisible();
});
