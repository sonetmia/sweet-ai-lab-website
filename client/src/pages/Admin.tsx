import { bootstrapConfiguredAdmin } from "@/lib/admin";
import { supabase } from "@/lib/supabase";
import { AppThemeToggle } from "@/components/AppThemeToggle";
import "./admin-extensions.css";
import "./admin.css";
import { ArrowLeft, ArrowRight, Check, CircleDollarSign, Loader2, ShieldCheck, UsersRound, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";

type Payment = { id: string; user_id: string; requested_plan: "pro" | "max"; amount_bdt: number; bkash_number: string; transaction_id: string; status: "pending" | "approved" | "rejected"; created_at: string };
type Profile = { id: string; email: string | null; display_name: string | null; plan: string; credits: number; credit_expires_at: string | null; role: string };

export default function Admin() {
  const [, navigate] = useLocation();
  const [loading, setLoading] = useState(true);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [error, setError] = useState("");
  const [topUp, setTopUp] = useState({ userId: "", amount: "" });
  const [manualPlan, setManualPlan] = useState({ userId: "", plan: "pro" as "pro" | "max" });

  const profileById = useMemo(() => new Map(profiles.map((profile) => [profile.id, profile])), [profiles]);

  async function loadAdminData() {
    setLoading(true); setError("");
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) return navigate("/");
    await bootstrapConfiguredAdmin();
    const { data: ownProfile } = await supabase.from("profiles").select("role").eq("id", sessionData.session.user.id).maybeSingle();
    if (ownProfile?.role !== "admin") { setError("This Google account is not the configured Sweet AI Lab by SONET administrator."); setLoading(false); return; }
    const [{ data: paymentRows, error: paymentError }, { data: profileRows, error: profileError }] = await Promise.all([
      supabase.from("payment_requests").select("id,user_id,requested_plan,amount_bdt,bkash_number,transaction_id,status,created_at").order("created_at", { ascending: false }),
      supabase.from("profiles").select("id,email,display_name,plan,credits,credit_expires_at,role").order("created_at", { ascending: false }),
    ]);
    if (paymentError || profileError) setError("The administrator data could not be loaded. Please refresh and try again.");
    setPayments((paymentRows ?? []) as Payment[]); setProfiles((profileRows ?? []) as Profile[]); setLoading(false);
  }

  useEffect(() => { void loadAdminData(); }, []);

  async function review(payment: Payment, decision: "approved" | "rejected") {
    const { data, error: reviewError } = await supabase.rpc("admin_review_payment", { p_request_id: payment.id, p_decision: decision, p_note: null, p_expiry_days: 30 });
    if (reviewError || !data?.success) setError("Could not update this payment request.");
    else await loadAdminData();
  }

  async function submitTopUp() {
    const amount = Number(topUp.amount);
    if (!topUp.userId || !Number.isInteger(amount) || amount === 0) { setError("Choose a user and enter a non-zero whole credit amount."); return; }
    const { data, error: topUpError } = await supabase.rpc("admin_top_up_credits", { p_user_id: topUp.userId, p_amount: amount, p_note: "admin_manual_top_up" });
    if (topUpError || !data?.success) setError("Could not update the credit balance.");
    else { setTopUp({ userId: "", amount: "" }); await loadAdminData(); }
  }

  async function activatePlan() {
    if (!manualPlan.userId) { setError("Choose a user before manually activating a plan."); return; }
    const { data, error: activationError } = await supabase.rpc("admin_activate_plan", { p_user_id: manualPlan.userId, p_plan: manualPlan.plan, p_expiry_days: 30, p_note: "admin_manual_plan_activation" });
    if (activationError || !data?.success) setError("Could not activate this plan.");
    else { setManualPlan({ userId: "", plan: "pro" }); await loadAdminData(); }
  }

  const pending = payments.filter((payment) => payment.status === "pending");
  return <div className="admin-shell"><header className="admin-header"><button onClick={() => navigate("/studio")}><ArrowLeft size={16} /> Studio</button><a href="/" className="admin-brand"><span className="brand-s">S</span> Sweet AI Lab by SONET</a><span>AI-Powered Tools for Creators</span><AppThemeToggle /></header><main className="admin-main">{loading ? <div className="admin-loading"><Loader2 className="spin" /> Loading protected data…</div> : error && !profiles.length ? <div className="admin-blocked"><ShieldCheck size={25} /><h1>Administrator access required</h1><p>{error}</p><button onClick={() => navigate("/studio")}>Return to studio</button></div> : <><section className="admin-intro"><div><div className="admin-kicker"><ShieldCheck size={13} /> Protected controls</div><h1>Review payments. <em>Keep credits honest.</em></h1><p>Approve valid transaction requests, reject invalid submissions, and make intentional manual credit corrections when support requires it.</p></div><button onClick={() => void loadAdminData()}>Refresh data</button></section>{error && <p className="admin-error">{error}</p>}<section className="admin-stats"><article><span><CircleDollarSign size={17} /></span><div><b>{pending.length}</b><small>Pending payments</small></div></article><article><span><UsersRound size={17} /></span><div><b>{profiles.length}</b><small>Registered users</small></div></article><article><span><Check size={17} /></span><div><b>{profiles.filter((profile) => profile.plan !== "free").length}</b><small>Paid plans active</small></div></article></section><section className="admin-grid"><div className="admin-section"><div className="admin-section-head"><div><small>PAYMENT REVIEW</small><h2>Pending verification</h2></div><span>{pending.length}</span></div>{pending.length ? <div className="payment-table">{pending.map((payment) => { const profile = profileById.get(payment.user_id); return <article key={payment.id}><div><strong>{profile?.display_name || profile?.email || "Unknown member"}</strong><span>{profile?.email}</span></div><div><small>PLAN</small><b>{payment.requested_plan.toUpperCase()} · ৳{payment.amount_bdt}</b></div><div><small>BKASH</small><b>{payment.bkash_number}</b></div><div><small>TXN ID</small><b>{payment.transaction_id}</b></div><div className="review-actions"><button className="approve" onClick={() => void review(payment, "approved")}><Check size={14} /> Approve</button><button className="reject" onClick={() => void review(payment, "rejected")}><X size={14} /> Reject</button></div></article>; })}</div> : <div className="admin-empty">No payment requests are waiting for review.</div>}</div><aside className="admin-actions"><div className="topup-card"><div><small>MANUAL TOP-UP</small><h2>Adjust credit balance</h2><p>Use only for genuine support corrections. Every adjustment is recorded in the credit ledger.</p></div><label>User<select value={topUp.userId} onChange={(event) => setTopUp((current) => ({ ...current, userId: event.target.value }))}><option value="">Choose an account</option>{profiles.filter((profile) => profile.role !== "admin").map((profile) => <option value={profile.id} key={profile.id}>{profile.email || profile.display_name} · {profile.credits} credits</option>)}</select></label><label>Credit adjustment<input value={topUp.amount} onChange={(event) => setTopUp((current) => ({ ...current, amount: event.target.value }))} inputMode="numeric" placeholder="Example: 50 or -10" /></label><button onClick={() => void submitTopUp()}>Apply adjustment <ArrowRight size={14} /></button></div><div className="topup-card activate-card"><div><small>MANUAL PLAN ACTIVATION</small><h2>Set Pro or Max</h2><p>Assign the exact plan credit bundle and a 30-day expiry without a payment request.</p></div><label>User<select value={manualPlan.userId} onChange={(event) => setManualPlan((current) => ({ ...current, userId: event.target.value }))}><option value="">Choose an account</option>{profiles.filter((profile) => profile.role !== "admin").map((profile) => <option value={profile.id} key={profile.id}>{profile.email || profile.display_name}</option>)}</select></label><label>Plan<select value={manualPlan.plan} onChange={(event) => setManualPlan((current) => ({ ...current, plan: event.target.value as "pro" | "max" }))}><option value="pro">Pro · 6000 credits · ৳200</option><option value="max">Max · 8000 credits · ৳500</option></select></label><button onClick={() => void activatePlan()}>Activate plan <ArrowRight size={14} /></button></div></aside></section><section className="admin-section user-section"><div className="admin-section-head"><div><small>USER STATUS</small><h2>Plans and credit balances</h2></div></div><div className="user-table"><div className="user-table-head"><span>Member</span><span>Plan</span><span>Credits</span><span>Expiry</span></div>{profiles.map((profile) => <div className="user-row" key={profile.id}><span><b>{profile.display_name || "Studio member"}</b><small>{profile.email}</small></span><span className={`plan-pill ${profile.plan}`}>{profile.plan}</span><span>{profile.credits.toLocaleString()}</span><span>{profile.credit_expires_at ? new Date(profile.credit_expires_at).toLocaleDateString() : "—"}</span></div>)}</div></section></>}</main></div>;
}
