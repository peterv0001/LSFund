import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Sidebar } from "@/components/Sidebar";
import { api } from "@shared/routes";
import { 
  Download, 
  Calendar,
  DollarSign,
  TrendingUp,
  Users,
  PieChart,
  BarChart3,
  Loader2,
  FileSpreadsheet
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format, subDays, startOfMonth, endOfMonth, subMonths } from "date-fns";

type Commission = {
  id: number;
  type: string;
  amount: string;
  status: string;
  createdAt: string;
  periodDate: string;
  deal?: {
    merchantName: string;
    loanAmount: string;
  };
};

type Deal = {
  id: number;
  merchantName: string;
  loanAmount: string;
  companyRevenue: string;
  status: string;
  fundedAt: string;
};

type ReportData = {
  commissions: Commission[];
  deals: Deal[];
  stats: {
    totalEarned: number;
    thisMonth: number;
    thisWeek: number;
    pending: number;
    personalVolume: number;
    leftLegVolume: number;
    rightLegVolume: number;
  };
};

const DATE_RANGES = [
  { value: 'this-week', label: 'This Week' },
  { value: 'this-month', label: 'This Month' },
  { value: 'last-month', label: 'Last Month' },
  { value: 'last-90-days', label: 'Last 90 Days' },
  { value: 'year-to-date', label: 'Year to Date' },
  { value: 'all-time', label: 'All Time' },
];

function getDateRange(range: string): { start: Date; end: Date } {
  const now = new Date();
  switch (range) {
    case 'this-week':
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - now.getDay());
      return { start: weekStart, end: now };
    case 'this-month':
      return { start: startOfMonth(now), end: now };
    case 'last-month':
      const lastMonth = subMonths(now, 1);
      return { start: startOfMonth(lastMonth), end: endOfMonth(lastMonth) };
    case 'last-90-days':
      return { start: subDays(now, 90), end: now };
    case 'year-to-date':
      return { start: new Date(now.getFullYear(), 0, 1), end: now };
    case 'all-time':
    default:
      return { start: new Date(2020, 0, 1), end: now };
  }
}

function downloadCSV(data: any[], filename: string) {
  if (!data.length) return;
  
  const headers = Object.keys(data[0]);
  const csvContent = [
    headers.join(','),
    ...data.map(row => headers.map(h => {
      const val = row[h];
      // Escape commas and quotes
      if (typeof val === 'string' && (val.includes(',') || val.includes('"'))) {
        return `"${val.replace(/"/g, '""')}"`;
      }
      return val ?? '';
    }).join(','))
  ].join('\n');
  
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${filename}_${format(new Date(), 'yyyy-MM-dd')}.csv`;
  link.click();
}

export default function ReportsPage() {
  const [dateRange, setDateRange] = useState('this-month');
  
  // Fetch commissions
  const { data: commissions = [], isLoading: loadingCommissions } = useQuery({
    queryKey: ['commissions'],
    queryFn: async () => {
      const res = await fetch(api.commissions.list.path, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch');
      return res.json() as Promise<Commission[]>;
    },
  });

  // Fetch deals
  const { data: deals = [], isLoading: loadingDeals } = useQuery({
    queryKey: ['deals'],
    queryFn: async () => {
      const res = await fetch(api.deals.list.path, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch');
      return res.json() as Promise<Deal[]>;
    },
  });

  // Fetch dashboard stats
  const { data: stats } = useQuery({
    queryKey: ['dashboard'],
    queryFn: async () => {
      const res = await fetch(api.agents.dashboard.path, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch');
      return res.json();
    },
  });

  const { start, end } = getDateRange(dateRange);
  
  // Filter data by date range
  const filteredCommissions = commissions.filter(c => {
    const date = new Date(c.createdAt);
    return date >= start && date <= end;
  });

  const filteredDeals = deals.filter(d => {
    const date = new Date(d.fundedAt);
    return date >= start && date <= end;
  });

  // Calculate commission breakdown by type
  const commissionByType = filteredCommissions.reduce((acc, c) => {
    const type = c.type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    acc[type] = (acc[type] || 0) + Number(c.amount);
    return acc;
  }, {} as Record<string, number>);

  // Calculate totals
  const totalCommissions = filteredCommissions.reduce((sum, c) => sum + Number(c.amount), 0);
  const totalDeals = filteredDeals.length;
  const totalVolume = filteredDeals.reduce((sum, d) => sum + Number(d.loanAmount), 0);

  const isLoading = loadingCommissions || loadingDeals;

  // Prepare CSV data
  const commissionsCSV = filteredCommissions.map(c => ({
    Date: format(new Date(c.createdAt), 'yyyy-MM-dd'),
    Type: c.type.replace(/_/g, ' '),
    Amount: Number(c.amount).toFixed(2),
    Status: c.status,
    Merchant: c.deal?.merchantName || '-',
    'Deal Amount': c.deal ? Number(c.deal.loanAmount).toFixed(2) : '-',
  }));

  const dealsCSV = filteredDeals.map(d => ({
    Date: format(new Date(d.fundedAt), 'yyyy-MM-dd'),
    Merchant: d.merchantName,
    'Loan Amount': Number(d.loanAmount).toFixed(2),
    Revenue: Number(d.companyRevenue).toFixed(2),
    Status: d.status,
  }));

  return (
    <div className="flex min-h-screen bg-gray-50/50">
      <Sidebar />
      
      <main className="flex-1 lg:ml-64 p-4 pt-20 lg:pt-8 lg:p-8">
        <header className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-display font-bold text-primary flex items-center gap-3">
              <BarChart3 className="w-8 h-8" />
              Reports
            </h1>
            <p className="text-muted-foreground mt-2">
              Track your performance and download reports.
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            <Select value={dateRange} onValueChange={setDateRange}>
              <SelectTrigger className="w-[180px]">
                <Calendar className="w-4 h-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DATE_RANGES.map(r => (
                  <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </header>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Total Earnings</CardDescription>
                  <CardTitle className="text-2xl text-emerald-600">
                    ${totalCommissions.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground">
                    {filteredCommissions.length} commission{filteredCommissions.length !== 1 ? 's' : ''}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Deals Funded</CardDescription>
                  <CardTitle className="text-2xl">{totalDeals}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground">
                    ${totalVolume.toLocaleString()} total volume
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Left Leg Volume</CardDescription>
                  <CardTitle className="text-2xl">
                    ${(stats?.leftLegVolume || 0).toLocaleString()}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground">This week</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Right Leg Volume</CardDescription>
                  <CardTitle className="text-2xl">
                    ${(stats?.rightLegVolume || 0).toLocaleString()}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground">This week</p>
                </CardContent>
              </Card>
            </div>

            <Tabs defaultValue="commissions" className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <TabsList>
                  <TabsTrigger value="commissions" className="gap-2">
                    <DollarSign className="w-4 h-4" />
                    Commissions
                  </TabsTrigger>
                  <TabsTrigger value="deals" className="gap-2">
                    <TrendingUp className="w-4 h-4" />
                    Deals
                  </TabsTrigger>
                  <TabsTrigger value="breakdown" className="gap-2">
                    <PieChart className="w-4 h-4" />
                    Breakdown
                  </TabsTrigger>
                </TabsList>

                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => downloadCSV(commissionsCSV, 'commissions')}
                    disabled={!filteredCommissions.length}
                  >
                    <FileSpreadsheet className="w-4 h-4 mr-2" />
                    Export Commissions
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => downloadCSV(dealsCSV, 'deals')}
                    disabled={!filteredDeals.length}
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Export Deals
                  </Button>
                </div>
              </div>

              <TabsContent value="commissions">
                <Card>
                  <CardHeader>
                    <CardTitle>Commission History</CardTitle>
                    <CardDescription>
                      {filteredCommissions.length} transaction{filteredCommissions.length !== 1 ? 's' : ''} in selected period
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[600px]">
                        <thead>
                          <tr className="border-b text-left">
                            <th className="pb-3 font-medium text-muted-foreground">Date</th>
                            <th className="pb-3 font-medium text-muted-foreground">Type</th>
                            <th className="pb-3 font-medium text-muted-foreground">Source</th>
                            <th className="pb-3 font-medium text-muted-foreground">Status</th>
                            <th className="pb-3 font-medium text-muted-foreground text-right">Amount</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {filteredCommissions.length === 0 ? (
                            <tr>
                              <td colSpan={5} className="py-8 text-center text-muted-foreground">
                                No commissions in selected period
                              </td>
                            </tr>
                          ) : (
                            filteredCommissions.map(c => (
                              <tr key={c.id} className="hover:bg-gray-50/50">
                                <td className="py-3">{format(new Date(c.createdAt), 'MMM d, yyyy')}</td>
                                <td className="py-3 capitalize">{c.type.replace(/_/g, ' ')}</td>
                                <td className="py-3">{c.deal?.merchantName || '-'}</td>
                                <td className="py-3">
                                  <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                                    c.status === 'paid' ? 'bg-emerald-100 text-emerald-700' :
                                    c.status === 'approved' ? 'bg-blue-100 text-blue-700' :
                                    'bg-amber-100 text-amber-700'
                                  }`}>
                                    {c.status}
                                  </span>
                                </td>
                                <td className="py-3 text-right font-semibold text-emerald-600">
                                  +${Number(c.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="deals">
                <Card>
                  <CardHeader>
                    <CardTitle>Deal History</CardTitle>
                    <CardDescription>
                      {filteredDeals.length} deal{filteredDeals.length !== 1 ? 's' : ''} in selected period
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[600px]">
                        <thead>
                          <tr className="border-b text-left">
                            <th className="pb-3 font-medium text-muted-foreground">Date</th>
                            <th className="pb-3 font-medium text-muted-foreground">Merchant</th>
                            <th className="pb-3 font-medium text-muted-foreground">Status</th>
                            <th className="pb-3 font-medium text-muted-foreground text-right">Loan Amount</th>
                            <th className="pb-3 font-medium text-muted-foreground text-right">Revenue</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {filteredDeals.length === 0 ? (
                            <tr>
                              <td colSpan={5} className="py-8 text-center text-muted-foreground">
                                No deals in selected period
                              </td>
                            </tr>
                          ) : (
                            filteredDeals.map(d => (
                              <tr key={d.id} className="hover:bg-gray-50/50">
                                <td className="py-3">{format(new Date(d.fundedAt), 'MMM d, yyyy')}</td>
                                <td className="py-3 font-medium">{d.merchantName}</td>
                                <td className="py-3">
                                  <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">
                                    {d.status}
                                  </span>
                                </td>
                                <td className="py-3 text-right">${Number(d.loanAmount).toLocaleString()}</td>
                                <td className="py-3 text-right font-semibold text-emerald-600">
                                  +${Number(d.companyRevenue).toLocaleString()}
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="breakdown">
                <div className="grid md:grid-cols-2 gap-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <PieChart className="w-5 h-5" />
                        Commission Breakdown
                      </CardTitle>
                      <CardDescription>By commission type</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {Object.keys(commissionByType).length === 0 ? (
                        <p className="text-center text-muted-foreground py-8">
                          No commissions in selected period
                        </p>
                      ) : (
                        <div className="space-y-4">
                          {Object.entries(commissionByType)
                            .sort((a, b) => b[1] - a[1])
                            .map(([type, amount]) => {
                              const percent = totalCommissions > 0 ? (amount / totalCommissions) * 100 : 0;
                              return (
                                <div key={type}>
                                  <div className="flex justify-between text-sm mb-1">
                                    <span>{type}</span>
                                    <span className="font-semibold">
                                      ${amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                    </span>
                                  </div>
                                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                                    <div 
                                      className="h-full bg-primary rounded-full transition-all"
                                      style={{ width: `${percent}%` }}
                                    />
                                  </div>
                                  <p className="text-xs text-muted-foreground mt-1">
                                    {percent.toFixed(1)}% of total
                                  </p>
                                </div>
                              );
                            })}
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Users className="w-5 h-5" />
                        Team Volume
                      </CardTitle>
                      <CardDescription>Binary tree breakdown</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-6">
                        <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg">
                          <div>
                            <p className="text-sm text-blue-600 font-medium">Left Leg</p>
                            <p className="text-2xl font-bold text-blue-700">
                              ${(stats?.leftLegVolume || 0).toLocaleString()}
                            </p>
                          </div>
                          <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                            <TrendingUp className="w-6 h-6 text-blue-600" />
                          </div>
                        </div>

                        <div className="flex items-center justify-between p-4 bg-purple-50 rounded-lg">
                          <div>
                            <p className="text-sm text-purple-600 font-medium">Right Leg</p>
                            <p className="text-2xl font-bold text-purple-700">
                              ${(stats?.rightLegVolume || 0).toLocaleString()}
                            </p>
                          </div>
                          <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
                            <TrendingUp className="w-6 h-6 text-purple-600" />
                          </div>
                        </div>

                        <div className="flex items-center justify-between p-4 bg-emerald-50 rounded-lg border-2 border-emerald-200">
                          <div>
                            <p className="text-sm text-emerald-600 font-medium">Weak Leg (Pays)</p>
                            <p className="text-2xl font-bold text-emerald-700">
                              ${Math.min(stats?.leftLegVolume || 0, stats?.rightLegVolume || 0).toLocaleString()}
                            </p>
                          </div>
                          <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center">
                            <DollarSign className="w-6 h-6 text-emerald-600" />
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>
            </Tabs>
          </>
        )}
      </main>
    </div>
  );
}
