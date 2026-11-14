import { expect, test } from "@playwright/test";

const vision = "/api/gs/vision";
test("teacher can review the example, request a source and inspect a real video event", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.route("**/api/gs/explain", async (route) => {
    const payload = route.request().postDataJSON();
    expect(payload.context).toMatchObject({ evidenceMode: "DEMO", reason: "vehicle_swap" });
    await route.fulfill({ json: {
      answer: "Compare o prefixo da escala com o registro de portaria.",
      citations: [{ id: "p02", title: "Regra de troca de veículo", url: "https://example.org/regra" }],
      actions: [], refused: false, model: "Modelo de teste",
    } });
  });
  await page.goto("/");
  const start = page.getByRole("button", { name: "Iniciar teste guiado" });
  await start.click();
  const tour = page.getByRole("dialog");
  await expect(tour.getByRole("heading", { name: "Encontre a divergência" })).toBeFocused();
  await expect(tour.getByText("8 2361", { exact: false })).toBeVisible();
  await expect(tour.getByText("7 8042", { exact: false })).toBeVisible();
  await expect(tour.locator('[aria-current="step"]')).toContainText("Escala e portaria");
  await tour.getByRole("button", { name: "Ir para a explicação" }).click();
  await tour.getByRole("button", { name: "Explicar ocorrência" }).click();
  await expect(tour.getByRole("link", { name: "Regra de troca de veículo" })).toBeVisible();

  const report = page.waitForResponse((response) => new URL(response.url()).pathname === vision && response.ok());
  await tour.getByRole("button", { name: "Ver gravação" }).click();
  await report;
  const crossing = tour.getByRole("button", { name: /Esquerda.*direita.*00:07,4/ });
  await crossing.click();
  await expect(crossing).toHaveAttribute("aria-pressed", "true");
  await expect.poll(() => tour.locator("video").evaluate((video) => Math.abs((video as HTMLVideoElement).currentTime - 7.44))).toBeLessThan(0.05);
  await tour.getByRole("button", { name: "Concluir teste" }).click();
  await expect(tour).toHaveCount(0);
  await expect(start).toBeFocused();
  expect(errors).toEqual([]);
});

test("direct link opens the guide and fits a narrow mobile viewport", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 640 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/?tour=1");
  const tour = page.getByRole("dialog");
  await expect(tour.getByRole("heading", { name: "Encontre a divergência" })).toBeFocused();
  expect(await tour.evaluate((node) => node.scrollWidth)).toBeLessThanOrEqual(360);
  await tour.getByRole("button", { name: "Ir para a explicação" }).click();
  await expect(tour.getByRole("heading", { name: "Descubra o que verificar" })).toBeFocused();
  await tour.getByRole("button", { name: "Voltar" }).click();
  await expect(tour.getByRole("heading", { name: "Encontre a divergência" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(tour).toHaveCount(0);
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("button", { name: "Iniciar teste guiado" })).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
});
