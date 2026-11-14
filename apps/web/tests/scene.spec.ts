import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";

test("model has purpose-built glTF mesh families", () => {
  const file = readFileSync("public/models/sp-standard-bus.glb");
  expect(file.subarray(0, 4).toString()).toBe("glTF");
  expect(file.readUInt32LE(4)).toBe(2);
  const document = JSON.parse(
    file.subarray(20, 20 + file.readUInt32LE(12)).toString(),
  );
  const names = document.nodes
    .filter((node: { mesh?: number }) => node.mesh !== undefined)
    .map((node: { name: string }) => node.name);
  for (const family of [
    "Body",
    "Windows",
    "Wheels",
    "Doors",
    "Roof",
    "DestinationSign",
    "Livery",
  ]) {
    expect(
      names.some((name: string) => name.startsWith(family)),
      family,
    ).toBe(true);
  }
});

test("a published coordinate reference lands on the same metric axes as the scene", async () => {
  const { localPoint } = await import("../src/observations");
  const origin: [number, number] = [-46.633308, -23.55052];
  const [east, north] = localPoint(origin, [-46.632308, -23.54952]);
  // Independent reference from PROJ via pyproj (EPSG:4326 to EPSG:32723).
  expect(east).toBeCloseTo(100.8288, 2);
  expect(north).toBeCloseTo(-111.901, 2);
  expect(localPoint(origin, origin)).toEqual([0, 0]);
});

test("the operating scene opens the terminal and focuses a GPS observation", async ({ page }) => {
  const observedAt = new Date().toISOString();
  const area = {
    name: "Entorno do Terminal Alvorada", source: "Recorte de teste", origin: [-43.360556, -22.995833],
    ring: [[-43.375556, -23.010833], [-43.345556, -23.010833], [-43.345556, -22.980833], [-43.375556, -23.010833]],
  };
  const vehicle = {
    vehicleId: "50103", lineId: null, lineLabel: "Linha de teste",
    latitude: -23.00198, longitude: -43.36601, observedAt, receivedAt: observedAt,
  };
  const snapshot = { version: 1, mode: "LIVE", state: "connected", source: "rio_mobi_gtfs_rt", area, vehicles: [vehicle] };
  await page.route("**/api/vehicles/snapshot?mode=LIVE", (route) => route.fulfill({ json: snapshot }));
  await page.routeWebSocket("**/api/vehicles/live", (socket) => socket.send(JSON.stringify(snapshot)));
  await page.route("**/api/vehicles/50103/history?*", (route) => route.fulfill({
    json: { source: "rio_mobi_gtfs_rt", observations: [vehicle] },
  }));
  await page.goto("/");
  await expect(page.locator(".viewport")).toHaveAttribute("data-camera-mode", "terminal");
  await expect(page.getByRole("heading", { name: "Terminal Alvorada" })).toBeVisible();
  await expect(page.getByRole("link", { name: "© OpenStreetMap" })).toBeVisible();
  await page.getByRole("button", { name: "Inspecionar ônibus 50103" }).click();
  await expect(page.locator(".viewport")).toHaveAttribute("data-camera-mode", "focus");
  await page.getByRole("tab", { name: "Histórico" }).click();
  await expect(page.getByText("-23.001980, -43.366010", { exact: true })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});
