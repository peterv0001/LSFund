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

function XIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} aria-hidden="true">
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}

export default function LpLeaks() {
  usePageMeta(
    "You don't have a leads problem. You have a leaks problem. — Leader Shield Growth Platform",
    "Missed calls, unanswered chats, leads that never get a follow-up. The Merchant Growth Platform captures every inquiry 24/7 and follows up automatically — from $397/mo.",
  );
  const { formRef, onSubmit, triggerSubmit, submitted } = useLandingForm("lp-platform-leaks", "thanks");
  useLandingView("leaks");

  return (
    <div className="lp-page" data-testid="page-lp-leaks">
      <LpHeader safe={<>Powered by Marketing Titan + Lead Titan</>} />
      <AgentBar />

      <section className="hero">
        <div className="wrap">
          <div>
            <span className="eyebrow">
              <span className="dot" /> For businesses with inbound demand
            </span>
            <h1>
              You don't have a leads problem. You have a <em>leaks</em> problem.
            </h1>
            <p className="sub">
              The call that rang while you were on a job. The website visitor at 9pm with nobody to
              talk to. The quote you never followed up. You already <b>paid</b> for those
              opportunities — the platform just stops losing them.
            </p>
            <div className="leaks" aria-label="Where opportunities leak">
              <div className="k">Where today's opportunities went</div>
              <div className="leak-row bad">
                <XIcon /> After-hours inquiry — nobody answered
              </div>
              <div className="leak-row bad">
                <XIcon /> Quote sent — no follow-up ever went out
              </div>
              <div className="leak-row bad">
                <XIcon /> Past customer — never re-engaged
              </div>
              <div className="leak-row good">
                <CheckIcon strokeWidth={2.4} /> With the platform: captured, scored, followed up —
                automatically
              </div>
            </div>
          </div>

          {submitted ? (
            <LeadThanks
              title="Your leak check is booked"
              message="We have your details. A Leader Shield advisor will reach out to walk through exactly where inquiries slip today — and what capture-and-follow-up looks like running for you."
            />
          ) : (
            <form ref={formRef} className="form-card" onSubmit={onSubmit} data-testid="form-lead">
              <div className="fc-eyebrow">● Free leak check</div>
              <h2>Find out what you're losing</h2>
              <p className="fc-sub">
                A 20-minute walkthrough on your actual business: where inquiries slip today, and what
                capture-and-follow-up would look like running for you.
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
                <label htmlFor="lk">Your biggest leak right now</label>
                <select id="lk" name="leak" required defaultValue="" data-testid="select-leak">
                  <option value="">Select</option>
                  <option>Missed calls / after-hours inquiries</option>
                  <option>No follow-up on quotes &amp; leads</option>
                  <option>Past customers never re-engaged</option>
                  <option>Honestly — all of it</option>
                </select>
              </div>
              <button className="btn btn-primary" type="submit" data-testid="button-submit-lead">
                Book my free leak check <ArrowIcon />
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
              <span className="dot" /> The three leaks
            </span>
            <h2>Every leak has the same fix: a system that never sleeps.</h2>
            <p>
              You can't answer every call, chase every quote, and re-engage every past customer while
              running the business. The AI can.
            </p>
          </div>
          <div className="fixes">
            <div className="fcard">
              <div className="leakname">Leak 01 — The missed inquiry</div>
              <h3>A 24/7 AI receptionist</h3>
              <p>
                The AI chatbot answers, qualifies, and captures every website inquiry — nights,
                weekends, mid-job — straight into your AI CRM with a score attached.
              </p>
            </div>
            <div className="fcard">
              <div className="leakname">Leak 02 — The dead quote</div>
              <h3>Follow-up that runs itself</h3>
              <p>
                Professionally designed AI emails and automated sequences chase every quote and lead
                on schedule — so "I meant to follow up" stops costing you revenue.
              </p>
            </div>
            <div className="fcard">
              <div className="leakname">Leak 03 — The forgotten customer</div>
              <h3>Win-back on autopilot</h3>
              <p>
                Past customers get re-engaged with designed campaigns built from your brand
                intelligence — the cheapest revenue you'll ever recover.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="path">
        <div className="wrap">
          <div className="sec-head">
            <span className="eyebrow">
              <span className="dot" /> Two ways to start
            </span>
            <h2>Plug the leaks. Then turn up the flow.</h2>
            <p>
              Most businesses start by capturing what they already have — then add new lead generation
              once nothing slips through.
            </p>
          </div>
          <div className="plans">
            <div className="plan">
              <h3>Growth Foundation</h3>
              <div className="price mono">
                $397<small>/mo</small>
              </div>
              <ul>
                <li>
                  <CheckIcon strokeWidth={2.4} /> Native AI CRM — 1,000 contacts + lead scoring
                </li>
                <li>
                  <CheckIcon strokeWidth={2.4} /> 24/7 AI chatbot captures every inquiry
                </li>
                <li>
                  <CheckIcon strokeWidth={2.4} /> AI visual email — engagement &amp; win-back
                </li>
                <li>
                  <CheckIcon strokeWidth={2.4} /> Advanced brand, product &amp; SEO intelligence
                </li>
                <li>
                  <CheckIcon strokeWidth={2.4} /> Performance dashboard
                </li>
              </ul>
              <div className="for">For: stopping the leaks on the demand you already have.</div>
            </div>
            <div className="plan pop">
              <span className="flag">Most popular</span>
              <h3>Revenue Growth System</h3>
              <div className="price mono">
                $697<small>/mo</small>
              </div>
              <ul>
                <li>
                  <CheckIcon strokeWidth={2.4} /> Everything in Foundation
                </li>
                <li>
                  <CheckIcon strokeWidth={2.4} /> 2,000 verified lead credits / mo — new prospects in
                </li>
                <li>
                  <CheckIcon strokeWidth={2.4} /> Automated sequences + lead-capture forms
                </li>
                <li>
                  <CheckIcon strokeWidth={2.4} /> Darwin, your AI Chief of Staff, executes tasks
                </li>
                <li>
                  <CheckIcon strokeWidth={2.4} /> AI social to Meta · Ask AI · insights &amp; recs
                </li>
              </ul>
              <div className="for">
                For: leak-proof capture plus a steady flow of new opportunities.
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="section final on-paper">
        <div className="wrap">
          <span className="eyebrow on-light">
            <span className="dot" /> Free leak check
          </span>
          <h2>The next missed call is already on its way.</h2>
          <p>
            Twenty minutes to see exactly where your inquiries slip — and what it looks like when
            nothing does.
          </p>
          <button type="button" className="btn btn-primary" onClick={triggerSubmit} data-testid="button-cta-secondary">
            Book my free leak check
          </button>
        </div>
      </section>

      <LpFooter
        disclosure={
          <>
            <b>Platform disclosure.</b> The Merchant Growth Platform is powered by Marketing Titan +
            Lead Titan. Features, capacities, lead-credit pools, and pricing are subject to change and
            governed by the platform subscription agreement. Marketing outcomes vary by business,
            market, and effort; no specific results are guaranteed.
          </>
        }
      />
    </div>
  );
}
