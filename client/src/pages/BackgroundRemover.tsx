import { supabase } from "@/lib/supabase";
import { AppThemeToggle } from "@/components/AppThemeToggle";
import "./background-remover.css";
import "./upscaler.css";
import { ArrowLeft, Check, Download, ImagePlus, ImageUp, Loader2, Play, Square, Trash2, UploadCloud, X } from "lucide-react";
import { ChangeEvent, DragEvent, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";

type RemovalItem = { id: string; file: File; inputUrl: string; resultUrl?: string; state: "queued" | "processing" | "done" | "error"; error?: string };
type UpscaleItem = { file: File; inputUrl: string; resultUrl?: string; factor: 2 | 4; state: "idle" | "processing" | "done" | "error"; error?: string };
type WorkerResponse = { type: "progress"; percentage: number } | { type: "ready" } | { type: "done"; id: string; width: number; height: number; channels: number; pixels: Uint8ClampedArray } | { type: "error"; id: string | null; message: string };

const worker = new Worker(new URL("../workers/bgRemoval.worker.ts", import.meta.url), { type: "module" });

export default function BackgroundRemover() {
  const [, navigate] = useLocation();
  const pickerRef = useRef<HTMLInputElement>(null);
  const upscalePickerRef = useRef<HTMLInputElement>(null);
  const itemsRef = useRef<RemovalItem[]>([]);
  const [items, setItems] = useState<RemovalItem[]>([]);
  const [ready, setReady] = useState(false);
  const [progress, setProgress] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [working, setWorking] = useState(false);
  const [creditCount, setCreditCount] = useState<number | null>(null);
  const [message, setMessage] = useState("Preparing the local AI model…");
  const [upscaleItem, setUpscaleItem] = useState<UpscaleItem | null>(null);

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  useEffect(() => {
    async function begin() {
      const { data } = await supabase.auth.getSession();
      if (!data.session) return navigate("/");
      const { data: creditData } = await supabase.rpc("get_my_credits");
      if (creditData?.success) setCreditCount(creditData.credits ?? 0);
      worker.postMessage({ type: "load" });
    }
    void begin();

    worker.onmessage = async (event: MessageEvent<WorkerResponse>) => {
      const data = event.data;
      if (data.type === "progress") setProgress(Math.max(0, Math.min(100, data.percentage)));
      if (data.type === "ready") { setReady(true); setMessage("Your local model is ready."); }
      if (data.type === "error") {
        if (data.id) setItems((current) => current.map((item) => item.id === data.id ? { ...item, state: "error", error: data.message } : item));
        else setMessage(data.message);
        setWorking(false);
      }
      if (data.type === "done") {
        const item = itemsRef.current.find((entry) => entry.id === data.id);
        if (!item) return;
        try {
          const resultUrl = await compositeMask(item.inputUrl, data.width, data.height, data.channels, data.pixels);
          const { data: debit } = await supabase.rpc("deduct_credit", { action_type: "bg_remove", amount: 1 });
          if (!debit?.success) throw new Error(debit?.error === "insufficient_credits" ? "No credits remain for this image." : "The image was processed, but its credit charge could not be completed.");
          setCreditCount(debit.credits ?? 0);
          setItems((current) => current.map((entry) => entry.id === data.id ? { ...entry, resultUrl, state: "done" } : entry));
        } catch (error) {
          setItems((current) => current.map((entry) => entry.id === data.id ? { ...entry, state: "error", error: error instanceof Error ? error.message : "Could not complete this image." } : entry));
        } finally {
          setWorking(false);
        }
      }
    };
  }, [navigate]);

  function addFiles(fileList: FileList | File[]) {
    const accepted = Array.from(fileList).filter((file) => file.type.startsWith("image/"));
    setItems((current) => [...current, ...accepted.map((file) => ({ id: crypto.randomUUID(), file, inputUrl: URL.createObjectURL(file), state: "queued" as const }))]);
  }

  function onDrop(event: DragEvent<HTMLDivElement>) { event.preventDefault(); setDragging(false); addFiles(event.dataTransfer.files); }
  function onFileChange(event: ChangeEvent<HTMLInputElement>) { if (event.target.files) addFiles(event.target.files); event.target.value = ""; }
  function addUpscaleFile(fileList: FileList | File[]) {
    const file = Array.from(fileList).find((entry) => entry.type.startsWith("image/"));
    if (!file) return;
    setUpscaleItem((current) => {
      if (current?.inputUrl) URL.revokeObjectURL(current.inputUrl);
      if (current?.resultUrl) URL.revokeObjectURL(current.resultUrl);
      return { file, inputUrl: URL.createObjectURL(file), factor: 2, state: "idle" };
    });
  }
  function remove(id: string) { setItems((current) => { const target = current.find((item) => item.id === id); if (target?.inputUrl) URL.revokeObjectURL(target.inputUrl); if (target?.resultUrl) URL.revokeObjectURL(target.resultUrl); return current.filter((item) => item.id !== id); }); }
  function clear() { items.forEach((item) => { URL.revokeObjectURL(item.inputUrl); if (item.resultUrl) URL.revokeObjectURL(item.resultUrl); }); setItems([]); }

  async function processNext() {
    if (working || !ready) return;
    const next = items.find((item) => item.state === "queued");
    if (!next) return;
    if ((creditCount ?? 0) < 1) { setMessage("You need at least one credit to remove a background."); return; }
    setWorking(true);
    setItems((current) => current.map((item) => item.id === next.id ? { ...item, state: "processing" } : item));
    worker.postMessage({ type: "process", id: next.id, url: next.inputUrl });
  }

  async function upscaleImage() {
    if (!upscaleItem || upscaleItem.state === "processing") return;
    if ((creditCount ?? 0) < 2) { setUpscaleItem((current) => current ? { ...current, state: "error", error: "You need at least two credits to upscale an image." } : current); return; }
    setUpscaleItem((current) => current ? { ...current, state: "processing", error: undefined } : current);
    try {
      const resultUrl = await createUpscaledImage(upscaleItem.inputUrl, upscaleItem.factor);
      const { data: debit } = await supabase.rpc("deduct_credit", { action_type: "image_upscale", amount: 2 });
      if (!debit?.success) { URL.revokeObjectURL(resultUrl); throw new Error(debit?.error === "insufficient_credits" ? "No credits remain for this image." : "The image was upscaled, but its credit charge could not be completed."); }
      setCreditCount(debit.credits ?? 0);
      setUpscaleItem((current) => current ? { ...current, resultUrl, state: "done" } : current);
    } catch (error) {
      setUpscaleItem((current) => current ? { ...current, state: "error", error: error instanceof Error ? error.message : "Could not upscale this image." } : current);
    }
  }

  useEffect(() => { if (!working && items.some((item) => item.state === "queued") && ready) void processNext(); }, [items, working, ready]);

  function downloadAll() {
    items.filter((item) => item.resultUrl).forEach((item, index) => {
      const link = document.createElement("a"); link.href = item.resultUrl!; link.download = `${item.file.name.replace(/\.[^.]+$/, "")}-background-removed-${index + 1}.png`; link.click();
    });
  }

  const completed = items.filter((item) => item.state === "done").length;

  return <div className="remover-shell">
    <header className="remover-header"><button onClick={() => navigate("/studio")}><ArrowLeft size={16} /> Studio</button><a href="/" className="remover-brand"><span className="brand-s">S</span> Sweet AI Lab by SONET</a><div><span>{creditCount === null ? "Checking credits" : `${creditCount} credits`}</span><button onClick={() => navigate("/studio")}>AI-Powered Tools for Creators</button><AppThemeToggle /></div></header>
    <main className="remover-main">
      <section className="remover-intro"><div className="remover-kicker">Browser-local workflow</div><h1>Image tools,<br /><em>kept local.</em></h1><p>Upscale or remove a background directly in your browser. Your image stays on this device while it is processed.</p></section>
      <section className="upscaler-section"><div className="upscaler-copy"><div><ImageUp size={18} /><span>IMAGE UPSCALER</span></div><h2>Scale with clarity.</h2><p>Enlarge an image locally at 2× or 4× with high-quality browser resampling. Two credits are deducted only after a successful output is created.</p></div><div className="upscaler-workspace"><input ref={upscalePickerRef} type="file" accept="image/*" onChange={(event) => { if (event.target.files) addUpscaleFile(event.target.files); event.target.value = ""; }} /><button className="upscale-picker" onClick={() => upscalePickerRef.current?.click()}>{upscaleItem ? <img src={upscaleItem.inputUrl} alt="Selected for upscaling" /> : <><UploadCloud size={22} /><span>Choose an image</span></>}</button><div className="upscale-controls"><label>Scale<select value={upscaleItem?.factor ?? 2} disabled={!upscaleItem || upscaleItem.state === "processing"} onChange={(event) => setUpscaleItem((current) => current ? { ...current, factor: Number(event.target.value) as 2 | 4 } : current)}><option value={2}>2× upscale</option><option value={4}>4× upscale</option></select></label><button onClick={() => void upscaleImage()} disabled={!upscaleItem || upscaleItem.state === "processing"}>{upscaleItem?.state === "processing" ? <Loader2 className="spin" size={15} /> : <ImageUp size={15} />}{upscaleItem?.state === "processing" ? "Upscaling…" : "Upscale · 2 credits"}</button></div>{upscaleItem?.state === "done" && upscaleItem.resultUrl && <a className="upscale-download" href={upscaleItem.resultUrl} download={`${upscaleItem.file.name.replace(/\.[^.]+$/, "")}-${upscaleItem.factor}x.png`}><Download size={14} /> Download {upscaleItem.factor}× PNG</a>}{upscaleItem?.state === "error" && <p className="upscale-error">{upscaleItem.error}</p>}</div></section>
      <section className="remover-section"><div className="remover-section-heading"><span>BACKGROUND REMOVER</span><p>One credit per successful image.</p></div>
      {!ready ? <section className="model-card"><div className="model-row"><span className="model-loader"><Loader2 className="spin" size={22} /></span><div><strong>Preparing your background remover</strong><p>{message}</p></div><b>{Math.round(progress)}%</b></div><div className="progress-track"><i style={{ width: `${progress}%` }} /></div><small>First load downloads the model assets to your browser cache.</small></section> : <>
        <section className={dragging ? "remover-dropzone dragging" : "remover-dropzone"} onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={onDrop} onClick={() => pickerRef.current?.click()}><input ref={pickerRef} type="file" multiple accept="image/*" onChange={onFileChange} /><span><UploadCloud size={30} /></span><h2>Drop images to begin</h2><p>PNG, JPG, WEBP and GIF are supported. You can add several files to the same local queue.</p><button><ImagePlus size={15} /> Browse images</button><small>No image upload to the app server</small></section>
        {items.length > 0 && <section className="remover-controls"><span><b>{items.length}</b> {items.length === 1 ? "image" : "images"} in queue · <em>{completed} complete</em></span><div><button onClick={clear}><Trash2 size={14} /> Clear</button><button onClick={processNext} disabled={working || !items.some((item) => item.state === "queued")}><Play size={14} /> {working ? "Processing" : "Process queue"}</button><button className="download-all" onClick={downloadAll} disabled={!completed}><Download size={14} /> Download all PNGs</button></div></section>}
        {items.length > 0 && <section className="remover-grid">{items.map((item, index) => <article className="removal-card" key={item.id}><div className="removal-head"><span>IMAGE {String(index + 1).padStart(2, "0")}</span><button onClick={() => remove(item.id)} aria-label="Remove image"><X size={14} /></button></div><div className="before-after"><div><img src={item.inputUrl} alt="Original upload" /><small>Original</small></div><div className="result-checker">{item.state === "done" && item.resultUrl ? <img src={item.resultUrl} alt="Background removed" /> : item.state === "processing" ? <Loader2 className="spin" size={25} /> : item.state === "error" ? <span className="card-error">{item.error}</span> : <Square size={24} />}<small>{item.state === "done" ? "Transparent PNG" : item.state === "processing" ? "Removing…" : item.state === "error" ? "Could not process" : "Queued"}</small></div></div><footer><strong>{item.file.name}</strong>{item.resultUrl ? <a href={item.resultUrl} download={`${item.file.name.replace(/\.[^.]+$/, "")}-background-removed.png`}><Download size={13} /> PNG</a> : <span>{item.state === "processing" ? "One credit on success" : "Ready"}</span>}</footer></article>)}</section>}
      </>}</section>
    </main>
  </div>;
}

async function compositeMask(sourceUrl: string, maskWidth: number, maskHeight: number, channels: number, maskPixels: Uint8ClampedArray) {
  const source = await loadImage(sourceUrl);
  const sourceCanvas = document.createElement("canvas"); sourceCanvas.width = source.naturalWidth; sourceCanvas.height = source.naturalHeight;
  const sourceContext = sourceCanvas.getContext("2d")!; sourceContext.drawImage(source, 0, 0);
  const maskCanvas = document.createElement("canvas"); maskCanvas.width = maskWidth; maskCanvas.height = maskHeight;
  const maskContext = maskCanvas.getContext("2d")!; const imageData = maskContext.createImageData(maskWidth, maskHeight);
  for (let pixel = 0; pixel < maskWidth * maskHeight; pixel++) { const value = maskPixels[pixel * channels]; const offset = pixel * 4; imageData.data[offset] = 255; imageData.data[offset + 1] = 255; imageData.data[offset + 2] = 255; imageData.data[offset + 3] = value; }
  maskContext.putImageData(imageData, 0, 0);
  sourceContext.globalCompositeOperation = "destination-in";
  sourceContext.drawImage(maskCanvas, 0, 0, sourceCanvas.width, sourceCanvas.height);
  return await new Promise<string>((resolve) => sourceCanvas.toBlob((blob) => resolve(URL.createObjectURL(blob!)), "image/png"));
}

function loadImage(url: string) { return new Promise<HTMLImageElement>((resolve, reject) => { const image = new Image(); image.onload = () => resolve(image); image.onerror = () => reject(new Error("Could not load the source image.")); image.src = url; }); }

async function createUpscaledImage(sourceUrl: string, factor: 2 | 4) {
  const image = await loadImage(sourceUrl);
  const maxEdge = 8192;
  const safeScale = Math.min(factor, maxEdge / Math.max(image.naturalWidth, image.naturalHeight));
  const width = Math.round(image.naturalWidth * safeScale);
  const height = Math.round(image.naturalHeight * safeScale);
  if (width === image.naturalWidth && height === image.naturalHeight) throw new Error("This image is already at the browser's safe processing limit.");
  const canvas = document.createElement("canvas"); canvas.width = width; canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Your browser could not prepare the local image canvas.");
  context.imageSmoothingEnabled = true; context.imageSmoothingQuality = "high";
  context.drawImage(image, 0, 0, width, height);
  return await new Promise<string>((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(URL.createObjectURL(blob)) : reject(new Error("Could not create the upscaled PNG.")), "image/png"));
}
