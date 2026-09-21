import { expect, test } from "@playwright/test";

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

  await page.goto("/");
  await page.getByRole("button", { name: "Use the sample page" }).click();
  await page.getByRole("button", { name: "This is the text" }).click();

  const meter = page.getByRole("meter", { name: "Microphone level" });
  await expect(meter).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole("status")).toHaveAttribute(
    "aria-label",
    /Hearing sound from the microphone|Listening, but it is quiet/,
    { timeout: 10_000 },
  );

  await expect.poll(async () => Number(await meter.getAttribute("aria-valuenow")), { timeout: 10_000 }).toBeGreaterThan(8);
});
