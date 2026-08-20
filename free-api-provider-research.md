# Free API Provider Research Notes

The Free API flow must be treated as **bring-your-own-key** rather than a promise of unlimited no-cost usage. A provider may offer a trial or developer quota, but its actual availability, credit balance, and rate limits are controlled by the user’s provider account.

| Provider candidate | Verified integration finding | Product decision |
| --- | --- | --- |
| Together AI | The official vision guide uses OpenAI-style chat-completion messages that mix `text` and `image_url` parts, and returns text from `choices[0].message.content`. [1] | Add as an optional provider with model-catalog discovery, but do not label it as permanently free. |
| Hugging Face Inference Providers | The documented service routes across several inference providers and supports provider selection policies. [2] | Add as an optional provider with its own token and model-catalog discovery; surface the account’s actual quota rather than claiming an unlimited free tier. |
| SambaNova | The official documentation specifies `https://api.sambanova.ai/v1/chat/completions` and uses OpenAI-style message content with text plus a base64 `image_url`; its example model is `gemma-4-31B-it`. [3] [4] | Add as an optional provider with automatic selection from its documented vision-capable candidates. |
| Groq | Groq’s Qwen vision model is usable when the user’s account quota permits it, but rate-limit responses must not be represented as a key-validation failure. [3] | Preserve it as a provider, preflight its model visibility, and route rate-limit failures to an available configured fallback. |

## References

[1]: https://docs.together.ai/docs/inference/vision/overview "Together AI: Use image inputs"
[2]: https://huggingface.co/docs/inference-providers/index "Hugging Face: Inference Providers"
[3]: https://docs.sambanova.ai/docs/en/features/vision "SambaNova: Vision and Multimodal Guide"
[4]: https://docs.sambanova.ai/docs/en/get-started/api-keys-urls "SambaNova: API Keys and URLs"
[5]: https://console.groq.com/docs/vision "Groq: Images and Vision"
