import { expect, test } from "@playwright/test";

test("enters the field and exposes the judge controls", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Art appears when our movements meet." })).toBeVisible();
  await page.getByRole("button", { name: "Enter the field" }).click();
  await expect(page.getByText(/local echo|live field|joining the field/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Capture this moment" })).toBeVisible();
  await expect(page.locator("canvas")).toBeVisible();
});

test("keeps the experience keyboard reachable", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Enter the field" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("button", { name: "Sound on" })).toBeVisible();
  await page.getByRole("application").focus();
  await page.keyboard.press("a");
  await expect(page.getByRole("application")).toBeFocused();
});

test("exports a PNG snapshot", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Enter the field" }).click();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Capture this moment" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("synchronicity-moment.png");
});
