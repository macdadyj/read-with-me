import { expect, test, type Page } from "@playwright/test";

async function openReader(page: Page): Promise<void> {
  await page.goto("/");
  await page.getByRole("button", { name: "Use the sample page" }).click();
  await page.getByRole("button", { name: "This is the text" }).click();
}

test("level meter reacts to injected audio and the listen path starts", async ({ page, context }) => {
  await context.grantPermissions(["microphone"]);
  await page.addInitScript(() => {
    const original = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia = async (constraints) => {
      if (constraints && "audio" in constraints) {
        const audioContext = new AudioContext();
        const oscillator = audioContext.createOscillator();
        oscillator.frequency.value = 330;
        oscillator.type = "sine";
        const gain = audioContext.createGain();
        gain.gain.value = 0.45;
        const destination = audioContext.createMediaStreamDestination();
        oscillator.connect(gain);
        gain.connect(destination);
        oscillator.start();
        await audioContext.resume();
        return destination.stream;
      }
      return original(constraints);
    };
  });

  await openReader(page);

  const meter = page.getByRole("meter", { name: "Microphone level" });
  await expect(meter).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole("status")).toHaveAttribute(
    "aria-label",
    /Hearing sound from the microphone|Listening, but it is quiet/,
    { timeout: 10_000 },
  );

  await expect.poll(async () => Number(await meter.getAttribute("aria-valuenow")), { timeout: 10_000 }).toBeGreaterThan(8);
  await page.screenshot({ path: "test-results/mic-meter-hearing.png", fullPage: true });

  await page.getByRole("button", { name: "Pause" }).click();
  await expect(page.getByRole("status")).toHaveAttribute("aria-label", "Microphone is paused");
  await page.screenshot({ path: "test-results/mic-meter-paused.png", fullPage: true });
});

test("quiet meter state when the stream is silent", async ({ page, context }) => {
  await context.grantPermissions(["microphone"]);
  await page.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = async () => {
      const audioContext = new AudioContext();
      const destination = audioContext.createMediaStreamDestination();
      await audioContext.resume();
      return destination.stream;
    };
  });
  await openReader(page);
  await expect(page.getByRole("status")).toHaveAttribute("aria-label", "Listening, but it is quiet", {
    timeout: 10_000,
  });
  await page.screenshot({ path: "test-results/mic-meter-quiet.png", fullPage: true });
});

test("permission-denied meter state is accessible when getUserMedia is blocked", async ({ page }) => {
  await page.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = async () => {
      throw new DOMException("Permission denied", "NotAllowedError");
    };
  });
  await openReader(page);
  await expect(page.getByRole("status")).toHaveAttribute("aria-label", /permission denied/i, {
    timeout: 10_000,
  });
  await page.screenshot({ path: "test-results/mic-meter-denied.png", fullPage: true });
});
