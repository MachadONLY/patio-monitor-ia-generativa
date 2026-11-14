import { expect, test, type Locator, type Page } from "@playwright/test";
import { DEMO_WARMUP_SECONDS, simulationMovementsAt } from "../src/simulation";

const qa = "../../docs/qa";
const diary = (page: Page) => page.getByRole("region", { name: "Movimentos do pátio" });

async function openDemo(page: Page, reducedMotion: "reduce" | "no-preference" = "reduce") {
  await page.emulateMedia({ reducedMotion });
  await page.goto("/");
  await expect(page.locator(".viewport")).toHaveAttribute("data-ready", "true", { timeout: 25_000 });
  await expect(page.getByRole("button", { name: "DEMO", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(diary(page)).toBeVisible();
}

async function controlClock(page: Page) {
  await page.addInitScript(() => {
    let elapsed = 0;
    Object.defineProperty(performance, "now", { value: () => elapsed });
    Object.defineProperty(window, "advanceTerminal", { value: (seconds: number) => { elapsed = seconds * 1000; } });
  });
}

function advance(page: Page, seconds: number) {
  return page.evaluate((offset) => {
    Reflect.get(window, "advanceTerminal")(offset);
  }, seconds - DEMO_WARMUP_SECONDS);
}

async function tagOffset(tag: Locator) {
  return tag.evaluate((label) => {
    const bounds = label.getBoundingClientRect();
    const viewport = label.closest(".viewport")!.getBoundingClientRect();
    return {
      x: bounds.x + bounds.width / 2 - viewport.x - viewport.width / 2,
      y: bounds.y + bounds.height / 2 - viewport.y,
    };
  });
}

test("terminal starts moving without a player and continues after a day", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const model = page.waitForResponse((response) => response.ok() && response.url().endsWith("/sp-standard-bus.glb"));
  await controlClock(page);
  await openDemo(page);
  await model;
  await expect(page.getByRole("slider")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Pausar|Reiniciar|Reproduzir/ })).toHaveCount(0);
  await expect(diary(page).getByText("OPERAÇÃO CONTÍNUA")).toBeVisible();
  const tag = page.locator('.bus-tag[data-vehicle-id="8 2361"]');
  const first = await tagOffset(tag);
  await advance(page, 107);
  await expect.poll(async () => Math.abs((await tagOffset(tag)).y - first.y)).toBeGreaterThan(4);
  await expect(diary(page).getByText("Saídas 4", { exact: true })).toBeVisible();
  await advance(page, 116);
  await expect(diary(page).getByText("Entradas 1", { exact: true })).toBeVisible();
  await page.screenshot({ path: qa + "/terminal-continuo.png" });

  const end = 86_500;
  const counts = simulationMovementsAt(end);
  await advance(page, end);
  await expect(diary(page).getByText(`Entradas ${counts.arrivals}`, { exact: true })).toBeVisible();
  await expect(diary(page).getByText(`Saídas ${counts.departures}`, { exact: true })).toBeVisible();
  await expect(diary(page).getByRole("listitem")).toHaveCount(3);
  expect(errors).toEqual([]);
});

test("continuous DEMO does not appear in LIVE or REPLAY", async ({ page }) => {
  await openDemo(page);
  for (const mode of ["LIVE", "REPLAY"] as const) {
    await page.getByRole("button", { name: mode, exact: true }).click();
    await expect(diary(page)).toHaveCount(0);
    await expect(page.locator(".bus-tag")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Seguir ônibus" })).toHaveCount(0);
  }
  await page.getByRole("button", { name: "DEMO", exact: true }).click();
  await expect(diary(page)).toBeVisible();
});

test("district and follow camera work while vehicles move and change bays", async ({ page }) => {
  await controlClock(page);
  await openDemo(page);
  const tag = page.locator('.bus-tag[data-vehicle-id="8 2361"]');
  await page.getByRole("button", { name: "Vista do bairro" }).click();
  await expect(page.locator(".viewport")).toHaveAttribute("data-camera-mode", "district");
  await expect(tag).toBeVisible();
  await page.screenshot({ path: qa + "/terminal-bairro.png" });
  await page.getByRole("button", { name: "Seguir ônibus" }).click();
  await expect.poll(async () => Math.abs((await tagOffset(tag)).x)).toBeLessThan(15);
  await advance(page, 111);
  await expect(diary(page).getByText("Saídas 4", { exact: true })).toBeVisible();
  await expect.poll(async () => Math.abs((await tagOffset(tag)).x)).toBeLessThan(15);
  await advance(page, 142);
  await expect(page.getByText(/Em rota fora da área 3D/)).toBeVisible();
  await expect(tag).toBeHidden();
  await advance(page, 203);
  await expect(page.getByText("Baia ilustrativa")).toContainText("02");
  await page.screenshot({ path: qa + "/veiculo-visao-geral.png" });
  const inspector = page.getByRole("region", { name: "Detalhes do ônibus 8 2361" });
  const movements = inspector.getByRole("region", { name: "Movimentação em tempo real" });
  await expect(movements.getByRole("listitem")).toHaveText([
    /Entrada na portaria/,
    /Estacionou na baia 02/,
    /Saída prevista · Linha 4103-10/,
  ]);
  await expect(movements.locator('[data-state="latest"]')).toContainText("Estacionou na baia 02");
  await movements.screenshot({ path: qa + "/veiculo-movimentacao.png" });
  await inspector.getByRole("tab", { name: "Histórico" }).click();
  await expect(inspector.getByText("Estacionou na baia 02")).toBeVisible();
  await expect(inspector.getByText("Entrada na portaria")).toBeVisible();
  await expect(inspector.getByText("Saída pela portaria")).toBeVisible();
  await page.screenshot({ path: qa + "/veiculo-historico.png" });
  await expect(tag).toBeVisible();
});

test("mobile continuous terminal fits without player controls", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openDemo(page);
  await expect(page.getByRole("slider")).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
  await page.screenshot({ path: qa + "/terminal-mobile.png", fullPage: true });
});
