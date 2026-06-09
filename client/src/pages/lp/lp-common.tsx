import { useEffect, useRef } from "react";
import { Link, useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { api } from "@shared/routes";
import "./landing-pages.css";

export const APPLY_URL = "https://apply.myrmapp.com/multi-step-apply/pg";

type Destination = "apply" | "signup";

/**
 * Handles the "save lead, then send the visitor onward" flow shared by every
 * landing page. The save is best-effort and time-boxed so the redirect always
 * feels instant even if the network is slow.
 */
export function useLandingForm(campaign: string, destination: Destination) {
  const [, setLocation] = useLocation();
  const formRef = useRef<HTMLFormElement>(null);
  const submitting = useRef(false);

  function redirect() {
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

  return { formRef, onSubmit, triggerSubmit };
}

/** Sets the document title and meta description for the duration of the page. */
export function usePageMeta(title: string, description: string) {
  useEffect(() => {
    const previousTitle = document.title;
    document.title = title;

    let meta = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    let created = false;
    if (!meta) {
      meta = document.createElement("meta");
      meta.name = "description";
      document.head.appendChild(meta);
      created = true;
    }
    const previousDescription = meta.getAttribute("content");
    meta.setAttribute("content", description);

    return () => {
      document.title = previousTitle;
      if (created) {
        meta?.remove();
      } else if (previousDescription !== null) {
        meta?.setAttribute("content", previousDescription);
      }
    };
  }, [title, description]);
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
          © 2026 Leader Shield Funding. All rights reserved. ·{" "}
          <Link href="/privacy" data-testid="link-footer-privacy">Privacy</Link> ·{" "}
          <Link href="/terms" data-testid="link-footer-terms">Terms</Link> · Disclosures
        </p>
      </div>
    </footer>
  );
}
