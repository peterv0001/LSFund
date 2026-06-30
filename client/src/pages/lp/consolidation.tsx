import { ArrowIcon, CheckIcon, LpFooter, LpHeader, useLandingForm, usePageMeta } from "./lp-common";

export default function LpConsolidation() {
  usePageMeta(
    "Too many daily debits? See the math on one payment. — LeaderShield Funding",
    "Get a free consolidation analysis: map every advance you're carrying and see what one structured payment could do for your daily cash flow.",
  );
  const { formRef, onSubmit, triggerSubmit } = useLandingForm("lp-merchant-consolidation", "apply");

  return (
    <div className="lp-page" data-testid="page-lp-consolidation">
      <LpHeader
        safe={
          <>
            <CheckIcon strokeWidth={2.4} /> Confidential · no credit impact
          </>
        }
      />

      <section className="hero">
        <div className="wrap">
          <div>
            <span className="eyebrow">
              <span className="dot" /> Free consolidation analysis
            </span>
            <h1>
              Three advances. Five debits a day. <em>One way out.</em>
            </h1>
            <p className="sub">
              Stacked advances bleed cash flow from both ends. A consolidation review maps{" "}
              <b>everything you're carrying</b> and shows — in real numbers — what one structured payment
              could look like instead.
            </p>
            <div className="beforeafter" aria-label="Illustrative example">
              <div className="ba-row">
                <span>Daily debits today (illustrative)</span>
                <span className="v bad">5 pulls / day</span>
              </div>
              <div className="ba-row">
                <span>After consolidation</span>
                <span className="v good">1 structured payment</span>
              </div>
              <div className="ba-row">
                <span>Visibility on total cost</span>
                <span className="v good">Shown before you sign</span>
              </div>
            </div>
          </div>

          <form ref={formRef} className="form-card" onSubmit={onSubmit} data-testid="form-lead">
            <div className="fc-eyebrow">● Free · confidential · no obligation</div>
            <h2>Get your consolidation analysis</h2>
            <p className="fc-sub">
              We'll map your current obligations and show what one payment could look like. No credit impact
              to find out.
            </p>
            <div className="field">
              <label htmlFor="n2">First name</label>
              <input id="n2" name="name" required autoComplete="given-name" data-testid="input-name" />
            </div>
            <div className="field">
              <label htmlFor="e2">Business email</label>
              <input id="e2" name="email" type="email" required autoComplete="email" data-testid="input-email" />
            </div>
            <div className="field">
              <label htmlFor="adv">Advances currently carrying</label>
              <select id="adv" name="advance_count" required defaultValue="" data-testid="select-advance-count">
                <option value="">Select</option>
                <option>1</option>
                <option>2</option>
                <option>3</option>
                <option>4+</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="r2">Monthly gross revenue</label>
              <select id="r2" name="revenue" required defaultValue="" data-testid="select-revenue">
                <option value="">Select a range</option>
                <option>$10K – $25K</option>
                <option>$25K – $75K</option>
                <option>$75K – $250K</option>
                <option>$250K+</option>
              </select>
            </div>
            <button className="btn btn-primary" type="submit" data-testid="button-submit-lead">
              Run my free analysis <ArrowIcon />
            </button>
            <p className="fc-fine">Reviewed by a funding specialist, not an algorithm. Unsubscribe anytime.</p>
          </form>
        </div>
      </section>

      <section className="section">
        <div className="wrap">
          <div className="sec-head">
            <span className="eyebrow on-light">
              <span className="dot" /> What the analysis covers
            </span>
            <h2>Every obligation, on one page.</h2>
            <p>
              You can't fix cash flow you can't see. The analysis puts the full picture in front of you —
              then shows the alternative.
            </p>
          </div>
          <div className="inside">
            <div className="icard">
              <div className="n">STEP 01</div>
              <h3>Map what you're carrying</h3>
              <p>
                Every advance, balance, factor, and remittance schedule in one view — including the total
                daily and weekly cash drain.
              </p>
            </div>
            <div className="icard">
              <div className="n">STEP 02</div>
              <h3>Model the consolidation</h3>
              <p>
                One structured advance that retires the stack: the full cost shown up front, side by side
                with what you're paying now.
              </p>
            </div>
            <div className="icard">
              <div className="n">STEP 03</div>
              <h3>Decide with real numbers</h3>
              <p>
                If consolidation doesn't improve your position, we'll tell you that too. The analysis is the
                deliverable — not a sales script.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="calm">
        <div className="wrap">
          <div>
            <span className="eyebrow on-light">
              <span className="dot" /> Why LeaderShield
            </span>
            <h2>Built to end the stack, not add to it.</h2>
            <p>
              Stacking is how this category traps businesses. Consolidation is how we're different: one
              advance, one factor, one schedule — with the <b>total repayment shown before you sign</b>.
            </p>
          </div>
          <div>
            <ul className="qlist">
              <li>
                <CheckIcon /> Consolidation is a core program, not an exception — existing advances don't
                disqualify you.
              </li>
              <li>
                <CheckIcon /> Every file is reviewed individually on revenue, obligations, and cash flow.
              </li>
              <li>
                <CheckIcon /> Terms hold where they start: no re-pricing, no surprise fees on top of the
                agreed total.
              </li>
              <li>
                <CheckIcon /> $2K–$2M range, with funding in as little as one business day once approved.
              </li>
            </ul>
          </div>
        </div>
      </section>

      <section className="section final">
        <div className="wrap">
          <span className="eyebrow on-light">
            <span className="dot" /> Free consolidation analysis
          </span>
          <h2>See the math before another debit hits.</h2>
          <p>
            Five minutes of your information. A full picture of your obligations — and the way out, if there
            is one.
          </p>
          <button type="button" className="btn btn-primary" onClick={triggerSubmit} data-testid="button-cta-secondary">
            Run my free analysis
          </button>
        </div>
      </section>

      <LpFooter
        disclosure={
          <>
            <b>Funding terms disclosure.</b> Merchant cash advance funding is the purchase of future
            receivables and is not a traditional APR-based loan. Program terms, pricing, factor rates,
            documentation, funding availability, and eligibility — including consolidation eligibility — are
            subject to underwriting review and vary by business profile. The before/after comparison shown
            is illustrative only and not a guarantee of savings or approval. Submitting this form does not
            affect your credit and does not constitute an application for funding.
          </>
        }
      />
    </div>
  );
}
