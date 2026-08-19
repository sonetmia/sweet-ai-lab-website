# Sweet AI Lab by SONET

> **AI-Powered Tools for Creators**

Sweet AI Lab is a full-stack workspace for stock-image creators. It provides platform-aware metadata generation, image-to-prompt generation, browser-local background removal, user-managed Free API mode, paid credit workflows, manual bKash verification, and administrator controls.

## Core capabilities

| Area | Included functionality |
|---|---|
| Creator studio | Metadata Generator, Image-to-Prompt, platform settings, upload queue, per-file results, CSV and text exports |
| AI access | Secure server-side paid generation and memory-only Free API key rotation for Gemini, Groq, Mistral, OpenAI, and OpenRouter |
| Background removal | Browser-local Transformers.js v3, ONNX/WASM, and `briaai/RMBG-1.4` processing in a Web Worker |
| Credits and plans | Supabase credit ledger with `Free`, `Pro`, and `Max` plans |
| Payments and administration | Manual bKash request flow, WhatsApp handoff, payment approval, plan activation, and credit top-ups |
| Authentication | Supabase Auth with Google OAuth and role-based administrator access |

## Local development

Install dependencies and start the application with:

```bash
pnpm install
pnpm dev
```

Run checks before a release:

```bash
pnpm test
pnpm check
pnpm build
```

## Required configuration

Create production environment variables in Vercel or your hosting provider. Never commit `.env` files, service-role keys, or provider API keys.

| Variable | Purpose |
|---|---|
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Public Supabase client key |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only Supabase administration key |
| `OPENROUTER_API_KEY` | Server-only paid AI provider key |
| `ADMIN_EMAIL` | Initial administrator Google account email |
| `VITE_BKASH_RECEIVER` | bKash receiver number for manual verification |
| `VITE_WHATSAPP_SUPPORT_NUMBER` | WhatsApp number for payment handoff |

## Deploying with Vercel

Import this repository into Vercel, add the required environment variables, and deploy. After Vercel provides the first production URL, add that URL to Supabase Auth URL Configuration and to the Google OAuth redirect configuration. See [`DEPLOYMENT.md`](./DEPLOYMENT.md) for the complete production checklist.

## License

All rights reserved. © 2026 Sweet AI Lab by SONET.
