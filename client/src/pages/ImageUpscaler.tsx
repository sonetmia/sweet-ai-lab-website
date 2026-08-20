import { AppThemeToggle } from "@/components/AppThemeToggle";
import { MAX_UPSCALE_EDGE, getUpscaledDimensions, getUpscaledFilename, type UpscaleFactor } from "@/lib/imageUpscale";
import { supabase } from "@/lib/supabase";
import JSZip from "jszip";
import { ArrowLeft, Download, ImagePlus, ImageUp, Loader2, Play, Trash2, UploadCloud, X } from "lucide-react";
import { ChangeEvent, DragEvent, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import "./background-remover.css";
import "./upscaler.css";

type ItemState = "queued" | "processing" | "done" | "error";
type UpscaleResult = { url: string; blob: Blob; width: number; height: number };
type UpscaleItem = { id: string; file: File; inputUrl: string; factor: UpscaleFactor; state: ItemState; result?: UpscaleResult; error?: string };
type WorkerResponse = { type: "progress"; factor: UpscaleFactor; percentage: number } | { type: "ready"; factor: UpscaleFactor } | { type: "done"; id: string; width: number; height: number; buffer: ArrayBuffer } | { type: "error"; id: string | null; message: string };
type ModelLoad = { factor: UpscaleFactor; resolve: () => void; reject: (error: Error) => void };
type ProcessingJob = { resolve: (result: UpscaleResult) => void; reject: (error: Error) => void };

let aiUpscaleWorker: Worker | null = null;

function getAiUpscaleWorker() {
  if (!aiUpscaleWorker) aiUpscaleWorker = new Worker(new URL("../workers/upscale.worker.ts", import.meta.url), { type: "module" });
  return aiUpscaleWorker;
}

export default function ImageUpscaler() {
  const [, navigate] = useLocation();
  const pickerRef = useRef<HTMLInputElement>(null);
  const itemsRef = useRef<UpscaleItem[]>([]);
  const jobsRef = useRef(new Map<string, ProcessingJob>());
  const modelLoadRef = useRef<ModelLoad | null>(null);
  const readyFactorRef = useRef<UpscaleFactor | null>(null);
  const aiFailureRef = useRef<string | null>(null);
  const [items, setItems] = useState<UpscaleItem[]>([]);
  const [creditCount, setCreditCount] = useState<number | null>(null);
  const [factor, setFactor] = useState<UpscaleFactor>(2);
  const [dragging, setDragging] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [zipping, setZipping] = useState(false);
  const [modelState, setModelState] = useState<{ factor: UpscaleFactor | null; progress: number; loading: boolean }>({ factor: null, progress: 0, loading: false });
  const [notice, setNotice] = useState("Choose multiple images for browser-local upscaling. AI acceleration is used when supported, with a high-quality local fallback for every supported image.");

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  useEffect(() => {
    async function establishSession() {
      const { data } = await supabase.auth.getSession();
      if (!data.session) return navigate("/");
      const { data: creditData } = await supabase.rpc("get_my_credits");
      if (creditData?.success) setCreditCount(creditData.credits ?? 0);
    }
    void establishSession();

    const onWorkerMessage = (event: MessageEvent<WorkerResponse>) => {
      const data = event.data;
      if (data.type === "progress") {
        setModelState({ factor: data.factor, progress: data.percentage, loading: true });
        return;
      }
      if (data.type === "ready") {
        readyFactorRef.current = data.factor;
        setModelState({ factor: data.factor, progress: 100, loading: false });
        const pendingLoad = modelLoadRef.current;
        if (pendingLoad?.factor === data.factor) {
          modelLoadRef.current = null;
          pendingLoad.resolve();
        }
        return;
      }
      if (data.type === "done") {
        const job = jobsRef.current.get(data.id);
        if (!job) return;
        jobsRef.current.delete(data.id);
        const blob = new Blob([data.buffer], { type: "image/png" });
        job.resolve({ url: URL.createObjectURL(blob), blob, width: data.width, height: data.height });
        return;
      }
      if (data.id) {
        const job = jobsRef.current.get(data.id);
        if (job) {
          jobsRef.current.delete(data.id);
          job.reject(new Error(data.message));
        }
      } else if (modelLoadRef.current) {
        const pendingLoad = modelLoadRef.current;
        modelLoadRef.current = null;
        setModelState((current) => ({ ...current, loading: false }));
        pendingLoad.reject(new Error(data.message));
      }
    };
    let activeWorker: Worker | null = null;
    try {
      activeWorker = getAiUpscaleWorker();
      activeWorker.addEventListener("message", onWorkerMessage);
    } catch (error) {
      aiFailureRef.current = error instanceof Error ? error.message : "This browser cannot start the optional AI worker.";
      setNotice("AI acceleration cannot start in this browser, so completed images will use reliable high-quality browser upscaling instead.");
    }
    return () => {
      activeWorker?.removeEventListener("message", onWorkerMessage);
      itemsRef.current.forEach((item) => {
        URL.revokeObjectURL(item.inputUrl);
        if (item.result) URL.revokeObjectURL(item.result.url);
      });
    };
  }, [navigate]);

  function addFiles(fileList: FileList | File[]) {
    const accepted = Array.from(fileList).filter((file) => file.type.startsWith("image/"));
    if (!accepted.length) {
      setNotice("Choose PNG, JPG, WEBP, GIF, or another browser-supported image file.");
      return;
    }
    setItems((current) => [...current, ...accepted.map((file) => ({ id: crypto.randomUUID(), file, inputUrl: URL.createObjectURL(file), factor, state: "queued" as const }))]);
    setNotice(`${accepted.length} image${accepted.length === 1 ? "" : "s"} added. Each completed AI output costs 2 credits.`);
  }

  function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    if (event.target.files) addFiles(event.target.files);
    event.target.value = "";
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    addFiles(event.dataTransfer.files);
  }

  function changeFactor(nextFactor: UpscaleFactor) {
    setFactor(nextFactor);
    setItems((current) => current.map((item) => item.state === "queued" || item.state === "error" ? { ...item, factor: nextFactor, error: undefined, state: "queued" } : item));
  }

  function removeItem(id: string) {
    if (processing) return;
    setItems((current) => {
      const target = current.find((item) => item.id === id);
      if (target) {
        URL.revokeObjectURL(target.inputUrl);
        if (target.result) URL.revokeObjectURL(target.result.url);
      }
      return current.filter((item) => item.id !== id);
    });
  }

  function clearItems() {
    if (processing) return;
    items.forEach((item) => {
      URL.revokeObjectURL(item.inputUrl);
      if (item.result) URL.revokeObjectURL(item.result.url);
    });
    setItems([]);
    setNotice("Your AI upscaling queue is clear.");
  }

  function ensureAiModel(nextFactor: UpscaleFactor) {
    if (readyFactorRef.current === nextFactor) return Promise.resolve();
    if (modelLoadRef.current?.factor === nextFactor) return new Promise<void>((resolve, reject) => {
      const waiting = modelLoadRef.current;
      if (!waiting) return reject(new Error("The AI model could not be prepared."));
      const originalResolve = waiting.resolve;
      const originalReject = waiting.reject;
      waiting.resolve = () => { originalResolve(); resolve(); };
      waiting.reject = (error) => { originalReject(error); reject(error); };
    });
    return new Promise<void>((resolve, reject) => {
      modelLoadRef.current = { factor: nextFactor, resolve, reject };
      setModelState({ factor: nextFactor, progress: 0, loading: true });
      try {
        getAiUpscaleWorker().postMessage({ type: "load", factor: nextFactor });
      } catch (error) {
        modelLoadRef.current = null;
        setModelState((current) => ({ ...current, loading: false }));
        reject(error instanceof Error ? error : new Error("The optional AI worker could not be started."));
      }
    });
  }

  async function runResilientUpscale(item: UpscaleItem) {
    if (!aiFailureRef.current) {
      try {
        await withTimeout(ensureAiModel(item.factor), 45000, "Optional AI acceleration took too long to load.");
        const prepared = await createSafeInput(item.inputUrl, item.factor);
        try {
          return await new Promise<UpscaleResult>((resolve, reject) => {
            jobsRef.current.set(item.id, { resolve, reject });
            getAiUpscaleWorker().postMessage({ type: "process", id: item.id, url: prepared.url, factor: item.factor });
          });
        } finally {
          if (prepared.revoke) URL.revokeObjectURL(prepared.url);
        }
      } catch (error) {
        aiFailureRef.current = error instanceof Error ? error.message : "The optional AI model is unavailable in this browser.";
        readyFactorRef.current = null;
        setModelState((current) => ({ ...current, loading: false }));
        setNotice("AI acceleration is unavailable in this browser, so Sweet AI Lab is using reliable high-quality browser upscaling instead. Successful outputs still cost 2 credits.");
      }
    }
    return createBrowserUpscaledImage(item.inputUrl, item.factor);
  }

  async function processItems(itemIds: string[]) {
    if (processing) return;
    const pending = items.filter((item) => itemIds.includes(item.id) && (item.state === "queued" || item.state === "error"));
    if (!pending.length) return;
    if ((creditCount ?? 0) < 2) {
      setNotice("You need at least two credits before starting an AI image upscale.");
      return;
    }

    setProcessing(true);
    let remainingCredits = creditCount ?? 0;
    let completedCount = 0;

    for (const item of pending) {
      if (remainingCredits < 2) {
        setNotice("The batch paused because fewer than two credits remain. Completed images are ready to download.");
        break;
      }
      setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, state: "processing", error: undefined } : entry));
      try {
        const result = await runResilientUpscale(item);
        const { data: debit, error: debitError } = await supabase.rpc("deduct_credit", { action_type: "image_upscale", amount: 2 });
        if (debitError || !debit?.success) {
          URL.revokeObjectURL(result.url);
          throw new Error(debit?.error === "insufficient_credits" ? "No credits remain for this image." : "The image was upscaled, but its credit charge could not be completed.");
        }
        remainingCredits = debit.credits ?? remainingCredits - 2;
        completedCount += 1;
        setCreditCount(remainingCredits);
        setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, state: "done", result } : entry));
      } catch (error) {
        setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, state: "error", error: error instanceof Error ? error.message : "Could not upscale this image." } : entry));
      }
    }

    setProcessing(false);
    if (completedCount) setNotice(`${completedCount} image${completedCount === 1 ? "" : "s"} completed locally. Two credits were deducted for each successful PNG.`);
  }

  function downloadOne(item: UpscaleItem) {
    if (item.result) triggerDownload(item.result.blob, getUpscaledFilename(item.file.name, item.factor));
  }

  async function downloadZip() {
    const completed = items.filter((item) => item.state === "done" && item.result);
    if (!completed.length || zipping) return;
    setZipping(true);
    setNotice("Preparing your ZIP download…");
    try {
      const zip = new JSZip();
      completed.forEach((item) => zip.file(getUpscaledFilename(item.file.name, item.factor), item.result!.blob));
      const archive = await zip.generateAsync({ type: "blob", compression: "DEFLATE", compressionOptions: { level: 6 } });
      triggerDownload(archive, "sweet-ai-lab-ai-upscaled-images.zip");
      setNotice(`${completed.length} completed image${completed.length === 1 ? "" : "s"} packed into a ZIP file.`);
    } catch {
      setNotice("The ZIP could not be created. You can still download each completed PNG separately.");
    } finally {
      setZipping(false);
    }
  }

  const queuedCount = items.filter((item) => item.state === "queued" || item.state === "error").length;
  const completedCount = items.filter((item) => item.state === "done").length;

  return <div className="remover-shell upscaler-shell">
    <header className="remover-header"><button onClick={() => navigate("/studio")}><ArrowLeft size={16} /> Studio</button><a href="/" className="remover-brand"><span className="brand-s">S</span> Sweet AI Lab by SONET</a><div><span>{creditCount === null ? "Checking credits" : `${creditCount} credits`}</span><button onClick={() => navigate("/background-remover")}>Background remover</button><AppThemeToggle /></div></header>
    <main className="remover-main upscaler-main">
      <section className="remover-intro upscaler-intro"><div className="remover-kicker">Browser-local AI batch workflow</div><h1>Scale a full set,<br /><em>with real AI detail.</em></h1><p>Use Swin2SR super-resolution for clean 2× or 4× enlargement. Files remain on your device; the selected AI model downloads once and then stays in your browser cache.</p></section>
      <section className="bulk-upscaler-section">
        <div className="bulk-upscaler-heading"><div><ImageUp size={18} /><span>AI IMAGE UPSCALER</span></div><h2>One local batch.<br /><em>Sharper finished images.</em></h2><p>AI super-resolution preserves aspect ratio and reconstructs image detail beyond standard browser resampling. Two credits are deducted only after each successful PNG output.</p>{modelState.loading && <small className="ai-model-progress">Preparing {modelState.factor}× AI model · {Math.round(modelState.progress)}%</small>}</div>
        <section className={dragging ? "remover-dropzone bulk-upscale-dropzone dragging" : "remover-dropzone bulk-upscale-dropzone"} onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={onDrop} onClick={() => pickerRef.current?.click()}><input ref={pickerRef} type="file" multiple accept="image/*" onChange={onFileChange} /><span><UploadCloud size={30} /></span><h2>Add images to your batch</h2><p>Select or drop multiple images. You can add more files before running the queue.</p><button><ImagePlus size={15} /> Choose images</button><small>PNG · JPG · WEBP · GIF · local AI processing</small></section>
        <section className="bulk-upscale-controls"><label>AI scale for queued images<select value={factor} disabled={processing} onChange={(event) => changeFactor(Number(event.target.value) as UpscaleFactor)}><option value={2}>AI 2× upscale</option><option value={4}>AI 4× upscale</option></select></label><p><b>2 credits</b> per successful image</p><button className="bulk-upscale-run" onClick={() => void processItems(items.map((item) => item.id))} disabled={!queuedCount || processing}>{processing ? <Loader2 className="spin" size={15} /> : <Play size={15} />}{processing ? "Processing AI batch…" : `Upscale queue (${queuedCount})`}</button></section>
      </section>
      <section className="bulk-upscale-status" aria-live="polite"><span>{notice}</span>{items.length > 0 && <div><button onClick={clearItems} disabled={processing}><Trash2 size={14} /> Clear queue</button><button className="bulk-zip-button" onClick={() => void downloadZip()} disabled={!completedCount || zipping}>{zipping ? <Loader2 className="spin" size={14} /> : <Download size={14} />}{zipping ? "Creating ZIP…" : `Download ZIP (${completedCount})`}</button></div>}</section>
      {items.length > 0 && <section className="bulk-upscale-grid">{items.map((item, index) => <article className="bulk-upscale-card" key={item.id}><div className="bulk-upscale-card-head"><span>IMAGE {String(index + 1).padStart(2, "0")}</span><button onClick={() => removeItem(item.id)} disabled={processing} aria-label={`Remove ${item.file.name}`}><X size={14} /></button></div><div className="bulk-upscale-preview"><div><img src={item.inputUrl} alt={`Original ${item.file.name}`} /><small>Original</small></div><div>{item.state === "done" && item.result ? <img src={item.result.url} alt={`AI upscaled ${item.file.name}`} /> : item.state === "processing" ? <Loader2 className="spin" size={27} /> : item.state === "error" ? <span className="bulk-card-error">{item.error}</span> : <ImageUp size={25} />}<small>{item.state === "done" && item.result ? `${item.result.width} × ${item.result.height}px` : item.state === "processing" ? "AI upscaling…" : item.state === "error" ? "Needs attention" : `AI ${item.factor}× ready`}</small></div></div><footer><div><strong>{item.file.name}</strong><span>AI {item.factor}× · {item.state === "done" ? "Complete" : item.state === "processing" ? "In progress" : item.state === "error" ? "Try again" : "Queued"}</span></div>{item.state === "done" && item.result ? <button className="card-download" onClick={() => downloadOne(item)}><Download size={13} /> PNG</button> : <button className="card-run" onClick={() => void processItems([item.id])} disabled={processing || (item.state !== "queued" && item.state !== "error")}><Play size={13} /> {item.state === "error" ? "Retry" : "Upscale"}</button>}</footer></article>)}</section>}
    </main>
  </div>;
}

async function createSafeInput(sourceUrl: string, factor: UpscaleFactor) {
  const image = await loadImage(sourceUrl);
  const safeSourceScale = Math.min(1, MAX_UPSCALE_EDGE / (Math.max(image.naturalWidth, image.naturalHeight) * factor));
  if (safeSourceScale >= 1) return { url: sourceUrl, revoke: false };
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.naturalWidth * safeSourceScale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * safeSourceScale));
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Your browser could not prepare a safe AI input image.");
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((output) => output ? resolve(output) : reject(new Error("Could not prepare this image for AI upscaling.")), "image/png"));
  return { url: URL.createObjectURL(blob), revoke: true };
}

async function createBrowserUpscaledImage(sourceUrl: string, factor: UpscaleFactor): Promise<UpscaleResult> {
  const image = await loadImage(sourceUrl);
  const dimensions = getUpscaledDimensions(image.naturalWidth, image.naturalHeight, factor);
  if (dimensions.width === image.naturalWidth && dimensions.height === image.naturalHeight) throw new Error("This image is already at the browser's safe processing limit.");
  const canvas = document.createElement("canvas");
  canvas.width = dimensions.width;
  canvas.height = dimensions.height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Your browser could not prepare the local image canvas.");
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(image, 0, 0, dimensions.width, dimensions.height);
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((output) => output ? resolve(output) : reject(new Error("Could not create the upscaled PNG.")), "image/png"));
  return { url: URL.createObjectURL(blob), blob, width: dimensions.width, height: dimensions.height };
}

function withTimeout<T>(promise: Promise<T>, milliseconds: number, message: string) {
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error(message)), milliseconds);
    promise.then((value) => { window.clearTimeout(timer); resolve(value); }, (error) => { window.clearTimeout(timer); reject(error); });
  });
}

function loadImage(url: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Could not load the source image."));
    image.src = url;
  });
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}
