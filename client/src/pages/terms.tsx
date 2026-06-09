import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Shield } from "lucide-react";
import { usePageMeta } from "@/hooks/use-page-meta";

export default function TermsOfServicePage() {
  usePageMeta(
    "Terms of Service | Leader Shield Funding",
    "Leader Shield Funding terms of service governing use of the platform, agent agreements, and commission structures.",
  );
  return (
    <div className="min-h-screen bg-background">
      <nav className="sticky top-0 z-50 bg-background/95 backdrop-blur-xl border-b border-border">
        <div className="max-w-4xl mx-auto px-6 h-16 flex items-center justify-between gap-4 flex-wrap">
          <Link href="/" data-testid="link-logo-terms" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
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
        <h1 className="text-4xl font-display font-bold text-primary mb-2" data-testid="text-terms-title">Terms of Service</h1>
        <p className="text-muted-foreground mb-12" data-testid="text-terms-effective-date">Last Updated: January 1, 2025</p>

        <div className="prose prose-neutral dark:prose-invert max-w-none space-y-10 text-foreground">
          <section data-testid="section-introduction">
            <h2 className="text-2xl font-bold text-primary mb-4">1. Introduction and Acceptance</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              Welcome to Leader Shield Funding ("Company," "we," "us," or "our"). These Terms of Service ("Terms") govern your access to and use of the Leader Shield Funding platform, website, mobile applications, and all related services (collectively, the "Platform"). By creating an account, accessing, or using the Platform, you ("Agent," "you," or "your") acknowledge that you have read, understood, and agree to be bound by these Terms and all applicable laws and regulations.
            </p>
            <p className="text-muted-foreground leading-relaxed">
              If you do not agree with any part of these Terms, you must not access or use the Platform. We reserve the right to modify these Terms at any time. Your continued use of the Platform following any changes constitutes acceptance of those changes.
            </p>
          </section>

          <section data-testid="section-eligibility">
            <h2 className="text-2xl font-bold text-primary mb-4">2. Account Eligibility</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">To create an account and participate as an independent agent on the Leader Shield Funding Platform, you must:</p>
            <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
              <li>Be at least 18 years of age (or the age of majority in your jurisdiction, whichever is greater).</li>
              <li>Be a legal resident of the United States or a U.S. territory where participation is permitted.</li>
              <li>Provide accurate, current, and complete information during registration and maintain the accuracy of such information.</li>
              <li>Have the legal capacity to enter into a binding agreement.</li>
              <li>Not have been previously terminated or suspended from the Leader Shield Funding for cause.</li>
              <li>Comply with all applicable federal, state, and local laws and regulations, including those related to financial services, merchant cash advance brokering, and direct selling.</li>
            </ul>
            <p className="text-muted-foreground leading-relaxed mt-4">
              You are responsible for maintaining the confidentiality of your account credentials and are fully responsible for all activities that occur under your account.
            </p>
          </section>

          <section data-testid="section-independent-contractor">
            <h2 className="text-2xl font-bold text-primary mb-4">3. Independent Contractor Relationship</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              You expressly acknowledge and agree that you are an independent contractor and NOT an employee, partner, joint venturer, franchisee, or legal representative of Leader Shield Funding. As an independent contractor:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
              <li>You have no authority to bind the Company to any contract, obligation, or representation.</li>
              <li>You are solely responsible for determining the manner and means by which you perform your activities, subject to these Terms.</li>
              <li>You are responsible for all of your own taxes, including federal and state income taxes, self-employment taxes, sales taxes, and any other applicable taxes.</li>
              <li>You are not entitled to any employee benefits, including but not limited to health insurance, retirement benefits, workers' compensation, or unemployment insurance.</li>
              <li>The Company will issue IRS Form 1099 (or equivalent) for commissions and earnings exceeding the applicable reporting threshold.</li>
              <li>You are responsible for obtaining any licenses, permits, or registrations required in your jurisdiction to conduct business as a merchant cash advance broker or direct seller.</li>
            </ul>
          </section>

          <section data-testid="section-commission-terms">
            <h2 className="text-2xl font-bold text-primary mb-4">4. Commission Terms and Conditions</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              Leader Shield Funding offers multiple compensation streams. All commission rates, structures, and terms are subject to the current Compensation Plan, which is incorporated herein by reference.
            </p>

            <h3 className="text-lg font-semibold text-primary mt-6 mb-3">4.1 MCA (Merchant Cash Advance) Commissions</h3>
            <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
              <li>Commissions are calculated as a percentage of the Gross Brokerage Revenue (GBR) generated from funded MCA deals.</li>
              <li>The base commission rate is 22% of GBR, subject to adjustments based on performance tiers and accelerators.</li>
              <li>70% of the commission is paid upon funding; the remaining 30% is deferred and paid upon satisfactory performance of the advance.</li>
              <li>Quarterly performance accelerators of up to an additional 3% may apply based on volume targets.</li>
            </ul>

            <h3 className="text-lg font-semibold text-primary mt-6 mb-3">4.2 Subscription Platform Commissions</h3>
            <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
              <li>Commissions on Merchant Growth Platform subscriptions are paid from a commission pool ranging from 50% to 70% of the subscription fee, depending on the tier.</li>
              <li>Aggressive upfront payouts apply during months 1 through 3 of each subscription.</li>
              <li>After month 12, agents receive a lifetime 10% residual commission for as long as the subscription remains active.</li>
              <li>The Pairing Enhancement Bonus of +5% applies when a subscription is bundled with an MCA deal within the qualifying period.</li>
            </ul>

            <h3 className="text-lg font-semibold text-primary mt-6 mb-3">4.3 Override and Team Commissions</h3>
            <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
              <li>Override commissions are earned based on the production of agents in your downline, as defined in the Compensation Plan.</li>
              <li>Override percentages vary by rank and the depth of your organization.</li>
              <li>You must maintain active status and meet minimum personal production requirements to qualify for override commissions.</li>
            </ul>

            <h3 className="text-lg font-semibold text-primary mt-6 mb-3">4.4 Payment Terms</h3>
            <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
              <li>Commissions are processed and paid on a bi-weekly basis (1st and 15th of each month), subject to a minimum payout threshold of $50.</li>
              <li>Payments are made via ACH direct deposit to the bank account on file in your agent profile.</li>
              <li>The Company reserves the right to withhold commissions pending verification of deal legitimacy, merchant performance, or compliance review.</li>
            </ul>
          </section>

          <section data-testid="section-clawback">
            <h2 className="text-2xl font-bold text-primary mb-4">5. Clawback and Chargeback Policies</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              To protect the integrity of the Leader Shield Funding and its financial partners, the following clawback and chargeback provisions apply:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
              <li><strong>MCA Clawbacks:</strong> If a funded MCA deal defaults, is fraudulently obtained, or is subject to early payoff within the first 90 days, the deferred 30% commission will not be paid and any previously paid commission may be subject to partial or full clawback.</li>
              <li><strong>Subscription Chargebacks:</strong> If a subscription is canceled within the first 30 days (cooling-off period), all commissions paid on that subscription will be charged back in full.</li>
              <li><strong>Fraudulent Activity:</strong> Any commission earned through fraudulent, misleading, or deceptive practices will be clawed back in full and may result in immediate termination and legal action.</li>
              <li><strong>Chargeback Process:</strong> The Company will notify you of any pending clawback or chargeback. Amounts owed may be deducted from future commission payments or invoiced separately if no future commissions are available.</li>
            </ul>
          </section>

          <section data-testid="section-acceptable-use">
            <h2 className="text-2xl font-bold text-primary mb-4">6. Acceptable Use Policy</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">When using the Platform and representing Leader Shield Funding, you agree to:</p>
            <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
              <li>Conduct all business activities honestly, ethically, and in compliance with applicable laws.</li>
              <li>Not make any income claims, guarantees, or representations that are false, misleading, or not substantiated by the Company's official Income Disclosure Statement.</li>
              <li>Not engage in high-pressure sales tactics, spam, or unsolicited bulk communications.</li>
              <li>Not misrepresent the nature of the business opportunity, the products, or the compensation plan.</li>
              <li>Not use the Company's trademarks, logos, or materials in any unauthorized or misleading manner.</li>
              <li>Not recruit agents for competing business opportunities while active with Leader Shield Funding.</li>
              <li>Comply with all FTC guidelines regarding endorsements, testimonials, and income representations.</li>
              <li>Not attempt to circumvent, hack, reverse engineer, or otherwise interfere with the Platform's security or functionality.</li>
              <li>Not upload or transmit any viruses, malware, or other harmful code.</li>
              <li>Respect the intellectual property rights of the Company and third parties.</li>
            </ul>
          </section>

          <section data-testid="section-termination">
            <h2 className="text-2xl font-bold text-primary mb-4">7. Termination</h2>

            <h3 className="text-lg font-semibold text-primary mt-6 mb-3">7.1 Voluntary Termination</h3>
            <p className="text-muted-foreground leading-relaxed mb-4">
              You may terminate your participation at any time by providing written notice to the Company. Upon voluntary termination, you forfeit all rights to future commissions, override earnings, and your position in the organization, except for any commissions already earned and not yet paid.
            </p>

            <h3 className="text-lg font-semibold text-primary mt-6 mb-3">7.2 Involuntary Termination</h3>
            <p className="text-muted-foreground leading-relaxed mb-4">The Company may terminate or suspend your account immediately, with or without notice, for any of the following reasons:</p>
            <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
              <li>Violation of these Terms or the Compensation Plan.</li>
              <li>Fraudulent, illegal, or unethical conduct.</li>
              <li>Failure to meet minimum activity or production requirements for a period exceeding 90 consecutive days.</li>
              <li>Making unauthorized income claims or misleading representations.</li>
              <li>Actions that damage the reputation or goodwill of the Company.</li>
              <li>Breach of confidentiality or misuse of proprietary information.</li>
            </ul>

            <h3 className="text-lg font-semibold text-primary mt-6 mb-3">7.3 Effects of Termination</h3>
            <p className="text-muted-foreground leading-relaxed">
              Upon termination, your access to the Platform will be revoked, and you must immediately cease representing yourself as a Leader Shield Funding agent. Any pending commissions will be reviewed and paid in accordance with the Compensation Plan, less any applicable clawbacks, chargebacks, or amounts owed to the Company.
            </p>
          </section>

          <section data-testid="section-dispute-resolution">
            <h2 className="text-2xl font-bold text-primary mb-4">8. Dispute Resolution</h2>

            <h3 className="text-lg font-semibold text-primary mt-6 mb-3">8.1 Informal Resolution</h3>
            <p className="text-muted-foreground leading-relaxed mb-4">
              Before initiating any formal dispute resolution process, you agree to first attempt to resolve any dispute informally by contacting the Company at legal@leadershieldnetwork.com. The parties will attempt in good faith to resolve the dispute within 30 days.
            </p>

            <h3 className="text-lg font-semibold text-primary mt-6 mb-3">8.2 Binding Arbitration</h3>
            <p className="text-muted-foreground leading-relaxed mb-4">
              If informal resolution is unsuccessful, any dispute, controversy, or claim arising out of or relating to these Terms, or the breach thereof, shall be settled by binding arbitration administered by the American Arbitration Association (AAA) under its Commercial Arbitration Rules. The arbitration shall be conducted by a single arbitrator and shall take place in the state where the Company's principal office is located.
            </p>

            <h3 className="text-lg font-semibold text-primary mt-6 mb-3">8.3 Class Action Waiver</h3>
            <p className="text-muted-foreground leading-relaxed">
              YOU AGREE THAT ANY DISPUTE RESOLUTION PROCEEDINGS WILL BE CONDUCTED ONLY ON AN INDIVIDUAL BASIS AND NOT IN A CLASS, CONSOLIDATED, OR REPRESENTATIVE ACTION. You waive any right to participate in a class action lawsuit or class-wide arbitration against the Company.
            </p>
          </section>

          <section data-testid="section-limitation-liability">
            <h2 className="text-2xl font-bold text-primary mb-4">9. Limitation of Liability</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
              <li>THE PLATFORM IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, WHETHER EXPRESS, IMPLIED, OR STATUTORY, INCLUDING BUT NOT LIMITED TO WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT.</li>
              <li>THE COMPANY SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING BUT NOT LIMITED TO LOSS OF PROFITS, DATA, USE, GOODWILL, OR OTHER INTANGIBLE LOSSES.</li>
              <li>THE COMPANY'S TOTAL AGGREGATE LIABILITY ARISING OUT OF OR RELATED TO THESE TERMS SHALL NOT EXCEED THE TOTAL COMMISSIONS PAID TO YOU DURING THE SIX (6) MONTHS IMMEDIATELY PRECEDING THE EVENT GIVING RISE TO THE CLAIM, OR $500, WHICHEVER IS GREATER.</li>
              <li>THE COMPANY DOES NOT GUARANTEE ANY LEVEL OF INCOME OR EARNINGS. YOUR SUCCESS DEPENDS ON YOUR OWN EFFORT, SKILL, MARKET CONDITIONS, AND NUMEROUS OTHER FACTORS.</li>
            </ul>
          </section>

          <section data-testid="section-indemnification">
            <h2 className="text-2xl font-bold text-primary mb-4">10. Indemnification</h2>
            <p className="text-muted-foreground leading-relaxed">
              You agree to indemnify, defend, and hold harmless Leader Shield Funding, its officers, directors, employees, agents, affiliates, and partners from and against any and all claims, liabilities, damages, losses, costs, and expenses (including reasonable attorneys' fees) arising out of or in any way connected with: (a) your access to or use of the Platform; (b) your violation of these Terms; (c) your violation of any applicable law or regulation; (d) your representations or conduct in connection with your role as an agent; or (e) any dispute between you and a third party, including merchants, customers, or other agents.
            </p>
          </section>

          <section data-testid="section-intellectual-property">
            <h2 className="text-2xl font-bold text-primary mb-4">11. Intellectual Property</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              All content, features, and functionality of the Platform, including but not limited to text, graphics, logos, trademarks, training materials, software, and documentation, are the exclusive property of Leader Shield Funding or its licensors and are protected by copyright, trademark, and other intellectual property laws.
            </p>
            <p className="text-muted-foreground leading-relaxed">
              You are granted a limited, non-exclusive, non-transferable, revocable license to access and use the Platform solely for the purpose of conducting authorized business activities as a Leader Shield Funding agent. This license does not include the right to modify, reproduce, distribute, or create derivative works from any Platform content without prior written consent.
            </p>
          </section>

          <section data-testid="section-confidentiality">
            <h2 className="text-2xl font-bold text-primary mb-4">12. Confidentiality</h2>
            <p className="text-muted-foreground leading-relaxed">
              You agree to keep confidential all non-public information disclosed by the Company, including but not limited to business strategies, financial data, agent lists, customer information, commission structures, and proprietary technology. This obligation survives termination of your participation in the Leader Shield Funding. Unauthorized disclosure of confidential information may result in immediate termination and legal action.
            </p>
          </section>

          <section data-testid="section-governing-law">
            <h2 className="text-2xl font-bold text-primary mb-4">13. Governing Law</h2>
            <p className="text-muted-foreground leading-relaxed">
              These Terms shall be governed by and construed in accordance with the laws of the State of Delaware, without regard to its conflict of law provisions. Any legal action or proceeding not subject to arbitration shall be brought exclusively in the state or federal courts located in the State of Delaware, and you consent to the personal jurisdiction of such courts.
            </p>
          </section>

          <section data-testid="section-modification">
            <h2 className="text-2xl font-bold text-primary mb-4">14. Modification of Terms</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              The Company reserves the right to modify, amend, or update these Terms at any time at its sole discretion. Material changes will be communicated to you via email notification or through a prominent notice on the Platform at least 30 days before they take effect.
            </p>
            <p className="text-muted-foreground leading-relaxed">
              Your continued use of the Platform after the effective date of any modifications constitutes your acceptance of the updated Terms. If you do not agree to the modified Terms, you must discontinue your use of the Platform and terminate your account.
            </p>
          </section>

          <section data-testid="section-severability">
            <h2 className="text-2xl font-bold text-primary mb-4">15. Severability and Entire Agreement</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              If any provision of these Terms is found to be unenforceable or invalid by a court of competent jurisdiction, that provision shall be limited or eliminated to the minimum extent necessary so that these Terms shall otherwise remain in full force and effect.
            </p>
            <p className="text-muted-foreground leading-relaxed">
              These Terms, together with the Compensation Plan, Privacy Policy, and any other policies or agreements referenced herein, constitute the entire agreement between you and the Company regarding your use of the Platform and supersede all prior or contemporaneous agreements, communications, and proposals, whether oral or written.
            </p>
          </section>

          <section data-testid="section-contact">
            <h2 className="text-2xl font-bold text-primary mb-4">16. Contact Information</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              If you have questions or concerns about these Terms of Service, please contact us:
            </p>
            <div className="bg-muted/30 border border-border rounded-md p-6 text-muted-foreground space-y-2">
              <p><strong className="text-foreground">Leader Shield Funding Legal Department</strong></p>
              <p>Email: legal@leadershieldnetwork.com</p>
              <p>Phone: 1-800-LEADER-1</p>
              <p>Address: Leader Shield Funding LLC, Wilmington, DE 19801</p>
            </div>
          </section>
        </div>

        <div className="mt-16 pt-8 border-t border-border text-center">
          <p className="text-sm text-muted-foreground mb-4">
            By using the Leader Shield Funding Platform, you acknowledge that you have read, understood, and agree to be bound by these Terms of Service.
          </p>
          <div className="flex items-center justify-center gap-4 flex-wrap">
            <Link href="/privacy">
              <Button variant="outline" size="sm" data-testid="link-privacy-policy">Privacy Policy</Button>
            </Link>
            <Link href="/income-disclosure">
              <Button variant="outline" size="sm" data-testid="link-income-disclosure">Income Disclosure</Button>
            </Link>
            <Link href="/refund-policy">
              <Button variant="outline" size="sm" data-testid="link-refund-policy">Refund Policy</Button>
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}