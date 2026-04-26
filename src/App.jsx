import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as pdfjsLib from "pdfjs-dist";
import workerSrc from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import {
  FileEdit,
  FilePlus2,
  Layers3,
  Palette,
  PenLine,
  Search,
  Sparkles,
  Trash2,
  UploadCloud,
  X,
} from "lucide-react";
import {
  CommandPalette,
  EmptyState,
  LegalPanel,
  PrismMark,
  SignaturePad,
  StatusToast,
  useBrand,
} from "./lib.jsx";
import EditorPanel from "./editor.jsx";
import BuilderPanel from "./builder.jsx";
import ToolsPanel, { CATEGORIES, TOOL_REGISTRY } from "./tools.jsx";

pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;

const NAV = [
  { id: "editor",  label: "Editor",  icon: FileEdit },
  { id: "tools",   label: "Tools",   icon: Layers3 },
  { id: "builder", label: "Builder", icon: FilePlus2 },
  { id: "brand",   label: "Brand",   icon: Palette },
];

export default function App() {
  const [pdfFile, setPdfFile] = useState(null);
  const [activePanel, setActivePanel] = useState("editor");
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [legalOpen, setLegalOpen] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [status, setStatus] = useState({ message: "", kind: "info" });
  const [focusToolId, setFocusToolId] = useState(null);
  const fileInputRef = useRef(null);

  const brandStore = useBrand();

  const showStatus = useCallback((message, kind = "info") => {
    setStatus({ message: message || "", kind });
  }, []);

  // Build palette items: every tool + nav targets + brand actions
  const paletteItems = useMemo(() => {
    const toolItems = TOOL_REGISTRY.map((tool) => ({
      ...tool,
      run: () => {
        setActivePanel("tools");
        setFocusToolId(tool.id);
      },
    }));
    const navItems = [
      { id: "open-editor",  title: "Open the editor",                  description: "Edit, sign, and annotate the loaded PDF.",        icon: FileEdit,  category: "Workspace", run: () => setActivePanel("editor") },
      { id: "open-tools",   title: "Browse all tools",                 description: "Categorized PDF tools: organize, convert, …",     icon: Layers3,   category: "Workspace", run: () => setActivePanel("tools") },
      { id: "open-builder", title: "Open the PDF builder",             description: "Design a styled PDF from scratch.",               icon: FilePlus2, category: "Workspace", run: () => setActivePanel("builder") },
      { id: "open-brand",   title: "Open brand identity",              description: "Set company name, logo, colors, and signatures.", icon: Palette,   category: "Workspace", run: () => setActivePanel("brand") },
      { id: "open-pdf",     title: "Open a PDF…",                      description: "Pick a file from your device.",                    icon: UploadCloud, category: "Workspace", run: () => fileInputRef.current?.click() },
    ];
    return [...navItems, ...toolItems];
  }, []);

  // Keyboard: Ctrl/Cmd+K toggles palette
  useEffect(() => {
    const handler = (event) => {
      const mod = event.ctrlKey || event.metaKey;
      if (mod && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPaletteOpen((open) => !open);
      } else if (event.key === "Escape" && paletteOpen) {
        setPaletteOpen(false);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [paletteOpen]);

  const onPickPdf = (event) => {
    const file = event.target.files?.[0];
    if (file) {
      setPdfFile(file);
      setActivePanel("editor");
    }
    event.target.value = "";
  };

  const onDrop = (event) => {
    event.preventDefault();
    setDragOver(false);
    const file = event.dataTransfer.files?.[0];
    if (file?.type === "application/pdf" || file?.name?.toLowerCase().endsWith(".pdf")) {
      setPdfFile(file);
      setActivePanel("editor");
    } else if (file) {
      showStatus("That file is not a PDF.", "error");
    }
  };

  const closeDocument = () => {
    setPdfFile(null);
    showStatus("Document closed.");
  };

  return (
    <div
      className={`appShell ${dragOver ? "dragOver" : ""}`}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={(e) => { if (e.currentTarget === e.target) setDragOver(false); }}
      onDrop={onDrop}
    >
      <input ref={fileInputRef} type="file" accept="application/pdf" onChange={onPickPdf} hidden />

      {/* Top bar */}
      <header className="appBar">
        <div className="brandBlock">
          <div className="brandLogo">
            {brandStore.brand.logo ? <img src={brandStore.brand.logo.src} alt="" /> : <PrismMark size={22} />}
          </div>
          <div className="brandName">
            <strong>{brandStore.brand.companyName || "JC PDF Studio"}</strong>
            <span>Browser-local PDF studio</span>
          </div>
        </div>

        <nav className="appNav" aria-label="Primary navigation">
          {NAV.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                className={activePanel === item.id ? "active" : ""}
                onClick={() => setActivePanel(item.id)}
              >
                <Icon size={14} /> {item.label}
              </button>
            );
          })}
        </nav>

        <div className="appBarSpacer" />

        <button className="searchTrigger" onClick={() => setPaletteOpen(true)} aria-label="Search tools (Ctrl+K)">
          <Search size={15} />
          <span>Search every tool…</span>
          <kbd>⌘K</kbd>
        </button>

        <div className="appBarActions">
          <button className="btn btn-ghost" onClick={() => fileInputRef.current?.click()}>
            <UploadCloud size={14} /> Open PDF
          </button>
        </div>
      </header>

      {/* Privacy ribbon */}
      <div className="ribbon">
        <span className="pill"><Sparkles size={12} /> Free forever</span>
        <strong>Files never leave your device.</strong>
        <span>No accounts, no analytics, no paywalls. <button onClick={() => setLegalOpen(true)} style={{ color: "var(--teal)", textDecoration: "underline", padding: 0 }}>Privacy details</button></span>
      </div>

      {/* Main content */}
      {activePanel === "editor" && pdfFile && (
        <EditorPanel
          pdfFile={pdfFile}
          brand={brandStore.brand}
          onAddSignature={brandStore.addSignature}
          setStatus={showStatus}
          onClose={closeDocument}
        />
      )}

      {activePanel === "editor" && !pdfFile && (
        <main className="emptyWrap">
          <EmptyState
            onPick={onPickPdf}
            onOpenTools={() => setActivePanel("tools")}
          />
        </main>
      )}

      {activePanel === "tools" && (
        <ToolsPanel
          brand={brandStore.brand}
          setStatus={showStatus}
          focusToolId={focusToolId}
          onFocusHandled={() => setFocusToolId(null)}
        />
      )}

      {activePanel === "builder" && (
        <BuilderPanel brand={brandStore.brand} setStatus={showStatus} />
      )}

      {activePanel === "brand" && (
        <BrandPage brandStore={brandStore} setStatus={showStatus} />
      )}

      {/* Palette + modals */}
      <CommandPalette
        open={paletteOpen}
        items={paletteItems}
        onClose={() => setPaletteOpen(false)}
        onSelect={(item) => {
          setPaletteOpen(false);
          item.run?.();
        }}
      />

      {legalOpen && (
        <div className="modalShell" role="dialog" aria-modal="true" aria-label="Privacy and legal">
          <div className="modalCard">
            <div className="modalTitleRow">
              <div>
                <p className="eyebrow">Legal & Privacy</p>
                <h2>How PrismPDF handles your files</h2>
              </div>
              <button className="btn-icon" onClick={() => setLegalOpen(false)} aria-label="Close"><X size={18} /></button>
            </div>
            <LegalPanel />
            <div className="modalActions">
              <button className="btn btn-brand" onClick={() => setLegalOpen(false)}>Got it</button>
            </div>
          </div>
        </div>
      )}

      <StatusToast
        message={status.message}
        kind={status.kind}
        onClose={() => setStatus({ message: "", kind: "info" })}
      />
    </div>
  );
}

// ============================================================ Brand identity page

function BrandPage({ brandStore, setStatus }) {
  const { brand, update, setLogo, addSignature, removeSignature, setDefaultSignature, reset } = brandStore;
  const [showSignature, setShowSignature] = useState(false);
  const logoInputRef = useRef(null);

  const onLogoChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!["image/png", "image/jpeg", "image/jpg"].includes(file.type)) {
      setStatus("Logo must be PNG or JPG.", "error");
      return;
    }
    await setLogo(file);
    event.target.value = "";
    setStatus("Logo saved.", "success");
  };

  return (
    <main className="brandPage">
      <input ref={logoInputRef} type="file" accept="image/png,image/jpeg,image/jpg" hidden onChange={onLogoChange} />
      {showSignature && (
        <SignaturePad
          onCancel={() => setShowSignature(false)}
          onSave={(dataUrl, label) => {
            addSignature(dataUrl, label);
            setShowSignature(false);
            setStatus("Signature saved.", "success");
          }}
        />
      )}

      <div style={{ maxWidth: 920, margin: "0 auto 24px" }}>
        <p className="eyebrow">Brand Identity</p>
        <h1 style={{ fontSize: "1.6rem", marginTop: 4 }}>Save your brand once, reuse it everywhere</h1>
        <p style={{ color: "var(--muted)", marginTop: 6, maxWidth: 620 }}>
          The logo, colors, and signatures you save here are stored only in this browser and are
          automatically applied across the editor, builder, invoices, watermarks, and more.
        </p>
      </div>

      <div className="brandLayout">
        <section className="card elevated">
          <div className="cardHead">
            <div className="cardIcon"><Palette size={18} /></div>
            <div className="cardTitle"><h3>Company &amp; colors</h3><p>Shown on invoices, headers, and the app bar.</p></div>
          </div>
          <label className="field">
            <span>Company name</span>
            <input value={brand.companyName} onChange={(e) => update({ companyName: e.target.value })} placeholder="Your company or your name" />
          </label>
          <label className="field">
            <span>Contact line</span>
            <input value={brand.contactLine} onChange={(e) => update({ contactLine: e.target.value })} placeholder="hello@example.com  ·  example.com  ·  555-555-5555" />
          </label>
          <div className="fieldRow">
            <label className="field">
              <span>Primary color</span>
              <input type="color" value={brand.primaryColor} onChange={(e) => update({ primaryColor: e.target.value })} />
            </label>
            <label className="field">
              <span>Accent color</span>
              <input type="color" value={brand.accentColor} onChange={(e) => update({ accentColor: e.target.value })} />
            </label>
          </div>
          <div style={{ display: "flex", gap: 12, marginTop: 4, alignItems: "center" }}>
            <span className="miniText">Preview:</span>
            <div style={{ flex: 1, height: 32, borderRadius: 9, background: `linear-gradient(135deg, ${brand.primaryColor}, ${brand.accentColor})` }} />
          </div>
        </section>

        <section className="card elevated">
          <div className="cardHead">
            <div className="cardIcon purple"><UploadCloud size={18} /></div>
            <div className="cardTitle"><h3>Logo</h3><p>Used in the app bar and on every generator that includes a header.</p></div>
          </div>
          <div className="logoPreview">
            {brand.logo ? <img src={brand.logo.src} alt={brand.logo.name || "Brand logo"} /> : <span>No logo yet — PNG or JPG looks best</span>}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-soft" onClick={() => logoInputRef.current?.click()}>
              <UploadCloud size={14} /> {brand.logo ? "Replace logo" : "Upload logo"}
            </button>
            {brand.logo && (
              <button className="btn btn-danger" onClick={() => { update({ logo: null }); setStatus("Logo cleared."); }}>
                <Trash2 size={14} /> Remove
              </button>
            )}
          </div>
        </section>

        <section className="card elevated" style={{ gridColumn: "1 / -1" }}>
          <div className="cardHead">
            <div className="cardIcon"><PenLine size={18} /></div>
            <div className="cardTitle">
              <h3>Saved signatures</h3>
              <p>Your default signature auto-fills the Builder and is one tap away inside the Editor.</p>
            </div>
          </div>
          {brand.signatures.length === 0 ? (
            <p className="miniText">No signatures yet. Draw one to start.</p>
          ) : (
            <div className="signatureList">
              {brand.signatures.map((sig) => (
                <div key={sig.id} className={`signatureRow ${sig.isDefault ? "default" : ""}`}>
                  <img src={sig.src} alt={sig.label} />
                  <div className="sigMeta">
                    <strong>{sig.label}</strong>
                    {sig.isDefault && <span style={{ color: "var(--teal)" }}>Default for new documents</span>}
                  </div>
                  {sig.isDefault ? (
                    <span className="defaultBadge">DEFAULT</span>
                  ) : (
                    <button className="btn btn-soft btn-sm" onClick={() => setDefaultSignature(sig.id)}>Make default</button>
                  )}
                  <button className="btn btn-danger btn-sm" onClick={() => removeSignature(sig.id)} aria-label="Remove signature"><Trash2 size={13} /></button>
                </div>
              ))}
            </div>
          )}
          <button className="btn btn-brand" onClick={() => setShowSignature(true)} style={{ alignSelf: "flex-start" }}>
            <PenLine size={14} /> Draw a signature
          </button>
        </section>

        <section className="card" style={{ gridColumn: "1 / -1", borderColor: "rgba(244, 63, 94, 0.25)" }}>
          <div className="cardHead">
            <div className="cardIcon" style={{ background: "rgba(244, 63, 94, 0.1)", color: "var(--rose)" }}><Trash2 size={18} /></div>
            <div className="cardTitle"><h3>Reset brand identity</h3><p>Clear everything saved in this browser. There is no cloud copy.</p></div>
          </div>
          <button
            className="btn btn-danger"
            style={{ alignSelf: "flex-start" }}
            onClick={() => {
              if (window.confirm("Reset all brand identity in this browser? This cannot be undone.")) {
                reset();
                setStatus("Brand identity cleared.");
              }
            }}
          >
            <Trash2 size={14} /> Clear all brand data
          </button>
        </section>
      </div>
    </main>
  );
}
