import { frequencyForCollision, volumeForIntensity } from "./audio";

describe("audio mapping", () => {
  it("maps pentatonic pitch classes to stable frequencies", () => {
    expect(frequencyForCollision(0)).toBeCloseTo(261.63, 2);
    expect(frequencyForCollision(4)).toBeCloseTo(523.25, 2);
    expect(frequencyForCollision(9)).toBeCloseTo(523.25, 2);
  });

  it("keeps collision volume below a safe ceiling", () => {
    expect(volumeForIntensity(0)).toBeCloseTo(0.01, 2);
    expect(volumeForIntensity(1)).toBeCloseTo(0.16, 2);
    expect(volumeForIntensity(4)).toBeCloseTo(0.16, 2);
  });
});
