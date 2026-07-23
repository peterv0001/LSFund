// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { WaterfallBreakdown } from "./deals";

afterEach(() => {
  cleanup();
});

describe("WaterfallBreakdown commission model branching", () => {
  it("renders the v2026 layout when commissionModel === 'v2026'", () => {
    render(
      <WaterfallBreakdown deal={{ gbrAmount: "10000", commissionModel: "v2026" }} />,
    );

    expect(screen.getByText("Gross Funding Commission")).toBeTruthy();
    // 32.5% Opening Agent Pool of $10,000
    expect(
      screen.getByText(/Opening Agent Pool \(32\.5% = \$3250\.00\)/),
    ).toBeTruthy();
    // Accelerator cap of +2.5% = $250
    expect(
      screen.getByText(/Performance Accelerators \(up to \+2\.5%\)/),
    ).toBeTruthy();
    expect(screen.getByText("up to $250.00")).toBeTruthy();

    // No legacy waterfall elements.
    expect(screen.queryByText("GBR Amount (legacy)")).toBeNull();
    expect(screen.queryByText(/MAC \(30% of GBR/)).toBeNull();
    expect(screen.queryByText(/TFC \(30-40% of GBR\)/)).toBeNull();
    expect(screen.queryByText(/PICF \(25-35% of GBR\)/)).toBeNull();
    expect(screen.queryByText(/RSR \(5% of GBR\)/)).toBeNull();
  });

  function expectLegacyWaterfall() {
    expect(screen.getByText("GBR Amount (legacy)")).toBeTruthy();
    // MAC total 30% of $10,000 with its sub-splits.
    expect(screen.getByText(/MAC \(30% of GBR = \$3000\.00\)/)).toBeTruthy();
    expect(screen.getByText("Primary Agent (22%)")).toBeTruthy();
    expect(screen.getByText("$2200.00")).toBeTruthy();
    expect(screen.getByText("Senior Sponsor L1 (5%)")).toBeTruthy();
    expect(screen.getByText("Executive Sponsor L2 (3%)")).toBeTruthy();
    // TFC, PICF, RSR rows.
    expect(screen.getByText(/TFC \(30-40% of GBR\)/)).toBeTruthy();
    expect(screen.getByText("$3000.00 - $4000.00")).toBeTruthy();
    expect(screen.getByText(/PICF \(25-35% of GBR\)/)).toBeTruthy();
    expect(screen.getByText("$2500.00 - $3500.00")).toBeTruthy();
    expect(screen.getByText(/RSR \(5% of GBR\)/)).toBeTruthy();

    // No v2026 elements.
    expect(screen.queryByText("Gross Funding Commission")).toBeNull();
    expect(screen.queryByText(/Opening Agent Pool/)).toBeNull();
    expect(screen.queryByText(/Performance Accelerators/)).toBeNull();
  }

  it("renders the legacy GBR waterfall when commissionModel === 'legacy'", () => {
    render(
      <WaterfallBreakdown deal={{ gbrAmount: "10000", commissionModel: "legacy" }} />,
    );
    expectLegacyWaterfall();
  });

  it("renders the legacy GBR waterfall when commissionModel is null", () => {
    render(
      <WaterfallBreakdown deal={{ gbrAmount: "10000", commissionModel: null }} />,
    );
    expectLegacyWaterfall();
  });

  it("renders the legacy GBR waterfall when commissionModel is missing entirely", () => {
    render(<WaterfallBreakdown deal={{ gbrAmount: "10000" }} />);
    expectLegacyWaterfall();
  });
});
