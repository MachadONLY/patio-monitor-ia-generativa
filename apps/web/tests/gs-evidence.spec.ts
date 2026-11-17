import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const videoPath = fileURLToPath(new URL("./fixtures/vision-playback.webm", import.meta.url));
const media = "/api/gs/vision/media/annotated.webm";

test("recorded vision evidence keeps its source and seeks to a crossing", async ({ page }) => {
  await page.route("**/api/gs/vision", (route) => route.fulfill({
    json: {
      schema_version: 1,
      data_origin: "PUBLIC_VIDEO",
      source: {
        title: "Gravação de teste",
        author: "Autor do teste",
        license: "CC BY 4.0",
        license_url: "https://creativecommons.org/licenses/by/4.0/",
        source_url: "https://example.test/original",
      },
      model: { family: "Detector de teste" },
      video: { url: media, duration_seconds: 2 },
      events: [{ id: "t1", timestamp_seconds: 1.5, direction: "LEFT_TO_RIGHT", confidence: 0.89 }],
    },
  }));
  const video = await readFile(videoPath);
  await page.route("**" + media, (route) => {
    const range = /^bytes=(\d+)-(\d*)$/.exec(route.request().headers().range ?? "");
    const headers = { "accept-ranges": "bytes" };
    if (!range) return route.fulfill({ headers, contentType: "video/webm", body: video });
    const start = Number(range[1]);
    const end = range[2] ? Math.min(Number(range[2]), video.length - 1) : video.length - 1;
    return route.fulfill({
      status: 206, contentType: "video/webm", body: video.subarray(start, end + 1),
      headers: { ...headers, "content-range": `bytes ${start}-${end}/${video.length}` },
    });
  });

  await page.goto("/");
  const trigger = page.getByRole("button", { name: "Câmera do portão", exact: true });
  await trigger.click();
  const dialog = page.getByRole("dialog", { name: "Câmera do portão" });
  await expect(dialog.getByText("VÍDEO PÚBLICO • GRAVAÇÃO")).toBeVisible();
  await expect(dialog.getByRole("link", { name: "Gravação original" })).toHaveAttribute("href", "https://example.test/original");
  const crossing = dialog.getByRole("button", { name: /Esquerda.*direita.*00:01,5/ });
  await crossing.click();
  await expect(crossing).toHaveAttribute("aria-pressed", "true");
  await expect.poll(() => dialog.locator("video").evaluate((video) => (video as HTMLVideoElement).currentTime)).toBeCloseTo(1.5, 1);
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
  await expect(page.getByRole("button", { name: /^(DEMO|LIVE|REPLAY)$/ })).toHaveCount(0);
});

test("unavailable vision supports retry without inventing a recording", async ({ page }) => {
  let requests = 0;
  await page.route("**/api/gs/vision", (route) => {
    requests += 1;
    return route.fulfill({ status: 404 });
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Câmera do portão", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Câmera do portão" });
  await expect(dialog.getByText("O vídeo e os cruzamentos estão indisponíveis.")).toBeVisible();
  await expect(dialog.locator("video")).toHaveCount(0);
  await dialog.getByRole("button", { name: "Tentar novamente" }).click();
  await expect.poll(() => requests).toBe(2);
  await expect(dialog.getByText("O vídeo e os cruzamentos estão indisponíveis.")).toBeVisible();
});

test("explanation displays a cited answer and shares no imported identifiers", async ({ page }) => {
  const requests: { question: string; context: Record<string, string> }[] = [];
  await page.route("**/api/gs/explain", async (route) => {
    requests.push(route.request().postDataJSON());
    const refused = requests.length > 1;
    await route.fulfill({
      json: {
        answer: refused ? "Não encontrei base suficiente." : "Compare os registros originais.",
        refused,
        model: "Modelo de teste",
        actions: refused ? [] : ["Revise o horário de passagem."],
        citations: refused ? [] : [{ id: "regra", title: "Regra documentada", url: "https://example.test/regra" }],
      },
    });
  });

  await page.goto("/");
  await page.getByRole("button", { name: /Revisar turno/ }).click();
  await page.getByLabel("Arquivo de escala").setInputFiles({
    name: "escala.csv",
    mimeType: "text/csv",
    buffer: Buffer.from("trip_id,vehicle_id,planned_at\nIDENTIFICADOR-PRIVADO,VEICULO-PRIVADO,2026-11-06T06:30:00-03:00\n"),
  });
  await page.getByLabel("Arquivo de portaria").setInputFiles({
    name: "portaria.csv",
    mimeType: "text/csv",
    buffer: Buffer.from("event_id,vehicle_id,observed_at,direction,trip_id\n"),
  });
  await page.getByRole("button", { name: "Revisar arquivos" }).click();
  await page.getByRole("textbox", { name: "Conclusão da ocorrência" }).fill("NOTA PRIVADA");
  const diagnosis = page.getByRole("region", { name: "Diagnóstico operacional" });
  await expect(diagnosis).toContainText("Saída sem confirmação de portaria");
  await expect(diagnosis).toContainText("IDENTIFICADOR-PRIVADO");
  await page.getByRole("button", { name: "Explicar ocorrência" }).click();
  await expect(page.getByText("Orientação gerada pelo assistente")).toBeVisible();
  await expect(page.getByRole("link", { name: "Regra documentada" })).toHaveAttribute("href", "https://example.test/regra");
  expect(requests[0].context).toEqual({
    tripId: "ocorrencia-local", status: "unconfirmed", reason: "missing_gate", evidenceMode: "CSV_LOCAL",
  });
  expect(JSON.stringify(requests[0])).not.toMatch(/PRIVAD[OA]/);
});
