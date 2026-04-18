import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, AlertTriangle, BarChart3, Users, TrendingUp, Shield } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const rankData = [
  { rank: "Associate", participants: "62.4%", avgAnnual: "$480", medianAnnual: "$0", pctEarning: "23%" },
  { rank: "Senior Associate", participants: "18.1%", avgAnnual: "$3,200", medianAnnual: "$1,100", pctEarning: "54%" },
  { rank: "Team Lead", participants: "10.2%", avgAnnual: "$12,800", medianAnnual: "$7,400", pctEarning: "78%" },
  { rank: "Division Manager", participants: "5.6%", avgAnnual: "$34,500", medianAnnual: "$22,000", pctEarning: "89%" },
  { rank: "Regional Director", participants: "2.4%", avgAnnual: "$78,000", medianAnnual: "$55,000", pctEarning: "94%" },
  { rank: "National VP", participants: "0.9%", avgAnnual: "$145,000", medianAnnual: "$110,000", pctEarning: "97%" },
  { rank: "Executive Partner", participants: "0.3%", avgAnnual: "$285,000", medianAnnual: "$210,000", pctEarning: "99%" },
  { rank: "Presidential Diamond", participants: "0.1%", avgAnnual: "$520,000", medianAnnual: "$400,000", pctEarning: "100%" },
];

export default function IncomeDisclosurePage() {
  return (
    <div className="min-h-screen bg-background">
      <nav className="sticky top-0 z-50 bg-background/95 backdrop-blur-xl border-b border-border">
        <div className="max-w-4xl mx-auto px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-primary shrink-0" />
            <span className="font-display font-bold text-primary text-base tracking-wide">Leader Shield Network</span>
          </div>
          <Link href="/">
            <Button variant="ghost" size="sm" data-testid="button-back-home">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Home
            </Button>
          </Link>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-6 py-12">
        <div className="mb-10">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-destructive/10 border border-destructive/20 mb-6">
            <AlertTriangle className="w-4 h-4 text-destructive" />
            <span className="text-sm font-medium text-destructive" data-testid="text-required-disclosure">Required FTC Disclosure</span>
          </div>
          <h1 className="text-4xl font-display font-bold text-primary mb-4" data-testid="heading-income-disclosure">
            Income Disclosure Statement
          </h1>
          <p className="text-muted-foreground" data-testid="text-disclosure-date">
            Effective Date: January 1, 2025 | Last Updated: January 1, 2025
          </p>
        </div>

        <Card className="mb-8 border-destructive/30 bg-destructive/5">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <AlertTriangle className="w-6 h-6 text-destructive flex-shrink-0 mt-1" />
              <div>
                <h2 className="text-lg font-bold text-primary mb-2" data-testid="heading-important-notice">Important Notice</h2>
                <p className="text-sm text-muted-foreground leading-relaxed" data-testid="text-important-notice">
                  The income figures presented in this document are not guarantees of income. They are provided to help
                  you understand the potential earnings from participation in the Leadershield Network opportunity.
                  <strong className="text-foreground"> The majority of participants in the Leadershield Network earn little to no income.</strong> Your
                  individual results will vary based on your effort, skill, market conditions, geographic location,
                  and many other factors. Do not rely on the results of others as an indication of what you may earn.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <section className="mb-10">
          <h2 className="text-2xl font-bold text-primary mb-4 flex items-center gap-3" data-testid="heading-purpose">
            <BarChart3 className="w-6 h-6 text-primary" />
            Purpose of This Disclosure
          </h2>
          <p className="text-muted-foreground leading-relaxed mb-4">
            Leadershield Network, LLC ("Leadershield," "the Company," "we," or "us") is committed to full
            transparency regarding the earnings potential of our independent agents ("Agents," "Participants,"
            or "you"). This Income Disclosure Statement is provided in accordance with the Federal Trade
            Commission (FTC) guidelines on business opportunity disclosures and the Direct Selling
            Association (DSA) Code of Ethics.
          </p>
          <p className="text-muted-foreground leading-relaxed">
            This disclosure provides actual income data from all active and inactive Leadershield Network
            participants during the most recently completed fiscal year. It is designed to give prospective
            and current participants a realistic understanding of the income earned by participants at
            various levels within the compensation plan.
          </p>
        </section>

        <section className="mb-10">
          <h2 className="text-2xl font-bold text-primary mb-4 flex items-center gap-3" data-testid="heading-key-findings">
            <TrendingUp className="w-6 h-6 text-primary" />
            Key Findings Summary
          </h2>
          <div className="grid sm:grid-cols-3 gap-4 mb-6">
            <Card>
              <CardContent className="p-5 text-center">
                <p className="text-3xl font-bold text-primary mb-1" data-testid="text-overall-median">$0</p>
                <p className="text-sm text-muted-foreground">Overall Median Annual Income</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5 text-center">
                <p className="text-3xl font-bold text-primary mb-1" data-testid="text-overall-average">$4,120</p>
                <p className="text-sm text-muted-foreground">Overall Average Annual Income</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5 text-center">
                <p className="text-3xl font-bold text-primary mb-1" data-testid="text-pct-earned">37.6%</p>
                <p className="text-sm text-muted-foreground">Participants Who Earned Income</p>
              </CardContent>
            </Card>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">
            The figures above reflect all participants who were enrolled for at least one day during the
            reporting period, including those who were inactive or never made a sale. Among all
            participants, <strong className="text-foreground">62.4% earned no income at all</strong> during the reporting period.
            The average is significantly higher than the median because a small number of top earners
            substantially raise the average.
          </p>
        </section>

        <section className="mb-10">
          <h2 className="text-2xl font-bold text-primary mb-4 flex items-center gap-3" data-testid="heading-earnings-by-rank">
            <Users className="w-6 h-6 text-primary" />
            Earnings by Rank
          </h2>
          <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
            The following table shows income data for each rank level within the Leadershield Network
            compensation plan. "% of Participants" indicates the percentage of all enrolled participants
            at each rank. "% Earning" indicates the percentage of participants at that rank who earned
            any income during the reporting period.
          </p>
          <div className="overflow-x-auto">
            <Table data-testid="table-earnings-by-rank">
              <TableHeader>
                <TableRow>
                  <TableHead>Rank</TableHead>
                  <TableHead className="text-right">% of Participants</TableHead>
                  <TableHead className="text-right">Avg. Annual Income</TableHead>
                  <TableHead className="text-right">Median Annual Income</TableHead>
                  <TableHead className="text-right">% Earning Income</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rankData.map((row) => (
                  <TableRow key={row.rank} data-testid={`row-rank-${row.rank.toLowerCase().replace(/\s/g, '-')}`}>
                    <TableCell className="font-medium">{row.rank}</TableCell>
                    <TableCell className="text-right">{row.participants}</TableCell>
                    <TableCell className="text-right">{row.avgAnnual}</TableCell>
                    <TableCell className="text-right">{row.medianAnnual}</TableCell>
                    <TableCell className="text-right">{row.pctEarning}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </section>

        <section className="mb-10">
          <h2 className="text-2xl font-bold text-primary mb-4" data-testid="heading-material-assumptions">Material Assumptions & Methodology</h2>
          <div className="space-y-4 text-muted-foreground leading-relaxed">
            <p>
              The income data in this disclosure is based on all participants who were enrolled in the
              Leadershield Network at any point during the fiscal year ending December 31, 2024. This
              includes participants who:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Were active for only a portion of the year</li>
              <li>Were enrolled but never placed a sale or recruited another participant</li>
              <li>Voluntarily terminated their participation during the reporting period</li>
              <li>Participated on a part-time or casual basis</li>
            </ul>
            <p>
              Income figures represent <strong className="text-foreground">gross earnings before expenses</strong>. They do not account for
              costs incurred by participants such as travel, marketing materials, training costs, technology
              subscriptions, licensing fees, taxes, or any other business-related expenses. Net income
              (after expenses) will be lower than the gross figures reported here.
            </p>
            <p>
              Income includes all forms of compensation paid by Leadershield Network including, but not
              limited to: MCA brokerage commissions, subscription platform commissions, pairing bonuses,
              team override commissions, quarterly accelerator bonuses, rank advancement bonuses, and
              any other incentive payments.
            </p>
          </div>
        </section>

        <section className="mb-10">
          <h2 className="text-2xl font-bold text-primary mb-4" data-testid="heading-no-guarantee">No Income Guarantee</h2>
          <div className="space-y-4 text-muted-foreground leading-relaxed">
            <p>
              Leadershield Network makes <strong className="text-foreground">no guarantees regarding income</strong>, whether express or implied.
              The success or failure of each participant, like any other business, depends on each
              participant's own skills, personal effort, time commitment, and market conditions.
            </p>
            <p>
              There is no assurance that any participant will earn income at any particular level or earn
              any income at all. The earning levels reflected in this disclosure should not be considered
              as typical or representative of the income that you should expect to earn. Many participants
              do not earn any income.
            </p>
            <p>
              Any representations or guarantees of income made by individual agents or participants
              of Leadershield Network are unauthorized and should be reported to the Company immediately.
            </p>
          </div>
        </section>

        <section className="mb-10">
          <h2 className="text-2xl font-bold text-primary mb-4" data-testid="heading-factors">Factors Affecting Income</h2>
          <div className="space-y-4 text-muted-foreground leading-relaxed">
            <p>Your income as a Leadershield Network participant may be affected by many factors, including but not limited to:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong className="text-foreground">Personal effort and time commitment:</strong> Participants who work more hours generally have greater opportunity to earn.</li>
              <li><strong className="text-foreground">Sales skill and experience:</strong> Prior experience in sales, financial services, or direct selling may impact results.</li>
              <li><strong className="text-foreground">Geographic location:</strong> Market demand for MCA funding and subscription services varies by region.</li>
              <li><strong className="text-foreground">Market conditions:</strong> Economic factors, competition, and regulatory changes may impact earning potential.</li>
              <li><strong className="text-foreground">Length of participation:</strong> Participants who have been active longer generally have higher earnings.</li>
              <li><strong className="text-foreground">Team building ability:</strong> Override commissions depend on the productivity of recruited team members.</li>
              <li><strong className="text-foreground">Client retention:</strong> Recurring subscription income depends on maintaining active merchant subscriptions.</li>
              <li><strong className="text-foreground">Compliance with policies:</strong> Violations of company policies may result in loss of commissions or termination.</li>
            </ul>
          </div>
        </section>

        <section className="mb-10">
          <h2 className="text-2xl font-bold text-primary mb-4" data-testid="heading-independent-contractor">Independent Contractor Status</h2>
          <p className="text-muted-foreground leading-relaxed">
            Leadershield Network participants are independent contractors and are not employees of
            Leadershield Network, LLC. As independent contractors, participants are responsible for their
            own business expenses, tax obligations, insurance, and compliance with all applicable federal,
            state, and local laws and regulations. Leadershield Network does not withhold taxes, provide
            health insurance, retirement benefits, or any other employee benefits.
          </p>
        </section>

        <section className="mb-10">
          <h2 className="text-2xl font-bold text-primary mb-4" data-testid="heading-anti-pyramid">Anti-Pyramid Statement</h2>
          <p className="text-muted-foreground leading-relaxed">
            Leadershield Network is not a pyramid scheme. Commissions and bonuses are earned based on the
            sale of actual products and services to real customers, not on the recruitment of new participants.
            No participant is required to purchase products or services as a condition of earning commissions.
            No participant earns commissions solely for recruiting other participants. The Leadershield
            Network compensation plan is designed to reward participants for legitimate sales activity and
            team productivity.
          </p>
        </section>

        <Card className="mb-10 border-border">
          <CardContent className="p-6">
            <h2 className="text-lg font-bold text-primary mb-3" data-testid="heading-contact">Questions About This Disclosure</h2>
            <p className="text-sm text-muted-foreground leading-relaxed mb-4">
              If you have any questions about this Income Disclosure Statement or the Leadershield Network
              compensation plan, please contact our Compliance Department:
            </p>
            <div className="text-sm text-muted-foreground space-y-1">
              <p>Leadershield Network, LLC — Compliance Department</p>
              <p>Email: compliance@leadershieldnetwork.com</p>
              <p>Phone: 1-800-555-0199</p>
            </div>
          </CardContent>
        </Card>

        <div className="text-center pb-12">
          <p className="text-xs text-muted-foreground mb-6">
            This Income Disclosure Statement is provided for informational purposes only and does not
            constitute an offer or solicitation of a business opportunity. Leadershield Network reserves
            the right to update this disclosure at any time. The most current version is always available
            at leadershieldnetwork.com/income-disclosure.
          </p>
          <Link href="/">
            <Button variant="outline" data-testid="button-return-home">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Return to Home
            </Button>
          </Link>
        </div>
      </main>
    </div>
  );
}