import { expect, test } from "@playwright/test";

test("landing renders the demo bunker and the GitHub call to action", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("canvas")).toBeVisible();
  await expect(page.getByRole("button", { name: "Connect with GitHub" })).toBeVisible();
  await expect(page.getByText("Your commits build the bunker.")).toBeVisible();
});
