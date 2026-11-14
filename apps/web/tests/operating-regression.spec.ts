import { expect, test, type Locator, type Page, type WebSocketRoute } from "@playwright/test";

const area = {
  name: "Entorno do Terminal Alvorada",
  source: "Recorte de teste",
  origin: [-43.360556, -22.995833],
  ring: [[-43.375556, -23.010833], [-43.345556, -23.010833], [-43.345556, -22.980833], [-43.375556, -23.010833]],
};

function gpsSample(observedAt: string, latitude = -23.00037, longitude = -43.36610) {
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
  await page.emulateMedia({ reducedMotion: "reduce" });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await startOperatingPage(page, snapshot([gpsSample(new Date().toISOString())]));
  const viewport = page.locator(".viewport");
  const canvas = viewport.locator("canvas");
  await expect(viewport).toHaveAttribute("data-ready", "true", { timeout: 20_000 });
  await expect(viewport).toHaveAttribute("data-camera-mode", "terminal");
  await expect(page.getByRole("heading", { name: "Terminal Alvorada" })).toBeVisible();
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
  const moved = gpsSample(new Date(now).toISOString(), -23.00037, -43.36630);
  const stream = await startOperatingPage(page, snapshot([start]));
  const viewport = page.locator(".viewport");
  const tag = viewport.locator(".bus-tag");
  await expect(viewport).toHaveAttribute("data-ready", "true", { timeout: 20_000 });
  await page.getByRole("button", { name: "Inspecionar ônibus 50103" }).click();
  await expect(page.getByText("Posição registrada", { exact: true })).toBeVisible();
  const initialTag = await tag.boundingBox();
  expect(initialTag).toBeTruthy();

  stream.send(JSON.stringify(snapshot([moved])));
  await expect(page.getByText("-23.000370, -43.366300", { exact: true })).toBeVisible();
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
  await expect(page.getByText("-23.000370, -43.366300", { exact: true })).toBeVisible();
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
  await page.getByRole("button", { name: "Entradas e saídas", exact: true }).click();
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

test("the Alvorada scenery animates independently of GPS and respects reduced motion", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error" && /shader|webgl/i.test(message.text())) errors.push(message.text());
  });
  await startOperatingPage(page, snapshot([]));
  const canvas = page.locator(".viewport canvas");
  await expect(page.locator(".viewport")).toHaveAttribute("data-ready", "true", { timeout: 20_000 });
  await expect(page.locator(".live-bus-pin")).toHaveCount(0);
  await page.getByRole("button", { name: "Pausar ambientação" }).click();
  const frame = await canvas.screenshot({ path: test.info().outputPath("alvorada-vivo.png") });
  await page.getByRole("button", { name: "Retomar ambientação" }).click();
  await page.waitForTimeout(1600);
  await page.getByRole("button", { name: "Pausar ambientação" }).click();
  expect((await canvas.screenshot()).equals(frame)).toBe(false);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.getByRole("button", { name: "Retomar ambientação" }).click();
  await expect.poll(async () => {
    const first = await canvas.screenshot();
    return (await canvas.screenshot()).equals(first);
  }).toBe(true);
  expect(errors).toEqual([]);
});

test("a professor can open a shift case without uploading files and request a sourced explanation", async ({ page }) => {
  await page.route("**/api/gs/explain", async (route) => {
    const request = route.request().postDataJSON();
    expect(request.context.evidenceMode).toBe("DEMO");
    await route.fulfill({ json: {
      answer: "Confira o registro de portaria e o prefixo do veículo.",
      citations: [{ id: "p02", title: "Troca de veículo", url: "https://example.com/regra" }],
      refused: false, model: "Qwen de teste", actions: [],
    } });
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Revisar turno" }).click();
  await page.getByRole("button", { name: "Abrir caso de exemplo" }).click();
  await expect(page.getByText(/Escala e portaria de teste/)).toBeVisible();
  await page.getByRole("button", { name: "Explicar ocorrência" }).click();
  await expect(page.getByText("Orientação gerada pelo assistente")).toBeVisible();
  await expect(page.getByRole("link", { name: "Troca de veículo" })).toBeVisible();
});

test("unmatched GPS remains in the inspector without a bus, pin or camera on the sidewalk", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await startOperatingPage(page, snapshot([gpsSample(new Date().toISOString(), -23.00198, -43.36601)]));
  await expect(page.locator(".viewport")).toHaveAttribute("data-ready", "true", { timeout: 20_000 });
  await expect(page.getByRole("button", { name: "Localizar ônibus 50103" })).toHaveCount(0);
  await page.getByRole("button", { name: "Inspecionar ônibus 50103" }).click();
  await expect(page.getByText(/Leitura sem correspondência segura/)).toBeVisible();
  await expect(page.getByText("-23.001980, -43.366010", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Focar veículo" })).toBeDisabled();
  await expect(page.locator(".bus-tag")).toHaveCount(0);
});
