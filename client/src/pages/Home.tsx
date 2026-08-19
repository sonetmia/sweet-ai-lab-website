import { plans } from "@/lib/catalog";
import { supabase } from "@/lib/supabase";
import { AppThemeToggle } from "@/components/AppThemeToggle";
import { ArrowRight, Check, FileText, ImageIcon, Loader2, LockKeyhole, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation } from "wouter";

const platformBadges = ["Adobe Stock", "Freepik", "Shutterstock", "Depositphotos", "123RF", "Vecteezy", "Dreamstime"];

const tools = [
  { icon: FileText, eyebrow: "Metadata Generator", title: "Precision metadata for every submission.", copy: "Generate title, keywords, description and category fields shaped around each platform’s workflow.", tint: "mint" },
  { icon: ImageIcon, eyebrow: "Image-to-Prompt", title: "Turn a visual language into a reusable prompt.", copy: "Transform source images into detailed, style-aware prompts for your next generation workflow.", tint: "violet" },
  { icon: ImageIcon, eyebrow: "Background Remover", title: "Keep image cleanup in your browser.", copy: "A local ONNX/WASM workflow removes backgrounds without sending your image file to an application server.", tint: "amber" },
];

export default function Home() {
  const [, navigate] = useLocation();
  const [loading, setLoading] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate("/studio");
    });
  }, [navigate]);

  async function continueWithGoogle() {
    setLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/studio` },
    });
    if (error) {
      setLoading(false);
      window.alert(error.message);
    }
  }

  return (
    <div className="site-shell">
      <header className="landing-header container">
        <a className="brand" href="/" aria-label="Sweet AI Lab by SONET home"><span className="brand-mark brand-s">S</span><span>Sweet AI Lab <em>by SONET</em></span></a>
        <nav className={menuOpen ? "main-nav is-open" : "main-nav"} aria-label="Primary navigation"><a href="#tools" onClick={() => setMenuOpen(false)}>Tools</a><a href="#workflow" onClick={() => setMenuOpen(false)}>Workflow</a><a href="#plans" onClick={() => setMenuOpen(false)}>Plans</a></nav>
        <div className="header-actions"><AppThemeToggle /><button className="text-button" onClick={continueWithGoogle}>Sign in</button><button className="menu-button" onClick={() => setMenuOpen(!menuOpen)} aria-expanded={menuOpen} aria-label="Toggle navigation"><span /><span /></button></div>
      </header>
      <main>
        <section className="hero container">
          <div className="hero-copy">
            <div className="eyebrow">AI tools for stock creators</div>
            <h1>Create. Prepare.<br /><span>Submit.</span></h1>
            <p className="hero-lead">Metadata, visual prompts, and private browser-local image tools—one focused workspace.</p>
            <div className="hero-actions"><button className="primary-button" onClick={continueWithGoogle} disabled={loading}>{loading ? <Loader2 size={18} className="spin" /> : <span className="google-mark">G</span>}{loading ? "Opening Google…" : "Continue with Google"}{!loading && <ArrowRight size={17} />}</button><a className="quiet-link" href="#tools">Explore the tools <ArrowRight size={15} /></a></div>
            <div className="trust-line"><ShieldCheck size={16} /> Your free keys stay in this tab. Paid credentials stay server-side.</div>
          </div>
          <div className="hero-art" aria-label="Product workflow preview">
            <div className="art-topline">Studio workspace <span>Live system</span></div>
            <div className="art-stage"><div className="floating-card card-metadata"><div className="floating-icon mint"><FileText size={19} /></div><div><small>METADATA</small><strong>Platform-aware</strong></div><Check size={17} className="card-check" /></div><div className="central-graphic"><span>S</span></div><div className="floating-card card-prompt"><div className="floating-icon violet"><ImageIcon size={18} /></div><div><small>PROMPT</small><strong>Style mapped</strong></div></div><div className="floating-card card-local"><div className="floating-icon amber"><LockKeyhole size={18} /></div><div><small>PROCESSING</small><strong>Browser-local</strong></div></div></div>
            <div className="art-footer"><span>Adobe Stock</span><i /><span>Freepik</span><i /><span>Shutterstock</span></div>
          </div>
        </section>
        <section className="platform-strip" aria-label="Supported stock platforms"><div className="container platform-inner"><span>Designed around the platforms you already use</span><div>{platformBadges.map((platform) => <b key={platform}>{platform}</b>)}</div></div></section>
        <section className="tools-section container" id="tools"><div className="section-intro"><div className="eyebrow"><span className="tiny-line" /> Focused tools, one composed system</div><h2>Made for the detail work behind <em>every good upload.</em></h2><p>Each tool has one clear job, with controls that let you retain the authorship of your own workflow.</p></div><div className="tool-grid">{tools.map((tool, index) => { const Icon = tool.icon; return <article className={`tool-card tone-${tool.tint}`} key={tool.eyebrow}><div className="tool-card-head"><span className="tool-number">0{index + 1}</span><span className="tool-icon"><Icon size={22} /></span></div><p className="tool-eyebrow">{tool.eyebrow}</p><h3>{tool.title}</h3><p>{tool.copy}</p><a href="#workflow">See workflow <ArrowRight size={15} /></a></article>; })}</div></section>
        <section className="workflow-section" id="workflow"><div className="container workflow-grid"><div className="workflow-copy"><div className="eyebrow">A deliberate studio routine</div><h2>Less tab switching.<br /><em>More considered output.</em></h2><p>Upload once, choose a target platform, calibrate your output, and export directly into the format you need. The dashboard is designed to keep your decisions close at hand.</p><div className="workflow-points"><span><Check size={15} /> Platform-specific CSV export</span><span><Check size={15} /> Own-key and paid AI paths</span><span><Check size={15} /> Credit history you can inspect</span></div></div><div className="workflow-panel"><div className="panel-heading"><span>CREATIVE QUEUE</span><b>03 ready</b></div>{["summer-garden-illustration.ai", "studio-ceramics-set.jpg", "coastal-poster-series.png"].map((file, index) => <div className="queue-row" key={file}><span className={`queue-index q-${index + 1}`}>0{index + 1}</span><div><strong>{file}</strong><small>{index === 0 ? "Metadata ready" : index === 1 ? "Prompt prepared" : "Ready to process"}</small></div><span className={index === 0 ? "status-done" : "status-ready"}>{index === 0 ? "Complete" : "In queue"}</span></div>)}<div className="panel-bottom"><span>500 credits available</span><button>Open studio <ArrowRight size={14} /></button></div></div></div></section>
        <section className="plans-section container" id="plans"><div className="plans-heading"><div><div className="eyebrow">Simple, transparent credits</div><h2>Choose the working pace<br />that suits <em>your practice.</em></h2></div><p>Start with Free. Upgrade when your workflow needs more room. Every paid request is reviewed manually for accuracy.</p></div><div className="plans-grid">{Object.entries(plans).map(([key, plan]) => <article className={key === "pro" ? "plan-card featured" : "plan-card"} key={plan.name}>{key === "pro" && <span className="recommended">Most balanced</span>}<span className="plan-name">{plan.name}</span><strong>{plan.price}</strong><span className="plan-credits">{plan.credits.toLocaleString()} credits</span><p>{plan.description}</p><button onClick={continueWithGoogle}>{key === "free" ? "Start creating" : "Choose plan"} <ArrowRight size={15} /></button></article>)}</div></section>
        <section className="closing-section container"><div><span className="closing-mark brand-s">S</span><h2>A cleaner space for<br /><em>your next submission.</em></h2></div><button className="primary-button" onClick={continueWithGoogle}>Start with Sweet AI Lab <ArrowRight size={17} /></button></section>
      </main>
      <footer className="landing-footer container"><span>© {new Date().getFullYear()} Sweet AI Lab by SONET</span><span>AI-Powered Tools for Creators</span><div><a href="#tools">Tools</a><a href="#plans">Plans</a><a href="mailto:md.sonet.mia01@gmail.com">md.sonet.mia01@gmail.com</a></div></footer>
    </div>
  );
}
