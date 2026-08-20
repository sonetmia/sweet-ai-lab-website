import { plans } from "@/lib/catalog";
import { supabase } from "@/lib/supabase";
import { AppThemeToggle } from "@/components/AppThemeToggle";
import { ArrowRight, Check, FileText, Globe2, ImageIcon, Loader2, LockKeyhole, Mail, MessageCircle, ShieldCheck, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation } from "wouter";

const platformBadges = ["Adobe Stock", "Freepik", "Shutterstock", "Depositphotos", "123RF", "Vecteezy", "Dreamstime"];

const tools = [
  { icon: FileText, eyebrow: "Metadata", title: "Create stock-ready details.", copy: "Make a title, keywords, description, and category for your upload.", tint: "mint" },
  { icon: ImageIcon, eyebrow: "Image to Prompt", title: "Turn an image into a prompt.", copy: "Get a clear prompt you can use for your next image idea.", tint: "violet" },
  { icon: ImageIcon, eyebrow: "Background Remover", title: "Remove a background locally.", copy: "Keep your file in your browser while you make a clean PNG cutout.", tint: "amber" },
];

export default function Home() {
  const [, navigate] = useLocation();
  const [loading, setLoading] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);

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
        <nav className={menuOpen ? "main-nav is-open" : "main-nav"} aria-label="Primary navigation"><a href="#tools" onClick={() => setMenuOpen(false)}>Tools</a><a href="#workflow" onClick={() => setMenuOpen(false)}>How it works</a><a href="#plans" onClick={() => setMenuOpen(false)}>Plans</a><button className="nav-contact" onClick={() => { setContactOpen(true); setMenuOpen(false); }}>Contact</button></nav>
        <div className="header-actions"><AppThemeToggle /><button className="text-button" onClick={continueWithGoogle}>Sign in</button><button className="menu-button" onClick={() => setMenuOpen(!menuOpen)} aria-expanded={menuOpen} aria-label="Toggle navigation"><span /><span /></button></div>
      </header>
      <main>
        <section className="hero container">
          <div className="hero-copy">
            <div className="eyebrow">Tools for stock creators</div>
            <h1>Create. Prepare.<br /><span>Submit.</span></h1>
            <p className="hero-lead">Make metadata, image prompts, and clean image files in one place.</p>
            <div className="hero-actions"><button className="primary-button" onClick={continueWithGoogle} disabled={loading}>{loading ? <Loader2 size={18} className="spin" /> : <span className="google-mark">G</span>}{loading ? "Opening Google…" : "Continue with Google"}{!loading && <ArrowRight size={17} />}</button><a className="quiet-link" href="#tools">Explore the tools <ArrowRight size={15} /></a></div>
            <div className="trust-line"><ShieldCheck size={16} /> Your own API keys stay in this browser tab.</div>
          </div>
          <div className="hero-art" aria-label="Product workflow preview">
            <div className="art-topline">Studio workspace <span>Live system</span></div>
            <div className="art-stage"><div className="floating-card card-metadata"><div className="floating-icon mint"><FileText size={19} /></div><div><small>METADATA</small><strong>Platform-aware</strong></div><Check size={17} className="card-check" /></div><div className="central-graphic"><span>S</span></div><div className="floating-card card-prompt"><div className="floating-icon violet"><ImageIcon size={18} /></div><div><small>PROMPT</small><strong>Style mapped</strong></div></div><div className="floating-card card-local"><div className="floating-icon amber"><LockKeyhole size={18} /></div><div><small>PROCESSING</small><strong>Browser-local</strong></div></div></div>
            <div className="art-footer"><span>Adobe Stock</span><i /><span>Freepik</span><i /><span>Shutterstock</span></div>
          </div>
        </section>
        <section className="platform-strip" aria-label="Supported stock platforms"><div className="container platform-inner"><span>Works with stock platforms</span><div>{platformBadges.map((platform) => <b key={platform}>{platform}</b>)}</div></div></section>
        <section className="tools-section container" id="tools"><div className="section-intro"><div className="eyebrow"><span className="tiny-line" /> Simple tools for your uploads</div><h2>Everything you need for <em>your next upload.</em></h2><p>Choose a tool, upload your file, and save the result.</p></div><div className="tool-grid">{tools.map((tool, index) => { const Icon = tool.icon; return <article className={`tool-card tone-${tool.tint}`} key={tool.eyebrow}><div className="tool-card-head"><span className="tool-number">0{index + 1}</span><span className="tool-icon"><Icon size={22} /></span></div><p className="tool-eyebrow">{tool.eyebrow}</p><h3>{tool.title}</h3><p>{tool.copy}</p><a href="#workflow">How it works <ArrowRight size={15} /></a></article>; })}</div></section>
        <section className="workflow-section" id="workflow"><div className="container workflow-grid"><div className="workflow-copy"><div className="eyebrow">A simple workflow</div><h2>Less work.<br /><em>More ready files.</em></h2><p>Upload a file, choose what you need, and download the result.</p><div className="workflow-points"><span><Check size={15} /> Choose a stock platform</span><span><Check size={15} /> Use your own API key</span><span><Check size={15} /> Download your result</span></div></div><div className="workflow-panel"><div className="panel-heading"><span>YOUR QUEUE</span><b>03 ready</b></div>{["summer-garden-illustration.ai", "studio-ceramics-set.jpg", "coastal-poster-series.png"].map((file, index) => <div className="queue-row" key={file}><span className={`queue-index q-${index + 1}`}>0{index + 1}</span><div><strong>{file}</strong><small>{index === 0 ? "Metadata ready" : index === 1 ? "Prompt ready" : "Ready to process"}</small></div><span className={index === 0 ? "status-done" : "status-ready"}>{index === 0 ? "Done" : "Ready"}</span></div>)}<div className="panel-bottom"><span>200 free credits</span><button onClick={continueWithGoogle}>Open studio <ArrowRight size={14} /></button></div></div></div></section>
        <section className="plans-section container" id="plans"><div className="plans-heading"><div><div className="eyebrow">Clear credit plans</div><h2>Pick a plan that<br /><em>fits your work.</em></h2></div><p>Start free with 200 credits. Upgrade when you need more.</p></div><div className="plans-grid">{Object.entries(plans).map(([key, plan]) => <article className={key === "pro" ? "plan-card featured" : "plan-card"} key={plan.name}>{key === "pro" && <span className="recommended">Popular</span>}<span className="plan-name">{plan.name}</span><strong>{plan.price}</strong><span className="plan-credits">{plan.credits.toLocaleString()} credits</span><p>{plan.description}</p><button onClick={continueWithGoogle}>{key === "free" ? "Start free" : "Choose this plan"} <ArrowRight size={15} /></button></article>)}</div></section>
        <section className="closing-section container"><div><span className="closing-mark brand-s">S</span><h2>Ready for your<br /><em>next upload?</em></h2></div><button className="primary-button" onClick={continueWithGoogle}>Open Sweet AI Lab <ArrowRight size={17} /></button></section>
      </main>
      <footer className="landing-footer container"><span>© {new Date().getFullYear()} Sweet AI Lab by SONET</span><div><a href="#tools">Tools</a><a href="#plans">Plans</a><button className="footer-contact" onClick={() => setContactOpen(true)}>Contact</button></div></footer>
      {contactOpen && <div className="contact-backdrop" role="presentation" onClick={() => setContactOpen(false)}><section className="contact-card" role="dialog" aria-modal="true" aria-label="Contact Sweet AI Lab" onClick={(event) => event.stopPropagation()}><button className="contact-close" onClick={() => setContactOpen(false)} aria-label="Close contact details"><X size={16} /></button><span className="brand-s contact-symbol">S</span><h2>Contact SONET</h2><p>For payment help, plan questions, or website support.</p><a className="contact-action whatsapp" href="https://wa.me/8801797953059" target="_blank" rel="noreferrer"><MessageCircle size={17} /> WhatsApp · 01797953059</a><a className="contact-action" href="mailto:md.sonet.mia01@gmail.com"><Mail size={17} /> md.sonet.mia01@gmail.com</a><a className="contact-action" href="https://mdsonetmia.vercel.app" target="_blank" rel="noreferrer"><Globe2 size={17} /> mdsonetmia.vercel.app</a></section></div>}
    </div>
  );
}
