import { chromium, expect } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";

const base = "https://patio-monitor-production.up.railway.app";
const output = resolve("../../docs/gs/genai/demonstracao-navegador-real.mp4");
const errors = [];
const browser = await chromium.launch({
  headless: true,
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});
const context = await browser.newContext({
  viewport: { width: 1280, height: 720 },
  deviceScaleFactor: 1,
  recordVideo: { dir: "test-results/ia-real-recording", size: { width: 1280, height: 720 } },
});
const page = await context.newPage();
page.on("pageerror", error => errors.push(error.message));
try {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const response = await page.goto(base, { waitUntil: "domcontentloaded", timeout: 40_000 });
  if (response?.status() !== 200) throw new Error("Site público não respondeu HTTP 200");
  await expect(page.getByRole("button", { name: "Iniciar teste guiado" })).toBeVisible();
  await expect(page.locator(".viewport")).toHaveAttribute("data-ready", "true", { timeout: 45_000 });
  await page.waitForTimeout(4300);

  await page.getByRole("button", { name: "Iniciar teste guiado" }).click();
  const tour = page.getByRole("dialog");
  await expect(tour.getByText("Confira uma saída de garagem")).toBeVisible();
  await page.waitForTimeout(4300);

  await tour.getByRole("button", { name: "Abrir caso de exemplo" }).click();
  const example = page.getByRole("region", { name: "Conferência do caso de exemplo" });
  await expect(example).toContainText("8 2361");
  await expect(example).toContainText("7 8042");
  await page.waitForTimeout(6500);

  await tour.getByRole("button", { name: "Ir para a explicação" }).click();
  await expect(example.getByRole("region", { name: "Diagnóstico operacional" }))
    .toContainText("Divergência de identificação comprovada");
  await page.waitForTimeout(5500);

  const llm = page.waitForResponse(r => new URL(r.url()).pathname === "/api/gs/explain" &&
    r.request().method() === "POST", { timeout: 65_000 });
  await example.getByRole("button", { name: "Explicar ocorrência" }).click();
  const modelResponse = await llm;
  if (modelResponse.status() !== 200) throw new Error("Qwen indisponível no teste real");
  const payload = await modelResponse.json();
  if (payload.refused || !payload.citations.some(row => row.id === "p02")) {
    throw new Error("Resposta Qwen sem referência p02: " + JSON.stringify(payload));
  }
  await expect(example.getByText("Fontes consultadas")).toBeVisible();
  await page.waitForTimeout(9000);

  await tour.getByRole("button", { name: "Ver gravação" }).click();
  const evidence = page.getByRole("region", { name: "Evidência em vídeo" });
  const video = evidence.locator("video");
  await expect.poll(() => video.evaluate(el => el.error === null && el.readyState >= 1 &&
    el.duration > 7.44 && el.videoWidth > 0), { timeout: 30_000 }).toBe(true);
  await page.waitForTimeout(5200);
  await evidence.getByRole("button", { name: /Esquerda.*direita.*00:07,4/ }).click();
  await expect.poll(() => video.evaluate(el => Math.abs(el.currentTime - 7.44)), { timeout: 15_000 })
    .toBeLessThan(0.1);
  await page.waitForTimeout(7500);
  await tour.getByRole("button", { name: "Concluir teste" }).click();
  await page.waitForTimeout(3800);
  expect(errors).toEqual([]);
  const recording = page.video();
  await context.close();
  const source = await recording.path();
  await mkdir(resolve("../../docs/gs/genai"), { recursive: true });
  execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-i", source,
    "-vf", "fps=24,format=yuv420p", "-c:v", "libx264", "-preset", "fast", "-crf", "24",
    "-movflags", "+faststart", output], { stdio: "inherit" });
  console.log("Real professor tour recorded from production:", output);
} finally {
  await browser.close();
}
