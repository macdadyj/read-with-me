import { describe, expect, it } from "vitest";
import {
  HEARING_RMS_THRESHOLD,
  classifyListeningLevel,
  classifyMicVisualState,
  meterFill,
  rmsFromByteTimeDomain,
  rmsFromFloat32,
} from "./micLevel.ts";

describe("mic level", () => {
  it("measures RMS from float and AnalyserNode byte time-domain data", () => {
    expect(rmsFromFloat32(new Float32Array(128))).toBe(0);
    expect(rmsFromFloat32(new Float32Array(8).fill(0.5))).toBeCloseTo(0.5, 5);

    const silence = new Uint8Array(32).fill(128);
    expect(rmsFromByteTimeDomain(silence)).toBe(0);

    const loud = new Uint8Array(32);
    for (let i = 0; i < loud.length; i += 1) {
      loud[i] = i % 2 === 0 ? 200 : 56;
    }
    expect(rmsFromByteTimeDomain(loud)).toBeGreaterThan(HEARING_RMS_THRESHOLD);
  });

  it("classifies idle / quiet / hearing / error / permission-denied", () => {
    expect(classifyListeningLevel(0.001)).toBe("quiet");
    expect(classifyListeningLevel(0.2)).toBe("hearing");
    expect(classifyMicVisualState({ transport: "idle", rms: 0.5 })).toBe("idle");
    expect(classifyMicVisualState({ transport: "listening", rms: 0 })).toBe("quiet");
    expect(classifyMicVisualState({ transport: "listening", rms: 0.2 })).toBe("hearing");
    expect(classifyMicVisualState({ transport: "paused", rms: 0.2 })).toBe("paused");
    expect(classifyMicVisualState({ transport: "error", rms: 0 })).toBe("error");
    expect(classifyMicVisualState({ transport: "permission-denied", rms: 0 })).toBe("permission-denied");
    expect(meterFill(0)).toBe(0);
    expect(meterFill(1)).toBe(1);
  });
});
