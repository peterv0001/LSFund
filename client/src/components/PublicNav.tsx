import { useEffect, useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { BrandLockup } from "@/components/BrandMark";

const NAV_LINKS = [
  { href: "/funding", label: "Funding" },
  { href: "/platform", label: "Platform" },
  { href: "/opportunity", label: "Opportunity" },
  { href: "/commissions", label: "Commissions" },
];

/**
 * Shared public marketing navigation. Links point to the focused section pages.
 * On pages with a dark hero (`onDarkHero`, default), the bar starts transparent
 * over the hero and turns solid once the user scrolls past it.
 */
export function PublicNav({ onDarkHero = true }: { onDarkHero?: boolean }) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    handleScroll();
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const solid = scrolled || !onDarkHero;

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        solid
          ? "bg-background/95 backdrop-blur-xl shadow-sm border-b border-border"
          : "bg-transparent"
      }`}
      data-testid="public-nav"
    >
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link href="/" data-testid="link-logo-nav" className="hover:opacity-90 transition-opacity">
          <BrandLockup size="md" onDark={!solid} />
        </Link>

        <div className="hidden md:flex items-center gap-8">
          {NAV_LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              data-testid={`nav-link-${l.label.toLowerCase()}`}
              className={`text-sm font-medium transition-colors ${
                solid ? "text-muted-foreground hover:text-primary" : "text-white/70 hover:text-white"
              }`}
            >
              {l.label}
            </Link>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <Link href="/login">
            <Button
              variant="ghost"
              size="sm"
              className={solid ? "" : "text-white hover:bg-white/10 hover:text-white"}
              data-testid="button-login"
            >
              Agent Login
            </Button>
          </Link>
          <a
            href="https://apply.myrmapp.com/multi-step-apply/pg"
            target="_blank"
            rel="noopener noreferrer"
            data-testid="link-apply-now"
          >
            <Button
              variant="outline"
              size="sm"
              className={solid ? "" : "border-white/30 bg-transparent text-white hover:bg-white/10 hover:text-white"}
            >
              Apply Now
            </Button>
          </a>
          <Link href="/signup">
            <Button
              size="sm"
              className={
                solid
                  ? "font-semibold shadow-md"
                  : "bg-white text-primary font-semibold hover:bg-white/90 shadow-md"
              }
              data-testid="button-join"
            >
              Join Now
            </Button>
          </Link>
        </div>
      </div>
    </nav>
  );
}
