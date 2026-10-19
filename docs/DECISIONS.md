# Engineering decisions

## Local neural OCR + deterministic checks

The exercise repeatedly emphasizes simple matching, latency, usability and restricted outbound access. A locally hosted Tesseract LSTM model makes the prototype useful immediately without entering credentials or provisioning a cloud account. Labels never leave the visitor's device. Rule outputs include the expected value, recognized evidence, finding and rationale. An LLM could improve semantic extraction on ornate/curved labels, but introduces latency, cost, data governance and hallucination risks. That is a future adapter decision, not a hidden dependency here.

## A minimal static application

Plain ES modules keep the implementation small, inspectable and portable. The only production JS dependency is Tesseract and its model/core chain. There is no external font or CDN request. The build copies pinned local dependencies into the deployed directory. A system-font UI avoids another network dependency. No secret is present in the source or build.

## Decision states

- **Match:** expected text/value found with sufficiently confident overall OCR.
- **Discrepancy:** recognized numeric or warning evidence conflicts with the supplied requirement. It can still be an OCR mistake; inspect the image.
- **Review:** missing/uncertain evidence, unsupported applicability decision, or an outstanding visual check. Missing OCR text is not automatically proof of a missing label element.
- **Agent checked:** reviewer explicitly confirmed visual formatting. This is a manual attestation, not a machine measurement.
- **Ready for agent:** this prototype's checks are resolved; never synonymous with approval.

Discrepancies take priority over review in the application summary. Errors and stopped applications remain visible and are exported rather than silently omitted.

## Batch design and performance

Each manifest record owns its image list and its application values. Validation is transactional: no partial import on a mapping error. Multiple images concatenate OCR text only within the same application. A single reusable worker processes the queue sequentially. This avoids starting hundreds of workers and exhausting memory, while allowing UI interaction with completed results. Stop finishes the current application, then marks the remaining queue stopped. Review controls are enabled when processing stops/finishes.

Images remain File/blob references until processed; only the current image is rasterized to a canvas. The longest edge is capped at 1800 px. Input limits: 300 applications, 600 images, 300 MB total, 12 MB/40 megapixels per image. These are prototype operational bounds, not claims of government production throughput. Downsampling can harm small text; users should supply cropped artwork. Browser memory use still grows with files and results in the session.

## Strict warning, cautious typography

Canonical warning wording follows TTB guidance. Body capitalization and whitespace are normalized; punctuation and word choices are preserved. Uppercase `GOVERNMENT WARNING:` is checked separately. The heading must be bold, the body nonbold, the paragraph separate/continuous, readable, and properly sized. Raster OCR does not provide reliable typography/physical dimensions, so these checks remain explicitly manual. This is more defensible than passing an unreliable boldness heuristic. Users must inspect other text surrounding the matched warning.

## Security and production boundary

No application/image upload endpoint, analytics, cookies, database or third-party runtime fetch. OCR text is rendered with `textContent`, never injected as HTML. JSON file paths are matched against selected File objects; they are not fetched as URLs. CSV strings are escaped and dangerous formula prefixes neutralized. CSP restricts scripts/workers/connections to the app origin, with WebAssembly execution allowed. `_headers` adds defense in depth on compatible hosts; the HTML includes its own CSP.

A production implementation would require authentication/authorization, audit logs and retention controls, threat review of uploaded documents, calibrated field-level OCR quality, representative test data, security/508 reviews, telemetry with privacy controls, category-specific rules and a separately authorized COLA integration. The prototype makes no FedRAMP or production compliance claim.
