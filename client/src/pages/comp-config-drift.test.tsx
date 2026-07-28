// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { readFileSync } from "fs";
import path from "path";
import React from "react";
import { COMP_V2026 } from "@shared/compensation";
import { pct, usd } from "@shared/compensation-format";

// ============================================================================
// Compensation config drift guard
// ----------------------------------------------------------------------------
// The three compensation-facing pages (commissions, opportunity, dashboard)
// render figures directly from COMP_V2026 using shared formatters (pct/usd)
// from shared/compensation-format.ts.  A hardcoded copy-edit or a silent
// COMP_V2026 change can desync the marketing site / portal from the engine.
//
// This file guards against that in three layers:
//   1. COMP_V2026 canonical-value assertions — fail if the config drifts from
//      the documented Manual figures.
//   2. Render assertions — small React fragments that replicate the page JSX
//      render under jsdom; the text is compared against known-good strings so
//      both a config change AND a formatter change produce a test failure.
//   3. Source-file import guard — verifies the pages import COMP_V2026 and the
//      shared formatters, and that no guarded figure appears as a bare literal.
// ============================================================================

const ROOT = path.resolve(__dirname, "../../..");

// ---------------------------------------------------------------------------
// 1. COMP_V2026 canonical values
// ---------------------------------------------------------------------------

describe("COMP_V2026 — MCA allocation", () => {
  it("opening agent pool is 32.5%", () => {
    expect(COMP_V2026.mcaAllocation.openingAgentPool).toBeCloseTo(0.325, 4);
  });

  it("PMF share 50%, performance accelerator pool 2.5%, EBITDA 15%", () => {
    expect(COMP_V2026.mcaAllocation.pmf).toBeCloseTo(0.500, 4);
    expect(COMP_V2026.mcaAllocation.performanceAcceleratorPool).toBeCloseTo(0.025, 4);
    expect(COMP_V2026.mcaAllocation.leadershieldEbitda).toBeCloseTo(0.150, 4);
  });

  it("all MCA allocation slices sum to 1.0", () => {
    const { pmf, openingAgentPool, performanceAcceleratorPool, leadershieldEbitda } =
      COMP_V2026.mcaAllocation;
    expect(pmf + openingAgentPool + performanceAcceleratorPool + leadershieldEbitda).toBeCloseTo(1.0, 4);
  });
});

describe("COMP_V2026 — subscription pools (elite tier, premium products)", () => {
  it("elite tier_4 m1to3 pool is 55%", () => {
    expect(COMP_V2026.subscriptionPools.elite.tier_4.m1to3).toBeCloseTo(0.55, 4);
  });

  it("elite tier_4 m4to6 pool is 45%", () => {
    expect(COMP_V2026.subscriptionPools.elite.tier_4.m4to6).toBeCloseTo(0.45, 4);
  });

  it("elite tier_4 m7to9 pool is 35%", () => {
    expect(COMP_V2026.subscriptionPools.elite.tier_4.m7to9).toBeCloseTo(0.35, 4);
  });

  it("elite tier_4 m10to12 pool is 25%", () => {
    expect(COMP_V2026.subscriptionPools.elite.tier_4.m10to12).toBeCloseTo(0.25, 4);
  });

  it("elite tier_4 residual pool is 15%", () => {
    expect(COMP_V2026.subscriptionPools.elite.tier_4.residual).toBeCloseTo(0.15, 4);
  });

  it("elite tier_3 and tier_4 share the same premium schedule", () => {
    const t3 = COMP_V2026.subscriptionPools.elite.tier_3;
    const t4 = COMP_V2026.subscriptionPools.elite.tier_4;
    expect(t3.m1to3).toBeCloseTo(t4.m1to3, 4);
    expect(t3.m4to6).toBeCloseTo(t4.m4to6, 4);
    expect(t3.m7to9).toBeCloseTo(t4.m7to9, 4);
    expect(t3.m10to12).toBeCloseTo(t4.m10to12, 4);
    expect(t3.residual).toBeCloseTo(t4.residual, 4);
  });

  it("top subscription pool + accelerator cap reaches 60%", () => {
    const topPool = COMP_V2026.subscriptionPools.elite.tier_4.m1to3;
    const accelCap = COMP_V2026.subscriptionAccelerators.cap;
    expect(topPool + accelCap).toBeCloseTo(0.60, 4);
  });
});

describe("COMP_V2026 — subscription performance accelerators", () => {
  it("accelerator cap is 5%", () => {
    expect(COMP_V2026.subscriptionAccelerators.cap).toBeCloseTo(0.05, 4);
  });

  it("four triggers sum to exactly the cap", () => {
    const { volume, retention, premiumProductMix, mcaAttachment, cap } =
      COMP_V2026.subscriptionAccelerators;
    expect(volume + retention + premiumProductMix + mcaAttachment).toBeCloseTo(cap, 4);
  });
});

describe("COMP_V2026 — subscription agency overrides", () => {
  it("recruiting override cap is 20%", () => {
    expect(COMP_V2026.subscriptionAgencySplits.recruiting.override).toBeCloseTo(0.20, 4);
  });

  it("every agency model has producer + override == 1.0", () => {
    for (const [key, split] of Object.entries(COMP_V2026.subscriptionAgencySplits)) {
      expect(split.producer + split.override, `${key}: should equal 1.0`).toBeCloseTo(1.0, 4);
    }
  });
});

describe("COMP_V2026 — subscription pricing", () => {
  it("tier_1 retail price is $149", () => {
    expect(COMP_V2026.subscriptionPricing.tier_1.retail).toBe(149);
  });

  it("tier_4 retail price is $1,497", () => {
    expect(COMP_V2026.subscriptionPricing.tier_4.retail).toBe(1497);
  });
});

describe("COMP_V2026 — membership fees and waivers", () => {
  it("small_agency monthly fee is $149", () => {
    expect(COMP_V2026.membership.small_agency.fee).toBe(149);
  });

  it("small_agency waiver threshold is $1,500", () => {
    expect(COMP_V2026.membership.small_agency.waiverThreshold).toBe(1500);
  });
});

describe("COMP_V2026 — distributor tiers", () => {
  it("has pool schedules for standard, enhanced, and elite", () => {
    expect(COMP_V2026.subscriptionPools).toHaveProperty("standard");
    expect(COMP_V2026.subscriptionPools).toHaveProperty("enhanced");
    expect(COMP_V2026.subscriptionPools).toHaveProperty("elite");
  });

  it("has qualification thresholds for enhanced and elite", () => {
    expect(COMP_V2026.distributorQualification).toHaveProperty("enhanced");
    expect(COMP_V2026.distributorQualification).toHaveProperty("elite");
  });
});

// ---------------------------------------------------------------------------
// 2. Render assertions
//    Each fragment below replicates the exact JSX expression used in the page
//    (same COMP_V2026 import, same shared pct/usd from compensation-format.ts).
//    Expected strings are hardcoded so both a COMP_V2026 change AND a formatter
//    divergence cause a test failure.
// ---------------------------------------------------------------------------

describe("commissions page — rendered compensation figures", () => {
  // Mirrors commissions.tsx: pct(mcaAllocation.openingAgentPool)
  it("MCA opening pool renders as '32.5%'", () => {
    function Frag() {
      return <span data-testid="v">{pct(COMP_V2026.mcaAllocation.openingAgentPool)}</span>;
    }
    const { getByTestId } = render(<Frag />);
    expect(getByTestId("v").textContent).toBe("32.5%");
  });

  // Mirrors commissions.tsx: `Up to ${pct(subscriptionPools.elite.tier_3.m1to3)}`
  it("top subscription pool renders as 'Up to 55%'", () => {
    function Frag() {
      return (
        <span data-testid="v">
          {`Up to ${pct(COMP_V2026.subscriptionPools.elite.tier_3.m1to3)}`}
        </span>
      );
    }
    const { getByTestId } = render(<Frag />);
    expect(getByTestId("v").textContent).toBe("Up to 55%");
  });

  // Mirrors commissions.tsx: `+${pct(subscriptionAccelerators.cap)}`
  it("subscription accelerator cap renders as '+5%'", () => {
    function Frag() {
      return (
        <span data-testid="v">{`+${pct(COMP_V2026.subscriptionAccelerators.cap)}`}</span>
      );
    }
    const { getByTestId } = render(<Frag />);
    expect(getByTestId("v").textContent).toBe("+5%");
  });

  // Mirrors commissions.tsx: `Up to ${pct(subscriptionAgencySplits.recruiting.override)}`
  it("team override cap renders as 'Up to 20%'", () => {
    function Frag() {
      return (
        <span data-testid="v">
          {`Up to ${pct(COMP_V2026.subscriptionAgencySplits.recruiting.override)}`}
        </span>
      );
    }
    const { getByTestId } = render(<Frag />);
    expect(getByTestId("v").textContent).toBe("Up to 20%");
  });

  // Mirrors commissions.tsx decay display: pct(subscriptionPools.elite.tier_3[bucket])
  it("elite tier_3 decay schedule renders as 55 / 45 / 35 / 25 / 15%", () => {
    const pools = COMP_V2026.subscriptionPools.elite.tier_3;
    const buckets = [pools.m1to3, pools.m4to6, pools.m7to9, pools.m10to12, pools.residual];
    function Frag() {
      return (
        <>
          {buckets.map((v, i) => (
            <span key={i} data-testid={`b${i}`}>{pct(v)}</span>
          ))}
        </>
      );
    }
    const { getByTestId } = render(<Frag />);
    expect(getByTestId("b0").textContent).toBe("55%");
    expect(getByTestId("b1").textContent).toBe("45%");
    expect(getByTestId("b2").textContent).toBe("35%");
    expect(getByTestId("b3").textContent).toBe("25%");
    expect(getByTestId("b4").textContent).toBe("15%");
  });

  // Mirrors commissions.tsx FAQ: usd(membership.individual.fee)
  it("individual membership fee renders as '$99'", () => {
    function Frag() {
      return <span data-testid="v">{usd(COMP_V2026.membership.individual.fee)}</span>;
    }
    const { getByTestId } = render(<Frag />);
    expect(getByTestId("v").textContent).toBe("$99");
  });

  // Mirrors commissions.tsx FAQ: usd(membership.individual.waiverThreshold)
  it("individual membership waiver renders as '$500'", () => {
    function Frag() {
      return <span data-testid="v">{usd(COMP_V2026.membership.individual.waiverThreshold)}</span>;
    }
    const { getByTestId } = render(<Frag />);
    expect(getByTestId("v").textContent).toBe("$500");
  });
});

describe("opportunity page — rendered compensation figures", () => {
  // Mirrors opportunity.tsx: pct(mcaAllocation.openingAgentPool)
  it("MCA opening pool renders as '32.5%'", () => {
    function Frag() {
      return <span data-testid="v">{pct(COMP_V2026.mcaAllocation.openingAgentPool)}</span>;
    }
    const { getByTestId } = render(<Frag />);
    expect(getByTestId("v").textContent).toBe("32.5%");
  });

  // Mirrors opportunity.tsx: `+${pct(mcaAccelerators.cap)}`
  it("MCA accelerator cap renders as '+2.5%'", () => {
    function Frag() {
      return (
        <span data-testid="v">{`Performance accelerators up to +${pct(COMP_V2026.mcaAccelerators.cap)}`}</span>
      );
    }
    const { getByTestId } = render(<Frag />);
    expect(getByTestId("v").textContent).toBe("Performance accelerators up to +2.5%");
  });

  // Mirrors opportunity.tsx membership section: usd(membership.small_agency.fee)
  it("small_agency membership fee renders as '$149'", () => {
    function Frag() {
      return <span data-testid="v">{usd(COMP_V2026.membership.small_agency.fee)}</span>;
    }
    const { getByTestId } = render(<Frag />);
    expect(getByTestId("v").textContent).toBe("$149");
  });

  // Mirrors opportunity.tsx: `Waived at ${usd(membership.small_agency.waiverThreshold)} collected`
  it("small_agency waiver renders as 'Waived at $1,500 collected'", () => {
    function Frag() {
      return (
        <span data-testid="v">
          {`Waived at ${usd(COMP_V2026.membership.small_agency.waiverThreshold)} collected`}
        </span>
      );
    }
    const { getByTestId } = render(<Frag />);
    expect(getByTestId("v").textContent).toBe("Waived at $1,500 collected");
  });

  // Mirrors opportunity.tsx FAQ after fix: pct(subscriptionAccelerators.cap)
  it("subscription accelerator cap in FAQ renders as '5%'", () => {
    function Frag() {
      return (
        <span data-testid="v">
          {`an additional ${pct(COMP_V2026.subscriptionAccelerators.cap)}`}
        </span>
      );
    }
    const { getByTestId } = render(<Frag />);
    expect(getByTestId("v").textContent).toBe("an additional 5%");
  });
});

describe("dashboard page — rendered compensation figures", () => {
  // Mirrors dashboard.tsx distributor-status row:
  //   `$${plan.fee}/mo · waived at ${plan.waiverThreshold.toLocaleString()} collected`
  // NOTE: the dashboard uses a literal "$" prefix and .toLocaleString() (no usd()),
  //       so the waiver number has NO dollar sign — this test locks in that format.
  it("small_agency membership fee row renders as '$149/mo'", () => {
    function Frag() {
      const plan = COMP_V2026.membership.small_agency;
      return <span data-testid="v">${plan.fee}/mo</span>;
    }
    const { getByTestId } = render(<Frag />);
    expect(getByTestId("v").textContent).toBe("$149/mo");
  });

  it("waiver threshold renders as '1,500 collected' (no dollar sign — toLocaleString format)", () => {
    function Frag() {
      const plan = COMP_V2026.membership.small_agency;
      return <span data-testid="v">{plan.waiverThreshold.toLocaleString()} collected</span>;
    }
    const { getByTestId } = render(<Frag />);
    expect(getByTestId("v").textContent).toBe("1,500 collected");
  });

  it("full dashboard waiver line renders as '$149/mo · waived at 1,500 collected'", () => {
    function Frag() {
      const plan = COMP_V2026.membership.small_agency;
      return (
        <span data-testid="v">
          ${plan.fee}/mo · waived at {plan.waiverThreshold.toLocaleString()} collected
        </span>
      );
    }
    const { getByTestId } = render(<Frag />);
    expect(getByTestId("v").textContent).toBe("$149/mo · waived at 1,500 collected");
  });

  it("tier_4 retail price renders as '$1,497'", () => {
    function Frag() {
      return (
        <span data-testid="v">{usd(COMP_V2026.subscriptionPricing.tier_4.retail)}</span>
      );
    }
    const { getByTestId } = render(<Frag />);
    expect(getByTestId("v").textContent).toBe("$1,497");
  });

  it("tier_1 retail price renders as '$149'", () => {
    function Frag() {
      return (
        <span data-testid="v">{usd(COMP_V2026.subscriptionPricing.tier_1.retail)}</span>
      );
    }
    const { getByTestId } = render(<Frag />);
    expect(getByTestId("v").textContent).toBe("$149");
  });
});

// ---------------------------------------------------------------------------
// 3. Source-file import + no-hardcoded-literal guard
//    Verifies each compensation surface imports COMP_V2026 and the shared
//    formatters, and that no guarded figure appears as a bare literal string.
// ---------------------------------------------------------------------------

const COMPENSATION_SURFACES = [
  "client/src/pages/commissions.tsx",
  "client/src/pages/opportunity.tsx",
  "client/src/pages/dashboard.tsx",
];

function readSource(relPath: string) {
  return readFileSync(path.join(ROOT, relPath), "utf8");
}

// Patterns that must NOT appear as bare literals in any compensation surface.
// Each label names what the false-positive would mean for a user.
const GUARDED_LITERALS: Array<{ label: string; pattern: RegExp }> = [
  // A literal "32.5%" anywhere in the source (not inside a pct() interpolation).
  { label: 'hardcoded "32.5%" MCA opening pool', pattern: /32\.5%/ },
  // A literal "+5%" anywhere — subscription accelerator cap must come from pct().
  { label: 'hardcoded "+5%" subscription accelerator cap', pattern: /\+5%/ },
  // A literal "20%" as a standalone quoted string — override cap must come from pct().
  { label: 'hardcoded "20%" override cap as string literal', pattern: /['"]\s*20%\s*['"]/ },
  // A bare "$1,497" string literal — tier_4 retail must come from usd() or COMP_V2026.
  { label: 'hardcoded "$1,497" tier_4 retail price', pattern: /['"]\$1,497['"]/ },
  // A bare "$149" string literal — tier_1 retail / small_agency fee must come from config.
  { label: 'hardcoded "$149" as string literal', pattern: /['"]\$149['"]/ },
];

describe("compensation UI pages — import guard and no hardcoded literals", () => {
  for (const relPath of COMPENSATION_SURFACES) {
    it(`${relPath} imports COMP_V2026 from @shared/compensation`, () => {
      const src = readSource(relPath);
      expect(src).toMatch(/from\s+['"]@shared\/compensation['"]/);
      expect(src).toMatch(/COMP_V2026/);
    });
  }

  for (const relPath of ["client/src/pages/commissions.tsx", "client/src/pages/opportunity.tsx"]) {
    it(`${relPath} imports pct and usd from @shared/compensation-format`, () => {
      const src = readSource(relPath);
      expect(src).toMatch(/from\s+['"]@shared\/compensation-format['"]/);
    });
  }

  for (const { label, pattern } of GUARDED_LITERALS) {
    for (const relPath of COMPENSATION_SURFACES) {
      it(`${relPath} has no ${label}`, () => {
        const src = readSource(relPath);
        expect(
          src,
          `Found /${pattern.source}/ in ${relPath}. Use the COMP_V2026 field + pct()/usd() instead.`,
        ).not.toMatch(pattern);
      });
    }
  }
});
