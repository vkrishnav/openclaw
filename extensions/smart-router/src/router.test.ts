import { describe, expect, it } from "vitest";
import type { ComplexityTier } from "./config.js";
import { DEFAULT_TIERS } from "./config.js";
import { describeRoute, routeToModel } from "./router.js";

describe("routeToModel", () => {
  it.each<ComplexityTier>(["simple", "medium", "complex", "code", "creative"])(
    "routes tier %s to the configured model",
    (tier) => {
      const result = routeToModel(tier, DEFAULT_TIERS);
      expect(result.tier).toBe(tier);
      expect(result.provider).toBe(DEFAULT_TIERS[tier].provider);
      expect(result.model).toBe(DEFAULT_TIERS[tier].model);
    },
  );

  it("routes to a custom Nemotron tier config", () => {
    const tiers = {
      ...DEFAULT_TIERS,
      complex: { provider: "nvidia", model: "nvidia/llama-3.1-nemotron-70b-instruct" },
    };
    const result = routeToModel("complex", tiers);
    expect(result).toEqual({
      tier: "complex",
      provider: "nvidia",
      model: "nvidia/llama-3.1-nemotron-70b-instruct",
    });
  });

  it("routes 'code' to a code-specialized model when configured", () => {
    const tiers = {
      ...DEFAULT_TIERS,
      code: { provider: "nvidia", model: "meta/llama-3.3-70b-instruct" },
    };
    const result = routeToModel("code", tiers);
    expect(result.provider).toBe("nvidia");
    expect(result.model).toBe("meta/llama-3.3-70b-instruct");
  });
});

describe("describeRoute", () => {
  it("formats route as 'tier → provider/model'", () => {
    const result = routeToModel("complex", DEFAULT_TIERS);
    expect(describeRoute(result)).toBe(
      `complex → ${DEFAULT_TIERS.complex.provider}/${DEFAULT_TIERS.complex.model}`,
    );
  });

  it("works for custom Nemotron route", () => {
    const route = {
      tier: "complex" as ComplexityTier,
      provider: "nvidia",
      model: "nvidia/llama-3.1-nemotron-70b-instruct",
    };
    expect(describeRoute(route)).toBe("complex → nvidia/nvidia/llama-3.1-nemotron-70b-instruct");
  });
});
