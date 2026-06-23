---
name: Gemini image generation (Nano Banana)
description: Correct model name, response shape, and billing constraint for Gemini image generation via the Generative Language REST API.
---

# Gemini image generation

- Model name is **`gemini-2.5-flash-image`** (NOT `gemini-2.5-flash-image-preview` — that 404s on v1beta `generateContent`). List models at `GET https://generativelanguage.googleapis.com/v1beta/models?key=...` and grep for `image` to confirm available image models (also `gemini-3-pro-image`, `gemini-3.1-flash-image`).
- Endpoint: `POST .../v1beta/models/<model>:generateContent?key=GEMINI_API_KEY`, body needs `generationConfig.responseModalities: ['Image']`. Input image goes in `parts[].inline_data{mime_type,data(base64)}`. Output image comes back at `candidates[0].content.parts[].inlineData.data` (camelCase) OR `inline_data` — check both.
- **Image output requires billing enabled** on the Google AI Studio project. A key with no credits returns HTTP **429 RESOURCE_EXHAUSTED "prepayment credits are depleted"**, even though the model name is correct. Free-tier text works but image generation does not.

**Why:** burned time on a 404 (wrong `-preview` suffix) then a 429 (no billing). Both look like code bugs but the first is the model name and the second is account billing.

**How to apply:** when an image-gen pipeline "doesn't work," distinguish 404 (model name) from 429 (billing) before touching code. Secrets are NOT exposed in the code_execution sandbox `process.env`; test Gemini calls via `bash`/`node -e` where Replit secrets are present as env vars.
