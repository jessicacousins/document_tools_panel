# JC PDF Studio

```
https://doc-tool.netlify.app/
```

A free, professional document and developer studio that runs entirely in your browser. No accounts, no uploads, no paywall.

JC PDF Studio gives anyone — freelancers, small businesses, legal teams, non-profits, designers, and developers — the kind of tooling that normally lives behind a stack of subscriptions, with a workflow that respects privacy: every file stays on your device.

## What's inside

JC PDF Studio is organized like the tools professionals already know. Use the searchable command palette (`⌘K` / `Ctrl K`) to jump to any tool instantly.

### Editor (the in-place PDF editor)

- Text, highlight, freehand draw, outline boxes, whiteout
- Hand-drawn signatures (saved to brand for instant reuse)
- Logo / image stamps
- Per-edit color, size, and position controls with undo/redo
- Page navigation, zoom, multi-page support

### Tools — Organize

- **Merge PDFs** with optional title dividers
- **Extract pages** (split) by range
- **Reorder & delete pages** in any sequence
- **Rotate pages** 90°, 180°, or 270°
- **Compress** with object-stream re-save and a before/after report

### Tools — Convert

- **Images → PDF** (PNG/JPG, multi-page)
- **PDF → PNG zip** (per-page, high-resolution)
- **PDF → Word (DOCX)** (extractable text)
- **Text / HTML → PDF** with custom title and page size

### Tools — Generate

- **Invoice generator** with real line items, tax, totals, and brand-aware From/To
- **CSV → table report** with auto-paginated formatted tables

### Tools — Protect & Polish

- **Redact (burn-in)** — rasterizes pages so removed text is unrecoverable
- **Watermark** with brand accent color
- **Headers / footers** with page numbers
- **Bates numbering** for legal/discovery workflows
- **Edit metadata** (title, author)

### Tools — Read & Search

- **Search & highlight report** — find a term and download a snippet PDF
- **OCR (Tesseract.js)** — recognize text in scanned PDFs and add an invisible searchable layer

### Tools — Images & Media

- **Compress image** — JPG/PNG re-encode with a quality slider
- **Convert image format** — PNG ↔ JPG ↔ WebP
- **Resize image** — exact pixels with optional aspect-ratio lock
- **Favicon generator** — full PNG size set in a single zip, plus a paste-in HTML snippet

### Tools — Text & Data

- **JSON formatter / validator / minifier** — with helpful error reporting
- **CSV ↔ JSON** — round-trip a spreadsheet to structured JSON and back
- **Base64 encode / decode** — text or any file
- **URL encode / decode** — for query strings and links
- **Hash generator** — SHA-1, SHA-256, SHA-384, SHA-512 from text or file (Web Crypto)
- **JWT decoder** — header and payload (signature is not verified)
- **Markdown → HTML / PDF** — live preview, then download

### Tools — Quick Tools

- **Password generator** — cryptographically random with full character-class control
- **UUID generator** — RFC-4122 v4
- **Lorem ipsum generator** — paragraphs, sentences, or words
- **QR code generator** — text or URL → PNG or SVG, fully customizable colors
- **Color palette** — tints, shades, and complement from a base color, click to copy
- **Word & character count** — live stats including reading time
- **Case converter** — camelCase, PascalCase, snake_case, kebab-case, CONSTANT_CASE, dot.case, Title Case, Sentence case
- **Slug generator** — URL-safe slugs from any title
- **Regex tester** — live match count and highlighted hits
- **Text diff checker** — line-by-line comparison

### Tools — Business Docs

- **Receipt generator** — itemized totals + payment method
- **Quote / estimate** — branded with scope, validity date, and terms
- **Resume / CV builder** — clean one-page ATS-friendly PDF
- **Meeting agenda** — attendees and timed topics
- **Business card sheet** — 10-up 3.5 by 2 inch cards on a single Letter page
- **Formal letter** — block-format letter with letterhead, salutation, sign-off
- **Checklist / SOP** — numbered checkable list as a printable PDF

### Builder (design from scratch)

A block-based PDF designer with cover pages, headers/footers, two-column body, signature blocks, callouts, checklists, dividers, and image embeds. Reads your brand defaults automatically.

### Brand identity

Save your company name, logo, primary/accent colors, and signature library once. Every generator (Invoice, Watermark, Builder, Editor, Header/Footer, Metadata) automatically uses them. Stored only in your browser's `localStorage` — never uploaded.

## Why "free forever"?

Most PDF tools either cost a subscription, push you to upload your documents to their servers, or both. JC PDF Studio was built so a small business owner, a teacher writing forms, a freelancer billing a client, or a parent filling out school paperwork has access to the same tools without hitting a paywall or worrying about where their PDFs are going.

## Stack

- Vite + React (JavaScript, no TypeScript)
- [pdf-lib](https://pdf-lib.js.org/) for writing PDFs
- [pdfjs-dist](https://mozilla.github.io/pdf.js/) for rendering and text extraction
- [tesseract.js](https://tesseract.projectnaptha.com/) for in-browser OCR
- [docx](https://docx.js.org/) for Word export
- [jszip](https://stuk.github.io/jszip/) for zip exports (favicons, PNG-per-page)
- [qrcode](https://www.npmjs.com/package/qrcode) for QR PNG/SVG generation
- [marked](https://marked.js.org/) for Markdown rendering
- Web Crypto API for SHA hashing
- [lucide-react](https://lucide.dev/) for icons
- Hand-written CSS with CSS variables and animated SVG accents
- Playwright smoke tests

## Run locally

```bash
npm install
npm run dev
```

The dev server runs on `http://127.0.0.1:5173` by default.

## Production build

```bash
npm run build
npm run preview
```

The static build lands in `dist/`.

## Smoke tests

```bash
npm run test:smoke
```

Playwright drives every category, downloads a real PDF or zip per tool, and asserts the file extension. The smoke suite uses Microsoft Edge by default; override with `PW_CHANNEL=chrome npm run test:smoke`.

## File map

```
src/
  App.jsx        — shell, command palette, brand page, layout
  editor.jsx     — in-place PDF editor (text/highlight/draw/sign/image/whiteout)
  builder.jsx    — block-based PDF designer
  tools.jsx      — PDF tool cards (Organize / Convert / Generate / Protect / Read);
                   also aggregates utilities into the same panel via the registry
  utilities.jsx  — non-PDF tool cards (Images & Media / Text & Data / Quick Tools / Business Docs)
  lib.jsx        — helpers, brand store, animated SVGs, signature pad, palette,
                   shared ToolHeader + withWorking wrapper, full Legal panel
  styles.css     — design system + animations
  main.jsx       — React entry
```

## Privacy & limitations

- The frontend has no upload endpoint, no analytics, no user accounts.
- The Whiteout tool covers content visually but is **not** secure redaction. Use the **Redact** tool when you need text to actually be unrecoverable.
- OCR runs locally and downloads the language model the first time you use it; large jobs are CPU/memory intensive.
- Brand identity (logo, colors, signatures) is stored only in your browser via `localStorage`. Clear it any time on the Brand page.

## Launch checklist

1. Replace `public/logo.svg` with your final mark if you're white-labeling the project.
2. Review the comprehensive `LegalPanel` in `src/lib.jsx` — Privacy Policy, Terms of Use, AdSense disclosure, and tool-specific notes are already included; tweak the contact section to match how you want to be reached.
3. If you're adding Google AdSense, the privacy policy already discloses it; just paste the AdSense `<script>` into `index.html` and add an `ads.txt` to `public/` per AdSense's instructions.
4. Decide whether you want analytics. If privacy is the selling point, keep them off or make them clearly disclosed and consent-based.
5. Test with PDFs and utilities from desktop, iPad/tablet, iPhone/Android, Chrome, Edge, Firefox, and Safari.
5. Run `npm run test:smoke` to verify every tool downloads.
