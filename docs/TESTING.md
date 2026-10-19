# Verification record and reviewer checklist

## Automated checks

Run `npm test` for unit and DOM-level integration tests. Coverage includes normalization and word boundaries, ABV/proof conflicts, unit conversions, strict warning text/case/punctuation, low confidence, import fields, incomplete OCR, manual-review status, volume-based warning-size guidance, transactional manifests, 300-record validation, duplicate/missing file associations, unsupported/oversized files, CSV safety, and the sample → verification → manual review UI path.

DOM tests use jsdom and a stub recognition response to test UI state/event wiring. They do **not** establish actual browser layout, canvas, WebAssembly or OCR correctness. Real OCR is exercised independently by `npm run test:ocr` on four actual PNGs, including a two-panel application. The test asserts correct clean and deliberately erroneous outcomes. `docs/ocr-benchmark.json` preserves raw OCR text, checks and timings from that run.

The synthetic test labels are easy, high-contrast fixtures. They are not a representative accuracy dataset. The 300-application test validates mapping and limits, not a full OCR throughput run.

## Public deployment browser smoke test — October 19, 2026

Tested in desktop Chrome at https://treasurytakehomeapp.boxospam.workers.dev/ without login. The matching sample completed real OCR with all automated fields matched and formatting left for human review (4.93 s displayed). The three-application sample batch completed: matching label 1.87 s, altered label 1.40 s, and two-panel imported wine 2.39 s. The altered label showed exactly the expected four discrepancies (ABV, volume, warning heading case, warning wording); the wine record combined front/back evidence and matched country of origin. The desktop results layout was visually inspected. These are one-session observations, not benchmark guarantees.

This smoke test does not cover arbitrary uploads, full-size batches, cancellation, export file contents, all keyboard/accessibility behavior, mobile layout, other browsers, or network-traffic auditing. The following checklist remains useful for the untested paths and regression checks:

1. In a signed-out Chrome/Edge or Safari window, the application loads with no account prompt.
2. Matching sample: actual OCR returns matches except the outstanding manual typography check.
3. Altered sample: ABV, volume, heading case and warning wording are flagged.
4. Imported wine: front/back text combines, and country of origin is matched.
5. Upload your own PNG/JPG/WebP, enlarge it and rotate as needed. Confirm values against the original image.
6. Try missing images, incorrect expected values and poor-quality artwork. Errors/review states must be visible.
7. Run the sample batch. Inspect each application's own evidence. Stop a longer queue and confirm completed rows are retained.
8. Add notes/visual-review choices and export CSV/JSON. Open exports and verify the relevant application and notes.
9. Tab through forms and controls, switch tabs with arrow keys, inspect focus visibility, enlarge/close images with Escape, and check a narrow screen.
10. In browser network tools, all model/code assets are same-origin and no uploaded image contents leave the browser. Check console for errors.

## Measured performance

See README and the raw benchmark file. Node/Linux fixture measurements are separate from browser experience and exclude model network download. The UI measures each application's processing duration, including preparation and any initialization still outstanding. No five-second guarantee is made.
