# Production Blank-Screen Investigation

## Initial observation

- On 2026-08-19, `https://sweet-ai-lab-website.vercel.app/` returned the expected Sweet AI Lab document title but displayed an otherwise blank page.
- The page contained no detected interactive elements.
- The browser console contained no captured client-side errors at the time of inspection.

## Next investigation focus

- Inspect the Vercel build output, static asset paths, and serverless routing configuration.
- Confirm that the production HTML references a JavaScript bundle that is successfully served and executed.

## Asset inspection update

The production document references a Vite JavaScript bundle and stylesheet under `/assets/`, but the React root remains empty after load. It also includes the unresolved literal asset path `/%VITE_ANALYTICS_ENDPOINT%/umami`, which indicates an analytics placeholder was deployed without a configured build-time value. A bulk asset fetch could not complete because that malformed analytics request failed; the next fix will remove the unresolved script rather than attempt to use a missing analytics endpoint.

## Resolution verification

After the Vercel Production environment received the Supabase browser variables and a fresh deployment completed, the live site rendered the full Sweet AI Lab landing page. The React root contained mounted child elements, and the deployed Vite bundle changed to `index-oVvmu5EL.js`, confirming that the stale `index-BHYExqor.js` deployment was no longer active.

## Feature update verification

The later production deployment successfully rendered the non-white default theme, calligraphic S brand mark, Free plan balance of 500 credits, and Pro price of ৳200. The production landing page no longer showed the previous decorative star/orbit treatment. Authenticated Image Upscaler validation remains a user-account test because the tool is protected by Supabase login and performs a real credit deduction.

## Dedicated bulk Image Upscaler deployment

GitHub commit `621dfdb` was pushed to the `main` branch and the production landing page subsequently loaded without a blank-screen or asset-loading regression. The deployed page loaded the Vercel JavaScript bundle `index-bECNpGwQ.js`. The protected `/image-upscaler` route is intentionally unavailable without a Supabase session, so authenticated bulk upload, real credit charging, and ZIP download remain an account-holder acceptance check.

## Local AI processing deployment

GitHub commit `4b0eb7d` deployed without a public rendering regression. The public hero now displays the concise `Create. Prepare. Submit.` message, and the production document loaded the newer Vercel JavaScript bundle `index-BMnRk1O0.js`. Logged-in validation remains required for the newly downloaded AI model workers, live Groq-key behavior, and credit-backed image processing.

## Multi-provider fallback deployment

GitHub commit `e0d1bc0` deployed without a public rendering regression. The production bundle `index-5989a5-e.js` contains the `Together AI`, `SambaNova`, and `Hugging Face` provider labels plus the configured-provider fallback message, confirming that the release source is live. It adds automatic compatible-model selection for own-key providers with a model catalog, clearly labels documented defaults for catalog-less providers, and retries another configured provider when a quota or rate-limit response occurs. Logged-in production validation with the user’s actual keys remains required because provider quotas, account access, and CORS policies are external to the application.

## Creator-tool stability validation

The hosted OpenRouter credential returned `402 Insufficient credits` for a minimal image completion, explaining why the previous default paid path could not generate metadata or prompts. Studio now defaults to the user’s own-key path. In a browser against the local build, both lazy worker modules constructed successfully and the high-quality canvas fallback produced a valid 24 × 16 PNG from a 12 × 8 source. Logged-in production validation remains required for a real image background-removal run and an actual configured own-key generation request.

GitHub commit `9aa434c` deployed without a public rendering regression and is served by production bundle `index-DSovdaBQ.js`. Function names are minified in the deployed JavaScript, but the bundle includes the preserved `AI acceleration is unavailable in this browser`, `simple-background fallback`, and `Own key` recovery/interface text. This confirms the stability release is live; a logged-in production run remains required for real image and own-key behavior.

## Oversized-image Free API recovery

GitHub commit `c1f809d` deployed without a public rendering regression and is served by production bundle `index-DtxEcKAH.js`. The live bundle includes the safe-image-payload and compact-image recovery text, confirming that browser-side vision-payload normalization and the 413 retry route are live. A logged-in request using the user’s actual Groq key and the previously oversized image remains required for final confirmation.

## Experience and Paid API runtime recovery

The public experience release displays the requested simple copy, 200-credit Free plan, contact control, bKash/WhatsApp details, and browser title without the removed tagline. The Contact panel was opened in production and verified to expose WhatsApp `01797953059`, `md.sonet.mia01@gmail.com`, and `mdsonetmia.vercel.app`.

The original Vercel TypeScript serverless functions failed before authentication with `FUNCTION_INVOCATION_FAILED`. A dependency-free JavaScript health canary returned `200 {"ok":true,"service":"sweet-ai-health"}`, confirming the platform function runtime. The Paid API was then migrated to a direct JavaScript handler; an unauthenticated production POST to `/api/studio` now returns the expected JSON `401 {"error":"not_authenticated"}` rather than plain-text server failure. A logged-in paid generation remains required for final provider and credit-deduction validation.

## Payload and Billing investigation

A logged-in Paid API request with an oversized image reached Vercel but was rejected before the handler with `413 FUNCTION_PAYLOAD_TOO_LARGE`. The client now prepares a compact image before every Paid API request and performs one materially smaller retry only after a 413 response. The production Billing route previously failed during render with `TypeError: Cannot read properties of undefined (reading 'replace')`, traced to an undefined WhatsApp configuration being passed to the phone-number formatter. Billing now uses safe configured-value fallbacks and guarded payment submission. A local unauthenticated navigation to the rebuilt Billing route redirects to the landing page without the earlier error screen.
