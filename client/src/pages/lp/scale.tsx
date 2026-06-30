import {
  AgentBar,
  ArrowIcon,
  LeadThanks,
  LpFooter,
  LpHeader,
  useLandingForm,
  useLandingView,
  usePageMeta,
} from "./lp-common";

export default function LpScale() {
  usePageMeta(
    "Scale the revenue. Skip the headcount. — LeaderShield Growth Platform",
    "Revenue Scale AI is a full AI marketing-and-sales department: an AI Caller that books meetings, AI-managed paid ads, content across Meta, LinkedIn and X — $1,497/mo instead of payroll.",
  );
  const { formRef, onSubmit, triggerSubmit, submitted } = useLandingForm("lp-platform-scale", "thanks");
  useLandingView("scale");

  return (
    <div className="lp-page" data-testid="page-lp-scale">
      <LpHeader safe={<>Powered by Marketing Titan + Lead Titan</>} />
      <AgentBar />

      <section className="hero">
        <div className="wrap">
          <div>
            <span className="eyebrow">
              <span className="dot" /> Revenue Scale AI · $1,497/mo
            </span>
            <h1>
              Scale the revenue. <em>Skip the headcount.</em>
            </h1>
            <p className="sub">
              A marketing hire costs you salary, ramp time, and management. Revenue Scale AI is the{" "}
              <b>whole department</b> — outbound calls, paid ads, content, and follow-up — running from
              day one for less than a part-time wage.
            </p>
            <div className="dept" aria-label="What the department replaces — illustrative">
              <div className="k">What you'd otherwise be hiring (illustrative)</div>
              <div className="dept-row">
                <span>Outbound caller / appointment setter</span>
                <span className="v">AI Caller · 750 min/mo</span>
              </div>
              <div className="dept-row">
                <span>Paid-ads manager + designer</span>
                <span className="v">AI ads · search, social, display</span>
              </div>
              <div className="dept-row">
                <span>Content &amp; social manager</span>
                <span className="v">100 posts + 10 blogs /mo</span>
              </div>
              <div className="dept-row">
                <span>Follow-up &amp; CRM admin</span>
                <span className="v">25K-contact AI CRM</span>
              </div>
              <div className="dept-row total">
                <span>The whole department</span>
                <span className="v">$1,497/mo</span>
              </div>
              <div className="fine">
                Illustrative comparison of functions covered — not a claim of equivalent output to
                specific hires. Ad spend billed separately.
              </div>
            </div>
          </div>

          {submitted ? (
            <LeadThanks
              title="Your scale walkthrough is booked"
              message="We have your details. A LeaderShield advisor will reach out to show the department scripted, branded, and ready to run on your business."
            />
          ) : (
            <form ref={formRef} className="form-card" onSubmit={onSubmit} data-testid="form-lead">
              <div className="fc-eyebrow">● Free scale walkthrough</div>
              <h2>See the department run on your business</h2>
              <p className="fc-sub">
                A 20-minute walkthrough: your brand in the engine, the AI Caller scripted for your
                offer, and the ad strategy it would run.
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
                <label htmlFor="rv">Annual revenue</label>
                <select id="rv" name="revenue" required defaultValue="" data-testid="select-revenue">
                  <option value="">Select a range</option>
                  <option>Under $500K</option>
                  <option>$500K – $1M</option>
                  <option>$1M – $5M</option>
                  <option>$5M+</option>
                </select>
              </div>
              <div className="field">
                <label htmlFor="gw">Where do you want the growth?</label>
                <select id="gw" name="growth_goal" required defaultValue="" data-testid="select-growth-goal">
                  <option value="">Select</option>
                  <option>More booked appointments</option>
                  <option>Profitable paid ads</option>
                  <option>Brand &amp; content presence</option>
                  <option>All three</option>
                </select>
              </div>
              <button className="btn btn-primary" type="submit" data-testid="button-submit-lead">
                Book my scale walkthrough <ArrowIcon />
              </button>
              <p className="fc-fine">No obligation. Month-to-month — no long-term contract required.</p>
            </form>
          )}
        </div>
      </section>

      <section className="section">
        <div className="wrap">
          <div className="sec-head">
            <span className="eyebrow on-light">
              <span className="dot" /> The department, role by role
            </span>
            <h2>Every seat filled. Nobody to manage.</h2>
            <p>
              Each function a growth team needs — staffed by the engine, briefed by your brand
              intelligence, and reporting into one dashboard.
            </p>
          </div>
          <div className="roles">
            <div className="rcard">
              <div className="role">The setter</div>
              <h3>AI Caller books the meetings</h3>
              <p>
                Automated outbound that qualifies interest and puts appointments on your calendar — 750
                minutes a month, with overage when you want more.
              </p>
            </div>
            <div className="rcard">
              <div className="role">The media buyer</div>
              <h3>AI-managed paid ads</h3>
              <p>
                Search, social, and display campaigns built by the AI ad designer, monitored with ad
                insights, and optimized against what's actually converting.
              </p>
            </div>
            <div className="rcard">
              <div className="role">The content team</div>
              <h3>Publishing across three channels</h3>
              <p>
                100 social posts a month across Meta, LinkedIn, and X, plus 10 AI blogs and a full
                template library — all in your voice, from your brand intelligence.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="stack">
        <div className="wrap">
          <div>
            <span className="eyebrow">
              <span className="dot" /> Built on the full engine
            </span>
            <h2>Scale sits on top of everything else.</h2>
            <p>
              Revenue Scale AI includes the complete Revenue Growth System underneath — so the leads
              the department generates are <b>captured, scored, and followed up automatically</b>, not
              dumped into a spreadsheet.
            </p>
          </div>
          <ul className="slist">
            <li>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                <path d="M3 3v18h18" />
                <path d="M7 14l4-4 3 3 5-6" />
              </svg>
              Darwin — AI Chief of Staff executing tasks <span className="mono">included</span>
            </li>
            <li>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                <path d="M16 11a4 4 0 1 0-3.5-6M2 21v-1a5 5 0 0 1 5-5h2" />
              </svg>
              3,000 verified lead credits / month <span className="mono">included</span>
            </li>
            <li>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5Z" />
              </svg>
              24/7 AI chatbot + 25,000-contact CRM <span className="mono">included</span>
            </li>
            <li>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                <circle cx="12" cy="12" r="9" />
                <path d="M12 7v5l3 3" />
              </svg>
              Insights + recommendations, email &amp; chat support <span className="mono">included</span>
            </li>
          </ul>
        </div>
      </section>

      <section className="section final on-paper">
        <div className="wrap">
          <span className="eyebrow on-light">
            <span className="dot" /> Free scale walkthrough
          </span>
          <h2>The department starts the week you do.</h2>
          <p>
            No recruiting, no ramp, no management overhead. See it scripted, branded, and ready to run
            on your business.
          </p>
          <button type="button" className="btn btn-primary" onClick={triggerSubmit} data-testid="button-cta-secondary">
            Book my scale walkthrough
          </button>
        </div>
      </section>

      <LpFooter
        disclosure={
          <>
            <b>Platform disclosure.</b> The Merchant Growth Platform is powered by Marketing Titan +
            Lead Titan. Features, capacities, minutes, lead-credit pools, and pricing are subject to
            change and governed by the platform subscription agreement. Usage beyond included pools
            (lead credits, AI Caller minutes) bills as overage; advertising spend is separate from the
            subscription. The hiring comparison shown is illustrative of functions covered and is not a
            claim of equivalent output to specific employees. Marketing outcomes vary by business,
            market, and effort; no specific results are guaranteed. Guided onboarding is available as a
            one-time add-on.
          </>
        }
      />
    </div>
  );
}
