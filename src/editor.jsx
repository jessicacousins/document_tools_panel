import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as pdfjsLib from "pdfjs-dist";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import {
  Brush,
  ChevronLeft,
  ChevronRight,
  Download,
  Eraser,
  FileText,
  Highlighter,
  ImagePlus,
  MousePointer2,
  PenLine,
  Redo2,
  RotateCcw,
  Square,
  Trash2,
  Type,
  Undo2,
  UploadCloud,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import {
  COLOR_SWATCHES,
  EditItem,
  HIGHLIGHT_COLOR,
  SignaturePad,
  Spinner,
  clamp,
  dataUrlToUint8Array,
  hexToRgb,
  makeId,
  moveEdit,
  normalizeDraft,
} from "./lib.jsx";

const TOOL_SET = [
  { id: "select",    label: "Select",    icon: MousePointer2, hint: "Move or delete edits" },
  { id: "text",      label: "Text",      icon: Type,          hint: "Click page to add text" },
  { id: "highlight", label: "Highlight", icon: Highlighter,   hint: "Drag a highlight box" },
  { id: "pen",       label: "Draw",      icon: Brush,         hint: "Freehand ink" },
  { id: "rectangle", label: "Box",       icon: Square,        hint: "Draw outline boxes" },
  { id: "whiteout",  label: "Whiteout",  icon: Eraser,        hint: "Cover visible content" },
  { id: "signature", label: "Sign",      icon: PenLine,       hint: "Place signature" },
  { id: "image",     label: "Image",     icon: ImagePlus,     hint: "Upload and place image" },
];

export default function EditorPanel({ pdfFile, onClose, brand, onAddSignature, setStatus }) {
  const [pdf, setPdf] = useState(null);
  const [sourceBytes, setSourceBytes] = useState(null);
  const [fileName, setFileName] = useState(pdfFile?.name || "untitled.pdf");
  const [numPages, setNumPages] = useState(0);
  const [pageNumber, setPageNumber] = useState(1);
  const [pageSizes, setPageSizes] = useState({});
  const [zoom, setZoom] = useState(1);
  const [tool, setTool] = useState("select");
  const [edits, setEdits] = useState([]);
  const [history, setHistory] = useState({ past: [], future: [] });
  const [selectedId, setSelectedId] = useState(null);
  const [draft, setDraft] = useState(null);
  const [moving, setMoving] = useState(null);
  const [rendering, setRendering] = useState(false);
  const [textValue, setTextValue] = useState("");
  const [fontSize, setFontSize] = useState(16);
  const [activeColor, setActiveColor] = useState("#0b1320");
  const [strokeWidth, setStrokeWidth] = useState(3);
  const [sideTab, setSideTab] = useState("style");
  const [pendingImage, setPendingImage] = useState(null);
  const [showSignature, setShowSignature] = useState(false);
  const [working, setWorking] = useState(false);

  const canvasRef = useRef(null);
  const stageRef = useRef(null);
  const imageInputRef = useRef(null);
  const editsRef = useRef(edits);

  useEffect(() => { editsRef.current = edits; }, [edits]);

  const selectedEdit = useMemo(
    () => edits.find((edit) => edit.id === selectedId),
    [edits, selectedId]
  );
  const currentPageEdits = useMemo(
    () => edits.filter((edit) => edit.page === pageNumber),
    [edits, pageNumber]
  );
  const normalizedDraft = normalizeDraft(draft);
  const currentSize = pageSizes[pageNumber] || { width: 612, height: 792 };

  const commitEdits = useCallback((nextEdits) => {
    setHistory((current) => ({ past: [...current.past, editsRef.current], future: [] }));
    setEdits(nextEdits);
  }, []);

  const pushEdit = useCallback((edit) => {
    commitEdits([...editsRef.current, edit]);
    setSelectedId(edit.id);
    setTool("select");
  }, [commitEdits]);

  const undo = () => {
    setHistory((current) => {
      if (!current.past.length) return current;
      const previous = current.past[current.past.length - 1];
      const past = current.past.slice(0, -1);
      const future = [editsRef.current, ...current.future];
      setEdits(previous);
      setSelectedId(null);
      return { past, future };
    });
  };

  const redo = () => {
    setHistory((current) => {
      if (!current.future.length) return current;
      const [next, ...future] = current.future;
      const past = [...current.past, editsRef.current];
      setEdits(next);
      setSelectedId(null);
      return { past, future };
    });
  };

  const updateSelected = (patch) => {
    if (!selectedId) return;
    commitEdits(editsRef.current.map((e) => (e.id === selectedId ? { ...e, ...patch } : e)));
  };

  const deleteSelected = () => {
    if (!selectedId) return;
    commitEdits(editsRef.current.filter((e) => e.id !== selectedId));
    setSelectedId(null);
  };

  // Load file
  useEffect(() => {
    if (!pdfFile) return;
    let cancelled = false;
    (async () => {
      setWorking(true);
      setStatus?.("Loading PDF…");
      try {
        const arrayBuffer = await pdfFile.arrayBuffer();
        const bytes = new Uint8Array(arrayBuffer);
        const document = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer.slice(0)) }).promise;
        if (cancelled) { document.destroy?.(); return; }
        const sizes = {};
        for (let page = 1; page <= document.numPages; page += 1) {
          const pdfPage = await document.getPage(page);
          const viewport = pdfPage.getViewport({ scale: 1 });
          sizes[page] = { width: viewport.width, height: viewport.height };
        }
        if (cancelled) { document.destroy?.(); return; }
        setPdf(document);
        setSourceBytes(bytes);
        setFileName(pdfFile.name || "document.pdf");
        setNumPages(document.numPages);
        setPageNumber(1);
        setPageSizes(sizes);
        setZoom(1);
        setEdits([]);
        setHistory({ past: [], future: [] });
        setSelectedId(null);
        setStatus?.(`Loaded ${pdfFile.name}`);
      } catch (error) {
        setStatus?.(`Could not open this file: ${error?.message || "unknown error"}`, "error");
      } finally {
        if (!cancelled) setWorking(false);
      }
    })();
    return () => { cancelled = true; };
  }, [pdfFile, setStatus]);

  // Keyboard shortcuts
  useEffect(() => {
    const onKeyDown = (event) => {
      const mod = event.ctrlKey || event.metaKey;
      const target = event.target;
      const isTyping = ["INPUT", "TEXTAREA", "SELECT"].includes(target?.tagName);
      if (mod && event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) redo(); else undo();
      } else if (mod && event.key.toLowerCase() === "y") {
        event.preventDefault();
        redo();
      } else if ((event.key === "Delete" || event.key === "Backspace") && selectedId && !isTyping) {
        event.preventDefault();
        deleteSelected();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedId]);

  // Render current page
  useEffect(() => {
    if (!pdf || !canvasRef.current) return undefined;
    let cancelled = false;
    let renderTask = null;
    (async () => {
      setRendering(true);
      try {
        const page = await pdf.getPage(pageNumber);
        const viewport = page.getViewport({ scale: zoom });
        const canvas = canvasRef.current;
        if (!canvas) return;
        const context = canvas.getContext("2d", { alpha: false });
        const outputScale = window.devicePixelRatio || 1;
        canvas.width = Math.floor(viewport.width * outputScale);
        canvas.height = Math.floor(viewport.height * outputScale);
        canvas.style.width = `${viewport.width}px`;
        canvas.style.height = `${viewport.height}px`;
        context.setTransform(outputScale, 0, 0, outputScale, 0, 0);
        context.clearRect(0, 0, viewport.width, viewport.height);
        renderTask = page.render({ canvasContext: context, viewport });
        await renderTask.promise;
      } catch (error) {
        if (!cancelled && error?.name !== "RenderingCancelledException") {
          setStatus?.("Could not render this page.", "error");
        }
      } finally {
        if (!cancelled) setRendering(false);
      }
    })();
    return () => { cancelled = true; try { renderTask?.cancel?.(); } catch (_) { /* noop */ } };
  }, [pdf, pageNumber, zoom, setStatus]);

  const stagePoint = (event) => {
    const rect = stageRef.current.getBoundingClientRect();
    return {
      x: clamp((event.clientX - rect.left) / zoom, 0, currentSize.width),
      y: clamp((event.clientY - rect.top) / zoom, 0, currentSize.height),
    };
  };

  const placeImage = (point, image) => {
    const maxWidth = Math.min(220, currentSize.width * 0.42);
    const aspect = image.naturalWidth && image.naturalHeight ? image.naturalHeight / image.naturalWidth : 0.5;
    const width = image.kind === "signature" ? Math.min(260, currentSize.width * 0.5) : maxWidth;
    const height = image.kind === "signature" ? width * 0.34 : width * aspect;
    pushEdit({
      id: makeId(),
      type: image.kind === "signature" ? "signature" : "image",
      page: pageNumber,
      x: clamp(point.x - width / 2, 0, currentSize.width - width),
      y: clamp(point.y - height / 2, 0, currentSize.height - height),
      width,
      height,
      src: image.src,
      name: image.name || "Image",
      mime: image.mime || "image/png",
    });
    setPendingImage(null);
  };

  const onStagePointerDown = (event) => {
    if (!pdf || event.button !== 0) return;
    const point = stagePoint(event);
    setSelectedId(null);

    if (tool === "text") {
      pushEdit({
        id: makeId(), type: "text", page: pageNumber,
        x: point.x, y: point.y,
        text: textValue || "Text",
        fontSize, color: activeColor,
      });
      return;
    }

    if ((tool === "image" || tool === "signature") && pendingImage) {
      placeImage(point, pendingImage);
      return;
    }

    if (tool === "signature" && !pendingImage) {
      setShowSignature(true);
      return;
    }

    if (tool === "image" && !pendingImage) {
      imageInputRef.current?.click();
      return;
    }

    if (["highlight", "rectangle", "whiteout"].includes(tool)) {
      stageRef.current.setPointerCapture?.(event.pointerId);
      setDraft({
        id: makeId(), type: tool, page: pageNumber,
        x: point.x, y: point.y, startX: point.x, startY: point.y,
        width: 0, height: 0,
        color: tool === "highlight" ? HIGHLIGHT_COLOR : activeColor,
        strokeWidth,
      });
    }

    if (tool === "pen") {
      stageRef.current.setPointerCapture?.(event.pointerId);
      setDraft({ id: makeId(), type: "pen", page: pageNumber, points: [point], color: activeColor, strokeWidth });
    }
  };

  const onStagePointerMove = (event) => {
    if (moving) {
      const point = stagePoint(event);
      const dx = point.x - moving.startX;
      const dy = point.y - moving.startY;
      setEdits(moving.startEdits.map((edit) => (edit.id === moving.id ? moveEdit(edit, dx, dy) : edit)));
      return;
    }
    if (!draft) return;
    const point = stagePoint(event);
    if (["highlight", "rectangle", "whiteout"].includes(draft.type)) {
      setDraft({ ...draft, width: point.x - draft.startX, height: point.y - draft.startY });
    }
    if (draft.type === "pen") {
      const last = draft.points[draft.points.length - 1];
      if (Math.hypot(point.x - last.x, point.y - last.y) > 1.4) {
        setDraft({ ...draft, points: [...draft.points, point] });
      }
    }
  };

  const onStagePointerUp = () => {
    if (moving) {
      const changed = JSON.stringify(moving.startEdits) !== JSON.stringify(editsRef.current);
      if (changed) setHistory((current) => ({ ...current, past: [...current.past, moving.startEdits], future: [] }));
      setMoving(null);
      return;
    }
    if (!draft) return;
    const finalDraft = normalizeDraft(draft);
    setDraft(null);
    if (!finalDraft) return;
    if (finalDraft.type === "pen") { if (finalDraft.points.length > 1) pushEdit(finalDraft); return; }
    if (finalDraft.width > 4 && finalDraft.height > 4) pushEdit(finalDraft);
  };

  const beginMove = (event, item) => {
    if (tool !== "select") return;
    event.stopPropagation();
    setSelectedId(item.id);
    const point = stagePoint(event);
    setMoving({ id: item.id, startX: point.x, startY: point.y, startEdits: editsRef.current });
  };

  const onImagePick = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const valid = ["image/png", "image/jpeg", "image/jpg"].includes(file.type);
    if (!valid) {
      setStatus?.("Choose a PNG or JPG image.", "error");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        setPendingImage({
          kind: "image",
          src: reader.result,
          name: file.name,
          mime: file.type,
          naturalWidth: img.naturalWidth,
          naturalHeight: img.naturalHeight,
        });
        setTool("image");
        setStatus?.("Image ready — click the page to place it.");
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
    event.target.value = "";
  };

  const useSavedSignature = (signature) => {
    const img = new Image();
    img.onload = () => {
      setPendingImage({
        kind: "signature",
        src: signature.src,
        name: signature.label,
        mime: "image/png",
        naturalWidth: img.naturalWidth,
        naturalHeight: img.naturalHeight,
      });
      setTool("signature");
      setStatus?.("Signature ready — click the page to place it.");
    };
    img.src = signature.src;
  };

  const useBrandLogo = () => {
    if (!brand?.logo) return;
    const img = new Image();
    img.onload = () => {
      setPendingImage({
        kind: "image",
        src: brand.logo.src,
        name: brand.logo.name || "Brand logo",
        mime: brand.logo.mime || "image/png",
        naturalWidth: img.naturalWidth,
        naturalHeight: img.naturalHeight,
      });
      setTool("image");
      setStatus?.("Logo ready — click the page to place it.");
    };
    img.src = brand.logo.src;
  };

  const onSignatureSave = (dataUrl, label) => {
    onAddSignature?.(dataUrl, label);
    const img = new Image();
    img.onload = () => {
      setPendingImage({
        kind: "signature",
        src: dataUrl,
        name: label || "Signature",
        mime: "image/png",
        naturalWidth: img.naturalWidth,
        naturalHeight: img.naturalHeight,
      });
      setTool("signature");
      setShowSignature(false);
      setStatus?.("Signature ready — click the page to place it.");
    };
    img.src = dataUrl;
  };

  const exportEditedPdf = async () => {
    if (!sourceBytes) return;
    setWorking(true);
    setStatus?.("Building edited PDF…");
    try {
      const pdfDoc = await PDFDocument.load(sourceBytes);
      const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
      const cache = new Map();
      const embed = async (edit) => {
        if (cache.has(edit.src)) return cache.get(edit.src);
        const bytes = dataUrlToUint8Array(edit.src);
        const lower = `${edit.mime || ""} ${edit.src.slice(0, 40)}`.toLowerCase();
        const image = lower.includes("jpg") || lower.includes("jpeg")
          ? await pdfDoc.embedJpg(bytes)
          : await pdfDoc.embedPng(bytes);
        cache.set(edit.src, image);
        return image;
      };

      for (const edit of editsRef.current) {
        const page = pdfDoc.getPages()[edit.page - 1];
        if (!page) continue;
        const { width: pdfWidth, height: pdfHeight } = page.getSize();
        const browserSize = pageSizes[edit.page] || { width: pdfWidth, height: pdfHeight };
        const sx = pdfWidth / browserSize.width;
        const sy = pdfHeight / browserSize.height;
        const avgScale = (sx + sy) / 2;

        if (edit.type === "text") {
          page.drawText(edit.text || "Text", {
            x: edit.x * sx,
            y: pdfHeight - edit.y * sy - edit.fontSize * sy,
            size: edit.fontSize * avgScale,
            color: hexToRgb(edit.color || "#0b1320"),
            font: edit.fontSize >= 22 ? helveticaBold : helvetica,
            maxWidth: Math.max(10, (browserSize.width - edit.x - 16) * sx),
          });
        }
        if (edit.type === "highlight") {
          page.drawRectangle({
            x: edit.x * sx, y: pdfHeight - (edit.y + edit.height) * sy,
            width: edit.width * sx, height: edit.height * sy,
            color: hexToRgb(edit.color || HIGHLIGHT_COLOR), opacity: 0.38,
          });
        }
        if (edit.type === "whiteout") {
          page.drawRectangle({
            x: edit.x * sx, y: pdfHeight - (edit.y + edit.height) * sy,
            width: edit.width * sx, height: edit.height * sy,
            color: rgb(1, 1, 1), opacity: 1,
          });
        }
        if (edit.type === "rectangle") {
          page.drawRectangle({
            x: edit.x * sx, y: pdfHeight - (edit.y + edit.height) * sy,
            width: edit.width * sx, height: edit.height * sy,
            borderColor: hexToRgb(edit.color || activeColor),
            borderWidth: (edit.strokeWidth || 2) * avgScale,
            opacity: 0.98,
          });
        }
        if (edit.type === "pen") {
          for (let i = 1; i < edit.points.length; i += 1) {
            const start = edit.points[i - 1];
            const end = edit.points[i];
            page.drawLine({
              start: { x: start.x * sx, y: pdfHeight - start.y * sy },
              end: { x: end.x * sx, y: pdfHeight - end.y * sy },
              thickness: (edit.strokeWidth || 2) * avgScale,
              color: hexToRgb(edit.color || activeColor), opacity: 0.95,
            });
          }
        }
        if (edit.type === "image" || edit.type === "signature") {
          const image = await embed(edit);
          page.drawImage(image, {
            x: edit.x * sx, y: pdfHeight - (edit.y + edit.height) * sy,
            width: edit.width * sx, height: edit.height * sy, opacity: 1,
          });
        }
      }

      const output = await pdfDoc.save({ useObjectStreams: true });
      const blob = new Blob([output], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${fileName.replace(/\.pdf$/i, "")}-edited.pdf`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 0);
      setStatus?.("Edited PDF downloaded.", "success");
    } catch (error) {
      setStatus?.(error?.message || "Could not export the PDF.", "error");
    } finally {
      setWorking(false);
    }
  };

  const toolMeta = TOOL_SET.find((entry) => entry.id === tool);

  return (
    <div className="editorLayout">
      <input ref={imageInputRef} type="file" accept="image/png,image/jpeg,image/jpg" onChange={onImagePick} hidden />
      {showSignature && <SignaturePad onCancel={() => setShowSignature(false)} onSave={onSignatureSave} />}

      <aside className="toolRail" aria-label="PDF editing tools">
        {TOOL_SET.map((entry) => {
          const Icon = entry.icon;
          return (
            <button
              key={entry.id}
              className={`railButton ${tool === entry.id ? "active" : ""}`}
              onClick={() => {
                setTool(entry.id);
                if (entry.id === "signature") setShowSignature(true);
                if (entry.id === "image") imageInputRef.current?.click();
              }}
              title={entry.hint}
            >
              <Icon size={18} />
              <span>{entry.label}</span>
            </button>
          );
        })}
      </aside>

      <section className={`workspacePanel`}>
        <div className="topToolbar">
          <div className="documentMeta">
            <FileText size={16} />
            <span title={fileName}>{fileName}</span>
          </div>
          <div className="toolbarCluster">
            <button className="btn-icon" onClick={() => setPageNumber((p) => Math.max(1, p - 1))} disabled={pageNumber <= 1} aria-label="Previous page"><ChevronLeft size={16} /></button>
            <span className="pagePill">{pageNumber} / {numPages}</span>
            <button className="btn-icon" onClick={() => setPageNumber((p) => Math.min(numPages, p + 1))} disabled={pageNumber >= numPages} aria-label="Next page"><ChevronRight size={16} /></button>
          </div>
          <div className="toolbarCluster">
            <button className="btn-icon" onClick={undo} disabled={!history.past.length} aria-label="Undo (Ctrl+Z)"><Undo2 size={16} /></button>
            <button className="btn-icon" onClick={redo} disabled={!history.future.length} aria-label="Redo (Ctrl+Y)"><Redo2 size={16} /></button>
            <button className="btn-icon" onClick={() => setZoom((z) => clamp(Number((z - 0.1).toFixed(2)), 0.5, 2.5))} aria-label="Zoom out"><ZoomOut size={16} /></button>
            <span className="pagePill">{Math.round(zoom * 100)}%</span>
            <button className="btn-icon" onClick={() => setZoom((z) => clamp(Number((z + 0.1).toFixed(2)), 0.5, 2.5))} aria-label="Zoom in"><ZoomIn size={16} /></button>
          </div>
          <button className="btn btn-soft" onClick={onClose} title="Close document"><RotateCcw size={14} /> Close</button>
          <button className="btn btn-brand" onClick={exportEditedPdf} disabled={!edits.length || working}>
            <Download size={16} /> Download PDF
          </button>
        </div>

        <div className="canvasViewport">
          <div className="statusFloat">
            {rendering && <div className="statusBadge"><Spinner size={12} /> Rendering…</div>}
            {pendingImage && (
              <div className="statusBadge brand">
                {pendingImage.kind === "signature" ? <PenLine size={13} /> : <ImagePlus size={13} />}
                {pendingImage.kind === "signature" ? "Signature" : "Image"} ready — click page
              </div>
            )}
          </div>
          <div
            ref={stageRef}
            className={`pdfStage tool-${tool}`}
            style={{ width: currentSize.width * zoom, height: currentSize.height * zoom }}
            onPointerDown={onStagePointerDown}
            onPointerMove={onStagePointerMove}
            onPointerUp={onStagePointerUp}
            onPointerCancel={onStagePointerUp}
          >
            <canvas ref={canvasRef} className="pdfCanvas" />
            <div className="editLayer" style={{ width: currentSize.width * zoom, height: currentSize.height * zoom }}>
              {currentPageEdits.map((item) => (
                <EditItem
                  key={item.id}
                  item={item}
                  zoom={zoom}
                  selected={item.id === selectedId}
                  onPointerDown={(event) => beginMove(event, item)}
                />
              ))}
              {normalizedDraft && <EditItem item={normalizedDraft} zoom={zoom} selected draft />}
            </div>
          </div>
        </div>

        <div className="statusBar">
          <span><strong style={{ color: "var(--ink)" }}>{toolMeta?.label}</strong> — {toolMeta?.hint}</span>
          <span>{numPages} page{numPages === 1 ? "" : "s"} · {edits.length} edit{edits.length === 1 ? "" : "s"}</span>
        </div>
      </section>

      <aside className="sidePanel">
        <div className="sideTabs">
          <button className={sideTab === "style" ? "active" : ""} onClick={() => setSideTab("style")}>Style</button>
          <button className={sideTab === "selected" ? "active" : ""} onClick={() => setSideTab("selected")}>Selected</button>
          <button className={sideTab === "pages" ? "active" : ""} onClick={() => setSideTab("pages")}>Pages</button>
        </div>

        {sideTab === "style" && (
          <div className="sideContent">
            <section className="controlCard">
              <div className="sectionTitle"><Type size={15} /> Text</div>
              <label className="field">
                <span>Default text</span>
                <textarea value={textValue} onChange={(e) => setTextValue(e.target.value)} rows={2} placeholder="Type the text you want to drop on the page" />
              </label>
              <div className="fieldRow">
                <label className="field"><span>Font size</span><input type="number" min="8" max="96" value={fontSize} onChange={(e) => setFontSize(Number(e.target.value))} /></label>
                <label className="field"><span>Stroke</span><input type="number" min="1" max="20" value={strokeWidth} onChange={(e) => setStrokeWidth(Number(e.target.value))} /></label>
              </div>
              <label className="field">
                <span>Color</span>
                <div className="swatchRow">
                  {COLOR_SWATCHES.map((color) => (
                    <button
                      key={color}
                      className={activeColor === color ? "active" : ""}
                      style={{ background: color }}
                      onClick={() => setActiveColor(color)}
                      aria-label={`Set color ${color}`}
                    />
                  ))}
                </div>
              </label>
            </section>

            <section className="controlCard">
              <div className="sectionTitle"><PenLine size={15} /> Signatures</div>
              {brand?.signatures?.length > 0 ? (
                <>
                  <p className="miniText">Tap a saved signature to place it on the current page.</p>
                  <div className="savedSigPicker">
                    {brand.signatures.map((sig) => (
                      <button key={sig.id} onClick={() => useSavedSignature(sig)}>
                        <img src={sig.src} alt={sig.label} />
                        {sig.label}
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <p className="miniText">No saved signatures. Open the <strong>Brand</strong> page to save one for instant reuse.</p>
              )}
              <button className="btn btn-ghost btn-block" onClick={() => setShowSignature(true)}><PenLine size={14} /> Draw a new signature</button>
            </section>

            <section className="controlCard">
              <div className="sectionTitle"><ImagePlus size={15} /> Logo & images</div>
              <p className="miniText">Drop a brand logo, stamp, or scanned image anywhere on the page.</p>
              {brand?.logo && (
                <button className="btn btn-ghost btn-block" onClick={useBrandLogo}>
                  <ImagePlus size={14} /> Use brand logo
                </button>
              )}
              <button className="btn btn-soft btn-block" onClick={() => imageInputRef.current?.click()}>
                <UploadCloud size={14} /> Upload an image
              </button>
            </section>
          </div>
        )}

        {sideTab === "selected" && (
          <div className="sideContent">
            <section className="controlCard">
              <div className="sectionTitle"><MousePointer2 size={15} /> Selected edit</div>
              {!selectedEdit ? (
                <p className="miniText">Tap an item on the page to edit it.</p>
              ) : (
                <>
                  <p className="miniText" style={{ textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700, color: "var(--teal)" }}>{selectedEdit.type}</p>
                  {selectedEdit.type === "text" && (
                    <>
                      <label className="field"><span>Text</span><textarea value={selectedEdit.text} onChange={(e) => updateSelected({ text: e.target.value })} rows={3} /></label>
                      <label className="field"><span>Font size</span><input type="number" min="8" max="96" value={selectedEdit.fontSize} onChange={(e) => updateSelected({ fontSize: Number(e.target.value) })} /></label>
                    </>
                  )}
                  {["image", "signature", "highlight", "rectangle", "whiteout"].includes(selectedEdit.type) && (
                    <div className="fieldRow">
                      <label className="field"><span>Width</span><input type="number" min="5" value={Math.round(selectedEdit.width)} onChange={(e) => updateSelected({ width: Number(e.target.value) })} /></label>
                      <label className="field"><span>Height</span><input type="number" min="5" value={Math.round(selectedEdit.height)} onChange={(e) => updateSelected({ height: Number(e.target.value) })} /></label>
                    </div>
                  )}
                  {["text", "pen", "rectangle"].includes(selectedEdit.type) && (
                    <label className="field">
                      <span>Color</span>
                      <div className="swatchRow">
                        {COLOR_SWATCHES.map((color) => (
                          <button key={color} className={selectedEdit.color === color ? "active" : ""} style={{ background: color }} onClick={() => updateSelected({ color })} />
                        ))}
                      </div>
                    </label>
                  )}
                  <button className="btn btn-danger btn-block" onClick={deleteSelected}><Trash2 size={14} /> Delete this edit</button>
                </>
              )}
            </section>
          </div>
        )}

        {sideTab === "pages" && (
          <div className="sideContent">
            <section className="controlCard">
              <div className="sectionTitle"><FileText size={15} /> Jump to page</div>
              <div className="pageGrid">
                {Array.from({ length: numPages }, (_, i) => i + 1).map((p) => (
                  <button key={p} className={p === pageNumber ? "active" : ""} onClick={() => setPageNumber(p)}>{p}</button>
                ))}
              </div>
              <p className="miniText">Use the <strong>Tools → Organize</strong> page for reordering, deleting, or rotating specific pages.</p>
            </section>
          </div>
        )}
      </aside>
    </div>
  );
}
