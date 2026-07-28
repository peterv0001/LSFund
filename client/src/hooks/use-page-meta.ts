import { useEffect } from "react";

const DEFAULT_TITLE = "LeaderShield Funding";
const DEFAULT_OG_IMAGE = "https://leadershieldfunding.com/og-image.png";

function setMetaContent(selector: string, content: string): string | null {
  const el = document.querySelector<HTMLMetaElement>(selector);
  if (!el) return null;
  const prev = el.getAttribute("content");
  el.setAttribute("content", content);
  return prev;
}

function setCanonical(href: string): string | null {
  let el = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!el) return null;
  const prev = el.getAttribute("href");
  el.setAttribute("href", href);
  return prev;
}

export function usePageMeta(title: string, description: string) {
  useEffect(() => {
    const prevTitle = document.title;
    document.title = title;

    // Use the clean pathname (no query params) as the canonical URL so that
    // referral/tracking parameters like ?ref= don't fragment link equity.
    const canonicalUrl = `${window.location.origin}${window.location.pathname}`;
    const ogUrl = window.location.href;

    const prevDesc = setMetaContent('meta[name="description"]', description);
    const prevOgTitle = setMetaContent('meta[property="og:title"]', title);
    const prevOgDesc = setMetaContent('meta[property="og:description"]', description);
    const prevOgUrl = setMetaContent('meta[property="og:url"]', ogUrl);
    const prevTwTitle = setMetaContent('meta[name="twitter:title"]', title);
    const prevTwDesc = setMetaContent('meta[name="twitter:description"]', description);
    const prevCanonical = setCanonical(canonicalUrl);

    return () => {
      document.title = prevTitle;
      if (prevDesc !== null) setMetaContent('meta[name="description"]', prevDesc);
      if (prevOgTitle !== null) setMetaContent('meta[property="og:title"]', prevOgTitle);
      if (prevOgDesc !== null) setMetaContent('meta[property="og:description"]', prevOgDesc);
      if (prevOgUrl !== null) setMetaContent('meta[property="og:url"]', prevOgUrl);
      if (prevTwTitle !== null) setMetaContent('meta[name="twitter:title"]', prevTwTitle);
      if (prevTwDesc !== null) setMetaContent('meta[name="twitter:description"]', prevTwDesc);
      if (prevCanonical !== null) setCanonical(prevCanonical);
    };
  }, [title, description]);
}

export { DEFAULT_TITLE, DEFAULT_OG_IMAGE };
