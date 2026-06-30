import { ArrowIcon, CheckIcon, LpFooter, LpHeader, useLandingForm, usePageMeta } from "./lp-common";

export default function LpDeclined() {
  usePageMeta(
    "The bank said no. Your revenue says yes. — LeaderShield Funding",
    "Get the 24-Hour Funding Checklist: exactly what to prepare so your business file can move from application to funded capital in as little as one business day.",
  );
  const { formRef, onSubmit, triggerSubmit } = useLandingForm("lp-merchant-declined", "apply");

  return (
    <div className="lp-page" data-testid="page-lp-declined">
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
              <span className="dot" /> Free checklist for declined businesses
            </span>
            <h1>
              The bank said no. <em>Your revenue</em> says yes.
            </h1>
            <p className="sub">
              Banks decline on credit. We underwrite on <b>revenue and cash flow</b> — and files that
              arrive prepared can fund in as little as one business day. This checklist shows you exactly
              how to be that file.
            </p>
            <ul className="ticks">
              <li>
                <CheckIcon /> The 6 documents that move a file same-day — and the 3 that stall it
              </li>
              <li>
                <CheckIcon /> What revenue-based underwriters actually look at (it isn't your FICO)
              </li>
              <li>
                <CheckIcon /> The bank-statement red flags to fix before you apply anywhere
              </li>
            </ul>
          </div>

          <form ref={formRef} className="form-card" onSubmit={onSubmit} data-testid="form-lead">
            <div className="fc-eyebrow">● Free instant download</div>
            <h2>The 24-Hour Funding Checklist</h2>
            <p className="fc-sub">Sent to your inbox immediately. No obligation, no credit impact.</p>
            <div className="field">
              <label htmlFor="n1">First name</label>
              <input id="n1" name="name" required autoComplete="given-name" data-testid="input-name" />
            </div>
            <div className="field">
              <label htmlFor="e1">Business email</label>
              <input id="e1" name="email" type="email" required autoComplete="email" data-testid="input-email" />
            </div>
            <div className="field">
              <label htmlFor="r1">Monthly gross revenue</label>
              <select id="r1" name="revenue" required defaultValue="" data-testid="select-revenue">
                <option value="">Select a range</option>
                <option>$10K – $25K</option>
                <option>$25K – $75K</option>
                <option>$75K – $250K</option>
                <option>$250K+</option>
                <option>Under $10K</option>
              </select>
            </div>
            <button className="btn btn-primary" type="submit" data-testid="button-submit-lead">
              Send me the checklist <ArrowIcon />
            </button>
            <p className="fc-fine">
              We'll also show you what your business may qualify for. Unsubscribe anytime.
            </p>
          </form>
        </div>
      </section>

      <section className="section">
        <div className="wrap">
          <div className="sec-head">
            <span className="eyebrow on-light">
              <span className="dot" /> What's inside
            </span>
            <h2>Be the file that funds in a day.</h2>
            <p>
              Most "fast funding" delays aren't underwriting — they're preparation. The checklist closes
              that gap before you apply.
            </p>
          </div>
          <div className="inside">
            <div className="icard">
              <div className="n">PART 01</div>
              <h3>The same-day document stack</h3>
              <p>
                The one-page application, 3–6 months of bank statements, license, and voided check —
                assembled the way underwriters want to receive them.
              </p>
            </div>
            <div className="icard">
              <div className="n">PART 02</div>
              <h3>How revenue underwriting reads you</h3>
              <p>
                Average daily balance, deposit consistency, NSF history, existing obligations — the four
                signals that decide speed and terms.
              </p>
            </div>
            <div className="icard">
              <div className="n">PART 03</div>
              <h3>Fix-before-you-apply red flags</h3>
              <p>The statement patterns that slow or kill files — and the 30-day moves that clean them up.</p>
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
            <h2>A decline isn't a verdict. It's a mismatch.</h2>
            <p>
              Banks lend against credit history. LeaderShield funds against business performance — $2K to
              $2M, reviewed file by file, with the <b>total cost shown before you sign</b>. No APR sleight
              of hand, no surprise holdbacks.
            </p>
          </div>
          <div className="well">
            <div className="k">The funding profile</div>
            <div className="big">$2K–$2M</div>
            <div className="s">Funding range, averaging ~$75K per business</div>
            <div className="div" />
            <div className="k">Speed</div>
            <div className="big" style={{ fontSize: "clamp(1.8rem,3.4vw,2.4rem)" }}>
              As fast as 1 day
            </div>
            <div className="s">6+ months in business · $10K+ monthly revenue</div>
          </div>
        </div>
      </section>

      <section className="section final on-paper">
        <div className="wrap">
          <span className="eyebrow on-light">
            <span className="dot" /> Free instant download
          </span>
          <h2>Get the checklist. Be ready before you apply.</h2>
          <p>Two minutes to read. Could save you weeks of waiting — here or anywhere else you apply.</p>
          <button type="button" className="btn btn-primary" onClick={triggerSubmit} data-testid="button-cta-secondary">
            Send me the checklist
          </button>
        </div>
      </section>

      <LpFooter
        disclosure={
          <>
            <b>Funding terms disclosure.</b> Merchant cash advance funding is the purchase of future
            receivables and is not a traditional APR-based loan. Program terms, pricing, factor rates,
            documentation, funding availability, and eligibility are subject to underwriting review and
            vary by business profile. Figures shown are illustrative and not guaranteed. Submitting this
            form does not affect your credit and does not constitute an application for funding.
          </>
        }
      />
    </div>
  );
}
