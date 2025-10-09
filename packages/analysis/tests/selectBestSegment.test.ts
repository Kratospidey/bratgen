import { describe, expect, it } from "vitest";
import { scoreCandidate, selectBestSegment, SegmentCandidate } from "../src";

describe("selectBestSegment", () => {
  it("returns the candidate with highest weighted score", () => {
    const candidates: SegmentCandidate[] = [
      { start: 0, end: 20, energy: 0.4, loudness: -8, confidence: 0.7 },
      { start: 25, end: 55, energy: 0.9, loudness: -4, confidence: 0.6 },
      { start: 60, end: 90, energy: 0.7, loudness: -12, confidence: 0.9 }
    ];

    const result = selectBestSegment({ targetDuration: 30, candidates });
    expect(result?.start).toBe(25);
    expect(result?.end).toBe(55);
  });

  it("returns null when no candidate fits duration", () => {
    const candidates: SegmentCandidate[] = [
      { start: 0, end: 5, energy: 1, loudness: -2, confidence: 1 }
    ];

    const result = selectBestSegment({ targetDuration: 30, candidates });
    expect(result).toBeNull();
  });

  it("computes individual candidate scores", () => {
    const candidate: SegmentCandidate = { start: 10, end: 40, energy: 0.7, loudness: -6, confidence: 0.8 };
    const score = scoreCandidate(candidate, { targetDuration: 30 });
    expect(score).toBeGreaterThan(0);
  });
});
