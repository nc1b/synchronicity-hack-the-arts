import { createInputSampler, pointerMetrics } from "./input";

describe("input sampler", () => {
  it("normalizes pointer motion into bounded velocity and energy", () => {
    expect(pointerMetrics(0.5, 0.5, 0.5, 0.5, 100)).toEqual({
      velocity: 0,
      energy: 0,
    });
    expect(pointerMetrics(0, 0, 1, 1, 10)).toEqual({
      velocity: 1,
      energy: 1,
    });
  });

  it("emits trace packets no faster than the configured interval", () => {
    const sampler = createInputSampler("p1", 20);
    expect(sampler.pointer(0, 0, 0)).toBeNull();
    expect(sampler.pointer(0.5, 0.5, 10)).toBeNull();
    const packet = sampler.pointer(0.6, 0.5, 25);
    expect(packet).toMatchObject({
      participantId: "p1",
      sequence: 0,
      x: 0.6,
      y: 0.5,
    });
    expect(sampler.click(0.6, 0.5, 26)?.pulse).toBe(true);
    expect(sampler.key(100)).toBe(0);
    expect(sampler.key(185)).toBe(1);
  });
});
