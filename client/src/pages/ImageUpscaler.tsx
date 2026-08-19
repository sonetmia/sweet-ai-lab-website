import { AppThemeToggle } from "@/components/AppThemeToggle";
import { getUpscaledDimensions, getUpscaledFilename, type UpscaleFactor } from "@/lib/imageUpscale";
import { supabase } from "@/lib/supabase";
import JSZip from "jszip";
import { ArrowLeft, Check, Download, ImagePlus, ImageUp, Loader2, Play, Trash2, UploadCloud, X } from "lucide-react";
import { ChangeEvent, DragEvent, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import "./background-remover.css";
import "./upscaler.css";

type ItemState = "queued" | "processing" | "done" | "error";
type UpscaleResult = { url: string; blob: Blob; width: number; height: number };
type UpscaleItem = { id: string; file: File; inputUrl: string; factor: UpscaleFactor; state: ItemState; result?: UpscaleResult; error?: string };

export default function ImageUpscaler() {
  const [, navigate] = useLocation();
  const pickerRef = useRef<HTMLInputElement>(null);
  const itemsRef = useRef<UpscaleItem[]>([]);
  const [items, setItems] = useState<UpscaleItem[]>([]);
  const [creditCount, setCreditCount] = useState<number | null>(null);
  const [factor, setFactor] = useState<UpscaleFactor>(2);
  const [dragging, setDragging] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [zipping, setZipping] = useState(false);
  const [notice, setNotice] = useState("Choose multiple images to create a local upscaling batch.");

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  useEffect(() => {
    async function establishSession() {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        navigate("/");
        return;
      }
      const { data: creditData } = await supabase.rpc("get_my_credits");
      if (creditData?.success) setCreditCount(creditData.credits ?? 0);
    }
    void establishSession();
    return () => {
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
    setNotice(`${accepted.length} image${accepted.length === 1 ? "" : "s"} added. Each completed output costs 2 credits.`);
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
    setNotice("Your upscaling queue is clear.");
  }

  async function processItems(itemIds: string[]) {
    if (processing) return;
    const pending = items.filter((item) => itemIds.includes(item.id) && (item.state === "queued" || item.state === "error"));
    if (!pending.length) return;
    if ((creditCount ?? 0) < 2) {
      setNotice("You need at least two credits before starting an image upscale.");
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
        const result = await createUpscaledImage(item.inputUrl, item.factor);
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
    if (completedCount) setNotice(`${completedCount} image${completedCount === 1 ? "" : "s"} completed. Two credits were deducted for each successful PNG.`);
  }

  function downloadOne(item: UpscaleItem) {
    if (!item.result) return;
    triggerDownload(item.result.blob, getUpscaledFilename(item.file.name, item.factor));
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
      triggerDownload(archive, "sweet-ai-lab-upscaled-images.zip");
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
      <section className="remover-intro upscaler-intro"><div className="remover-kicker">Browser-local batch workflow</div><h1>Scale a full set,<br /><em>on your device.</em></h1><p>Build a bulk queue, choose 2× or 4× enlargement, and download each PNG or every completed image in one ZIP. Nothing is sent to the application server.</p></section>
      <section className="bulk-upscaler-section">
        <div className="bulk-upscaler-heading"><div><ImageUp size={18} /><span>IMAGE UPSCALER</span></div><h2>One local batch.<br /><em>Many finished images.</em></h2><p>High-quality browser resampling preserves each image’s aspect ratio. Two credits are deducted only after each successful PNG output.</p></div>
        <section className={dragging ? "remover-dropzone bulk-upscale-dropzone dragging" : "remover-dropzone bulk-upscale-dropzone"} onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={onDrop} onClick={() => pickerRef.current?.click()}><input ref={pickerRef} type="file" multiple accept="image/*" onChange={onFileChange} /><span><UploadCloud size={30} /></span><h2>Add images to your batch</h2><p>Select or drop multiple images. You can add more files before running the queue.</p><button><ImagePlus size={15} /> Choose images</button><small>PNG · JPG · WEBP · GIF · browser-local processing</small></section>
        <section className="bulk-upscale-controls"><label>Scale for queued images<select value={factor} disabled={processing} onChange={(event) => changeFactor(Number(event.target.value) as UpscaleFactor)}><option value={2}>2× upscale</option><option value={4}>4× upscale</option></select></label><p><b>2 credits</b> per successful image</p><button className="bulk-upscale-run" onClick={() => void processItems(items.map((item) => item.id))} disabled={!queuedCount || processing}>{processing ? <Loader2 className="spin" size={15} /> : <Play size={15} />}{processing ? "Processing batch…" : `Upscale queue (${queuedCount})`}</button></section>
      </section>
      <section className="bulk-upscale-status" aria-live="polite"><span>{notice}</span>{items.length > 0 && <div><button onClick={clearItems} disabled={processing}><Trash2 size={14} /> Clear queue</button><button className="bulk-zip-button" onClick={() => void downloadZip()} disabled={!completedCount || zipping}>{zipping ? <Loader2 className="spin" size={14} /> : <Download size={14} />}{zipping ? "Creating ZIP…" : `Download ZIP (${completedCount})`}</button></div>}</section>
      {items.length > 0 && <section className="bulk-upscale-grid">{items.map((item, index) => <article className="bulk-upscale-card" key={item.id}><div className="bulk-upscale-card-head"><span>IMAGE {String(index + 1).padStart(2, "0")}</span><button onClick={() => removeItem(item.id)} disabled={processing} aria-label={`Remove ${item.file.name}`}><X size={14} /></button></div><div className="bulk-upscale-preview"><div><img src={item.inputUrl} alt={`Original ${item.file.name}`} /><small>Original</small></div><div>{item.state === "done" && item.result ? <img src={item.result.url} alt={`Upscaled ${item.file.name}`} /> : item.state === "processing" ? <Loader2 className="spin" size={27} /> : item.state === "error" ? <span className="bulk-card-error">{item.error}</span> : <ImageUp size={25} />}<small>{item.state === "done" && item.result ? `${item.result.width} × ${item.result.height}px` : item.state === "processing" ? "Upscaling…" : item.state === "error" ? "Needs attention" : `${item.factor}× ready`}</small></div></div><footer><div><strong>{item.file.name}</strong><span>{item.factor}× · {item.state === "done" ? "Complete" : item.state === "processing" ? "In progress" : item.state === "error" ? "Try again" : "Queued"}</span></div>{item.state === "done" && item.result ? <button className="card-download" onClick={() => downloadOne(item)}><Download size={13} /> PNG</button> : <button className="card-run" onClick={() => void processItems([item.id])} disabled={processing || (item.state !== "queued" && item.state !== "error")}><Play size={13} /> {item.state === "error" ? "Retry" : "Upscale"}</button>}</footer></article>)}</section>}
    </main>
  </div>;
}

async function createUpscaledImage(sourceUrl: string, factor: UpscaleFactor): Promise<UpscaleResult> {
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
