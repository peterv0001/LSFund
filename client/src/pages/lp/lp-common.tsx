import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { api } from "@shared/routes";
import { usePageMeta } from "@/hooks/use-page-meta";
import "./landing-pages.css";

export { usePageMeta };

export const APPLY_URL = "https://apply.myrmapp.com/multi-step-apply/pg";

// "apply" / "signup" redirect the visitor onward (capital funnels).
// "thanks" keeps merchant prospects on-page and shows a confirmation.
type Destination = "apply" | "signup" | "thanks";

/** Read the agent referral code from the URL (?ref= or ?agent=). */
export function getAgentRef(): string {
  if (typeof window === "undefined") return "";
  const p = new URLSearchParams(window.location.search);
  return (p.get("ref") || p.get("agent") || "").trim();
}

type SharePage = "platform" | "leaks" | "scale";

/**
 * Fire a lightweight, privacy-safe view ping when an agent-shared landing page
 * mounts. Only sends when the visitor arrived via a referral link (?ref=CODE).
 * Deduped per browser session so a refresh or in-app navigation doesn't inflate
 * the count. The post is best-effort: a failure simply records no view.
 */
export function useLandingView(page: SharePage) {
  useEffect(() => {
    const ref = getAgentRef();
    if (!ref) return;
    const dedupeKey = `lsf_lpview_${page}_${ref.toUpperCase()}`;
    try {
      if (sessionStorage.getItem(dedupeKey)) return;
      sessionStorage.setItem(dedupeKey, "1");
    } catch {
      // sessionStorage unavailable (private mode): still record the view.
    }
    apiRequest("POST", api.public.landingView.path, { ref, page }).catch(() => {
      // Best effort: never surface a tracking failure to the visitor.
    });
  }, [page]);
}

/**
 * Handles the "save lead, then send the visitor onward" flow shared by every
 * landing page. The save is best-effort and time-boxed so the redirect always
 * feels instant even if the network is slow. Agent attribution (?ref=CODE) and
 * an optional tier interest from a pricing CTA ride along with every submit.
 */
export function useLandingForm(campaign: string, destination: Destination) {
  const [, setLocation] = useLocation();
  const formRef = useRef<HTMLFormElement>(null);
  const submitting = useRef(false);
  const tierInterest = useRef<string>("");
  const agentRef = useRef<string>(getAgentRef());
  const [submitted, setSubmitted] = useState(false);

  function redirect() {
    if (destination === "thanks") {
      setSubmitted(true);
      if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    if (destination === "apply") {
      window.location.href = APPLY_URL;
    } else {
      setLocation("/signup");
    }
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting.current) return;
    submitting.current = true;

    const formData = new FormData(e.currentTarget);
    const payload: Record<string, string> = { campaign };
    formData.forEach((value, key) => {
      const v = String(value).trim();
      if (v) payload[key] = v;
    });
    if (agentRef.current) payload.agent_ref = agentRef.current;
    if (tierInterest.current) payload.tier_interest = tierInterest.current;

    try {
      await Promise.race([
        apiRequest("POST", api.public.landingLead.path, payload),
        new Promise((resolve) => setTimeout(resolve, 1500)),
      ]);
    } catch {
      // Best effort: never block the visitor on a failed/slow save.
    }

    redirect();
  }

  // Secondary CTAs lower on the page run the exact same flow as the hero form:
  // requestSubmit triggers native validation, then onSubmit fires when valid.
  function triggerSubmit() {
    formRef.current?.requestSubmit();
  }

  // Pricing CTAs record the chosen tier and scroll the visitor up to the form.
  function selectTier(tier: string) {
    tierInterest.current = tier;
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    const firstField = formRef.current?.querySelector<HTMLInputElement>("input, select");
    if (firstField) window.setTimeout(() => firstField.focus(), 400);
  }

  return { formRef, onSubmit, triggerSubmit, selectTier, submitted };
}

/**
 * Confirmation card shown in place of the lead form after a successful submit
 * on "book a walkthrough" merchant pages.
 */
export function LeadThanks({ title, message }: { title: string; message: string }) {
  return (
    <div className="form-card lead-thanks" data-testid="lead-thanks">
      <div className="fc-eyebrow">● Request received</div>
      <h2>{title}</h2>
      <p className="fc-sub">{message}</p>
      <div className="lead-thanks-check" aria-hidden="true">
        <CheckIcon strokeWidth={2.6} />
      </div>
      <p className="fc-fine">A LeaderShield advisor will reach out shortly to book your walkthrough.</p>
    </div>
  );
}

/**
 * Attribution banner. When the visitor arrives via an agent's shared link
 * (?ref=CODE), this resolves the advisor's name and shows a personalized bar.
 * Invalid or missing codes render nothing.
 */
export function AgentBar() {
  const [name, setName] = useState<string | null>(null);

  useEffect(() => {
    const code = getAgentRef();
    if (!code) return;
    let active = true;
    fetch(api.public.advisor.path.replace(":code", encodeURIComponent(code)))
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (active && data?.found) setName(typeof data.name === "string" ? data.name : "");
      })
      .catch(() => {
        // Best effort: a failed lookup simply shows no banner.
      });
    return () => {
      active = false;
    };
  }, []);

  if (name === null) return null;

  return (
    <div className="agentbar show" data-testid="bar-agent-attribution">
      {name
        ? `Shared with you by ${name}, your LeaderShield advisor`
        : "Shared with you by your LeaderShield advisor"}
    </div>
  );
}


export function ShieldLogo() {
  return (
    <svg viewBox="0 0 38 42" fill="none" aria-hidden="true">
      <path
        d="M19 1.5 35.5 7v13c0 11-7.4 17.6-16.5 20.8C9.9 37.6 2.5 31 2.5 20V7L19 1.5Z"
        fill="#142943"
        stroke="#C9A24B"
        strokeWidth="1.6"
      />
      <path
        d="M19 11v18M11.5 17.5 19 11l7.5 6.5"
        stroke="#C9A24B"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function CheckIcon({ strokeWidth = 2.2 }: { strokeWidth?: number }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} aria-hidden="true">
      <path d="M5 13l4 4L19 7" />
    </svg>
  );
}

export function ArrowIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} aria-hidden="true">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

export function LpHeader({ safe, partner = false }: { safe: React.ReactNode; partner?: boolean }) {
  return (
    <header>
      <div className="wrap nav">
        <Link href="/" className="brand" data-testid="link-brand-home">
          <ShieldLogo />
          <span className="word">
            <b>Leader</b>
            <span>Shield</span>
            {partner && <small>Partner Network</small>}
          </span>
        </Link>
        <span className="safe">{safe}</span>
      </div>
    </header>
  );
}

export function LpFooter({ disclosure }: { disclosure: React.ReactNode }) {
  return (
    <footer>
      <div className="wrap">
        <p>{disclosure}</p>
        <p>
          © 2026 LeaderShield Funding. All rights reserved. ·{" "}
          <Link href="/privacy" data-testid="link-footer-privacy">Privacy</Link> ·{" "}
          <Link href="/terms" data-testid="link-footer-terms">Terms</Link> · Disclosures
        </p>
      </div>
    </footer>
  );
}
