import { ArrowIcon, LpFooter, LpHeader, useLandingForm, usePageMeta, CheckIcon } from "./lp-common";

export default function LpGrowth() {
  usePageMeta(
    "Growth doesn't wait for the bank. — LeaderShield Funding",
    "Get the Capital ROI Playbook: how operators decide when fast capital beats waiting — with worked examples on inventory turns, marketing payback, and expansion math.",
  );
  const { formRef, onSubmit, triggerSubmit } = useLandingForm("lp-merchant-growth", "apply");

  return (
    <div className="lp-page" data-testid="page-lp-growth">
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
              <span className="dot" /> Free playbook for operators
            </span>
            <h1>
              Growth doesn't wait <em>for the bank.</em>
            </h1>
            <p className="sub">
              A bulk-inventory discount. A marketing channel that's printing. A second location. The
              question isn't whether capital costs money — it's whether the <b>return beats the cost</b>.
              This playbook shows you how operators run that math.
            </p>
            <div className="roi" aria-label="Illustrative ROI frame">
              <div className="k">The operator's question (illustrative)</div>
              <div className="roi-row">
                <span>Capital deployed</span>
                <span className="v">$50,000</span>
              </div>
              <div className="roi-row">
                <span>Cost of capital (1.25 factor)</span>
                <span className="v gold">$12,500</span>
              </div>
              <div className="roi-row">
                <span>Return required to break even</span>
                <span className="v">25%</span>
              </div>
              <div className="roi-row">
                <span>Inventory margin on the buy</span>
                <span className="v green">Your number here</span>
              </div>
              <div className="fine">
                Illustrative frame only — the playbook shows the full worked examples.
              </div>
            </div>
          </div>

          <form ref={formRef} className="form-card" onSubmit={onSubmit} data-testid="form-lead">
            <div className="fc-eyebrow">● Free instant download</div>
            <h2>The Capital ROI Playbook</h2>
            <p className="fc-sub">
              Worked examples on inventory turns, marketing payback, and expansion math. Sent immediately.
            </p>
            <div className="field">
              <label htmlFor="n3">First name</label>
              <input id="n3" name="name" required autoComplete="given-name" data-testid="input-name" />
            </div>
            <div className="field">
              <label htmlFor="e3">Business email</label>
              <input id="e3" name="email" type="email" required autoComplete="email" data-testid="input-email" />
            </div>
            <div className="field">
              <label htmlFor="use">What would you deploy capital into?</label>
              <select id="use" name="use_of_funds" required defaultValue="" data-testid="select-use-of-funds">
                <option value="">Select</option>
                <option>Inventory</option>
                <option>Marketing &amp; customer acquisition</option>
                <option>Equipment</option>
                <option>Expansion / new location</option>
                <option>Payroll / operations</option>
                <option>Other</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="r3">Monthly gross revenue</label>
              <select id="r3" name="revenue" required defaultValue="" data-testid="select-revenue">
                <option value="">Select a range</option>
                <option>$10K – $25K</option>
                <option>$25K – $75K</option>
                <option>$75K – $250K</option>
                <option>$250K+</option>
              </select>
            </div>
            <button className="btn btn-primary" type="submit" data-testid="button-submit-lead">
              Send me the playbook <ArrowIcon />
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
            <h2>The math behind offensive capital.</h2>
            <p>
              Cheap capital you wait 90 days for can lose to expensive capital you deploy this week. The
              playbook shows when — and when not.
            </p>
          </div>
          <div className="inside">
            <div className="icard">
              <div className="n">PLAY 01</div>
              <h3>The inventory turn test</h3>
              <p>
                How to compare a supplier discount or bulk buy against the cost of capital — margin, turn
                rate, and the break-even line.
              </p>
            </div>
            <div className="icard">
              <div className="n">PLAY 02</div>
              <h3>Marketing payback math</h3>
              <p>
                When a channel's payback period justifies funding the spend — and the CAC thresholds where
                it stops making sense.
              </p>
            </div>
            <div className="icard">
              <div className="n">PLAY 03</div>
              <h3>The expansion timing call</h3>
              <p>
                Lease windows, equipment, hiring ramps: how to size the advance to the opportunity, not the
                maximum approval.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="proof">
        <div className="wrap">
          <div>
            <span className="eyebrow">
              <span className="dot" /> Why LeaderShield
            </span>
            <h2>Capital priced in the open, sized to the play.</h2>
            <p>
              Speed matters when an opportunity has a window — but only if you can see the real cost. We show
              the <b>total repayment before you sign</b>, fund in as little as one business day, and
              structure the advance to the opportunity, not the other way around.
            </p>
          </div>
          <div className="well">
            <div className="k">Funding range</div>
            <div className="big">$2K–$2M</div>
            <div className="s">Average funded deal ~$75K · factor 1.15–1.49 shown in full</div>
            <div className="div" />
            <div className="k">Renewal</div>
            <div className="big" style={{ fontSize: "clamp(1.5rem,3vw,2rem)" }}>
              ~50% paid down
            </div>
            <div className="s">Repeat capital for repeat plays — momentum compounds</div>
          </div>
        </div>
      </section>

      <section className="section final on-paper">
        <div className="wrap">
          <span className="eyebrow on-light">
            <span className="dot" /> Free instant download
          </span>
          <h2>Run the math before the window closes.</h2>
          <p>Ten minutes with the playbook tells you whether the opportunity in front of you clears the bar.</p>
          <button type="button" className="btn btn-primary" onClick={triggerSubmit} data-testid="button-cta-secondary">
            Send me the playbook
          </button>
        </div>
      </section>

      <LpFooter
        disclosure={
          <>
            <b>Funding terms disclosure.</b> Merchant cash advance funding is the purchase of future
            receivables and is not a traditional APR-based loan. Program terms, pricing, factor rates,
            documentation, funding availability, and eligibility are subject to underwriting review and vary
            by business profile. ROI frames and figures shown are illustrative only, are not financial
            advice, and are not a guarantee of outcomes. Submitting this form does not affect your credit
            and does not constitute an application for funding.
          </>
        }
      />
    </div>
  );
}
