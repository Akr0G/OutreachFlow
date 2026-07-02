import { expect, test } from "@playwright/test";

test("adds a lead with validation", async ({ page }) => {
  await page.goto("/leads/new");
  await page.getByLabel("Business name").fill("Harbor Books");
  await page.getByLabel("Email").fill("owner@example.com");
  await page.getByLabel("Industry").fill("Bookstore");
  await page.getByRole("button", { name: "Save lead" }).click();
  await expect(page.getByText("Lead validated and ready in demo mode.")).toBeVisible();
});

test("generates and approves a draft", async ({ page }) => {
  await page.goto("/leads/11111111-1111-4111-8111-111111111111");
  await page.getByRole("button", { name: "Initial Draft" }).click();
  await expect(page.getByText("Initial draft created.")).toBeVisible();
  await page.getByRole("button", { name: "Approve" }).first().click();
  await expect(page.getByText("Draft approved", { exact: true }).first()).toBeVisible();
});

test("blocks a follow-up after a reply is recorded", async ({ page }) => {
  await page.goto("/leads/33333333-3333-4333-8333-333333333333");
  await expect(page.getByRole("button", { name: "Follow-Up" })).toBeEnabled();
  await page.getByRole("button", { name: "Record manual reply" }).click();
  await expect(page.getByRole("button", { name: "Follow-Up" })).toBeDisabled();
  await expect(page.getByText("Follow-up canceled because a reply was received")).toBeVisible();
});
