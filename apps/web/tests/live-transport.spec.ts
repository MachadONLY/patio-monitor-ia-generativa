import { expect, test, type WebSocketRoute } from "@playwright/test";

test("the only operating view opens the same-origin GPS stream automatically", async ({ page }) => {
  const opening = page.waitForEvent("websocket", {
    predicate: (socket) => socket.url().endsWith("/api/vehicles/live"),
  });
  await page.goto("/");
  expect(new URL((await opening).url()).host).toBe(new URL(page.url()).host);
  await expect(page.getByRole("status").filter({ hasText: "GPS indisponível" })).toBeVisible();
  await expect(page.getByRole("button", { name: /^(DEMO|LIVE|REPLAY)$/ })).toHaveCount(0);
  await expect(page.locator(".live-bus-pin")).toHaveCount(0);
});

test("a lost stream resumes HTTP without inventing vehicles", async ({ page }) => {
  let stream: WebSocketRoute | undefined;
  let httpReads = 0;
  const snapshot = { version: 1, mode: "LIVE", state: "not_configured", vehicles: [] };
  await page.route("**/api/vehicles/snapshot?mode=LIVE", (route) => {
    httpReads++;
    return route.fulfill({ json: snapshot });
  });
  await page.routeWebSocket("**/api/vehicles/live", (socket) => {
    if (stream) socket.close();
    else {
      stream = socket;
      socket.send(JSON.stringify(snapshot));
    }
  });
  await page.goto("/");
  await expect.poll(() => Boolean(stream) && httpReads > 0).toBe(true);
  const initialReads = httpReads;
  await stream!.close({ code: 1011, reason: "Test interruption" });
  await expect.poll(() => httpReads).toBeGreaterThan(initialReads);
  await expect(page.getByRole("status").filter({ hasText: "GPS indisponível" })).toBeVisible();
  await expect(page.locator(".live-bus-pin")).toHaveCount(0);
});
