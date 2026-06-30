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

export function usePageMeta(title: string, description: string) {
  useEffect(() => {
    const prevTitle = document.title;
    document.title = title;

    const url = window.location.href;

    const prevDesc = setMetaContent('meta[name="description"]', description);
    const prevOgTitle = setMetaContent('meta[property="og:title"]', title);
    const prevOgDesc = setMetaContent('meta[property="og:description"]', description);
    const prevOgUrl = setMetaContent('meta[property="og:url"]', url);
    const prevTwTitle = setMetaContent('meta[name="twitter:title"]', title);
    const prevTwDesc = setMetaContent('meta[name="twitter:description"]', description);

    return () => {
      document.title = prevTitle;
      if (prevDesc !== null) setMetaContent('meta[name="description"]', prevDesc);
      if (prevOgTitle !== null) setMetaContent('meta[property="og:title"]', prevOgTitle);
      if (prevOgDesc !== null) setMetaContent('meta[property="og:description"]', prevOgDesc);
      if (prevOgUrl !== null) setMetaContent('meta[property="og:url"]', prevOgUrl);
      if (prevTwTitle !== null) setMetaContent('meta[name="twitter:title"]', prevTwTitle);
      if (prevTwDesc !== null) setMetaContent('meta[name="twitter:description"]', prevTwDesc);
    };
  }, [title, description]);
}

export { DEFAULT_TITLE, DEFAULT_OG_IMAGE };
