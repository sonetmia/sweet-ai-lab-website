import { bootstrapConfiguredAdmin } from "@/lib/admin";
import { platforms, promptStyles } from "@/lib/catalog";
import { addFreeKeyWithAutoModel, createFreePrompt, freeProviders, generateWithFreeApi, getSelectedFreeModelLabel, loadFreeKeys, normalizeMetadata, preparePaidApiImage, removeFreeKey, type FreeProvider } from "@/lib/freeApi";
import { supabase } from "@/lib/supabase";
import "./api-modal.css";
import "./studio.css";
import {
  Check,
  ChevronDown,
  CircleUserRound,
  Download,
  FileText,
  FolderUp,
  ImageIcon,
  ImageUp,
  KeyRound,
  LayoutPanelTop,
  Loader2,
  LogOut,
  Moon,
  PanelLeft,
  Pause,
  Play,
  Plus,
  Settings2,
  SlidersHorizontal,
  Sun,
  Trash2,
  UploadCloud,
  X,
} from "lucide-react";
import { DragEvent, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";

type SideTab = "mode" | "customize" | "settings";
type Mode = "metadata" | "prompt";
type QueueItem = { id: string; file: File; preview: string; status: "queued" | "processing" | "complete" | "error"; output?: { title?: string; keywords?: string[]; description?: string; category?: string; prompt?: string }; error?: string };
type Credits = { credits: number; plan: string; expired: boolean; expiresAt: string | null };
type ApiMode = "paid" | "free";

const initialCredits: Credits = { credits: 200, plan: "Free", expired: false, expiresAt: null };

function wordLabel(value: number) {
  return `${value} words`;
}

export default function Studio() {
  const [, navigate] = useLocation();
  const inputRef = useRef<HTMLInputElement>(null);
  const [sessionReady, setSessionReady] = useState(false);
  const [email, setEmail] = useState("");
  const [profileName, setProfileName] = useState("Studio member");
  const [profileImage, setProfileImage] = useState("");
  const [credits, setCredits] = useState<Credits>(initialCredits);
  const [activeTab, setActiveTab] = useState<SideTab>("mode");
  const [mode, setMode] = useState<Mode>("metadata");
  const [platform, setPlatform] = useState<(typeof platforms)[number]>("Adobe Stock");
  const [promptStyle, setPromptStyle] = useState<(typeof promptStyles)[number]>("Original");
  const [items, setItems] = useState<QueueItem[]>([]);
  const [dragging, setDragging] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [dark, setDark] = useState(() => localStorage.getItem("sweet-theme") !== "light");
  const [accountOpen, setAccountOpen] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);
  const [titleRange, setTitleRange] = useState([6, 12]);
  const [keywordRange, setKeywordRange] = useState([35, 40]);
  const [descriptionRange, setDescriptionRange] = useState([12, 30]);
  const [toggles, setToggles] = useState({ singleWords: true, silhouette: false, customPrompt: false, prohibited: false, prefix: false, suffix: false });
  const [textOptions, setTextOptions] = useState({ customPrompt: "", prohibitedWords: "", prefix: "", suffix: "" });
  const [apiMode, setApiMode] = useState<ApiMode>("free");
  const [paidTier, setPaidTier] = useState<"standard" | "premium">("standard");
  const [apiModalOpen, setApiModalOpen] = useState(false);
  const [freeProvider, setFreeProvider] = useState<FreeProvider>("Gemini");
  const [newKey, setNewKey] = useState("");
  const [freeKeyVersion, setFreeKeyVersion] = useState(0);
  const [detectingKey, setDetectingKey] = useState(false);
  const [freeKeyMessage, setFreeKeyMessage] = useState("");
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    async function establishSession() {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        navigate("/");
        return;
      }
      updateProfile(data.session.user);
      await bootstrapConfiguredAdmin();
      setSessionReady(true);
      await refreshCredits();
    }
    void establishSession();
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!nextSession) navigate("/");
      else updateProfile(nextSession.user);
    });
    return () => listener.subscription.unsubscribe();
  }, [navigate]);

  useEffect(() => {
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    localStorage.setItem("sweet-theme", dark ? "dark" : "light");
  }, [dark]);

  async function refreshCredits() {
    const { data, error } = await supabase.rpc("get_my_credits");
    if (error || !data?.success) return;
    setCredits({ credits: data.credits ?? 0, plan: String(data.plan ?? "free").replace(/^./, (letter: string) => letter.toUpperCase()), expired: Boolean(data.expired), expiresAt: data.expires_at ?? null });
  }

  async function signOut() {
    await supabase.auth.signOut();
    navigate("/");
  }

  function updateProfile(user: { email?: string | null; user_metadata?: Record<string, unknown> }) {
    const metadata = user.user_metadata ?? {};
    setEmail(user.email ?? "Studio member");
    setProfileName(String(metadata.full_name ?? metadata.name ?? user.email?.split("@")[0] ?? "Studio member"));
    setProfileImage(String(metadata.avatar_url ?? metadata.picture ?? ""));
  }

  function addFiles(fileList: FileList | File[]) {
    const accepted = Array.from(fileList).filter((file) => file.type.startsWith("image/") || file.type === "application/pdf" || file.name.endsWith(".ai"));
    const newItems = accepted.map((file) => ({ id: crypto.randomUUID(), file, preview: file.type.startsWith("image/") ? URL.createObjectURL(file) : "", status: "queued" as const }));
    setItems((current) => [...current, ...newItems]);
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    addFiles(event.dataTransfer.files);
  }

  function removeItem(id: string) {
    setItems((current) => {
      const item = current.find((entry) => entry.id === id);
      if (item?.preview) URL.revokeObjectURL(item.preview);
      return current.filter((entry) => entry.id !== id);
    });
  }

  function clearQueue() {
    items.forEach((item) => item.preview && URL.revokeObjectURL(item.preview));
    setItems([]);
  }

  const studioSettings = () => ({
    platform, promptStyle, titleMin: titleRange[0], titleMax: titleRange[1], keywordMin: keywordRange[0], keywordMax: keywordRange[1], descriptionMin: descriptionRange[0], descriptionMax: descriptionRange[1],
    singleWordKeywords: toggles.singleWords, silhouetteMode: toggles.silhouette, customPrompt: textOptions.customPrompt, prohibitedWords: textOptions.prohibitedWords, titlePrefix: textOptions.prefix, titleSuffix: textOptions.suffix,
  });

  function updateItem(id: string, patch: Partial<QueueItem>) {
    setItems((current) => current.map((item) => item.id === id ? { ...item, ...patch } : item));
  }

  async function generateAll() {
    if (!items.some((item) => item.status === "queued" || item.status === "error") || generating) return;
    if (apiMode === "free" && !(loadFreeKeys()[freeProvider] ?? []).length) { setApiModalOpen(true); return; }
    setGenerating(true);
    for (const item of items.filter((entry) => entry.status === "queued" || entry.status === "error")) {
      updateItem(item.id, { status: "processing", error: undefined });
      try {
        const image = item.file.type.startsWith("image/") ? await fileToDataUrl(item.file) : null;
        let output: QueueItem["output"];
        let remaining: number | undefined;
        if (apiMode === "paid") {
          const { data: sessionData } = await supabase.auth.getSession();
          if (!sessionData.session) throw new Error("Your session has expired. Please sign in again.");
          const sendPaidRequest = (paidImage: string | null) => fetch("/api/studio", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${sessionData.session.access_token}` }, body: JSON.stringify({ image: paidImage, mode, tier: paidTier, settings: studioSettings() }) });
          const preparedImage = image ? await preparePaidApiImage(image) : null;
          let response = await sendPaidRequest(preparedImage);
          if (response.status === 413 && image) {
            const retryImage = await preparePaidApiImage(image, true);
            response = await sendPaidRequest(retryImage);
          }
          const responseText = await response.text();
          let payload: { error?: string; detail?: string; result?: QueueItem["output"]; credits?: number };
          try {
            payload = JSON.parse(responseText) as typeof payload;
          } catch {
            const summary = responseText.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 140);
            throw new Error(`Paid API server error (${response.status}). ${summary || "The server did not return a valid response. Please try again later."}`);
          }
          if (!response.ok || !payload.result) throw new Error([payload.error?.replaceAll("_", " "), payload.detail].filter(Boolean).join(": ") || "The paid generation request could not be completed.");
          output = payload.result; remaining = payload.credits;
        } else {
          const prompt = createFreePrompt(mode, platform, promptStyle, { titleRange, keywordRange, descriptionRange, singleWords: toggles.singleWords, silhouette: toggles.silhouette, customPrompt: textOptions.customPrompt, prohibitedWords: textOptions.prohibitedWords, prefix: textOptions.prefix, suffix: textOptions.suffix });
          const raw = await generateWithFreeApi(freeProvider, prompt, image);
          output = mode === "metadata" ? normalizeMetadata(raw) : { prompt: raw.trim() };
          const { data: debitData, error: debitError } = await supabase.rpc("deduct_credit", { action_type: mode === "metadata" ? "free_metadata_generation" : "free_image_to_prompt", amount: 1 });
          if (debitError || !debitData?.success) throw new Error("Generation completed, but a credit could not be secured. The result was not saved.");
          remaining = debitData.credits;
        }
        if (typeof remaining === "number") setCredits((current) => ({ ...current, credits: remaining }));
        updateItem(item.id, { status: "complete", output });
      } catch (error) {
        updateItem(item.id, { status: "error", error: error instanceof Error ? error.message : "Generation failed." });
      }
    }
    setGenerating(false);
  }

  function exportResults() {
    const complete = items.filter((item) => item.status === "complete" && item.output);
    if (!complete.length) return;
    const content = mode === "metadata"
      ? ["filename,title,keywords,description,category", ...complete.map((item) => [item.file.name, item.output?.title ?? "", (item.output?.keywords ?? []).join(", "), item.output?.description ?? "", item.output?.category ?? ""].map(csvCell).join(","))].join("\n")
      : complete.map((item) => `${item.file.name}\n${item.output?.prompt ?? ""}`).join("\n\n");
    const blob = new Blob([content], { type: mode === "metadata" ? "text/csv;charset=utf-8" : "text/plain;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = mode === "metadata" ? `ra-graphic-metadata-${platform.toLowerCase().replaceAll(" ", "-")}.csv` : "ra-graphic-prompts.txt";
    link.click();
    URL.revokeObjectURL(link.href);
  }

  async function addNewFreeKey() {
    if (detectingKey) return;
    setDetectingKey(true);
    setFreeKeyMessage("Checking this key and selecting its best compatible model…");
    try {
      const result = await addFreeKeyWithAutoModel(freeProvider, newKey);
      setNewKey("");
      setFreeKeyVersion((version) => version + 1);
      const selectionLabel = result.source === "detected" ? `Auto-detected model: ${result.model}.` : `Documented default: ${result.model}. Its availability will be verified on your first request.`;
      setFreeKeyMessage(result.added ? `Ready: ${selectionLabel}` : `This key was already added. ${selectionLabel}`);
    } catch (error) {
      setFreeKeyMessage(error instanceof Error ? error.message : "This key could not be configured.");
    } finally {
      setDetectingKey(false);
    }
  }

  if (!sessionReady) {
    return <div className="studio-loading"><Loader2 className="spin" size={22} /> Securing your studio…</div>;
  }

  return (
    <div className={`studio-shell ${dark ? "studio-dark" : ""}`}>
      <header className="studio-header">
        <div className="studio-header-left"><a className="studio-brand" href="/"><span className="brand-s">S</span> Sweet AI Lab by SONET</a><button className="icon-button" onClick={() => setSidebarOpen(!sidebarOpen)} aria-label="Toggle studio controls"><PanelLeft size={17} /></button></div>
        <div className="studio-header-right"><span className="studio-credit"><i /> {credits.expired ? "Credits expired" : `${credits.credits.toLocaleString()} credits`}</span><button className="header-link" onClick={() => setContactOpen(!contactOpen)}>Contact</button><button className="header-link" onClick={() => navigate("/billing")}>Plans</button><button className="api-button" onClick={() => setApiModalOpen(true)}><KeyRound size={15} /> API keys</button><button className="icon-button" onClick={() => setDark(!dark)} aria-label="Toggle color theme">{dark ? <Sun size={16} /> : <Moon size={16} />}</button><button className="avatar-button" onClick={() => setAccountOpen(!accountOpen)} aria-expanded={accountOpen} aria-label="Open profile">{profileImage ? <img src={profileImage} alt="Google profile" referrerPolicy="no-referrer" /> : <CircleUserRound size={20} />}</button>{contactOpen && <div className="studio-contact-menu"><b>Contact SONET</b><a href="https://wa.me/8801797953059" target="_blank" rel="noreferrer">WhatsApp · 01797953059</a><a href="mailto:md.sonet.mia01@gmail.com">md.sonet.mia01@gmail.com</a><a href="https://mdsonetmia.vercel.app" target="_blank" rel="noreferrer">mdsonetmia.vercel.app</a></div>}{accountOpen && <div className="account-menu"><div className="account-profile">{profileImage ? <img src={profileImage} alt="Google profile" referrerPolicy="no-referrer" /> : <CircleUserRound size={28} />}<span><b>{profileName}</b><small>{email}</small></span></div><div><b>{credits.plan}</b><span>{credits.credits.toLocaleString()} credits</span></div><button className="account-admin" onClick={() => navigate("/admin")}>Administrator console</button><button onClick={signOut}><LogOut size={14} /> Sign out</button></div>}</div>
      </header>
      <div className="studio-layout">
        <aside className={sidebarOpen ? "studio-sidebar" : "studio-sidebar collapsed"}>
          <div className="tab-rail">
            <button className={activeTab === "mode" ? "side-tab active" : "side-tab"} onClick={() => setActiveTab("mode")}><LayoutPanelTop size={17} /><span>Mode</span></button>
            <button className={activeTab === "customize" ? "side-tab active" : "side-tab"} onClick={() => setActiveTab("customize")}><SlidersHorizontal size={17} /><span>Customize</span></button>
            <button className={activeTab === "settings" ? "side-tab active" : "side-tab"} onClick={() => setActiveTab("settings")}><Settings2 size={17} /><span>Settings</span></button>
          </div>
          <div className="side-panel">
            {activeTab === "mode" && <>
              <p className="side-label">Creation mode</p><div className="mode-picker"><button className={mode === "metadata" ? "selected" : ""} onClick={() => setMode("metadata")}><FileText size={16} /><span>Metadata</span></button><button className={mode === "prompt" ? "selected" : ""} onClick={() => setMode("prompt")}><ImageIcon size={16} /><span>Img → Prompt</span></button></div>
              {mode === "prompt" && <label className="field-label">Prompt style<select value={promptStyle} onChange={(event) => setPromptStyle(event.target.value as (typeof promptStyles)[number])}>{promptStyles.map((style) => <option key={style}>{style}</option>)}</select></label>}
              <div className="side-note"><p>{mode === "metadata" ? "Generate structured, export-ready metadata tailored to the selected platform." : "Describe the visual language of an image in a ready-to-reuse generation prompt."}</p></div>
            </>}
            {activeTab === "customize" && <>
              <div className="panel-title-row"><p className="side-label">Output calibration</p><button onClick={() => { setTitleRange([6, 12]); setKeywordRange([35, 40]); setDescriptionRange([12, 30]); }}>Reset</button></div>
              <RangeGroup label="Title length" values={titleRange} onChange={setTitleRange} description={`${wordLabel(titleRange[0])} – ${wordLabel(titleRange[1])}`} min={1} max={50} />
              <RangeGroup label="Keyword count" values={keywordRange} onChange={setKeywordRange} description={`${keywordRange[0]} – ${keywordRange[1]} keywords`} min={1} max={100} />
              <RangeGroup label="Description length" values={descriptionRange} onChange={setDescriptionRange} description={`${wordLabel(descriptionRange[0])} – ${wordLabel(descriptionRange[1])}`} min={1} max={100} />
            </>}
            {activeTab === "settings" && <>
              <p className="side-label">Metadata choices</p><div className="toggle-list">{[["singleWords", "Single-word keywords"], ["silhouette", "Silhouette mode"], ["customPrompt", "Custom prompt"], ["prohibited", "Prohibited words"], ["prefix", "Title prefix"], ["suffix", "Title suffix"]].map(([key, label]) => <label key={key} className="toggle-row"><span>{label}</span><input type="checkbox" checked={toggles[key as keyof typeof toggles]} onChange={() => setToggles((current) => ({ ...current, [key]: !current[key as keyof typeof toggles] }))} /><i /></label>)}</div>
              {(toggles.customPrompt || toggles.prohibited || toggles.prefix || toggles.suffix) && <div className="conditional-fields">{toggles.customPrompt && <textarea value={textOptions.customPrompt} onChange={(event) => setTextOptions((current) => ({ ...current, customPrompt: event.target.value }))} placeholder="Add a custom AI instruction…" />}{toggles.prohibited && <textarea value={textOptions.prohibitedWords} onChange={(event) => setTextOptions((current) => ({ ...current, prohibitedWords: event.target.value }))} placeholder="Prohibited words, separated by commas…" />}{toggles.prefix && <input value={textOptions.prefix} onChange={(event) => setTextOptions((current) => ({ ...current, prefix: event.target.value }))} placeholder="Title prefix…" />}{toggles.suffix && <input value={textOptions.suffix} onChange={(event) => setTextOptions((current) => ({ ...current, suffix: event.target.value }))} placeholder="Title suffix…" />}</div>}
            </>}
          </div>
          <a className="background-link" href="/background-remover"><ImageIcon size={16} /><span>Background remover</span><ChevronDown size={14} /></a>
          <a className="upscaler-link" href="/image-upscaler"><ImageUp size={16} /><span>Image upscaler</span><ChevronDown size={14} /></a>
        </aside>
        <main className="studio-main">
          <section className="studio-main-top"><div><p className="studio-kicker">{mode === "metadata" ? "Metadata workspace" : "Image-to-prompt workspace"}</p><h1>{mode === "metadata" ? "Build a cleaner submission set." : "Capture an image’s visual language."}</h1></div><div className="platform-control"><span>Target platform</span><select value={platform} onChange={(event) => setPlatform(event.target.value as (typeof platforms)[number])}>{platforms.map((item) => <option key={item}>{item}</option>)}</select></div></section>
          <section className="platform-tabs" aria-label="Platform selection">{platforms.map((item) => <button key={item} onClick={() => setPlatform(item)} className={platform === item ? "active" : ""}>{item === "Adobe Stock" ? "AdobeStock" : item}</button>)}</section>
          <section className={dragging ? "dropzone dragging" : "dropzone"} onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={handleDrop} onClick={() => inputRef.current?.click()}>
            <input ref={inputRef} type="file" multiple accept="image/*,.ai,application/pdf" onChange={(event) => event.target.files && addFiles(event.target.files)} />
            <span className="upload-symbol"><UploadCloud size={28} /></span><h2>Bring in your visual files</h2><p>Drop images, vectors or a PDF here. Each file stays in your browser until you choose a generation method.</p><span className="browse-trigger"><Plus size={14} /> Browse files</span><small>Images · Vectors · PDF &nbsp;—&nbsp; multiple files supported</small>
          </section>
          <section className="queue-bar"><div><span className="queue-count">{items.length.toString().padStart(2, "0")}</span><span>{items.length === 1 ? "file in the studio" : "files in the studio"}</span></div><div><button onClick={clearQueue} disabled={!items.length || generating}><Trash2 size={15} /> Clear all</button><button onClick={() => setApiModalOpen(true)}><KeyRound size={15} /> {apiMode === "paid" ? `${paidTier === "standard" ? "Paid Standard" : "Paid Premium"}` : `Own key · ${freeProvider}`}</button><button className="generate-button" onClick={() => void generateAll()} disabled={!items.length || generating}><Play size={15} /> {generating ? "Generating…" : `Generate ${items.length ? `(${items.length})` : ""}`}</button></div></section>
          <section className="results-area"><div className="results-heading"><div><h2>{mode === "metadata" ? "Generated metadata" : "Generated prompts"} <span>{items.length.toString().padStart(2, "0")}</span></h2><p>{items.length ? "Use your chosen AI path to create and review each output." : "Your result cards will appear here once files are added."}</p></div><button className="export-button" onClick={exportResults} disabled={!items.some((item) => item.status === "complete")}><Download size={15} /> Export {mode === "metadata" ? "CSV" : "text"}</button></div>
            {!items.length ? <div className="results-empty"><FolderUp size={25} /><p>Your creative queue is clear.</p><span>Upload files above to begin your next metadata set.</span></div> : <div className="result-grid">{items.map((item, index) => <article className="result-card" key={item.id}><div className="file-preview">{item.preview ? <img src={item.preview} alt="" /> : <FileText size={26} />}<span>{index + 1}</span></div><div className="result-card-main"><div><small>{item.status.toUpperCase()}</small><h3>{item.file.name}</h3><p>{Math.round(item.file.size / 1024)} KB · {platform}</p></div><button onClick={() => removeItem(item.id)} aria-label={`Remove ${item.file.name}`}><X size={15} /></button></div><div className="result-placeholder">{item.status === "processing" ? <span>Generating with {apiMode === "paid" ? "secure paid AI" : `${freeProvider} Free API`}…</span> : item.status === "error" ? <span className="result-error">{item.error}</span> : item.status === "complete" && item.output ? mode === "metadata" ? <div className="metadata-output"><b>{item.output.title}</b><p>{item.output.description}</p><small>{item.output.keywords?.slice(0, 8).join(" · ")}</small></div> : <p className="prompt-output">{item.output.prompt}</p> : <span>{mode === "metadata" ? "Title, keywords & description will appear here." : `${promptStyle} prompt will appear here.`}</span>}</div></article>)}</div>}
          </section>
        </main>
      </div>
      {apiModalOpen && <div className="api-modal-backdrop" onClick={() => setApiModalOpen(false)}><section className="api-modal" onClick={(event) => event.stopPropagation()}><button className="api-modal-close" onClick={() => setApiModalOpen(false)} aria-label="Close API settings"><X size={16} /></button><p className="side-label">AI generation path</p><h2>Choose how to power your work.</h2><div className="api-mode-switch"><button className={apiMode === "paid" ? "active" : ""} onClick={() => setApiMode("paid")}>Paid API</button><button className={apiMode === "free" ? "active" : ""} onClick={() => setApiMode("free")}>Own-key API</button></div>{apiMode === "paid" ? <div className="paid-options"><p>Secure provider credentials stay on the server. Standard costs 2 credits per successful image; Premium costs 3.</p><button className={paidTier === "standard" ? "selected" : ""} onClick={() => setPaidTier("standard")}><span>Standard</span><b>Llama 4 Scout · 2 credits</b></button><button className={paidTier === "premium" ? "selected" : ""} onClick={() => setPaidTier("premium")}><span>Premium</span><b>Llama 4 Maverick · 3 credits</b></button></div> : <div className="free-options"><p>Keys stay only in this tab’s temporary memory, never local storage. Providers with a model catalog are auto-detected when you add a key. A provider without a reachable catalog uses its documented vision default and verifies it on first use. If a configured provider reaches a quota, the next configured provider is tried automatically. Provider quotas and pricing remain controlled by each provider account.</p><label>Provider<select value={freeProvider} onChange={(event) => { setFreeProvider(event.target.value as FreeProvider); setFreeKeyMessage(""); }}>{freeProviders.map((provider) => <option key={provider}>{provider}</option>)}</select></label><div className="key-add"><input type="password" value={newKey} onChange={(event) => setNewKey(event.target.value)} placeholder={`Paste a ${freeProvider} API key`} /><button onClick={() => void addNewFreeKey()} disabled={detectingKey}>{detectingKey ? "Checking…" : "Add key"}</button></div>{freeKeyMessage && <small className="api-key-status">{freeKeyMessage}</small>}<div className="saved-keys" key={freeKeyVersion}>{(loadFreeKeys()[freeProvider] ?? []).length ? (loadFreeKeys()[freeProvider] ?? []).map((key) => <div key={key}><span>{key.slice(0, 5)}••••••••{key.slice(-4)}<small>{getSelectedFreeModelLabel(freeProvider, key)}</small></span><button onClick={() => { removeFreeKey(freeProvider, key); setFreeKeyVersion((version) => version + 1); }}>Remove</button></div>) : <span>No {freeProvider} keys added in this tab.</span>}</div></div>}<button className="api-modal-done" onClick={() => setApiModalOpen(false)}>Use this path <Check size={15} /></button></section></div>}
    </div>
  );
}

function RangeGroup({ label, values, onChange, description, min, max }: { label: string; values: number[]; onChange: (next: number[]) => void; description: string; min: number; max: number }) {
  return <div className="range-group"><div><span>{label}</span><small>{description}</small></div><div className="range-controls"><input type="range" min={min} max={max} value={values[0]} onChange={(event) => onChange([Math.min(Number(event.target.value), values[1]), values[1]])} aria-label={`${label} minimum`} /><input type="range" min={min} max={max} value={values[1]} onChange={(event) => onChange([values[0], Math.max(Number(event.target.value), values[0])])} aria-label={`${label} maximum`} /></div></div>;
}

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read this file."));
    reader.readAsDataURL(file);
  });
}

function csvCell(value: string) {
  return `"${value.replaceAll('"', '""')}"`;
}
