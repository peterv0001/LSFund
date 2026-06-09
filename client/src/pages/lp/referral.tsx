import { ArrowIcon, LpFooter, LpHeader, useLandingForm, usePageMeta } from "./lp-common";

export default function LpReferral() {
  usePageMeta(
    "You know a business that needs capital. — Leader Shield Partner Network",
    "Join the Leader Shield referral partner program: make the introduction and earn 1% of factoring origination on every funded referral. No quotas, no sales role.",
  );
  const { formRef, onSubmit, triggerSubmit } = useLandingForm("lp-partner-referral", "signup");

  return (
    <div className="lp-page" data-testid="page-lp-referral">
      <LpHeader partner safe={<>Referral partner program</>} />

      <section className="hero">
        <div className="wrap">
          <div>
            <span className="eyebrow">
              <span className="dot" /> Referral partners · 1% of origination
            </span>
            <h1>
              You know a business that needs capital. <em>That's the whole job.</em>
            </h1>
            <p className="sub">
              Accountants, consultants, POS reps, brokers, lenders who decline files — you already sit next
              to businesses that need funding. Make the introduction; we handle{" "}
              <b>sales, underwriting, funding, and service</b>. You earn on every deal that funds.
            </p>
            <div className="payout" aria-label="Illustrative payout example">
              <div className="k">Referral compensation</div>
              <div className="big">1%</div>
              <div className="s">of factoring origination on every funded referral</div>
              <div className="div" />
              <div className="row">
                <span>Average funded deal</span>
                <span className="v">$75,000</span>
              </div>
              <div className="row">
                <span>Example referral payout</span>
                <span className="v green">~$750</span>
              </div>
              <div className="row">
                <span>Your obligations after the intro</span>
                <span className="v">None</span>
              </div>
              <div className="fine">
                Illustrative example. Actual compensation depends on funded amount and program terms.
              </div>
            </div>
          </div>

          <form ref={formRef} className="form-card" onSubmit={onSubmit} data-testid="form-lead">
            <div className="fc-eyebrow">● Free to join · no quotas</div>
            <h2>Become a referral partner</h2>
            <p className="fc-sub">Register in two minutes. Your first referral can be submitted the same day.</p>
            <div className="field">
              <label htmlFor="rn">Your name</label>
              <input id="rn" name="name" required autoComplete="name" data-testid="input-name" />
            </div>
            <div className="field">
              <label htmlFor="re">Email</label>
              <input id="re" name="email" type="email" required autoComplete="email" data-testid="input-email" />
            </div>
            <div className="field">
              <label htmlFor="role">What best describes you?</label>
              <select id="role" name="role" required defaultValue="" data-testid="select-role">
                <option value="">Select</option>
                <option>Accountant / bookkeeper</option>
                <option>Business consultant / coach</option>
                <option>POS / merchant services rep</option>
                <option>Lender / broker with declined files</option>
                <option>Other professional with business clients</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="rf">Businesses you could refer this quarter</label>
              <select id="rf" name="referral_capacity" required defaultValue="" data-testid="select-referral-capacity">
                <option value="">Select</option>
                <option>1–2</option>
                <option>3–10</option>
                <option>10+</option>
                <option>Not sure yet</option>
              </select>
            </div>
            <button className="btn btn-primary" type="submit" data-testid="button-submit-lead">
              Register as a referral partner <ArrowIcon />
            </button>
            <p className="fc-fine">No fees, no quotas, no sales obligations. Just the introduction.</p>
          </form>
        </div>
      </section>

      <section className="section">
        <div className="wrap">
          <div className="sec-head">
            <span className="eyebrow on-light">
              <span className="dot" /> How it works
            </span>
            <h2>Three steps. One of them is yours.</h2>
            <p>The entire model is built so the introduction is the only thing you ever have to do.</p>
          </div>
          <div className="how">
            <div className="hcard">
              <div className="num">01</div>
              <h3>Make the introduction</h3>
              <p>
                Submit the business through your partner link or a 60-second referral form. That's your entire
                role.
              </p>
            </div>
            <div className="hcard">
              <div className="num">02</div>
              <h3>We run the file</h3>
              <p>
                Our desk handles outreach, underwriting, structuring, disclosures, funding, and every renewal
                after — with the total cost shown to the merchant before they sign.
              </p>
            </div>
            <div className="hcard">
              <div className="num">03</div>
              <h3>You're paid on funding</h3>
              <p>
                1% of factoring origination on every referral that funds, tracked in your partner portal.
                Renewals from your referrals keep crediting you.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="who">
        <div className="wrap">
          <div>
            <span className="eyebrow on-light">
              <span className="dot" /> Who refers well
            </span>
            <h2>If businesses already trust you, you're halfway done.</h2>
            <p>
              The best referral partners aren't salespeople — they're professionals whose clients already
              bring them money problems. Your introduction carries weight precisely because you're <b>not</b>{" "}
              the one selling. And because we show merchants the full cost up front, the introduction you make
              is one your reputation can stand behind.
            </p>
          </div>
          <div>
            <div className="chips">
              <span className="chip">Accountants &amp; bookkeepers</span>
              <span className="chip">Business consultants</span>
              <span className="chip">POS &amp; merchant services reps</span>
              <span className="chip">Insurance agents</span>
              <span className="chip">Commercial realtors</span>
              <span className="chip">Lenders with declined files</span>
              <span className="chip">Web &amp; marketing agencies</span>
              <span className="chip">Trade association leaders</span>
            </div>
          </div>
        </div>
      </section>

      <section className="section final">
        <div className="wrap">
          <span className="eyebrow on-light">
            <span className="dot" /> Free to join
          </span>
          <h2>The introduction you'd make anyway. Now it pays.</h2>
          <p>
            Register in two minutes. No fees, no quotas, no sales role — and a funding partner your clients
            can verify is straight with them.
          </p>
          <button type="button" className="btn btn-primary" onClick={triggerSubmit} data-testid="button-cta-secondary">
            Register as a referral partner
          </button>
        </div>
      </section>

      <LpFooter
        disclosure={
          <>
            <b>Referral program disclosure.</b> Referral compensation is 1% of factoring origination on
            funded referrals and is governed by the Leader Shield referral partner agreement. The payout
            example shown is illustrative only; actual compensation depends on funded amount and program
            terms. No level of earnings is guaranteed. Referral partners are independent contractors, not
            employees. Merchant cash advance funding is the purchase of future receivables and is not a
            traditional APR-based loan; all merchant terms are subject to underwriting review.
          </>
        }
      />
    </div>
  );
}
