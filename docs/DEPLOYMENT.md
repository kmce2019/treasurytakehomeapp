# Deployment and portability

## Current demo

https://label-lens-kevin-gardner.kmce2025.chatgpt.site

The demo is configured with public access for assessment reviewers. It has no reviewer login or API-key setup. Source is independently available at https://github.com/kmce2019/treasurytakehomeapp.

## Any static host

Run `npm ci && npm run build`, then publish **the contents of `dist/`**. Serve over HTTPS with `.js` as JavaScript and `.wasm` as `application/wasm`. Leave `.traineddata.gz` as a gzip *file*, not a server-predecompressed asset: do not assign `Content-Encoding: gzip` merely because its filename ends in `.gz`.

The build includes the OCR library, worker, WebAssembly variants, English model, frontend and sample data. No backend or environment secret is needed. Relative asset URLs also support a subdirectory deployment such as GitHub Pages. All vendor files must remain in their generated paths. Some assets are several MB; allow those downloads.

The `.openai/hosting.json` file records the existing Sites project identity; it is not required for independent hosting. Do not create a second Sites project with the same identity.

## Cloudflare Pages alternative

1. Connect this repository to Cloudflare Pages.
2. Build command: `npm run build` (Cloudflare installs dependencies first).
3. Build output directory: `dist`.
4. Use Node.js 22 or later. No server framework preset is needed.
5. Deploy and test both a sample and a real upload, including a first visit without cached assets.

No DNS redirect is needed when using the existing live demo. If using a custom domain, connect the hostname to the chosen host. A redirect only sends visitors to a URL; it does not host the application itself.

## Self-host behind Cloudflare Tunnel

Build the app and serve `dist/` with your existing static server, or run the included evaluation server on localhost with `npm start`. Point a Cloudflare Tunnel public hostname at `http://localhost:3000`. Use HTTPS at the public edge and confirm all generated vendor assets are reachable. For sustained deployment, supervise the origin process and apply host security updates. No inbound router port is necessary when using an outbound tunnel.

## Release checks

- `npm test` and `npm run test:ocr` pass.
- `npm run build` succeeds and includes all model/core files.
- Open public URL in a signed-out browser; verify no owner-only access page.
- Run a real image, not only fixture data. Inspect developer tools for blocked CSP/WASM/worker requests.
- Keep the repository and deployed source synchronized. No application form has been submitted automatically by this project.
