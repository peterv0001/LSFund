import { ArrowIcon, CheckIcon, LpFooter, LpHeader, useLandingForm, usePageMeta } from "./lp-common";

export default function LpReferral() {
  usePageMeta(
    "Two income streams. One agent role. — LeaderShield Funding Agents",
    "Become a LeaderShield Funding agent and earn on two streams: MCA funding commissions plus recurring Merchant Growth Platform subscription commissions and lifetime residuals.",
  );
  const { formRef, onSubmit, triggerSubmit } = useLandingForm("lp-agent-recruiting", "signup");

  return (
    <div className="lp-page" data-testid="page-lp-referral">
      <LpHeader partner safe={<>LeaderShield Funding agent program</>} />

      <section className="hero">
        <div className="wrap">
          <div>
            <span className="eyebrow">
              <span className="dot" /> Become an agent · two income streams
            </span>
            <h1>
              Two income streams. <em>One agent role.</em>
            </h1>
            <p className="sub">
              As a <b>LeaderShield Funding</b> agent you write merchant cash advances <b>and</b> place the
              Merchant Growth Platform — earning on funding commissions plus recurring subscription
              commissions and lifetime residuals. We handle underwriting, funding, and platform delivery;
              you build the book.
            </p>
            <div className="payout" aria-label="Illustrative agent compensation">
              <div className="k">Agent compensation</div>
              <div className="row">
                <span>MCA Opening Agent Pool</span>
                <span className="v green">32.5%</span>
              </div>
              <div className="row">
                <span>Performance accelerators</span>
                <span className="v">up to +2.5%</span>
              </div>
              <div className="div" />
              <div className="row">
                <span>Platform subscription commission</span>
                <span className="v green">up to 55%</span>
              </div>
              <div className="row">
                <span>With accelerators</span>
                <span className="v">up to 60%</span>
              </div>
              <div className="row">
                <span>Lifetime subscription residuals</span>
                <span className="v">up to 15%</span>
              </div>
              <div className="fine">
                Illustrative compensation ranges. Independent agents keep the full Opening Agent Pool share.
                Actual earnings depend on production, product mix, and program terms.
              </div>
            </div>
          </div>

          <form ref={formRef} className="form-card" onSubmit={onSubmit} data-testid="form-lead">
            <div className="fc-eyebrow">● Free to apply · build your own book</div>
            <h2>Become a LeaderShield Funding agent</h2>
            <p className="fc-sub">Apply in two minutes. We'll walk you through onboarding and the comp plan.</p>
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
                <option>New to MCA / funding sales</option>
                <option>Experienced MCA / ISO producer</option>
                <option>Financial / business services pro</option>
                <option>SaaS / platform sales background</option>
                <option>Other sales professional</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="rf">Your funding sales experience</label>
              <select id="rf" name="agent_experience" required defaultValue="" data-testid="select-agent-experience">
                <option value="">Select</option>
                <option>Just getting started</option>
                <option>Under 1 year</option>
                <option>1–3 years</option>
                <option>3+ years</option>
              </select>
            </div>
            <button className="btn btn-primary" type="submit" data-testid="button-submit-lead">
              Apply to become an agent <ArrowIcon />
            </button>
            <p className="fc-fine">No fees to apply. Build recurring income alongside your funding deals.</p>
          </form>
        </div>
      </section>

      <section className="section">
        <div className="wrap">
          <div className="sec-head">
            <span className="eyebrow on-light">
              <span className="dot" /> How agents get paid
            </span>
            <h2>One relationship. Two ways to earn.</h2>
            <p>
              Every merchant you bring to LeaderShield Funding can fund and subscribe — so a single client can
              pay you twice, with the platform side paying you again every month.
            </p>
          </div>
          <div className="how">
            <div className="hcard">
              <div className="num">01</div>
              <h3>Fund the deal</h3>
              <p>
                Place a merchant cash advance and earn from the <b>Opening Agent Pool — 32.5% of the gross
                funding commission</b>. Independent agents keep the full 32.5%, with performance accelerators
                adding up to +2.5%.
              </p>
            </div>
            <div className="hcard">
              <div className="num">02</div>
              <h3>Place the platform</h3>
              <p>
                Add the Merchant Growth Platform and earn <b>up to 55% of the commissionable basis</b> on
                premium products at the Elite tier — up to 60% with accelerators.
              </p>
            </div>
            <div className="hcard">
              <div className="num">03</div>
              <h3>Earn for the lifetime</h3>
              <p>
                Keep tiered lifetime residuals on active subscriptions, so the book you build keeps paying you
                month after month — not just on the first sale.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="section" id="plans">
        <div className="wrap">
          <div className="sec-head">
            <span className="eyebrow on-light">
              <span className="dot" /> Recurring residual income
            </span>
            <h2>Build a book that pays every month.</h2>
            <p>
              Subscription commissions are earned up front; residuals keep crediting you for the life of each
              active subscription. Starter is commission-eligible but not residual-eligible.
            </p>
          </div>
          <div className="tiers">
            <div className="tier">
              <h3 className="tname">Starter</h3>
              <div className="trole">Lead generation</div>
              <div className="price mono">
                $149<small>/mo</small>
              </div>
              <p className="pitch">Entry point for merchants filling the pipeline. Commission-eligible.</p>
              <ul>
                <li>
                  <CheckIcon strokeWidth={2.4} /> Up-front subscription commission
                </li>
                <li>
                  <CheckIcon strokeWidth={2.4} /> Not residual-eligible
                </li>
              </ul>
            </div>

            <div className="tier">
              <h3 className="tname">Growth Foundation</h3>
              <div className="trole">Visibility &amp; stability</div>
              <div className="price mono">
                $497<small>/mo</small>
              </div>
              <p className="pitch">The organized, responsive foundation — and your first residual tier.</p>
              <ul>
                <li>
                  <CheckIcon strokeWidth={2.4} /> Up-front subscription commission
                </li>
                <li>
                  <CheckIcon strokeWidth={2.4} /> 10% lifetime residual
                </li>
              </ul>
            </div>

            <div className="tier pop">
              <span className="flag">Most popular</span>
              <h3 className="tname">Revenue Growth System</h3>
              <div className="trole">Revenue growth &amp; optimization</div>
              <div className="price mono">
                $997<small>/mo</small>
              </div>
              <p className="pitch">The active engine merchants stay on — and a stronger residual for you.</p>
              <ul>
                <li>
                  <CheckIcon strokeWidth={2.4} /> Up-front subscription commission
                </li>
                <li>
                  <CheckIcon strokeWidth={2.4} /> 15% lifetime residual
                </li>
              </ul>
            </div>

            <div className="tier">
              <span className="flag best">Best value</span>
              <h3 className="tname">Revenue Scale AI</h3>
              <div className="trole">AI-driven scale &amp; optimization</div>
              <div className="price mono">
                $1,497<small>/mo</small>
              </div>
              <p className="pitch">The full AI marketing-and-sales department — your highest-value placement.</p>
              <ul>
                <li>
                  <CheckIcon strokeWidth={2.4} /> Up-front subscription commission
                </li>
                <li>
                  <CheckIcon strokeWidth={2.4} /> 15% lifetime residual
                </li>
              </ul>
            </div>
          </div>
          <p className="tier-note">
            Subscription commission earns up to 55% of the commissionable basis on premium products at the
            Elite tier (up to 60% with accelerators). Residual percentages apply to active subscriptions and
            are governed by the agent compensation plan.
          </p>
        </div>
      </section>

      <section className="who">
        <div className="wrap">
          <div>
            <span className="eyebrow on-light">
              <span className="dot" /> Who does well here
            </span>
            <h2>If you can open a conversation with a business owner, you can earn here.</h2>
            <p>
              The strongest agents pair funding with the platform — solving a merchant's cash need today and
              their growth need every month after. You don't need a book of MCA deals to start; you need
              merchants who want capital, customers, or both. We provide the products, the underwriting, and
              the back office.
            </p>
          </div>
          <div>
            <div className="chips">
              <span className="chip">MCA &amp; ISO producers</span>
              <span className="chip">Independent funding agents</span>
              <span className="chip">Business consultants</span>
              <span className="chip">SaaS &amp; platform sellers</span>
              <span className="chip">Financial services pros</span>
              <span className="chip">Insurance agents</span>
              <span className="chip">Commercial realtors</span>
              <span className="chip">New sales professionals</span>
            </div>
          </div>
        </div>
      </section>

      <section className="section final">
        <div className="wrap">
          <span className="eyebrow on-light">
            <span className="dot" /> Free to apply
          </span>
          <h2>Write the deal. Place the platform. Get paid twice.</h2>
          <p>
            Apply in two minutes and build a book with recurring income — backed by a funding partner that
            shows merchants the total cost before they sign.
          </p>
          <button type="button" className="btn btn-primary" onClick={triggerSubmit} data-testid="button-cta-secondary">
            Apply to become an agent
          </button>
        </div>
      </section>

      <LpFooter
        disclosure={
          <>
            <b>Income disclosure.</b> Compensation figures shown — including the Opening Agent Pool share,
            performance accelerators, subscription commission rates, and lifetime residual percentages — are
            illustrative and governed by the LeaderShield Funding agent compensation plan, which is subject to
            change. Agents are independent contractors, not employees, and earnings vary based on production,
            product mix, and effort. No level of earnings is guaranteed. Merchant cash advance funding is the
            purchase of future receivables and is not a traditional APR-based loan; all merchant terms are
            subject to underwriting review.
          </>
        }
      />
    </div>
  );
}
