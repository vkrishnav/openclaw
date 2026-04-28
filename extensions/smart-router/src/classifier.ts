import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { ComplexityTier } from "./config.js";
import { COMPLEXITY_TIERS } from "./config.js";

// Prepend this context to the user prompt so the model knows what to do.
const CLASSIFIER_PREFIX = `You are a request complexity classifier. Classify the following user message into exactly one tier:
- simple: greetings, single factual lookups, yes/no questions, tiny math
- medium: explanations, summaries, multi-step but well-defined tasks
- complex: deep reasoning, analysis, ambiguous or open-ended multi-step problems
- code: anything that involves writing, debugging, reading, or explaining code
- creative: writing, brainstorming, storytelling, poetry, any creative generation

Reply with ONLY the lowercase tier name. No punctuation, no other text.

USER MESSAGE:
`;

type RunEmbeddedPiAgentFn = (params: Record<string, unknown>) => Promise<unknown>;

// Cache the import to avoid repeated dynamic lookups.
let _runEmbedded: RunEmbeddedPiAgentFn | null = null;

async function loadRunEmbedded(): Promise<RunEmbeddedPiAgentFn> {
  if (_runEmbedded) return _runEmbedded;
  // Works both from source checkout and from built install.
  const mod = await import("../../../src/agents/pi-embedded-runner.js");
  if (typeof mod.runEmbeddedPiAgent !== "function") {
    throw new Error("runEmbeddedPiAgent is not available");
  }
  _runEmbedded = mod.runEmbeddedPiAgent as RunEmbeddedPiAgentFn;
  return _runEmbedded;
}

function extractText(result: unknown): string {
  if (!result || typeof result !== "object") return "";
  const payloads = (result as { payloads?: unknown }).payloads;
  if (!Array.isArray(payloads)) return "";
  return payloads
    .filter(
      (p): p is { text: string; isError?: boolean } =>
        typeof (p as { text?: unknown }).text === "string" && !(p as { isError?: unknown }).isError,
    )
    .map((p) => p.text)
    .join("")
    .trim();
}

export function parseTier(raw: string): ComplexityTier | null {
  const lower = raw.trim().toLowerCase();
  // Exact match first.
  if ((COMPLEXITY_TIERS as ReadonlyArray<string>).includes(lower)) {
    return lower as ComplexityTier;
  }
  // Fuzzy: find the first tier word anywhere in the response.
  for (const tier of COMPLEXITY_TIERS) {
    if (lower.includes(tier)) {
      return tier;
    }
  }
  return null;
}

export type ClassifierParams = {
  prompt: string;
  provider: string;
  model: string;
  timeoutMs: number;
  /** OpenClaw config object passed through to runEmbeddedPiAgent. */
  config: unknown;
  workspaceDir?: string;
  /** Optional override for tests — skips the dynamic import. */
  _runEmbeddedOverride?: RunEmbeddedPiAgentFn;
};

// Prevent recursive classification: if the embedded classifier agent fires
// before_model_resolve again, we skip routing and use the tier's default.
let _classificationActive = false;

export function isClassificationActive(): boolean {
  return _classificationActive;
}

export async function classifyComplexity(params: ClassifierParams): Promise<ComplexityTier> {
  if (_classificationActive) {
    // Called re-entrantly from within the classifier run itself — skip.
    return "medium";
  }
  _classificationActive = true;

  let tmpDir: string | null = null;
  try {
    const runEmbedded = params._runEmbeddedOverride ?? (await loadRunEmbedded());
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "openclaw-smart-router-"));
    const sessionId = `smart-router-classify-${Date.now()}`;
    const sessionFile = path.join(tmpDir, "session.json");

    const result = await runEmbedded({
      sessionId,
      sessionFile,
      workspaceDir: params.workspaceDir ?? process.cwd(),
      config: params.config,
      prompt: `${CLASSIFIER_PREFIX}${params.prompt}`,
      timeoutMs: params.timeoutMs,
      runId: sessionId,
      provider: params.provider,
      model: params.model,
      authProfileIdSource: "auto",
      disableTools: true,
      streamParams: { maxTokens: 16 },
    });

    const text = extractText(result);
    return parseTier(text) ?? "medium";
  } catch {
    return "medium";
  } finally {
    _classificationActive = false;
    if (tmpDir) {
      await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => undefined);
    }
  }
}
