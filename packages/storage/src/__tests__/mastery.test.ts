// ** Unit tests for mastery calculations
// ** Tests decay calculation (Ebbinghaus forgetting curve) and SM-2 spaced repetition

import { describe, expect, it } from "bun:test";
import {
  calculateEffectiveMastery,
  calculateNextReview,
} from "../redis/mastery.js";

describe("calculateEffectiveMastery", () => {
  describe("decay calculation (Ebbinghaus forgetting curve)", () => {
    it("should return full mastery when interaction was today", () => {
      const now = new Date();
      const lastInteraction = now.toISOString();
      const storedMastery = 0.9;

      const result = calculateEffectiveMastery(storedMastery, lastInteraction, now);

      // With 0 days, decay factor should be e^0 = 1
      expect(result.effectiveMastery).toBe(0.9);
      expect(result.daysSinceInteraction).toBe(0);
    });

    it("should decay mastery after 7 days", () => {
      const now = new Date();
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const storedMastery = 0.9;

      const result = calculateEffectiveMastery(
        storedMastery,
        sevenDaysAgo.toISOString(),
        now
      );

      // With decay rate 0.1 and 7 days: 0.9 * e^(-0.1 * 7) ≈ 0.447
      expect(result.effectiveMastery).toBeCloseTo(0.447, 2);
      expect(result.daysSinceInteraction).toBeCloseTo(7, 0);
    });

    it("should decay significantly after 30 days", () => {
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const storedMastery = 0.9;

      const result = calculateEffectiveMastery(
        storedMastery,
        thirtyDaysAgo.toISOString(),
        now
      );

      // With decay rate 0.1 and 30 days: 0.9 * e^(-0.1 * 30) ≈ 0.045
      expect(result.effectiveMastery).toBeCloseTo(0.045, 2);
      expect(result.daysSinceInteraction).toBeCloseTo(30, 0);
    });

    it("should never return negative mastery", () => {
      const now = new Date();
      const longTimeAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
      const storedMastery = 0.5;

      const result = calculateEffectiveMastery(
        storedMastery,
        longTimeAgo.toISOString(),
        now
      );

      expect(result.effectiveMastery).toBeGreaterThanOrEqual(0);
    });

    it("should handle zero mastery", () => {
      const now = new Date();
      const result = calculateEffectiveMastery(0, now.toISOString(), now);

      expect(result.effectiveMastery).toBe(0);
    });

    it("should handle full mastery", () => {
      const now = new Date();
      const result = calculateEffectiveMastery(1.0, now.toISOString(), now);

      expect(result.effectiveMastery).toBe(1.0);
    });
  });
});

describe("calculateNextReview (SM-2 Algorithm)", () => {
  describe("correct answers", () => {
    it("should set interval to 1 day for first correct answer", () => {
      const result = calculateNextReview(true, 0, 2.5);

      expect(result.nextInterval).toBe(1);
      expect(result.newEaseFactor).toBe(2.6); // Increases by 0.1
    });

    it("should set interval to 6 days for second correct answer", () => {
      const result = calculateNextReview(true, 1, 2.5);

      expect(result.nextInterval).toBe(6);
      expect(result.newEaseFactor).toBe(2.6);
    });

    it("should multiply interval by ease factor for subsequent correct answers", () => {
      const result = calculateNextReview(true, 6, 2.5);

      // 6 * 2.5 = 15
      expect(result.nextInterval).toBe(15);
      expect(result.newEaseFactor).toBe(2.6);
    });

    it("should cap ease factor at 3.0", () => {
      const result = calculateNextReview(true, 10, 2.95);

      expect(result.newEaseFactor).toBe(3.0);
    });

    it("should return a valid future date", () => {
      const now = new Date();
      const result = calculateNextReview(true, 1, 2.5);

      const nextDate = new Date(result.nextReviewDate);
      expect(nextDate.getTime()).toBeGreaterThan(now.getTime());
    });
  });

  describe("incorrect answers", () => {
    it("should reset interval to 1 day for wrong answer", () => {
      const result = calculateNextReview(false, 30, 2.5);

      expect(result.nextInterval).toBe(1);
    });

    it("should decrease ease factor by 0.2", () => {
      const result = calculateNextReview(false, 10, 2.5);

      expect(result.newEaseFactor).toBe(2.3);
    });

    it("should not let ease factor go below 1.3", () => {
      const result = calculateNextReview(false, 10, 1.4);

      expect(result.newEaseFactor).toBe(1.3);
    });

    it("should reset even with high interval", () => {
      const result = calculateNextReview(false, 100, 2.5);

      expect(result.nextInterval).toBe(1);
    });
  });

  describe("edge cases", () => {
    it("should handle minimum ease factor", () => {
      const result = calculateNextReview(true, 10, 1.3);

      expect(result.nextInterval).toBe(13);
      expect(result.newEaseFactor).toBe(1.4);
    });

    it("should round interval to nearest whole number", () => {
      const result = calculateNextReview(true, 7, 2.3);

      // 7 * 2.3 = 16.1, should round to 16
      expect(result.nextInterval).toBe(16);
    });
  });
});

describe("integration scenarios", () => {
  it("should model realistic learning progression", () => {
    // Simulate a student learning a concept over time
    let interval = 0;
    let easeFactor = 2.5;

    // First review: correct
    let result = calculateNextReview(true, interval, easeFactor);
    expect(result.nextInterval).toBe(1);
    interval = result.nextInterval;
    easeFactor = result.newEaseFactor;

    // Second review: correct
    result = calculateNextReview(true, interval, easeFactor);
    expect(result.nextInterval).toBe(6);
    interval = result.nextInterval;
    easeFactor = result.newEaseFactor;

    // Third review: wrong (forgot)
    result = calculateNextReview(false, interval, easeFactor);
    expect(result.nextInterval).toBe(1); // Reset!
    expect(result.newEaseFactor).toBeLessThan(easeFactor); // Gets harder
    interval = result.nextInterval;
    easeFactor = result.newEaseFactor;

    // Fourth review: correct (relearning)
    result = calculateNextReview(true, interval, easeFactor);
    expect(result.nextInterval).toBe(6);

    // Fifth review: correct
    result = calculateNextReview(true, result.nextInterval, result.newEaseFactor);
    // Should progress more slowly due to lower ease factor
    expect(result.nextInterval).toBeLessThan(20);
  });

  it("should model mastery decay over summer break", () => {
    // Student had 80% mastery at end of school year
    const storedMastery = 0.8;
    const now = new Date();

    // After 2 months (60 days) summer break
    const twoMonthsAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
    const result = calculateEffectiveMastery(
      storedMastery,
      twoMonthsAgo.toISOString(),
      now
    );

    // Significant decay expected: 0.8 * e^(-0.1 * 60) ≈ 0.002
    expect(result.effectiveMastery).toBeLessThan(0.01);

    // This models why students need review after long breaks!
  });
});
