import {
  AgentBar,
  ArrowIcon,
  CheckIcon,
  LeadThanks,
  LpFooter,
  LpHeader,
  useLandingForm,
  useLandingView,
  usePageMeta,
} from "./lp-common";

function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} aria-hidden="true">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export default function LpPlatform() {
  usePageMeta(
    "Your marketing department. Run by AI. — Leader Shield Merchant Growth Platform",
    "The Merchant Growth Platform is a fully AI-native marketing and sales engine: brand intelligence, AI CRM, lead generation, outreach, social content, and AI-managed ads — from $149/mo.",
  );
  const { formRef, onSubmit, triggerSubmit, selectTier, submitted } = useLandingForm(
    "lp-platform-overview",
    "thanks",
  );
  useLandingView("platform");

  return (
    <div className="lp-page" data-testid="page-lp-platform">
      <LpHeader safe={<>Powered by Marketing Titan + Lead Titan</>} />
      <AgentBar />

      <section className="hero">
        <div className="wrap">
          <div>
            <span className="eyebrow">
              <span className="dot" /> The Merchant Growth Platform
            </span>
            <h1>
              Your marketing department. <em>Run by AI.</em>
            </h1>
            <p className="sub">
              One platform that learns your brand, captures every lead, follows up automatically,
              publishes your social, and even makes the calls — <b>without adding a single hire</b>.
            </p>
            <ul className="ticks">
              <li>
                <CheckIcon /> AI Brand Intelligence learns your products, voice, audience, and SEO position
              </li>
              <li>
                <CheckIcon /> AI CRM + 24/7 chatbot so no inbound lead ever slips through
              </li>
              <li>
                <CheckIcon /> Verified lead generation, automated outreach, social publishing, and AI-managed ads
              </li>
            </ul>
          </div>

          {submitted ? (
            <LeadThanks
              title="Your walkthrough is booked"
              message="We have your details. A Leader Shield advisor will reach out to set up your free growth walkthrough using your actual brand and market."
            />
          ) : (
            <form ref={formRef} className="form-card" onSubmit={onSubmit} data-testid="form-lead">
              <div className="fc-eyebrow">● Free growth walkthrough</div>
              <h2>See it running on your business</h2>
              <p className="fc-sub">
                A 20-minute walkthrough using your actual brand, your market, and your leads — not a
                canned demo.
              </p>
              <div className="field">
                <label htmlFor="bn">Business name</label>
                <input id="bn" name="business" required autoComplete="organization" data-testid="input-business" />
              </div>
              <div className="field">
                <label htmlFor="nm">Your name</label>
                <input id="nm" name="name" required autoComplete="name" data-testid="input-name" />
              </div>
              <div className="field">
                <label htmlFor="em">Email</label>
                <input id="em" name="email" type="email" required autoComplete="email" data-testid="input-email" />
              </div>
              <div className="field">
                <label htmlFor="gl">Biggest growth bottleneck right now</label>
                <select id="gl" name="bottleneck" required defaultValue="" data-testid="select-bottleneck">
                  <option value="">Select</option>
                  <option>Not enough leads coming in</option>
                  <option>Leads come in but slip away</option>
                  <option>No time for marketing at all</option>
                  <option>Ads aren't paying back</option>
                  <option>All of the above</option>
                </select>
              </div>
              <button className="btn btn-primary" type="submit" data-testid="button-submit-lead">
                Book my free walkthrough <ArrowIcon />
              </button>
              <p className="fc-fine">
                No obligation. Month-to-month plans — no long-term contract required.
              </p>
            </form>
          )}
        </div>
      </section>

      <section className="section" id="plans">
        <div className="wrap">
          <div className="sec-head">
            <span className="eyebrow on-light">
              <span className="dot" /> Four plans, one engine
            </span>
            <h2>Start where your business is. Scale when it's working.</h2>
            <p>
              Every plan runs on the same AI engine. The difference is how much of your marketing and
              sales it takes off your plate.
            </p>
          </div>
          <div className="tiers">
            <div className="tier">
              <h3 className="tname">Starter</h3>
              <div className="trole">Lead generation</div>
              <div className="price mono">
                $149<small>/mo</small>
              </div>
              <p className="pitch">
                Fill the pipeline first. Verified leads and automated outreach, working with the CRM
                you already use.
              </p>
              <ul>
                <li>
                  <CheckIcon strokeWidth={2.4} /> 750 verified lead credits / mo
                </li>
                <li>
                  <CheckIcon strokeWidth={2.4} /> 5 outreach sequences · 1,500 sends / mo
                </li>
                <li>
                  <CheckIcon strokeWidth={2.4} /> Basic brand intelligence
                </li>
                <li>
                  <CheckIcon strokeWidth={2.4} /> Integrates with your existing CRM
                </li>
              </ul>
              <button
                type="button"
                className="btn btn-dark"
                onClick={() => selectTier("Starter")}
                data-testid="button-tier-starter"
              >
                Ask about Starter
              </button>
            </div>

            <div className="tier">
              <h3 className="tname">Growth Foundation</h3>
              <div className="trole">Visibility &amp; stability</div>
              <div className="price mono">
                $397<small>/mo</small>
              </div>
              <p className="pitch">
                Stop leaking the opportunities you already have. The organized, responsive foundation.
              </p>
              <ul>
                <li className="plus">
                  <PlusIcon /> Native AI CRM — 1,000 contacts + scoring
                </li>
                <li>
                  <CheckIcon strokeWidth={2.4} /> Advanced brand, product &amp; SEO intelligence
                </li>
                <li>
                  <CheckIcon strokeWidth={2.4} /> 24/7 AI chatbot lead capture
                </li>
                <li>
                  <CheckIcon strokeWidth={2.4} /> AI visual email — designed, not plain text
                </li>
                <li>
                  <CheckIcon strokeWidth={2.4} /> Performance dashboard
                </li>
              </ul>
              <button
                type="button"
                className="btn btn-dark"
                onClick={() => selectTier("Growth Foundation")}
                data-testid="button-tier-foundation"
              >
                Start with Foundation
              </button>
            </div>

            <div className="tier pop">
              <span className="flag">Most popular</span>
              <h3 className="tname">Revenue Growth System</h3>
              <div className="trole">Revenue growth &amp; optimization</div>
              <div className="price mono">
                $697<small>/mo</small>
              </div>
              <p className="pitch">
                The active engine. New leads in, automated follow-up out, and an AI Chief of Staff
                running the board.
              </p>
              <ul>
                <li className="plus">
                  <PlusIcon /> Everything in Foundation, plus:
                </li>
                <li>
                  <CheckIcon strokeWidth={2.4} /> 2,000 verified lead credits / mo
                </li>
                <li>
                  <CheckIcon strokeWidth={2.4} /> Automated sequences + lead-capture forms
                </li>
                <li>
                  <CheckIcon strokeWidth={2.4} /> Darwin — AI Chief of Staff executes tasks
                </li>
                <li>
                  <CheckIcon strokeWidth={2.4} /> AI social — Meta, 30 posts / mo
                </li>
                <li>
                  <CheckIcon strokeWidth={2.4} /> Ask AI + insights &amp; recommendations
                </li>
                <li>
                  <CheckIcon strokeWidth={2.4} /> 10,000-contact CRM + automation
                </li>
              </ul>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => selectTier("Revenue Growth System")}
                data-testid="button-tier-growth"
              >
                Book a walkthrough
              </button>
            </div>

            <div className="tier">
              <span className="flag best">Best value</span>
              <h3 className="tname">Revenue Scale AI</h3>
              <div className="trole">AI-driven scale &amp; optimization</div>
              <div className="price mono">
                $1,497<small>/mo</small>
              </div>
              <p className="pitch">
                The full AI marketing-and-sales department — calls, ads, content — for scaling without
                headcount.
              </p>
              <ul>
                <li className="plus">
                  <PlusIcon /> Everything in Growth System, plus:
                </li>
                <li>
                  <CheckIcon strokeWidth={2.4} /> AI Caller — 750 min / mo, books meetings
                </li>
                <li>
                  <CheckIcon strokeWidth={2.4} /> AI paid ads — search, social, display
                </li>
                <li>
                  <CheckIcon strokeWidth={2.4} /> AI ad designer + ad insights
                </li>
                <li>
                  <CheckIcon strokeWidth={2.4} /> Social: Meta + LinkedIn + X · 100 / mo
                </li>
                <li>
                  <CheckIcon strokeWidth={2.4} /> AI blogs (10/mo) + template library
                </li>
                <li>
                  <CheckIcon strokeWidth={2.4} /> 25,000-contact CRM + 3,000 lead credits
                </li>
              </ul>
              <button
                type="button"
                className="btn btn-dark"
                onClick={() => selectTier("Revenue Scale AI")}
                data-testid="button-tier-scale"
              >
                Book a walkthrough
              </button>
            </div>
          </div>
          <p className="tier-note">
            Lead generation is credit-based (1 credit per base lead; +1 email, +1.5 phone
            verification). Usage beyond included pools bills as overage. Guided onboarding available
            as a one-time add-on ($1,250) on Revenue Growth System and Revenue Scale AI.
          </p>
        </div>
      </section>

      <section className="pillars">
        <div className="wrap">
          <div className="sec-head">
            <span className="eyebrow">
              <span className="dot" /> What the engine does
            </span>
            <h2>It learns your business first. Then it goes to work.</h2>
            <p>
              Most tools hand you software. This platform starts by building intelligence on your
              brand — then runs the marketing with it.
            </p>
          </div>
          <div className="pgrid">
            <div className="pcard">
              <div className="ic">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                  <circle cx="12" cy="12" r="3" />
                  <path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2" />
                </svg>
              </div>
              <h3>Brand intelligence</h3>
              <p>
                The AI learns your logos, voice, products, services, audience personas, and SEO
                position — so everything it produces sounds like you, not a template.
              </p>
            </div>
            <div className="pcard">
              <div className="ic">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                  <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5Z" />
                </svg>
              </div>
              <h3>Never miss a lead</h3>
              <p>
                A 24/7 AI chatbot captures and qualifies every inbound inquiry into the AI CRM, where
                scoring and automation keep follow-up running while you run the business.
              </p>
            </div>
            <div className="pcard">
              <div className="ic">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                  <path d="M16 11a4 4 0 1 0-3.5-6M8 11a4 4 0 1 1 3.5-6M2 21v-1a5 5 0 0 1 5-5h2M22 21v-1a5 5 0 0 0-5-5h-2" />
                </svg>
              </div>
              <h3>Fresh prospects, weekly</h3>
              <p>
                Real-time verified lead generation feeds the pipeline, and automated outreach
                sequences work it — emails designed, sent, and followed up without your time.
              </p>
            </div>
            <div className="pcard">
              <div className="ic">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                  <rect x="3" y="4" width="18" height="14" rx="2" />
                  <path d="M8 21h8M12 18v3" />
                </svg>
              </div>
              <h3>Content that ships itself</h3>
              <p>
                AI social posts published straight to your channels, professionally designed visual
                emails, and — on Scale — AI blogs and a full template library.
              </p>
            </div>
            <div className="pcard">
              <div className="ic">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92Z" />
                </svg>
              </div>
              <h3>An AI that makes the calls</h3>
              <p>
                On Revenue Scale AI, the AI Caller runs outbound — qualifying interest and booking
                meetings onto your calendar, 750 minutes a month.
              </p>
            </div>
            <div className="pcard">
              <div className="ic">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                  <path d="M3 3v18h18" />
                  <path d="M7 14l4-4 3 3 5-6" />
                </svg>
              </div>
              <h3>A chief of staff, included</h3>
              <p>
                Darwin executes tasks across the platform on your behalf, Ask AI answers any business
                question on demand, and insights tell you what to do next — not just what happened.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="capital">
        <div className="wrap">
          <div className="l">
            <span className="ic">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                <path d="M12 1v22M5 5h11a3 3 0 0 1 0 6H8a3 3 0 0 0 0 6h11" />
              </svg>
            </span>
            <div>
              <h3>Need capital to fund the growth?</h3>
              <p>
                Leader Shield also funds U.S. businesses $2K–$2M, with the total cost shown before you
                sign. Ask your advisor about pairing capital with the platform.
              </p>
            </div>
          </div>
          <button
            type="button"
            className="btn btn-dark"
            onClick={() => selectTier("Capital + Platform")}
            data-testid="button-capital"
          >
            Ask about funding
          </button>
        </div>
      </section>

      <section className="section final on-ink">
        <div className="wrap">
          <span className="eyebrow">
            <span className="dot" /> Free growth walkthrough
          </span>
          <h2>See the platform run on your business — before you spend a dollar.</h2>
          <p>
            Twenty minutes. Your brand, your market, your leads. If it doesn't fit, you'll know fast —
            and so will we.
          </p>
          <button type="button" className="btn btn-primary" onClick={triggerSubmit} data-testid="button-cta-secondary">
            Book my free walkthrough
          </button>
        </div>
      </section>

      <LpFooter
        disclosure={
          <>
            <b>Platform disclosure.</b> The Merchant Growth Platform is powered by Marketing Titan +
            Lead Titan. Features, capacities, lead-credit pools, and pricing are subject to change and
            governed by the platform subscription agreement. Lead generation is credit-based and
            flexes with verification depth; usage beyond included pools is billed as overage.
            Marketing outcomes vary by business, market, and effort; no specific results are
            guaranteed. Merchant cash advance funding, where referenced, is the purchase of future
            receivables, is not a traditional APR-based loan, and is subject to underwriting review.
          </>
        }
      />
    </div>
  );
}
