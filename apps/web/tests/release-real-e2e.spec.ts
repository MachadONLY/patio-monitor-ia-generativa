import { expect, test } from "@playwright/test";

test.skip(process.env.PATIO_E2E_REAL !== "1", "Requires real Qwen weights and public Rio GPS provider");

test("professor completes live single-page tour with real Qwen, GPS and annotated video", async ({ page }) => {
  test.setTimeout(140_000);
  const exceptions: string[] = [];
  page.on("pageerror", (error) => exceptions.push(error.message));
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Iniciar teste guiado" })).toBeVisible();

  await expect.poll(async () => page.evaluate(async () => {
    const res = await fetch("/api/vehicles/snapshot?mode=LIVE", { cache: "no-store" });
    if (!res.ok) return "http_error";
    const snapshot = await res.json();
    return snapshot.source;
  }), { timeout: 35_000 }).toBe("rio_mobi_gtfs_rt");

  const starter = page.getByRole("button", { name: "Iniciar teste guiado" });
  await starter.click();
  const tour = page.getByRole("dialog");
  await tour.getByRole("button", { name: "Abrir caso de exemplo" }).click();
  const example = page.getByRole("region", { name: "Conferência do caso de exemplo" });
  await expect(example).toContainText("8 2361");
  await expect(example).toContainText("7 8042");
  await tour.getByRole("button", { name: "Ir para a explicação" }).click();
  const diagnosis = example.getByRole("region", { name: "Diagnóstico operacional" });
  await expect(diagnosis).toContainText("Divergência de identificação comprovada");
  await expect(diagnosis).toContainText("Conferir com o controle do terminal");

  const actualLLM = page.waitForResponse((response) =>
    new URL(response.url()).pathname === "/api/gs/explain" && response.request().method() === "POST", { timeout: 45_000 });
  await example.getByRole("button", { name: "Explicar ocorrência" }).click();
  const response = await actualLLM;
  expect(response.status()).toBe(200);
  const result = await response.json();
  expect(result.refused).toBe(false);
  expect(result.citations.some((item: { id: string }) => item.id === "p02")).toBe(true);
  await expect(example.getByRole("link", { name: /Pátio Monitor.*Troca de veículo/ })).toBeVisible();
  await page.screenshot({ path: test.info().outputPath("release-real-qwen-in-3d.png") });

  const realVision = page.waitForResponse((response) =>
    new URL(response.url()).pathname === "/api/gs/vision" && response.ok(), { timeout: 30_000 });
  await tour.getByRole("button", { name: "Ver gravação" }).click();
  await realVision;
  const region = page.getByRole("region", { name: "Evidência em vídeo" });
  const video = region.locator("video");
  await expect.poll(() => video.evaluate((v: HTMLVideoElement) =>
    !v.error && v.readyState >= v.HAVE_METADATA && v.duration > 7.44 && v.videoWidth >= 700
  ), { timeout: 30_000 }).toBe(true);
  await region.getByRole("button", { name: /Esquerda.*direita.*00:07,4/ }).click();
  await expect.poll(() => video.evaluate((v: HTMLVideoElement) =>
    Math.abs(v.currentTime - 7.44)
  )).toBeLessThan(0.05);
  await page.screenshot({ path: test.info().outputPath("release-real-vision-tour.png") });
  await tour.getByRole("button", { name: "Concluir teste" }).click();
  await expect(tour).toHaveCount(0);
  expect(exceptions).toEqual([]);
});
