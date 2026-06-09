import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowLeft, CreditCard, XCircle, Clock, HelpCircle, AlertTriangle, Shield } from "lucide-react";

export default function RefundPolicyPage() {
  return (
    <div className="min-h-screen bg-background">
      <nav className="sticky top-0 z-50 bg-background/95 backdrop-blur-xl border-b border-border">
        <div className="max-w-4xl mx-auto px-6 h-16 flex items-center justify-between gap-4 flex-wrap">
          <Link href="/" data-testid="link-logo-refund-policy" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <Shield className="w-4 h-4 text-primary shrink-0" />
            <span className="font-display font-bold text-primary text-base tracking-wide">Leader Shield Funding</span>
          </Link>
          <Link href="/">
            <Button variant="ghost" size="sm" data-testid="button-back-home">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Home
            </Button>
          </Link>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-6 py-16">
        <div className="mb-12">
          <h1 className="text-4xl font-display font-bold text-primary mb-4" data-testid="text-refund-policy-title">
            Refund & Cancellation Policy
          </h1>
          <p className="text-muted-foreground" data-testid="text-refund-effective-date">
            Effective Date: January 1, 2025 | Last Updated: January 1, 2025
          </p>
        </div>

        <div className="prose prose-neutral dark:prose-invert max-w-none space-y-10">
          <section data-testid="section-overview">
            <div className="flex items-start gap-3 mb-4">
              <CreditCard className="w-6 h-6 text-primary flex-shrink-0 mt-1" />
              <h2 className="text-2xl font-bold text-primary m-0">1. Overview</h2>
            </div>
            <p className="text-muted-foreground leading-relaxed">
              This Refund & Cancellation Policy applies to the subscription products offered through the Leader Shield
              Funding Merchant Growth Platform, including Merchant Essentials, Growth Accelerator, and Elite AI Revenue
              System (collectively, "Subscription Products"). By purchasing or subscribing to any of these products,
              you agree to the terms outlined in this policy.
            </p>
          </section>

          <section data-testid="section-subscription-products">
            <div className="flex items-start gap-3 mb-4">
              <CreditCard className="w-6 h-6 text-primary flex-shrink-0 mt-1" />
              <h2 className="text-2xl font-bold text-primary m-0">2. Subscription Products & Pricing</h2>
            </div>
            <p className="text-muted-foreground leading-relaxed mb-4">
              The Merchant Growth Platform offers three subscription tiers, each billed on a monthly recurring basis:
            </p>
            <div className="space-y-3 ml-4">
              <div className="flex items-start gap-3">
                <span className="font-semibold text-foreground min-w-[200px]">Merchant Essentials</span>
                <span className="text-muted-foreground">$199/month — Financial reporting, forecasting, AI expense categorization, and credit monitoring.</span>
              </div>
              <div className="flex items-start gap-3">
                <span className="font-semibold text-foreground min-w-[200px]">Growth Accelerator</span>
                <span className="text-muted-foreground">$429/month — All Essentials features plus CRM, lead generation, marketing automation, and competitor intelligence.</span>
              </div>
              <div className="flex items-start gap-3">
                <span className="font-semibold text-foreground min-w-[200px]">Elite AI Revenue System</span>
                <span className="text-muted-foreground">$749/month — Full platform access including AI revenue optimization, custom integrations, and dedicated support.</span>
              </div>
            </div>
          </section>

          <section data-testid="section-cancellation-terms">
            <div className="flex items-start gap-3 mb-4">
              <XCircle className="w-6 h-6 text-primary flex-shrink-0 mt-1" />
              <h2 className="text-2xl font-bold text-primary m-0">3. Subscription Cancellation Terms</h2>
            </div>
            <p className="text-muted-foreground leading-relaxed mb-4">
              You may cancel your subscription at any time. Cancellation terms are as follows:
            </p>
            <ul className="list-disc pl-6 space-y-3 text-muted-foreground">
              <li>
                <span className="font-semibold text-foreground">Monthly Subscriptions:</span> Cancellations take effect at the end of the current billing cycle. You will continue to have access to the platform and its features until the end of your paid period. No partial-month refunds will be issued.
              </li>
              <li>
                <span className="font-semibold text-foreground">How to Cancel:</span> You may cancel your subscription by contacting our support team at support@leadershieldnetwork.com, through your account settings in the Merchant Growth Platform portal, or by calling our customer service line. Written confirmation of cancellation will be provided via email.
              </li>
              <li>
                <span className="font-semibold text-foreground">Automatic Renewal:</span> All subscriptions automatically renew at the end of each billing period unless cancelled prior to the renewal date. It is your responsibility to cancel before the renewal date to avoid being charged for the next billing cycle.
              </li>
              <li>
                <span className="font-semibold text-foreground">Downgrade Option:</span> Instead of cancelling entirely, subscribers may downgrade to a lower tier at any time. Downgrades take effect at the start of the next billing cycle.
              </li>
            </ul>
          </section>

          <section data-testid="section-cooling-off">
            <div className="flex items-start gap-3 mb-4">
              <Clock className="w-6 h-6 text-primary flex-shrink-0 mt-1" />
              <h2 className="text-2xl font-bold text-primary m-0">4. Cooling-Off Period</h2>
            </div>
            <p className="text-muted-foreground leading-relaxed mb-4">
              Leader Shield Funding provides a <span className="font-semibold text-foreground">14-day cooling-off period</span> for all new subscription purchases. This means:
            </p>
            <ul className="list-disc pl-6 space-y-3 text-muted-foreground">
              <li>If you are a new subscriber and wish to cancel within 14 calendar days of your initial purchase date, you are entitled to a full refund of your first month's subscription fee.</li>
              <li>The cooling-off period applies only to the initial subscription purchase and does not apply to subscription renewals.</li>
              <li>To exercise your cooling-off rights, you must notify us in writing (email or support ticket) within the 14-day window.</li>
              <li>Refunds under the cooling-off period will be processed within 10 business days of the cancellation request.</li>
              <li>Some jurisdictions may provide longer cooling-off periods. Where applicable law provides a longer period, the longer period will apply.</li>
            </ul>
          </section>

          <section data-testid="section-refund-eligibility">
            <div className="flex items-start gap-3 mb-4">
              <CreditCard className="w-6 h-6 text-primary flex-shrink-0 mt-1" />
              <h2 className="text-2xl font-bold text-primary m-0">5. Refund Eligibility</h2>
            </div>
            <p className="text-muted-foreground leading-relaxed mb-4">
              Beyond the 14-day cooling-off period, refunds may be issued at Leader Shield Funding's discretion under the following circumstances:
            </p>
            <ul className="list-disc pl-6 space-y-3 text-muted-foreground">
              <li>
                <span className="font-semibold text-foreground">Service Outages:</span> If the platform experiences extended downtime (more than 72 consecutive hours) that prevents you from accessing core features, you may be eligible for a prorated refund or service credit for the affected period.
              </li>
              <li>
                <span className="font-semibold text-foreground">Billing Errors:</span> If you were charged in error (e.g., duplicate charges, charges after confirmed cancellation), a full refund for the erroneous charge(s) will be issued promptly.
              </li>
              <li>
                <span className="font-semibold text-foreground">Material Misrepresentation:</span> If the product or service materially fails to match the description provided at the time of purchase, you may request a refund within 30 days of discovering the discrepancy.
              </li>
              <li>
                <span className="font-semibold text-foreground">Unauthorized Charges:</span> If charges were made without your authorization, please contact us immediately. Unauthorized charges will be refunded in full upon verification.
              </li>
            </ul>
          </section>

          <section data-testid="section-refund-process">
            <div className="flex items-start gap-3 mb-4">
              <HelpCircle className="w-6 h-6 text-primary flex-shrink-0 mt-1" />
              <h2 className="text-2xl font-bold text-primary m-0">6. Process for Requesting Refunds</h2>
            </div>
            <p className="text-muted-foreground leading-relaxed mb-4">
              To request a refund, please follow these steps:
            </p>
            <ol className="list-decimal pl-6 space-y-3 text-muted-foreground">
              <li>
                <span className="font-semibold text-foreground">Submit a Request:</span> Email support@leadershieldnetwork.com with the subject line "Refund Request" or submit a ticket through the support portal. Include your account email, subscription tier, date of purchase, and reason for the refund request.
              </li>
              <li>
                <span className="font-semibold text-foreground">Review Period:</span> Our billing team will review your request within 5 business days and may request additional information if needed.
              </li>
              <li>
                <span className="font-semibold text-foreground">Decision & Processing:</span> If approved, refunds will be processed to the original payment method within 10 business days. You will receive an email confirmation once the refund has been processed.
              </li>
              <li>
                <span className="font-semibold text-foreground">Disputes:</span> If your refund request is denied and you disagree with the decision, you may escalate the matter by contacting legal@leadershieldnetwork.com.
              </li>
            </ol>
          </section>

          <section data-testid="section-non-refundable">
            <div className="flex items-start gap-3 mb-4">
              <AlertTriangle className="w-6 h-6 text-primary flex-shrink-0 mt-1" />
              <h2 className="text-2xl font-bold text-primary m-0">7. Non-Refundable Items</h2>
            </div>
            <p className="text-muted-foreground leading-relaxed mb-4">
              The following items and fees are non-refundable:
            </p>
            <ul className="list-disc pl-6 space-y-3 text-muted-foreground">
              <li>
                <span className="font-semibold text-foreground">Setup or Onboarding Fees:</span> Any one-time setup, activation, or onboarding fees charged at the time of initial enrollment are non-refundable.
              </li>
              <li>
                <span className="font-semibold text-foreground">Completed Service Periods:</span> Subscription fees for billing periods that have already been fully utilized (i.e., the billing cycle has ended) are non-refundable.
              </li>
              <li>
                <span className="font-semibold text-foreground">Training Materials & Digital Content:</span> Any training courses, digital downloads, or educational materials that have been accessed or downloaded are non-refundable.
              </li>
              <li>
                <span className="font-semibold text-foreground">Agent Enrollment Fees:</span> Fees paid by agents to join the Leader Shield Funding as independent contractors are non-refundable after the 14-day cooling-off period.
              </li>
              <li>
                <span className="font-semibold text-foreground">Custom Integrations & Add-Ons:</span> Any custom development, API integrations, or premium add-on services that have been delivered or initiated are non-refundable.
              </li>
            </ul>
          </section>

          <section data-testid="section-commission-clawbacks">
            <div className="flex items-start gap-3 mb-4">
              <AlertTriangle className="w-6 h-6 text-primary flex-shrink-0 mt-1" />
              <h2 className="text-2xl font-bold text-primary m-0">8. Impact on Agent Commissions</h2>
            </div>
            <p className="text-muted-foreground leading-relaxed mb-4">
              Agents should be aware that customer refunds and cancellations may affect their commission payments:
            </p>
            <ul className="list-disc pl-6 space-y-3 text-muted-foreground">
              <li>If a subscription is cancelled and refunded within the cooling-off period, any commissions paid to the referring agent for that subscription will be subject to clawback.</li>
              <li>If a subscription is cancelled after the cooling-off period, commissions earned on completed billing periods are not subject to clawback, but future residual commissions will cease.</li>
              <li>For MCA-related commissions, separate clawback provisions apply as detailed in the Agent Agreement and Commission & Compensation Overview.</li>
            </ul>
          </section>

          <section data-testid="section-modifications">
            <div className="flex items-start gap-3 mb-4">
              <HelpCircle className="w-6 h-6 text-primary flex-shrink-0 mt-1" />
              <h2 className="text-2xl font-bold text-primary m-0">9. Modifications to This Policy</h2>
            </div>
            <p className="text-muted-foreground leading-relaxed">
              Leader Shield Funding reserves the right to modify this Refund & Cancellation Policy at any time. Changes will be
              posted on this page with an updated "Last Updated" date. Material changes will be communicated to active subscribers
              via email at least 30 days prior to taking effect. Continued use of the Subscription Products after changes are posted
              constitutes your acceptance of the revised policy.
            </p>
          </section>

          <section data-testid="section-contact">
            <div className="flex items-start gap-3 mb-4">
              <HelpCircle className="w-6 h-6 text-primary flex-shrink-0 mt-1" />
              <h2 className="text-2xl font-bold text-primary m-0">10. Contact Information</h2>
            </div>
            <p className="text-muted-foreground leading-relaxed mb-4">
              If you have questions about this Refund & Cancellation Policy, need assistance with a cancellation, or wish to
              request a refund, please contact us:
            </p>
            <div className="space-y-2 text-muted-foreground ml-4">
              <p><span className="font-semibold text-foreground">Email:</span> support@leadershieldnetwork.com</p>
              <p><span className="font-semibold text-foreground">Billing Inquiries:</span> billing@leadershieldnetwork.com</p>
              <p><span className="font-semibold text-foreground">Legal Escalations:</span> legal@leadershieldnetwork.com</p>
              <p><span className="font-semibold text-foreground">Mailing Address:</span> Leader Shield Funding LLC, [Business Address], [City, State ZIP]</p>
            </div>
          </section>

          <div className="mt-12 pt-8 border-t border-border">
            <p className="text-sm text-muted-foreground text-center">
              This Refund & Cancellation Policy is part of the Leader Shield Funding Terms of Service. For complete terms governing
              your use of our platform and services, please review our{" "}
              <Link href="/terms" className="text-primary hover:underline" data-testid="link-terms">Terms of Service</Link>,{" "}
              <Link href="/privacy" className="text-primary hover:underline" data-testid="link-privacy">Privacy Policy</Link>, and{" "}
              <Link href="/income-disclosure" className="text-primary hover:underline" data-testid="link-income-disclosure">Income Disclosure Statement</Link>.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}