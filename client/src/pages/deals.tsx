import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useDeals, useCreateDeal } from "@/hooks/use-deals";
import { Sidebar } from "@/components/Sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus, Loader2, Briefcase, Search, Filter, ChevronRight, ChevronLeft,
  Building2, User, DollarSign, FileText, CheckCircle2, AlertTriangle,
  Clock, CheckCheck
} from "lucide-react";
import { useForm, type FieldErrors } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { insertDealSchema } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA",
  "KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
  "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT",
  "VA","WA","WV","WI","WY","DC"
];

const INDUSTRIES = [
  "Restaurant / Food Service","Retail","Healthcare","Auto Repair","Construction",
  "Transportation","Beauty / Salon","Legal / Professional Services","Medical / Dental",
  "Technology","Manufacturing","Real Estate","Financial Services","E-Commerce",
  "Wholesale / Distribution","Education","Entertainment / Hospitality","Other"
];

const BUSINESS_TYPES = ["LLC","Corporation","S-Corp","Sole Proprietorship","Partnership","Non-Profit"];

const USE_OF_FUNDS = [
  "Working Capital","Equipment Purchase","Inventory","Expansion / New Location",
  "Payroll","Marketing / Advertising","Debt Consolidation","Renovation","Other"
];

const dealFormSchema = insertDealSchema.extend({
  merchantName: z.string().min(2, "Business legal name is required"),
  merchantEmail: z.string().email("Valid email required").optional().or(z.literal('')),
  merchantPhone: z.string().min(10, "Valid phone number required"),
  businessAddress: z.string().min(5, "Business address is required"),
  businessCity: z.string().min(2, "City is required"),
  businessState: z.string().min(2, "State is required"),
  businessZip: z.string().regex(/^\d{5}(-\d{4})?$/, "Valid ZIP required"),
  ownerFirstName: z.string().min(1, "Owner first name required"),
  ownerLastName: z.string().min(1, "Owner last name required"),
  ownerEmail: z.string().email("Valid email required").optional().or(z.literal('')),
  ownerPhone: z.string().min(10, "Valid phone required"),
  ownerOwnershipPct: z.coerce.number().min(1).max(100),
  loanAmount: z.coerce.number().min(1000, "Minimum $1,000"),
  avgMonthlyRevenue: z.coerce.number().min(0, "Required"),
  stateDisclosureConfirmed: z.boolean().optional(),
});

type DealFormData = z.infer<typeof dealFormSchema>;

const STEPS = [
  { id: 1, label: "Business Info", icon: Building2 },
  { id: 2, label: "Owner Info", icon: User },
  { id: 3, label: "Funding", icon: DollarSign },
  { id: 4, label: "Review & Submit", icon: FileText },
];

export default function DealsPage() {
  const { user } = useAuth();
  const { data: deals, isLoading } = useDeals();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const filteredDeals = deals?.filter(deal => {
    const matchesSearch = deal.merchantName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || deal.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const statusColor = (status: string) => {
    if (status === 'funded') return 'default';
    if (status === 'rejected') return 'destructive';
    return 'secondary';
  };

  const statusLabel = (status: string) => {
    if (status === 'funded') return 'Funded';
    if (status === 'rejected') return 'Not Approved';
    return 'Submitted – Under Review';
  };

  const statusIcon = (status: string) => {
    if (status === 'funded') return <CheckCheck className="w-3 h-3" />;
    if (status === 'rejected') return <AlertTriangle className="w-3 h-3" />;
    return <Clock className="w-3 h-3" />;
  };

  return (
    <div className="flex min-h-screen bg-gray-50/50">
      <Sidebar />

      <main className="flex-1 lg:ml-64 p-4 pt-20 lg:pt-8 lg:p-8">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 data-testid="text-deals-title" className="text-3xl font-display font-bold text-primary">
              MCA Deal Submissions
            </h1>
            <p className="text-muted-foreground mt-2">
              Submit merchant cash advance applications to the closing team. Track status below.
            </p>
          </div>

          <MCADealDialog />
        </header>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 mb-6 bg-white p-4 rounded-xl border border-border shadow-sm">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              data-testid="input-search-merchants"
              placeholder="Search merchant name..."
              className="pl-9 bg-gray-50 border-transparent focus:bg-white"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger data-testid="select-status-filter" className="w-full sm:w-48 bg-gray-50 border-transparent">
              <Filter className="w-4 h-4 mr-2 text-muted-foreground" />
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="pending">Under Review</SelectItem>
              <SelectItem value="funded">Funded</SelectItem>
              <SelectItem value="rejected">Not Approved</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="bg-white rounded-2xl border border-border shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-gray-50/50 text-left">
                  <th className="px-6 py-4 font-medium text-sm text-muted-foreground uppercase tracking-wider">Submitted</th>
                  <th className="px-6 py-4 font-medium text-sm text-muted-foreground uppercase tracking-wider">Merchant</th>
                  <th className="px-6 py-4 font-medium text-sm text-muted-foreground uppercase tracking-wider">State</th>
                  <th className="px-6 py-4 font-medium text-sm text-muted-foreground uppercase tracking-wider">Requested</th>
                  <th className="px-6 py-4 font-medium text-sm text-muted-foreground uppercase tracking-wider">Avg. Monthly Rev.</th>
                  <th className="px-6 py-4 font-medium text-sm text-muted-foreground uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {isLoading ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-muted-foreground">
                      <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                      Loading submissions...
                    </td>
                  </tr>
                ) : filteredDeals && filteredDeals.length > 0 ? (
                  filteredDeals.map((deal) => (
                    <tr key={deal.id} data-testid={`row-deal-${deal.id}`} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {format(new Date(deal.createdAt), "MMM d, yyyy")}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <p className="text-sm font-medium text-primary" data-testid={`text-merchant-${deal.id}`}>
                            {deal.merchantName}
                          </p>
                          {(deal as any).merchantDba && (
                            <p className="text-xs text-muted-foreground">DBA: {(deal as any).merchantDba}</p>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {(deal as any).businessState || '—'}
                        {((deal as any).isVaMerchant || (deal as any).isCaMerchant || (deal as any).isUtMerchant) && (
                          <span className="ml-1 text-xs text-amber-600 font-medium">⚠ Disclosure</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 font-mono font-medium">
                        {(deal as any).requestedAmount
                          ? `$${Number((deal as any).requestedAmount).toLocaleString()}`
                          : `$${Number(deal.loanAmount).toLocaleString()}`}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 font-mono">
                        {(deal as any).avgMonthlyRevenue
                          ? `$${Number((deal as any).avgMonthlyRevenue).toLocaleString()}/mo`
                          : '—'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Badge
                          variant={statusColor(deal.status)}
                          className="flex items-center gap-1 w-fit"
                          data-testid={`badge-status-${deal.id}`}
                        >
                          {statusIcon(deal.status)}
                          {statusLabel(deal.status)}
                        </Badge>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="px-6 py-16 text-center text-muted-foreground">
                      <div className="w-14 h-14 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Briefcase className="w-7 h-7 text-gray-300" />
                      </div>
                      <p className="font-medium">No submissions yet</p>
                      <p className="text-sm mt-1">Submit your first MCA application to get started.</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}

function MCADealDialog() {
  const { mutateAsync: createDeal, isPending } = useCreateDeal();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [submitted, setSubmitted] = useState(false);

  const form = useForm<DealFormData>({
    resolver: zodResolver(dealFormSchema),
    defaultValues: {
      merchantName: "",
      merchantDba: "",
      merchantEmail: "",
      merchantPhone: "",
      businessType: "",
      ein: "",
      businessStartDate: "",
      industry: "",
      businessAddress: "",
      businessCity: "",
      businessState: "",
      businessZip: "",
      ownerFirstName: "",
      ownerLastName: "",
      ownerEmail: "",
      ownerPhone: "",
      ownerDob: "",
      ownerSsn: "",
      ownerOwnershipPct: 100,
      ownerAddress: "",
      ownerCity: "",
      ownerState: "",
      ownerZip: "",
      requestedAmount: undefined,
      useOfFunds: "",
      avgMonthlyRevenue: undefined,
      loanAmount: undefined,
      gbrAmount: undefined,
      notes: "",
      programType: "pmf_funding",
      stateDisclosureConfirmed: false,
    },
  });

  const watchedState = form.watch("businessState");
  const isVA = watchedState === "VA";
  const isCA = watchedState === "CA";
  const isUT = watchedState === "UT";
  const isNY = watchedState === "NY";
  const isCT = watchedState === "CT";
  const needsDisclosure = isVA || isCA || isUT || isNY || isCT;
  const disclosureStateName = isCA ? "California" : isVA ? "Virginia" : isUT ? "Utah" : isNY ? "New York" : "Connecticut";

  const loanAmount = form.watch("loanAmount");
  const avgMonthly = form.watch("avgMonthlyRevenue");
  const requestedAmount = form.watch("requestedAmount");
  const estimatedGbr = loanAmount ? Number(loanAmount) * 0.10 : 0;
  const macEstimate = estimatedGbr * 0.22;

  const step1Fields: (keyof DealFormData)[] = [
    "merchantName", "merchantPhone", "businessAddress", "businessCity", "businessState", "businessZip", "merchantEmail", "ein"
  ];
  const step2Fields: (keyof DealFormData)[] = [
    "ownerFirstName", "ownerLastName", "ownerPhone", "ownerOwnershipPct", "ownerEmail", "ownerSsn"
  ];
  const step3Fields: (keyof DealFormData)[] = ["loanAmount", "avgMonthlyRevenue", "requestedAmount", "gbrAmount"];

  const fieldStep: Partial<Record<keyof DealFormData, number>> = {
    merchantName: 1, merchantDba: 1, merchantEmail: 1, merchantPhone: 1,
    businessType: 1, ein: 1, businessStartDate: 1, industry: 1,
    businessAddress: 1, businessCity: 1, businessState: 1, businessZip: 1,
    ownerFirstName: 2, ownerLastName: 2, ownerEmail: 2, ownerPhone: 2,
    ownerDob: 2, ownerSsn: 2, ownerOwnershipPct: 2, ownerAddress: 2,
    ownerCity: 2, ownerState: 2, ownerZip: 2,
    requestedAmount: 3, useOfFunds: 3, loanAmount: 3, avgMonthlyRevenue: 3, gbrAmount: 3, programType: 3,
    notes: 4, stateDisclosureConfirmed: 4,
  };

  const validateStep = async (fields: (keyof DealFormData)[]) => {
    const result = await form.trigger(fields);
    return result;
  };

  const nextStep = async () => {
    let fields: (keyof DealFormData)[] = [];
    if (step === 1) fields = step1Fields;
    if (step === 2) fields = step2Fields;
    if (step === 3) fields = step3Fields;
    const valid = await validateStep(fields);
    if (valid) setStep(s => Math.min(s + 1, 4));
  };

  const prevStep = () => setStep(s => Math.max(s - 1, 1));

  const handleClose = () => {
    setOpen(false);
    setTimeout(() => {
      setStep(1);
      setSubmitted(false);
      form.reset();
    }, 300);
  };

  const onSubmit = async (data: DealFormData) => {
    try {
      const payload = {
        ...data,
        loanAmount: Number(data.loanAmount),
        requestedAmount: data.requestedAmount ? Number(data.requestedAmount) : Number(data.loanAmount),
        avgMonthlyRevenue: data.avgMonthlyRevenue ? Number(data.avgMonthlyRevenue) : undefined,
        gbrAmount: data.gbrAmount ? Number(data.gbrAmount) : undefined,
        ownerOwnershipPct: data.ownerOwnershipPct ? Number(data.ownerOwnershipPct) : undefined,
      };
      await createDeal(payload as any);
      setSubmitted(true);
    } catch (error: any) {
      toast({
        title: "Submission Error",
        description: error.message || "Failed to submit application. Please try again.",
        variant: "destructive",
      });
    }
  };

  const onInvalid = (errors: FieldErrors<DealFormData>) => {
    const errorFields = Object.keys(errors) as (keyof DealFormData)[];
    if (errorFields.length === 0) return;
    const targetStep = Math.min(...errorFields.map((f) => fieldStep[f] ?? 4));
    const firstFieldOnStep =
      errorFields.find((f) => (fieldStep[f] ?? 4) === targetStep) ?? errorFields[0];
    const message = errors[firstFieldOnStep]?.message as string | undefined;
    setStep(targetStep);
    toast({
      title: "Please fix the highlighted fields",
      description: message || "Some required information is missing or invalid.",
      variant: "destructive",
    });
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); else setOpen(true); }}>
      <DialogTrigger asChild>
        <Button
          data-testid="button-submit-deal"
          className="gap-2 bg-gradient-to-r from-primary to-primary/90 shadow-lg shadow-primary/25"
        >
          <Plus className="w-4 h-4" />
          Submit MCA Application
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        {submitted ? (
          <SuccessState onClose={handleClose} merchantName={form.getValues("merchantName")} />
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>MCA Application — Submit to Closing Team</DialogTitle>
              <DialogDescription>
                Complete all sections. Your application will be reviewed by our closing team.
              </DialogDescription>
            </DialogHeader>

            {/* Step Progress */}
            <div className="flex items-center gap-1 py-2">
              {STEPS.map((s, i) => {
                const Icon = s.icon;
                const isActive = step === s.id;
                const isDone = step > s.id;
                return (
                  <div key={s.id} className="flex items-center flex-1">
                    <div className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      isActive ? 'bg-primary text-white' :
                      isDone ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-400'
                    }`}>
                      {isDone ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Icon className="w-3.5 h-3.5" />}
                      <span className="hidden sm:inline">{s.label}</span>
                    </div>
                    {i < STEPS.length - 1 && (
                      <div className={`flex-1 h-0.5 mx-1 ${step > s.id ? 'bg-emerald-300' : 'bg-gray-200'}`} />
                    )}
                  </div>
                );
              })}
            </div>

            <form onSubmit={form.handleSubmit(onSubmit, onInvalid)}>
              {/* STEP 1: Business Information */}
              {step === 1 && (
                <div className="space-y-4">
                  <h3 className="font-semibold text-primary flex items-center gap-2">
                    <Building2 className="w-4 h-4" /> Business Information
                  </h3>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2 space-y-1.5">
                      <Label>Legal Business Name <span className="text-red-500">*</span></Label>
                      <Input data-testid="input-merchant-name" placeholder="Acme Corp LLC" {...form.register("merchantName")} />
                      {form.formState.errors.merchantName && (
                        <p className="text-xs text-destructive">{form.formState.errors.merchantName.message}</p>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      <Label>DBA / Trade Name</Label>
                      <Input data-testid="input-merchant-dba" placeholder="Optional doing-business-as name" {...form.register("merchantDba")} />
                    </div>

                    <div className="space-y-1.5">
                      <Label>Business Type</Label>
                      <Select onValueChange={(v) => form.setValue("businessType", v)} defaultValue="">
                        <SelectTrigger data-testid="select-business-type">
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                        <SelectContent>
                          {BUSINESS_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1.5">
                      <Label>EIN (XX-XXXXXXX)</Label>
                      <Input data-testid="input-ein" placeholder="12-3456789" {...form.register("ein")} />
                      {form.formState.errors.ein && (
                        <p className="text-xs text-destructive">{form.formState.errors.ein.message}</p>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      <Label>Business Start Date</Label>
                      <Input data-testid="input-business-start-date" type="month" {...form.register("businessStartDate")} />
                    </div>

                    <div className="space-y-1.5">
                      <Label>Industry</Label>
                      <Select onValueChange={(v) => form.setValue("industry", v)} defaultValue="">
                        <SelectTrigger data-testid="select-industry">
                          <SelectValue placeholder="Select industry" />
                        </SelectTrigger>
                        <SelectContent>
                          {INDUSTRIES.map(i => <SelectItem key={i} value={i}>{i}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1.5">
                      <Label>Business Phone <span className="text-red-500">*</span></Label>
                      <Input data-testid="input-merchant-phone" placeholder="(555) 000-0000" {...form.register("merchantPhone")} />
                      {form.formState.errors.merchantPhone && (
                        <p className="text-xs text-destructive">{form.formState.errors.merchantPhone.message}</p>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      <Label>Business Email</Label>
                      <Input data-testid="input-merchant-email" type="email" placeholder="info@business.com" {...form.register("merchantEmail")} />
                    </div>

                    <div className="col-span-2 space-y-1.5">
                      <Label>Business Address <span className="text-red-500">*</span></Label>
                      <Input data-testid="input-business-address" placeholder="123 Main St" {...form.register("businessAddress")} />
                      {form.formState.errors.businessAddress && (
                        <p className="text-xs text-destructive">{form.formState.errors.businessAddress.message}</p>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      <Label>City <span className="text-red-500">*</span></Label>
                      <Input data-testid="input-business-city" placeholder="New York" {...form.register("businessCity")} />
                      {form.formState.errors.businessCity && (
                        <p className="text-xs text-destructive">{form.formState.errors.businessCity.message}</p>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1.5">
                        <Label>State <span className="text-red-500">*</span></Label>
                        <Select onValueChange={(v) => form.setValue("businessState", v)} defaultValue="">
                          <SelectTrigger data-testid="select-business-state">
                            <SelectValue placeholder="State" />
                          </SelectTrigger>
                          <SelectContent>
                            {US_STATES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        {form.formState.errors.businessState && (
                          <p className="text-xs text-destructive">{form.formState.errors.businessState.message}</p>
                        )}
                      </div>

                      <div className="space-y-1.5">
                        <Label>ZIP <span className="text-red-500">*</span></Label>
                        <Input data-testid="input-business-zip" placeholder="10001" {...form.register("businessZip")} />
                        {form.formState.errors.businessZip && (
                          <p className="text-xs text-destructive">{form.formState.errors.businessZip.message}</p>
                        )}
                      </div>
                    </div>
                  </div>

                  {needsDisclosure && (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 space-y-2">
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                        <div>
                          <p className="text-sm font-semibold text-amber-800">
                            {disclosureStateName} State Disclosure Required
                          </p>
                          <p className="text-xs text-amber-700 mt-1">
                            {isCA && "Per California's Commercial Finance Disclosure Law (SB1235), PMF will provide all required APR and cost disclosures. Do not transmit any specific offer, rate, or term to this merchant without PMF's prior written consent."}
                            {isVA && "Per Virginia's Sales-Based Financing Disclosure Law, you must be registered as a sales-based financing broker with the Virginia Bureau of Financial Institutions before soliciting Virginia merchants."}
                            {isUT && "Per Utah's Commercial Financing Registration and Disclosure Act, PMF will provide required disclosures for this merchant. Ensure you are registered with the Utah DFI if required."}
                            {isNY && "Per New York's Commercial Finance Disclosure Law (SB5470, effective August 1, 2023), PMF will provide required APR disclosures for transactions of $2.5M or less. Do not quote rates or costs to the merchant prior to receiving PMF's formal disclosure document."}
                            {isCT && "Per Connecticut's Commercial Financing Disclosure Law (Public Act 21-37), PMF will provide required disclosures for this transaction. Do not make representations about financing terms without PMF's provided disclosures."}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* STEP 2: Owner Information */}
              {step === 2 && (
                <div className="space-y-4">
                  <h3 className="font-semibold text-primary flex items-center gap-2">
                    <User className="w-4 h-4" /> Owner / Principal Information
                  </h3>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label>First Name <span className="text-red-500">*</span></Label>
                      <Input data-testid="input-owner-first-name" placeholder="John" {...form.register("ownerFirstName")} />
                      {form.formState.errors.ownerFirstName && (
                        <p className="text-xs text-destructive">{form.formState.errors.ownerFirstName.message}</p>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      <Label>Last Name <span className="text-red-500">*</span></Label>
                      <Input data-testid="input-owner-last-name" placeholder="Smith" {...form.register("ownerLastName")} />
                      {form.formState.errors.ownerLastName && (
                        <p className="text-xs text-destructive">{form.formState.errors.ownerLastName.message}</p>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      <Label>Phone <span className="text-red-500">*</span></Label>
                      <Input data-testid="input-owner-phone" placeholder="(555) 000-0000" {...form.register("ownerPhone")} />
                      {form.formState.errors.ownerPhone && (
                        <p className="text-xs text-destructive">{form.formState.errors.ownerPhone.message}</p>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      <Label>Email</Label>
                      <Input data-testid="input-owner-email" type="email" placeholder="owner@business.com" {...form.register("ownerEmail")} />
                    </div>

                    <div className="space-y-1.5">
                      <Label>Date of Birth</Label>
                      <Input data-testid="input-owner-dob" type="date" {...form.register("ownerDob")} />
                    </div>

                    <div className="space-y-1.5">
                      <Label>SSN (Last 4 digits)</Label>
                      <Input
                        data-testid="input-owner-ssn"
                        placeholder="0000"
                        maxLength={4}
                        {...form.register("ownerSsn")}
                      />
                      {form.formState.errors.ownerSsn && (
                        <p className="text-xs text-destructive">{form.formState.errors.ownerSsn.message}</p>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      <Label>Ownership % <span className="text-red-500">*</span></Label>
                      <Input
                        data-testid="input-owner-pct"
                        type="number"
                        min={1}
                        max={100}
                        placeholder="100"
                        {...form.register("ownerOwnershipPct")}
                      />
                      {form.formState.errors.ownerOwnershipPct && (
                        <p className="text-xs text-destructive">{form.formState.errors.ownerOwnershipPct.message}</p>
                      )}
                    </div>

                    <div className="col-span-2 border-t pt-3">
                      <p className="text-xs text-muted-foreground mb-3">Owner Home Address (if different from business)</p>
                    </div>

                    <div className="col-span-2 space-y-1.5">
                      <Label>Address</Label>
                      <Input data-testid="input-owner-address" placeholder="456 Elm St" {...form.register("ownerAddress")} />
                    </div>

                    <div className="space-y-1.5">
                      <Label>City</Label>
                      <Input data-testid="input-owner-city" placeholder="Brooklyn" {...form.register("ownerCity")} />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1.5">
                        <Label>State</Label>
                        <Select onValueChange={(v) => form.setValue("ownerState", v)} defaultValue="">
                          <SelectTrigger data-testid="select-owner-state">
                            <SelectValue placeholder="ST" />
                          </SelectTrigger>
                          <SelectContent>
                            {US_STATES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label>ZIP</Label>
                        <Input data-testid="input-owner-zip" placeholder="10001" {...form.register("ownerZip")} />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 3: Funding Details */}
              {step === 3 && (
                <div className="space-y-4">
                  <h3 className="font-semibold text-primary flex items-center gap-2">
                    <DollarSign className="w-4 h-4" /> Funding Details
                  </h3>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label>Requested Funding Amount ($) <span className="text-red-500">*</span></Label>
                      <Input
                        data-testid="input-requested-amount"
                        type="number"
                        placeholder="50000"
                        {...form.register("requestedAmount")}
                      />
                      {form.formState.errors.requestedAmount && (
                        <p className="text-xs text-destructive">{form.formState.errors.requestedAmount.message}</p>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      <Label>Avg. Monthly Revenue ($) <span className="text-red-500">*</span></Label>
                      <Input
                        data-testid="input-avg-monthly-revenue"
                        type="number"
                        placeholder="25000"
                        {...form.register("avgMonthlyRevenue")}
                      />
                      {form.formState.errors.avgMonthlyRevenue && (
                        <p className="text-xs text-destructive">{form.formState.errors.avgMonthlyRevenue.message}</p>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      <Label>Loan/Advance Amount ($) <span className="text-red-500">*</span></Label>
                      <Input
                        data-testid="input-loan-amount"
                        type="number"
                        placeholder="50000"
                        {...form.register("loanAmount")}
                      />
                      <p className="text-xs text-muted-foreground">The advance amount (may differ from requested)</p>
                      {form.formState.errors.loanAmount && (
                        <p className="text-xs text-destructive">{form.formState.errors.loanAmount.message}</p>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      <Label>Use of Funds</Label>
                      <Select onValueChange={(v) => form.setValue("useOfFunds", v)} defaultValue="">
                        <SelectTrigger data-testid="select-use-of-funds">
                          <SelectValue placeholder="Select purpose" />
                        </SelectTrigger>
                        <SelectContent>
                          {USE_OF_FUNDS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1.5">
                      <Label>Program Type</Label>
                      <Select
                        onValueChange={(v) => form.setValue("programType", v as any)}
                        defaultValue="pmf_funding"
                      >
                        <SelectTrigger data-testid="select-program-type">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pmf_funding">PMF Funding (Direct)</SelectItem>
                          <SelectItem value="iso_broker">ISO Broker</SelectItem>
                          <SelectItem value="iso_referral">ISO Referral</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="col-span-2 space-y-1.5">
                      <Label>Additional Notes</Label>
                      <Textarea
                        data-testid="input-notes"
                        placeholder="Any additional context, existing positions, monthly statements summary, etc."
                        className="resize-none"
                        rows={3}
                        {...form.register("notes")}
                      />
                    </div>
                  </div>

                  {loanAmount > 0 && (
                    <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 space-y-2">
                      <p className="text-xs font-mono font-semibold text-blue-800 uppercase tracking-wide">Estimated Commission Preview</p>
                      <div className="grid grid-cols-3 gap-3 text-center">
                        <div className="bg-white rounded-lg p-3 border border-blue-100">
                          <p className="text-lg font-mono font-bold text-emerald-600">${estimatedGbr.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                          <p className="text-xs text-gray-500">Est. GBR (10%)</p>
                        </div>
                        <div className="bg-white rounded-lg p-3 border border-blue-100">
                          <p className="text-lg font-mono font-bold text-primary">${macEstimate.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                          <p className="text-xs text-gray-500">Your MAC (22%)</p>
                        </div>
                        <div className="bg-white rounded-lg p-3 border border-blue-100">
                          <p className="text-lg font-mono font-bold text-blue-600">
                            {avgMonthly > 0 ? `${((Number(loanAmount) / Number(avgMonthly)) * 100).toFixed(0)}%` : '—'}
                          </p>
                          <p className="text-xs text-gray-500">Loan/Rev Ratio</p>
                        </div>
                      </div>
                      <p className="text-xs text-blue-700 mt-2">* Commission paid upon funding by closing team. Holdback applies per platform policy.</p>
                    </div>
                  )}
                </div>
              )}

              {/* STEP 4: Review & Submit */}
              {step === 4 && (
                <div className="space-y-4">
                  <h3 className="font-semibold text-primary flex items-center gap-2">
                    <FileText className="w-4 h-4" /> Review & Submit
                  </h3>

                  <div className="space-y-3 text-sm">
                    <ReviewSection title="Business">
                      <ReviewRow label="Legal Name" value={form.getValues("merchantName")} />
                      {form.getValues("merchantDba") && <ReviewRow label="DBA" value={form.getValues("merchantDba")} />}
                      <ReviewRow label="Address" value={`${form.getValues("businessAddress")}, ${form.getValues("businessCity")}, ${form.getValues("businessState")} ${form.getValues("businessZip")}`} />
                      <ReviewRow label="Phone" value={form.getValues("merchantPhone")} />
                      {form.getValues("ein") && <ReviewRow label="EIN" value={form.getValues("ein")} />}
                      {form.getValues("industry") && <ReviewRow label="Industry" value={form.getValues("industry")} />}
                    </ReviewSection>

                    <ReviewSection title="Owner">
                      <ReviewRow label="Name" value={`${form.getValues("ownerFirstName")} ${form.getValues("ownerLastName")}`} />
                      <ReviewRow label="Phone" value={form.getValues("ownerPhone")} />
                      <ReviewRow label="Ownership" value={`${form.getValues("ownerOwnershipPct")}%`} />
                    </ReviewSection>

                    <ReviewSection title="Funding">
                      <ReviewRow label="Requested" value={form.getValues("requestedAmount") ? `$${Number(form.getValues("requestedAmount")).toLocaleString()}` : `$${Number(form.getValues("loanAmount")).toLocaleString()}`} />
                      <ReviewRow label="Avg Monthly Rev." value={form.getValues("avgMonthlyRevenue") ? `$${Number(form.getValues("avgMonthlyRevenue")).toLocaleString()}/mo` : '—'} />
                      <ReviewRow label="Program" value={form.getValues("programType") === 'pmf_funding' ? 'PMF Funding (Direct)' : form.getValues("programType") === 'iso_broker' ? 'ISO Broker' : 'ISO Referral'} />
                    </ReviewSection>
                  </div>

                  {needsDisclosure && (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 space-y-3">
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                        <p className="text-sm font-semibold text-amber-800">State Disclosure Acknowledgment Required</p>
                      </div>
                      <label className="flex items-start gap-2 cursor-pointer">
                        <input
                          data-testid="checkbox-state-disclosure"
                          type="checkbox"
                          className="mt-0.5"
                          {...form.register("stateDisclosureConfirmed")}
                        />
                        <span className="text-xs text-amber-800">
                          I acknowledge the state disclosure requirements for {disclosureStateName} merchants and confirm I am compliant with all applicable regulations. I understand PMF will provide the required disclosures to the merchant.
                        </span>
                      </label>
                    </div>
                  )}

                  <div className="bg-gray-50 border border-dashed border-gray-200 rounded-lg p-4">
                    <p className="text-sm text-gray-600">
                      <span className="font-medium">What happens next:</span> Your application will be submitted to the closing team immediately. You will not see which agent handles closing — only the deal status (Under Review / Funded / Not Approved) will be visible to you. Commissions are processed upon funding.
                    </p>
                  </div>
                </div>
              )}

              {/* Navigation */}
              <div className="flex items-center justify-between pt-4 border-t mt-4">
                <div>
                  {step > 1 && (
                    <Button type="button" variant="outline" onClick={prevStep} data-testid="button-prev-step">
                      <ChevronLeft className="w-4 h-4 mr-1" /> Back
                    </Button>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <Button type="button" variant="ghost" onClick={handleClose} data-testid="button-cancel-deal">
                    Cancel
                  </Button>
                  {step < 4 ? (
                    <Button type="button" onClick={nextStep} data-testid="button-next-step">
                      Next <ChevronRight className="w-4 h-4 ml-1" />
                    </Button>
                  ) : (
                    <Button
                      type="submit"
                      disabled={isPending || (needsDisclosure && !form.watch("stateDisclosureConfirmed"))}
                      data-testid="button-submit-application"
                    >
                      {isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                      Submit to Closing Team
                    </Button>
                  )}
                </div>
              </div>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function SuccessState({ onClose, merchantName }: { onClose: () => void; merchantName: string }) {
  return (
    <div className="py-8 text-center space-y-4">
      <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto">
        <CheckCircle2 className="w-8 h-8 text-emerald-600" />
      </div>
      <div>
        <h3 data-testid="text-submission-success-title" className="text-xl font-bold text-primary">Application Submitted!</h3>
        <p className="text-muted-foreground mt-2 max-w-sm mx-auto">
          Your MCA application for <span className="font-medium text-primary">{merchantName}</span> has been sent to the closing team. You'll see the status update in your deals list.
        </p>
      </div>
      <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 text-left max-w-sm mx-auto">
        <p className="text-sm text-blue-800">
          <span className="font-medium">Reminder:</span> Do not discuss specific offer amounts with the merchant until PMF provides written approval. State disclosure rules apply.
        </p>
      </div>
      <Button onClick={onClose} className="mt-2" data-testid="button-close-success">
        Back to Deals
      </Button>
    </div>
  );
}

function ReviewSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="bg-gray-50 px-3 py-2 border-b">
        <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">{title}</p>
      </div>
      <div className="divide-y">{children}</div>
    </div>
  );
}

function ReviewRow({ label, value }: { label: string; value: string | undefined | null }) {
  if (!value) return null;
  return (
    <div className="px-3 py-2 flex justify-between items-center gap-4">
      <span className="text-gray-500 text-xs">{label}</span>
      <span className="font-medium text-xs text-right">{value}</span>
    </div>
  );
}
