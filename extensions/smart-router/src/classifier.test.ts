import { describe, expect, it, vi } from "vitest";
import { classifyComplexity, parseTier } from "./classifier.js";
import type { ComplexityTier } from "./config.js";

// ---------------------------------------------------------------------------
// parseTier — pure unit tests (no mocking needed)
// ---------------------------------------------------------------------------

describe("parseTier", () => {
  it.each<[string, ComplexityTier]>([
    ["simple", "simple"],
    ["medium", "medium"],
    ["complex", "complex"],
    ["code", "code"],
    ["creative", "creative"],
    ["SIMPLE", "simple"],
    ["  Code  ", "code"],
    ["  CREATIVE\n", "creative"],
  ])("parses exact tier %s → %s", (input, expected) => {
    expect(parseTier(input)).toBe(expected);
  });

  it.each<[string, ComplexityTier]>([
    ["This is a simple request.", "simple"],
    ["Tier: complex", "complex"],
    ["The answer is: code", "code"],
  ])("fuzzy-matches tier word in longer response %s → %s", (input, expected) => {
    expect(parseTier(input)).toBe(expected);
  });

  it("returns null for unrecognized input", () => {
    expect(parseTier("unknown")).toBeNull();
    expect(parseTier("")).toBeNull();
    expect(parseTier("   ")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// classifyComplexity — tests using injectable runner override
// ---------------------------------------------------------------------------

const BASE_PARAMS = {
  prompt: "Hello, world!",
  provider: "anthropic",
  model: "claude-haiku-4-5",
  timeoutMs: 5000,
  config: {},
  workspaceDir: "/tmp",
};

describe("classifyComplexity", () => {
  it("returns the parsed tier from the classifier response", async () => {
    const runner = vi.fn().mockResolvedValue({
      payloads: [{ text: "simple", isError: false }],
    });
    const result = await classifyComplexity({ ...BASE_PARAMS, _runEmbeddedOverride: runner });
    expect(result).toBe("simple");
    expect(runner).toHaveBeenCalledOnce();
  });

  it("falls back to 'medium' when classifier returns garbage", async () => {
    const runner = vi.fn().mockResolvedValue({
      payloads: [{ text: "¯\\_(ツ)_/¯", isError: false }],
    });
    const result = await classifyComplexity({ ...BASE_PARAMS, _runEmbeddedOverride: runner });
    expect(result).toBe("medium");
  });

  it("falls back to 'medium' when runner throws", async () => {
    const runner = vi.fn().mockRejectedValue(new Error("network error"));
    const result = await classifyComplexity({ ...BASE_PARAMS, _runEmbeddedOverride: runner });
    expect(result).toBe("medium");
  });

  it("returns 'medium' immediately when classification is already active (recursion guard)", async () => {
    let resolveOuter!: (v: ComplexityTier) => void;
    const outerPromise = new Promise<ComplexityTier>((res) => (resolveOuter = res));

    const runner = vi.fn().mockImplementation(async () => {
      // Simulate re-entrant call during the outer classification.
      const innerResult = await classifyComplexity({
        ...BASE_PARAMS,
        prompt: "inner call",
        _runEmbeddedOverride: vi.fn(),
      });
      resolveOuter(innerResult);
      return { payloads: [{ text: "complex", isError: false }] };
    });

    const outerResult = await classifyComplexity({ ...BASE_PARAMS, _runEmbeddedOverride: runner });
    const innerResult = await outerPromise;

    expect(outerResult).toBe("complex");
    expect(innerResult).toBe("medium"); // recursion guard kicks in
  });

  it("passes the prompt with the classifier prefix to the runner", async () => {
    const runner = vi.fn().mockResolvedValue({
      payloads: [{ text: "code", isError: false }],
    });
    await classifyComplexity({
      ...BASE_PARAMS,
      prompt: "write a function",
      _runEmbeddedOverride: runner,
    });
    const calledPrompt = runner.mock.calls[0]?.[0]?.prompt as string;
    expect(calledPrompt).toContain("write a function");
    expect(calledPrompt).toContain("complexity classifier");
  });
});
