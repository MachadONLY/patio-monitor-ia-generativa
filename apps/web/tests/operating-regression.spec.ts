import { expect, test, type Locator, type Page, type WebSocketRoute } from "@playwright/test";

const area = {
  name: "Entorno do Terminal Alvorada",
  source: "Recorte de teste",
  origin: [-43.360556, -22.995833],
  ring: [[-43.375556, -23.010833], [-43.345556, -23.010833], [-43.345556, -22.980833], [-43.375556, -23.010833]],
};

function gpsSample(observedAt: string, latitude = -23.00198, longitude = -43.36601) {
  return {
    vehicleId: "50103", lineId: 401, lineLabel: "401",
    latitude, longitude, observedAt, receivedAt: observedAt,
  };
}

function snapshot(vehicles: ReturnType<typeof gpsSample>[], state = "connected") {
  return { version: 1, mode: "LIVE", state, source: "rio_mobi_gtfs_rt", area, vehicles };
}

async function startOperatingPage(
  page: Page,
  initial: ReturnType<typeof snapshot>,
  crossings: { status: string; events: unknown[] } = { status: "active", events: [] },
) {
  let stream: WebSocketRoute | undefined;
  await page.route("**/api/vehicles/snapshot?mode=LIVE", (route) => route.fulfill({ json: initial }));
  await page.routeWebSocket("**/api/vehicles/live", (socket) => {
    stream = socket;
    socket.send(JSON.stringify(initial));
  });
  await page.route("**/api/vehicles/terminal-crossings", (route) => route.fulfill({ json: crossings }));
  await page.route("**/api/vehicles/50103/history?*", (route) => route.fulfill({
    json: { source: initial.source, observations: initial.vehicles },
  }));
  await page.goto("/");
  await expect.poll(() => !!stream).toBe(true);
  return stream!;
}

async function verifyMapFrame(canvas: Locator, page: Page, name: string, containsSelectedVehicle = false) {
  const image = await canvas.screenshot({ path: test.info().outputPath(name + ".png") });
  const frame = await page.evaluate(async (base64) => {
    const bytes = Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
    const bitmap = await createImageBitmap(new Blob([bytes]));
    const thumbnail = document.createElement("canvas");
    thumbnail.width = 100;
    thumbnail.height = 100;
    const context = thumbnail.getContext("2d")!;
    context.drawImage(bitmap, 0, 0, thumbnail.width, thumbnail.height);
    const data = context.getImageData(0, 0, thumbnail.width, thumbnail.height).data;
    let band = 0;
    let maximum = 0;
    for (let y = 0; y < 100; y++) {
      let sky = 0;
      for (let x = 9; x < 91; x++) {
        const offset = (y * 100 + x) * 4;
        const [red, green, blue] = data.subarray(offset, offset + 3);
        if (red >= 165 && red <= 218 && green - red >= 11 && blue - green >= 6 && blue >= 218) sky++;
      }
      band = sky >= 66 ? band + 1 : 0;
      maximum = Math.max(maximum, band);
    }
    const native = document.createElement("canvas");
    native.width = bitmap.width;
    native.height = bitmap.height;
    const rendering = native.getContext("2d")!;
    rendering.drawImage(bitmap, 0, 0);
    const middle = rendering.getImageData(
      Math.floor(native.width * .37), Math.floor(native.height * .37),
      Math.floor(native.width * .26), Math.floor(native.height * .26),
    ).data;
    let selectionPixels = 0;
    for (let index = 0; index < middle.length; index += 4) {
      const [red, green, blue] = middle.subarray(index, index + 3);
      if (red <= 180 && green >= 155 && blue >= 120 && green - red >= 55 && green - blue >= 21) selectionPixels++;
    }
    return { largestSkyBand: maximum, selectionPixels };
  }, image.toString("base64"));
  expect(frame.largestSkyBand, name + " continuous sky strip, as percent of canvas").toBeLessThanOrEqual(5);
  if (containsSelectedVehicle) expect(frame.selectionPixels, name + " selection outline in the center").toBeGreaterThan(2);
}

test("vehicle inspection preserves the rendered terrain across terminal, focus, profile and top", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await startOperatingPage(page, snapshot([gpsSample(new Date().toISOString())]));
  const viewport = page.locator(".viewport");
  const canvas = viewport.locator("canvas");
  await expect(viewport).toHaveAttribute("data-ready", "true");
  await expect(viewport).toHaveAttribute("data-camera-mode", "terminal");
  await verifyMapFrame(canvas, page, "desktop-terminal");

  await page.getByRole("button", { name: "Inspecionar ônibus 50103" }).click();
  await expect(viewport.locator(".bus-tag")).toContainText("50103");
  await expect(viewport).toHaveAttribute("data-camera-mode", "focus");
  await verifyMapFrame(canvas, page, "desktop-focus");

  for (const [button, mode] of [["Perfil", "profile"], ["Superior", "top"]]) {
    await page.getByRole("button", { name: button, exact: true }).click();
    await expect(viewport).toHaveAttribute("data-camera-mode", mode);
    await expect(page.getByText("Posição registrada", { exact: true })).toBeVisible();
    await verifyMapFrame(canvas, page, "desktop-" + mode, true);
  }

  await page.setViewportSize({ width: 390, height: 844 });
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await verifyMapFrame(canvas, page, "mobile-top", true);
  await page.getByRole("button", { name: "Focar veículo" }).click();
  await expect(viewport).toHaveAttribute("data-camera-mode", "focus");
  await verifyMapFrame(canvas, page, "mobile-focus");
  expect(errors).toEqual([]);
});

test("the selected vehicle receives fresh GPS, remains framed and indicates stale data", async ({ page }) => {
  const now = Date.now();
  const start = gpsSample(new Date(now - 40_000).toISOString());
  const moved = gpsSample(new Date(now).toISOString(), -23.00244, -43.36663);
  const stream = await startOperatingPage(page, snapshot([start]));
  const viewport = page.locator(".viewport");
  const tag = viewport.locator(".bus-tag");
  await expect(viewport).toHaveAttribute("data-ready", "true");
  await page.getByRole("button", { name: "Inspecionar ônibus 50103" }).click();
  await expect(page.getByText("Posição registrada", { exact: true })).toBeVisible();
  const initialTag = await tag.boundingBox();
  expect(initialTag).toBeTruthy();

  stream.send(JSON.stringify(snapshot([moved])));
  await expect(page.getByText("-23.002440, -43.366630", { exact: true })).toBeVisible();
  await expect(viewport).toHaveAttribute("data-camera-mode", "focus");
  await expect.poll(async () => {
    const position = await tag.boundingBox();
    return position ? Math.hypot(position.x - initialTag!.x, position.y - initialTag!.y) : Infinity;
  }).toBeLessThan(18);

  stream.send(JSON.stringify(snapshot([moved], "stale")));
  await expect(page.getByRole("status").filter({ hasText: "GPS desatualizado" })).toBeVisible();
  await expect(page.getByText("Leitura desatualizada", { exact: true })).toBeVisible();
  stream.send(JSON.stringify(snapshot([], "no_observations")));
  await expect(page.getByRole("status").filter({ hasText: "Sem veículos no recorte" })).toBeVisible();
  await expect(page.getByText("-23.002440, -43.366630", { exact: true })).toBeVisible();
  await expect(tag).toHaveCount(0);
});

test("operating view displays estimated terminal crossing intervals and evidence method", async ({ page }) => {
  const events = [
    { id: "entry", kind: "entry", vehicleId: "50103", line: "401",
      betweenFrom: "2026-11-14T18:30:00Z", betweenTo: "2026-11-14T18:30:17Z", confirmedAt: "2026-11-14T18:30:45Z" },
    { id: "exit", kind: "exit", vehicleId: "50104", line: null,
      betweenFrom: "2026-11-14T18:29:30Z", betweenTo: "2026-11-14T18:29:55Z", confirmedAt: "2026-11-14T18:30:22Z" },
  ];
  await startOperatingPage(page, snapshot([gpsSample(new Date().toISOString())]), { status: "active", events });
  const crossing = page.getByRole("region", { name: "Entradas e saídas" });
  const recorded = crossing.getByRole("list", { name: "Últimos cruzamentos" });
  await expect(recorded.locator('[data-kind="entry"]')).toContainText("Entrada · 50103");
  await expect(recorded.locator('[data-kind="entry"]')).toContainText("15:30:00–15:30:17");
  await expect(recorded.locator('[data-kind="exit"]')).toContainText("Saída · 50104");
  await expect(recorded.locator('[data-kind="exit"]')).toContainText("15:29:30–15:29:55");
  await crossing.getByText("Como o horário é estimado").click();
  await expect(crossing.getByText(/duas leituras consecutivas/)).toBeVisible();
  await crossing.screenshot({ path: test.info().outputPath("terminal-crossings.png") });
  await expect(recorded.locator('[data-kind="exit"]').getByRole("button")).toHaveCount(0);
  await recorded.getByRole("button", { name: "Abrir ficha do ônibus 50103, entrada" }).click();
  await expect(page.locator(".viewport")).toHaveAttribute("data-camera-mode", "focus");
});
