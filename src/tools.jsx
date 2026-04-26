import { useMemo, useRef, useState } from "react";
import * as pdfjsLib from "pdfjs-dist";
import JSZip from "jszip";
import { createWorker } from "tesseract.js";
import { Document as DocxDocument, Packer, Paragraph, TextRun } from "docx";
import { degrees, PDFDocument, StandardFonts, rgb } from "pdf-lib";
import {
  ArrowDownToLine,
  Brush,
  CheckCircle2,
  ClipboardList,
  Eraser,
  FileArchive,
  FileImage,
  FilePlus2,
  FileSearch,
  FileText,
  Files,
  FileType2,
  Hash,
  Layers3,
  Plus,
  Receipt,
  RotateCw,
  ScanLine,
  Search,
  ShieldCheck,
  SplitSquareHorizontal,
  Stamp,
  Trash2,
} from "lucide-react";
import {
  DropZone,
  PAGE_PRESETS,
  Spinner,
  canvasToBlob,
  clamp,
  dataUrlToUint8Array,
  downloadBlob,
  extractPdfText,
  getPageSelection,
  hexToRgb,
  makeId,
  normalizePdfText,
  parseCsvRows,
  readFileAsDataUrl,
  renderPdfPageToCanvas,
  safeBaseName,
  wrapText,
} from "./lib.jsx";

export const CATEGORIES = [
  { id: "organize", label: "Organize", icon: Layers3, blurb: "Merge, split, rotate, reorder, and compress your PDFs." },
  { id: "convert",  label: "Convert",  icon: FileType2, blurb: "Move between PDF, images, Word, and text — both directions." },
  { id: "generate", label: "Generate", icon: FilePlus2, blurb: "Make invoices, table reports, and styled documents from scratch." },
  { id: "protect",  label: "Protect & Polish", icon: ShieldCheck, blurb: "Redact, watermark, number, brand, and finish your documents." },
  { id: "read",     label: "Read & Search", icon: FileSearch, blurb: "Pull text out of scans and find what's inside your PDFs." },
];

// Tool meta — used by the command palette
export const TOOL_REGISTRY = [
  { id: "merge",       title: "Merge PDFs",                description: "Combine multiple PDFs into one file.", icon: Files,                  category: "Organize", keywords: ["combine", "join"] },
  { id: "split",       title: "Extract pages",             description: "Pull selected pages out into a new PDF.", icon: SplitSquareHorizontal, category: "Organize", keywords: ["split", "section"] },
  { id: "organize",    title: "Reorder & delete pages",    description: "Pick exact pages in any order to keep.", icon: Layers3,             category: "Organize", keywords: ["arrange", "remove", "delete"] },
  { id: "rotate",      title: "Rotate pages",              description: "Turn pages 90, 180, or 270 degrees.", icon: RotateCw,                category: "Organize", keywords: ["spin", "orient"] },
  { id: "compress",    title: "Compress / clean save",     description: "Re-save with object streams to reduce overhead.", icon: ArrowDownToLine, category: "Organize", keywords: ["shrink", "size"] },
  { id: "img2pdf",     title: "Images → PDF",              description: "Bundle PNG or JPG images into a single PDF.", icon: FileImage,        category: "Convert",  keywords: ["png", "jpg", "photo", "scan"] },
  { id: "pdf2png",     title: "PDF → PNG zip",             description: "Export each page as a PNG image inside a zip.", icon: FileArchive,      category: "Convert",  keywords: ["image", "export", "png"] },
  { id: "pdf2docx",    title: "PDF → Word (DOCX)",         description: "Extract readable text into a Word document.", icon: FileType2,        category: "Convert",  keywords: ["word", "docx", "convert"] },
  { id: "text2pdf",    title: "Text / HTML → PDF",         description: "Paste text or simple HTML and download a clean PDF.", icon: FileText,    category: "Convert",  keywords: ["create", "document"] },
  { id: "invoice",     title: "Invoice generator",         description: "Build a clean invoice with line items, tax, and totals.", icon: Receipt, category: "Generate", keywords: ["bill", "receipt", "estimate"] },
  { id: "csv",         title: "CSV → table report",        description: "Paste CSV rows and download a formatted table PDF.", icon: ClipboardList,  category: "Generate", keywords: ["spreadsheet", "data", "report"] },
  { id: "redact",      title: "Redact (burn-in)",          description: "Cover content by rasterizing pages — text becomes unrecoverable.", icon: Eraser, category: "Protect & Polish", keywords: ["redaction", "secure", "remove"] },
  { id: "watermark",   title: "Add watermark",             description: "Stamp DRAFT, CONFIDENTIAL, or any text across pages.", icon: Brush, category: "Protect & Polish", keywords: ["stamp", "draft"] },
  { id: "headfoot",    title: "Headers & footers",         description: "Add brand text and page numbers to every page.", icon: Stamp, category: "Protect & Polish", keywords: ["page numbers", "title"] },
  { id: "bates",       title: "Bates numbering",           description: "Add legal-style sequential numbers to every page.", icon: Hash, category: "Protect & Polish", keywords: ["legal", "number"] },
  { id: "metadata",    title: "Edit metadata",             description: "Set title, author, and producer on the PDF.", icon: FileText, category: "Protect & Polish", keywords: ["title", "author"] },
  { id: "search",      title: "Search & highlight report", description: "Find text across pages and download a snippet report.", icon: Search, category: "Read & Search", keywords: ["find", "highlight"] },
  { id: "ocr",         title: "OCR — make searchable",     description: "Recognize text in scanned PDFs and add a searchable layer.", icon: ScanLine, category: "Read & Search", keywords: ["scan", "tesseract"] },
];

// Each tool returns a card. setStatus(message, kind?) handles toasts.
function withWorking(action, setLocal) {
  return async () => {
    setLocal?.(true);
    try { await action(); } finally { setLocal?.(false); }
  };
}

function ToolHeader({ icon: Icon, title, description }) {
  return (
    <div className="cardHead">
      <div className="cardIcon"><Icon size={18} /></div>
      <div className="cardTitle">
        <h3>{title}</h3>
        <p>{description}</p>
      </div>
    </div>
  );
}

// ============================================================ Organize tools

function MergeCard({ setStatus }) {
  const [files, setFiles] = useState([]);
  const [includeDividers, setIncludeDividers] = useState(false);
  const [busy, setBusy] = useState(false);
  const run = withWorking(async () => {
    if (files.length < 2) return setStatus("Choose at least two PDFs to merge.", "error");
    setStatus("Merging PDFs…");
    const output = await PDFDocument.create();
    const bold = includeDividers ? await output.embedFont(StandardFonts.HelveticaBold) : null;
    let total = 0;
    for (const file of files) {
      if (includeDividers) {
        const divider = output.addPage([612, 792]);
        divider.drawText(safeBaseName(file.name), { x: 54, y: 396, size: 22, font: bold, color: rgb(0.06, 0.46, 0.43) });
      }
      const source = await PDFDocument.load(await file.arrayBuffer(), { ignoreEncryption: true });
      const pages = await output.copyPages(source, source.getPageIndices());
      pages.forEach((page) => output.addPage(page));
      total += pages.length;
    }
    const bytes = await output.save({ useObjectStreams: true });
    downloadBlob(new Blob([bytes], { type: "application/pdf" }), "merged.pdf");
    setStatus(`Merged ${files.length} files (${total} pages).`, "success");
  }, setBusy);

  return (
    <div className="toolCard" data-tool="merge">
      <ToolHeader icon={Files} title="Merge PDFs" description="Combine multiple PDFs into one ordered file." />
      <DropZone accept="application/pdf" multiple files={files} onFiles={setFiles} label="Drop PDFs here" hint="At least two files" />
      <label className="toggle"><input type="checkbox" checked={includeDividers} onChange={(e) => setIncludeDividers(e.target.checked)} /> Add a title divider before each file</label>
      <button className="btn btn-brand btn-block" onClick={run} disabled={busy || files.length < 2}>
        {busy ? <Spinner size={12} /> : <ArrowDownToLine size={14} />} Merge PDFs
      </button>
    </div>
  );
}

function SplitCard({ setStatus }) {
  const [file, setFile] = useState(null);
  const [pages, setPages] = useState("");
  const [busy, setBusy] = useState(false);
  const run = withWorking(async () => {
    if (!file) return setStatus("Choose a PDF first.", "error");
    if (!pages.trim()) return setStatus("Enter the pages to extract — try '1-3, 5'.", "error");
    setStatus("Extracting pages…");
    const source = await PDFDocument.load(await file.arrayBuffer(), { ignoreEncryption: true });
    const selected = getPageSelection(pages, source.getPageCount());
    const output = await PDFDocument.create();
    const copied = await output.copyPages(source, selected.map((p) => p - 1));
    copied.forEach((p) => output.addPage(p));
    const bytes = await output.save({ useObjectStreams: true });
    downloadBlob(new Blob([bytes], { type: "application/pdf" }), `${safeBaseName(file.name)}-pages.pdf`);
    setStatus(`Extracted ${selected.length} page${selected.length === 1 ? "" : "s"}.`, "success");
  }, setBusy);

  return (
    <div className="toolCard" data-tool="split">
      <ToolHeader icon={SplitSquareHorizontal} title="Extract pages" description="Pull selected pages into a new PDF." />
      <DropZone accept="application/pdf" files={file} onFiles={setFile} label="Drop a PDF" hint="Single file" />
      <label className="field"><span>Pages to keep</span><input value={pages} onChange={(e) => setPages(e.target.value)} placeholder="e.g. 1-3, 5, 8-10" /></label>
      <button className="btn btn-brand btn-block" onClick={run} disabled={busy || !file}>
        {busy ? <Spinner size={12} /> : <ArrowDownToLine size={14} />} Extract pages
      </button>
    </div>
  );
}

function OrganizeCard({ setStatus }) {
  const [file, setFile] = useState(null);
  const [order, setOrder] = useState("");
  const [busy, setBusy] = useState(false);
  const run = withWorking(async () => {
    if (!file) return setStatus("Choose a PDF first.", "error");
    if (!order.trim()) return setStatus("Enter the new page order — e.g. '3,1,2'.", "error");
    setStatus("Building reorganized PDF…");
    const source = await PDFDocument.load(await file.arrayBuffer(), { ignoreEncryption: true });
    const selected = getPageSelection(order, source.getPageCount());
    const output = await PDFDocument.create();
    const copied = await output.copyPages(source, selected.map((p) => p - 1));
    copied.forEach((p) => output.addPage(p));
    const bytes = await output.save({ useObjectStreams: true });
    downloadBlob(new Blob([bytes], { type: "application/pdf" }), `${safeBaseName(file.name)}-reordered.pdf`);
    setStatus(`Reordered to ${selected.length} page${selected.length === 1 ? "" : "s"}.`, "success");
  }, setBusy);

  return (
    <div className="toolCard" data-tool="organize">
      <ToolHeader icon={Layers3} title="Reorder & delete pages" description="Specify the exact page sequence — anything you omit is dropped." />
      <DropZone accept="application/pdf" files={file} onFiles={setFile} label="Drop a PDF" />
      <label className="field"><span>New page order</span><input value={order} onChange={(e) => setOrder(e.target.value)} placeholder="e.g. 3,1,2 or 1-2, 5-7" /></label>
      <button className="btn btn-brand btn-block" onClick={run} disabled={busy || !file}>
        {busy ? <Spinner size={12} /> : <ArrowDownToLine size={14} />} Build reordered PDF
      </button>
    </div>
  );
}

function RotateCard({ setStatus }) {
  const [file, setFile] = useState(null);
  const [pages, setPages] = useState("all");
  const [angle, setAngle] = useState(90);
  const [busy, setBusy] = useState(false);
  const run = withWorking(async () => {
    if (!file) return setStatus("Choose a PDF first.", "error");
    setStatus("Rotating pages…");
    const pdfDoc = await PDFDocument.load(await file.arrayBuffer(), { ignoreEncryption: true });
    const indexes = getPageSelection(pages, pdfDoc.getPageCount()).map((p) => p - 1);
    indexes.forEach((index) => {
      const page = pdfDoc.getPages()[index];
      const current = page.getRotation().angle || 0;
      page.setRotation(degrees((current + Number(angle)) % 360));
    });
    const bytes = await pdfDoc.save({ useObjectStreams: true });
    downloadBlob(new Blob([bytes], { type: "application/pdf" }), `${safeBaseName(file.name)}-rotated.pdf`);
    setStatus("Rotated PDF downloaded.", "success");
  }, setBusy);

  return (
    <div className="toolCard" data-tool="rotate">
      <ToolHeader icon={RotateCw} title="Rotate pages" description="Turn selected pages by 90, 180, or 270 degrees." />
      <DropZone accept="application/pdf" files={file} onFiles={setFile} label="Drop a PDF" />
      <div className="fieldRow">
        <label className="field"><span>Pages</span><input value={pages} onChange={(e) => setPages(e.target.value)} placeholder="all or 1-3" /></label>
        <label className="field"><span>Angle</span>
          <select value={angle} onChange={(e) => setAngle(e.target.value)}>
            <option value="90">90° clockwise</option>
            <option value="180">180°</option>
            <option value="270">90° counter-clockwise</option>
          </select>
        </label>
      </div>
      <button className="btn btn-brand btn-block" onClick={run} disabled={busy || !file}>
        {busy ? <Spinner size={12} /> : <ArrowDownToLine size={14} />} Rotate pages
      </button>
    </div>
  );
}

function CompressCard({ setStatus }) {
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState(null);
  const run = withWorking(async () => {
    if (!file) return setStatus("Choose a PDF first.", "error");
    setStatus("Re-saving with object streams…");
    const pdfDoc = await PDFDocument.load(await file.arrayBuffer(), { ignoreEncryption: true });
    const bytes = await pdfDoc.save({ useObjectStreams: true });
    const before = file.size;
    const after = bytes.byteLength;
    setReport({ before, after });
    downloadBlob(new Blob([bytes], { type: "application/pdf" }), `${safeBaseName(file.name)}-optimized.pdf`);
    const delta = ((before - after) / before) * 100;
    setStatus(`Saved — ${delta >= 0 ? `${delta.toFixed(1)}% smaller` : `${Math.abs(delta).toFixed(1)}% larger (already optimized)`}.`, "success");
  }, setBusy);

  return (
    <div className="toolCard" data-tool="compress">
      <ToolHeader icon={ArrowDownToLine} title="Compress / clean save" description="Re-encodes the PDF using object streams. Real shrinkage depends on the source." />
      <DropZone accept="application/pdf" files={file} onFiles={setFile} label="Drop a PDF" />
      {report && (
        <div className="totalsBox">
          <div><span>Original</span><strong>{(report.before / 1024).toFixed(1)} KB</strong></div>
          <div><span>Optimized</span><strong>{(report.after / 1024).toFixed(1)} KB</strong></div>
        </div>
      )}
      <button className="btn btn-brand btn-block" onClick={run} disabled={busy || !file}>
        {busy ? <Spinner size={12} /> : <ArrowDownToLine size={14} />} Compress &amp; download
      </button>
    </div>
  );
}

// ============================================================ Convert tools

function ImagesToPdfCard({ setStatus }) {
  const [files, setFiles] = useState([]);
  const [pagePreset, setPagePreset] = useState("letter");
  const [busy, setBusy] = useState(false);
  const run = withWorking(async () => {
    if (!files.length) return setStatus("Choose PNG or JPG images first.", "error");
    setStatus("Converting images to PDF…");
    const size = PAGE_PRESETS[pagePreset];
    const pdfDoc = await PDFDocument.create();
    const margin = 32;
    for (const file of files) {
      const dataUrl = await readFileAsDataUrl(file);
      const bytes = dataUrlToUint8Array(dataUrl);
      const image = file.type.includes("jpeg") || file.type.includes("jpg")
        ? await pdfDoc.embedJpg(bytes)
        : await pdfDoc.embedPng(bytes);
      const page = pdfDoc.addPage([size.width, size.height]);
      const availableWidth = size.width - margin * 2;
      const availableHeight = size.height - margin * 2;
      const scale = Math.min(availableWidth / image.width, availableHeight / image.height);
      const w = image.width * scale;
      const h = image.height * scale;
      page.drawImage(image, { x: (size.width - w) / 2, y: (size.height - h) / 2, width: w, height: h });
    }
    const bytes = await pdfDoc.save({ useObjectStreams: true });
    downloadBlob(new Blob([bytes], { type: "application/pdf" }), `images-${files.length}-pages.pdf`);
    setStatus(`Converted ${files.length} image${files.length === 1 ? "" : "s"} to PDF.`, "success");
  }, setBusy);

  return (
    <div className="toolCard" data-tool="img2pdf">
      <ToolHeader icon={FileImage} title="Images → PDF" description="Bundle PNG / JPG images into a clean PDF, one per page." />
      <DropZone accept="image/png,image/jpeg,image/jpg" multiple files={files} onFiles={setFiles} label="Drop images" hint="PNG or JPG" />
      <label className="field"><span>Page size</span>
        <select value={pagePreset} onChange={(e) => setPagePreset(e.target.value)}>
          {Object.entries(PAGE_PRESETS).map(([k, p]) => <option key={k} value={k}>{p.label}</option>)}
        </select>
      </label>
      <button className="btn btn-brand btn-block" onClick={run} disabled={busy || !files.length}>
        {busy ? <Spinner size={12} /> : <ArrowDownToLine size={14} />} Convert to PDF
      </button>
    </div>
  );
}

function PdfToPngCard({ setStatus }) {
  const [file, setFile] = useState(null);
  const [pages, setPages] = useState("all");
  const [busy, setBusy] = useState(false);
  const run = withWorking(async () => {
    if (!file) return setStatus("Choose a PDF first.", "error");
    setStatus("Rendering pages to PNG…");
    const buffer = await file.arrayBuffer();
    const document = await pdfjsLib.getDocument({ data: new Uint8Array(buffer.slice(0)) }).promise;
    const selected = getPageSelection(pages, document.numPages);
    const zip = new JSZip();
    try {
      for (const pageNumber of selected) {
        const { canvas } = await renderPdfPageToCanvas(document, pageNumber, 2);
        const blob = await canvasToBlob(canvas, "image/png", 0.95);
        zip.file(`${safeBaseName(file.name)}-page-${String(pageNumber).padStart(3, "0")}.png`, await blob.arrayBuffer());
      }
    } finally {
      document.destroy?.();
    }
    const zipped = await zip.generateAsync({ type: "blob" });
    downloadBlob(zipped, `${safeBaseName(file.name)}-pages.zip`);
    setStatus(`Exported ${selected.length} PNG${selected.length === 1 ? "" : "s"}.`, "success");
  }, setBusy);

  return (
    <div className="toolCard" data-tool="pdf2png">
      <ToolHeader icon={FileArchive} title="PDF → PNG zip" description="Export each selected page as a high-resolution PNG inside a zip." />
      <DropZone accept="application/pdf" files={file} onFiles={setFile} label="Drop a PDF" />
      <label className="field"><span>Pages</span><input value={pages} onChange={(e) => setPages(e.target.value)} placeholder="all or 1-5" /></label>
      <button className="btn btn-brand btn-block" onClick={run} disabled={busy || !file}>
        {busy ? <Spinner size={12} /> : <ArrowDownToLine size={14} />} Export PNG zip
      </button>
    </div>
  );
}

function PdfToDocxCard({ setStatus }) {
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const run = withWorking(async () => {
    if (!file) return setStatus("Choose a PDF first.", "error");
    setStatus("Extracting text…");
    const pages = await extractPdfText(file);
    const doc = new DocxDocument({
      sections: [{
        children: pages.flatMap((page) => [
          new Paragraph({ children: [new TextRun({ text: `Page ${page.pageNumber}`, bold: true })] }),
          new Paragraph({ children: [new TextRun(page.text || "[No extractable text on this page]")] }),
          new Paragraph({}),
        ]),
      }],
    });
    const blob = await Packer.toBlob(doc);
    downloadBlob(blob, `${safeBaseName(file.name)}.docx`);
    setStatus("DOCX downloaded.", "success");
  }, setBusy);

  return (
    <div className="toolCard" data-tool="pdf2docx">
      <ToolHeader icon={FileType2} title="PDF → Word (DOCX)" description="Extract readable text into a Word document, page-by-page." />
      <DropZone accept="application/pdf" files={file} onFiles={setFile} label="Drop a PDF" />
      <p className="miniText">Works on PDFs with extractable text. Scanned PDFs need <strong>OCR</strong> first.</p>
      <button className="btn btn-brand btn-block" onClick={run} disabled={busy || !file}>
        {busy ? <Spinner size={12} /> : <ArrowDownToLine size={14} />} Convert to DOCX
      </button>
    </div>
  );
}

function TextToPdfCard({ setStatus }) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [pagePreset, setPagePreset] = useState("letter");
  const [busy, setBusy] = useState(false);
  const run = withWorking(async () => {
    const cleanBody = body.replace(/<br\s*\/?>/gi, "\n").replace(/<\/(p|h1|h2|li)>/gi, "\n").replace(/<[^>]+>/g, "");
    if (!title.trim() && !cleanBody.trim()) return setStatus("Add a title or body content first.", "error");
    setStatus("Building PDF…");
    const size = PAGE_PRESETS[pagePreset];
    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const margin = 54;
    let page = pdfDoc.addPage([size.width, size.height]);
    let y = size.height - margin;
    if (title.trim()) {
      page.drawText(normalizePdfText(title), { x: margin, y, size: 22, font: bold, color: rgb(0.06, 0.07, 0.1) });
      y -= 36;
    }
    const lines = wrapText(font, normalizePdfText(cleanBody), 11, size.width - margin * 2);
    lines.forEach((line) => {
      if (y < margin) {
        page = pdfDoc.addPage([size.width, size.height]);
        y = size.height - margin;
      }
      page.drawText(line || " ", { x: margin, y, size: 11, font, color: rgb(0.06, 0.07, 0.1) });
      y -= 16;
    });
    const bytes = await pdfDoc.save({ useObjectStreams: true });
    downloadBlob(new Blob([bytes], { type: "application/pdf" }), `${safeBaseName(title || "document")}.pdf`);
    setStatus("PDF downloaded.", "success");
  }, setBusy);

  return (
    <div className="toolCard" data-tool="text2pdf">
      <ToolHeader icon={FileText} title="Text / HTML → PDF" description="Paste content and download a clean text PDF. Basic HTML tags are stripped." />
      <div className="fieldRow">
        <label className="field"><span>Title</span><input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Document title" /></label>
        <label className="field"><span>Page size</span>
          <select value={pagePreset} onChange={(e) => setPagePreset(e.target.value)}>
            {Object.entries(PAGE_PRESETS).map(([k, p]) => <option key={k} value={k}>{p.label}</option>)}
          </select>
        </label>
      </div>
      <label className="field"><span>Content</span><textarea rows={6} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Paste or type the document body here…" /></label>
      <button className="btn btn-brand btn-block" onClick={run} disabled={busy}>
        {busy ? <Spinner size={12} /> : <ArrowDownToLine size={14} />} Create PDF
      </button>
    </div>
  );
}

// ============================================================ Generate tools

function InvoiceCard({ brand, setStatus }) {
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [issueDate, setIssueDate] = useState(new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState("");
  const [from, setFrom] = useState(brand?.companyName ? [brand.companyName, brand.contactLine].filter(Boolean).join("\n") : "");
  const [to, setTo] = useState("");
  const [notes, setNotes] = useState("");
  const [taxRate, setTaxRate] = useState(0);
  const [items, setItems] = useState([{ id: makeId(), description: "", qty: 1, rate: 0 }]);
  const [busy, setBusy] = useState(false);

  const totals = useMemo(() => {
    const subtotal = items.reduce((sum, item) => sum + (Number(item.qty) || 0) * (Number(item.rate) || 0), 0);
    const tax = subtotal * ((Number(taxRate) || 0) / 100);
    return { subtotal, tax, total: subtotal + tax };
  }, [items, taxRate]);

  const updateItem = (id, patch) => setItems((current) => current.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  const addItem = () => setItems((current) => [...current, { id: makeId(), description: "", qty: 1, rate: 0 }]);
  const removeItem = (id) => setItems((current) => current.filter((it) => it.id !== id));

  const run = withWorking(async () => {
    if (!items.some((it) => it.description.trim() || Number(it.rate) > 0)) {
      return setStatus("Add at least one line item.", "error");
    }
    setStatus("Building invoice…");
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([612, 792]);
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const accent = hexToRgb(brand?.primaryColor || "#0f766e");

    page.drawRectangle({ x: 0, y: 700, width: 612, height: 92, color: accent });
    page.drawText("Invoice", { x: 54, y: 744, size: 26, font: bold, color: rgb(1, 1, 1) });
    if (invoiceNumber) page.drawText(`# ${normalizePdfText(invoiceNumber)}`, { x: 430, y: 748, size: 12, font: bold, color: rgb(1, 1, 1) });
    page.drawText(`Issued ${issueDate}`, { x: 430, y: 728, size: 9, font, color: rgb(0.92, 1, 0.98) });
    if (dueDate) page.drawText(`Due ${dueDate}`, { x: 430, y: 714, size: 9, font, color: rgb(0.92, 1, 0.98) });

    // Brand logo
    if (brand?.logo?.src) {
      try {
        const bytes = dataUrlToUint8Array(brand.logo.src);
        const lower = `${brand.logo.mime || ""} ${brand.logo.src.slice(0, 40)}`.toLowerCase();
        const image = lower.includes("jpg") || lower.includes("jpeg") ? await pdfDoc.embedJpg(bytes) : await pdfDoc.embedPng(bytes);
        page.drawImage(image, { x: 510, y: 715, width: 60, height: 60, opacity: 0.95 });
      } catch (_) { /* ignore */ }
    }

    const drawMultiline = (text, x, startY, label) => {
      page.drawText(label, { x, y: startY, size: 9, font: bold, color: rgb(0.36, 0.42, 0.48) });
      let lineY = startY - 18;
      normalizePdfText(text).split(/\n+/).slice(0, 6).forEach((line) => {
        page.drawText(line, { x, y: lineY, size: 9.5, font, color: rgb(0.06, 0.07, 0.1), maxWidth: 220 });
        lineY -= 14;
      });
    };
    if (from.trim()) drawMultiline(from, 54, 660, "From");
    if (to.trim()) drawMultiline(to, 340, 660, "Bill to");

    page.drawRectangle({ x: 54, y: 500, width: 504, height: 26, color: rgb(0.92, 0.96, 0.97) });
    page.drawText("Description", { x: 64, y: 509, size: 9, font: bold });
    page.drawText("Qty", { x: 340, y: 509, size: 9, font: bold });
    page.drawText("Rate", { x: 405, y: 509, size: 9, font: bold });
    page.drawText("Amount", { x: 492, y: 509, size: 9, font: bold });

    let y = 474;
    items.forEach((item) => {
      const qty = Number(item.qty) || 0;
      const rate = Number(item.rate) || 0;
      const lineTotal = qty * rate;
      page.drawText(normalizePdfText(item.description || "—"), { x: 64, y, size: 10, font, color: rgb(0.06, 0.07, 0.1), maxWidth: 245 });
      page.drawText(String(qty), { x: 342, y, size: 10, font });
      page.drawText(`$${rate.toFixed(2)}`, { x: 405, y, size: 10, font });
      page.drawText(`$${lineTotal.toFixed(2)}`, { x: 492, y, size: 10, font });
      y -= 24;
    });

    const totalsY = Math.max(150, y - 12);
    page.drawLine({ start: { x: 340, y: totalsY }, end: { x: 558, y: totalsY }, thickness: 1, color: rgb(0.75, 0.82, 0.86) });
    page.drawText(`Subtotal: $${totals.subtotal.toFixed(2)}`, { x: 410, y: totalsY - 22, size: 10, font });
    if (Number(taxRate) > 0) {
      page.drawText(`Tax (${Number(taxRate).toFixed(2)}%): $${totals.tax.toFixed(2)}`, { x: 410, y: totalsY - 40, size: 10, font });
    }
    page.drawText(`Total: $${totals.total.toFixed(2)}`, { x: 410, y: totalsY - 64, size: 15, font: bold, color: rgb(0.06, 0.07, 0.1) });

    if (notes.trim()) {
      page.drawText("Notes", { x: 54, y: 120, size: 10, font: bold, color: rgb(0.36, 0.42, 0.48) });
      wrapText(font, normalizePdfText(notes), 9.5, 300).slice(0, 6).forEach((line, index) => {
        page.drawText(line, { x: 54, y: 102 - index * 13, size: 9.5, font, color: rgb(0.06, 0.07, 0.1) });
      });
    }

    const bytes = await pdfDoc.save({ useObjectStreams: true });
    downloadBlob(new Blob([bytes], { type: "application/pdf" }), `${safeBaseName(invoiceNumber || "invoice")}.pdf`);
    setStatus("Invoice downloaded.", "success");
  }, setBusy);

  return (
    <div className="toolCard" data-tool="invoice" style={{ gridColumn: "span 2" }}>
      <ToolHeader icon={Receipt} title="Invoice generator" description="Build a professional invoice with real line items. From/To populate from your brand if set." />
      <div className="fieldRow">
        <label className="field"><span>Invoice number</span><input value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} placeholder="e.g. 2026-001" /></label>
        <label className="field"><span>Issue date</span><input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} /></label>
        <label className="field"><span>Due date</span><input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} /></label>
        <label className="field"><span>Tax rate %</span><input type="number" min="0" step="0.01" value={taxRate} onChange={(e) => setTaxRate(e.target.value)} placeholder="0" /></label>
      </div>
      <div className="fieldRow">
        <label className="field"><span>From</span><textarea rows={4} value={from} onChange={(e) => setFrom(e.target.value)} placeholder={"Your company name\nStreet address\nemail@example.com"} /></label>
        <label className="field"><span>Bill to</span><textarea rows={4} value={to} onChange={(e) => setTo(e.target.value)} placeholder={"Client / company name\nStreet address\nemail@example.com"} /></label>
      </div>
      <label className="field">
        <span>Line items</span>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div className="lineTable">
            <span className="lineHead">Description</span>
            <span className="lineHead">Qty</span>
            <span className="lineHead">Rate</span>
            <span className="lineHead">Amount</span>
            <span></span>
          </div>
          {items.map((item) => {
            const amount = (Number(item.qty) || 0) * (Number(item.rate) || 0);
            return (
              <div className="lineTable" key={item.id}>
                <input value={item.description} onChange={(e) => updateItem(item.id, { description: e.target.value })} placeholder="Item description" />
                <input type="number" min="0" value={item.qty} onChange={(e) => updateItem(item.id, { qty: e.target.value })} />
                <input type="number" min="0" step="0.01" value={item.rate} onChange={(e) => updateItem(item.id, { rate: e.target.value })} />
                <input value={`$${amount.toFixed(2)}`} disabled />
                <button onClick={() => removeItem(item.id)} aria-label="Remove line item"><Trash2 size={13} /></button>
              </div>
            );
          })}
          <button className="btn btn-soft btn-sm" onClick={addItem} style={{ alignSelf: "flex-start" }}><Plus size={13} /> Add line item</button>
        </div>
      </label>
      <label className="field"><span>Notes (optional)</span><textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Payment terms, thank-you, account details…" /></label>
      <div className="totalsBox">
        <div><span>Subtotal</span><strong>${totals.subtotal.toFixed(2)}</strong></div>
        {Number(taxRate) > 0 && <div><span>Tax ({Number(taxRate).toFixed(2)}%)</span><strong>${totals.tax.toFixed(2)}</strong></div>}
        <div className="grandTotal"><span>Total</span><strong>${totals.total.toFixed(2)}</strong></div>
      </div>
      <button className="btn btn-brand btn-block" onClick={run} disabled={busy}>
        {busy ? <Spinner size={12} /> : <ArrowDownToLine size={14} />} Download invoice
      </button>
    </div>
  );
}

function CsvCard({ setStatus }) {
  const [title, setTitle] = useState("");
  const [csv, setCsv] = useState("");
  const [busy, setBusy] = useState(false);
  const run = withWorking(async () => {
    const rows = parseCsvRows(csv);
    if (!rows.length) return setStatus("Paste at least one CSV row.", "error");
    setStatus("Building report…");
    const pdfDoc = await PDFDocument.create();
    let page = pdfDoc.addPage([792, 612]);
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const drawHeader = () => {
      page.drawRectangle({ x: 0, y: 548, width: 792, height: 64, color: rgb(0.06, 0.46, 0.43) });
      page.drawText(normalizePdfText(title || "Report"), { x: 36, y: 572, size: 20, font: bold, color: rgb(1, 1, 1) });
      page.drawText(`${Math.max(0, rows.length - 1)} data row(s)`, { x: 36, y: 554, size: 9, font, color: rgb(0.88, 1, 0.98) });
    };
    drawHeader();
    const margin = 36;
    const columnCount = Math.max(1, Math.min(rows[0].length, 8));
    const columnWidth = (792 - margin * 2) / columnCount;
    let y = 512;
    rows.forEach((row, rowIndex) => {
      if (y < 44) { page = pdfDoc.addPage([792, 612]); drawHeader(); y = 512; }
      if (rowIndex === 0) {
        page.drawRectangle({ x: margin - 4, y: y - 6, width: 792 - margin * 2 + 8, height: 22, color: rgb(0.92, 0.96, 0.97) });
      }
      row.forEach((cell, colIndex) => {
        if (colIndex >= columnCount) return;
        page.drawText(cell.slice(0, 36), {
          x: margin + colIndex * columnWidth, y, size: 8.5,
          font: rowIndex === 0 ? bold : font, color: rgb(0.06, 0.07, 0.1),
          maxWidth: columnWidth - 8,
        });
      });
      y -= 23;
    });
    const bytes = await pdfDoc.save({ useObjectStreams: true });
    downloadBlob(new Blob([bytes], { type: "application/pdf" }), `${safeBaseName(title || "table-report")}.pdf`);
    setStatus("Report PDF downloaded.", "success");
  }, setBusy);

  return (
    <div className="toolCard" data-tool="csv">
      <ToolHeader icon={ClipboardList} title="CSV → table report" description="Paste comma-separated data and export a formatted table PDF (first row becomes the header)." />
      <label className="field"><span>Report title</span><input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Report name" /></label>
      <label className="field"><span>CSV</span><textarea rows={6} value={csv} onChange={(e) => setCsv(e.target.value)} placeholder={"Header,Header,Header\nValue,Value,Value\nValue,Value,Value"} style={{ fontFamily: "ui-monospace, SFMono-Regular, monospace", fontSize: "0.82rem" }} /></label>
      <button className="btn btn-brand btn-block" onClick={run} disabled={busy}>
        {busy ? <Spinner size={12} /> : <ArrowDownToLine size={14} />} Create report
      </button>
    </div>
  );
}

// ============================================================ Protect & Polish

function RedactCard({ setStatus }) {
  const [file, setFile] = useState(null);
  const [pages, setPages] = useState("all");
  const [rect, setRect] = useState({ x: 10, y: 10, width: 30, height: 8 });
  const [busy, setBusy] = useState(false);
  const updateRect = (key) => (e) => setRect((r) => ({ ...r, [key]: Number(e.target.value) || 0 }));
  const run = withWorking(async () => {
    if (!file) return setStatus("Choose a PDF first.", "error");
    setStatus("Rendering pages and burning in redactions…");
    const buffer = await file.arrayBuffer();
    const document = await pdfjsLib.getDocument({ data: new Uint8Array(buffer.slice(0)) }).promise;
    const selected = new Set(getPageSelection(pages, document.numPages));
    const output = await PDFDocument.create();
    try {
      for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
        const { canvas, viewport } = await renderPdfPageToCanvas(document, pageNumber, 2);
        if (selected.has(pageNumber)) {
          const ctx = canvas.getContext("2d");
          ctx.fillStyle = "#000000";
          ctx.fillRect(
            (rect.x / 100) * canvas.width,
            (rect.y / 100) * canvas.height,
            (rect.width / 100) * canvas.width,
            (rect.height / 100) * canvas.height
          );
        }
        const png = await output.embedPng(await (await canvasToBlob(canvas)).arrayBuffer());
        const page = output.addPage([viewport.width / 2, viewport.height / 2]);
        page.drawImage(png, { x: 0, y: 0, width: page.getWidth(), height: page.getHeight() });
      }
    } finally {
      document.destroy?.();
    }
    const bytes = await output.save({ useObjectStreams: true });
    downloadBlob(new Blob([bytes], { type: "application/pdf" }), `${safeBaseName(file.name)}-redacted.pdf`);
    setStatus("Redacted PDF downloaded — output is image-only by design.", "success");
  }, setBusy);

  return (
    <div className="toolCard" data-tool="redact">
      <ToolHeader icon={Eraser} title="Redact (burn-in)" description="Rasterizes pages and burns in a black box — text becomes unrecoverable." />
      <DropZone accept="application/pdf" files={file} onFiles={setFile} label="Drop a PDF" />
      <label className="field"><span>Apply to pages</span><input value={pages} onChange={(e) => setPages(e.target.value)} placeholder="all or 1-2" /></label>
      <div className="field"><span>Redaction box (% of page)</span>
        <div className="fieldRow">
          <label className="field"><span>X %</span><input type="number" min="0" max="100" value={rect.x} onChange={updateRect("x")} /></label>
          <label className="field"><span>Y %</span><input type="number" min="0" max="100" value={rect.y} onChange={updateRect("y")} /></label>
          <label className="field"><span>W %</span><input type="number" min="0" max="100" value={rect.width} onChange={updateRect("width")} /></label>
          <label className="field"><span>H %</span><input type="number" min="0" max="100" value={rect.height} onChange={updateRect("height")} /></label>
        </div>
      </div>
      <button className="btn btn-brand btn-block" onClick={run} disabled={busy || !file}>
        {busy ? <Spinner size={12} /> : <ArrowDownToLine size={14} />} Burn redaction
      </button>
    </div>
  );
}

function WatermarkCard({ brand, setStatus }) {
  const [file, setFile] = useState(null);
  const [text, setText] = useState("");
  const [pages, setPages] = useState("all");
  const [busy, setBusy] = useState(false);
  const run = withWorking(async () => {
    if (!file) return setStatus("Choose a PDF first.", "error");
    if (!text.trim()) return setStatus("Enter watermark text.", "error");
    setStatus("Applying watermark…");
    const pdfDoc = await PDFDocument.load(await file.arrayBuffer(), { ignoreEncryption: true });
    const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const indexes = getPageSelection(pages, pdfDoc.getPageCount()).map((p) => p - 1);
    const accent = hexToRgb(brand?.accentColor || "#7c3aed");
    indexes.forEach((index) => {
      const page = pdfDoc.getPages()[index];
      const { width, height } = page.getSize();
      page.drawText(normalizePdfText(text), {
        x: width * 0.18, y: height * 0.47,
        size: Math.min(width, height) * 0.085,
        font, color: accent, opacity: 0.18, rotate: degrees(35),
      });
    });
    const bytes = await pdfDoc.save({ useObjectStreams: true });
    downloadBlob(new Blob([bytes], { type: "application/pdf" }), `${safeBaseName(file.name)}-watermarked.pdf`);
    setStatus("Watermarked PDF downloaded.", "success");
  }, setBusy);

  return (
    <div className="toolCard" data-tool="watermark">
      <ToolHeader icon={Brush} title="Add watermark" description="Stamp text diagonally across selected pages. Color uses your brand accent." />
      <DropZone accept="application/pdf" files={file} onFiles={setFile} label="Drop a PDF" />
      <div className="fieldRow">
        <label className="field"><span>Watermark text</span><input value={text} onChange={(e) => setText(e.target.value)} placeholder="e.g. DRAFT, CONFIDENTIAL, PAID" /></label>
        <label className="field"><span>Pages</span><input value={pages} onChange={(e) => setPages(e.target.value)} placeholder="all or 1-3" /></label>
      </div>
      <button className="btn btn-brand btn-block" onClick={run} disabled={busy || !file}>
        {busy ? <Spinner size={12} /> : <ArrowDownToLine size={14} />} Apply watermark
      </button>
    </div>
  );
}

function HeaderFooterCard({ setStatus }) {
  const [file, setFile] = useState(null);
  const [header, setHeader] = useState("");
  const [footer, setFooter] = useState("");
  const [includePageNumbers, setIncludePageNumbers] = useState(true);
  const [pages, setPages] = useState("all");
  const [busy, setBusy] = useState(false);
  const run = withWorking(async () => {
    if (!file) return setStatus("Choose a PDF first.", "error");
    if (!header.trim() && !footer.trim() && !includePageNumbers) return setStatus("Enter header, footer, or enable page numbers.", "error");
    setStatus("Applying header/footer…");
    const pdfDoc = await PDFDocument.load(await file.arrayBuffer(), { ignoreEncryption: true });
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const indexes = getPageSelection(pages, pdfDoc.getPageCount()).map((p) => p - 1);
    const total = pdfDoc.getPageCount();
    indexes.forEach((index) => {
      const page = pdfDoc.getPages()[index];
      const { width, height } = page.getSize();
      if (header.trim()) {
        page.drawText(normalizePdfText(header), { x: 36, y: height - 28, size: 9, font: bold, color: rgb(0.06, 0.16, 0.18), maxWidth: width - 72 });
        page.drawLine({ start: { x: 36, y: height - 34 }, end: { x: width - 36, y: height - 34 }, thickness: 0.7, color: rgb(0.75, 0.82, 0.86) });
      }
      if (footer.trim() || includePageNumbers) {
        page.drawLine({ start: { x: 36, y: 32 }, end: { x: width - 36, y: 32 }, thickness: 0.7, color: rgb(0.75, 0.82, 0.86) });
      }
      if (footer.trim()) {
        page.drawText(normalizePdfText(footer), { x: 36, y: 18, size: 8, font, color: rgb(0.36, 0.42, 0.48), maxWidth: width - 120 });
      }
      if (includePageNumbers) {
        page.drawText(`${index + 1} / ${total}`, { x: width - 72, y: 18, size: 8, font, color: rgb(0.36, 0.42, 0.48) });
      }
    });
    const bytes = await pdfDoc.save({ useObjectStreams: true });
    downloadBlob(new Blob([bytes], { type: "application/pdf" }), `${safeBaseName(file.name)}-header-footer.pdf`);
    setStatus("Header/footer PDF downloaded.", "success");
  }, setBusy);

  return (
    <div className="toolCard" data-tool="headfoot">
      <ToolHeader icon={Stamp} title="Headers & footers" description="Add a header line, footer line, and page numbers to every selected page." />
      <DropZone accept="application/pdf" files={file} onFiles={setFile} label="Drop a PDF" />
      <label className="field"><span>Header text</span><input value={header} onChange={(e) => setHeader(e.target.value)} placeholder="Optional header" /></label>
      <label className="field"><span>Footer text</span><input value={footer} onChange={(e) => setFooter(e.target.value)} placeholder="Optional footer" /></label>
      <div className="fieldRow">
        <label className="field"><span>Pages</span><input value={pages} onChange={(e) => setPages(e.target.value)} placeholder="all or 1-3" /></label>
        <label className="toggle" style={{ alignSelf: "end" }}><input type="checkbox" checked={includePageNumbers} onChange={(e) => setIncludePageNumbers(e.target.checked)} /> Page numbers</label>
      </div>
      <button className="btn btn-brand btn-block" onClick={run} disabled={busy || !file}>
        {busy ? <Spinner size={12} /> : <ArrowDownToLine size={14} />} Apply header/footer
      </button>
    </div>
  );
}

function BatesCard({ setStatus }) {
  const [file, setFile] = useState(null);
  const [prefix, setPrefix] = useState("");
  const [start, setStart] = useState(1);
  const [padding, setPadding] = useState(5);
  const [busy, setBusy] = useState(false);
  const run = withWorking(async () => {
    if (!file) return setStatus("Choose a PDF first.", "error");
    setStatus("Adding Bates numbers…");
    const pdfDoc = await PDFDocument.load(await file.arrayBuffer(), { ignoreEncryption: true });
    const font = await pdfDoc.embedFont(StandardFonts.CourierBold);
    const pages = pdfDoc.getPages();
    pages.forEach((page, index) => {
      const { width } = page.getSize();
      const number = String(Number(start) + index).padStart(clamp(Number(padding), 2, 12), "0");
      const label = prefix ? `${normalizePdfText(prefix)}-${number}` : number;
      page.drawText(label, { x: width - 122, y: 42, size: 9, font, color: rgb(0.06, 0.16, 0.18) });
    });
    const bytes = await pdfDoc.save({ useObjectStreams: true });
    downloadBlob(new Blob([bytes], { type: "application/pdf" }), `${safeBaseName(file.name)}-bates.pdf`);
    setStatus("Bates-numbered PDF downloaded.", "success");
  }, setBusy);

  return (
    <div className="toolCard" data-tool="bates">
      <ToolHeader icon={Hash} title="Bates numbering" description="Stamp sequential reference numbers on every page (legal/discovery format)." />
      <DropZone accept="application/pdf" files={file} onFiles={setFile} label="Drop a PDF" />
      <div className="fieldRow">
        <label className="field"><span>Prefix</span><input value={prefix} onChange={(e) => setPrefix(e.target.value)} placeholder="optional" /></label>
        <label className="field"><span>Start</span><input type="number" min="1" value={start} onChange={(e) => setStart(e.target.value)} /></label>
        <label className="field"><span>Padding</span><input type="number" min="2" max="12" value={padding} onChange={(e) => setPadding(e.target.value)} /></label>
      </div>
      <button className="btn btn-brand btn-block" onClick={run} disabled={busy || !file}>
        {busy ? <Spinner size={12} /> : <ArrowDownToLine size={14} />} Number pages
      </button>
    </div>
  );
}

function MetadataCard({ brand, setStatus }) {
  const [file, setFile] = useState(null);
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState(brand?.companyName || "");
  const [busy, setBusy] = useState(false);
  const run = withWorking(async () => {
    if (!file) return setStatus("Choose a PDF first.", "error");
    setStatus("Applying metadata…");
    const pdfDoc = await PDFDocument.load(await file.arrayBuffer(), { ignoreEncryption: true });
    if (title) pdfDoc.setTitle(normalizePdfText(title));
    if (author) pdfDoc.setAuthor(normalizePdfText(author));
    pdfDoc.setProducer("PrismPDF Studio");
    pdfDoc.setCreator("PrismPDF Studio");
    pdfDoc.setModificationDate(new Date());
    const bytes = await pdfDoc.save({ useObjectStreams: true });
    downloadBlob(new Blob([bytes], { type: "application/pdf" }), `${safeBaseName(file.name)}-metadata.pdf`);
    setStatus("Metadata-updated PDF downloaded.", "success");
  }, setBusy);

  return (
    <div className="toolCard" data-tool="metadata">
      <ToolHeader icon={FileText} title="Edit metadata" description="Set the document title and author shown by readers and search engines." />
      <DropZone accept="application/pdf" files={file} onFiles={setFile} label="Drop a PDF" />
      <div className="fieldRow">
        <label className="field"><span>Title</span><input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Document title" /></label>
        <label className="field"><span>Author</span><input value={author} onChange={(e) => setAuthor(e.target.value)} placeholder="Author / org" /></label>
      </div>
      <button className="btn btn-brand btn-block" onClick={run} disabled={busy || !file}>
        {busy ? <Spinner size={12} /> : <ArrowDownToLine size={14} />} Apply metadata
      </button>
    </div>
  );
}

// ============================================================ Read & Search

function SearchCard({ setStatus }) {
  const [file, setFile] = useState(null);
  const [term, setTerm] = useState("");
  const [busy, setBusy] = useState(false);
  const run = withWorking(async () => {
    if (!file) return setStatus("Choose a PDF first.", "error");
    if (!term.trim()) return setStatus("Enter a word or phrase to search for.", "error");
    setStatus("Searching extractable text…");
    const pages = await extractPdfText(file);
    const matches = pages.filter((page) => page.text.toLowerCase().includes(term.toLowerCase()));
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([612, 792]);
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    page.drawText(`Search report: "${normalizePdfText(term)}"`, { x: 54, y: 730, size: 16, font: bold, color: rgb(0.06, 0.16, 0.18) });
    page.drawText(`${matches.length} matching page${matches.length === 1 ? "" : "s"} of ${pages.length}`, { x: 54, y: 712, size: 10, font, color: rgb(0.36, 0.42, 0.48) });
    let y = 680;
    matches.forEach((match) => {
      const idx = match.text.toLowerCase().indexOf(term.toLowerCase());
      const snippet = normalizePdfText(match.text.slice(Math.max(0, idx - 80), idx + 200));
      if (y < 80) return;
      page.drawText(`Page ${match.pageNumber}`, { x: 54, y, size: 11, font: bold, color: rgb(0.48, 0.23, 0.93) });
      y -= 18;
      wrapText(font, snippet, 9, 500).slice(0, 4).forEach((line) => {
        page.drawText(line, { x: 68, y, size: 9, font, color: rgb(0.06, 0.07, 0.1) });
        y -= 13;
      });
      y -= 10;
    });
    const bytes = await pdfDoc.save({ useObjectStreams: true });
    downloadBlob(new Blob([bytes], { type: "application/pdf" }), `${safeBaseName(file.name)}-search-report.pdf`);
    setStatus(`Found ${matches.length} matching page${matches.length === 1 ? "" : "s"}.`, "success");
  }, setBusy);

  return (
    <div className="toolCard" data-tool="search">
      <ToolHeader icon={Search} title="Search & highlight report" description="Find a term across pages and download a snippet report." />
      <DropZone accept="application/pdf" files={file} onFiles={setFile} label="Drop a PDF" />
      <label className="field"><span>Search term</span><input value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Word or phrase to find" /></label>
      <button className="btn btn-brand btn-block" onClick={run} disabled={busy || !file}>
        {busy ? <Spinner size={12} /> : <ArrowDownToLine size={14} />} Search & download report
      </button>
    </div>
  );
}

function OcrCard({ setStatus }) {
  const [file, setFile] = useState(null);
  const [language, setLanguage] = useState("eng");
  const [pages, setPages] = useState("1");
  const [busy, setBusy] = useState(false);
  const run = withWorking(async () => {
    if (!file) return setStatus("Choose a PDF first.", "error");
    setStatus("Running OCR — this can take a while…");
    const buffer = await file.arrayBuffer();
    const document = await pdfjsLib.getDocument({ data: new Uint8Array(buffer.slice(0)) }).promise;
    const output = await PDFDocument.create();
    const font = await output.embedFont(StandardFonts.Helvetica);
    const selected = getPageSelection(pages, document.numPages).slice(0, 10);
    const worker = await createWorker(language);
    try {
      for (const pageNumber of selected) {
        const { canvas, viewport } = await renderPdfPageToCanvas(document, pageNumber, 1.5);
        const pngBlob = await canvasToBlob(canvas);
        const result = await worker.recognize(pngBlob);
        const embedded = await output.embedPng(await pngBlob.arrayBuffer());
        const page = output.addPage([viewport.width / 1.5, viewport.height / 1.5]);
        page.drawImage(embedded, { x: 0, y: 0, width: page.getWidth(), height: page.getHeight() });
        const lines = wrapText(font, normalizePdfText(result.data.text || ""), 8, page.getWidth() - 50);
        let y = page.getHeight() - 40;
        lines.slice(0, 90).forEach((line) => {
          page.drawText(line || " ", { x: 24, y, size: 8, font, color: rgb(1, 1, 1), opacity: 0.01 });
          y -= 10;
        });
      }
    } finally {
      await worker.terminate();
      document.destroy?.();
    }
    const bytes = await output.save({ useObjectStreams: true });
    downloadBlob(new Blob([bytes], { type: "application/pdf" }), `${safeBaseName(file.name)}-searchable.pdf`);
    setStatus("Searchable OCR PDF downloaded.", "success");
  }, setBusy);

  return (
    <div className="toolCard" data-tool="ocr">
      <ToolHeader icon={ScanLine} title="OCR — make searchable" description="Recognizes text in scanned pages and embeds an invisible text layer so the PDF becomes searchable." />
      <DropZone accept="application/pdf" files={file} onFiles={setFile} label="Drop a scanned PDF" />
      <div className="fieldRow">
        <label className="field"><span>Pages (max 10)</span><input value={pages} onChange={(e) => setPages(e.target.value)} placeholder="1-3 or 1" /></label>
        <label className="field"><span>Language code</span><input value={language} onChange={(e) => setLanguage(e.target.value)} placeholder="eng, deu, fra…" /></label>
      </div>
      <p className="miniText">OCR runs locally in your browser. Large jobs are slow and use significant memory.</p>
      <button className="btn btn-brand btn-block" onClick={run} disabled={busy || !file}>
        {busy ? <Spinner size={12} /> : <ArrowDownToLine size={14} />} Run OCR & download
      </button>
    </div>
  );
}

// ============================================================ Tools panel

const CATEGORY_TOOLS = {
  organize: ({ brand, setStatus }) => (
    <>
      <MergeCard setStatus={setStatus} />
      <SplitCard setStatus={setStatus} />
      <OrganizeCard setStatus={setStatus} />
      <RotateCard setStatus={setStatus} />
      <CompressCard setStatus={setStatus} />
    </>
  ),
  convert: ({ brand, setStatus }) => (
    <>
      <ImagesToPdfCard setStatus={setStatus} />
      <PdfToPngCard setStatus={setStatus} />
      <PdfToDocxCard setStatus={setStatus} />
      <TextToPdfCard setStatus={setStatus} />
    </>
  ),
  generate: ({ brand, setStatus }) => (
    <>
      <InvoiceCard brand={brand} setStatus={setStatus} />
      <CsvCard setStatus={setStatus} />
    </>
  ),
  protect: ({ brand, setStatus }) => (
    <>
      <RedactCard setStatus={setStatus} />
      <WatermarkCard brand={brand} setStatus={setStatus} />
      <HeaderFooterCard setStatus={setStatus} />
      <BatesCard setStatus={setStatus} />
      <MetadataCard brand={brand} setStatus={setStatus} />
    </>
  ),
  read: ({ brand, setStatus }) => (
    <>
      <SearchCard setStatus={setStatus} />
      <OcrCard setStatus={setStatus} />
    </>
  ),
};

export default function ToolsPanel({ brand, setStatus, focusToolId, onFocusHandled }) {
  const [activeCategory, setActiveCategory] = useState("organize");
  const viewRef = useRef(null);

  // Jump to a specific tool from the command palette
  useMemo(() => {
    if (!focusToolId) return;
    const tool = TOOL_REGISTRY.find((t) => t.id === focusToolId);
    if (!tool) return;
    const targetCategory = CATEGORIES.find((c) => c.label === tool.category)?.id;
    if (targetCategory) setActiveCategory(targetCategory);
    setTimeout(() => {
      const node = viewRef.current?.querySelector(`[data-tool="${focusToolId}"]`);
      if (node) {
        node.scrollIntoView({ behavior: "smooth", block: "center" });
        node.style.animation = "none";
        node.offsetWidth; // reflow
        node.style.animation = "modalIn 400ms cubic-bezier(0.32, 0.72, 0.32, 1)";
      }
      onFocusHandled?.();
    }, 80);
  }, [focusToolId]);

  const Render = CATEGORY_TOOLS[activeCategory];
  const meta = CATEGORIES.find((c) => c.id === activeCategory);

  return (
    <div className="workArea">
      <aside className="categoryRail">
        <div className="railEyebrow">Categories</div>
        {CATEGORIES.map((cat) => {
          const Icon = cat.icon;
          const count = TOOL_REGISTRY.filter((t) => t.category === cat.label).length;
          return (
            <button
              key={cat.id}
              className={`catButton ${cat.id === activeCategory ? "active" : ""}`}
              onClick={() => setActiveCategory(cat.id)}
            >
              <Icon size={16} /> {cat.label}
              <span className="badge">{count}</span>
            </button>
          );
        })}
      </aside>
      <div className="categoryView" ref={viewRef}>
        <div className="categoryHeader">
          <div>
            <h2>{meta.label}</h2>
            <p>{meta.blurb}</p>
          </div>
          <span className="miniText">Press <kbd style={{ fontFamily: "ui-monospace, monospace", background: "var(--panel)", border: "1px solid var(--line)", padding: "2px 6px", borderRadius: 5 }}>⌘K</kbd> to jump to any tool</span>
        </div>
        <div className="toolGrid">
          <Render brand={brand} setStatus={setStatus} />
        </div>
      </div>
    </div>
  );
}
