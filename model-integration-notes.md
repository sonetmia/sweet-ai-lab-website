# Local AI Processing and Groq Model Decisions

Sweet AI Lab uses browser-local ONNX inference through Transformers.js for image tools. The selected models are hosted remotely and cached by the browser, so source images are not uploaded to the application server.

| Workflow | Selected model | Reason for selection |
| --- | --- | --- |
| 2× AI upscaling | `Xenova/swin2SR-lightweight-x2-64` | A Transformers.js-compatible ONNX image-to-image model designed for lightweight 2× super-resolution. [1] |
| 4× AI upscaling | `Xenova/swin2SR-compressed-sr-x4-48` | A Transformers.js-compatible ONNX image-to-image model for 4× compressed-image super-resolution. [2] |
| Background removal | `onnx-community/BiRefNet-ONNX` | A Transformers.js-compatible high-resolution dichotomous segmentation model that returns an alpha matte for local compositing. [3] |
| Groq image metadata and prompts | `qwen/qwen3.6-27b` | Groq documents this model as accepting image and text inputs, with JSON mode; the app checks the key-visible model catalog before using it. It is currently labelled Preview, so the app blocks image work with an actionable message if vision access disappears. [4] [5] |

The Groq Llama 4 Scout identifier that previously failed is retired. Groq lists `openai/gpt-oss-120b` or `qwen/qwen3.6-27b` as replacements, depending on the workload. [6]

## References

[1]: https://huggingface.co/Xenova/swin2SR-lightweight-x2-64 "Xenova Swin2SR lightweight 2× model"
[2]: https://huggingface.co/Xenova/swin2SR-compressed-sr-x4-48 "Xenova Swin2SR compressed 4× model"
[3]: https://huggingface.co/onnx-community/BiRefNet-ONNX/blob/main/README.md "BiRefNet ONNX Transformers.js usage"
[4]: https://console.groq.com/docs/vision "Groq Images and Vision documentation"
[5]: https://console.groq.com/docs/model/qwen/qwen3.6-27b "Groq Qwen 3.6 27B model documentation"
[6]: https://console.groq.com/docs/deprecations "Groq model deprecation documentation"
