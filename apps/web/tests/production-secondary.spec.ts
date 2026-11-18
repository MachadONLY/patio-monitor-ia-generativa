import { expect, test, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";

async function open(page: Page, path = "/") {
  const response = await page.goto(path, { waitUntil: "domcontentloaded", timeout: 40_000 });
  expect(response?.status()).toBe(200);
  await expect(page.getByRole("button", { name: "Iniciar teste guiado" })).toBeVisible();
}
function watch(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  return () => expect(errors).toEqual([]);
}

test("B01 · turno demonstrativo: quatro casos, analise, conclusao e exportacao", async ({ page }) => {
  const checkErrors = watch(page);
  await open(page);
  await page.getByRole("button", { name: "Revisar turno", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Fechamento de turno" })).toBeVisible();
  await page.getByRole("button", { name: "Abrir caso de exemplo" }).click();
  await expect(page.locator(".shift-metrics")).toContainText("Dados divergentes");
  await page.getByRole("button", { name: /Investigar PM-0615/ }).click();
  const evidence = page.getByRole("region", { name: "Evidências da saída selecionada" });
  await expect(evidence).toContainText("7 8042");
  await expect(page.getByRole("region", { name: "Diagnóstico operacional" }))
    .toContainText("Conferir com o controle do terminal");
  await page.getByRole("textbox", { name: "Conclusão da ocorrência" })
    .fill("QA em produção: manter pendente até confirmação.");
  await page.getByRole("button", { name: "Salvar conclusão" }).click();
  await expect(evidence).toContainText("QA em produção");
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Exportar ocorrências" }).click(),
  ]);
  const csv = await readFile((await download.path())!);
  expect(csv.toString()).toContain("PM-0615");
  expect(csv.toString()).toContain("QA em produção");
  await page.getByRole("button", { name: "Fechar revisão" }).click();
  checkErrors();
});

test("B02 · escala e portaria: downloads, importacao, diagnostico, salvar e excluir", async ({ page }) => {
  const checkErrors = watch(page);
  await open(page);
  await page.getByRole("button", { name: "Revisar turno" }).click();
  const [schedule] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Baixar escala preenchida (CSV)" }).click(),
  ]);
  const [gate] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Baixar portaria preenchida (CSV)" }).click(),
  ]);
  const a = await readFile((await schedule.path())!);
  const b = await readFile((await gate.path())!);
  expect(a.toString()).toContain("PM-0615");
  expect(b.toString()).toContain("PORT-019");
  await page.getByLabel("Arquivo de escala").setInputFiles({ name: "exemplo-escala-preenchido.csv",
    mimeType: "text/csv", buffer: a });
  await page.getByLabel("Arquivo de portaria").setInputFiles({ name: "exemplo-portaria-preenchido.csv",
    mimeType: "text/csv", buffer: b });
  await page.getByRole("button", { name: "Revisar arquivos" }).click();
  await expect(page.getByText("ARQUIVOS LOCAIS", { exact: true }).first()).toBeVisible();
  await page.getByRole("button", { name: /Investigar PM-0615/ }).click();
  await expect(page.getByRole("region", { name: "Diagnóstico operacional" })).toContainText("7 8042");
  await page.getByRole("button", { name: "Guardar turno neste navegador" }).click();
  const archive = page.getByRole("region", { name: "Turnos guardados" });
  await expect(archive).toBeVisible();
  await archive.getByRole("button", { name: "Excluir turno" }).click();
  await archive.getByRole("button", { name: "Confirmar exclusão" }).click();
  checkErrors();
});

test("B03 · GPS publico realmente entrega onibus e o 3D permite navegar e investigar", async ({ page, request }) => {
  test.setTimeout(145_000);
  const checkErrors = watch(page);
  await open(page);
  const canvas = page.locator(".viewport");
  await expect(canvas).toHaveAttribute("data-ready", "true", { timeout: 50_000 });
  await expect(canvas.locator("canvas")).toBeVisible();
  await canvas.getByRole("button", { name: "Ver Terminal Alvorada" }).click();
  await expect(canvas).toHaveAttribute("data-camera-mode", "terminal");
  await canvas.getByRole("button", { name: "Aproximar câmera" }).click();
  await canvas.getByRole("button", { name: "Afastar câmera" }).click();
  await canvas.getByRole("button", { name: "Pausar ambientação" }).click();
  await expect(canvas.getByRole("button", { name: "Retomar ambientação" })).toBeVisible();
  await canvas.getByRole("button", { name: "Restaurar vista geral" }).click();
  await expect(canvas).toHaveAttribute("data-camera-mode", "home");
  let reading: any;
  await expect.poll(async () => {
    const r = await request.get("/api/vehicles/snapshot?mode=LIVE", { timeout: 15_000 });
    expect(r.status()).toBe(200);
    reading = await r.json();
    return reading.state === "connected" && reading.vehicles.length > 0;
  }, { timeout: 50_000, intervals: [5000] }).toBe(true);
  expect(reading.source).toBe("rio_mobi_gtfs_rt");
  const prefix = reading.vehicles[0].vehicleId as string;
  const button = page.getByRole("button", { name: "Inspecionar ônibus " + prefix });
  await expect(button).toBeVisible({ timeout: 25_000 });
  await button.click();
  const inspector = page.getByRole("region", { name: "Detalhes do ônibus " + prefix });
  await expect(inspector).toBeVisible();
  await expect(inspector.locator(".inspector-location")).toContainText("Posição GPS");
  await inspector.getByRole("tab", { name: "Histórico" }).click();
  await expect(inspector.getByText("Leituras de posição")).toBeVisible();
  await inspector.getByRole("tab", { name: "Visão geral" }).click();
  await inspector.getByRole("button", { name: "Perfil" }).click();
  await inspector.getByRole("button", { name: "Superior" }).click();
  await inspector.getByRole("button", { name: "Limpar seleção" }).click();
  await page.screenshot({ path: test.info().outputPath("real-gps-and-3d.png") });
  const dims = await page.evaluate(() => ({
    scrollY: document.documentElement.scrollHeight - innerHeight,
    scrollX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  }));
  expect(dims.scrollX).toBeLessThanOrEqual(0);
  expect(dims.scrollY).toBeLessThanOrEqual(0);
  console.log("PRODUCTION_GPS",JSON.stringify({
    source:reading.source,state:reading.state,count:reading.vehicles.length,vehicle:prefix,
  }));
  checkErrors();
});

test("B04 · entradas e saidas mostram o que o GPS realmente calculou", async ({ page, request }) => {
  const checkErrors = watch(page);
  const res = await request.get("/api/vehicles/terminal-crossings", { timeout: 25_000 });
  expect(res.status()).toBe(200);
  const snapshot = await res.json();
  expect(snapshot.status).toMatch(/active|unavailable/);
  await open(page);
  await page.getByRole("button", { name: "Entradas e saídas" }).click();
  await expect(page.getByRole("heading", { name: "Entradas e saídas" })).toBeVisible();
  await expect(page.getByText("Cruzamentos inferidos de posições GPS")).toBeVisible();
  if (snapshot.events.length > 0) {
    await expect(page.getByRole("list", { name: "Últimos cruzamentos" })).toBeVisible();
  } else {
    await expect(page.getByText(/Nenhum cruzamento|A coleta está/)).toBeVisible();
  }
  await page.getByText("Como o horário é estimado").click();
  await expect(page.getByText("faixa de 15 m")).toBeVisible();
  await page.getByRole("button", { name: "Voltar à frota" }).click();
  await expect(page.getByRole("heading", { name: "Ônibus no entorno" })).toBeVisible();
  console.log("PRODUCTION_CROSSINGS", JSON.stringify({
    status:snapshot.status,observations:snapshot.events.length,summary:snapshot.summary,
  }));
  checkErrors();
});

test("B05 · mobile 390px: tour, camera e cancela sem overflow", async ({ page }) => {
  const checkErrors = watch(page);
  await page.setViewportSize({ width:390, height:844 });
  await page.emulateMedia({ reducedMotion:"reduce" });
  await open(page,"/?tour=1");
  await expect(page.getByRole("dialog").getByRole("heading",
    { name:"Confira uma saída de garagem" })).toBeVisible();
  await expect.poll(() => page.evaluate(() =>
    document.documentElement.scrollWidth - document.documentElement.clientWidth
  )).toBeLessThanOrEqual(0);
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name:/Monitoramento da Cancela/ }).click();
  const monitor = page.getByRole("dialog", { name:"Monitoramento da Cancela" });
  await expect(monitor.getByText("Total de eventos")).toBeVisible({ timeout:30_000 });
  expect(await monitor.evaluate(el => el.scrollWidth)).toBeLessThanOrEqual(390);
  await monitor.getByRole("button", { name:"Fechar monitoramento da cancela" }).click();
  await page.getByRole("button", { name:"Câmera do portão", exact:true }).click();
  const camera = page.getByRole("dialog", { name:"Câmera do portão" });
  await expect(camera.getByRole("heading", { name:"Câmera do portão" })).toBeVisible();
  expect(await camera.evaluate(el => el.scrollWidth)).toBeLessThanOrEqual(390);
  await camera.getByRole("button", { name:"Fechar câmera do portão" }).click();
  checkErrors();
});
