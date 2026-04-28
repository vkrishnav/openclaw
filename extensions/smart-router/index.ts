import type { OpenClawPluginApi } from "../../src/plugins/types.js";
import { classifyComplexity, isClassificationActive } from "./src/classifier.js";
import { resolveConfig } from "./src/config.js";
import { describeRoute, routeToModel } from "./src/router.js";

export default function register(api: OpenClawPluginApi) {
  const cfg = resolveConfig(api.pluginConfig);

  if (!cfg.enabled) {
    api.logger.info("Smart Router: disabled via config, skipping registration");
    return;
  }

  api.on("before_model_resolve", async (event, ctx) => {
    // Skip if this is a nested call from within the classifier itself.
    if (isClassificationActive()) return;

    const prompt = event.prompt?.trim();
    if (!prompt) return;

    try {
      const tier = await classifyComplexity({
        prompt,
        provider: cfg.classifierProvider,
        model: cfg.classifierModel,
        timeoutMs: cfg.classifierTimeoutMs,
        config: api.config,
        workspaceDir: ctx.workspaceDir,
      });

      const route = routeToModel(tier, cfg.tiers);
      api.logger.debug?.(
        `Smart Router: ${describeRoute(route)} (session=${ctx.sessionKey ?? "?"})`,
      );

      return { providerOverride: route.provider, modelOverride: route.model };
    } catch (err) {
      api.logger.warn(`Smart Router: routing failed, using default model. ${String(err)}`);
    }
  });
}
