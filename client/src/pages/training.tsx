import { useState } from "react";
import { Sidebar } from "@/components/Sidebar";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@shared/routes";
import { 
  Play, 
  CheckCircle2, 
  Lock,
  Clock,
  BookOpen,
  Trophy,
  Video,
  FileText,
  GraduationCap,
  Loader2,
  Target,
  MessageSquare,
  ShieldCheck,
  Users,
  Calendar,
  Zap,
  Star,
  ArrowRight,
  Layers,
  TrendingUp
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

// Types
type CourseModule = {
  id: number;
  moduleNumber: number;
  title: string;
  description: string | null;
  videoUrl: string | null;
  durationSeconds: number | null;
  slideCount: number;
  isPublished: boolean;
};

type ModuleProgress = {
  moduleId: number;
  status: 'not_started' | 'in_progress' | 'completed';
  currentSlide: number;
  completedSlides: number;
  quizScore: number | null;
};

type ModuleWithProgress = CourseModule & {
  progress?: ModuleProgress;
};

type TrainingData = {
  modules: ModuleWithProgress[];
  overallProgress: number;
  completedModules: number;
  totalModules: number;
};

function formatDuration(seconds: number | null): string {
  if (!seconds) return "--";
  const mins = Math.floor(seconds / 60);
  return `${mins} min`;
}

function getModuleStatus(module: ModuleWithProgress, index: number, modules: ModuleWithProgress[]): 'completed' | 'current' | 'locked' | 'available' {
  if (module.progress?.status === 'completed') return 'completed';
  if (module.progress?.status === 'in_progress') return 'current';
  
  // Check if previous module is completed
  if (index === 0) return 'available';
  const prevModule = modules[index - 1];
  if (prevModule.progress?.status === 'completed') return 'available';
  
  return 'locked';
}

function ModuleCard({ module, status, onStart }: { 
  module: ModuleWithProgress; 
  status: 'completed' | 'current' | 'locked' | 'available';
  onStart: () => void;
}) {
  const progress = module.progress;
  const progressPercent = progress 
    ? Math.round((progress.completedSlides / module.slideCount) * 100)
    : 0;

  return (
    <Card className={cn(
      "overflow-hidden transition-all hover:shadow-md",
      status === 'locked' && "opacity-60",
      status === 'current' && "ring-2 ring-primary"
    )}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-3">
            <div className={cn(
              "w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold",
              status === 'completed' && "bg-green-100 text-green-700",
              status === 'current' && "bg-primary/10 text-primary",
              status === 'available' && "bg-gray-100 text-gray-600",
              status === 'locked' && "bg-gray-100 text-gray-400"
            )}>
              {status === 'completed' ? (
                <CheckCircle2 className="w-5 h-5" />
              ) : status === 'locked' ? (
                <Lock className="w-4 h-4" />
              ) : (
                module.moduleNumber
              )}
            </div>
            <div>
              <CardTitle className="text-lg">Module {module.moduleNumber}</CardTitle>
              <CardDescription className="text-sm font-medium text-foreground">
                {module.title}
              </CardDescription>
            </div>
          </div>
          {status === 'completed' && progress?.quizScore && (
            <Badge className="bg-green-100 text-green-700">
              Quiz: {progress.quizScore}%
            </Badge>
          )}
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">{module.description}</p>
        
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <span className="flex items-center gap-1">
            <Video className="w-4 h-4" />
            {module.slideCount} slides
          </span>
          <span className="flex items-center gap-1">
            <Clock className="w-4 h-4" />
            {formatDuration(module.durationSeconds)}
          </span>
        </div>

        {(status === 'current' || status === 'completed') && (
          <div className="space-y-1">
            <div className="flex justify-between text-sm">
              <span>Progress</span>
              <span>{progressPercent}%</span>
            </div>
            <Progress value={progressPercent} className="h-2" />
          </div>
        )}

        <Button 
          className="w-full gap-2" 
          disabled={status === 'locked'}
          variant={status === 'completed' ? 'outline' : 'default'}
          onClick={onStart}
        >
          {status === 'completed' ? (
            <>
              <Play className="w-4 h-4" />
              Review Module
            </>
          ) : status === 'current' ? (
            <>
              <Play className="w-4 h-4" />
              Continue Learning
            </>
          ) : status === 'locked' ? (
            <>
              <Lock className="w-4 h-4" />
              Complete Previous Module
            </>
          ) : (
            <>
              <Play className="w-4 h-4" />
              Start Module
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}

function VideoPlayer({ module, onProgress }: { 
  module: ModuleWithProgress;
  onProgress: (slideNumber: number) => void;
}) {
  const isYouTube = module.videoUrl?.includes('youtube.com/embed');
  
  return (
    <div className="space-y-4">
      <div className="aspect-video bg-black rounded-lg overflow-hidden">
        {module.videoUrl ? (
          isYouTube ? (
            <iframe
              src={module.videoUrl}
              title={`Module ${module.moduleNumber}: ${module.title}`}
              className="w-full h-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          ) : (
            <video 
              controls 
              className="w-full h-full"
              poster={`/thumbnails/module${module.moduleNumber}.jpg`}
            >
              <source src={module.videoUrl} type="video/mp4" />
              Your browser does not support video playback.
            </video>
          )
        ) : (
          <div className="w-full h-full flex items-center justify-center text-white/50">
            <div className="text-center">
              <Video className="w-12 h-12 mx-auto mb-2" />
              <p>Video coming soon</p>
            </div>
          </div>
        )}
      </div>
      
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Module {module.moduleNumber}: {module.title}</h2>
          <p className="text-muted-foreground">{module.slideCount} slides • {formatDuration(module.durationSeconds)}</p>
        </div>
        <Button variant="outline" size="sm">
          <FileText className="w-4 h-4 mr-2" />
          Download Slides
        </Button>
      </div>
    </div>
  );
}

export default function TrainingPage() {
  const [selectedModule, setSelectedModule] = useState<ModuleWithProgress | null>(null);
  const [activeTab, setActiveTab] = useState<'course' | 'resources'>('course');
  const queryClient = useQueryClient();
  
  // Fetch training data from API
  const { data: trainingData, isLoading, error } = useQuery({
    queryKey: ['training-progress'],
    queryFn: async () => {
      const res = await fetch(api.training.progress.path, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch training data');
      return res.json() as Promise<TrainingData>;
    },
  });

  // Mutation to update progress
  const updateProgressMutation = useMutation({
    mutationFn: async ({ moduleId, data }: { moduleId: number; data: any }) => {
      const res = await fetch(api.training.updateProgress.path.replace(':moduleId', String(moduleId)), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to update progress');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['training-progress'] });
    },
  });

  const modules = trainingData?.modules ?? [];
  const completedCount = trainingData?.completedModules ?? 0;
  const overallProgress = trainingData?.overallProgress ?? 0;

  const handleStartModule = (module: ModuleWithProgress) => {
    // Mark as in_progress when starting
    if (!module.progress || module.progress.status === 'not_started') {
      updateProgressMutation.mutate({ 
        moduleId: module.id, 
        data: { status: 'in_progress' } 
      });
    }
    setSelectedModule(module);
  };

  const handleMarkComplete = (moduleId: number) => {
    updateProgressMutation.mutate({ 
      moduleId, 
      data: { status: 'completed' } 
    });
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen bg-gray-50/50">
        <Sidebar />
        <main className="flex-1 lg:ml-64 p-4 pt-20 lg:pt-8 lg:p-8 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </main>
      </div>
    );
  }

  if (selectedModule) {
    return (
      <div className="flex min-h-screen bg-gray-50/50">
        <Sidebar />
        
        <main className="flex-1 lg:ml-64 p-4 pt-20 lg:pt-8 lg:p-8">
          <Button 
            variant="ghost" 
            className="mb-4"
            onClick={() => setSelectedModule(null)}
          >
            ← Back to Training
          </Button>
          
          <VideoPlayer 
            module={selectedModule} 
            onProgress={(slide) => {
              updateProgressMutation.mutate({ 
                moduleId: selectedModule.id, 
                data: { currentSlide: slide, completedSlides: slide } 
              });
            }} 
          />
          
          {/* Mark as Complete button */}
          {selectedModule.progress?.status !== 'completed' && (
            <div className="mt-4 flex justify-end">
              <Button 
                onClick={() => handleMarkComplete(selectedModule.id)}
                disabled={updateProgressMutation.isPending}
              >
                <CheckCircle2 className="w-4 h-4 mr-2" />
                Mark as Complete
              </Button>
            </div>
          )}
          
          {/* Module content/notes section */}
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Module Overview</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">{selectedModule.description}</p>
              
              <div className="mt-6 space-y-3">
                <h3 className="font-semibold">What You'll Learn:</h3>
                <ul className="space-y-2">
                  {selectedModule.moduleNumber === 1 && (
                    <>
                      <li className="flex items-start gap-2">
                        <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5" />
                        <span>What merchant cash advance really is (and isn't)</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5" />
                        <span>Key terms: factor rate, holdback, position</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5" />
                        <span>The complete transaction flow from application to funding</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5" />
                        <span>How your commission is calculated</span>
                      </li>
                    </>
                  )}
                  {selectedModule.moduleNumber === 2 && (
                    <>
                      <li className="flex items-start gap-2">
                        <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5" />
                        <span>Minimum requirements for MCA qualification</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5" />
                        <span>Best industries for high approval rates</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5" />
                        <span>Red flags to avoid in prospects</span>
                      </li>
                    </>
                  )}
                  {selectedModule.moduleNumber === 3 && (
                    <>
                      <li className="flex items-start gap-2">
                        <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5" />
                        <span>Cold call and warm outreach scripts</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5" />
                        <span>Handling the top objections</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5" />
                        <span>Closing techniques that work</span>
                      </li>
                    </>
                  )}
                </ul>
              </div>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-gray-50/50">
      <Sidebar />
      
      <main className="flex-1 lg:ml-64 p-4 pt-20 lg:pt-8 lg:p-8">
        <header className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-display font-bold text-primary flex items-center gap-3" data-testid="text-training-heading">
                <GraduationCap className="w-8 h-8" />
                Leadershield Academy
              </h1>
              <p className="text-muted-foreground mt-2">
                Complete all modules to become a Certified Leadershield Agent.
              </p>
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold text-primary">{overallProgress}%</div>
              <div className="text-sm text-muted-foreground">{completedCount} of {modules.length} completed</div>
            </div>
          </div>
          
          <div className="mt-4">
            <Progress value={overallProgress} className="h-3" />
          </div>
        </header>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'course' | 'resources')}>
          <TabsList className="mb-6">
            <TabsTrigger value="course" className="gap-2">
              <Video className="w-4 h-4" />
              Video Course
            </TabsTrigger>
            <TabsTrigger value="resources" className="gap-2">
              <BookOpen className="w-4 h-4" />
              Sales Resources
            </TabsTrigger>
          </TabsList>

          <TabsContent value="course">
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {modules.map((module, index) => (
                <ModuleCard
                  key={module.id}
                  module={module}
                  status={getModuleStatus(module, index, modules)}
                  onStart={() => handleStartModule(module)}
                />
              ))}
            </div>

            {completedCount === modules.length && (
              <Card className="mt-8 bg-gradient-to-r from-yellow-50 to-amber-50 border-yellow-200">
                <CardContent className="py-8 text-center">
                  <Trophy className="w-16 h-16 mx-auto mb-4 text-yellow-500" />
                  <h2 className="text-2xl font-bold text-yellow-800 mb-2">
                    Congratulations!
                  </h2>
                  <p className="text-yellow-700">
                    You've completed all training modules. You're now a Certified Leadershield Agent!
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="resources">
            <SalesResources />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

// Sales Resources Component
function SalesResources() {
  return (
    <div className="space-y-8">
      {/* Quick Reference */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Sales Quick Reference
          </CardTitle>
          <CardDescription>Essential scripts and frameworks for your calls</CardDescription>
        </CardHeader>
        <CardContent className="prose prose-sm max-w-none">
          <h3 className="flex items-center gap-2"><Target className="w-4 h-4 text-primary" /> The Cold Call Opening</h3>
          <div className="bg-gray-50 p-4 rounded-lg font-mono text-sm">
            "Hi [Name], this is [Your Name] with Leadershield Network. I work with business owners like yourself to help them access working capital quickly — usually funded within 48 hours, no impact to your credit to check options.<br/><br/>
            Do you have 2 minutes to see if this could help your business?"
          </div>

          <h3 className="flex items-center gap-2"><MessageSquare className="w-4 h-4 text-primary" /> Discovery Questions</h3>
          <ul>
            <li>"What would you use additional capital for?"</li>
            <li>"Have you looked into financing before? What happened?"</li>
            <li>"How quickly do you need access to funds?"</li>
            <li>"What's your ideal funding amount?"</li>
            <li>"Are you the decision maker, or is there a partner involved?"</li>
          </ul>

          <h3 className="flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-primary" /> Objection Handlers</h3>
          
          <h4>"The rate is too high"</h4>
          <div className="bg-blue-50 p-4 rounded-lg text-sm">
            "I hear you — it's definitely higher than a traditional bank loan. But let me ask: have you tried getting approved at a bank? How long did that take? MCA exists because banks say no or take months. The cost is for speed and accessibility.<br/><br/>
            If you had an opportunity to make $50K but needed $20K to execute it, would paying $26K back over 6 months be worth it?"
          </div>

          <h4>"I need to think about it"</h4>
          <div className="bg-blue-50 p-4 rounded-lg text-sm">
            "Totally understand. What specifically do you want to think about? Is it the amount, the cost, or something else?<br/><br/>
            [If cost]: Let me show you the math on how this pays for itself...<br/>
            [If timing]: What's your timeline for making a decision?<br/>
            [If partner]: When can we get them on a call together?"
          </div>

          <h4>"I've heard bad things about MCA"</h4>
          <div className="bg-blue-50 p-4 rounded-lg text-sm">
            "There are definitely some bad actors in this industry — I won't pretend otherwise. That's exactly why we focus on transparency. I'll show you exactly what you're paying, no hidden fees. And we only offer terms you can actually afford.<br/><br/>
            Would you rather work with someone who's upfront, or take your chances with whoever answers your Google search?"
          </div>

          <h3 className="flex items-center gap-2"><Target className="w-4 h-4 text-primary" /> Trial Close</h3>
          <div className="bg-green-50 p-4 rounded-lg font-mono text-sm">
            "If I can get you approved for $40K, funded by Friday, would you move forward?"
          </div>

          <h3 className="flex items-center gap-2"><FileText className="w-4 h-4 text-primary" /> Documents Checklist</h3>
          <ul>
            <li><strong>Bank Statements</strong> — Last 4 months (business account)</li>
            <li><strong>Driver's License</strong> — Front and back</li>
            <li><strong>Voided Check</strong> — For funding deposit</li>
            <li><strong>Application</strong> — Basic business info (signed)</li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Layers className="w-5 h-5" />
            Merchant Growth Platform Sales
          </CardTitle>
          <CardDescription>Consultative selling approach from the Leadershield Sales Playbook</CardDescription>
        </CardHeader>
        <CardContent className="prose prose-sm max-w-none">
          <h3 className="flex items-center gap-2"><ArrowRight className="w-4 h-4 text-primary" /> Step 1: Discovery &amp; Qualification</h3>
          <p className="text-muted-foreground">Use open-ended questions and active listening to uncover merchant pain points.</p>
          <ul>
            <li>"Tell me about your current marketing efforts — what's working and what isn't?"</li>
            <li>"How do your customers typically find your business?"</li>
            <li>"What does your online presence look like today? Are you happy with your Google reviews?"</li>
            <li>"If you could change one thing about how you attract and retain customers, what would it be?"</li>
            <li>"What tools or software are you currently using to manage customer relationships?"</li>
          </ul>
          <p className="text-muted-foreground"><strong>Qualifying:</strong> Listen for signals that the merchant is actively losing revenue due to poor visibility, manual processes, or lack of follow-up systems.</p>

          <h3 className="flex items-center gap-2"><ArrowRight className="w-4 h-4 text-primary" /> Step 2: The Presentation</h3>
          <ul>
            <li><strong>Tailor the pitch:</strong> Connect their specific pain points to the matching platform tier features</li>
            <li><strong>Tell stories:</strong> Use real examples of merchants who saw measurable results</li>
            <li><strong>Focus on ROI:</strong> "If this system brings in just 2 extra customers per month at $500 average ticket, that's $12,000/year from a $199/mo investment"</li>
            <li><strong>Demo the value:</strong> Walk through the platform dashboard and show them what their business data looks like</li>
          </ul>

          <h3 className="flex items-center gap-2"><ArrowRight className="w-4 h-4 text-primary" /> Step 3: Handling Objections</h3>
          
          <h4>"I can't afford it"</h4>
          <div className="bg-blue-50 p-4 rounded-lg text-sm">
            "I totally understand budget concerns. Let's look at what you're currently spending on marketing that isn't trackable. Most merchants find they're already spending more on ineffective tactics. This platform consolidates everything and gives you measurable ROI. Plus, Merchant Essentials starts at just $199/mo — less than most merchants spend on a single print ad."
          </div>

          <h4>"I don't have time to learn new tools"</h4>
          <div className="bg-blue-50 p-4 rounded-lg text-sm">
            "That's exactly why we built this platform — to save you time, not add to your workload. The AI handles lead follow-up, review requests go out automatically, and the CRM organizes everything. Most merchants tell us they save 5-10 hours per week once they're set up. And our onboarding team handles the entire setup for you."
          </div>

          <h4>"I'm already using other tools"</h4>
          <div className="bg-blue-50 p-4 rounded-lg text-sm">
            "That's great — it shows you value technology. The challenge most merchants face is that they're paying for 3-4 separate tools that don't talk to each other. Our platform replaces your review tool, email marketing, CRM, and AI chatbot with one integrated system. You'll likely save money and get better results."
          </div>

          <h3 className="flex items-center gap-2"><ArrowRight className="w-4 h-4 text-primary" /> Step 4: Closing the Deal</h3>
          <ul>
            <li><strong>Right tier recommendation:</strong> Match the merchant's needs to the appropriate subscription level — don't oversell</li>
            <li><strong>Onboarding assurance:</strong> "Our team handles everything — you'll be fully operational within 48 hours"</li>
            <li><strong>Remove risk:</strong> Emphasize the value guarantee and ongoing support</li>
            <li><strong>Ask for the commitment:</strong> "Based on what we discussed, Growth Accelerator covers everything you need. Shall we get you set up today?"</li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="w-5 h-5" />
            MCA Pairing Enhancement
          </CardTitle>
          <CardDescription>Maximize earnings by combining MCA deals with platform subscriptions</CardDescription>
        </CardHeader>
        <CardContent className="prose prose-sm max-w-none">
          <div className="bg-primary/5 p-4 rounded-lg mb-4">
            <strong className="text-primary">+5% Pairing Enhancement:</strong>
            <span className="text-muted-foreground ml-1">When a merchant has an active Merchant Growth Platform subscription, your MCA commission increases by 5% of GBR.</span>
          </div>
          <h3 className="flex items-center gap-2"><Star className="w-4 h-4 text-primary" /> Key Selling Points</h3>
          <ul>
            <li><strong>Two revenue streams, one relationship:</strong> Earn immediate MCA commissions plus recurring platform residuals from the same merchant</li>
            <li><strong>Higher MCA conversions:</strong> Merchants using the platform have better financial visibility, making them stronger MCA candidates</li>
            <li><strong>Sticky relationships:</strong> Platform subscribers are more engaged and more likely to do repeat MCA transactions</li>
            <li><strong>Compounding income:</strong> MCA deals are one-time earnings; platform subscriptions build long-term recurring wealth</li>
          </ul>
          <h3 className="flex items-center gap-2"><Target className="w-4 h-4 text-primary" /> The Pitch</h3>
          <div className="bg-green-50 p-4 rounded-lg text-sm">
            "While we work on getting your funding approved, let me show you something that will help your business generate even more revenue. Our Merchant Growth Platform gives you the tools to attract more customers and manage your business finances — so next time you need capital, you'll qualify for even better terms."
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Layers className="w-5 h-5" />
            Subscription Tier Quick Reference
          </CardTitle>
          <CardDescription>Feature comparison across all Merchant Growth Platform tiers</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 pr-4 font-semibold">Feature</th>
                  <th className="text-center py-2 px-2 font-semibold">Essentials<br/><span className="text-muted-foreground font-normal">$199/mo</span></th>
                  <th className="text-center py-2 px-2 font-semibold">Growth<br/><span className="text-muted-foreground font-normal">$429/mo</span></th>
                  <th className="text-center py-2 px-2 font-semibold">Elite AI<br/><span className="text-muted-foreground font-normal">$749/mo</span></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                <tr>
                  <td className="py-2 pr-4">Financial Reporting</td>
                  <td className="text-center py-2"><CheckCircle2 className="w-4 h-4 text-green-600 mx-auto" /></td>
                  <td className="text-center py-2"><CheckCircle2 className="w-4 h-4 text-green-600 mx-auto" /></td>
                  <td className="text-center py-2"><CheckCircle2 className="w-4 h-4 text-green-600 mx-auto" /></td>
                </tr>
                <tr>
                  <td className="py-2 pr-4">Forecasting</td>
                  <td className="text-center py-2"><CheckCircle2 className="w-4 h-4 text-green-600 mx-auto" /></td>
                  <td className="text-center py-2"><CheckCircle2 className="w-4 h-4 text-green-600 mx-auto" /></td>
                  <td className="text-center py-2"><CheckCircle2 className="w-4 h-4 text-green-600 mx-auto" /></td>
                </tr>
                <tr>
                  <td className="py-2 pr-4">Expense Categorization</td>
                  <td className="text-center py-2"><CheckCircle2 className="w-4 h-4 text-green-600 mx-auto" /></td>
                  <td className="text-center py-2"><CheckCircle2 className="w-4 h-4 text-green-600 mx-auto" /></td>
                  <td className="text-center py-2"><CheckCircle2 className="w-4 h-4 text-green-600 mx-auto" /></td>
                </tr>
                <tr>
                  <td className="py-2 pr-4">Credit Monitoring</td>
                  <td className="text-center py-2"><CheckCircle2 className="w-4 h-4 text-green-600 mx-auto" /></td>
                  <td className="text-center py-2"><CheckCircle2 className="w-4 h-4 text-green-600 mx-auto" /></td>
                  <td className="text-center py-2"><CheckCircle2 className="w-4 h-4 text-green-600 mx-auto" /></td>
                </tr>
                <tr>
                  <td className="py-2 pr-4">Google Business Optimization</td>
                  <td className="text-center py-2 text-muted-foreground">—</td>
                  <td className="text-center py-2"><CheckCircle2 className="w-4 h-4 text-green-600 mx-auto" /></td>
                  <td className="text-center py-2"><CheckCircle2 className="w-4 h-4 text-green-600 mx-auto" /></td>
                </tr>
                <tr>
                  <td className="py-2 pr-4">Review Capture</td>
                  <td className="text-center py-2 text-muted-foreground">—</td>
                  <td className="text-center py-2"><CheckCircle2 className="w-4 h-4 text-green-600 mx-auto" /></td>
                  <td className="text-center py-2"><CheckCircle2 className="w-4 h-4 text-green-600 mx-auto" /></td>
                </tr>
                <tr>
                  <td className="py-2 pr-4">SMS/Email Automation</td>
                  <td className="text-center py-2 text-muted-foreground">—</td>
                  <td className="text-center py-2"><CheckCircle2 className="w-4 h-4 text-green-600 mx-auto" /></td>
                  <td className="text-center py-2"><CheckCircle2 className="w-4 h-4 text-green-600 mx-auto" /></td>
                </tr>
                <tr>
                  <td className="py-2 pr-4">CRM + AI Chatbot</td>
                  <td className="text-center py-2 text-muted-foreground">—</td>
                  <td className="text-center py-2"><CheckCircle2 className="w-4 h-4 text-green-600 mx-auto" /></td>
                  <td className="text-center py-2"><CheckCircle2 className="w-4 h-4 text-green-600 mx-auto" /></td>
                </tr>
                <tr>
                  <td className="py-2 pr-4">AI-Driven Lead Generation</td>
                  <td className="text-center py-2 text-muted-foreground">—</td>
                  <td className="text-center py-2 text-muted-foreground">—</td>
                  <td className="text-center py-2"><CheckCircle2 className="w-4 h-4 text-green-600 mx-auto" /></td>
                </tr>
                <tr>
                  <td className="py-2 pr-4">Appointment Booking</td>
                  <td className="text-center py-2 text-muted-foreground">—</td>
                  <td className="text-center py-2 text-muted-foreground">—</td>
                  <td className="text-center py-2"><CheckCircle2 className="w-4 h-4 text-green-600 mx-auto" /></td>
                </tr>
                <tr>
                  <td className="py-2 pr-4">Conversion Funnels</td>
                  <td className="text-center py-2 text-muted-foreground">—</td>
                  <td className="text-center py-2 text-muted-foreground">—</td>
                  <td className="text-center py-2"><CheckCircle2 className="w-4 h-4 text-green-600 mx-auto" /></td>
                </tr>
                <tr>
                  <td className="py-2 pr-4">Competitive Ad Intelligence</td>
                  <td className="text-center py-2 text-muted-foreground">—</td>
                  <td className="text-center py-2 text-muted-foreground">—</td>
                  <td className="text-center py-2"><CheckCircle2 className="w-4 h-4 text-green-600 mx-auto" /></td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Your First 30 Days
          </CardTitle>
          <CardDescription>Week-by-week roadmap to launch your Leadershield business</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div className="flex gap-4">
              <div className="flex flex-col items-center">
                <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-sm">W1</div>
                <div className="w-0.5 flex-1 bg-border mt-1" />
              </div>
              <div className="pb-6">
                <h4 className="font-semibold mb-2">Week 1: Foundation</h4>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  <li className="flex items-start gap-2"><CheckCircle2 className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" /> Complete Leadershield Academy training modules</li>
                  <li className="flex items-start gap-2"><CheckCircle2 className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" /> Set up your agent portal and CRM access</li>
                  <li className="flex items-start gap-2"><CheckCircle2 className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" /> Learn the three subscription tiers and key features</li>
                  <li className="flex items-start gap-2"><CheckCircle2 className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" /> Practice cold call scripts with your sponsor</li>
                </ul>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex flex-col items-center">
                <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-sm">W2</div>
                <div className="w-0.5 flex-1 bg-border mt-1" />
              </div>
              <div className="pb-6">
                <h4 className="font-semibold mb-2">Week 2: Activation</h4>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  <li className="flex items-start gap-2"><CheckCircle2 className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" /> Begin outreach — minimum 25 contacts per day</li>
                  <li className="flex items-start gap-2"><CheckCircle2 className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" /> Submit your first MCA application</li>
                  <li className="flex items-start gap-2"><CheckCircle2 className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" /> Schedule your first Merchant Growth Platform demo</li>
                  <li className="flex items-start gap-2"><CheckCircle2 className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" /> Shadow a senior agent on a closing call</li>
                </ul>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex flex-col items-center">
                <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-sm">W3</div>
                <div className="w-0.5 flex-1 bg-border mt-1" />
              </div>
              <div className="pb-6">
                <h4 className="font-semibold mb-2">Week 3: Momentum</h4>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  <li className="flex items-start gap-2"><CheckCircle2 className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" /> Close your first MCA deal or platform subscription</li>
                  <li className="flex items-start gap-2"><CheckCircle2 className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" /> Increase daily outreach to 50+ contacts</li>
                  <li className="flex items-start gap-2"><CheckCircle2 className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" /> Practice pairing MCA with platform subscriptions</li>
                  <li className="flex items-start gap-2"><CheckCircle2 className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" /> Build your follow-up pipeline in the CRM</li>
                </ul>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex flex-col items-center">
                <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-sm">W4</div>
              </div>
              <div>
                <h4 className="font-semibold mb-2">Week 4: Results</h4>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  <li className="flex items-start gap-2"><CheckCircle2 className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" /> Review your first month's metrics with your sponsor</li>
                  <li className="flex items-start gap-2"><CheckCircle2 className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" /> Set month 2 production goals</li>
                  <li className="flex items-start gap-2"><CheckCircle2 className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" /> Start recruiting — identify potential agents in your network</li>
                  <li className="flex items-start gap-2"><CheckCircle2 className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" /> Target: 1 funded MCA + 4 platform subscriptions</li>
                </ul>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Agent Role Descriptions
          </CardTitle>
          <CardDescription>Understanding the different agent roles in the Leadershield Network</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Target className="w-4 h-4 text-primary" />
                  Primary Referring Agent (Opener)
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground space-y-2">
                <p>The agent who identifies and qualifies the merchant lead. Responsible for initial outreach, discovery calls, and setting appointments.</p>
                <ul className="space-y-1">
                  <li className="flex items-start gap-2"><ArrowRight className="w-3 h-3 mt-1 shrink-0" /> Sources and contacts new merchant leads</li>
                  <li className="flex items-start gap-2"><ArrowRight className="w-3 h-3 mt-1 shrink-0" /> Conducts initial qualification</li>
                  <li className="flex items-start gap-2"><ArrowRight className="w-3 h-3 mt-1 shrink-0" /> Earns 22% of GBR on MCA deals</li>
                  <li className="flex items-start gap-2"><ArrowRight className="w-3 h-3 mt-1 shrink-0" /> Earns primary commission on platform subscriptions</li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-primary" />
                  Fulfillment Agent (Closer)
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground space-y-2">
                <p>The agent who takes qualified leads through the full sales process to closing. Handles presentations, objections, and deal completion.</p>
                <ul className="space-y-1">
                  <li className="flex items-start gap-2"><ArrowRight className="w-3 h-3 mt-1 shrink-0" /> Conducts product demos and presentations</li>
                  <li className="flex items-start gap-2"><ArrowRight className="w-3 h-3 mt-1 shrink-0" /> Handles objections and negotiation</li>
                  <li className="flex items-start gap-2"><ArrowRight className="w-3 h-3 mt-1 shrink-0" /> Earns 5% of GBR on MCA deals</li>
                  <li className="flex items-start gap-2"><ArrowRight className="w-3 h-3 mt-1 shrink-0" /> Manages document collection and submission</li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-primary" />
                  Sponsor
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground space-y-2">
                <p>The agent who recruited and mentors other agents. Provides training, support, and guidance to help their team succeed.</p>
                <ul className="space-y-1">
                  <li className="flex items-start gap-2"><ArrowRight className="w-3 h-3 mt-1 shrink-0" /> Recruits and onboards new agents</li>
                  <li className="flex items-start gap-2"><ArrowRight className="w-3 h-3 mt-1 shrink-0" /> Provides ongoing coaching and mentorship</li>
                  <li className="flex items-start gap-2"><ArrowRight className="w-3 h-3 mt-1 shrink-0" /> Earns 3% of GBR override on team MCA deals</li>
                  <li className="flex items-start gap-2"><ArrowRight className="w-3 h-3 mt-1 shrink-0" /> Builds long-term residual income through team production</li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>

      {/* Best Practices */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="w-5 h-5" />
            Telephonic Sales Best Practices
          </CardTitle>
          <CardDescription>Proven techniques from top producers</CardDescription>
        </CardHeader>
        <CardContent className="prose prose-sm max-w-none">
          <h3 className="flex items-center gap-2"><MessageSquare className="w-4 h-4 text-primary" /> Before the Call</h3>
          <ul>
            <li><strong>Research first:</strong> 60 seconds of LinkedIn/Google can save 5 minutes of awkward questions</li>
            <li><strong>Clear your space:</strong> No distractions, water ready, CRM open</li>
            <li><strong>Smile before you dial:</strong> They can hear it in your voice</li>
            <li><strong>Have your one-pager ready:</strong> Key stats and talking points visible</li>
          </ul>

          <h3 className="flex items-center gap-2"><MessageSquare className="w-4 h-4 text-primary" /> Voice &amp; Tonality</h3>
          <ul>
            <li><strong>Stand up:</strong> Your voice projects better and you sound more confident</li>
            <li><strong>Match their pace:</strong> Fast talkers like fast talkers, slow = trustworthy to some</li>
            <li><strong>Lower your pitch slightly:</strong> Authority comes from depth, not volume</li>
            <li><strong>Pause after questions:</strong> Silence makes people fill the gap</li>
          </ul>

          <h3 className="flex items-center gap-2"><Star className="w-4 h-4 text-primary" /> Mindset</h3>
          <ul>
            <li><strong>You're not selling — you're solving:</strong> They have a problem, you have a solution</li>
            <li><strong>Rejection is data:</strong> "No" today might be "yes" in 90 days</li>
            <li><strong>Activity creates luck:</strong> More calls = more deals, no shortcuts</li>
            <li><strong>Be curious, not pushy:</strong> Ask questions, listen 70% of the time</li>
          </ul>

          <h3 className="flex items-center gap-2"><TrendingUp className="w-4 h-4 text-primary" /> The Numbers Game</h3>
          <table className="w-full">
            <thead>
              <tr>
                <th>Metric</th>
                <th>Target</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Dials per day</td>
                <td>50-100</td>
              </tr>
              <tr>
                <td>Conversations per day</td>
                <td>15-25</td>
              </tr>
              <tr>
                <td>Applications per week</td>
                <td>5-10</td>
              </tr>
              <tr>
                <td>Funded deals per week</td>
                <td>2-4</td>
              </tr>
            </tbody>
          </table>

          <h3 className="flex items-center gap-2"><Clock className="w-4 h-4 text-primary" /> Best Call Times</h3>
          <ul>
            <li><strong>Tuesday-Thursday:</strong> Decision makers are focused</li>
            <li><strong>8-10 AM local time:</strong> Before meetings start</li>
            <li><strong>4-6 PM local time:</strong> After the day's fires</li>
            <li><strong>Avoid:</strong> Monday AM (catching up), Friday PM (checked out)</li>
          </ul>

          <h3 className="flex items-center gap-2"><ArrowRight className="w-4 h-4 text-primary" /> The Follow-Up System</h3>
          <ul>
            <li><strong>Day 1:</strong> Initial contact</li>
            <li><strong>Day 2:</strong> Follow-up call + text</li>
            <li><strong>Day 4:</strong> Email with case study</li>
            <li><strong>Day 7:</strong> "Checking in" call</li>
            <li><strong>Day 14:</strong> Value-add email</li>
            <li><strong>Day 30:</strong> "Still available" text</li>
            <li><strong>Day 60:</strong> NL Pearl re-engagement</li>
          </ul>
          
          <div className="bg-amber-50 border border-amber-200 p-4 rounded-lg mt-6">
            <strong className="text-amber-800 flex items-center gap-1"><Star className="w-4 h-4" /> Pro Tip:</strong>
            <p className="text-amber-700 mt-1">
              80% of deals close after 5+ touches. Most agents give up after 1-2. 
              Be the agent who follows up.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
