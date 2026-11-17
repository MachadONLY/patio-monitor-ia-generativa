import { expect, test } from "@playwright/test";

test("operator has a single screen, visible live GPS evidence and compact mobile controls", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const now = new Date().toISOString();
  const snapshot = {
    version: 1, mode: "LIVE", state: "connected", source: "rio_mobi_gtfs_rt",
    area: {
      name: "Entorno do Terminal Alvorada", source: "MOBI-Rio — dados de teste controlados",
      origin: [-43.360556, -22.995833],
      ring: [
        [-43.375556, -23.010833], [-43.345556, -23.010833],
        [-43.345556, -22.980833], [-43.375556, -23.010833],
      ],
    },
    vehicles: [{
      vehicleId: "QA-701", lineId: 401, lineLabel: "401",
      latitude: -23.00037, longitude: -43.36610, observedAt: now, receivedAt: now,
    }],
  };
  await page.route("**/api/vehicles/snapshot?mode=LIVE", (route) => route.fulfill({ json: snapshot }));
  await page.routeWebSocket("**/api/vehicles/live", (socket) => socket.send(JSON.stringify(snapshot)));
  await page.goto("/");
  await expect(page.locator(".viewport")).toHaveAttribute("data-ready", "true", { timeout: 20_000 });
  await page.getByRole("button", { name: "Inspecionar ônibus QA-701" }).click();
  const inspector = page.getByRole("region", { name: "Detalhes do ônibus QA-701" });
  await expect(inspector).toBeVisible();
  await expect(inspector.locator(".inspector-quick-reading")).toContainText("GPS observado em");
  await expect(inspector.locator(".inspector-location")).toContainText("-23.000370, -43.366100");
  await expect(inspector.locator(".inspector-portrait")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Trajeto", exact: true })).toHaveCount(0);

  const desktop = await page.evaluate(() => ({
    documentHeight: document.documentElement.scrollHeight,
    viewportHeight: window.innerHeight,
    inspectorScroll: document.querySelector(".operation-panel-content")!.scrollHeight
      - document.querySelector(".operation-panel-content")!.clientHeight,
  }));
  expect(desktop.documentHeight).toBe(desktop.viewportHeight);
  expect(desktop.inspectorScroll).toBeLessThanOrEqual(90);
  await page.screenshot({ path: test.info().outputPath("operator-release-desktop.png") });

  await page.setViewportSize({ width: 390, height: 844 });
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await expect(page.getByRole("button", { name: "Iniciar teste guiado" })).toBeVisible();
  await page.screenshot({ path: test.info().outputPath("operator-release-mobile.png") });
});
