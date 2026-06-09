import { ArrowIcon, CheckIcon, LpFooter, LpHeader, useLandingForm, usePageMeta } from "./lp-common";

export default function LpCallCenterIso() {
  usePageMeta(
    "Your dialers. Our paper. — Leader Shield Partner Network",
    "An institutional MCA partner program for call centers, ISOs, and brokerages: transparent per-deal economics, fast funding payouts, and full compliance coverage.",
  );
  const { formRef, onSubmit, triggerSubmit } = useLandingForm("lp-partner-callcenter-iso", "signup");

  return (
    <div className="lp-page" data-testid="page-lp-callcenter-iso">
      <LpHeader partner safe={<>For call centers, ISOs &amp; brokerages</>} />

      <section className="hero">
        <div className="wrap">
          <div>
            <span className="eyebrow">
              <span className="dot" /> Institutional partner program
            </span>
            <h1>
              Your dialers. <em>Our paper.</em> Funded files pay fast.
            </h1>
            <p className="sub">
              You've built the pipeline — the seats, the data, the talk tracks. Plug it into a funding desk
              that <b>closes, funds, and pays</b> without you carrying underwriting, fulfillment, servicing,
              or compliance exposure.
            </p>
            <ul className="ticks">
              <li>
                <CheckIcon /> Transparent per-deal economics on gross brokerage revenue, with volume
                accelerators
              </li>
              <li>
                <CheckIcon /> Majority of commission released at funding confirmation — not net-60
              </li>
              <li>
                <CheckIcon /> Centralized pricing, disclosures, and compliance — your shop never sets rates
              </li>
              <li>
                <CheckIcon /> Renewal commissions on the book you originate
              </li>
            </ul>
          </div>

          <form ref={formRef} className="form-card" onSubmit={onSubmit} data-testid="form-lead">
            <div className="fc-eyebrow">● Partner economics one-pager + intro call</div>
            <h2>Get the partner economics</h2>
            <p className="fc-sub">
              The full payout schedule, accelerator tiers, and onboarding timeline — plus a 20-minute fit
              call with our partnerships desk.
            </p>
            <div className="field">
              <label htmlFor="cn">Company name</label>
              <input id="cn" name="company" required autoComplete="organization" data-testid="input-company" />
            </div>
            <div className="field">
              <label htmlFor="pn">Your name</label>
              <input id="pn" name="name" required autoComplete="name" data-testid="input-name" />
            </div>
            <div className="field">
              <label htmlFor="pe">Work email</label>
              <input id="pe" name="email" type="email" required autoComplete="email" data-testid="input-email" />
            </div>
            <div className="field">
              <label htmlFor="sz">Operation size</label>
              <select id="sz" name="size" required defaultValue="" data-testid="select-size">
                <option value="">Select</option>
                <option>1–5 agents / closers</option>
                <option>6–20 seats</option>
                <option>21–50 seats</option>
                <option>50+ seats</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="vol">Current monthly funded volume (if any)</label>
              <select id="vol" name="volume" required defaultValue="" data-testid="select-volume">
                <option value="">Select</option>
                <option>Not funding MCA yet</option>
                <option>Under $250K</option>
                <option>$250K – $1M</option>
                <option>$1M+</option>
              </select>
            </div>
            <button className="btn btn-primary" type="submit" data-testid="button-submit-lead">
              Send the economics + book a call <ArrowIcon />
            </button>
            <p className="fc-fine">Reviewed by the partnerships desk within one business day.</p>
          </form>
        </div>
      </section>

      <section className="section">
        <div className="wrap">
          <div className="sec-head">
            <span className="eyebrow on-light">
              <span className="dot" /> The economics
            </span>
            <h2>Built for shops that run on math.</h2>
            <p>
              No mystery splits. The structure below is the structure in the agreement — full schedule in the
              one-pager.
            </p>
          </div>
          <div className="econ">
            <div className="ecard">
              <div className="big">
                22%<em> GBR</em>
              </div>
              <p>Base commission on gross brokerage revenue per funded deal</p>
            </div>
            <div className="ecard">
              <div className="big">
                70<em>/</em>30
              </div>
              <p>Majority released at funding confirmation; remainder after the clawback window</p>
            </div>
            <div className="ecard">
              <div className="big">
                +<em>3%</em> max
              </div>
              <p>Quarterly volume accelerators from $250K to $2M+ in funded volume</p>
            </div>
            <div className="ecard">
              <div className="big">Renewals</div>
              <p>Commission on repeat fundings from the merchants you originate</p>
            </div>
          </div>
          <p className="econ-note">
            Commission rates and accelerator qualifications are governed by the partner agreement. Full
            schedule provided in the one-pager.
          </p>
        </div>
      </section>

      <section className="infra">
        <div className="wrap">
          <div className="sec-head">
            <span className="eyebrow">
              <span className="dot" /> The infrastructure
            </span>
            <h2>You originate. We carry the rest.</h2>
            <p>The desk behind your pipeline — built so your operation scales volume without scaling risk.</p>
          </div>
          <div className="igrid">
            <div className="icard-d">
              <div className="ic">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path d="M3 3v18h18" />
                  <path d="M7 14l4-4 3 3 5-6" />
                </svg>
              </div>
              <h3>Deal desk &amp; CRM</h3>
              <p>
                Real-time pipeline, submission tracking, and commission reporting per seat and per campaign —
                built for managers who run boards.
              </p>
            </div>
            <div className="icard-d">
              <div className="ic">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path d="M12 3 4 6v6c0 5 3.5 7.5 8 9 4.5-1.5 8-4 8-9V6l-8-3Z" />
                  <path d="M9 12l2 2 4-4" />
                </svg>
              </div>
              <h3>Compliance shield</h3>
              <p>
                Centralized pricing and automated, archived disclosures. Your agents never set or negotiate
                rates — which is exactly what protects your shop as state rules evolve.
              </p>
            </div>
            <div className="icard-d">
              <div className="ic">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <circle cx="12" cy="12" r="9" />
                  <path d="M12 7v5l3 3" />
                </svg>
              </div>
              <h3>Fast fulfillment</h3>
              <p>
                Underwriting, structuring, funding, and servicing handled by our desk — files can fund in as
                little as one business day, and renewals run without your lift.
              </p>
            </div>
            <div className="icard-d">
              <div className="ic">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path d="M4 7h16M4 12h16M4 17h16" />
                </svg>
              </div>
              <h3>Training &amp; talk tracks</h3>
              <p>
                Product certification, objection handling, and compliant scripting for your floor — onboarding
                measured in days, not quarters.
              </p>
            </div>
            <div className="icard-d">
              <div className="ic">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path d="M16 11a4 4 0 1 0-3.5-6M8 11a4 4 0 1 1 3.5-6M2 21v-1a5 5 0 0 1 5-5h2M22 21v-1a5 5 0 0 0-5-5h-2" />
                </svg>
              </div>
              <h3>Dedicated partner manager</h3>
              <p>
                One named contact for deal structuring, escalations, and payout questions — not a ticket
                queue.
              </p>
            </div>
            <div className="icard-d">
              <div className="ic">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path d="M12 1v22M5 5h11a3 3 0 0 1 0 6H8a3 3 0 0 0 0 6h11" />
                </svg>
              </div>
              <h3>Transparent merchant brand</h3>
              <p>
                You sell paper merchants can verify: total cost shown before signature. Easier closes, fewer
                rescissions, cleaner renewals.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="section fit">
        <div className="wrap">
          <div>
            <span className="eyebrow on-light">
              <span className="dot" /> Who this fits
            </span>
            <h2>Built for operations, not hobbyists.</h2>
            <ul className="qlist">
              <li>
                <CheckIcon /> Outbound call centers with seats, data, and dialer infrastructure already
                running
              </li>
              <li>
                <CheckIcon /> ISOs and brokerages seeking a faster-paying, compliance-covered funding desk
              </li>
              <li>
                <CheckIcon /> Shops selling adjacent products (merchant services, insurance, leads) wanting a
                funding line on the floor
              </li>
            </ul>
          </div>
          <div>
            <span className="eyebrow on-light">
              <span className="dot" /> Onboarding
            </span>
            <h2>Live in days.</h2>
            <ul className="qlist">
              <li>
                <CheckIcon />{" "}
                <b style={{ marginRight: "5px" }}>Day 1–2&nbsp;</b> Fit call, agreement, and portal
                provisioning
              </li>
              <li>
                <CheckIcon />{" "}
                <b style={{ marginRight: "5px" }}>Day 3–5&nbsp;</b> Floor certification and compliant script
                integration
              </li>
              <li>
                <CheckIcon />{" "}
                <b style={{ marginRight: "5px" }}>Week 2&nbsp;</b> First submissions in the desk; commissions
                on first fundings
              </li>
            </ul>
          </div>
        </div>
      </section>

      <section className="section final">
        <div className="wrap">
          <span className="eyebrow on-light">
            <span className="dot" /> Partner economics one-pager
          </span>
          <h2>Run the numbers on your own floor.</h2>
          <p>
            Get the full payout schedule and accelerator tiers, then pressure-test it with our partnerships
            desk on a 20-minute call.
          </p>
          <button type="button" className="btn btn-primary" onClick={triggerSubmit} data-testid="button-cta-secondary">
            Send the economics + book a call
          </button>
        </div>
      </section>

      <LpFooter
        disclosure={
          <>
            <b>Partner program disclosure.</b> Commission rates, payout splits, accelerator qualifications,
            and renewal terms are governed by the Leader Shield partner agreement and may vary by program.
            Partners are independent contractors, not employees. No level of earnings is guaranteed; partner
            results depend on volume, deal quality, retention, and market conditions. Merchant cash advance
            funding is the purchase of future receivables and is not a traditional APR-based loan; all
            merchant terms are subject to underwriting review.
          </>
        }
      />
    </div>
  );
}
