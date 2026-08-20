import { plans } from "@/lib/catalog";
import { supabase } from "@/lib/supabase";
import { AppThemeToggle } from "@/components/AppThemeToggle";
import "./billing.css";
import { ArrowLeft, ArrowRight, Check, Copy, CreditCard, Loader2, MessageCircle, ShieldCheck } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { useLocation } from "wouter";

type PlanKey = "pro" | "max";

export default function Billing() {
  const [, navigate] = useLocation();
  const [selectedPlan, setSelectedPlan] = useState<PlanKey>("pro");
  const [bkashNumber, setBkashNumber] = useState("");
  const [transactionId, setTransactionId] = useState("");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const receiver = import.meta.env.VITE_BKASH_RECEIVER as string;
  const whatsapp = import.meta.env.VITE_WHATSAPP_SUPPORT_NUMBER as string;

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      if (!data.session) navigate("/");
      else setEmail(data.session.user.email ?? "");
    });
  }, [navigate]);

  async function submitPayment(event: FormEvent) {
    event.preventDefault(); setError("");
    if (!/^01[0-9]{9}$/.test(bkashNumber)) return setError("Enter a valid 11-digit bKash number.");
    if (transactionId.trim().length < 6) return setError("Enter a valid transaction ID.");
    setSubmitting(true);
    const { data, error: requestError } = await supabase.rpc("submit_payment_request", { p_plan: selectedPlan, p_bkash_number: bkashNumber, p_transaction_id: transactionId.trim() });
    setSubmitting(false);
    if (requestError || !data?.success) return setError(data?.error === "pending_request_exists" ? "A payment request is already pending for this account." : "We could not save the request. Please check the information and try again.");
    const plan = plans[selectedPlan];
    const message = [`Hello Sweet AI Lab by SONET, I would like to upgrade to the ${plan.name} plan.`, "", `Email: ${email}`, `Plan: ${plan.name} (${plan.credits.toLocaleString()} credits) — ${plan.price}`, `bKash number: ${bkashNumber}`, `Transaction ID: ${transactionId.trim()}`, "", "Please verify this payment request. Thank you."].join("\n");
    window.open(`https://wa.me/${toWhatsAppId(whatsapp)}?text=${encodeURIComponent(message)}`, "_blank", "noopener,noreferrer");
    setSuccess(true);
  }

  return <div className="billing-shell"><header className="billing-header"><button onClick={() => navigate("/studio")}><ArrowLeft size={16} /> Studio</button><a href="/" className="billing-brand"><span className="brand-s">S</span> Sweet AI Lab by SONET</a><AppThemeToggle /></header><main className="billing-main"><section className="billing-intro"><div className="billing-kicker"><CreditCard size={13} /> Credit plans</div><h1>Pick a plan<br /><em>for your work.</em></h1><p>Choose a plan, pay to the bKash number below, and submit your transaction ID. We check each payment before adding credits.</p></section><section className="billing-grid"><div className="plan-selector"><p className="form-eyebrow">01 — Choose a plan</p>{(["free", "pro", "max"] as const).map((key) => { const plan = plans[key]; const available = key !== "free"; return <button key={key} className={selectedPlan === key ? "billing-plan selected" : "billing-plan"} disabled={!available} onClick={() => available && setSelectedPlan(key as PlanKey)}><div><span>{plan.name}</span>{key === "free" && <b>Start here</b>}{key === "pro" && <b>Popular</b>}<strong>{plan.price}</strong><small>{plan.credits.toLocaleString()} credits</small></div><p>{plan.description}</p>{available && <i><Check size={13} /></i>}</button>; })}</div><form className="payment-form" onSubmit={submitPayment}>{success ? <div className="payment-success"><span><Check size={23} /></span><h2>Request saved.</h2><p>Your request is waiting for payment review. We also opened WhatsApp with the same details.</p><button type="button" onClick={() => navigate("/studio")}>Return to studio <ArrowRight size={15} /></button></div> : <><p className="form-eyebrow">02 — Add payment details</p><div className="receiver-card"><div><span>bKash number</span><strong>{receiver}</strong></div><button type="button" onClick={() => void navigator.clipboard.writeText(receiver)} title="Copy bKash number"><Copy size={15} /></button></div><p className="payment-hint">Send exactly <b>{plans[selectedPlan].price}</b> for the {plans[selectedPlan].name} plan. Then enter your sending number and transaction ID.</p><label>Your bKash number<input value={bkashNumber} onChange={(event) => setBkashNumber(event.target.value)} placeholder="01XXXXXXXXX" inputMode="numeric" maxLength={11} /></label><label>Transaction ID<input value={transactionId} onChange={(event) => setTransactionId(event.target.value.toUpperCase())} placeholder="Example: 8N7A3D2K1P" /></label>{error && <p className="payment-error">{error}</p>}<button className="payment-submit" disabled={submitting}>{submitting ? <Loader2 className="spin" size={16} /> : <MessageCircle size={16} />}{submitting ? "Saving request…" : "Save & open WhatsApp"}</button><div className="payment-security"><ShieldCheck size={14} /> We use this only to check your payment.</div><p className="payment-hint">Need help? <a href={`https://wa.me/${toWhatsAppId(whatsapp)}`} target="_blank" rel="noreferrer">WhatsApp: 01797953059</a> · <a href="mailto:md.sonet.mia01@gmail.com">Email us</a></p></>}</form></section></main></div>;
}

function toWhatsAppId(value: string) {
  const digits = value.replace(/\D/g, "");
  return digits.startsWith("0") ? `88${digits}` : digits;
}
