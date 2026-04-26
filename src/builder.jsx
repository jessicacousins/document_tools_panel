import { useEffect, useMemo, useRef, useState } from "react";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import {
  BadgeInfo,
  Brush,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Download,
  FilePlus2,
  FileText,
  ImagePlus,
  PenLine,
  Square,
  Trash2,
  Type,
} from "lucide-react";
import {
  PAGE_PRESETS,
  dataUrlToUint8Array,
  downloadBlob,
  hexToRgb,
  makeId,
  normalizePdfText,
  readFileAsDataUrl,
  safeBaseName,
  wrapText,
} from "./lib.jsx";

const BLOCK_DEFAULTS = {
  heading: "New section",
  text: "",
  callout: "",
  checklist: "",
  divider: "",
  image: "",
  signature: "",
};

export default function BuilderPanel({ brand, setStatus }) {
  const [documentTitle, setDocumentTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [preparedFor, setPreparedFor] = useState("");
  const [preparedBy, setPreparedBy] = useState("");
  const [documentDate, setDocumentDate] = useState(new Date().toISOString().slice(0, 10));
  const [documentVersion, setDocumentVersion] = useState("v1.0");
  const [coverNote, setCoverNote] = useState("");
  const [pagePreset, setPagePreset] = useState("letter");
  const [orientation, setOrientation] = useState("portrait");
  const [accentColor, setAccentColor] = useState(brand?.primaryColor || "#0f766e");
  const [backgroundColor, setBackgroundColor] = useState("#ffffff");
  const [includeHeader, setIncludeHeader] = useState(true);
  const [includeFooter, setIncludeFooter] = useState(true);
  const [includeCover, setIncludeCover] = useState(true);
  const [twoColumnBody, setTwoColumnBody] = useState(false);
  const [bodyFontSize, setBodyFontSize] = useState(10.5);
  const [sectionNumbering, setSectionNumbering] = useState(true);
  const [logo, setLogo] = useState(null);
  const [working, setWorking] = useState(false);
  const [blocks, setBlocks] = useState([
    { id: makeId(), type: "heading", text: "Section heading" },
    { id: makeId(), type: "text", text: "" },
  ]);
  const logoInputRef = useRef(null);

  // Pre-populate from brand on first mount only
  useEffect(() => {
    if (brand?.companyName && !preparedBy) setPreparedBy(brand.companyName);
    if (brand?.logo && !logo) setLogo(brand.logo);
    if (brand?.primaryColor && accentColor === "#0f766e") setAccentColor(brand.primaryColor);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brand?.companyName, brand?.logo, brand?.primaryColor]);

  const basePageSize = PAGE_PRESETS[pagePreset] || PAGE_PRESETS.letter;
  const pageSize = orientation === "landscape"
    ? { width: basePageSize.height, height: basePageSize.width, label: basePageSize.label }
    : basePageSize;

  const updateBlock = (id, patch) =>
    setBlocks((current) => current.map((b) => (b.id === id ? { ...b, ...patch } : b)));

  const addBlock = (type) =>
    setBlocks((current) => [...current, { id: makeId(), type, text: BLOCK_DEFAULTS[type], src: null, name: "" }]);

  const removeBlock = (id) => setBlocks((current) => current.filter((b) => b.id !== id));

  const moveBlock = (id, direction) => {
    setBlocks((current) => {
      const index = current.findIndex((b) => b.id === id);
      const nextIndex = index + direction;
      if (index < 0 || nextIndex < 0 || nextIndex >= current.length) return current;
      const next = [...current];
      [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
      return next;
    });
  };

  const onLogoPick = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const src = await readFileAsDataUrl(file);
    setLogo({ src, name: file.name, mime: file.type });
    event.target.value = "";
  };

  const onBlockImagePick = async (event, id) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const src = await readFileAsDataUrl(file);
    updateBlock(id, { src, name: file.name, mime: file.type, text: file.name });
    event.target.value = "";
  };

  const exportDesignedPdf = async () => {
    setWorking(true);
    setStatus?.("Composing PDF…");
    try {
      const pdfDoc = await PDFDocument.create();
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
      const margin = 54;
      const accent = hexToRgb(accentColor);
      const background = hexToRgb(backgroundColor);
      const imageCache = new Map();
      let pageCount = 0;
      let page;
      let y;

      const embedImage = async (item) => {
        if (!item?.src) return null;
        if (imageCache.has(item.src)) return imageCache.get(item.src);
        const bytes = dataUrlToUint8Array(item.src);
        const lower = `${item.mime || ""} ${item.src.slice(0, 40)}`.toLowerCase();
        const embedded = lower.includes("jpg") || lower.includes("jpeg")
          ? await pdfDoc.embedJpg(bytes)
          : await pdfDoc.embedPng(bytes);
        imageCache.set(item.src, embedded);
        return embedded;
      };

      const addPage = async () => {
        page = pdfDoc.addPage([pageSize.width, pageSize.height]);
        pageCount += 1;
        page.drawRectangle({ x: 0, y: 0, width: pageSize.width, height: pageSize.height, color: background });
        if (includeHeader) {
          page.drawRectangle({ x: 0, y: pageSize.height - 74, width: pageSize.width, height: 74, color: accent, opacity: 0.95 });
          page.drawText(normalizePdfText(documentTitle || "Untitled"), {
            x: margin, y: pageSize.height - 43, size: 20, font: bold, color: rgb(1, 1, 1),
            maxWidth: pageSize.width - margin * 2 - 96,
          });
          if (subtitle) {
            page.drawText(normalizePdfText(subtitle), {
              x: margin, y: pageSize.height - 62, size: 9, font, color: rgb(0.92, 1, 0.98),
              maxWidth: pageSize.width - margin * 2,
            });
          }
          const headerImage = await embedImage(logo);
          if (headerImage) {
            page.drawImage(headerImage, {
              x: pageSize.width - margin - 54,
              y: pageSize.height - 62,
              width: 44, height: 44,
            });
          }
        }
        if (includeFooter) {
          page.drawLine({
            start: { x: margin, y: 38 }, end: { x: pageSize.width - margin, y: 38 },
            thickness: 0.8, color: rgb(0.82, 0.86, 0.9),
          });
          page.drawText(`Page ${pageCount}`, {
            x: pageSize.width - margin - 44, y: 22, size: 8, font, color: rgb(0.36, 0.42, 0.48),
          });
          if (preparedBy) {
            page.drawText(normalizePdfText(preparedBy), {
              x: margin, y: 22, size: 8, font, color: rgb(0.36, 0.42, 0.48),
              maxWidth: pageSize.width - margin * 2 - 80,
            });
          }
        }
        y = includeHeader ? pageSize.height - 104 : pageSize.height - margin;
      };

      const addCover = async () => {
        const cover = pdfDoc.addPage([pageSize.width, pageSize.height]);
        pageCount += 1;
        cover.drawRectangle({ x: 0, y: 0, width: pageSize.width, height: pageSize.height, color: background });
        cover.drawRectangle({ x: 0, y: pageSize.height - 170, width: pageSize.width, height: 170, color: accent });
        cover.drawText(normalizePdfText(documentTitle || "Untitled"), {
          x: margin, y: pageSize.height - 86, size: 30, font: bold, color: rgb(1, 1, 1),
          maxWidth: pageSize.width - margin * 2,
        });
        if (subtitle) {
          cover.drawText(normalizePdfText(subtitle), {
            x: margin, y: pageSize.height - 122, size: 13, font, color: rgb(0.92, 1, 0.98),
            maxWidth: pageSize.width - margin * 2,
          });
        }
        const coverImage = await embedImage(logo);
        if (coverImage) {
          cover.drawImage(coverImage, { x: pageSize.width - margin - 78, y: pageSize.height - 138, width: 66, height: 66 });
        }
        let infoY = pageSize.height - 245;
        const fields = [
          ["Prepared for", preparedFor],
          ["Prepared by", preparedBy],
          ["Date", documentDate],
          ["Version", documentVersion],
        ].filter(([, v]) => v);
        fields.forEach(([label, value]) => {
          cover.drawText(label, { x: margin, y: infoY, size: 9, font: bold, color: rgb(0.36, 0.42, 0.48) });
          cover.drawText(normalizePdfText(value), { x: margin + 120, y: infoY, size: 10, font, color: rgb(0.06, 0.07, 0.1), maxWidth: pageSize.width - margin * 2 - 120 });
          infoY -= 24;
        });
        if (coverNote) {
          cover.drawRectangle({ x: margin, y: 120, width: pageSize.width - margin * 2, height: 150, color: rgb(1, 1, 1), borderColor: accent, borderWidth: 1, opacity: 0.94 });
          let noteY = 246;
          wrapText(font, normalizePdfText(coverNote), 11, pageSize.width - margin * 2 - 32).slice(0, 8).forEach((line) => {
            cover.drawText(line, { x: margin + 16, y: noteY, size: 11, font, color: rgb(0.06, 0.07, 0.1) });
            noteY -= 16;
          });
        }
      };

      const ensureSpace = async (heightNeeded) => { if (y - heightNeeded < 58) await addPage(); };

      if (includeCover) await addCover();
      await addPage();
      let sectionIndex = 0;

      for (const block of blocks) {
        const cleanText = normalizePdfText(block.text || "");
        const contentWidth = pageSize.width - margin * 2;

        if (block.type === "heading") {
          sectionIndex += 1;
          await ensureSpace(38);
          const headingText = sectionNumbering ? `${sectionIndex}. ${cleanText || "Section"}` : cleanText || "Section";
          page.drawText(headingText, { x: margin, y, size: 16, font: bold, color: accent, maxWidth: contentWidth });
          y -= 14;
          page.drawLine({ start: { x: margin, y }, end: { x: pageSize.width - margin, y }, thickness: 1.2, color: accent, opacity: 0.35 });
          y -= 22;
        }

        if (block.type === "text" && cleanText) {
          const lines = wrapText(font, cleanText, Number(bodyFontSize), twoColumnBody ? (contentWidth - 24) / 2 : contentWidth);
          if (twoColumnBody && lines.length > 8) {
            const splitAt = Math.ceil(lines.length / 2);
            const columns = [lines.slice(0, splitAt), lines.slice(splitAt)];
            const height = Math.max(columns[0].length, columns[1].length) * 15 + 8;
            await ensureSpace(height);
            columns.forEach((column, index) => {
              let columnY = y;
              const x = margin + index * ((contentWidth + 24) / 2);
              column.forEach((line) => {
                page.drawText(line || " ", { x, y: columnY, size: Number(bodyFontSize), font, color: rgb(0.06, 0.07, 0.1) });
                columnY -= 15;
              });
            });
            y -= height;
          } else {
            await ensureSpace(lines.length * 15 + 8);
            lines.forEach((line) => {
              page.drawText(line || " ", { x: margin, y, size: Number(bodyFontSize), font, color: rgb(0.06, 0.07, 0.1), maxWidth: contentWidth });
              y -= 15;
            });
            y -= 8;
          }
        }

        if (block.type === "callout" && cleanText) {
          const lines = wrapText(font, cleanText, 10.5, contentWidth - 26);
          const height = Math.max(54, lines.length * 15 + 28);
          await ensureSpace(height + 12);
          page.drawRectangle({ x: margin, y: y - height + 12, width: contentWidth, height, color: rgb(1, 1, 1), borderColor: accent, borderWidth: 1.1, opacity: 0.92 });
          let calloutY = y - 12;
          lines.forEach((line) => {
            page.drawText(line || " ", { x: margin + 14, y: calloutY, size: 10.5, font, color: rgb(0.06, 0.07, 0.1), maxWidth: contentWidth - 26 });
            calloutY -= 15;
          });
          y -= height + 14;
        }

        if (block.type === "checklist" && cleanText) {
          const items = cleanText.split(/\n+/).filter(Boolean);
          await ensureSpace(items.length * 22 + 12);
          items.forEach((item) => {
            page.drawRectangle({ x: margin, y: y - 3, width: 10, height: 10, borderColor: accent, borderWidth: 1 });
            page.drawText(item, { x: margin + 18, y: y - 2, size: 10.5, font, color: rgb(0.06, 0.07, 0.1), maxWidth: contentWidth - 20 });
            y -= 22;
          });
          y -= 6;
        }

        if (block.type === "divider") {
          await ensureSpace(26);
          page.drawLine({ start: { x: margin, y }, end: { x: pageSize.width - margin, y }, thickness: 1, color: accent, opacity: 0.45 });
          y -= 24;
        }

        if (block.type === "image") {
          const embedded = await embedImage(block);
          if (embedded) {
            const maxWidth = contentWidth;
            const maxHeight = 260;
            const scale = Math.min(maxWidth / embedded.width, maxHeight / embedded.height);
            const width = embedded.width * scale;
            const height = embedded.height * scale;
            await ensureSpace(height + 24);
            page.drawImage(embedded, { x: margin + (contentWidth - width) / 2, y: y - height, width, height });
            y -= height + 18;
          }
        }

        if (block.type === "signature") {
          // Use brand default signature first, then text labels as fallback signature lines
          const defaultSig = brand?.signatures?.find((s) => s.isDefault);
          if (defaultSig) {
            const sigImage = await embedImage({ src: defaultSig.src, mime: "image/png" });
            await ensureSpace(74);
            page.drawImage(sigImage, { x: margin, y: y - 50, width: 180, height: 50 });
            page.drawLine({ start: { x: margin, y: y - 56 }, end: { x: margin + 240, y: y - 56 }, thickness: 0.9, color: rgb(0.2, 0.24, 0.3) });
            page.drawText(defaultSig.label, { x: margin, y: y - 70, size: 9, font, color: rgb(0.36, 0.42, 0.48) });
            y -= 78;
          } else {
            const names = (cleanText || "Signature\nDate").split(/\n+/).filter(Boolean);
            const columnWidth = (contentWidth - 24) / Math.max(1, names.length);
            await ensureSpace(74);
            names.forEach((name, index) => {
              const x = margin + index * (columnWidth + 24);
              page.drawLine({ start: { x, y: y - 20 }, end: { x: x + columnWidth, y: y - 20 }, thickness: 0.9, color: rgb(0.2, 0.24, 0.3) });
              page.drawText(name, { x, y: y - 38, size: 9, font, color: rgb(0.36, 0.42, 0.48), maxWidth: columnWidth });
            });
            y -= 72;
          }
        }
      }

      const bytes = await pdfDoc.save({ useObjectStreams: true });
      downloadBlob(new Blob([bytes], { type: "application/pdf" }), `${safeBaseName(documentTitle || "designed-pdf")}.pdf`);
      setStatus?.(`PDF downloaded — ${pageCount} page${pageCount === 1 ? "" : "s"}.`, "success");
    } catch (error) {
      setStatus?.(error?.message || "Could not export the PDF.", "error");
    } finally {
      setWorking(false);
    }
  };

  return (
    <div className="builderLayout">
      <aside className="builderControls">
        <section className="builderPanel">
          <div className="sectionTitle"><Brush size={14} /> Document setup</div>
          <label className="field"><span>Title</span><input value={documentTitle} onChange={(e) => setDocumentTitle(e.target.value)} placeholder="Untitled" /></label>
          <label className="field"><span>Subtitle</span><input value={subtitle} onChange={(e) => setSubtitle(e.target.value)} placeholder="Optional descriptor" /></label>
          <div className="fieldRow">
            <label className="field"><span>Prepared for</span><input value={preparedFor} onChange={(e) => setPreparedFor(e.target.value)} placeholder="Recipient" /></label>
            <label className="field"><span>Prepared by</span><input value={preparedBy} onChange={(e) => setPreparedBy(e.target.value)} placeholder="You / your company" /></label>
          </div>
          <div className="fieldRow">
            <label className="field"><span>Date</span><input type="date" value={documentDate} onChange={(e) => setDocumentDate(e.target.value)} /></label>
            <label className="field"><span>Version</span><input value={documentVersion} onChange={(e) => setDocumentVersion(e.target.value)} placeholder="v1.0" /></label>
          </div>
          <label className="field"><span>Cover note</span><textarea rows={3} value={coverNote} onChange={(e) => setCoverNote(e.target.value)} placeholder="Optional summary, scope, or instructions for the cover page" /></label>
          <div className="fieldRow">
            <label className="field"><span>Page size</span>
              <select value={pagePreset} onChange={(e) => setPagePreset(e.target.value)}>
                {Object.entries(PAGE_PRESETS).map(([key, p]) => <option key={key} value={key}>{p.label}</option>)}
              </select>
            </label>
            <label className="field"><span>Orientation</span>
              <select value={orientation} onChange={(e) => setOrientation(e.target.value)}>
                <option value="portrait">Portrait</option>
                <option value="landscape">Landscape</option>
              </select>
            </label>
          </div>
          <div className="fieldRow">
            <label className="field"><span>Accent</span><input type="color" value={accentColor} onChange={(e) => setAccentColor(e.target.value)} /></label>
            <label className="field"><span>Background</span><input type="color" value={backgroundColor} onChange={(e) => setBackgroundColor(e.target.value)} /></label>
          </div>
          <label className="toggle"><input type="checkbox" checked={includeHeader} onChange={(e) => setIncludeHeader(e.target.checked)} /> Header band on each page</label>
          <label className="toggle"><input type="checkbox" checked={includeFooter} onChange={(e) => setIncludeFooter(e.target.checked)} /> Footer with page numbers</label>
          <label className="toggle"><input type="checkbox" checked={includeCover} onChange={(e) => setIncludeCover(e.target.checked)} /> Cover page</label>
          <label className="toggle"><input type="checkbox" checked={twoColumnBody} onChange={(e) => setTwoColumnBody(e.target.checked)} /> Two-column body text</label>
          <label className="toggle"><input type="checkbox" checked={sectionNumbering} onChange={(e) => setSectionNumbering(e.target.checked)} /> Number sections</label>
          <label className="field"><span>Body font size</span><input type="number" min="8" max="16" step="0.5" value={bodyFontSize} onChange={(e) => setBodyFontSize(e.target.value)} /></label>
          <input ref={logoInputRef} hidden type="file" accept="image/png,image/jpeg,image/jpg" onChange={onLogoPick} />
          <button className="btn btn-soft btn-block" onClick={() => logoInputRef.current?.click()}>
            <ImagePlus size={14} /> {logo ? `Logo: ${logo.name}` : "Upload header logo"}
          </button>
          {brand?.logo && !logo && (
            <button className="btn btn-ghost btn-block" onClick={() => setLogo(brand.logo)}>
              <ImagePlus size={14} /> Use brand logo
            </button>
          )}
        </section>

        <section className="builderPanel">
          <div className="sectionTitle"><FilePlus2 size={14} /> Add content blocks</div>
          <div className="blockButtonGrid">
            <button onClick={() => addBlock("heading")}><Type size={13} /> Heading</button>
            <button onClick={() => addBlock("text")}><FileText size={13} /> Text</button>
            <button onClick={() => addBlock("callout")}><BadgeInfo size={13} /> Callout</button>
            <button onClick={() => addBlock("checklist")}><CheckCircle2 size={13} /> Checklist</button>
            <button onClick={() => addBlock("image")}><ImagePlus size={13} /> Image</button>
            <button onClick={() => addBlock("signature")}><PenLine size={13} /> Signature</button>
            <button onClick={() => addBlock("divider")}><Square size={13} /> Divider</button>
          </div>
        </section>
      </aside>

      <section className="builderCanvasPanel">
        <div className="builderToolbar">
          <span><strong style={{ color: "var(--ink)" }}>{pageSize.label}</strong> · {orientation} · {blocks.length} block{blocks.length === 1 ? "" : "s"}</span>
          <button className="btn btn-brand" onClick={exportDesignedPdf} disabled={working}>
            <Download size={16} /> Download designed PDF
          </button>
        </div>
        <div className="builderPreview">
          <article className="previewSheet">
            {includeHeader && (
              <div className="previewHeader" style={{ background: accentColor }}>
                <div>
                  <h3>{documentTitle || "Untitled"}</h3>
                  {subtitle && <p>{subtitle}</p>}
                  {(preparedFor || documentDate) && <p style={{ marginTop: 4 }}>{[preparedFor, documentDate, documentVersion].filter(Boolean).join(" · ")}</p>}
                </div>
                {logo && <img src={logo.src} alt={logo.name || "Logo"} />}
              </div>
            )}
            <div className="previewBody">
              {includeCover && (
                <article className="previewBlock">
                  <div className="blockControls"><span>Cover</span></div>
                  {preparedBy && <strong>{preparedBy}</strong>}
                  <p>{coverNote || <em style={{ color: "var(--muted)" }}>Add a cover note above to fill this section</em>}</p>
                </article>
              )}
              {blocks.map((block, index) => (
                <article key={block.id} className={`previewBlock ${block.type}`}>
                  <div className="blockControls">
                    <span>{block.type}</span>
                    <button onClick={() => moveBlock(block.id, -1)} disabled={index === 0} aria-label="Move up"><ChevronLeft size={12} /></button>
                    <button onClick={() => moveBlock(block.id, 1)} disabled={index === blocks.length - 1} aria-label="Move down"><ChevronRight size={12} /></button>
                    <button onClick={() => removeBlock(block.id)} aria-label="Remove"><Trash2 size={12} /></button>
                  </div>
                  {block.type === "divider" ? (
                    <div className="previewDivider" style={{ borderColor: accentColor }} />
                  ) : block.type === "image" ? (
                    <div className="imageBlockEditor">
                      <label className="btn btn-soft btn-block" style={{ cursor: "pointer" }}>
                        <input hidden type="file" accept="image/png,image/jpeg,image/jpg" onChange={(e) => onBlockImagePick(e, block.id)} />
                        <ImagePlus size={14} /> {block.name || "Choose image"}
                      </label>
                      {block.src && <img src={block.src} alt={block.name || "Block image"} />}
                    </div>
                  ) : block.type === "signature" && brand?.signatures?.find((s) => s.isDefault) ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      <img src={brand.signatures.find((s) => s.isDefault).src} alt="Signature" style={{ height: 50, alignSelf: "flex-start", filter: "drop-shadow(0 0 0 transparent)" }} />
                      <span className="miniText">Signed: {brand.signatures.find((s) => s.isDefault).label}</span>
                    </div>
                  ) : (
                    <textarea
                      rows={block.type === "text" ? 4 : block.type === "checklist" ? 4 : 2}
                      value={block.text}
                      onChange={(e) => updateBlock(block.id, { text: e.target.value })}
                      placeholder={
                        block.type === "heading" ? "Heading text" :
                        block.type === "text" ? "Body content" :
                        block.type === "callout" ? "Important note or warning" :
                        block.type === "checklist" ? "First item\nSecond item\nThird item" :
                        block.type === "signature" ? "Signature label\nDate" : ""
                      }
                    />
                  )}
                </article>
              ))}
            </div>
            {includeFooter && <div className="previewFooter">{preparedBy ? `${preparedBy} · ` : ""}Page numbers enabled</div>}
          </article>
        </div>
      </section>
    </div>
  );
}
