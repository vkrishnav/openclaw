import { describe, expect, it } from "vitest";
import {
  DEFAULT_CLASSIFIER_MODEL,
  DEFAULT_CLASSIFIER_PROVIDER,
  DEFAULT_CLASSIFIER_TIMEOUT_MS,
  DEFAULT_TIERS,
  resolveConfig,
} from "./config.js";

describe("resolveConfig", () => {
  it("returns defaults when called with undefined", () => {
    const cfg = resolveConfig(undefined);
    expect(cfg.enabled).toBe(true);
    expect(cfg.classifierProvider).toBe(DEFAULT_CLASSIFIER_PROVIDER);
    expect(cfg.classifierModel).toBe(DEFAULT_CLASSIFIER_MODEL);
    expect(cfg.classifierTimeoutMs).toBe(DEFAULT_CLASSIFIER_TIMEOUT_MS);
    expect(cfg.tiers).toEqual(DEFAULT_TIERS);
  });

  it("returns defaults when called with empty object", () => {
    const cfg = resolveConfig({});
    expect(cfg.enabled).toBe(true);
    expect(cfg.tiers.simple).toEqual(DEFAULT_TIERS.simple);
  });

  it("respects enabled: false", () => {
    const cfg = resolveConfig({ enabled: false });
    expect(cfg.enabled).toBe(false);
  });

  it("overrides classifier provider and model", () => {
    const cfg = resolveConfig({
      classifierProvider: "nvidia",
      classifierModel: "nvidia/mistral-nemo-minitron-8b-8k-instruct",
    });
    expect(cfg.classifierProvider).toBe("nvidia");
    expect(cfg.classifierModel).toBe("nvidia/mistral-nemo-minitron-8b-8k-instruct");
  });

  it("overrides classifierTimeoutMs", () => {
    const cfg = resolveConfig({ classifierTimeoutMs: 5000 });
    expect(cfg.classifierTimeoutMs).toBe(5000);
  });

  it("ignores invalid classifierTimeoutMs (zero)", () => {
    const cfg = resolveConfig({ classifierTimeoutMs: 0 });
    expect(cfg.classifierTimeoutMs).toBe(DEFAULT_CLASSIFIER_TIMEOUT_MS);
  });

  it("overrides a single tier", () => {
    const cfg = resolveConfig({
      tiers: {
        complex: { provider: "nvidia", model: "nvidia/llama-3.1-nemotron-70b-instruct" },
      },
    });
    expect(cfg.tiers.complex).toEqual({
      provider: "nvidia",
      model: "nvidia/llama-3.1-nemotron-70b-instruct",
    });
    // Other tiers remain at defaults.
    expect(cfg.tiers.simple).toEqual(DEFAULT_TIERS.simple);
    expect(cfg.tiers.medium).toEqual(DEFAULT_TIERS.medium);
  });

  it("overrides all tiers (NemoClaw-style config)", () => {
    const nemotronCfg = {
      tiers: {
        simple: { provider: "nvidia", model: "nvidia/mistral-nemo-minitron-8b-8k-instruct" },
        medium: { provider: "nvidia", model: "meta/llama-3.3-70b-instruct" },
        complex: { provider: "nvidia", model: "nvidia/llama-3.1-nemotron-70b-instruct" },
        code: { provider: "nvidia", model: "meta/llama-3.3-70b-instruct" },
        creative: { provider: "nvidia", model: "nvidia/llama-3.1-nemotron-70b-instruct" },
      },
    };
    const cfg = resolveConfig(nemotronCfg);
    for (const [tier, entry] of Object.entries(nemotronCfg.tiers)) {
      expect(cfg.tiers[tier as keyof typeof cfg.tiers]).toEqual(entry);
    }
  });

  it("ignores tier override with missing provider or model", () => {
    const cfg = resolveConfig({
      tiers: { medium: { provider: "", model: "claude-sonnet-4-6" } },
    });
    expect(cfg.tiers.medium).toEqual(DEFAULT_TIERS.medium);
  });

  it("ignores whitespace-only classifier strings", () => {
    const cfg = resolveConfig({ classifierProvider: "   ", classifierModel: "\t" });
    expect(cfg.classifierProvider).toBe(DEFAULT_CLASSIFIER_PROVIDER);
    expect(cfg.classifierModel).toBe(DEFAULT_CLASSIFIER_MODEL);
  });
});
