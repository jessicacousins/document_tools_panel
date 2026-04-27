import { useEffect, useMemo, useRef, useState } from "react";
import { rgb } from "pdf-lib";
import {
  CheckCircle2,
  Lock,
  PenLine,
  Search,
  ShieldCheck,
  Trash2,
  UploadCloud,
  X,
} from "lucide-react";

// ============================================================ Tool helpers (shared across panels)

export function withWorking(action, setLocal, setStatus) {
  return async () => {
    setLocal?.(true);
    try {
      await action();
    } catch (error) {
      setStatus?.(error?.message || "Something went wrong.", "error");
    } finally {
      setLocal?.(false);
    }
  };
}

export function ToolHeader({ icon: Icon, title, description }) {
  return (
    <div className="cardHead">
      <div className="cardIcon">{Icon ? <Icon size={18} /> : null}</div>
      <div className="cardTitle">
        <h3>{title}</h3>
        <p>{description}</p>
      </div>
    </div>
  );
}

// ============================================================ Pure helpers

export const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
export const makeId = () =>
  crypto?.randomUUID?.() ??
  `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export const COLOR_SWATCHES = [
  "#0b1320",
  "#0f766e",
  "#14b8a6",
  "#7c3aed",
  "#a855f7",
  "#ef4444",
  "#f59e0b",
  "#16a34a",
  "#ffffff",
];
export const HIGHLIGHT_COLOR = "#fde047";

export const PAGE_PRESETS = {
  letter: { label: "Letter", width: 612, height: 792 },
  legal: { label: "Legal", width: 612, height: 1008 },
  a4: { label: "A4", width: 595.28, height: 841.89 },
};

export function hexToRgb(hex) {
  if (!hex) return rgb(0, 0, 0);
  const normalized = hex.replace("#", "");
  const full =
    normalized.length === 3
      ? normalized
          .split("")
          .map((c) => c + c)
          .join("")
      : normalized;
  const value = Number.parseInt(full, 16);
  return rgb(
    ((value >> 16) & 255) / 255,
    ((value >> 8) & 255) / 255,
    (value & 255) / 255,
  );
}

export function dataUrlToUint8Array(dataUrl) {
  const [, base64 = ""] = dataUrl.split(",");
  const binary = window.atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export function downloadBlob(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function safeBaseName(name = "document") {
  return (
    name
      .replace(/\.[^.]+$/i, "")
      .replace(/[^\w.-]+/g, "-")
      .replace(/^-+|-+$/g, "") || "document"
  );
}

export function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function getImageMetrics(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () =>
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = reject;
    img.src = dataUrl;
  });
}

export function parsePageSelection(selection, maxPages) {
  const input = (selection || "").trim();
  if (!input || input.toLowerCase() === "all") {
    return Array.from({ length: maxPages }, (_, index) => index + 1);
  }
  const pages = new Set();
  input.split(",").forEach((part) => {
    const token = part.trim();
    if (!token) return;
    const [startRaw, endRaw] = token
      .split("-")
      .map((value) => Number.parseInt(value, 10));
    if (!Number.isInteger(startRaw)) return;
    const start = startRaw;
    const end = Number.isInteger(endRaw) ? endRaw : start;
    if (start < 1 || end < 1 || start > maxPages || end > maxPages) return;
    const low = Math.min(start, end);
    const high = Math.max(start, end);
    for (let page = low; page <= high; page += 1) pages.add(page);
  });
  return [...pages].sort((a, b) => a - b);
}

export function getPageSelection(selection, maxPages) {
  const pages = parsePageSelection(selection, maxPages);
  if (!pages.length) {
    throw new Error(
      `No valid pages in "${selection}". Use all, or ranges like 1-3, 5.`,
    );
  }
  return pages;
}

export function wrapText(font, text, fontSize, maxWidth) {
  const paragraphs = (text || "").split(/\n+/);
  const lines = [];
  paragraphs.forEach((paragraph) => {
    const words = paragraph.trim().split(/\s+/).filter(Boolean);
    if (!words.length) {
      lines.push("");
      return;
    }
    let current = "";
    words.forEach((word) => {
      const candidate = current ? `${current} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, fontSize) <= maxWidth)
        current = candidate;
      else {
        if (current) lines.push(current);
        current = word;
      }
    });
    if (current) lines.push(current);
  });
  return lines;
}

export function normalizePdfText(text = "") {
  return String(text).replace(/[^\x09\x0A\x0D\x20-\x7E]/g, "");
}

export async function canvasToBlob(canvas, type = "image/png", quality = 0.95) {
  const blob = await new Promise((resolve) =>
    canvas.toBlob(resolve, type, quality),
  );
  if (!blob) throw new Error("The browser could not export a canvas image.");
  return blob;
}

// ============================================================ Brand identity store

const BRAND_KEY = "JC PDF Studio.brand.v1";

const DEFAULT_BRAND = {
  companyName: "",
  contactLine: "",
  logo: null, // { src, name, mime }
  primaryColor: "#0f766e",
  accentColor: "#7c3aed",
  signatures: [], // [{ id, label, src, isDefault }]
};

export function useBrand() {
  const [brand, setBrand] = useState(() => {
    try {
      const raw = window.localStorage.getItem(BRAND_KEY);
      if (raw) return { ...DEFAULT_BRAND, ...JSON.parse(raw) };
    } catch (_) {
      /* ignore */
    }
    return DEFAULT_BRAND;
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(BRAND_KEY, JSON.stringify(brand));
    } catch (_) {
      /* ignore */
    }
  }, [brand]);

  const update = (patch) => setBrand((current) => ({ ...current, ...patch }));

  const setLogo = async (file) => {
    if (!file) return update({ logo: null });
    const src = await readFileAsDataUrl(file);
    update({ logo: { src, name: file.name, mime: file.type } });
  };

  const addSignature = (dataUrl, label) => {
    setBrand((current) => {
      const newSig = {
        id: makeId(),
        label: label || `Signature ${current.signatures.length + 1}`,
        src: dataUrl,
      };
      const signatures = [...current.signatures, newSig];
      if (signatures.length === 1) signatures[0].isDefault = true;
      return { ...current, signatures };
    });
  };

  const removeSignature = (id) => {
    setBrand((current) => {
      const signatures = current.signatures.filter((sig) => sig.id !== id);
      if (signatures.length && !signatures.some((sig) => sig.isDefault))
        signatures[0].isDefault = true;
      return { ...current, signatures };
    });
  };

  const setDefaultSignature = (id) => {
    setBrand((current) => ({
      ...current,
      signatures: current.signatures.map((sig) => ({
        ...sig,
        isDefault: sig.id === id,
      })),
    }));
  };

  const reset = () => setBrand(DEFAULT_BRAND);

  return {
    brand,
    update,
    setLogo,
    addSignature,
    removeSignature,
    setDefaultSignature,
    reset,
  };
}

// ============================================================ Animated SVGs

export function HeroIllustration() {
  return (
    <div style={{ position: "relative", width: 220, height: 220 }}>
      <div className="heroOrbs" />
      <svg
        viewBox="0 0 200 200"
        width="220"
        height="220"
        className="svgFloat"
        style={{ position: "relative" }}
      >
        <defs>
          <linearGradient id="heroGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#14b8a6" />
            <stop offset="100%" stopColor="#7c3aed" />
          </linearGradient>
        </defs>
        <g className="svgPulse">
          <circle cx="60" cy="70" r="38" fill="url(#heroGrad)" opacity="0.15" />
          <circle cx="140" cy="80" r="34" fill="#7c3aed" opacity="0.18" />
          <circle cx="100" cy="140" r="42" fill="#14b8a6" opacity="0.16" />
        </g>
        <g transform="translate(58 36)">
          <rect
            width="84"
            height="112"
            rx="10"
            fill="white"
            stroke="url(#heroGrad)"
            strokeWidth="2"
          />
          <path
            d="M62 0 v22 h22"
            fill="none"
            stroke="url(#heroGrad)"
            strokeWidth="2"
          />
          <path
            d="M16 50 H68 M16 64 H58 M16 78 H46"
            stroke="#0f766e"
            strokeWidth="3"
            strokeLinecap="round"
            opacity="0.7"
          />
        </g>
        <circle cx="148" cy="142" r="20" fill="url(#heroGrad)" />
        <path
          d="M138 142 l8 8 l16 -16"
          fill="none"
          stroke="white"
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}

export function Spinner({ size = 22 }) {
  return (
    <svg
      className="spinnerSvg"
      viewBox="0 0 40 16"
      width={size * 2}
      height={size}
    >
      <circle cx="6" cy="8" r="3" />
      <circle cx="20" cy="8" r="3" />
      <circle cx="34" cy="8" r="3" />
    </svg>
  );
}

export function SuccessCheck({ size = 28 }) {
  return (
    <svg className="checkSvg" viewBox="0 0 56 56" width={size} height={size}>
      <circle cx="28" cy="28" r="24" />
      <path d="M18 29 l8 8 l14 -16" />
    </svg>
  );
}

export function PrismMark({ size = 22 }) {
  return (
    <svg viewBox="0 0 48 48" width={size} height={size}>
      <defs>
        <linearGradient id="markGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#14b8a6" />
          <stop offset="100%" stopColor="#7c3aed" />
        </linearGradient>
      </defs>
      <path
        d="M14 8 h16 l8 8 v24 a4 4 0 0 1 -4 4 H14 a4 4 0 0 1 -4 -4 V12 a4 4 0 0 1 4 -4 z"
        fill="url(#markGrad)"
      />
      <path
        d="M30 8 v8 h8"
        fill="none"
        stroke="white"
        strokeWidth="2"
        opacity="0.85"
      />
      <path
        d="M16 24 h14 M16 30 h12 M16 36 h8"
        stroke="white"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

// ============================================================ Signature pad

export function SignaturePad({
  onCancel,
  onSave,
  label = "Draw your signature",
}) {
  const canvasRef = useRef(null);
  const drawingRef = useRef(false);
  const dirtyRef = useRef(false);
  const [name, setName] = useState("");

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const ratio = window.devicePixelRatio || 1;
    canvas.width = 560 * ratio;
    canvas.height = 220 * ratio;
    ctx.scale(ratio, ratio);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = 3;
    ctx.strokeStyle = "#111827";
    ctx.clearRect(0, 0, 560, 220);
  }, []);

  const getPoint = (event) => {
    const rect = canvasRef.current.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * 560,
      y: ((event.clientY - rect.top) / rect.height) * 220,
    };
  };

  const begin = (event) => {
    event.preventDefault();
    const ctx = canvasRef.current.getContext("2d");
    const point = getPoint(event);
    ctx.beginPath();
    ctx.moveTo(point.x, point.y);
    drawingRef.current = true;
  };
  const draw = (event) => {
    if (!drawingRef.current) return;
    event.preventDefault();
    const ctx = canvasRef.current.getContext("2d");
    const point = getPoint(event);
    ctx.lineTo(point.x, point.y);
    ctx.stroke();
    dirtyRef.current = true;
  };
  const end = () => {
    drawingRef.current = false;
  };
  const clear = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    dirtyRef.current = false;
  };
  const save = () => {
    if (!dirtyRef.current) return;
    onSave(canvasRef.current.toDataURL("image/png"), name.trim());
  };

  return (
    <div
      className="modalShell"
      role="dialog"
      aria-modal="true"
      aria-label="Signature pad"
    >
      <div className="modalCard">
        <div className="modalTitleRow">
          <div>
            <p className="eyebrow">Signature</p>
            <h2>{label}</h2>
          </div>
          <button
            className="btn-icon"
            onClick={onCancel}
            aria-label="Close signature pad"
          >
            <X size={18} />
          </button>
        </div>
        <canvas
          ref={canvasRef}
          className="signatureCanvas"
          onPointerDown={begin}
          onPointerMove={draw}
          onPointerUp={end}
          onPointerLeave={end}
        />
        <label className="field" style={{ marginTop: 12 }}>
          <span>Save as (optional)</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Initials, Full signature"
          />
        </label>
        <div className="modalActions">
          <button className="btn btn-soft" onClick={clear}>
            Clear
          </button>
          <button className="btn btn-ghost" onClick={onCancel}>
            Cancel
          </button>
          <button className="btn btn-brand" onClick={save}>
            Use signature
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================ Empty state

export function EmptyState({ onPick, onOpenTools }) {
  return (
    <section className="emptyState">
      <div className="heroIllustration">
        <HeroIllustration />
      </div>
      <p className="eyebrow">Private. Browser-local. Free forever.</p>
      <h1>The professional PDF studio that respects your documents</h1>
      <p>
        Edit, sign, organize, convert, and generate PDFs entirely in your
        browser. No accounts, no uploads, no paywalls — just the tools every
        team actually needs.
      </p>
      <div className="heroActions">
        <label className="btn btn-brand btn-lg" style={{ cursor: "pointer" }}>
          <input
            type="file"
            accept="application/pdf"
            onChange={onPick}
            hidden
          />
          <UploadCloud size={18} /> Open a PDF
        </label>
        <button className="btn btn-ghost btn-lg" onClick={onOpenTools}>
          Browse all tools
        </button>
      </div>
      <div className="trustGrid">
        <span>
          <Lock size={14} /> Files never leave your device
        </span>
        <span>
          <ShieldCheck size={14} /> No account required
        </span>
        <span>
          <CheckCircle2 size={14} /> Open source friendly
        </span>
      </div>
    </section>
  );
}

// ============================================================ Legal panel

export function LegalPanel() {
  return (
    <div className="legalPanel">
      <section className="controlCard">
        <div className="sectionTitle">
          <ShieldCheck size={16} /> Privacy Policy
        </div>
        <p className="miniText">
          <strong>Effective date:</strong> the date you load the site. This
          policy is reviewed periodically.
        </p>
        <p className="miniText">
          JC PDF Studio (the &quot;Service&quot;) is a static website. Every
          tool runs entirely in your browser. We do not operate any server-side
          file processing. We never receive, store, log, or transmit the
          documents, images, text, or any other content you load into the
          tools. There is no upload endpoint, no document database, and no
          account system.
        </p>
        <h4>1. Information we do not collect</h4>
        <p className="miniText">
          We do not collect names, email addresses, phone numbers, IP-derived
          identifiers, geolocation data, billing data, document contents,
          filenames, file metadata, or any account credentials. There is
          nothing to log into and nothing to subscribe to.
        </p>
        <h4>2. Information stored locally on your device</h4>
        <p className="miniText">
          The Brand page lets you save a company name, logo image, colors,
          and signature drawings. These items are written to your browser&apos;s
          <code> localStorage </code> under a single key
          (<code>JC PDF Studio.brand.v1</code>) and never leave your device.
          You can clear them at any time from the Brand page or by clearing
          your browser site data.
        </p>
        <h4>3. Hosting, CDN, and standard server logs</h4>
        <p className="miniText">
          The site is hosted as static files on Netlify. Like every web host,
          Netlify maintains routine, short-lived request logs (IP address,
          user agent, requested URL, timestamp) for security and abuse
          prevention. We do not query, export, or attach identity to those
          logs. We do not place any analytics, tag managers, or fingerprinting
          scripts in the page.
        </p>
        <h4>4. Advertising</h4>
        <p className="miniText">
          The Service may display third-party advertising (such as Google
          AdSense) to fund free hosting. When ads are enabled, the ad provider
          may set or read cookies and process limited request data (IP, user
          agent, page URL) to serve and measure ads, including potentially
          personalized ads, in accordance with their own policies. You can
          opt out of personalized advertising at
          {" "}<a href="https://adssettings.google.com" target="_blank" rel="noopener noreferrer">Google Ads Settings</a>{" "}
          and manage other vendors at
          {" "}<a href="https://www.aboutads.info/choices/" target="_blank" rel="noopener noreferrer">aboutads.info</a>{" "}
          or
          {" "}<a href="https://www.youronlinechoices.com" target="_blank" rel="noopener noreferrer">youronlinechoices.com</a>.
          Even when ads are present, your document content is still processed
          only in your browser and is not shared with the ad provider.
        </p>
        <h4>5. Cookies</h4>
        <p className="miniText">
          The Service itself does not set any first-party tracking cookies. It
          uses <code>localStorage</code> only for the optional Brand identity
          described in section 2. If advertising is enabled, the ad provider
          may set its own cookies as described in section 4.
        </p>
        <h4>6. Children&apos;s privacy</h4>
        <p className="miniText">
          The Service is not directed at children under 13 and we do not
          knowingly collect information from them. Because the Service does
          not collect personal information at all, this is straightforward.
        </p>
        <h4>7. Your rights (GDPR / CCPA)</h4>
        <p className="miniText">
          Because we do not collect or store your personal information on our
          servers, there is nothing held about you that you would need to
          access, correct, or have deleted. For the locally-stored Brand
          identity in section 2, you can view and delete it yourself at any
          time from the Brand page. Standard host/CDN logs are not associated
          with identity by us.
        </p>
        <h4>8. Changes</h4>
        <p className="miniText">
          We may update this policy as the Service evolves. Material changes
          will be reflected in the modal you are reading right now.
        </p>
      </section>

      <section className="controlCard">
        <div className="sectionTitle">
          <CheckCircle2 size={16} /> Terms of Use
        </div>
        <p className="miniText">
          By using the Service you agree to the following terms. If you do not
          agree, please stop using the Service.
        </p>
        <h4>1. The Service is provided &quot;as is&quot;</h4>
        <p className="miniText">
          The tools are offered free of charge, without warranty of any kind,
          express or implied, including merchantability, fitness for a
          particular purpose, accuracy, and non-infringement. You use the
          Service at your own risk and remain solely responsible for
          validating that any output meets your requirements before relying
          on it.
        </p>
        <h4>2. Limitation of liability</h4>
        <p className="miniText">
          To the maximum extent permitted by law, the operator of the Service
          will not be liable for any indirect, incidental, special,
          consequential, or punitive damages, or any loss of data, profits,
          revenue, or goodwill, arising from your use of the Service —
          including, without limitation, mistakes in document conversion,
          incorrect calculations, signatures placed in error, missed
          redactions, or output that is rejected by a downstream system.
        </p>
        <h4>3. You are responsible for what you process</h4>
        <p className="miniText">
          You confirm that you have the legal right to load, edit, and
          generate the documents you process with the Service, and that doing
          so does not violate any applicable law, contract, court order, or
          third-party right (including copyright, trademark, privacy,
          confidentiality, export control, or sanctions). The Service
          operator does not see and cannot moderate your inputs.
        </p>
        <h4>4. Acceptable use</h4>
        <p className="miniText">
          Do not use the Service to create or distribute material that is
          illegal in your jurisdiction, that defrauds another person, that
          impersonates a government or business, that infringes intellectual
          property, or that produces falsified records of any kind. The
          Whiteout tool covers content visually only — for legally-required
          redaction (HIPAA, eDiscovery, FOIA, GDPR responses), use the
          dedicated <strong>Redact</strong> tool, which rasterizes pages so
          covered text is unrecoverable.
        </p>
        <h4>5. Not legal, financial, or medical advice</h4>
        <p className="miniText">
          Document templates (invoices, quotes, receipts, agreements,
          letters, etc.) are starting points, not legal or financial advice.
          Have a qualified professional review anything that creates legal
          rights or obligations.
        </p>
        <h4>6. Third-party content</h4>
        <p className="miniText">
          The Service uses open-source libraries to render and write PDFs,
          run OCR, and produce DOCX files. Those libraries are governed by
          their own licenses. The Service may also display third-party
          advertising governed by the ad provider&apos;s policies.
        </p>
        <h4>7. Changes to the Service</h4>
        <p className="miniText">
          The Service may add, modify, or remove tools at any time without
          notice. There is no service-level commitment.
        </p>
        <h4>8. Governing law</h4>
        <p className="miniText">
          These terms are governed by the laws of the United States and the
          state in which the operator resides, without regard to
          conflict-of-law principles. Disputes shall be resolved in the
          courts located there.
        </p>
      </section>

      <section className="controlCard">
        <div className="sectionTitle">
          <PenLine size={16} /> Important tool-specific notes
        </div>
        <h4>Whiteout vs Redaction</h4>
        <p className="miniText">
          The Whiteout tool in the Editor covers content visually but does
          not destroy the underlying text. Anyone with the file can copy
          text from beneath a whiteout box. For legal, medical, financial,
          or compliance redaction use the dedicated{" "}
          <strong>Tools → Redact</strong> tool, which rasterizes the affected
          pages and burns the redaction in. Always re-open the redacted
          output and try to copy-and-paste from the redacted area to confirm
          the text is gone before you distribute it.
        </p>
        <h4>OCR accuracy</h4>
        <p className="miniText">
          OCR runs locally with Tesseract.js. Accuracy depends heavily on
          scan quality, language, font, and resolution. Always proofread
          OCR output before relying on it for anything important.
        </p>
        <h4>Compress tool</h4>
        <p className="miniText">
          The Compress tool re-saves the PDF using object streams. Real
          shrinkage depends on what is already optimized in the source. If
          your PDF is dominated by raster images that are already
          well-compressed, the output may be similar in size.
        </p>
        <h4>Brand identity storage</h4>
        <p className="miniText">
          Your saved logo, colors, and signatures live only in this browser
          via <code>localStorage</code>. Different browsers and different
          devices have separate copies. Use the <strong>Brand</strong> page
          to manage them. Clear them any time from the same page.
        </p>
      </section>

      <section className="controlCard">
        <div className="sectionTitle">
          <ShieldCheck size={16} /> Contact
        </div>
        <p className="miniText">
          Privacy or legal questions about this Service can be sent to the
          email address listed on the public site. If no contact email is
          listed, the Service is being used as a free public utility and
          there is no support channel beyond the source repository.
        </p>
      </section>
    </div>
  );
}

// ============================================================ Command palette

export function CommandPalette({ open, items, onClose, onSelect }) {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef(null);

  useEffect(() => {
    if (open) {
      setQuery("");
      setActive(0);
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (item) =>
        item.title.toLowerCase().includes(q) ||
        item.description?.toLowerCase().includes(q) ||
        item.category?.toLowerCase().includes(q) ||
        item.keywords?.some((kw) => kw.toLowerCase().includes(q)),
    );
  }, [items, query]);

  useEffect(() => {
    setActive(0);
  }, [query]);

  const sections = useMemo(() => {
    const map = new Map();
    filtered.forEach((item) => {
      const cat = item.category || "Other";
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat).push(item);
    });
    return [...map.entries()];
  }, [filtered]);

  if (!open) return null;

  const onKeyDown = (event) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((current) => Math.min(filtered.length - 1, current + 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((current) => Math.max(0, current - 1));
    } else if (event.key === "Enter") {
      event.preventDefault();
      if (filtered[active]) onSelect(filtered[active]);
    } else if (event.key === "Escape") {
      event.preventDefault();
      onClose();
    }
  };

  let runningIndex = -1;
  return (
    <div className="paletteShell" onClick={onClose}>
      <div className="paletteCard" onClick={(e) => e.stopPropagation()}>
        <div className="paletteSearch">
          <Search size={18} />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Search every tool — try 'merge', 'sign', 'invoice'…"
            aria-label="Search tools"
          />
          <kbd>esc</kbd>
        </div>
        <div className="paletteList">
          {filtered.length === 0 && (
            <div className="paletteEmpty">
              No tools match "{query}". Try a different keyword.
            </div>
          )}
          {sections.map(([cat, list]) => (
            <div key={cat}>
              <div className="paletteSection">{cat}</div>
              {list.map((item) => {
                runningIndex += 1;
                const Icon = item.icon;
                const isActive = runningIndex === active;
                return (
                  <button
                    key={item.id}
                    className={`paletteItem ${isActive ? "active" : ""}`}
                    onClick={() => onSelect(item)}
                    onMouseEnter={() => setActive(runningIndex)}
                  >
                    <span className="pIcon">
                      {Icon ? <Icon size={16} /> : null}
                    </span>
                    <span className="pBody">
                      <strong>{item.title}</strong>
                      {item.description && <span>{item.description}</span>}
                    </span>
                    <span className="pCat">{cat}</span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ============================================================ Status toast

export function StatusToast({ message, kind = "info", onClose }) {
  useEffect(() => {
    if (!message) return undefined;
    const timer = setTimeout(onClose, kind === "error" ? 5000 : 3200);
    return () => clearTimeout(timer);
  }, [message, kind, onClose]);
  if (!message) return null;
  return (
    <div className={`statusToast ${kind}`} role="status">
      {kind === "success" ? (
        <CheckCircle2 size={16} />
      ) : kind === "error" ? (
        <X size={16} />
      ) : (
        <Spinner size={14} />
      )}
      {message}
    </div>
  );
}

// ============================================================ Drop zone

export function DropZone({ accept, multiple, files, onFiles, label, hint }) {
  const inputRef = useRef(null);
  const [over, setOver] = useState(false);
  const handleFiles = (list) => {
    if (!list?.length) return;
    onFiles(multiple ? Array.from(list) : list[0]);
  };
  return (
    <div
      className="dropZone"
      style={
        over
          ? {
              borderColor: "var(--teal-bright)",
              background: "var(--teal-soft)",
            }
          : undefined
      }
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        handleFiles(e.dataTransfer.files);
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        hidden
        onChange={(e) => {
          handleFiles(e.target.files);
          e.target.value = "";
        }}
      />
      <UploadCloud size={20} />
      <strong>{label}</strong>
      {hint && <span style={{ fontSize: "0.74rem" }}>{hint}</span>}
      {files && (Array.isArray(files) ? files.length > 0 : true) && (
        <div
          style={{
            marginTop: 8,
            display: "flex",
            flexWrap: "wrap",
            gap: 6,
            justifyContent: "center",
          }}
        >
          {(Array.isArray(files) ? files : [files]).map((file, i) => (
            <span className="fileChip" key={`${file.name}-${i}`}>
              <span className="fileChipDot" />
              {file.name}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================ Edit item (PDF overlay)

export function EditItem({ item, zoom, selected, draft, onPointerDown }) {
  const className = `editItem ${item.type} ${selected ? "selected" : ""} ${draft ? "draft" : ""}`;

  if (item.type === "text") {
    return (
      <div
        className={className}
        onPointerDown={onPointerDown}
        style={{
          left: item.x * zoom,
          top: item.y * zoom,
          color: item.color,
          fontSize: item.fontSize * zoom,
        }}
      >
        {item.text}
      </div>
    );
  }

  if (
    item.type === "highlight" ||
    item.type === "whiteout" ||
    item.type === "rectangle"
  ) {
    const isRect = item.type === "rectangle";
    return (
      <div
        className={className}
        onPointerDown={onPointerDown}
        style={{
          left: item.x * zoom,
          top: item.y * zoom,
          width: item.width * zoom,
          height: item.height * zoom,
          background:
            item.type === "highlight"
              ? item.color || HIGHLIGHT_COLOR
              : item.type === "whiteout"
                ? "#ffffff"
                : "transparent",
          border: isRect
            ? `${Math.max(1, (item.strokeWidth || 2) * zoom)}px solid ${item.color || "#0f766e"}`
            : "none",
          opacity: item.type === "highlight" ? 0.42 : 1,
        }}
      />
    );
  }

  if (item.type === "image" || item.type === "signature") {
    return (
      <img
        className={className}
        onPointerDown={onPointerDown}
        alt={item.name || item.type}
        src={item.src}
        draggable="false"
        style={{
          left: item.x * zoom,
          top: item.y * zoom,
          width: item.width * zoom,
          height: item.height * zoom,
        }}
      />
    );
  }

  if (item.type === "pen") {
    const path = item.points
      .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x * zoom} ${p.y * zoom}`)
      .join(" ");
    const bounds = item.points.reduce(
      (acc, p) => ({
        minX: Math.min(acc.minX, p.x),
        minY: Math.min(acc.minY, p.y),
        maxX: Math.max(acc.maxX, p.x),
        maxY: Math.max(acc.maxY, p.y),
      }),
      { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity },
    );
    return (
      <svg
        className={className}
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          overflow: "visible",
          pointerEvents: "none",
        }}
      >
        <path
          d={path}
          fill="none"
          stroke={item.color || "#111827"}
          strokeWidth={Math.max(1, (item.strokeWidth || 2) * zoom)}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d={path}
          fill="none"
          stroke="transparent"
          strokeWidth={Math.max(12, (item.strokeWidth || 2) * zoom + 10)}
          strokeLinecap="round"
          strokeLinejoin="round"
          onPointerDown={onPointerDown}
          style={{ pointerEvents: "stroke" }}
        />
        {selected && Number.isFinite(bounds.minX) && (
          <rect
            className="penSelection"
            x={bounds.minX * zoom - 5}
            y={bounds.minY * zoom - 5}
            width={(bounds.maxX - bounds.minX) * zoom + 10}
            height={(bounds.maxY - bounds.minY) * zoom + 10}
          />
        )}
      </svg>
    );
  }
  return null;
}

// ============================================================ PDF render util

import * as pdfjsLib from "pdfjs-dist";

export async function renderPdfPageToCanvas(
  pdfDocument,
  pageNumber,
  scale = 1.5,
) {
  const page = await pdfDocument.getPage(pageNumber);
  const viewport = page.getViewport({ scale });
  const canvas = window.document.createElement("canvas");
  const context = canvas.getContext("2d", { alpha: false });
  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);
  await page.render({ canvasContext: context, viewport }).promise;
  return { canvas, page, viewport };
}

export async function extractPdfText(file) {
  const buffer = await file.arrayBuffer();
  const document = await pdfjsLib.getDocument({
    data: new Uint8Array(buffer.slice(0)),
  }).promise;
  const pages = [];
  try {
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const content = await page.getTextContent();
      const text = content.items
        .map((item) => item.str)
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();
      pages.push({ pageNumber, text });
    }
  } finally {
    document.destroy?.();
  }
  return pages;
}

export function moveEdit(edit, dx, dy) {
  if (edit.type === "pen") {
    return {
      ...edit,
      points: edit.points.map((p) => ({ x: p.x + dx, y: p.y + dy })),
    };
  }
  return { ...edit, x: edit.x + dx, y: edit.y + dy };
}

export function normalizeDraft(draft) {
  if (!draft) return null;
  if (["highlight", "rectangle", "whiteout"].includes(draft.type)) {
    const x = draft.width < 0 ? draft.x + draft.width : draft.x;
    const y = draft.height < 0 ? draft.y + draft.height : draft.y;
    return {
      ...draft,
      x,
      y,
      width: Math.abs(draft.width),
      height: Math.abs(draft.height),
    };
  }
  return draft;
}

export function parseCsvRows(csvText) {
  return (csvText || "")
    .split(/\n+/)
    .map((row) => row.split(",").map((cell) => normalizePdfText(cell.trim())))
    .filter((row) => row.some(Boolean));
}
