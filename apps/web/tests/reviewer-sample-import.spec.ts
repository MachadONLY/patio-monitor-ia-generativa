import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";

test("reviewer can download complete example CSVs, import and audit a real discrepancy", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Revisar turno", exact: true }).click();

  const [schedule] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Baixar escala preenchida (CSV)" }).click(),
  ]);
  const [gate] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Baixar portaria preenchida (CSV)" }).click(),
  ]);
  const schedulePath = await schedule.path();
  const gatePath = await gate.path();
  expect(schedulePath).toBeTruthy();
  expect(gatePath).toBeTruthy();
  const scheduleData = await readFile(schedulePath!);
  const gateData = await readFile(gatePath!);
  expect(scheduleData.toString()).toContain("PM-0615");
  expect(gateData.toString()).toContain("PORT-019");
  expect(scheduleData.toString().trim().split(/\r?\n/)).toHaveLength(5);
  expect(gateData.toString().trim().split(/\r?\n/)).toHaveLength(4);

  await page.getByLabel("Arquivo de escala").setInputFiles({
    name: schedule.suggestedFilename(), mimeType: "text/csv", buffer: scheduleData,
  });
  await page.getByLabel("Arquivo de portaria").setInputFiles({
    name: gate.suggestedFilename(), mimeType: "text/csv", buffer: gateData,
  });
  await page.getByRole("button", { name: "Revisar arquivos" }).click();

  await expect(page.getByText("ARQUIVOS LOCAIS", { exact: true }).first()).toBeVisible();
  await expect(page.getByRole("region", { name: "Resumo da conciliação" })).toContainText("Dados divergentes");
  await expect(page.getByRole("button", { name: /Investigar PM-0615/ })).toBeVisible();
  await page.getByRole("button", { name: /Investigar PM-0615/ }).click();
  await expect(page.getByRole("region", { name: "Evidências da saída selecionada" })).toContainText("7 8042");

  const [exported] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Exportar ocorrências" }).click(),
  ]);
  const result = await readFile((await exported.path())!);
  expect(result.toString()).toContain("PM-0615");
});
