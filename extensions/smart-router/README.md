# @openclaw/smart-router

Intercepts every incoming message, classifies its complexity with a fast cheap model, then routes the actual conversation to the best model for that tier. Works with any provider configured in OpenClaw — Anthropic, Google, OpenAI, NVIDIA Nemotron (NemoClaw), Ollama, and others.

## How it works

1. **Classify** — Sends a truncated version of the user prompt to the configured classifier model (defaults to `claude-haiku-4-5`) with a short system prompt asking for a single-word complexity label.
2. **Route** — Maps the label to a `provider/model` pair from the tier config.
3. **Override** — Returns the chosen provider and model via the `before_model_resolve` plugin hook, transparently replacing the default model for that run.

Classifier calls are logged at `debug` level only and are never surfaced to the user.

### Complexity tiers

| Tier       | When                                            | Default model                 |
| ---------- | ----------------------------------------------- | ----------------------------- |
| `simple`   | Greetings, single-fact lookups, yes/no          | `anthropic/claude-haiku-4-5`  |
| `medium`   | Explanations, summaries, clear multi-step       | `anthropic/claude-sonnet-4-6` |
| `complex`  | Deep reasoning, analysis, ambiguous tasks       | `anthropic/claude-opus-4-6`   |
| `code`     | Writing, debugging, reading, or explaining code | `anthropic/claude-sonnet-4-6` |
| `creative` | Writing, brainstorming, storytelling, poetry    | `anthropic/claude-opus-4-6`   |

## Enabling the plugin

Add to your OpenClaw config (`openclaw config set` or edit `~/.openclaw/config.json`):

```json
{
  "plugins": {
    "smart-router": {
      "enabled": true
    }
  }
}
```

## Configuration options

All fields are optional. Unset fields fall back to the defaults shown above.

```json
{
  "plugins": {
    "smart-router": {
      "enabled": true,
      "classifierProvider": "anthropic",
      "classifierModel": "claude-haiku-4-5",
      "classifierTimeoutMs": 8000,
      "tiers": {
        "simple": { "provider": "anthropic", "model": "claude-haiku-4-5" },
        "medium": { "provider": "anthropic", "model": "claude-sonnet-4-6" },
        "complex": { "provider": "anthropic", "model": "claude-opus-4-6" },
        "code": { "provider": "anthropic", "model": "claude-sonnet-4-6" },
        "creative": { "provider": "anthropic", "model": "claude-opus-4-6" }
      }
    }
  }
}
```

### NemoClaw / NVIDIA Nemotron example

Use the NVIDIA provider (requires `NVIDIA_API_KEY` in your environment):

```json
{
  "plugins": {
    "smart-router": {
      "classifierProvider": "nvidia",
      "classifierModel": "nvidia/mistral-nemo-minitron-8b-8k-instruct",
      "tiers": {
        "simple": { "provider": "nvidia", "model": "nvidia/mistral-nemo-minitron-8b-8k-instruct" },
        "medium": { "provider": "nvidia", "model": "meta/llama-3.3-70b-instruct" },
        "complex": { "provider": "nvidia", "model": "nvidia/llama-3.1-nemotron-70b-instruct" },
        "code": { "provider": "nvidia", "model": "meta/llama-3.3-70b-instruct" },
        "creative": { "provider": "nvidia", "model": "nvidia/llama-3.1-nemotron-70b-instruct" }
      }
    }
  }
}
```

### Mixed provider example

Different tiers can use different providers:

```json
{
  "plugins": {
    "smart-router": {
      "tiers": {
        "simple": { "provider": "anthropic", "model": "claude-haiku-4-5" },
        "medium": { "provider": "google", "model": "gemini-2.0-flash" },
        "complex": { "provider": "anthropic", "model": "claude-opus-4-6" },
        "code": { "provider": "anthropic", "model": "claude-sonnet-4-6" },
        "creative": { "provider": "google", "model": "gemini-2.5-pro" }
      }
    }
  }
}
```

## Manual setup notes

- **API keys** — Each provider you use in the tier config must have credentials configured. Run `openclaw login` or set the appropriate env var (e.g. `NVIDIA_API_KEY`, `ANTHROPIC_API_KEY`).
- **Classifier cost** — Every message incurs one cheap classifier call (< 16 tokens output). With haiku or Minitron-8B this costs fractions of a cent.
- **Recursion guard** — The classifier call itself will not be re-routed; the plugin detects and skips recursive invocations automatically.
- **Disable routing** — Set `"enabled": false` in the plugin config or remove the plugin entry entirely.
