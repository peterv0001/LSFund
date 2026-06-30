import { Link } from "wouter";
import { BrandLockup } from "@/components/BrandMark";

/** Shared public marketing footer shown on the home page and all section pages. */
export function PublicFooter() {
  return (
    <footer className="py-16 px-6 bg-[#0A1628] text-white">
      <div className="max-w-7xl mx-auto">
        <div className="grid md:grid-cols-6 gap-10 mb-12">
          <div className="md:col-span-2">
            <Link href="/" data-testid="link-logo-footer" className="mb-4 hover:opacity-90 transition-opacity w-fit block">
              <BrandLockup size="md" onDark />
            </Link>
            <p className="text-white/40 max-w-sm leading-relaxed">
              Fast funding. Minimal paperwork. Flexible options. Full-service execution. Unsecured working capital for
              business owners — and a network built to reward those who refer it.
            </p>
          </div>
          <div>
            <h4 className="font-bold text-white/80 mb-4">Explore</h4>
            <div className="space-y-2 text-sm">
              <Link href="/funding"><span className="block text-white/40 hover:text-white transition-colors cursor-pointer" data-testid="footer-link-funding">Funding</span></Link>
              <Link href="/platform"><span className="block text-white/40 hover:text-white transition-colors cursor-pointer" data-testid="footer-link-platform">Platform</span></Link>
              <Link href="/opportunity"><span className="block text-white/40 hover:text-white transition-colors cursor-pointer" data-testid="footer-link-opportunity">Opportunity</span></Link>
              <Link href="/commissions"><span className="block text-white/40 hover:text-white transition-colors cursor-pointer" data-testid="footer-link-commissions">Commissions</span></Link>
            </div>
          </div>
          <div>
            <h4 className="font-bold text-white/80 mb-4">Funding Solutions</h4>
            <div className="space-y-2 text-sm">
              <Link href="/lp/declined"><span className="block text-white/40 hover:text-white transition-colors cursor-pointer" data-testid="footer-link-lp-declined">Declined by the Bank</span></Link>
              <Link href="/lp/consolidation"><span className="block text-white/40 hover:text-white transition-colors cursor-pointer" data-testid="footer-link-lp-consolidation">Consolidate Advances</span></Link>
              <Link href="/lp/growth"><span className="block text-white/40 hover:text-white transition-colors cursor-pointer" data-testid="footer-link-lp-growth">Capital for Growth</span></Link>
              <Link href="/lp/seasonal"><span className="block text-white/40 hover:text-white transition-colors cursor-pointer" data-testid="footer-link-lp-seasonal">Seasonal Funding</span></Link>
              <Link href="/lp/partners"><span className="block text-white/40 hover:text-white transition-colors cursor-pointer" data-testid="footer-link-lp-partners">Partner Network</span></Link>
              <Link href="/lp/referral"><span className="block text-white/40 hover:text-white transition-colors cursor-pointer" data-testid="footer-link-lp-referral">Referral Partners</span></Link>
              <Link href="/lp/platform"><span className="block text-white/40 hover:text-white transition-colors cursor-pointer" data-testid="footer-link-lp-platform">Merchant Growth Platform</span></Link>
              <Link href="/lp/leaks"><span className="block text-white/40 hover:text-white transition-colors cursor-pointer" data-testid="footer-link-lp-leaks">Plug Profit Leaks</span></Link>
              <Link href="/lp/scale"><span className="block text-white/40 hover:text-white transition-colors cursor-pointer" data-testid="footer-link-lp-scale">Scale Operations</span></Link>
            </div>
          </div>
          <div>
            <h4 className="font-bold text-white/80 mb-4">Legal</h4>
            <div className="space-y-2 text-sm">
              <Link href="/income-disclosure"><span className="block text-white/40 hover:text-white transition-colors cursor-pointer" data-testid="footer-link-income-disclosure">Income Disclosure</span></Link>
              <Link href="/terms"><span className="block text-white/40 hover:text-white transition-colors cursor-pointer" data-testid="footer-link-terms">Terms of Service</span></Link>
              <Link href="/privacy"><span className="block text-white/40 hover:text-white transition-colors cursor-pointer" data-testid="footer-link-privacy">Privacy Policy</span></Link>
              <Link href="/refund-policy"><span className="block text-white/40 hover:text-white transition-colors cursor-pointer" data-testid="footer-link-refund">Refund Policy</span></Link>
            </div>
          </div>
          <div>
            <h4 className="font-bold text-white/80 mb-4">Get Started</h4>
            <div className="space-y-2 text-sm">
              <Link href="/signup"><span className="block text-white/40 hover:text-white transition-colors cursor-pointer" data-testid="footer-link-signup">Join Now</span></Link>
              <Link href="/login"><span className="block text-white/40 hover:text-white transition-colors cursor-pointer" data-testid="footer-link-login">Agent Login</span></Link>
            </div>
          </div>
        </div>
        <div className="pt-8 border-t border-white/10 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-sm text-white/30">
            &copy; 2026 LeaderShield&trade;. All rights reserved. LeaderShield Funding is the capital (MCA) arm of LeaderShield&trade;.
          </p>
          <div className="flex flex-wrap items-center justify-center md:justify-end gap-4 text-xs text-white/30">
            <Link href="/income-disclosure"><span className="hover:text-white transition-colors cursor-pointer" data-testid="footer-bottom-income-disclosure">Income Disclosure</span></Link>
            <Link href="/terms"><span className="hover:text-white transition-colors cursor-pointer" data-testid="footer-bottom-terms">Terms</span></Link>
            <Link href="/privacy"><span className="hover:text-white transition-colors cursor-pointer" data-testid="footer-bottom-privacy">Privacy</span></Link>
            <Link href="/refund-policy"><span className="hover:text-white transition-colors cursor-pointer" data-testid="footer-bottom-refund">Refund Policy</span></Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
