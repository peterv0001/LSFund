import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Shield, ArrowLeft, Lock, Eye, Database, Cookie, UserCheck, Trash2, Globe, Baby, MapPin, Mail } from "lucide-react";

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-background">
      <nav className="sticky top-0 z-50 bg-background/95 backdrop-blur-xl border-b border-border">
        <div className="max-w-4xl mx-auto px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link href="/">
              <Button variant="ghost" size="icon" data-testid="button-back-home">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <div className="flex items-center gap-2">
              <img src="/logo.png" alt="Leadershield Network" className="h-8 w-auto object-contain" />
            </div>
          </div>
          <Link href="/login">
            <Button variant="outline" size="sm" data-testid="button-login-privacy">Agent Login</Button>
          </Link>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-6 py-12">
        <div className="mb-10">
          <h1 className="text-4xl font-bold text-primary mb-3" data-testid="text-privacy-title">Privacy Policy</h1>
          <p className="text-muted-foreground" data-testid="text-privacy-effective-date">Effective Date: January 1, 2025 | Last Updated: January 1, 2025</p>
        </div>

        <div className="space-y-8">
          <Card data-testid="section-introduction">
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Lock className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-primary mb-3">Introduction</h2>
                  <p className="text-muted-foreground leading-relaxed">
                    Leadershield Network, LLC ("Leadershield," "we," "us," or "our") is committed to protecting
                    your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your
                    information when you visit our website, use our platform, or engage with our services as an
                    independent agent, merchant customer, or website visitor. Please read this policy carefully.
                    By accessing or using our services, you agree to the collection and use of information in
                    accordance with this policy. If you do not agree, please do not access or use our services.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card data-testid="section-data-collection">
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Database className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-primary mb-3">1. Information We Collect</h2>

                  <h3 className="text-lg font-semibold text-primary mt-4 mb-2">a. Personal Information</h3>
                  <p className="text-muted-foreground leading-relaxed mb-3">
                    We may collect personally identifiable information that you voluntarily provide when you
                    register for an account, apply to become an independent agent, or interact with our platform. This includes:
                  </p>
                  <ul className="list-disc list-inside space-y-1 text-muted-foreground ml-2 mb-4">
                    <li>Full legal name</li>
                    <li>Email address</li>
                    <li>Phone number</li>
                    <li>Mailing address</li>
                    <li>Date of birth</li>
                    <li>Social Security Number or Tax Identification Number (for commission payments and 1099 reporting)</li>
                    <li>Government-issued identification (for identity verification)</li>
                  </ul>

                  <h3 className="text-lg font-semibold text-primary mt-4 mb-2">b. Financial Information</h3>
                  <p className="text-muted-foreground leading-relaxed mb-3">
                    To process commission payments and manage your account, we may collect:
                  </p>
                  <ul className="list-disc list-inside space-y-1 text-muted-foreground ml-2 mb-4">
                    <li>Bank account information (for direct deposit of commissions)</li>
                    <li>Payment card details (processed through secure third-party payment processors)</li>
                    <li>Commission and earnings history</li>
                    <li>Transaction records related to MCA deals and subscription sales</li>
                  </ul>

                  <h3 className="text-lg font-semibold text-primary mt-4 mb-2">c. Usage Data</h3>
                  <p className="text-muted-foreground leading-relaxed mb-3">
                    We automatically collect certain information when you access our platform, including:
                  </p>
                  <ul className="list-disc list-inside space-y-1 text-muted-foreground ml-2 mb-4">
                    <li>IP address and geographic location</li>
                    <li>Browser type, version, and operating system</li>
                    <li>Pages visited, time spent, and navigation paths</li>
                    <li>Referring website or source</li>
                    <li>Device identifiers and mobile device information</li>
                    <li>Click-stream data and interaction patterns</li>
                  </ul>

                  <h3 className="text-lg font-semibold text-primary mt-4 mb-2">d. Communications Data</h3>
                  <p className="text-muted-foreground leading-relaxed">
                    If you contact us via email, phone, live chat, or through our platform's messaging features,
                    we may retain the content of those communications, your contact information, and our responses
                    for quality assurance and training purposes.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card data-testid="section-use-of-data">
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Eye className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-primary mb-3">2. How We Use Your Information</h2>
                  <p className="text-muted-foreground leading-relaxed mb-3">
                    We use the information we collect for the following purposes:
                  </p>
                  <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-2">
                    <li><strong>Account Management:</strong> To create, maintain, and manage your agent or merchant account</li>
                    <li><strong>Commission Processing:</strong> To calculate, track, and disburse commission payments and generate tax documentation (1099 forms)</li>
                    <li><strong>Platform Operations:</strong> To operate, maintain, and improve our platform, including the agent portal, CRM, and reporting tools</li>
                    <li><strong>Communication:</strong> To send transactional notifications, account updates, training materials, and platform announcements</li>
                    <li><strong>Compliance:</strong> To comply with legal obligations, tax reporting requirements, and regulatory mandates</li>
                    <li><strong>Security:</strong> To detect, investigate, and prevent fraudulent activity, unauthorized access, and security incidents</li>
                    <li><strong>Analytics:</strong> To analyze usage patterns, measure platform performance, and improve our services</li>
                    <li><strong>Marketing:</strong> To send promotional materials about our products and services (with your consent where required by law)</li>
                    <li><strong>Training and Support:</strong> To provide agent onboarding, training resources, and customer support</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card data-testid="section-sharing">
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Globe className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-primary mb-3">3. Sharing of Information with Third Parties</h2>
                  <p className="text-muted-foreground leading-relaxed mb-3">
                    We do not sell your personal information. We may share your information with the following categories of third parties:
                  </p>
                  <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-2">
                    <li><strong>MCA Funding Partners:</strong> When you submit or process MCA deals, relevant merchant and deal information is shared with our lending and funding partners to facilitate approvals and funding</li>
                    <li><strong>Payment Processors:</strong> Financial information is shared with our secure payment processing partners (e.g., Stripe, ACH providers) to process commission payments</li>
                    <li><strong>Service Providers:</strong> We may share information with vendors who perform services on our behalf, such as email delivery, cloud hosting, analytics, and customer support tools</li>
                    <li><strong>Upline Agents:</strong> Limited performance data (deal counts, subscription sales, team activity) may be visible to your upline agents and team leaders within the platform hierarchy</li>
                    <li><strong>Legal Requirements:</strong> We may disclose information when required by law, subpoena, court order, or governmental regulation, or to protect the rights, property, or safety of Leadershield, our agents, or the public</li>
                    <li><strong>Business Transfers:</strong> In the event of a merger, acquisition, or sale of assets, your information may be transferred as part of that transaction</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card data-testid="section-data-retention">
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Database className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-primary mb-3">4. Data Retention</h2>
                  <p className="text-muted-foreground leading-relaxed mb-3">
                    We retain your personal information for as long as your account is active or as needed to
                    provide our services. Specifically:
                  </p>
                  <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-2">
                    <li><strong>Active Accounts:</strong> Data is retained for the duration of your active agent or merchant relationship with Leadershield</li>
                    <li><strong>Closed Accounts:</strong> Following account closure or termination, we retain records for a minimum of seven (7) years to comply with tax reporting, regulatory, and legal obligations</li>
                    <li><strong>Financial Records:</strong> Commission records, 1099 data, and transaction histories are retained for at least seven (7) years in accordance with IRS requirements</li>
                    <li><strong>Usage Data:</strong> Anonymized usage and analytics data may be retained indefinitely for business analysis purposes</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card data-testid="section-cookies">
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Cookie className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-primary mb-3">5. Cookies and Tracking Technologies</h2>
                  <p className="text-muted-foreground leading-relaxed mb-3">
                    We use cookies and similar tracking technologies to enhance your experience on our platform:
                  </p>
                  <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-2 mb-4">
                    <li><strong>Essential Cookies:</strong> Required for platform functionality, including authentication, session management, and security</li>
                    <li><strong>Analytics Cookies:</strong> Help us understand how users interact with our platform so we can improve its performance and usability</li>
                    <li><strong>Preference Cookies:</strong> Store your settings and preferences (e.g., theme, language) for a better user experience</li>
                    <li><strong>Marketing Cookies:</strong> Used to deliver relevant advertising and track the effectiveness of our marketing campaigns</li>
                  </ul>
                  <p className="text-muted-foreground leading-relaxed">
                    You can manage your cookie preferences through your browser settings. Please note that
                    disabling certain cookies may affect the functionality of our platform. Most browsers allow
                    you to refuse cookies or alert you when a cookie is being set. Refer to your browser's help
                    documentation for instructions on managing cookies.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card data-testid="section-user-rights">
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <UserCheck className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-primary mb-3">6. Your Rights</h2>
                  <p className="text-muted-foreground leading-relaxed mb-3">
                    Depending on your jurisdiction, you may have the following rights regarding your personal information:
                  </p>

                  <h3 className="text-lg font-semibold text-primary mt-4 mb-2">a. Right to Access</h3>
                  <p className="text-muted-foreground leading-relaxed mb-3">
                    You have the right to request a copy of the personal information we hold about you.
                    We will provide this information in a commonly used, machine-readable format within 30 days of your request.
                  </p>

                  <h3 className="text-lg font-semibold text-primary mt-4 mb-2">b. Right to Correction</h3>
                  <p className="text-muted-foreground leading-relaxed mb-3">
                    You have the right to request that we correct any inaccurate or incomplete personal information.
                    You may also update certain information directly through your account settings in the agent portal.
                  </p>

                  <h3 className="text-lg font-semibold text-primary mt-4 mb-2">c. Right to Deletion</h3>
                  <p className="text-muted-foreground leading-relaxed mb-3">
                    You have the right to request deletion of your personal information, subject to certain exceptions.
                    We may retain data necessary for legal compliance, dispute resolution, or enforcement of our agreements.
                    Financial records required for tax purposes cannot be deleted prior to the expiration of the applicable retention period.
                  </p>

                  <h3 className="text-lg font-semibold text-primary mt-4 mb-2">d. Right to Opt-Out</h3>
                  <p className="text-muted-foreground leading-relaxed mb-3">
                    You may opt out of receiving marketing communications at any time by clicking the "unsubscribe"
                    link in our emails or by contacting us at the address below. Please note that transactional
                    communications (e.g., commission notifications, account alerts) are not subject to opt-out.
                  </p>

                  <h3 className="text-lg font-semibold text-primary mt-4 mb-2">e. Right to Data Portability</h3>
                  <p className="text-muted-foreground leading-relaxed">
                    Where technically feasible, you may request that we transfer your personal information to
                    another service provider in a structured, commonly used, and machine-readable format.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card data-testid="section-children">
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Baby className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-primary mb-3">7. Children's Privacy (COPPA Compliance)</h2>
                  <p className="text-muted-foreground leading-relaxed">
                    Our platform and services are not intended for individuals under the age of 18. We do not
                    knowingly collect personal information from children under 13 years of age in compliance with
                    the Children's Online Privacy Protection Act (COPPA). If we become aware that we have
                    inadvertently collected personal information from a child under 13, we will take immediate
                    steps to delete such information from our records. If you are a parent or guardian and believe
                    your child has provided us with personal information, please contact us immediately at the
                    address below.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card data-testid="section-ccpa">
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <MapPin className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-primary mb-3">8. California Resident Rights (CCPA/CPRA)</h2>
                  <p className="text-muted-foreground leading-relaxed mb-3">
                    If you are a California resident, you have additional rights under the California Consumer
                    Privacy Act (CCPA) as amended by the California Privacy Rights Act (CPRA):
                  </p>
                  <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-2 mb-4">
                    <li><strong>Right to Know:</strong> You may request that we disclose the categories and specific pieces of personal information we have collected about you, the sources of that information, the business purposes for collection, and the categories of third parties with whom we share it</li>
                    <li><strong>Right to Delete:</strong> You may request deletion of personal information we have collected, subject to certain legal exceptions</li>
                    <li><strong>Right to Correct:</strong> You may request correction of inaccurate personal information</li>
                    <li><strong>Right to Opt-Out of Sale/Sharing:</strong> We do not sell your personal information. However, if this changes, you will have the right to opt out</li>
                    <li><strong>Right to Non-Discrimination:</strong> We will not discriminate against you for exercising your CCPA/CPRA rights</li>
                    <li><strong>Right to Limit Use of Sensitive Personal Information:</strong> You may direct us to limit our use of your sensitive personal information to purposes necessary to provide our services</li>
                  </ul>
                  <p className="text-muted-foreground leading-relaxed">
                    To exercise any of these rights, please submit a verifiable consumer request by contacting
                    us at the email address listed below. We will respond to verifiable requests within 45 days.
                    You may also designate an authorized agent to submit requests on your behalf.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card data-testid="section-security">
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Lock className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-primary mb-3">9. Data Security</h2>
                  <p className="text-muted-foreground leading-relaxed">
                    We implement industry-standard security measures to protect your personal information from
                    unauthorized access, alteration, disclosure, or destruction. These measures include encryption
                    of data in transit (TLS/SSL) and at rest, access controls, regular security audits, and
                    employee training on data protection practices. However, no method of transmission over the
                    internet or method of electronic storage is 100% secure. While we strive to protect your
                    information, we cannot guarantee its absolute security. You are responsible for maintaining the
                    confidentiality of your account credentials and for any activity that occurs under your account.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card data-testid="section-third-party-links">
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Globe className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-primary mb-3">10. Third-Party Links and Services</h2>
                  <p className="text-muted-foreground leading-relaxed">
                    Our platform may contain links to third-party websites, services, or applications that are
                    not operated by us. We are not responsible for the privacy practices of these third parties.
                    We encourage you to review the privacy policies of any third-party services you access through
                    our platform. This includes, but is not limited to, MCA funding partner portals, payment
                    processing services, and third-party analytics tools.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card data-testid="section-changes">
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Trash2 className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-primary mb-3">11. Changes to This Privacy Policy</h2>
                  <p className="text-muted-foreground leading-relaxed">
                    We reserve the right to update or modify this Privacy Policy at any time. When we make changes,
                    we will update the "Last Updated" date at the top of this page and, for material changes, notify
                    you via email or through a prominent notice on our platform. Your continued use of our services
                    after any changes constitutes your acceptance of the updated policy. We encourage you to review
                    this Privacy Policy periodically.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card data-testid="section-contact">
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Mail className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-primary mb-3">12. Contact Information</h2>
                  <p className="text-muted-foreground leading-relaxed mb-4">
                    If you have any questions, concerns, or requests regarding this Privacy Policy or our data
                    practices, please contact us at:
                  </p>
                  <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                    <p className="font-semibold text-primary">Leadershield Network, LLC</p>
                    <p className="text-muted-foreground">Privacy Officer</p>
                    <p className="text-muted-foreground">Email: privacy@leadershield.com</p>
                    <p className="text-muted-foreground">Address: [Company Address]</p>
                    <p className="text-muted-foreground">Phone: [Company Phone Number]</p>
                  </div>
                  <p className="text-muted-foreground leading-relaxed mt-4">
                    For California residents, you may also contact us to exercise your CCPA/CPRA rights at the
                    email address above. Please include "CCPA Request" in the subject line.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="mt-12 pt-8 border-t border-border text-center">
          <p className="text-sm text-muted-foreground mb-4">
            This Privacy Policy is effective as of January 1, 2025.
          </p>
          <div className="flex items-center justify-center gap-4 flex-wrap">
            <Link href="/terms">
              <Button variant="ghost" size="sm" data-testid="link-terms">Terms of Service</Button>
            </Link>
            <Link href="/income-disclosure">
              <Button variant="ghost" size="sm" data-testid="link-income-disclosure">Income Disclosure</Button>
            </Link>
            <Link href="/refund-policy">
              <Button variant="ghost" size="sm" data-testid="link-refund-policy">Refund Policy</Button>
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}