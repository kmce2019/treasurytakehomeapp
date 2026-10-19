# Label Lens

**AI-assisted alcohol label verification, with evidence an agent can inspect.**

A standalone Treasury take-home assessment prototype by Kevin Gardner.

- **Live application:** https://treasurytakehomeapp.boxospam.workers.dev/
- **Source:** https://github.com/kmce2019/treasurytakehomeapp
- **Assessment brief:** https://github.com/treasurytakehome-rgb/instructions

No login, paid API, API key, database, or cloud AI account is required. The application uses Tesseract's neural-network OCR locally in the browser, then deterministic comparison rules. Uploaded label images and application details are not sent to a server.

## Try it in two minutes

1. Open the live application and select **Matching label**.
2. Select **Verify application**. The sample PNG goes through actual OCR; results are not precomputed.
3. Review the field evidence and expand **View original OCR text**. Confirm warning formatting only after inspecting the artwork. Physical type size requires the intended print dimensions.
4. Try **With discrepancies**. Expect ABV, net contents, warning-heading capitalization, and warning-wording discrepancies.
5. Try **Imported wine** to compare front and back panels together, or use **Batch review → Try the 3-application sample batch**.
6. Add review notes and export CSV or JSON. These are prototype findings, not approval certificates.

## Setup and run

Requirements: **Node.js 22+** and npm. Install/build requires access to the npm registry. The generated app has no third-party runtime requests.

```bash
git clone https://github.com/kmce2019/treasurytakehomeapp.git
cd treasurytakehomeapp
npm ci
npm test
npm run build
npm start
```

Open **http://localhost:3000**. Keep the server running. Do not open `index.html` with a `file://` URL: web workers, ES modules and the model need HTTP(S). `PORT=8080 npm start` changes the port; `HOST=0.0.0.0 npm start` binds all interfaces when running behind a controlled reverse proxy.

```bash
npm run test:ocr    # Actual neural OCR on the supplied PNG fixtures; writes docs/ocr-benchmark.json
```

Python is not needed to build or run. To regenerate the fictional sample artwork, install Pillow and DejaVu fonts, then run `python scripts/generate_samples.py`. Generated PNGs are committed so reviewers do not need that optional toolchain.

## What is implemented

| Requirement / stakeholder concern | Implementation |
| --- | --- |
| Image-based AI verification | Tesseract.js 6.0.1 / Tesseract LSTM OCR in a web worker; English model bundled on the same origin |
| Compare against application | Required brand, class/type, net contents, producer, address; ABV for spirits; country for imports |
| Case differences such as STONE'S THROW | Unicode apostrophes, case, punctuation and whitespace normalized for ordinary fields; whole-token matching avoids partial-brand collisions |
| Alcohol / net contents | Numeric ABV comparison; common alcohol declaration formats; U.S. proof consistency; mL/cL/L/US fl oz conversions |
| Exact government warning | Canonical wording and punctuation, allowing whitespace/line wraps and body capitalization; separate uppercase heading check |
| Bold warning heading | Explicit human confirmation of heading/body weight, layout, contrast, legibility and physical size; never falsely auto-certified |
| Speed | Reused worker, bounded image dimensions, no cloud round trips, visible progress and measured duration |
| Batch 200–300 applications | JSON manifest maps each application to 1–6 images; queue supports 300 applications / 600 images / 300 MB total; sequential processing with stop-after-current |
| Simple, transparent UX | Side-by-side input, sample actions, image enlargement/rotation, field evidence, uncertainty statuses, review notes and exports |
| Restrictive network | Scripts, model, worker and WASM all same-origin; no CDN or cloud inference calls |
| Error handling | Input/file validation, duplicate/missing mapping rejection, invalid image errors, OCR timeout, partial batch results and stopped/error jobs in exports |

## Batch input

Use the included [example manifest](public/samples/batch-manifest.json). It is a JSON array with one record per application:

```json
[
  {
    "id": "APP-001",
    "files": ["front.png", "back.png"],
    "beverage": "spirits",
    "brand": "Old Tom Distillery",
    "classType": "Kentucky Straight Bourbon Whiskey",
    "abv": "45",
    "netContents": "750 mL",
    "producer": "Old Tom Distillery",
    "address": "Frankfort, Kentucky",
    "imported": false,
    "country": ""
  }
]
```

- `beverage`: `spirits`, `wine`, or `beer`. `imported` must be a JSON boolean.
- `files` uses exact, case-sensitive base filenames, not paths or URLs. Each image must belong to exactly one application. Distinct applications may not reuse the same filename.
- Every selected image must appear in the manifest. Missing files, duplicate IDs and invalid application values reject the import before processing.
- PNG, JPEG and WebP; maximum 12 MB and 40 megapixels per image. No PDF, SVG, HEIC or ZIP input.
- For wine/beer, empty ABV results in **applicability review**, not an automatic exemption.
- Single-application rotation is supported. Pre-rotate batch images before importing.
- The JSON export preserves application values, unmodified OCR text, confidence, durations, findings, visual-review choices and notes. CSV exports one row per check and neutralizes formula prefixes in untrusted text.

## Approach and organization

```text
src/
  app.js                 DOM interactions, queue, review controls and export
  ocr.js                 Same-origin OCR worker, image preparation, timeout handling
  verify.js              Pure normalization, numeric extraction and comparison rules
  batch.js               Manifest/file validation and CSV serialization
public/
  index.html             Accessible, responsive workspace
  styles.css             Visual system and responsive layouts
  samples/               Four fictional label PNGs and a three-application manifest
  _headers               Security headers for compatible static hosts
scripts/
  build.mjs              Copy source + pinned OCR assets to dist/
  serve.mjs              Local static development/evaluation server
  benchmark.mjs          Real OCR integration tests and timings
  generate_samples.py    Reproducible fixture generator
tests/                  Rule, manifest, CSV and DOM workflow tests
docs/                   Decisions, limitations, testing and hosting guidance
```

The production application deliberately uses plain browser JavaScript and semantic HTML. A framework/backend would add setup and attack surface without improving the bounded workflow. OCR is the AI component; extraction is separate from comparison, so a model cannot invent a favorable compliance decision or obey instructions printed on a label. There are no prompts or remote inference endpoints.

**Tool disclosure:** Developed with ChatGPT/Codex assistance for implementation, documentation and tests. Core dependencies are Tesseract.js/Tesseract.js-core and the English traineddata package; jsdom is a development-only test dependency. Python/Pillow generated precise, fictional test fixtures. This documentation does not claim that the candidate independently authored every line. The candidate should understand and be able to explain the design and limitations.

## Verification and performance

`npm test` covers ordinary-text normalization, number conversion/conflicts, strict warning wording, low confidence, applicability review, image-to-record association, batch boundaries, CSV escaping and simulated DOM interaction. `npm run test:ocr` runs the actual model against PNGs and asserts the expected findings.

The initial Linux/Node integration run measured approximately **3.7 s** for the matching spirits label, **3.0 s** for the altered label, and **2.2 s** for the two-panel wine application. Worker/model initialization was approximately **3.7 s** separately. Raw results: [docs/ocr-benchmark.json](docs/ocr-benchmark.json). These are small synthetic-fixture measurements, not a browser SLA or real-world accuracy benchmark. First use, slow devices, network/model loading and difficult artwork can exceed the five-second target.

A subsequent desktop Chrome browser check on the public Cloudflare deployment (October 19, 2026) verified unauthenticated access, actual single-label OCR, and the three-application sample batch. The first single-label verification displayed 4.93 s; warm batch runs displayed 1.87 s (matching), 1.40 s (altered), and 2.39 s (two-panel wine). Expected field outcomes were observed and the desktop results layout was visually inspected. These are individual observations, not a performance guarantee. [The browser checklist](docs/TESTING.md) records remaining verification. A full 300-image OCR run, all browsers, real-world uploads, exports and difficult bottle photographs have not been browser-tested.

## Assumptions and limits

- This is a **comparison assistant**, not complete COLA review, a regulatory approval system or an official government service. It has no COLA integration.
- Text presence on any supplied panel is compared. Legal placement, field semantics, category-specific exceptions, ABV tolerances, approved bottle sizes, appellations, allergens, formula approval and every other labeling rule are not adjudicated.
- Exact numeric equality is used for ABV; net content conversion allows less than 0.5 mL difference for unit rounding. Multiple incompatible observed values are flagged.
- Whole-token text matching ignores punctuation/case. Addresses and producer names are not semantically normalized; abbreviated addresses may need review. Brand evidence can occur in a producer line; position is not inferred.
- Warning comparison searches for the canonical statement after its heading. Wording and punctuation must match; body case and line wraps may differ. Additional surrounding content and paragraph layout need human inspection.
- Boldness is **not inferred from OCR**. Physical millimeter type size cannot be known without print dimensions. The agent check includes these requirements.
- OCR confidence is a heuristic, not a calibrated probability. A panel score below 80 routes otherwise matching checks to review. High confidence cannot guarantee correctness.
- Flat, readable English artwork is the primary target. Sideways images can be rotated manually. No perspective correction, robust glare removal, multilingual model or PDF rasterization is implemented.
- Model initialization and same-origin assets require connectivity. Once loaded, extraction is local; this is not an installable offline/PWA guarantee.
- Results live only in page memory. Refreshing loses the queue and notes. Exports are deliberate downloads; no remote storage, persistent audit trail, authentication or authorization system is implemented.

See [DECISIONS.md](docs/DECISIONS.md), [TESTING.md](docs/TESTING.md), and [DEPLOYMENT.md](docs/DEPLOYMENT.md).

## References

- [Treasury assessment instructions](https://github.com/treasurytakehome-rgb/instructions), reviewed October 19, 2026.
- [TTB: Distilled Spirits Labeling — Health Warning Statement](https://www.ttb.gov/regulated-commodities/beverage-alcohol/distilled-spirits/ds-labeling-home/ds-health-warning), reviewed October 19, 2026; canonical wording and formatting guidance.
- [Tesseract.js API](https://github.com/naptha/tesseract.js/blob/master/docs/api.md) and [local installation](https://github.com/naptha/tesseract.js/blob/master/docs/local-installation.md).

All sample brands/artwork in this repository are fictional test data. Dependency license notices are included in the build; see [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
