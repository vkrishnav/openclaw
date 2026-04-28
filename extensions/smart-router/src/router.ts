import type { ComplexityTier, ModelEntry, TierConfig } from "./config.js";

export type RouteResult = {
  tier: ComplexityTier;
  provider: string;
  model: string;
};

export function routeToModel(tier: ComplexityTier, tiers: TierConfig): RouteResult {
  const entry: ModelEntry = tiers[tier];
  return { tier, provider: entry.provider, model: entry.model };
}

export function describeRoute(result: RouteResult): string {
  return `${result.tier} → ${result.provider}/${result.model}`;
}
