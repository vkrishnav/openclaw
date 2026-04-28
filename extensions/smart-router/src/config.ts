export type ComplexityTier = "simple" | "medium" | "complex" | "code" | "creative";

export const COMPLEXITY_TIERS: ReadonlyArray<ComplexityTier> = [
  "simple",
  "medium",
  "complex",
  "code",
  "creative",
];

export type ModelEntry = {
  provider: string;
  model: string;
};

export type TierConfig = Record<ComplexityTier, ModelEntry>;

export type SmartRouterPluginConfig = {
  enabled?: boolean;
  classifierProvider?: string;
  classifierModel?: string;
  classifierTimeoutMs?: number;
  tiers?: Partial<Record<ComplexityTier, Partial<ModelEntry>>>;
};

export type ResolvedConfig = {
  enabled: boolean;
  classifierProvider: string;
  classifierModel: string;
  classifierTimeoutMs: number;
  tiers: TierConfig;
};

export const DEFAULT_CLASSIFIER_PROVIDER = "anthropic";
export const DEFAULT_CLASSIFIER_MODEL = "claude-haiku-4-5";
export const DEFAULT_CLASSIFIER_TIMEOUT_MS = 8000;

// Sane defaults: haiku for simple, sonnet for medium/code, opus for complex/creative.
// NemoClaw users can override these to nvidia/nemotron-* per tier.
export const DEFAULT_TIERS: TierConfig = {
  simple: { provider: "anthropic", model: "claude-haiku-4-5" },
  medium: { provider: "anthropic", model: "claude-sonnet-4-6" },
  complex: { provider: "anthropic", model: "claude-opus-4-6" },
  code: { provider: "anthropic", model: "claude-sonnet-4-6" },
  creative: { provider: "anthropic", model: "claude-opus-4-6" },
};

export function resolveConfig(raw: Record<string, unknown> | undefined): ResolvedConfig {
  const cfg = (raw ?? {}) as SmartRouterPluginConfig;

  const tiers: TierConfig = { ...DEFAULT_TIERS };
  if (cfg.tiers && typeof cfg.tiers === "object") {
    for (const tier of COMPLEXITY_TIERS) {
      const override = cfg.tiers[tier];
      if (override && typeof override === "object") {
        const provider = typeof override.provider === "string" ? override.provider.trim() : "";
        const model = typeof override.model === "string" ? override.model.trim() : "";
        if (provider && model) {
          tiers[tier] = { provider, model };
        }
      }
    }
  }

  return {
    enabled: cfg.enabled !== false,
    classifierProvider:
      typeof cfg.classifierProvider === "string" && cfg.classifierProvider.trim()
        ? cfg.classifierProvider.trim()
        : DEFAULT_CLASSIFIER_PROVIDER,
    classifierModel:
      typeof cfg.classifierModel === "string" && cfg.classifierModel.trim()
        ? cfg.classifierModel.trim()
        : DEFAULT_CLASSIFIER_MODEL,
    classifierTimeoutMs:
      typeof cfg.classifierTimeoutMs === "number" && cfg.classifierTimeoutMs > 0
        ? cfg.classifierTimeoutMs
        : DEFAULT_CLASSIFIER_TIMEOUT_MS,
    tiers,
  };
}
