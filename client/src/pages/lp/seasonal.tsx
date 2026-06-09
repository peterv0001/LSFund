import { ArrowIcon, CheckIcon, LpFooter, LpHeader, useLandingForm, usePageMeta } from "./lp-common";

export default function LpSeasonal() {
  usePageMeta(
    "Stock the season before the season. — Leader Shield Funding",
    "Get the Seasonal Capital Calendar: when to secure inventory and staffing capital ahead of your peak — retail, e-commerce, restaurants, and trades.",
  );
  const { formRef, onSubmit, triggerSubmit } = useLandingForm("lp-merchant-seasonal", "apply");

  return (
    <div className="lp-page" data-testid="page-lp-seasonal">
      <LpHeader
        safe={
          <>
            <CheckIcon strokeWidth={2.4} /> No credit impact to check
          </>
        }
      />

      <section className="hero">
        <div className="wrap">
          <div>
            <span className="eyebrow">
              <span className="dot" /> Free planning calendar
            </span>
            <h1>
              Stock the season <em>before</em> the season.
            </h1>
            <p className="sub">
              Your peak doesn't fail in November — it fails in <b>August</b>, when the inventory wasn't
              ordered and the staff wasn't hired. The Seasonal Capital Calendar maps exactly when to secure
              capital ahead of your busy months.
            </p>
            <div className="timeline" aria-label="Illustrative seasonal timeline">
              <div className="k">The peak-season runway (illustrative)</div>
              <div className="tl-row">
                <span className="when">T−90 days</span>
                <span className="bar">
                  <i />
                </span>
                <span className="what">Secure capital</span>
              </div>
              <div className="tl-row">
                <span className="when">T−60 days</span>
                <span className="bar">
                  <i />
                </span>
                <span className="what">Order inventory</span>
              </div>
              <div className="tl-row">
                <span className="when">T−30 days</span>
                <span className="bar">
                  <i />
                </span>
                <span className="what">Hire &amp; market</span>
              </div>
              <div className="tl-row">
                <span className="when" style={{ color: "var(--green-2)" }}>
                  Peak
                </span>
                <span className="bar">
                  <i />
                </span>
                <span className="what" style={{ color: "#fff", fontWeight: 600 }}>
                  Sell through
                </span>
              </div>
            </div>
          </div>

          <form ref={formRef} className="form-card" onSubmit={onSubmit} data-testid="form-lead">
            <div className="fc-eyebrow">● Free instant download</div>
            <h2>The Seasonal Capital Calendar</h2>
            <p className="fc-sub">
              A month-by-month plan for retail, e-commerce, restaurants, and trades. Sent immediately.
            </p>
            <div className="field">
              <label htmlFor="n4">First name</label>
              <input id="n4" name="name" required autoComplete="given-name" data-testid="input-name" />
            </div>
            <div className="field">
              <label htmlFor="e4">Business email</label>
              <input id="e4" name="email" type="email" required autoComplete="email" data-testid="input-email" />
            </div>
            <div className="field">
              <label htmlFor="ind">Your business type</label>
              <select id="ind" name="industry" required defaultValue="" data-testid="select-industry">
                <option value="">Select</option>
                <option>Retail / brick-and-mortar</option>
                <option>E-commerce</option>
                <option>Restaurant / hospitality</option>
                <option>Trades / services</option>
                <option>Other</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="pk">When is your peak season?</label>
              <select id="pk" name="peak" required defaultValue="" data-testid="select-peak">
                <option value="">Select</option>
                <option>Q4 / holidays</option>
                <option>Summer</option>
                <option>Spring</option>
                <option>Winter</option>
                <option>Multiple peaks</option>
              </select>
            </div>
            <button className="btn btn-primary" type="submit" data-testid="button-submit-lead">
              Send me the calendar <ArrowIcon />
            </button>
            <p className="fc-fine">No obligation, no credit impact. Unsubscribe anytime.</p>
          </form>
        </div>
      </section>

      <section className="section">
        <div className="wrap">
          <div className="sec-head">
            <span className="eyebrow on-light">
              <span className="dot" /> What's inside
            </span>
            <h2>Peak season is won 90 days early.</h2>
            <p>The calendar works backward from your busiest month and tells you what to lock in, and when.</p>
          </div>
          <div className="inside">
            <div className="icard">
              <div className="n">T−90</div>
              <h3>The capital window</h3>
              <p>
                Why securing funding three months out gets better structure than scrambling at T−30 — and
                what underwriters look for in seasonal statements.
              </p>
            </div>
            <div className="icard">
              <div className="n">T−60</div>
              <h3>The inventory order</h3>
              <p>
                Sizing the buy to last season's sell-through plus growth, supplier deposit timing, and the
                margin math on early-order discounts.
              </p>
            </div>
            <div className="icard">
              <div className="n">T−30</div>
              <h3>Staffing &amp; demand</h3>
              <p>
                Hiring ramps, training cost, and the marketing spend that fills the season — timed so payroll
                never collides with the inventory bill.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="proof">
        <div className="wrap">
          <div>
            <span className="eyebrow">
              <span className="dot" /> Why Leader Shield
            </span>
            <h2>Capital that respects the calendar.</h2>
            <p>
              Seasonal businesses live and die on timing. We fund in as little as one business day, structure
              remittance around <b>your revenue rhythm</b> — daily, weekly, bi-weekly, or monthly — and show
              the total cost before you sign, so the season's margin math is done in the open.
            </p>
          </div>
          <div className="well">
            <div className="k">Funding range</div>
            <div className="big">$2K–$2M</div>
            <div className="s">6+ months in business · $10K+ monthly revenue</div>
            <div className="div" />
            <div className="k">Remittance</div>
            <div className="big" style={{ fontSize: "clamp(1.5rem,3vw,2rem)" }}>
              Fits your rhythm
            </div>
            <div className="s">Daily, weekly, bi-weekly, or monthly options</div>
          </div>
        </div>
      </section>

      <section className="section final on-paper">
        <div className="wrap">
          <span className="eyebrow on-light">
            <span className="dot" /> Free instant download
          </span>
          <h2>Your peak is closer than it looks.</h2>
          <p>Get the calendar, count back 90 days, and see exactly what this month should be doing for next season.</p>
          <button type="button" className="btn btn-primary" onClick={triggerSubmit} data-testid="button-cta-secondary">
            Send me the calendar
          </button>
        </div>
      </section>

      <LpFooter
        disclosure={
          <>
            <b>Funding terms disclosure.</b> Merchant cash advance funding is the purchase of future
            receivables and is not a traditional APR-based loan. Program terms, pricing, factor rates,
            documentation, funding availability, and eligibility are subject to underwriting review and vary
            by business profile. Timelines and figures shown are illustrative only and not a guarantee of
            approval, timing, or outcomes. Submitting this form does not affect your credit and does not
            constitute an application for funding.
          </>
        }
      />
    </div>
  );
}
