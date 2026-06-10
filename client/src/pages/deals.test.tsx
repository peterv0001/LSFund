// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, waitFor, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { insertDealSchema } from "@shared/schema";

// The deals page pulls in the sidebar (with its own data needs) and the auth
// hook; neither is relevant to the MCA wizard behavior under test, so we stub
// them out. `useCreateDeal` is replaced with a spy so we can inspect the exact
// payload `onSubmit` sends to the API.
const dealState = vi.hoisted(() => ({
  createDeal: vi.fn(async (_payload: unknown) => ({ id: 1 })),
}));

vi.mock("@/components/Sidebar", () => ({
  Sidebar: () => null,
  MobileHeaderSpacer: () => null,
}));

vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({
    user: { id: 1, firstName: "Test", lastName: "Agent" },
    isLoading: false,
  }),
}));

vi.mock("@/hooks/use-deals", () => ({
  useDeals: () => ({ data: [], isLoading: false }),
  useCreateDeal: () => ({
    mutateAsync: dealState.createDeal,
    isPending: false,
  }),
}));

import DealsPage from "./deals";

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <DealsPage />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  // Polyfills required by Radix UI (Dialog + Select) under jsdom.
  window.HTMLElement.prototype.hasPointerCapture = vi.fn();
  window.HTMLElement.prototype.releasePointerCapture = vi.fn();
  window.HTMLElement.prototype.scrollIntoView = vi.fn();
  window.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  dealState.createDeal.mockClear();
});

afterEach(() => {
  cleanup();
});

async function fill(
  user: ReturnType<typeof userEvent.setup>,
  testId: string,
  value: string,
) {
  const el = screen.getByTestId(testId);
  await user.clear(el);
  await user.type(el, value);
}

// Drives the wizard from step 1 through to step 3 with all gating fields valid.
// `requestedAmount` is intentionally left blank so callers can assert the
// step-3 gate and submit fallback behave when it is omitted. The business state
// defaults to a non-disclosure state (TX) so the review step does not require
// the extra disclosure checkbox; pass a regulated state (e.g. "CA") to exercise
// the disclosure gate.
async function advanceToStep3(
  user: ReturnType<typeof userEvent.setup>,
  state = "TX",
) {
  await user.click(screen.getByTestId("button-submit-deal"));
  await screen.findByTestId("input-merchant-name");

  // Step 1: Business information.
  await fill(user, "input-merchant-name", "Acme Corp LLC");
  await fill(user, "input-merchant-phone", "5551234567");
  await fill(user, "input-business-address", "123 Main St");
  await fill(user, "input-business-city", "Austin");
  await user.click(screen.getByTestId("select-business-state"));
  await user.click(await screen.findByRole("option", { name: state }));
  await fill(user, "input-business-zip", "73301");
  await user.click(screen.getByTestId("button-next-step"));

  // Step 2: Owner information (ownership % defaults to 100).
  await screen.findByTestId("input-owner-first-name");
  await fill(user, "input-owner-first-name", "John");
  await fill(user, "input-owner-last-name", "Smith");
  await fill(user, "input-owner-phone", "5559876543");
  await user.click(screen.getByTestId("button-next-step"));

  // Step 3: Funding details (requested amount left blank on purpose).
  await screen.findByTestId("input-loan-amount");
  await fill(user, "input-loan-amount", "50000");
  await fill(user, "input-avg-monthly-revenue", "25000");
}

describe("insertDealSchema requestedAmount", () => {
  const requestedAmount = insertDealSchema.shape.requestedAmount;

  it("coerces blank/empty values to undefined", () => {
    expect(requestedAmount.parse("")).toBeUndefined();
    expect(requestedAmount.parse(null)).toBeUndefined();
    expect(requestedAmount.parse(undefined)).toBeUndefined();
  });

  it("accepts a valid funding amount", () => {
    expect(requestedAmount.parse("50000")).toBe(50000);
    expect(requestedAmount.parse(50000)).toBe(50000);
  });

  it("rejects a non-blank value below $1,000", () => {
    const result = requestedAmount.safeParse("500");
    expect(result.success).toBe(false);
  });
});

describe("MCA deal wizard — optional requested funding amount", () => {
  it("lets the step-3 Next gate pass when requested amount is blank", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    renderPage();

    await advanceToStep3(user);

    // Requested amount field exists but is left empty.
    expect(
      (screen.getByTestId("input-requested-amount") as HTMLInputElement).value,
    ).toBe("");

    await user.click(screen.getByTestId("button-next-step"));

    // Reaching the review step proves the step-3 gate accepted a blank
    // requested amount.
    expect(
      await screen.findByRole("heading", { name: "Review & Submit" }),
    ).toBeTruthy();
  });

  it("falls back to the loan amount when requested amount is blank on submit", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    renderPage();

    await advanceToStep3(user);
    await user.click(screen.getByTestId("button-next-step"));
    await screen.findByRole("heading", { name: "Review & Submit" });

    // The submit button is enabled on the review step (no disclosure needed
    // for a TX merchant, and nothing is pending).
    await waitFor(() =>
      expect(
        (screen.getByTestId("button-submit-application") as HTMLButtonElement)
          .disabled,
      ).toBe(false),
    );

    await user.click(screen.getByTestId("button-submit-application"));

    await waitFor(() => expect(dealState.createDeal).toHaveBeenCalledTimes(1));

    const payload = dealState.createDeal.mock.calls[0][0] as unknown as {
      loanAmount: number;
      requestedAmount: number;
    };
    expect(payload.loanAmount).toBe(50000);
    expect(payload.requestedAmount).toBe(50000);
  });
});

describe("MCA deal wizard — regulated-state disclosure gate", () => {
  it("keeps Submit disabled for a regulated state (CA) until the disclosure box is checked", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    renderPage();

    await advanceToStep3(user, "CA");
    await user.click(screen.getByTestId("button-next-step"));
    await screen.findByRole("heading", { name: "Review & Submit" });

    // The disclosure acknowledgment must be present for a regulated state.
    const disclosure = screen.getByTestId(
      "checkbox-state-disclosure",
    ) as HTMLInputElement;
    expect(disclosure).toBeTruthy();
    expect(disclosure.checked).toBe(false);

    const submit = screen.getByTestId(
      "button-submit-application",
    ) as HTMLButtonElement;

    // Even after the submit button is otherwise armed, it stays disabled while
    // the disclosure box is unchecked.
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(submit.disabled).toBe(true);

    // Checking the box releases the gate.
    await user.click(disclosure);
    await waitFor(() => expect(submit.disabled).toBe(false));

    await user.click(submit);
    await waitFor(() => expect(dealState.createDeal).toHaveBeenCalledTimes(1));

    const payload = dealState.createDeal.mock.calls[0][0] as unknown as {
      businessState: string;
      stateDisclosureConfirmed: boolean;
    };
    expect(payload.businessState).toBe("CA");
    expect(payload.stateDisclosureConfirmed).toBe(true);
  });

  it("shows no disclosure box for a non-regulated state (TX) and allows submission", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    renderPage();

    await advanceToStep3(user, "TX");
    await user.click(screen.getByTestId("button-next-step"));
    await screen.findByRole("heading", { name: "Review & Submit" });

    // No disclosure acknowledgment for a non-regulated state.
    expect(screen.queryByTestId("checkbox-state-disclosure")).toBeNull();

    const submit = screen.getByTestId(
      "button-submit-application",
    ) as HTMLButtonElement;
    await waitFor(() => expect(submit.disabled).toBe(false));

    await user.click(submit);
    await waitFor(() => expect(dealState.createDeal).toHaveBeenCalledTimes(1));

    const payload = dealState.createDeal.mock.calls[0][0] as unknown as {
      businessState: string;
    };
    expect(payload.businessState).toBe("TX");
  });
});
