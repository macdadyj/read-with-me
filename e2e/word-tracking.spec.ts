import { expect, test, type Page } from "@playwright/test";

async function openReader(page: Page): Promise<void> {
  await page.goto("/");
  await page.getByRole("button", { name: "Use the sample page" }).click();
  await page.getByRole("button", { name: "This is the text" }).click();
}

async function say(page: Page, word: string): Promise<void> {
  await page.getByLabel("Type a word to pretend you said it").fill(word);
  await page.getByRole("button", { name: "Say it" }).click();
}

test("word-by-word typing advances one highlight at a time", async ({ page }) => {
  await openReader(page);
  await expect(page.locator("[aria-current=true]")).toHaveText(/the/i, { timeout: 20_000 });

  await say(page, "the");
  await expect(page.locator("[aria-current=true]")).toHaveText(/puppy/i);

  await say(page, "puppy");
  await expect(page.locator("[aria-current=true]")).toHaveText(/ran/i);
});

test("a continuous phrase advances through the first sentence", async ({ page }) => {
  await openReader(page);
  await expect(page.locator("[aria-current=true]")).toHaveText(/the/i, { timeout: 20_000 });

  await say(page, "the puppy ran down the hill");
  await expect(page.locator("[aria-current=true]")).toHaveText(/then/i);
});

test("kid fold da advances The without jumping the line", async ({ page }) => {
  await openReader(page);
  await expect(page.locator("[aria-current=true]")).toHaveText(/the/i, { timeout: 20_000 });
  await say(page, "da");
  await expect(page.locator("[aria-current=true]")).toHaveText(/puppy/i);
});

test("cat, frog, and bus practice pages track the first two spoken words", async ({ page }) => {
  const pages = [
    { button: "Try the cat page", first: "the", next: /cat/i },
    { button: "Try the frog page", first: "a", next: /frog/i },
    { button: "Try the bus page", first: "the", next: /bus/i },
  ];
  for (const sample of pages) {
    await page.goto("/");
    await page.getByRole("button", { name: sample.button }).click();
    await page.getByRole("button", { name: "This is the text" }).click();
    await expect(page.locator("[aria-current=true]")).toBeVisible({ timeout: 20_000 });
    await say(page, sample.first);
    await expect(page.locator("[aria-current=true]")).toHaveText(sample.next);
  }
});
