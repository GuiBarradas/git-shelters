import { expect, test } from "@playwright/test";

test("landing renders the bunker canvas", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("canvas")).toBeVisible();
});
