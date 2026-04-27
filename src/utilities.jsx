import { useEffect, useMemo, useRef, useState } from "react";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import JSZip from "jszip";
import QRCode from "qrcode";
import { marked } from "marked";
import {
  Award,
  Binary,
  Briefcase,
  CalendarClock,
  CaseSensitive,
  ClipboardCheck,
  Code2,
  Diff,
  FileBadge,
  FileCheck2,
  FileImage,
  FileJson,
  FileText,
  Fingerprint,
  Hash,
  ImagePlus,
  KeyRound,
  Link2,
  Lock,
  Maximize2,
  Palette,
  PencilRuler,
  QrCode,
  Quote,
  Receipt,
  Regex,
  Ruler,
  ScrollText,
  Shuffle,
  SquareTerminal,
  Type,
  WandSparkles,
} from "lucide-react";
import {
  DropZone,
  Spinner,
  ToolHeader,
  canvasToBlob,
  clamp,
  dataUrlToUint8Array,
  downloadBlob,
  hexToRgb,
  makeId,
  normalizePdfText,
  readFileAsDataUrl,
  safeBaseName,
  withWorking,
  wrapText,
} from "./lib.jsx";
import { ArrowDownToLine, Plus, Trash2 } from "lucide-react";

// ============================================================ Categories & registry

export const UTILITY_CATEGORIES = [
  { id: "images",   label: "Images & Media", icon: FileImage,   blurb: "Compress, convert, resize, and prepare images entirely in your browser." },
  { id: "data",     label: "Text & Data",    icon: Code2,       blurb: "JSON, CSV, Base64, hashing, JWT, Markdown — every dev utility you reach for." },
  { id: "quick",    label: "Quick Tools",    icon: WandSparkles, blurb: "Password, UUID, QR code, lorem ipsum, color palette, and other one-tap helpers." },
  { id: "docs",     label: "Business Docs",  icon: Briefcase,   blurb: "Receipts, quotes, resumes, agendas, and business cards — all generated as polished PDFs." },
];

export const UTILITY_TOOL_REGISTRY = [
  { id: "img-compress", title: "Compress image",         description: "Re-encode JPG/PNG with a quality slider.",            icon: FileImage,    category: "Images & Media", keywords: ["jpg", "png", "shrink", "tinypng"] },
  { id: "img-convert",  title: "Convert image format",   description: "PNG ↔ JPG ↔ WebP, all in your browser.",              icon: ImagePlus,    category: "Images & Media", keywords: ["webp", "png", "jpg", "format"] },
  { id: "img-resize",   title: "Resize image",           description: "Resize to exact pixels with aspect-ratio lock.",       icon: Maximize2,    category: "Images & Media", keywords: ["resize", "scale", "crop"] },
  { id: "favicon",      title: "Favicon generator",      description: "Generate every favicon size from a single source.",   icon: FileBadge,    category: "Images & Media", keywords: ["favicon", "icon", "ico"] },

  { id: "json",         title: "JSON formatter",         description: "Pretty-print, minify, and validate JSON.",            icon: FileJson,     category: "Text & Data", keywords: ["pretty", "validate", "format"] },
  { id: "csvjson",      title: "CSV ↔ JSON converter",   description: "Convert spreadsheets to/from structured JSON.",       icon: FileText,     category: "Text & Data", keywords: ["spreadsheet", "convert"] },
  { id: "base64",       title: "Base64 encode / decode", description: "Encode text or files. Decode strings back to text.",  icon: Binary,       category: "Text & Data", keywords: ["encode", "decode"] },
  { id: "urlcode",      title: "URL encode / decode",    description: "Percent-encode and decode URL components.",            icon: Link2,        category: "Text & Data", keywords: ["url", "querystring"] },
  { id: "hash",         title: "Hash generator",         description: "SHA-1, SHA-256, SHA-384, SHA-512 — text or file.",    icon: Fingerprint,  category: "Text & Data", keywords: ["sha", "checksum", "integrity"] },
  { id: "jwt",          title: "JWT decoder",            description: "Inspect a JSON Web Token's header and payload.",      icon: KeyRound,     category: "Text & Data", keywords: ["jwt", "token", "decode"] },
  { id: "markdown",     title: "Markdown → HTML / PDF",  description: "Live-preview Markdown, then download HTML or a PDF.", icon: ScrollText,   category: "Text & Data", keywords: ["md", "preview", "render"] },

  { id: "password",     title: "Password generator",     description: "Strong passwords with full character-class control.", icon: Lock,         category: "Quick Tools", keywords: ["secret", "random"] },
  { id: "uuid",         title: "UUID generator",         description: "Generate one or many v4 UUIDs.",                      icon: Hash,         category: "Quick Tools", keywords: ["guid", "id"] },
  { id: "lorem",        title: "Lorem ipsum generator",  description: "Paragraphs, sentences, or words on demand.",          icon: Type,         category: "Quick Tools", keywords: ["placeholder", "text"] },
  { id: "qr",           title: "QR code generator",      description: "URL, text, Wi-Fi, or contact card → SVG / PNG.",      icon: QrCode,       category: "Quick Tools", keywords: ["barcode", "scan"] },
  { id: "color",        title: "Color palette",          description: "Pick a base color and get tints, shades, and a palette.", icon: Palette,  category: "Quick Tools", keywords: ["palette", "design", "tints"] },
  { id: "wordcount",    title: "Word & character count", description: "Live word, character, sentence, and reading-time stats.", icon: SquareTerminal, category: "Quick Tools", keywords: ["count", "words"] },
  { id: "case",         title: "Case converter",         description: "Convert between camelCase, snake_case, kebab, and more.", icon: CaseSensitive,  category: "Quick Tools", keywords: ["snake", "camel", "kebab"] },
  { id: "slug",         title: "Slug generator",         description: "Make URL-safe slugs from any string.",                icon: Shuffle,      category: "Quick Tools", keywords: ["url", "permalink"] },
  { id: "regex",        title: "Regex tester",           description: "Test a regular expression against sample text.",      icon: Regex,        category: "Quick Tools", keywords: ["regular expression", "match"] },
  { id: "diff",         title: "Text diff checker",      description: "Compare two blocks of text line by line.",            icon: Diff,         category: "Quick Tools", keywords: ["compare", "changes"] },

  { id: "receipt",      title: "Receipt generator",      description: "Print-ready receipts with itemized totals.",          icon: Receipt,      category: "Business Docs", keywords: ["paid", "transaction"] },
  { id: "quote",        title: "Quote / estimate",       description: "Branded quotes with line items and validity dates.",  icon: Quote,        category: "Business Docs", keywords: ["estimate", "proposal"] },
  { id: "resume",       title: "Resume / CV builder",    description: "One-page professional resume rendered as PDF.",        icon: Award,        category: "Business Docs", keywords: ["cv", "career"] },
  { id: "agenda",       title: "Meeting agenda",         description: "Polished agenda with attendees and timed topics.",     icon: CalendarClock, category: "Business Docs", keywords: ["meeting", "minutes"] },
  { id: "bizcard",      title: "Business card sheet",    description: "10-up business cards on a single Letter page.",        icon: PencilRuler,  category: "Business Docs", keywords: ["card", "print"] },
  { id: "letter",       title: "Formal letter",          description: "Block-format business letter with letterhead.",        icon: FileCheck2,   category: "Business Docs", keywords: ["correspondence", "cover"] },
  { id: "checklist",    title: "Checklist / SOP",        description: "Numbered checklist or SOP rendered as a clean PDF.",   icon: ClipboardCheck, category: "Business Docs", keywords: ["sop", "process"] },
];

// ============================================================ Image tools

function ImageCompressCard({ setStatus }) {
  const [file, setFile] = useState(null);
  const [quality, setQuality] = useState(75);
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState(null);

  const run = withWorking(async () => {
    if (!file) throw new Error("Choose an image first.");
    setStatus("Re-encoding image…");
    const dataUrl = await readFileAsDataUrl(file);
    const img = await loadImage(dataUrl);
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0);
    const blob = await canvasToBlob(canvas, "image/jpeg", clamp(Number(quality), 10, 100) / 100);
    const before = file.size;
    const after = blob.size;
    setReport({ before, after });
    downloadBlob(blob, `${safeBaseName(file.name)}-compressed.jpg`);
    setStatus(`Compressed — ${(before / 1024).toFixed(0)} KB → ${(after / 1024).toFixed(0)} KB.`, "success");
  }, setBusy, setStatus);

  return (
    <div className="toolCard" data-tool="img-compress">
      <ToolHeader icon={FileImage} title="Compress image" description="Re-encode JPG or PNG with a quality slider. Output is JPG." />
      <DropZone accept="image/png,image/jpeg,image/jpg,image/webp" files={file} onFiles={setFile} label="Drop an image" hint="JPG, PNG, or WebP" />
      <label className="field">
        <span>Quality: {quality}</span>
        <input type="range" min="10" max="100" step="1" value={quality} onChange={(e) => setQuality(Number(e.target.value))} />
      </label>
      {report && (
        <div className="totalsBox">
          <div><span>Original</span><strong>{(report.before / 1024).toFixed(1)} KB</strong></div>
          <div><span>Compressed</span><strong>{(report.after / 1024).toFixed(1)} KB</strong></div>
        </div>
      )}
      <button className="btn btn-brand btn-block" onClick={run} disabled={busy || !file}>
        {busy ? <Spinner size={12} /> : <ArrowDownToLine size={14} />} Compress &amp; download
      </button>
    </div>
  );
}

function ImageConvertCard({ setStatus }) {
  const [file, setFile] = useState(null);
  const [target, setTarget] = useState("image/png");
  const [busy, setBusy] = useState(false);

  const run = withWorking(async () => {
    if (!file) throw new Error("Choose an image first.");
    setStatus("Converting image format…");
    const dataUrl = await readFileAsDataUrl(file);
    const img = await loadImage(dataUrl);
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    canvas.getContext("2d").drawImage(img, 0, 0);
    const ext = target.split("/")[1];
    const blob = await canvasToBlob(canvas, target, 0.95);
    downloadBlob(blob, `${safeBaseName(file.name)}.${ext}`);
    setStatus(`Converted to ${ext.toUpperCase()}.`, "success");
  }, setBusy, setStatus);

  return (
    <div className="toolCard" data-tool="img-convert">
      <ToolHeader icon={ImagePlus} title="Convert image format" description="Re-encode an image as PNG, JPG, or WebP without uploading it anywhere." />
      <DropZone accept="image/png,image/jpeg,image/jpg,image/webp" files={file} onFiles={setFile} label="Drop an image" />
      <label className="field"><span>Target format</span>
        <select value={target} onChange={(e) => setTarget(e.target.value)}>
          <option value="image/png">PNG (.png)</option>
          <option value="image/jpeg">JPG (.jpg)</option>
          <option value="image/webp">WebP (.webp)</option>
        </select>
      </label>
      <button className="btn btn-brand btn-block" onClick={run} disabled={busy || !file}>
        {busy ? <Spinner size={12} /> : <ArrowDownToLine size={14} />} Convert &amp; download
      </button>
    </div>
  );
}

function ImageResizeCard({ setStatus }) {
  const [file, setFile] = useState(null);
  const [width, setWidth] = useState(800);
  const [height, setHeight] = useState(0);
  const [lockAspect, setLockAspect] = useState(true);
  const [busy, setBusy] = useState(false);
  const [original, setOriginal] = useState(null);

  useEffect(() => {
    if (!file) return;
    (async () => {
      const dataUrl = await readFileAsDataUrl(file);
      const img = await loadImage(dataUrl);
      setOriginal({ width: img.naturalWidth, height: img.naturalHeight, dataUrl });
      setWidth(img.naturalWidth);
      setHeight(img.naturalHeight);
    })();
  }, [file]);

  const onWidthChange = (event) => {
    const value = Math.max(1, Number(event.target.value) || 0);
    setWidth(value);
    if (lockAspect && original) {
      setHeight(Math.round((value / original.width) * original.height));
    }
  };
  const onHeightChange = (event) => {
    const value = Math.max(1, Number(event.target.value) || 0);
    setHeight(value);
    if (lockAspect && original) {
      setWidth(Math.round((value / original.height) * original.width));
    }
  };

  const run = withWorking(async () => {
    if (!file || !original) throw new Error("Choose an image first.");
    setStatus("Resizing image…");
    const img = await loadImage(original.dataUrl);
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Number(width) || 1);
    canvas.height = Math.max(1, Number(height) || 1);
    const ctx = canvas.getContext("2d");
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const isJpg = (file.type || "").includes("jpeg") || (file.type || "").includes("jpg");
    const mime = isJpg ? "image/jpeg" : "image/png";
    const blob = await canvasToBlob(canvas, mime, 0.95);
    downloadBlob(blob, `${safeBaseName(file.name)}-${canvas.width}x${canvas.height}.${isJpg ? "jpg" : "png"}`);
    setStatus(`Resized to ${canvas.width} × ${canvas.height}.`, "success");
  }, setBusy, setStatus);

  return (
    <div className="toolCard" data-tool="img-resize">
      <ToolHeader icon={Maximize2} title="Resize image" description="Resize to exact pixels with optional aspect-ratio lock." />
      <DropZone accept="image/png,image/jpeg,image/jpg,image/webp" files={file} onFiles={setFile} label="Drop an image" />
      {original && <p className="miniText">Original: {original.width} × {original.height} px</p>}
      <div className="fieldRow">
        <label className="field"><span>Width (px)</span><input type="number" min="1" value={width} onChange={onWidthChange} /></label>
        <label className="field"><span>Height (px)</span><input type="number" min="1" value={height} onChange={onHeightChange} /></label>
      </div>
      <label className="toggle"><input type="checkbox" checked={lockAspect} onChange={(e) => setLockAspect(e.target.checked)} /> Lock aspect ratio</label>
      <button className="btn btn-brand btn-block" onClick={run} disabled={busy || !file}>
        {busy ? <Spinner size={12} /> : <ArrowDownToLine size={14} />} Resize &amp; download
      </button>
    </div>
  );
}

function FaviconCard({ setStatus }) {
  const [file, setFile] = useState(null);
  const [sizes, setSizes] = useState("16,32,48,64,128,192,512");
  const [busy, setBusy] = useState(false);

  const run = withWorking(async () => {
    if (!file) throw new Error("Choose a square source image (512x512 looks best).");
    setStatus("Generating favicon set…");
    const dataUrl = await readFileAsDataUrl(file);
    const img = await loadImage(dataUrl);
    const list = sizes.split(",").map((s) => parseInt(s.trim(), 10)).filter((n) => n > 0 && n <= 1024);
    if (!list.length) throw new Error("Enter at least one size, e.g. 16,32,48,64,128,192,512.");
    const zip = new JSZip();
    for (const size of list) {
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d");
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, 0, 0, size, size);
      const blob = await canvasToBlob(canvas, "image/png");
      zip.file(`favicon-${size}.png`, await blob.arrayBuffer());
    }
    // Add a quick HTML snippet so users know how to use them
    const snippet = list.map((size) => `<link rel="icon" type="image/png" sizes="${size}x${size}" href="/favicon-${size}.png" />`).join("\n");
    zip.file("README-favicon.html", `<!-- Drop these into <head> -->\n${snippet}\n`);
    const zipped = await zip.generateAsync({ type: "blob" });
    downloadBlob(zipped, `${safeBaseName(file.name)}-favicons.zip`);
    setStatus(`Generated ${list.length} favicon size${list.length === 1 ? "" : "s"}.`, "success");
  }, setBusy, setStatus);

  return (
    <div className="toolCard" data-tool="favicon">
      <ToolHeader icon={FileBadge} title="Favicon generator" description="Generate every favicon PNG size you need from a single square image." />
      <DropZone accept="image/png,image/jpeg,image/jpg,image/webp" files={file} onFiles={setFile} label="Drop a square image" hint="512×512 PNG works best" />
      <label className="field"><span>Sizes (px, comma-separated)</span><input value={sizes} onChange={(e) => setSizes(e.target.value)} /></label>
      <button className="btn btn-brand btn-block" onClick={run} disabled={busy || !file}>
        {busy ? <Spinner size={12} /> : <ArrowDownToLine size={14} />} Generate favicon zip
      </button>
    </div>
  );
}

// ============================================================ Text & Data

function JsonCard({ setStatus }) {
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [indent, setIndent] = useState(2);
  const [error, setError] = useState("");

  const format = () => {
    try {
      const parsed = JSON.parse(input);
      setOutput(JSON.stringify(parsed, null, Number(indent) || 2));
      setError("");
      setStatus("Valid JSON — formatted.", "success");
    } catch (e) {
      setError(e.message);
      setStatus("Invalid JSON.", "error");
    }
  };
  const minify = () => {
    try {
      const parsed = JSON.parse(input);
      setOutput(JSON.stringify(parsed));
      setError("");
      setStatus("Minified.", "success");
    } catch (e) {
      setError(e.message);
      setStatus("Invalid JSON.", "error");
    }
  };
  const copy = async () => {
    if (!output) return;
    await navigator.clipboard.writeText(output);
    setStatus("Copied to clipboard.", "success");
  };
  const download = () => {
    if (!output) return;
    downloadBlob(new Blob([output], { type: "application/json" }), "formatted.json");
  };

  return (
    <div className="toolCard" data-tool="json" style={{ gridColumn: "span 2" }}>
      <ToolHeader icon={FileJson} title="JSON formatter" description="Pretty-print, minify, validate. Errors point to the exact problem." />
      <div className="splitArea">
        <label className="field"><span>Input JSON</span>
          <textarea rows={10} value={input} onChange={(e) => setInput(e.target.value)} placeholder='{"hello":"world"}' style={{ fontFamily: "ui-monospace, monospace", fontSize: "0.84rem" }} />
        </label>
        <label className="field"><span>Output</span>
          <textarea rows={10} value={output} readOnly style={{ fontFamily: "ui-monospace, monospace", fontSize: "0.84rem" }} />
        </label>
      </div>
      {error && <p className="miniText" style={{ color: "var(--rose)" }}>Error: {error}</p>}
      <div className="fieldRow">
        <label className="field"><span>Indent</span><input type="number" min="0" max="8" value={indent} onChange={(e) => setIndent(e.target.value)} /></label>
      </div>
      <div className="buttonRow">
        <button className="btn btn-brand" onClick={format}>Format</button>
        <button className="btn btn-soft" onClick={minify}>Minify</button>
        <button className="btn btn-ghost" onClick={copy} disabled={!output}>Copy</button>
        <button className="btn btn-ghost" onClick={download} disabled={!output}><ArrowDownToLine size={14} /> Download</button>
      </div>
    </div>
  );
}

function CsvJsonCard({ setStatus }) {
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [direction, setDirection] = useState("csv2json");

  const run = () => {
    try {
      if (direction === "csv2json") {
        const rows = input.split(/\r?\n/).filter((r) => r.trim()).map(parseCsvLine);
        if (!rows.length) throw new Error("Paste at least one CSV row.");
        const [headers, ...data] = rows;
        const objects = data.map((row) => {
          const obj = {};
          headers.forEach((h, i) => { obj[h] = row[i] ?? ""; });
          return obj;
        });
        setOutput(JSON.stringify(objects, null, 2));
        setStatus(`Converted ${objects.length} row${objects.length === 1 ? "" : "s"} to JSON.`, "success");
      } else {
        const parsed = JSON.parse(input);
        if (!Array.isArray(parsed) || !parsed.length) throw new Error("JSON must be a non-empty array of objects.");
        const headers = Array.from(parsed.reduce((set, item) => {
          Object.keys(item || {}).forEach((k) => set.add(k));
          return set;
        }, new Set()));
        const lines = [headers.map(csvCell).join(",")];
        parsed.forEach((row) => {
          lines.push(headers.map((h) => csvCell(row?.[h] ?? "")).join(","));
        });
        setOutput(lines.join("\n"));
        setStatus(`Converted ${parsed.length} row${parsed.length === 1 ? "" : "s"} to CSV.`, "success");
      }
    } catch (e) {
      setOutput("");
      setStatus(e.message, "error");
    }
  };

  const download = () => {
    if (!output) return;
    const ext = direction === "csv2json" ? "json" : "csv";
    const mime = direction === "csv2json" ? "application/json" : "text/csv";
    downloadBlob(new Blob([output], { type: mime }), `converted.${ext}`);
  };

  return (
    <div className="toolCard" data-tool="csvjson" style={{ gridColumn: "span 2" }}>
      <ToolHeader icon={FileText} title="CSV ↔ JSON converter" description="Convert spreadsheets to structured JSON, or JSON arrays back to CSV." />
      <label className="field"><span>Direction</span>
        <select value={direction} onChange={(e) => setDirection(e.target.value)}>
          <option value="csv2json">CSV → JSON</option>
          <option value="json2csv">JSON → CSV</option>
        </select>
      </label>
      <div className="splitArea">
        <label className="field"><span>Input</span>
          <textarea rows={9} value={input} onChange={(e) => setInput(e.target.value)} placeholder={direction === "csv2json" ? "Name,Email\nAlex,alex@example.com" : '[{"Name":"Alex","Email":"alex@example.com"}]'} style={{ fontFamily: "ui-monospace, monospace", fontSize: "0.84rem" }} />
        </label>
        <label className="field"><span>Output</span>
          <textarea rows={9} value={output} readOnly style={{ fontFamily: "ui-monospace, monospace", fontSize: "0.84rem" }} />
        </label>
      </div>
      <div className="buttonRow">
        <button className="btn btn-brand" onClick={run}>Convert</button>
        <button className="btn btn-ghost" onClick={download} disabled={!output}><ArrowDownToLine size={14} /> Download</button>
      </div>
    </div>
  );
}

function Base64Card({ setStatus }) {
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");

  const encode = () => {
    try {
      setOutput(btoa(unescape(encodeURIComponent(input))));
      setStatus("Encoded.", "success");
    } catch (e) { setStatus(e.message, "error"); }
  };
  const decode = () => {
    try {
      setOutput(decodeURIComponent(escape(atob(input.trim()))));
      setStatus("Decoded.", "success");
    } catch (e) { setStatus("Input is not valid Base64.", "error"); }
  };
  const onFile = async (file) => {
    if (!file) return;
    const buffer = await file.arrayBuffer();
    let binary = "";
    const bytes = new Uint8Array(buffer);
    for (let i = 0; i < bytes.byteLength; i += 1) binary += String.fromCharCode(bytes[i]);
    setInput("");
    setOutput(btoa(binary));
    setStatus(`Encoded ${file.name} (${(file.size / 1024).toFixed(1)} KB).`, "success");
  };

  return (
    <div className="toolCard" data-tool="base64">
      <ToolHeader icon={Binary} title="Base64 encode / decode" description="Encode or decode strings, or Base64-encode any file." />
      <label className="field"><span>Input</span><textarea rows={4} value={input} onChange={(e) => setInput(e.target.value)} placeholder="Text or Base64 string" style={{ fontFamily: "ui-monospace, monospace", fontSize: "0.82rem" }} /></label>
      <div className="buttonRow">
        <button className="btn btn-brand" onClick={encode}>Encode</button>
        <button className="btn btn-soft" onClick={decode}>Decode</button>
        <DropZone accept="*/*" files={null} onFiles={onFile} label="Or encode a file" />
      </div>
      <label className="field"><span>Output</span><textarea rows={4} value={output} readOnly style={{ fontFamily: "ui-monospace, monospace", fontSize: "0.82rem" }} /></label>
    </div>
  );
}

function UrlEncodeCard({ setStatus }) {
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  return (
    <div className="toolCard" data-tool="urlcode">
      <ToolHeader icon={Link2} title="URL encode / decode" description="Percent-encode or decode URL components." />
      <label className="field"><span>Input</span><textarea rows={3} value={input} onChange={(e) => setInput(e.target.value)} placeholder="https://example.com/?q=hello world" /></label>
      <div className="buttonRow">
        <button className="btn btn-brand" onClick={() => { setOutput(encodeURIComponent(input)); setStatus("Encoded.", "success"); }}>Encode</button>
        <button className="btn btn-soft" onClick={() => {
          try { setOutput(decodeURIComponent(input)); setStatus("Decoded.", "success"); }
          catch (_) { setStatus("Input is not valid URL-encoded text.", "error"); }
        }}>Decode</button>
      </div>
      <label className="field"><span>Output</span><textarea rows={3} value={output} readOnly /></label>
    </div>
  );
}

function HashCard({ setStatus }) {
  const [input, setInput] = useState("");
  const [algo, setAlgo] = useState("SHA-256");
  const [output, setOutput] = useState("");
  const [busy, setBusy] = useState(false);

  const hashText = async () => {
    setBusy(true);
    try {
      const buffer = new TextEncoder().encode(input);
      const digest = await crypto.subtle.digest(algo, buffer);
      setOutput(toHex(digest));
      setStatus(`${algo} computed.`, "success");
    } catch (e) {
      setStatus(e.message, "error");
    } finally {
      setBusy(false);
    }
  };
  const hashFile = async (file) => {
    if (!file) return;
    setBusy(true);
    try {
      const buffer = await file.arrayBuffer();
      const digest = await crypto.subtle.digest(algo, buffer);
      setOutput(toHex(digest));
      setStatus(`${algo} of ${file.name} computed.`, "success");
    } catch (e) {
      setStatus(e.message, "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="toolCard" data-tool="hash">
      <ToolHeader icon={Fingerprint} title="Hash generator" description="SHA-1, SHA-256, SHA-384, or SHA-512 from a string or file." />
      <div className="fieldRow">
        <label className="field"><span>Algorithm</span>
          <select value={algo} onChange={(e) => setAlgo(e.target.value)}>
            <option>SHA-1</option><option>SHA-256</option><option>SHA-384</option><option>SHA-512</option>
          </select>
        </label>
      </div>
      <label className="field"><span>Text input</span><textarea rows={3} value={input} onChange={(e) => setInput(e.target.value)} /></label>
      <div className="buttonRow">
        <button className="btn btn-brand" onClick={hashText} disabled={busy}>{busy ? <Spinner size={12} /> : null} Hash text</button>
        <DropZone accept="*/*" files={null} onFiles={hashFile} label="Or drop a file to hash" />
      </div>
      <label className="field"><span>Digest (hex)</span><textarea rows={3} value={output} readOnly style={{ fontFamily: "ui-monospace, monospace", fontSize: "0.78rem", wordBreak: "break-all" }} /></label>
    </div>
  );
}

function JwtCard({ setStatus }) {
  const [input, setInput] = useState("");
  const [parsed, setParsed] = useState(null);

  const decode = () => {
    try {
      const [headerB64, payloadB64] = input.trim().split(".");
      if (!headerB64 || !payloadB64) throw new Error("Token must have at least header.payload.signature.");
      const header = JSON.parse(b64UrlDecode(headerB64));
      const payload = JSON.parse(b64UrlDecode(payloadB64));
      setParsed({ header, payload });
      setStatus("Token decoded. Signature is NOT verified.", "success");
    } catch (e) {
      setParsed(null);
      setStatus(e.message || "Invalid JWT.", "error");
    }
  };

  return (
    <div className="toolCard" data-tool="jwt">
      <ToolHeader icon={KeyRound} title="JWT decoder" description="Inspect a JSON Web Token's header and payload. Signature is not verified." />
      <label className="field"><span>JWT</span><textarea rows={4} value={input} onChange={(e) => setInput(e.target.value)} placeholder="eyJhbGciOiJIUzI1NiIs…" style={{ fontFamily: "ui-monospace, monospace", fontSize: "0.78rem" }} /></label>
      <button className="btn btn-brand btn-block" onClick={decode}>Decode</button>
      {parsed && (
        <div className="splitArea">
          <label className="field"><span>Header</span><textarea rows={4} value={JSON.stringify(parsed.header, null, 2)} readOnly style={{ fontFamily: "ui-monospace, monospace", fontSize: "0.78rem" }} /></label>
          <label className="field"><span>Payload</span><textarea rows={4} value={JSON.stringify(parsed.payload, null, 2)} readOnly style={{ fontFamily: "ui-monospace, monospace", fontSize: "0.78rem" }} /></label>
        </div>
      )}
    </div>
  );
}

function MarkdownCard({ setStatus }) {
  const [input, setInput] = useState("# Hello\n\nType **markdown** in the left pane and watch it render on the right.\n\n- One\n- Two\n- Three\n");
  const html = useMemo(() => marked.parse(input || ""), [input]);

  const downloadHtml = () => {
    const wrapped = `<!doctype html><html><head><meta charset="utf-8"><title>Markdown</title><style>body{font-family:Inter,system-ui,sans-serif;max-width:760px;margin:40px auto;padding:0 20px;line-height:1.55;color:#0b1320}pre,code{font-family:ui-monospace,monospace;background:#f4f6fb;border-radius:6px;padding:1px 6px}pre{padding:12px;overflow:auto}h1,h2,h3{letter-spacing:-0.01em}</style></head><body>${html}</body></html>`;
    downloadBlob(new Blob([wrapped], { type: "text/html" }), "markdown.html");
    setStatus("HTML downloaded.", "success");
  };
  const downloadPdf = withWorking(async () => {
    const stripped = (typeof html === "string" ? html : await html).replace(/<[^>]+>/g, "");
    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const margin = 54;
    let page = pdfDoc.addPage([612, 792]);
    let y = 792 - margin;
    wrapText(font, normalizePdfText(stripped), 11, 612 - margin * 2).forEach((line) => {
      if (y < margin) { page = pdfDoc.addPage([612, 792]); y = 792 - margin; }
      page.drawText(line || " ", { x: margin, y, size: 11, font, color: rgb(0.06, 0.07, 0.1) });
      y -= 16;
    });
    const bytes = await pdfDoc.save({ useObjectStreams: true });
    downloadBlob(new Blob([bytes], { type: "application/pdf" }), "markdown.pdf");
    setStatus("PDF downloaded.", "success");
  }, () => {}, setStatus);

  return (
    <div className="toolCard" data-tool="markdown" style={{ gridColumn: "span 2" }}>
      <ToolHeader icon={ScrollText} title="Markdown → HTML / PDF" description="Live preview, then download as HTML or a clean text PDF." />
      <div className="splitArea">
        <label className="field"><span>Markdown</span>
          <textarea rows={12} value={input} onChange={(e) => setInput(e.target.value)} style={{ fontFamily: "ui-monospace, monospace", fontSize: "0.84rem" }} />
        </label>
        <div className="field">
          <span>Preview</span>
          <div className="markdownPreview" dangerouslySetInnerHTML={{ __html: html }} />
        </div>
      </div>
      <div className="buttonRow">
        <button className="btn btn-brand" onClick={downloadHtml}><ArrowDownToLine size={14} /> Download HTML</button>
        <button className="btn btn-soft" onClick={downloadPdf}><ArrowDownToLine size={14} /> Download PDF</button>
      </div>
    </div>
  );
}

// ============================================================ Quick tools

function PasswordCard({ setStatus }) {
  const [length, setLength] = useState(20);
  const [count, setCount] = useState(5);
  const [lower, setLower] = useState(true);
  const [upper, setUpper] = useState(true);
  const [digits, setDigits] = useState(true);
  const [symbols, setSymbols] = useState(true);
  const [exclude, setExclude] = useState("");
  const [output, setOutput] = useState([]);

  const generate = () => {
    let pool = "";
    if (lower) pool += "abcdefghijklmnopqrstuvwxyz";
    if (upper) pool += "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    if (digits) pool += "0123456789";
    if (symbols) pool += "!@#$%^&*()-_=+[]{};:,.?/";
    pool = [...pool].filter((c) => !exclude.includes(c)).join("");
    if (!pool.length) { setStatus("Pick at least one character class.", "error"); return; }
    const items = [];
    for (let i = 0; i < clamp(Number(count), 1, 100); i += 1) {
      const buf = new Uint32Array(clamp(Number(length), 4, 256));
      crypto.getRandomValues(buf);
      let pwd = "";
      for (let j = 0; j < buf.length; j += 1) pwd += pool[buf[j] % pool.length];
      items.push(pwd);
    }
    setOutput(items);
    setStatus(`Generated ${items.length} password${items.length === 1 ? "" : "s"}.`, "success");
  };
  const copyAll = async () => {
    if (!output.length) return;
    await navigator.clipboard.writeText(output.join("\n"));
    setStatus("Copied to clipboard.", "success");
  };

  return (
    <div className="toolCard" data-tool="password">
      <ToolHeader icon={Lock} title="Password generator" description="Cryptographically random passwords using your browser's secure RNG." />
      <div className="fieldRow">
        <label className="field"><span>Length</span><input type="number" min="4" max="256" value={length} onChange={(e) => setLength(e.target.value)} /></label>
        <label className="field"><span>How many</span><input type="number" min="1" max="100" value={count} onChange={(e) => setCount(e.target.value)} /></label>
      </div>
      <div className="checkRow">
        <label className="toggle"><input type="checkbox" checked={lower} onChange={(e) => setLower(e.target.checked)} /> a-z</label>
        <label className="toggle"><input type="checkbox" checked={upper} onChange={(e) => setUpper(e.target.checked)} /> A-Z</label>
        <label className="toggle"><input type="checkbox" checked={digits} onChange={(e) => setDigits(e.target.checked)} /> 0-9</label>
        <label className="toggle"><input type="checkbox" checked={symbols} onChange={(e) => setSymbols(e.target.checked)} /> Symbols</label>
      </div>
      <label className="field"><span>Exclude characters</span><input value={exclude} onChange={(e) => setExclude(e.target.value)} placeholder="e.g. Il10O" /></label>
      <div className="buttonRow">
        <button className="btn btn-brand" onClick={generate}>Generate</button>
        <button className="btn btn-ghost" onClick={copyAll} disabled={!output.length}>Copy all</button>
      </div>
      {output.length > 0 && (
        <pre className="codeOut">{output.join("\n")}</pre>
      )}
    </div>
  );
}

function UuidCard({ setStatus }) {
  const [count, setCount] = useState(10);
  const [output, setOutput] = useState([]);
  const generate = () => {
    const items = Array.from({ length: clamp(Number(count), 1, 1000) }, () => crypto.randomUUID());
    setOutput(items);
    setStatus(`Generated ${items.length} UUID${items.length === 1 ? "" : "s"}.`, "success");
  };
  return (
    <div className="toolCard" data-tool="uuid">
      <ToolHeader icon={Hash} title="UUID generator" description="RFC-4122 v4 UUIDs from your browser's secure RNG." />
      <label className="field"><span>How many</span><input type="number" min="1" max="1000" value={count} onChange={(e) => setCount(e.target.value)} /></label>
      <div className="buttonRow">
        <button className="btn btn-brand" onClick={generate}>Generate</button>
        <button className="btn btn-ghost" onClick={() => { navigator.clipboard.writeText(output.join("\n")); setStatus("Copied.", "success"); }} disabled={!output.length}>Copy all</button>
      </div>
      {output.length > 0 && <pre className="codeOut">{output.join("\n")}</pre>}
    </div>
  );
}

function LoremCard({ setStatus }) {
  const [paragraphs, setParagraphs] = useState(3);
  const [unit, setUnit] = useState("paragraphs");
  const [output, setOutput] = useState("");
  const generate = () => {
    const text = generateLorem(Number(paragraphs), unit);
    setOutput(text);
    setStatus("Generated.", "success");
  };
  return (
    <div className="toolCard" data-tool="lorem">
      <ToolHeader icon={Type} title="Lorem ipsum generator" description="Filler text for mockups — paragraphs, sentences, or words." />
      <div className="fieldRow">
        <label className="field"><span>How many</span><input type="number" min="1" max="200" value={paragraphs} onChange={(e) => setParagraphs(e.target.value)} /></label>
        <label className="field"><span>Unit</span>
          <select value={unit} onChange={(e) => setUnit(e.target.value)}>
            <option value="paragraphs">Paragraphs</option>
            <option value="sentences">Sentences</option>
            <option value="words">Words</option>
          </select>
        </label>
      </div>
      <div className="buttonRow">
        <button className="btn btn-brand" onClick={generate}>Generate</button>
        <button className="btn btn-ghost" onClick={() => { navigator.clipboard.writeText(output); setStatus("Copied.", "success"); }} disabled={!output}>Copy</button>
      </div>
      {output && <textarea rows={6} value={output} readOnly />}
    </div>
  );
}

function QrCard({ setStatus }) {
  const [text, setText] = useState("https://doc-tool.netlify.app/");
  const [size, setSize] = useState(512);
  const [color, setColor] = useState("#0b1320");
  const [bg, setBg] = useState("#ffffff");
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!text.trim()) return;
      try {
        const dataUrl = await QRCode.toDataURL(text, {
          margin: 1,
          width: 320,
          color: { dark: color, light: bg },
        });
        if (!cancelled) setPreview(dataUrl);
      } catch (_) { /* ignore */ }
    })();
    return () => { cancelled = true; };
  }, [text, color, bg]);

  const downloadPng = withWorking(async () => {
    if (!text.trim()) throw new Error("Enter text or a URL to encode.");
    const dataUrl = await QRCode.toDataURL(text, {
      margin: 1,
      width: clamp(Number(size), 64, 2048),
      color: { dark: color, light: bg },
    });
    const blob = await (await fetch(dataUrl)).blob();
    downloadBlob(blob, "qrcode.png");
    setStatus("QR code PNG downloaded.", "success");
  }, setBusy, setStatus);

  const downloadSvg = withWorking(async () => {
    if (!text.trim()) throw new Error("Enter text or a URL to encode.");
    const svg = await QRCode.toString(text, {
      type: "svg",
      margin: 1,
      color: { dark: color, light: bg },
    });
    downloadBlob(new Blob([svg], { type: "image/svg+xml" }), "qrcode.svg");
    setStatus("QR code SVG downloaded.", "success");
  }, setBusy, setStatus);

  return (
    <div className="toolCard" data-tool="qr">
      <ToolHeader icon={QrCode} title="QR code generator" description="Encode any URL or text. Download as crisp PNG or SVG." />
      <label className="field"><span>Content</span><textarea rows={3} value={text} onChange={(e) => setText(e.target.value)} placeholder="https://example.com" /></label>
      <div className="fieldRow">
        <label className="field"><span>PNG size (px)</span><input type="number" min="64" max="2048" value={size} onChange={(e) => setSize(e.target.value)} /></label>
        <label className="field"><span>Foreground</span><input type="color" value={color} onChange={(e) => setColor(e.target.value)} /></label>
        <label className="field"><span>Background</span><input type="color" value={bg} onChange={(e) => setBg(e.target.value)} /></label>
      </div>
      {preview && <div className="qrPreview"><img src={preview} alt="QR preview" /></div>}
      <div className="buttonRow">
        <button className="btn btn-brand" onClick={downloadPng} disabled={busy}><ArrowDownToLine size={14} /> Download PNG</button>
        <button className="btn btn-soft" onClick={downloadSvg} disabled={busy}><ArrowDownToLine size={14} /> Download SVG</button>
      </div>
    </div>
  );
}

function ColorCard({ setStatus }) {
  const [base, setBase] = useState("#0f766e");
  const palette = useMemo(() => buildPalette(base), [base]);
  const copy = async (value) => { await navigator.clipboard.writeText(value); setStatus(`Copied ${value}.`, "success"); };
  return (
    <div className="toolCard" data-tool="color">
      <ToolHeader icon={Palette} title="Color palette" description="Pick a base color and get tints, shades, and complementary swatches." />
      <label className="field"><span>Base color</span><input type="color" value={base} onChange={(e) => setBase(e.target.value)} /></label>
      <div className="paletteGrid">
        {palette.map((swatch) => (
          <button key={swatch.label + swatch.value} className="paletteSwatch" style={{ background: swatch.value }} onClick={() => copy(swatch.value)} title="Click to copy">
            <span style={{ color: swatch.text }}>{swatch.label}</span>
            <span style={{ color: swatch.text }}>{swatch.value}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function WordCountCard() {
  const [text, setText] = useState("");
  const stats = useMemo(() => {
    const words = (text.match(/\S+/g) || []).length;
    const characters = text.length;
    const charactersNoSpaces = text.replace(/\s+/g, "").length;
    const sentences = (text.match(/[.!?]+\s|[.!?]+$/g) || []).length;
    const paragraphs = (text.split(/\n{2,}/).filter((p) => p.trim()).length) || (text.trim() ? 1 : 0);
    const lines = text.split(/\r?\n/).length;
    const readMinutes = Math.max(1, Math.round(words / 220));
    return { words, characters, charactersNoSpaces, sentences, paragraphs, lines, readMinutes };
  }, [text]);
  return (
    <div className="toolCard" data-tool="wordcount">
      <ToolHeader icon={SquareTerminal} title="Word & character count" description="Live word, character, sentence, paragraph, and reading-time stats." />
      <textarea rows={6} value={text} onChange={(e) => setText(e.target.value)} placeholder="Paste text…" />
      <div className="statsGrid">
        <div><strong>{stats.words.toLocaleString()}</strong><span>words</span></div>
        <div><strong>{stats.characters.toLocaleString()}</strong><span>characters</span></div>
        <div><strong>{stats.charactersNoSpaces.toLocaleString()}</strong><span>no spaces</span></div>
        <div><strong>{stats.sentences.toLocaleString()}</strong><span>sentences</span></div>
        <div><strong>{stats.paragraphs.toLocaleString()}</strong><span>paragraphs</span></div>
        <div><strong>{stats.lines.toLocaleString()}</strong><span>lines</span></div>
        <div><strong>~{stats.readMinutes} min</strong><span>read time</span></div>
      </div>
    </div>
  );
}

function CaseCard({ setStatus }) {
  const [text, setText] = useState("");
  const variants = useMemo(() => {
    const words = (text || "").trim().split(/[\s_\-./]+/).filter(Boolean);
    const lower = words.map((w) => w.toLowerCase());
    return [
      { label: "lower case", value: text.toLowerCase() },
      { label: "UPPER CASE", value: text.toUpperCase() },
      { label: "Title Case", value: text.replace(/\w\S*/g, (w) => w[0].toUpperCase() + w.slice(1).toLowerCase()) },
      { label: "Sentence case", value: text.toLowerCase().replace(/(^|[.!?]\s+)([a-z])/g, (_, p, c) => p + c.toUpperCase()) },
      { label: "camelCase", value: lower.map((w, i) => i === 0 ? w : w[0].toUpperCase() + w.slice(1)).join("") },
      { label: "PascalCase", value: lower.map((w) => w[0]?.toUpperCase() + w.slice(1)).join("") },
      { label: "snake_case", value: lower.join("_") },
      { label: "kebab-case", value: lower.join("-") },
      { label: "CONSTANT_CASE", value: lower.join("_").toUpperCase() },
      { label: "dot.case", value: lower.join(".") },
    ];
  }, [text]);
  return (
    <div className="toolCard" data-tool="case">
      <ToolHeader icon={CaseSensitive} title="Case converter" description="Convert any string between common naming and casing styles." />
      <textarea rows={3} value={text} onChange={(e) => setText(e.target.value)} placeholder="Enter text" />
      <div className="caseList">
        {variants.map((v) => (
          <button key={v.label} className="caseRow" onClick={() => { navigator.clipboard.writeText(v.value); setStatus(`Copied ${v.label}.`, "success"); }}>
            <span className="caseLabel">{v.label}</span>
            <span className="caseValue">{v.value || <em style={{ color: "var(--muted)" }}>—</em>}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function SlugCard({ setStatus }) {
  const [text, setText] = useState("");
  const [maxLen, setMaxLen] = useState(60);
  const slug = useMemo(() => {
    const ascii = text.normalize("NFKD").replace(/[̀-ͯ]/g, "");
    return ascii.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, Math.max(1, Number(maxLen) || 60));
  }, [text, maxLen]);
  return (
    <div className="toolCard" data-tool="slug">
      <ToolHeader icon={Shuffle} title="Slug generator" description="URL-safe slug: ASCII-only, lowercase, dashes between words." />
      <label className="field"><span>Source text</span><input value={text} onChange={(e) => setText(e.target.value)} placeholder="My Awesome Title!" /></label>
      <label className="field"><span>Max length</span><input type="number" min="6" max="240" value={maxLen} onChange={(e) => setMaxLen(e.target.value)} /></label>
      <label className="field"><span>Slug</span>
        <div className="codeOut" style={{ wordBreak: "break-all" }}>{slug || <em style={{ color: "var(--muted)" }}>—</em>}</div>
      </label>
      <button className="btn btn-soft" onClick={() => { navigator.clipboard.writeText(slug); setStatus("Copied.", "success"); }} disabled={!slug}>Copy slug</button>
    </div>
  );
}

function RegexCard() {
  const [pattern, setPattern] = useState("\\bword\\b");
  const [flags, setFlags] = useState("gi");
  const [text, setText] = useState("");
  const result = useMemo(() => {
    if (!pattern) return { highlighted: text, matchCount: 0, error: "" };
    try {
      const re = new RegExp(pattern, flags.replace(/[^gimsuy]/g, ""));
      const matches = text.match(re);
      const count = matches ? matches.length : 0;
      const highlighted = text.replace(re, (m) => `〚${m}〛`);
      return { highlighted, matchCount: count, error: "" };
    } catch (e) {
      return { highlighted: text, matchCount: 0, error: e.message };
    }
  }, [pattern, flags, text]);
  return (
    <div className="toolCard" data-tool="regex">
      <ToolHeader icon={Regex} title="Regex tester" description="Test a pattern against sample text and see live match count and highlighted hits." />
      <div className="fieldRow">
        <label className="field"><span>Pattern</span><input value={pattern} onChange={(e) => setPattern(e.target.value)} placeholder="\\bword\\b" style={{ fontFamily: "ui-monospace, monospace" }} /></label>
        <label className="field"><span>Flags</span><input value={flags} onChange={(e) => setFlags(e.target.value)} placeholder="gimsuy" style={{ fontFamily: "ui-monospace, monospace" }} /></label>
      </div>
      <label className="field"><span>Sample text</span><textarea rows={5} value={text} onChange={(e) => setText(e.target.value)} placeholder="Paste text here…" /></label>
      {result.error
        ? <p className="miniText" style={{ color: "var(--rose)" }}>Error: {result.error}</p>
        : <p className="miniText">Matches: <strong>{result.matchCount}</strong> {result.matchCount > 0 && "— wrapped in brackets below"}</p>}
      {!result.error && result.matchCount > 0 && <pre className="codeOut">{result.highlighted}</pre>}
    </div>
  );
}

function DiffCard() {
  const [a, setA] = useState("");
  const [b, setB] = useState("");
  const lines = useMemo(() => diffLines(a, b), [a, b]);
  return (
    <div className="toolCard" data-tool="diff" style={{ gridColumn: "span 2" }}>
      <ToolHeader icon={Diff} title="Text diff checker" description="Line-by-line comparison of two text blocks." />
      <div className="splitArea">
        <label className="field"><span>Original</span><textarea rows={8} value={a} onChange={(e) => setA(e.target.value)} style={{ fontFamily: "ui-monospace, monospace", fontSize: "0.82rem" }} /></label>
        <label className="field"><span>Changed</span><textarea rows={8} value={b} onChange={(e) => setB(e.target.value)} style={{ fontFamily: "ui-monospace, monospace", fontSize: "0.82rem" }} /></label>
      </div>
      <div className="diffOut">
        {lines.length === 0 ? <p className="miniText">Type into both boxes to compare.</p> :
          lines.map((line, i) => (
            <div key={i} className={`diffLine diff-${line.kind}`}>
              <span className="diffMark">{line.kind === "add" ? "+" : line.kind === "del" ? "−" : " "}</span>
              <span className="diffText">{line.text || <em style={{ color: "var(--muted)" }}>(empty line)</em>}</span>
            </div>
          ))
        }
      </div>
    </div>
  );
}

// ============================================================ Business documents

function ReceiptCard({ brand, setStatus }) {
  const [number, setNumber] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [from, setFrom] = useState(brand?.companyName ? [brand.companyName, brand.contactLine].filter(Boolean).join("\n") : "");
  const [to, setTo] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("Credit card");
  const [notes, setNotes] = useState("Thank you for your business.");
  const [items, setItems] = useState([{ id: makeId(), description: "", qty: 1, rate: 0 }]);
  const [busy, setBusy] = useState(false);

  const totals = useMemo(() => {
    const subtotal = items.reduce((sum, it) => sum + (Number(it.qty) || 0) * (Number(it.rate) || 0), 0);
    return { subtotal, total: subtotal };
  }, [items]);
  const updateItem = (id, patch) => setItems((c) => c.map((it) => it.id === id ? { ...it, ...patch } : it));
  const removeItem = (id) => setItems((c) => c.filter((it) => it.id !== id));

  const run = withWorking(async () => {
    if (!items.some((it) => it.description.trim() || Number(it.rate) > 0)) throw new Error("Add at least one line item.");
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([612, 792]);
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const accent = hexToRgb(brand?.primaryColor || "#0f766e");
    page.drawRectangle({ x: 0, y: 700, width: 612, height: 92, color: accent });
    page.drawText("Receipt", { x: 54, y: 744, size: 26, font: bold, color: rgb(1, 1, 1) });
    if (number) page.drawText(`# ${normalizePdfText(number)}`, { x: 430, y: 748, size: 12, font: bold, color: rgb(1, 1, 1) });
    page.drawText(`Paid ${date}`, { x: 430, y: 728, size: 9, font, color: rgb(0.92, 1, 0.98) });
    page.drawText(`Method: ${normalizePdfText(paymentMethod)}`, { x: 430, y: 714, size: 9, font, color: rgb(0.92, 1, 0.98) });

    const drawMultiline = (text, x, startY, label) => {
      page.drawText(label, { x, y: startY, size: 9, font: bold, color: rgb(0.36, 0.42, 0.48) });
      let lineY = startY - 18;
      normalizePdfText(text).split(/\n+/).slice(0, 6).forEach((line) => {
        page.drawText(line, { x, y: lineY, size: 9.5, font, color: rgb(0.06, 0.07, 0.1), maxWidth: 220 });
        lineY -= 14;
      });
    };
    if (from.trim()) drawMultiline(from, 54, 660, "From");
    if (to.trim()) drawMultiline(to, 340, 660, "Paid by");

    page.drawRectangle({ x: 54, y: 500, width: 504, height: 26, color: rgb(0.92, 0.96, 0.97) });
    page.drawText("Description", { x: 64, y: 509, size: 9, font: bold });
    page.drawText("Qty", { x: 340, y: 509, size: 9, font: bold });
    page.drawText("Rate", { x: 405, y: 509, size: 9, font: bold });
    page.drawText("Amount", { x: 492, y: 509, size: 9, font: bold });
    let y = 474;
    items.forEach((item) => {
      const qty = Number(item.qty) || 0;
      const rate = Number(item.rate) || 0;
      page.drawText(normalizePdfText(item.description || "—"), { x: 64, y, size: 10, font, color: rgb(0.06, 0.07, 0.1), maxWidth: 245 });
      page.drawText(String(qty), { x: 342, y, size: 10, font });
      page.drawText(`$${rate.toFixed(2)}`, { x: 405, y, size: 10, font });
      page.drawText(`$${(qty * rate).toFixed(2)}`, { x: 492, y, size: 10, font });
      y -= 24;
    });
    page.drawLine({ start: { x: 340, y: y - 6 }, end: { x: 558, y: y - 6 }, thickness: 1, color: rgb(0.75, 0.82, 0.86) });
    page.drawText(`Total paid: $${totals.total.toFixed(2)}`, { x: 410, y: y - 30, size: 15, font: bold, color: rgb(0.06, 0.07, 0.1) });
    if (notes.trim()) {
      wrapText(font, normalizePdfText(notes), 9.5, 500).slice(0, 6).forEach((line, i) => {
        page.drawText(line, { x: 54, y: 110 - i * 13, size: 9.5, font, color: rgb(0.06, 0.07, 0.1) });
      });
    }
    const bytes = await pdfDoc.save({ useObjectStreams: true });
    downloadBlob(new Blob([bytes], { type: "application/pdf" }), `${safeBaseName(number || "receipt")}.pdf`);
    setStatus("Receipt downloaded.", "success");
  }, setBusy, setStatus);

  return (
    <div className="toolCard" data-tool="receipt" style={{ gridColumn: "span 2" }}>
      <ToolHeader icon={Receipt} title="Receipt generator" description="Issue a clean, branded receipt with itemized totals and payment method." />
      <div className="fieldRow">
        <label className="field"><span>Receipt number</span><input value={number} onChange={(e) => setNumber(e.target.value)} placeholder="R-2026-001" /></label>
        <label className="field"><span>Date paid</span><input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label>
        <label className="field"><span>Payment method</span><input value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} placeholder="Credit card, Cash, Wire…" /></label>
      </div>
      <div className="fieldRow">
        <label className="field"><span>From</span><textarea rows={3} value={from} onChange={(e) => setFrom(e.target.value)} /></label>
        <label className="field"><span>Paid by</span><textarea rows={3} value={to} onChange={(e) => setTo(e.target.value)} /></label>
      </div>
      <label className="field"><span>Line items</span>
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
                <input value={item.description} onChange={(e) => updateItem(item.id, { description: e.target.value })} placeholder="Item" />
                <input type="number" min="0" value={item.qty} onChange={(e) => updateItem(item.id, { qty: e.target.value })} />
                <input type="number" min="0" step="0.01" value={item.rate} onChange={(e) => updateItem(item.id, { rate: e.target.value })} />
                <input value={`$${amount.toFixed(2)}`} disabled />
                <button onClick={() => removeItem(item.id)} aria-label="Remove"><Trash2 size={13} /></button>
              </div>
            );
          })}
          <button className="btn btn-soft btn-sm" onClick={() => setItems((c) => [...c, { id: makeId(), description: "", qty: 1, rate: 0 }])} style={{ alignSelf: "flex-start" }}><Plus size={13} /> Add line item</button>
        </div>
      </label>
      <label className="field"><span>Notes</span><textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} /></label>
      <div className="totalsBox">
        <div className="grandTotal"><span>Total paid</span><strong>${totals.total.toFixed(2)}</strong></div>
      </div>
      <button className="btn btn-brand btn-block" onClick={run} disabled={busy}>{busy ? <Spinner size={12} /> : <ArrowDownToLine size={14} />} Download receipt</button>
    </div>
  );
}

function QuoteCard({ brand, setStatus }) {
  const [number, setNumber] = useState("");
  const [issue, setIssue] = useState(new Date().toISOString().slice(0, 10));
  const [validUntil, setValidUntil] = useState("");
  const [from, setFrom] = useState(brand?.companyName ? [brand.companyName, brand.contactLine].filter(Boolean).join("\n") : "");
  const [to, setTo] = useState("");
  const [scope, setScope] = useState("");
  const [items, setItems] = useState([{ id: makeId(), description: "", qty: 1, rate: 0 }]);
  const [taxRate, setTaxRate] = useState(0);
  const [terms, setTerms] = useState("Quote valid for 30 days from issue date. 50% deposit required to begin.");
  const [busy, setBusy] = useState(false);

  const totals = useMemo(() => {
    const subtotal = items.reduce((sum, it) => sum + (Number(it.qty) || 0) * (Number(it.rate) || 0), 0);
    const tax = subtotal * ((Number(taxRate) || 0) / 100);
    return { subtotal, tax, total: subtotal + tax };
  }, [items, taxRate]);
  const updateItem = (id, patch) => setItems((c) => c.map((it) => it.id === id ? { ...it, ...patch } : it));
  const removeItem = (id) => setItems((c) => c.filter((it) => it.id !== id));

  const run = withWorking(async () => {
    if (!items.some((it) => it.description.trim() || Number(it.rate) > 0)) throw new Error("Add at least one line item.");
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([612, 792]);
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const accent = hexToRgb(brand?.primaryColor || "#0f766e");
    page.drawRectangle({ x: 0, y: 700, width: 612, height: 92, color: accent });
    page.drawText("Quote", { x: 54, y: 744, size: 26, font: bold, color: rgb(1, 1, 1) });
    if (number) page.drawText(`# ${normalizePdfText(number)}`, { x: 430, y: 748, size: 12, font: bold, color: rgb(1, 1, 1) });
    page.drawText(`Issued ${issue}`, { x: 430, y: 728, size: 9, font, color: rgb(0.92, 1, 0.98) });
    if (validUntil) page.drawText(`Valid until ${validUntil}`, { x: 430, y: 714, size: 9, font, color: rgb(0.92, 1, 0.98) });

    const drawMultiline = (text, x, startY, label) => {
      page.drawText(label, { x, y: startY, size: 9, font: bold, color: rgb(0.36, 0.42, 0.48) });
      let lineY = startY - 18;
      normalizePdfText(text).split(/\n+/).slice(0, 6).forEach((line) => {
        page.drawText(line, { x, y: lineY, size: 9.5, font, color: rgb(0.06, 0.07, 0.1), maxWidth: 220 });
        lineY -= 14;
      });
    };
    if (from.trim()) drawMultiline(from, 54, 660, "From");
    if (to.trim()) drawMultiline(to, 340, 660, "Prepared for");

    let y = 540;
    if (scope.trim()) {
      page.drawText("Scope", { x: 54, y, size: 10, font: bold, color: rgb(0.36, 0.42, 0.48) });
      y -= 14;
      wrapText(font, normalizePdfText(scope), 9.5, 504).slice(0, 6).forEach((line) => {
        page.drawText(line, { x: 54, y, size: 9.5, font, color: rgb(0.06, 0.07, 0.1) });
        y -= 13;
      });
      y -= 8;
    }

    page.drawRectangle({ x: 54, y: y - 16, width: 504, height: 22, color: rgb(0.92, 0.96, 0.97) });
    page.drawText("Description", { x: 64, y: y - 9, size: 9, font: bold });
    page.drawText("Qty", { x: 340, y: y - 9, size: 9, font: bold });
    page.drawText("Rate", { x: 405, y: y - 9, size: 9, font: bold });
    page.drawText("Amount", { x: 492, y: y - 9, size: 9, font: bold });
    y -= 32;
    items.forEach((item) => {
      const qty = Number(item.qty) || 0;
      const rate = Number(item.rate) || 0;
      page.drawText(normalizePdfText(item.description || "—"), { x: 64, y, size: 10, font, color: rgb(0.06, 0.07, 0.1), maxWidth: 245 });
      page.drawText(String(qty), { x: 342, y, size: 10, font });
      page.drawText(`$${rate.toFixed(2)}`, { x: 405, y, size: 10, font });
      page.drawText(`$${(qty * rate).toFixed(2)}`, { x: 492, y, size: 10, font });
      y -= 22;
    });
    page.drawLine({ start: { x: 340, y: y - 6 }, end: { x: 558, y: y - 6 }, thickness: 1, color: rgb(0.75, 0.82, 0.86) });
    page.drawText(`Subtotal: $${totals.subtotal.toFixed(2)}`, { x: 410, y: y - 22, size: 10, font });
    if (Number(taxRate) > 0) page.drawText(`Tax (${Number(taxRate).toFixed(2)}%): $${totals.tax.toFixed(2)}`, { x: 410, y: y - 36, size: 10, font });
    page.drawText(`Total: $${totals.total.toFixed(2)}`, { x: 410, y: y - 60, size: 15, font: bold, color: rgb(0.06, 0.07, 0.1) });
    if (terms.trim()) {
      page.drawText("Terms", { x: 54, y: 130, size: 10, font: bold, color: rgb(0.36, 0.42, 0.48) });
      wrapText(font, normalizePdfText(terms), 9, 504).slice(0, 6).forEach((line, i) => {
        page.drawText(line, { x: 54, y: 112 - i * 12, size: 9, font, color: rgb(0.06, 0.07, 0.1) });
      });
    }
    const bytes = await pdfDoc.save({ useObjectStreams: true });
    downloadBlob(new Blob([bytes], { type: "application/pdf" }), `${safeBaseName(number || "quote")}.pdf`);
    setStatus("Quote downloaded.", "success");
  }, setBusy, setStatus);

  return (
    <div className="toolCard" data-tool="quote" style={{ gridColumn: "span 2" }}>
      <ToolHeader icon={Quote} title="Quote / estimate" description="Branded quote with scope, line items, validity date, and terms." />
      <div className="fieldRow">
        <label className="field"><span>Quote number</span><input value={number} onChange={(e) => setNumber(e.target.value)} placeholder="Q-2026-001" /></label>
        <label className="field"><span>Issue date</span><input type="date" value={issue} onChange={(e) => setIssue(e.target.value)} /></label>
        <label className="field"><span>Valid until</span><input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} /></label>
        <label className="field"><span>Tax rate %</span><input type="number" min="0" step="0.01" value={taxRate} onChange={(e) => setTaxRate(e.target.value)} /></label>
      </div>
      <div className="fieldRow">
        <label className="field"><span>From</span><textarea rows={3} value={from} onChange={(e) => setFrom(e.target.value)} /></label>
        <label className="field"><span>Prepared for</span><textarea rows={3} value={to} onChange={(e) => setTo(e.target.value)} /></label>
      </div>
      <label className="field"><span>Scope of work</span><textarea rows={3} value={scope} onChange={(e) => setScope(e.target.value)} placeholder="What you will deliver, success criteria, exclusions…" /></label>
      <label className="field"><span>Line items</span>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div className="lineTable">
            <span className="lineHead">Description</span><span className="lineHead">Qty</span><span className="lineHead">Rate</span><span className="lineHead">Amount</span><span></span>
          </div>
          {items.map((item) => {
            const amount = (Number(item.qty) || 0) * (Number(item.rate) || 0);
            return (
              <div className="lineTable" key={item.id}>
                <input value={item.description} onChange={(e) => updateItem(item.id, { description: e.target.value })} placeholder="Deliverable" />
                <input type="number" min="0" value={item.qty} onChange={(e) => updateItem(item.id, { qty: e.target.value })} />
                <input type="number" min="0" step="0.01" value={item.rate} onChange={(e) => updateItem(item.id, { rate: e.target.value })} />
                <input value={`$${amount.toFixed(2)}`} disabled />
                <button onClick={() => removeItem(item.id)} aria-label="Remove"><Trash2 size={13} /></button>
              </div>
            );
          })}
          <button className="btn btn-soft btn-sm" onClick={() => setItems((c) => [...c, { id: makeId(), description: "", qty: 1, rate: 0 }])} style={{ alignSelf: "flex-start" }}><Plus size={13} /> Add line item</button>
        </div>
      </label>
      <label className="field"><span>Terms</span><textarea rows={2} value={terms} onChange={(e) => setTerms(e.target.value)} /></label>
      <div className="totalsBox">
        <div><span>Subtotal</span><strong>${totals.subtotal.toFixed(2)}</strong></div>
        {Number(taxRate) > 0 && <div><span>Tax</span><strong>${totals.tax.toFixed(2)}</strong></div>}
        <div className="grandTotal"><span>Total</span><strong>${totals.total.toFixed(2)}</strong></div>
      </div>
      <button className="btn btn-brand btn-block" onClick={run} disabled={busy}>{busy ? <Spinner size={12} /> : <ArrowDownToLine size={14} />} Download quote</button>
    </div>
  );
}

function ResumeCard({ brand, setStatus }) {
  const [name, setName] = useState("");
  const [headline, setHeadline] = useState("");
  const [contact, setContact] = useState("");
  const [summary, setSummary] = useState("");
  const [experience, setExperience] = useState("");
  const [education, setEducation] = useState("");
  const [skills, setSkills] = useState("");
  const [busy, setBusy] = useState(false);

  const run = withWorking(async () => {
    if (!name.trim()) throw new Error("Enter your name.");
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([612, 792]);
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const accent = hexToRgb(brand?.primaryColor || "#0f766e");
    const margin = 54;
    page.drawRectangle({ x: 0, y: 730, width: 612, height: 62, color: accent });
    page.drawText(normalizePdfText(name), { x: margin, y: 760, size: 22, font: bold, color: rgb(1, 1, 1) });
    if (headline) page.drawText(normalizePdfText(headline), { x: margin, y: 742, size: 11, font, color: rgb(0.92, 1, 0.98) });
    if (contact) page.drawText(normalizePdfText(contact), { x: margin, y: 712, size: 9, font, color: rgb(0.36, 0.42, 0.48) });

    let y = 692;
    const drawSection = (title, body) => {
      if (!body.trim()) return;
      page.drawText(title.toUpperCase(), { x: margin, y, size: 9, font: bold, color: accent });
      page.drawLine({ start: { x: margin, y: y - 4 }, end: { x: 612 - margin, y: y - 4 }, thickness: 0.8, color: accent, opacity: 0.4 });
      y -= 18;
      wrapText(font, normalizePdfText(body), 10, 612 - margin * 2).forEach((line) => {
        if (y < 60) return;
        page.drawText(line || " ", { x: margin, y, size: 10, font, color: rgb(0.06, 0.07, 0.1) });
        y -= 14;
      });
      y -= 12;
    };
    drawSection("Summary", summary);
    drawSection("Experience", experience);
    drawSection("Education", education);
    drawSection("Skills", skills);
    const bytes = await pdfDoc.save({ useObjectStreams: true });
    downloadBlob(new Blob([bytes], { type: "application/pdf" }), `${safeBaseName(name)}-resume.pdf`);
    setStatus("Resume downloaded.", "success");
  }, setBusy, setStatus);

  return (
    <div className="toolCard" data-tool="resume" style={{ gridColumn: "span 2" }}>
      <ToolHeader icon={Award} title="Resume / CV builder" description="One-page resume rendered as a clean, ATS-friendly PDF." />
      <div className="fieldRow">
        <label className="field"><span>Full name</span><input value={name} onChange={(e) => setName(e.target.value)} placeholder="Alex Park" /></label>
        <label className="field"><span>Headline</span><input value={headline} onChange={(e) => setHeadline(e.target.value)} placeholder="Senior Product Designer" /></label>
      </div>
      <label className="field"><span>Contact line</span><input value={contact} onChange={(e) => setContact(e.target.value)} placeholder="alex@example.com · 555-555-5555 · linkedin.com/in/alex" /></label>
      <label className="field"><span>Summary</span><textarea rows={3} value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="2-4 sentence professional summary" /></label>
      <label className="field"><span>Experience</span><textarea rows={6} value={experience} onChange={(e) => setExperience(e.target.value)} placeholder="Role · Company · 2022–Present\n— Bullet about your impact\n— Bullet about your impact" /></label>
      <label className="field"><span>Education</span><textarea rows={3} value={education} onChange={(e) => setEducation(e.target.value)} placeholder="Degree · School · Year" /></label>
      <label className="field"><span>Skills</span><textarea rows={2} value={skills} onChange={(e) => setSkills(e.target.value)} placeholder="Comma-separated list of skills" /></label>
      <button className="btn btn-brand btn-block" onClick={run} disabled={busy}>{busy ? <Spinner size={12} /> : <ArrowDownToLine size={14} />} Download resume PDF</button>
    </div>
  );
}

function AgendaCard({ brand, setStatus }) {
  const [title, setTitle] = useState("Team Sync");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [time, setTime] = useState("10:00");
  const [location, setLocation] = useState("Zoom · link in calendar invite");
  const [attendees, setAttendees] = useState("");
  const [topics, setTopics] = useState("Status update | 10\nBlockers | 10\nNext steps | 10");
  const [busy, setBusy] = useState(false);

  const run = withWorking(async () => {
    if (!title.trim()) throw new Error("Add a title.");
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([612, 792]);
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const accent = hexToRgb(brand?.primaryColor || "#0f766e");
    page.drawRectangle({ x: 0, y: 720, width: 612, height: 72, color: accent });
    page.drawText(normalizePdfText(title), { x: 54, y: 752, size: 22, font: bold, color: rgb(1, 1, 1) });
    page.drawText(`${date} · ${time}`, { x: 54, y: 732, size: 10, font, color: rgb(0.92, 1, 0.98) });
    if (location) page.drawText(normalizePdfText(location), { x: 320, y: 732, size: 10, font, color: rgb(0.92, 1, 0.98) });
    if (attendees.trim()) {
      page.drawText("Attendees", { x: 54, y: 692, size: 9, font: bold, color: rgb(0.36, 0.42, 0.48) });
      let y = 678;
      attendees.split(/[,\n]+/).map((a) => a.trim()).filter(Boolean).slice(0, 12).forEach((person) => {
        page.drawText(`· ${normalizePdfText(person)}`, { x: 54, y, size: 9.5, font, color: rgb(0.06, 0.07, 0.1) });
        y -= 14;
      });
    }
    let y = 590;
    page.drawText("Agenda", { x: 54, y, size: 9, font: bold, color: rgb(0.36, 0.42, 0.48) });
    y -= 18;
    let n = 1;
    topics.split(/\n+/).filter((t) => t.trim()).forEach((line) => {
      const [topic, minutes] = line.split("|").map((s) => (s || "").trim());
      page.drawRectangle({ x: 54, y: y - 6, width: 504, height: 28, color: rgb(0.96, 0.97, 0.99) });
      page.drawText(`${n}. ${normalizePdfText(topic)}`, { x: 64, y: y + 4, size: 10.5, font: bold, color: rgb(0.06, 0.07, 0.1) });
      if (minutes) page.drawText(`${minutes} min`, { x: 510, y: y + 4, size: 10, font, color: accent });
      y -= 36;
      n += 1;
    });
    page.drawText("Notes", { x: 54, y: 100, size: 9, font: bold, color: rgb(0.36, 0.42, 0.48) });
    page.drawLine({ start: { x: 54, y: 88 }, end: { x: 558, y: 88 }, thickness: 0.5, color: rgb(0.75, 0.82, 0.86) });
    page.drawLine({ start: { x: 54, y: 70 }, end: { x: 558, y: 70 }, thickness: 0.5, color: rgb(0.75, 0.82, 0.86) });
    page.drawLine({ start: { x: 54, y: 52 }, end: { x: 558, y: 52 }, thickness: 0.5, color: rgb(0.75, 0.82, 0.86) });
    const bytes = await pdfDoc.save({ useObjectStreams: true });
    downloadBlob(new Blob([bytes], { type: "application/pdf" }), `${safeBaseName(title)}-agenda.pdf`);
    setStatus("Agenda downloaded.", "success");
  }, setBusy, setStatus);

  return (
    <div className="toolCard" data-tool="agenda">
      <ToolHeader icon={CalendarClock} title="Meeting agenda" description="Polished agenda with attendees and timed topics. Use 'Topic | minutes' per line." />
      <div className="fieldRow">
        <label className="field"><span>Title</span><input value={title} onChange={(e) => setTitle(e.target.value)} /></label>
        <label className="field"><span>Date</span><input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label>
        <label className="field"><span>Time</span><input value={time} onChange={(e) => setTime(e.target.value)} /></label>
      </div>
      <label className="field"><span>Location</span><input value={location} onChange={(e) => setLocation(e.target.value)} /></label>
      <label className="field"><span>Attendees (comma or newline separated)</span><textarea rows={2} value={attendees} onChange={(e) => setAttendees(e.target.value)} /></label>
      <label className="field"><span>Topics (one per line, format: <em>Topic | minutes</em>)</span><textarea rows={5} value={topics} onChange={(e) => setTopics(e.target.value)} /></label>
      <button className="btn btn-brand btn-block" onClick={run} disabled={busy}>{busy ? <Spinner size={12} /> : <ArrowDownToLine size={14} />} Download agenda</button>
    </div>
  );
}

function BusinessCardCard({ brand, setStatus }) {
  const [name, setName] = useState("");
  const [title, setTitle] = useState("");
  const [company, setCompany] = useState(brand?.companyName || "");
  const [contact, setContact] = useState(brand?.contactLine || "");
  const [busy, setBusy] = useState(false);

  const run = withWorking(async () => {
    if (!name.trim()) throw new Error("Enter your name.");
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([612, 792]); // Letter, 10-up business cards
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const accent = hexToRgb(brand?.primaryColor || "#0f766e");
    const cardW = 252; // 3.5"
    const cardH = 144; // 2"
    const cols = 2;
    const rows = 5;
    const totalW = cardW * cols;
    const totalH = cardH * rows;
    const offsetX = (612 - totalW) / 2;
    const offsetY = (792 - totalH) / 2;

    let logoImage = null;
    if (brand?.logo?.src) {
      try {
        const bytes = dataUrlToUint8Array(brand.logo.src);
        const lower = `${brand.logo.mime || ""} ${brand.logo.src.slice(0, 40)}`.toLowerCase();
        logoImage = lower.includes("jpg") || lower.includes("jpeg") ? await pdfDoc.embedJpg(bytes) : await pdfDoc.embedPng(bytes);
      } catch (_) { /* ignore */ }
    }

    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < cols; col += 1) {
        const x = offsetX + col * cardW;
        const y = offsetY + (rows - 1 - row) * cardH;
        page.drawRectangle({ x, y, width: cardW, height: cardH, borderColor: rgb(0.85, 0.88, 0.92), borderWidth: 0.5, color: rgb(1, 1, 1) });
        page.drawRectangle({ x, y: y + cardH - 6, width: cardW, height: 6, color: accent });
        page.drawText(normalizePdfText(name), { x: x + 14, y: y + cardH - 36, size: 13, font: bold, color: rgb(0.06, 0.07, 0.1) });
        if (title) page.drawText(normalizePdfText(title), { x: x + 14, y: y + cardH - 50, size: 9, font, color: rgb(0.36, 0.42, 0.48) });
        if (company) page.drawText(normalizePdfText(company), { x: x + 14, y: y + 36, size: 10, font: bold, color: accent });
        if (contact) {
          contact.split(/[\n·|]+/).map((s) => s.trim()).filter(Boolean).slice(0, 3).forEach((line, i) => {
            page.drawText(normalizePdfText(line), { x: x + 14, y: y + 22 - i * 11, size: 8, font, color: rgb(0.36, 0.42, 0.48), maxWidth: cardW - 28 });
          });
        }
        if (logoImage) {
          const w = 28, h = 28;
          page.drawImage(logoImage, { x: x + cardW - w - 12, y: y + cardH - h - 14, width: w, height: h, opacity: 0.9 });
        }
      }
    }
    const bytes = await pdfDoc.save({ useObjectStreams: true });
    downloadBlob(new Blob([bytes], { type: "application/pdf" }), `${safeBaseName(name)}-cards.pdf`);
    setStatus("Business card sheet downloaded (10 cards).", "success");
  }, setBusy, setStatus);

  return (
    <div className="toolCard" data-tool="bizcard">
      <ToolHeader icon={PencilRuler} title="Business card sheet" description="10-up 3.5 by 2 inch cards on a single Letter page. Uses your brand logo and accent." />
      <div className="fieldRow">
        <label className="field"><span>Name</span><input value={name} onChange={(e) => setName(e.target.value)} /></label>
        <label className="field"><span>Title</span><input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Founder & CEO" /></label>
      </div>
      <label className="field"><span>Company</span><input value={company} onChange={(e) => setCompany(e.target.value)} /></label>
      <label className="field"><span>Contact lines (one per line)</span><textarea rows={3} value={contact} onChange={(e) => setContact(e.target.value)} placeholder="alex@example.com\nexample.com\n555-555-5555" /></label>
      <button className="btn btn-brand btn-block" onClick={run} disabled={busy}>{busy ? <Spinner size={12} /> : <ArrowDownToLine size={14} />} Download card sheet</button>
    </div>
  );
}

function LetterCard({ brand, setStatus }) {
  const [sender, setSender] = useState(brand?.companyName ? [brand.companyName, brand.contactLine].filter(Boolean).join("\n") : "");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [recipient, setRecipient] = useState("");
  const [salutation, setSalutation] = useState("Dear ,");
  const [body, setBody] = useState("");
  const [closing, setClosing] = useState("Sincerely,");
  const [signoff, setSignoff] = useState("");
  const [busy, setBusy] = useState(false);

  const run = withWorking(async () => {
    if (!body.trim()) throw new Error("Add letter body content.");
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([612, 792]);
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const margin = 72;
    let y = 792 - margin;
    normalizePdfText(sender).split(/\n+/).slice(0, 4).forEach((line) => {
      page.drawText(line, { x: margin, y, size: 10, font, color: rgb(0.06, 0.07, 0.1) });
      y -= 13;
    });
    y -= 18;
    page.drawText(date, { x: margin, y, size: 10, font, color: rgb(0.06, 0.07, 0.1) });
    y -= 28;
    normalizePdfText(recipient).split(/\n+/).slice(0, 4).forEach((line) => {
      page.drawText(line, { x: margin, y, size: 10, font, color: rgb(0.06, 0.07, 0.1) });
      y -= 13;
    });
    y -= 22;
    page.drawText(normalizePdfText(salutation), { x: margin, y, size: 10.5, font, color: rgb(0.06, 0.07, 0.1) });
    y -= 22;
    wrapText(font, normalizePdfText(body), 10.5, 612 - margin * 2).forEach((line) => {
      if (y < margin + 80) return;
      page.drawText(line || " ", { x: margin, y, size: 10.5, font, color: rgb(0.06, 0.07, 0.1) });
      y -= 16;
    });
    y -= 16;
    page.drawText(normalizePdfText(closing), { x: margin, y, size: 10.5, font, color: rgb(0.06, 0.07, 0.1) });
    y -= 50;
    if (signoff) page.drawText(normalizePdfText(signoff), { x: margin, y, size: 11, font: bold, color: rgb(0.06, 0.07, 0.1) });
    const bytes = await pdfDoc.save({ useObjectStreams: true });
    downloadBlob(new Blob([bytes], { type: "application/pdf" }), `letter.pdf`);
    setStatus("Letter downloaded.", "success");
  }, setBusy, setStatus);

  return (
    <div className="toolCard" data-tool="letter" style={{ gridColumn: "span 2" }}>
      <ToolHeader icon={FileCheck2} title="Formal letter" description="Block-format business letter with sender block, date, recipient, salutation, body, closing, and sign-off." />
      <div className="fieldRow">
        <label className="field"><span>Sender block</span><textarea rows={3} value={sender} onChange={(e) => setSender(e.target.value)} /></label>
        <label className="field"><span>Date</span><input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label>
      </div>
      <label className="field"><span>Recipient</span><textarea rows={3} value={recipient} onChange={(e) => setRecipient(e.target.value)} /></label>
      <div className="fieldRow">
        <label className="field"><span>Salutation</span><input value={salutation} onChange={(e) => setSalutation(e.target.value)} /></label>
        <label className="field"><span>Closing</span><input value={closing} onChange={(e) => setClosing(e.target.value)} /></label>
      </div>
      <label className="field"><span>Body</span><textarea rows={8} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Use blank lines between paragraphs." /></label>
      <label className="field"><span>Sign-off (your printed name)</span><input value={signoff} onChange={(e) => setSignoff(e.target.value)} /></label>
      <button className="btn btn-brand btn-block" onClick={run} disabled={busy}>{busy ? <Spinner size={12} /> : <ArrowDownToLine size={14} />} Download letter</button>
    </div>
  );
}

function ChecklistCard({ brand, setStatus }) {
  const [title, setTitle] = useState("Onboarding checklist");
  const [intro, setIntro] = useState("");
  const [items, setItems] = useState("Verify email\nSet password\nReview welcome packet\nSchedule kickoff");
  const [busy, setBusy] = useState(false);

  const run = withWorking(async () => {
    if (!title.trim()) throw new Error("Add a title.");
    const pdfDoc = await PDFDocument.create();
    let page = pdfDoc.addPage([612, 792]);
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const accent = hexToRgb(brand?.primaryColor || "#0f766e");
    const margin = 54;
    page.drawRectangle({ x: 0, y: 720, width: 612, height: 72, color: accent });
    page.drawText(normalizePdfText(title), { x: margin, y: 752, size: 22, font: bold, color: rgb(1, 1, 1) });
    let y = 692;
    if (intro.trim()) {
      wrapText(font, normalizePdfText(intro), 10.5, 612 - margin * 2).forEach((line) => {
        page.drawText(line, { x: margin, y, size: 10.5, font, color: rgb(0.06, 0.07, 0.1) });
        y -= 15;
      });
      y -= 12;
    }
    items.split(/\n+/).filter((l) => l.trim()).forEach((item) => {
      if (y < 60) { page = pdfDoc.addPage([612, 792]); y = 792 - margin; }
      page.drawRectangle({ x: margin, y: y - 4, width: 12, height: 12, borderColor: accent, borderWidth: 1 });
      page.drawText(normalizePdfText(item), { x: margin + 22, y: y - 2, size: 11, font, color: rgb(0.06, 0.07, 0.1), maxWidth: 612 - margin * 2 - 24 });
      y -= 26;
    });
    const bytes = await pdfDoc.save({ useObjectStreams: true });
    downloadBlob(new Blob([bytes], { type: "application/pdf" }), `${safeBaseName(title)}.pdf`);
    setStatus("Checklist downloaded.", "success");
  }, setBusy, setStatus);

  return (
    <div className="toolCard" data-tool="checklist">
      <ToolHeader icon={ClipboardCheck} title="Checklist / SOP" description="Numbered checklist or SOP. Each line becomes a checkable item." />
      <label className="field"><span>Title</span><input value={title} onChange={(e) => setTitle(e.target.value)} /></label>
      <label className="field"><span>Intro (optional)</span><textarea rows={2} value={intro} onChange={(e) => setIntro(e.target.value)} /></label>
      <label className="field"><span>Items (one per line)</span><textarea rows={8} value={items} onChange={(e) => setItems(e.target.value)} /></label>
      <button className="btn btn-brand btn-block" onClick={run} disabled={busy}>{busy ? <Spinner size={12} /> : <ArrowDownToLine size={14} />} Download checklist</button>
    </div>
  );
}

// ============================================================ Renderers per category

export const UTILITY_CATEGORY_TOOLS = {
  images: ({ setStatus }) => (
    <>
      <ImageCompressCard setStatus={setStatus} />
      <ImageConvertCard setStatus={setStatus} />
      <ImageResizeCard setStatus={setStatus} />
      <FaviconCard setStatus={setStatus} />
    </>
  ),
  data: ({ setStatus }) => (
    <>
      <JsonCard setStatus={setStatus} />
      <CsvJsonCard setStatus={setStatus} />
      <Base64Card setStatus={setStatus} />
      <UrlEncodeCard setStatus={setStatus} />
      <HashCard setStatus={setStatus} />
      <JwtCard setStatus={setStatus} />
      <MarkdownCard setStatus={setStatus} />
    </>
  ),
  quick: ({ setStatus }) => (
    <>
      <PasswordCard setStatus={setStatus} />
      <UuidCard setStatus={setStatus} />
      <LoremCard setStatus={setStatus} />
      <QrCard setStatus={setStatus} />
      <ColorCard setStatus={setStatus} />
      <WordCountCard />
      <CaseCard setStatus={setStatus} />
      <SlugCard setStatus={setStatus} />
      <RegexCard />
      <DiffCard />
    </>
  ),
  docs: ({ brand, setStatus }) => (
    <>
      <ReceiptCard brand={brand} setStatus={setStatus} />
      <QuoteCard brand={brand} setStatus={setStatus} />
      <ResumeCard brand={brand} setStatus={setStatus} />
      <AgendaCard brand={brand} setStatus={setStatus} />
      <BusinessCardCard brand={brand} setStatus={setStatus} />
      <LetterCard brand={brand} setStatus={setStatus} />
      <ChecklistCard brand={brand} setStatus={setStatus} />
    </>
  ),
};

// ============================================================ Local helpers

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function toHex(buffer) {
  return [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function b64UrlDecode(value) {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
  return decodeURIComponent(escape(atob(padded)));
}

function parseCsvLine(line) {
  const result = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const c = line[i];
    if (c === '"' && line[i + 1] === '"' && inQuotes) { current += '"'; i += 1; }
    else if (c === '"') inQuotes = !inQuotes;
    else if (c === "," && !inQuotes) { result.push(current); current = ""; }
    else current += c;
  }
  result.push(current);
  return result.map((c) => c.trim());
}

function csvCell(value) {
  const str = String(value ?? "");
  if (/[",\n\r]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

const LOREM_WORDS = "lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua enim ad minim veniam quis nostrud exercitation ullamco laboris nisi aliquip ex ea commodo consequat duis aute irure in reprehenderit voluptate velit esse cillum eu fugiat nulla pariatur excepteur sint occaecat cupidatat non proident sunt culpa qui officia deserunt mollit anim id est laborum".split(" ");

function generateLorem(n, unit) {
  const word = () => LOREM_WORDS[Math.floor(Math.random() * LOREM_WORDS.length)];
  const sentence = () => {
    const len = 8 + Math.floor(Math.random() * 12);
    const words = Array.from({ length: len }, word);
    return words[0][0].toUpperCase() + words[0].slice(1) + " " + words.slice(1).join(" ") + ".";
  };
  if (unit === "words") return Array.from({ length: n }, word).join(" ");
  if (unit === "sentences") return Array.from({ length: n }, sentence).join(" ");
  return Array.from({ length: n }, () => Array.from({ length: 4 + Math.floor(Math.random() * 4) }, sentence).join(" ")).join("\n\n");
}

function buildPalette(hex) {
  const { r, g, b } = parseHex(hex);
  const tint = (amount) => rgbToHex({
    r: clamp(Math.round(r + (255 - r) * amount), 0, 255),
    g: clamp(Math.round(g + (255 - g) * amount), 0, 255),
    b: clamp(Math.round(b + (255 - b) * amount), 0, 255),
  });
  const shade = (amount) => rgbToHex({
    r: clamp(Math.round(r * (1 - amount)), 0, 255),
    g: clamp(Math.round(g * (1 - amount)), 0, 255),
    b: clamp(Math.round(b * (1 - amount)), 0, 255),
  });
  const complement = rgbToHex({ r: 255 - r, g: 255 - g, b: 255 - b });
  const list = [
    { label: "Tint 90%", value: tint(0.9) },
    { label: "Tint 70%", value: tint(0.7) },
    { label: "Tint 50%", value: tint(0.5) },
    { label: "Tint 30%", value: tint(0.3) },
    { label: "Tint 10%", value: tint(0.1) },
    { label: "Base", value: hex.toLowerCase() },
    { label: "Shade 20%", value: shade(0.2) },
    { label: "Shade 40%", value: shade(0.4) },
    { label: "Shade 60%", value: shade(0.6) },
    { label: "Complement", value: complement },
  ];
  return list.map((swatch) => ({ ...swatch, text: contrastText(swatch.value) }));
}

function parseHex(hex) {
  const value = hex.replace("#", "");
  const full = value.length === 3 ? value.split("").map((c) => c + c).join("") : value;
  const num = parseInt(full, 16);
  return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
}
function rgbToHex({ r, g, b }) {
  return "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("");
}
function contrastText(hex) {
  const { r, g, b } = parseHex(hex);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.55 ? "#0b1320" : "#ffffff";
}

function diffLines(a, b) {
  const aLines = a.split(/\r?\n/);
  const bLines = b.split(/\r?\n/);
  if (!a && !b) return [];
  const result = [];
  const max = Math.max(aLines.length, bLines.length);
  for (let i = 0; i < max; i += 1) {
    const left = aLines[i];
    const right = bLines[i];
    if (left === undefined) result.push({ kind: "add", text: right });
    else if (right === undefined) result.push({ kind: "del", text: left });
    else if (left === right) result.push({ kind: "same", text: left });
    else { result.push({ kind: "del", text: left }); result.push({ kind: "add", text: right }); }
  }
  return result;
}
