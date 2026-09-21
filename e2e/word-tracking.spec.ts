import { expect, test, type Page } from "@playwright/test";

async function sayWord(page: Page, word: string): Promise<void> {
  await page.getByLabel("Type a word to pretend you said it").fill(word);
  await page.getByRole("button", { name: "Say it" }).click();
}

test("saying puppy on the sample page does not finish the sentence", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Use the sample page" }).click();
  await page.getByRole("button", { name: "This is the text" }).click();

  await expect(page.locator(".word-track__word.is-active")).toContainText("The");
  await sayWord(page, "puppy");
  await expect(page.locator(".word-track__word.is-active")).toContainText("ran");
  await expect(page.locator(".word-track")).toContainText("hill");
  await expect(page.locator(".word-track__word.is-active")).not.toContainText("Then");

  await page.getByRole("button", { name: "Help" }).click();
  await expect(page.locator(".coach")).toContainText(/Try this word|Almost|hint|Say it/i);
});

test("the cat sample page tracks one word at a time", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "The cat page" }).click();
  await page.getByRole("button", { name: "This is the text" }).click();

  await sayWord(page, "the");
  await expect(page.locator(".word-track__word.is-active")).toContainText("cat");
  await sayWord(page, "cat");
  await expect(page.locator(".word-track__word.is-active")).toContainText("sat");
});
