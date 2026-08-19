# Deployment Guide

## Recommended production setup

This project is prepared for **Vercel** as a static React build with two serverless API concerns: the secure paid generation route and the administrator bootstrap route. The client speaks directly to Supabase for Google authentication, profile data, credit RPCs, payment requests and administrative data. Vercel only receives authenticated requests that need a server-only secret, namely `OPENROUTER_API_KEY` and `SUPABASE_SERVICE_ROLE_KEY`.

| Layer | Production service | Responsibility |
|---|---|---|
| Public app | Vercel | React frontend, SPA navigation, and serverless `/api/*` handlers |
| Authentication and data | Supabase | Google OAuth, profiles, credit ledger, payment requests, RLS policies, and RPC functions |
| Paid AI path | OpenRouter, called through Vercel | Holds the provider key server-side and debits credits only after a usable AI result |
| Local background removal | User browser | Transformers.js v3, ONNX/WASM, `briaai/RMBG-1.4`, alpha compositing and PNG output |

## Vercel deployment sequence

Create a new Vercel project from the repository and allow Vercel to run `pnpm build`. The repository already contains `vercel.json`, which publishes `dist/public` and preserves the single-page app route fallback. The `api/[...path].ts` function responds to `/api/studio` and `/api/admin/bootstrap`.

> The app can also be hosted directly through Manus. Built-in hosting is the simplest option for this project because it already manages the full-stack runtime. Vercel remains appropriate when you want a Vercel-owned deployment and domain configuration, but test its serverless API routes after each deploy.

Set the following production environment variables in **Vercel Project Settings → Environment Variables**. Do not place any server-only value in a `VITE_` variable other than Supabase's public URL and anonymous key.

| Variable | Where it is used | Visibility |
|---|---|---|
| `VITE_SUPABASE_URL` | Browser and server Supabase clients | Public browser configuration |
| `VITE_SUPABASE_ANON_KEY` | Browser authentication, RLS-protected reads, and RPC calls | Public browser configuration |
| `SUPABASE_SERVICE_ROLE_KEY` | Vercel serverless paid-generation authentication and admin bootstrap | Server-only secret |
| `OPENROUTER_API_KEY` | Vercel serverless paid generation | Server-only secret |
| `ADMIN_EMAIL` | One-time server-side promotion of your intended administrator account | Server-only configuration |
| `VITE_BKASH_RECEIVER` | Authenticated manual upgrade screen | Client-visible business contact configuration |
| `VITE_WHATSAPP_SUPPORT_NUMBER` | Authenticated WhatsApp verification handoff | Client-visible business contact configuration |

## Supabase OAuth checklist

In **Supabase Dashboard → Authentication → URL Configuration**, add the final Vercel URL to the Site URL and to Additional Redirect URLs. Add your custom domain to both places once it is connected. In **Authentication → Providers → Google**, enable Google and enter the Google OAuth client ID and client secret. The Google Cloud OAuth client must use Supabase's callback URL shown in the provider configuration.

The first sign-in from the email configured in `ADMIN_EMAIL` triggers the server-side administrator bootstrap. Open the account menu in the Studio and choose **Administrator console** to confirm the role is available.

## Domain connection

You can launch with the generated `your-project.vercel.app` address. A `.com` is **not technically required**. To connect a custom domain later, add it under **Vercel Project Settings → Domains**, then create the DNS records Vercel specifies at the domain registrar. Update the Supabase redirect URL configuration immediately afterward.

| Milestone | Custom domain needed? | Notes |
|---|---:|---|
| Functional testing | No | Use the Vercel preview or production subdomain. |
| Private beta | No | The Vercel subdomain is sufficient. |
| Public brand launch | Recommended | A custom domain improves brand recall and should be configured in Supabase OAuth redirects. |

## Acceptance test after deploy

Sign in with Google, confirm the free 10-credit profile is created, upload one harmless test image, and test one paid API request. Then test a Free API request with a disposable key, background removal, CSV export, a bKash request and administrator approval. Never test the payment flow with a fabricated transaction ID; use only a real or deliberately cancelled internal test procedure.
