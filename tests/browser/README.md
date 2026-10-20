# Real PDF regression (synthetic only)

`npm run test:pdf` exercises Chromium's actual `page.pdf()` / `beforeprint` /
`afterprint` path, using production `organizeReport`, `hydrateReportPhotos`,
`mountReportViewer`, compaction, pagination, and CSS. It prints twice to catch
restoration failures. This complements, rather than replaces, the deterministic
DOM pagination tests in `npm test`.

Prerequisites on an execution host where launching Chromium is permitted:

- `npm ci`
- `npx playwright install --with-deps chromium`
- Poppler's `pdfimages`, `pdftotext`, and `pdftoppm`

The GitHub workflow installs these from their official sources and runs the same
checks when local browser execution is unavailable.

All records and six JPEGs are generated in memory. Images are distinct dimensions
and are hydrated through the production blob-URL path using an in-memory storage
stub. There are no customer files, credentials, auth clients, storage writes, or
live backend calls. Browser HTTP requests are intercepted and served from the
checkout; all other origins fail the test.

Assertions cover six embedded raster images through `pdfimages`, all risk tokens
exactly once in extracted PDF text, sector/cargo separation, same-group small
category packing, DOM overlap/cutoff, physical page count, original data retention,
and repeat export. PDF pages are rasterized for visual review. Generated files
are written only to `test-results/report-pdf` and uploaded for seven days.

Set `REPORT_BASELINE_ROOT` to an older checkout to export the identical fixture
against old production modules/CSS first. Baseline validation failures are recorded,
not assumed; the current checkout must pass. `summary.json` distinguishes image
readiness during synchronous `beforeprint` from raster images actually embedded
in the final PDF, so a suspected image-loading race is not asserted without proof.

The full fixture also renders the production cover opening and visit introduction,
with synthetic identification and dimension cards. It checks that the complete
cover stays on the first sheet without overlap or cutoff. Both exports use the shared visit renderer and omit the redundant objective.
The current CIPA card uses the shared production formatter with the approved
conditional representative and annual-formalization text; the baseline keeps the
previous standard CIPA wording. SESMT copy and the underlying inputs are unchanged.
