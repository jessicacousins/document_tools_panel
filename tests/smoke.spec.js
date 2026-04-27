import { test, expect } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixtureDir = path.join(__dirname, "fixtures");

async function createPdf(fileName, title, pages = 2) {
  await mkdir(fixtureDir, { recursive: true });
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  for (let index = 0; index < pages; index += 1) {
    const page = pdfDoc.addPage([612, 792]);
    page.drawText(`${title} page ${index + 1}`, { x: 72, y: 700, size: 24, font, color: rgb(0.05, 0.12, 0.16) });
    page.drawText("review approved draft searchable text", { x: 72, y: 660, size: 12, font });
  }
  const filePath = path.join(fixtureDir, fileName);
  await writeFile(filePath, await pdfDoc.save());
  return filePath;
}

async function createPng(fileName) {
  await mkdir(fixtureDir, { recursive: true });
  const pngBase64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=";
  const filePath = path.join(fixtureDir, fileName);
  await writeFile(filePath, Buffer.from(pngBase64, "base64"));
  return filePath;
}

async function expectDownload(page, action, extension) {
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    action(),
  ]);
  const suggested = download.suggestedFilename();
  expect(suggested.toLowerCase()).toContain(extension);
  const filePath = await download.path();
  expect(filePath).toBeTruthy();
  return suggested;
}

// Helpers to switch panels / categories
async function gotoPanel(page, name) {
  await page.getByRole("button", { name: new RegExp(`^${name}$`, "i") }).first().click();
}

async function gotoCategory(page, name) {
  // Match button on the category rail (icon + label + count)
  await page.locator(".categoryRail").getByRole("button", { name: new RegExp(name, "i") }).click();
}

function toolCard(page, dataTool) {
  return page.locator(`[data-tool="${dataTool}"]`);
}

test.beforeEach(async ({ page }) => {
  await page.goto("/");
});

// ============================================================ Shell

test("App boots, shows the empty state hero, and the command palette opens", async ({ page }) => {
  await expect(page.getByRole("heading", { name: /the professional pdf studio/i })).toBeVisible();
  // Open palette via search trigger
  await page.getByRole("button", { name: /search tools/i }).click();
  await expect(page.getByPlaceholder(/search every tool/i)).toBeVisible();
  // Filter for "merge"
  await page.getByPlaceholder(/search every tool/i).fill("merge");
  await expect(page.getByRole("button", { name: /^Merge PDFs/ })).toBeVisible();
  await page.keyboard.press("Escape");
});

test("Command palette navigates to a specific tool", async ({ page }) => {
  await page.getByRole("button", { name: /search tools/i }).click();
  await page.getByPlaceholder(/search every tool/i).fill("invoice");
  await page.getByRole("button", { name: /Invoice generator/i }).click();
  // Should land on the Tools panel with Generate category active and invoice card visible
  await expect(toolCard(page, "invoice")).toBeVisible();
});

// ============================================================ Brand identity

test("Brand page persists company name and adds a default signature", async ({ page }) => {
  await gotoPanel(page, "Brand");
  await page.getByRole("textbox", { name: "Company name" }).fill("Acme Co");
  await page.getByRole("button", { name: /draw a signature/i }).click();
  // Sign on the canvas
  const canvas = page.locator(".signatureCanvas");
  const box = await canvas.boundingBox();
  await page.mouse.move(box.x + 40, box.y + 80);
  await page.mouse.down();
  await page.mouse.move(box.x + 200, box.y + 120);
  await page.mouse.move(box.x + 320, box.y + 100);
  await page.mouse.up();
  await page.getByRole("button", { name: /use signature/i }).click();
  await expect(page.getByText(/^DEFAULT$/)).toBeVisible();
  // Brand name shown in app bar
  await expect(page.getByRole("banner").getByText("Acme Co")).toBeVisible();
});

// ============================================================ Organize

test("Organize: merge two PDFs", async ({ page }) => {
  const a = await createPdf("first.pdf", "First", 2);
  const b = await createPdf("second.pdf", "Second", 2);
  await gotoPanel(page, "Tools");
  await gotoCategory(page, "Organize");
  const card = toolCard(page, "merge");
  await card.locator('input[type="file"]').setInputFiles([a, b]);
  await expectDownload(page, () => card.getByRole("button", { name: /merge pdfs/i }).click(), ".pdf");
});

test("Organize: extract pages from a PDF", async ({ page }) => {
  const file = await createPdf("split-source.pdf", "Split Source", 4);
  await gotoPanel(page, "Tools");
  await gotoCategory(page, "Organize");
  const card = toolCard(page, "split");
  await card.locator('input[type="file"]').setInputFiles(file);
  await card.getByRole("textbox", { name: "Pages to keep" }).fill("1-2");
  await expectDownload(page, () => card.getByRole("button", { name: /extract pages/i }).click(), ".pdf");
});

test("Organize: rotate, reorder, compress all download PDFs", async ({ page }) => {
  const file = await createPdf("organize-source.pdf", "Org Source", 3);
  await gotoPanel(page, "Tools");
  await gotoCategory(page, "Organize");

  const rotate = toolCard(page, "rotate");
  await rotate.locator('input[type="file"]').setInputFiles(file);
  await expectDownload(page, () => rotate.getByRole("button", { name: /rotate pages/i }).click(), ".pdf");

  const organize = toolCard(page, "organize");
  await organize.locator('input[type="file"]').setInputFiles(file);
  await organize.getByRole("textbox", { name: "New page order" }).fill("3,1,2");
  await expectDownload(page, () => organize.getByRole("button", { name: /build reordered pdf/i }).click(), ".pdf");

  const compress = toolCard(page, "compress");
  await compress.locator('input[type="file"]').setInputFiles(file);
  await expectDownload(page, () => compress.getByRole("button", { name: /compress.*download/i }).click(), ".pdf");
});

// ============================================================ Convert

test("Convert: images→PDF, PDF→PNG zip, PDF→DOCX, text→PDF", async ({ page }) => {
  const png = await createPng("pixel.png");
  const file = await createPdf("convert-source.pdf", "Convert Source", 2);
  await gotoPanel(page, "Tools");
  await gotoCategory(page, "Convert");

  const img = toolCard(page, "img2pdf");
  await img.locator('input[type="file"]').setInputFiles(png);
  await expectDownload(page, () => img.getByRole("button", { name: /convert to pdf/i }).click(), ".pdf");

  const png2 = toolCard(page, "pdf2png");
  await png2.locator('input[type="file"]').setInputFiles(file);
  await png2.getByRole("textbox", { name: "Pages" }).fill("1");
  await expectDownload(page, () => png2.getByRole("button", { name: /export png zip/i }).click(), ".zip");

  const docx = toolCard(page, "pdf2docx");
  await docx.locator('input[type="file"]').setInputFiles(file);
  await expectDownload(page, () => docx.getByRole("button", { name: /convert to docx/i }).click(), ".docx");

  const text = toolCard(page, "text2pdf");
  await text.getByRole("textbox", { name: "Title" }).fill("Smoke Note");
  await text.getByRole("textbox", { name: "Content" }).fill("Hello PDF world.");
  await expectDownload(page, () => text.getByRole("button", { name: /create pdf/i }).click(), ".pdf");
});

// ============================================================ Generate

test("Generate: invoice with line items downloads a PDF", async ({ page }) => {
  await gotoPanel(page, "Tools");
  await gotoCategory(page, "Generate");
  const inv = toolCard(page, "invoice");
  await inv.getByRole("textbox", { name: "Invoice number" }).fill("2026-001");
  // First (default) line item
  await inv.locator('input[placeholder="Item description"]').first().fill("Consulting hours");
  await inv.locator('input[type="number"]').nth(1).fill("4"); // qty (after taxRate input)
  // Add a second line via the "Add line item" button
  await inv.getByRole("button", { name: /add line item/i }).click();
  await expectDownload(page, () => inv.getByRole("button", { name: /download invoice/i }).click(), ".pdf");
});

test("Generate: CSV → table report downloads a PDF", async ({ page }) => {
  await gotoPanel(page, "Tools");
  await gotoCategory(page, "Generate");
  const csv = toolCard(page, "csv");
  await csv.getByRole("textbox", { name: "Report title" }).fill("Smoke Report");
  await csv.getByRole("textbox", { name: "CSV" }).fill("Name,Status\nItem,Open");
  await expectDownload(page, () => csv.getByRole("button", { name: /create report/i }).click(), ".pdf");
});

// ============================================================ Protect & Polish

test("Protect: redact, watermark, headers/footers, bates, metadata all download PDFs", async ({ page }) => {
  const file = await createPdf("protect-source.pdf", "Protect Source", 2);
  await gotoPanel(page, "Tools");
  await gotoCategory(page, "Protect");

  const redact = toolCard(page, "redact");
  await redact.locator('input[type="file"]').setInputFiles(file);
  await expectDownload(page, () => redact.getByRole("button", { name: /burn redaction/i }).click(), ".pdf");

  const wm = toolCard(page, "watermark");
  await wm.locator('input[type="file"]').setInputFiles(file);
  await wm.getByRole("textbox", { name: "Watermark text" }).fill("DRAFT");
  await expectDownload(page, () => wm.getByRole("button", { name: /apply watermark/i }).click(), ".pdf");

  const hf = toolCard(page, "headfoot");
  await hf.locator('input[type="file"]').setInputFiles(file);
  await hf.getByRole("textbox", { name: "Header text" }).fill("Smoke header");
  await expectDownload(page, () => hf.getByRole("button", { name: /apply header\/footer/i }).click(), ".pdf");

  const bates = toolCard(page, "bates");
  await bates.locator('input[type="file"]').setInputFiles(file);
  await bates.getByRole("textbox", { name: "Prefix" }).fill("DOC");
  await expectDownload(page, () => bates.getByRole("button", { name: /number pages/i }).click(), ".pdf");

  const meta = toolCard(page, "metadata");
  await meta.locator('input[type="file"]').setInputFiles(file);
  await meta.getByRole("textbox", { name: "Title" }).fill("Smoke Title");
  await expectDownload(page, () => meta.getByRole("button", { name: /apply metadata/i }).click(), ".pdf");
});

// ============================================================ Read & Search

test("Read: search & highlight report downloads a PDF", async ({ page }) => {
  const file = await createPdf("search-source.pdf", "Search Source", 2);
  await gotoPanel(page, "Tools");
  await gotoCategory(page, "Read");
  const search = toolCard(page, "search");
  await search.locator('input[type="file"]').setInputFiles(file);
  await search.getByRole("textbox", { name: "Search term" }).fill("review");
  await expectDownload(page, () => search.getByRole("button", { name: /search.*download report/i }).click(), ".pdf");
});

test("Read: OCR exports a searchable PDF for one page", async ({ page }) => {
  test.setTimeout(180_000);
  const file = await createPdf("ocr-source.pdf", "OCR Source", 1);
  await gotoPanel(page, "Tools");
  await gotoCategory(page, "Read");
  const ocr = toolCard(page, "ocr");
  await ocr.locator('input[type="file"]').setInputFiles(file);
  await expectDownload(page, () => ocr.getByRole("button", { name: /run ocr.*download/i }).click(), ".pdf");
});

// ============================================================ Builder

test("Builder: exports a designed PDF from defaults", async ({ page }) => {
  await gotoPanel(page, "Builder");
  await page.getByRole("textbox", { name: "Title", exact: true }).fill("Smoke Builder");
  await expectDownload(page, () => page.getByRole("button", { name: /download designed pdf/i }).click(), ".pdf");
});

// ============================================================ Images & Media

test("Images: compress, convert, resize, favicon all download", async ({ page }) => {
  const png = await createPng("util-pixel.png");
  await gotoPanel(page, "Tools");
  await gotoCategory(page, "Images");

  const compress = toolCard(page, "img-compress");
  await compress.locator('input[type="file"]').setInputFiles(png);
  await expectDownload(page, () => compress.getByRole("button", { name: /compress.*download/i }).click(), ".jpg");

  const convert = toolCard(page, "img-convert");
  await convert.locator('input[type="file"]').setInputFiles(png);
  await expectDownload(page, () => convert.getByRole("button", { name: /convert.*download/i }).click(), ".png");

  const resize = toolCard(page, "img-resize");
  await resize.locator('input[type="file"]').setInputFiles(png);
  // Wait for the original to load so the width input populates
  await expect(resize.getByText(/Original:/)).toBeVisible({ timeout: 5000 });
  await expectDownload(page, () => resize.getByRole("button", { name: /resize.*download/i }).click(), ".png");

  const favicon = toolCard(page, "favicon");
  await favicon.locator('input[type="file"]').setInputFiles(png);
  await expectDownload(page, () => favicon.getByRole("button", { name: /generate favicon zip/i }).click(), ".zip");
});

// ============================================================ Text & Data

test("Text & Data: JSON, base64, hash, JWT all respond", async ({ page }) => {
  await gotoPanel(page, "Tools");
  await gotoCategory(page, "Text & Data");

  // JSON formatter
  const json = toolCard(page, "json");
  await json.locator("textarea").first().fill('{"hi":"world"}');
  await json.getByRole("button", { name: /^Format$/ }).click();
  await expect(json.locator("textarea").nth(1)).toHaveValue(/"hi": "world"/, { timeout: 3000 });

  // Base64 encode
  const b64 = toolCard(page, "base64");
  await b64.locator("textarea").first().fill("hello world");
  await b64.getByRole("button", { name: /^Encode$/ }).click();
  await expect(b64.locator("textarea").last()).toHaveValue(/aGVsbG8gd29ybGQ=/);

  // Hash text
  const hash = toolCard(page, "hash");
  await hash.locator("textarea").first().fill("abc");
  await hash.getByRole("button", { name: /hash text/i }).click();
  await expect(hash.locator("textarea").last()).toHaveValue(/ba7816bf8f01cfea/);

  // JWT decode
  const jwt = toolCard(page, "jwt");
  // standard public test JWT (HS256, payload {"sub":"1234567890","name":"John Doe","iat":1516239022})
  await jwt.locator("textarea").first().fill("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c");
  await jwt.getByRole("button", { name: /^Decode$/ }).click();
  await expect(jwt.locator("textarea").nth(1)).toHaveValue(/HS256/);
});

// ============================================================ Quick Tools

test("Quick: password and UUID generators produce output", async ({ page }) => {
  await gotoPanel(page, "Tools");
  await gotoCategory(page, "Quick Tools");

  const pwd = toolCard(page, "password");
  await pwd.getByRole("button", { name: /^Generate$/ }).click();
  await expect(pwd.locator(".codeOut")).toBeVisible();

  const uuid = toolCard(page, "uuid");
  await uuid.getByRole("button", { name: /^Generate$/ }).click();
  await expect(uuid.locator(".codeOut")).toContainText(/[0-9a-f]{8}-[0-9a-f]{4}-/);
});

test("Quick: QR code generates a downloadable PNG", async ({ page }) => {
  await gotoPanel(page, "Tools");
  await gotoCategory(page, "Quick Tools");
  const qr = toolCard(page, "qr");
  // Default content is preset; just hit the button
  await expectDownload(page, () => qr.getByRole("button", { name: /download png/i }).click(), ".png");
});

// ============================================================ Business Docs

test("Business Docs: receipt downloads a PDF", async ({ page }) => {
  await gotoPanel(page, "Tools");
  await gotoCategory(page, "Business Docs");
  const receipt = toolCard(page, "receipt");
  await receipt.locator('input[placeholder="Item"]').first().fill("Service");
  await expectDownload(page, () => receipt.getByRole("button", { name: /download receipt/i }).click(), ".pdf");
});

test("Business Docs: resume downloads a PDF", async ({ page }) => {
  await gotoPanel(page, "Tools");
  await gotoCategory(page, "Business Docs");
  const resume = toolCard(page, "resume");
  await resume.getByRole("textbox", { name: "Full name" }).fill("Smoke User");
  await expectDownload(page, () => resume.getByRole("button", { name: /download resume pdf/i }).click(), ".pdf");
});

// ============================================================ Editor

test("Editor: loads a PDF, drops text, and exports an edited PDF", async ({ page }) => {
  const file = await createPdf("editor-source.pdf", "Editor Source", 1);
  await page.locator('input[type="file"][accept="application/pdf"]').first().setInputFiles(file);
  // Wait until the PDF has finished loading (page count pill becomes "1 / 1")
  await expect(page.locator(".pagePill").first()).toHaveText(/^1 \/ 1$/, { timeout: 20_000 });
  // And the canvas has been actually rendered
  await page.waitForFunction(() => {
    const c = window.document.querySelector(".pdfCanvas");
    return c && c.width > 0 && c.height > 0;
  }, null, { timeout: 20_000 });
  // Pick the Text rail tool, then click the page to drop text
  await page.locator(".toolRail").getByRole("button", { name: /^text$/i }).click();
  await page.locator(".pdfStage").click({ position: { x: 120, y: 160 } });
  // The Download PDF button is in the editor's top toolbar and starts disabled
  const downloadBtn = page.locator(".topToolbar").getByRole("button", { name: /download pdf/i });
  await expect(downloadBtn).toBeEnabled({ timeout: 5_000 });
  await expectDownload(page, () => downloadBtn.click(), ".pdf");
});
