import { useState } from "react";
import { Sidebar } from "@/components/Sidebar";
import { 
  Play, 
  CheckCircle2, 
  Lock,
  Clock,
  BookOpen,
  Trophy,
  Video,
  FileText,
  GraduationCap
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

// Placeholder data - will be replaced with API calls
// Video durations based on actual built videos:
// Module 1: 11.0 min (660s), Module 2: 4.7 min (282s), Module 3: 6.3 min (378s)
// Module 4: 4.2 min (252s), Module 5: 3.6 min (216s), Module 6: 4.0 min (240s)
const PLACEHOLDER_MODULES: ModuleWithProgress[] = [
  {
    id: 1,
    moduleNumber: 1,
    title: "MCA Fundamentals",
    description: "Understanding merchant cash advance - what it is, key terms, transaction flow, and how you earn commissions.",
    videoUrl: "https://www.youtube.com/embed/V_yT4AVwAgU",
    durationSeconds: 662, // 11:02
    slideCount: 16,
    isPublished: true,
    progress: { moduleId: 1, status: 'completed', currentSlide: 16, completedSlides: 16, quizScore: 90 }
  },
  {
    id: 2,
    moduleNumber: 2,
    title: "Finding Leads",
    description: "How to find and attract MCA leads - warm markets, online marketing, referral systems, and UCC lead strategies.",
    videoUrl: "https://www.youtube.com/embed/MhipHRWbC3s",
    durationSeconds: 281, // 4:41
    slideCount: 9,
    isPublished: true,
    progress: { moduleId: 2, status: 'in_progress', currentSlide: 5, completedSlides: 4, quizScore: null }
  },
  {
    id: 3,
    moduleNumber: 3,
    title: "Qualifying Deals",
    description: "How to qualify MCA deals - pre-screening questions, documentation requirements, and identifying deal-killers early.",
    videoUrl: "https://www.youtube.com/embed/nVYX551fOKE",
    durationSeconds: 376, // 6:16
    slideCount: 12,
    isPublished: true,
    progress: { moduleId: 3, status: 'not_started', currentSlide: 1, completedSlides: 0, quizScore: null }
  },
  {
    id: 4,
    moduleNumber: 4,
    title: "Submission Process",
    description: "Step-by-step guide to submitting MCA deals - portal walkthrough, document uploads, and getting quick approvals.",
    videoUrl: "https://www.youtube.com/embed/MpJD_2DJC5I",
    durationSeconds: 252, // 4:12
    slideCount: 8,
    isPublished: true,
  },
  {
    id: 5,
    moduleNumber: 5,
    title: "Managing Your Pipeline",
    description: "Track and manage your deals from submission to funding - pipeline stages, follow-up strategies, and maximizing close rates.",
    videoUrl: "https://www.youtube.com/embed/VOtLffd7gbs",
    durationSeconds: 217, // 3:37
    slideCount: 7,
    isPublished: true,
  },
  {
    id: 6,
    moduleNumber: 6,
    title: "Scaling Your Business",
    description: "Build a sustainable MCA business - recruiting partners, building systems, and creating passive income through team development.",
    videoUrl: "https://www.youtube.com/embed/zAIoJ0x5A70",
    durationSeconds: 242, // 4:02
    slideCount: 8,
    isPublished: true,
  },
];

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
  
  // TODO: Replace with actual API call
  const modules = PLACEHOLDER_MODULES;
  const completedCount = modules.filter(m => m.progress?.status === 'completed').length;
  const overallProgress = Math.round((completedCount / modules.length) * 100);

  const handleStartModule = (module: ModuleWithProgress) => {
    setSelectedModule(module);
  };

  if (selectedModule) {
    return (
      <div className="flex min-h-screen bg-gray-50/50">
        <Sidebar />
        
        <main className="flex-1 ml-64 p-8">
          <Button 
            variant="ghost" 
            className="mb-4"
            onClick={() => setSelectedModule(null)}
          >
            ← Back to Training
          </Button>
          
          <VideoPlayer 
            module={selectedModule} 
            onProgress={(slide) => console.log('Progress:', slide)} 
          />
          
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
      
      <main className="flex-1 ml-64 p-8">
        <header className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-display font-bold text-primary flex items-center gap-3">
                <GraduationCap className="w-8 h-8" />
                MCA Mastery Training
              </h1>
              <p className="text-muted-foreground mt-2">
                Complete all 6 modules to become a certified MCA agent.
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
                    Congratulations! 🎉
                  </h2>
                  <p className="text-yellow-700">
                    You've completed all training modules. You're now a Certified MCA Agent!
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
          <h3>🎯 The Cold Call Opening</h3>
          <div className="bg-gray-50 p-4 rounded-lg font-mono text-sm">
            "Hi [Name], this is [Your Name] with PSL Capital. I work with business owners like yourself to help them access working capital quickly — usually funded within 48 hours, no impact to your credit to check options.<br/><br/>
            Do you have 2 minutes to see if this could help your business?"
          </div>

          <h3>❓ Discovery Questions</h3>
          <ul>
            <li>"What would you use additional capital for?"</li>
            <li>"Have you looked into financing before? What happened?"</li>
            <li>"How quickly do you need access to funds?"</li>
            <li>"What's your ideal funding amount?"</li>
            <li>"Are you the decision maker, or is there a partner involved?"</li>
          </ul>

          <h3>💪 Objection Handlers</h3>
          
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

          <h3>🎯 Trial Close</h3>
          <div className="bg-green-50 p-4 rounded-lg font-mono text-sm">
            "If I can get you approved for $40K, funded by Friday, would you move forward?"
          </div>

          <h3>📋 Documents Checklist</h3>
          <ul>
            <li><strong>Bank Statements</strong> — Last 4 months (business account)</li>
            <li><strong>Driver's License</strong> — Front and back</li>
            <li><strong>Voided Check</strong> — For funding deposit</li>
            <li><strong>Application</strong> — Basic business info (signed)</li>
          </ul>
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
          <h3>📞 Before the Call</h3>
          <ul>
            <li><strong>Research first:</strong> 60 seconds of LinkedIn/Google can save 5 minutes of awkward questions</li>
            <li><strong>Clear your space:</strong> No distractions, water ready, CRM open</li>
            <li><strong>Smile before you dial:</strong> They can hear it in your voice</li>
            <li><strong>Have your one-pager ready:</strong> Key stats and talking points visible</li>
          </ul>

          <h3>🗣️ Voice & Tonality</h3>
          <ul>
            <li><strong>Stand up:</strong> Your voice projects better and you sound more confident</li>
            <li><strong>Match their pace:</strong> Fast talkers like fast talkers, slow = trustworthy to some</li>
            <li><strong>Lower your pitch slightly:</strong> Authority comes from depth, not volume</li>
            <li><strong>Pause after questions:</strong> Silence makes people fill the gap</li>
          </ul>

          <h3>🧠 Mindset</h3>
          <ul>
            <li><strong>You're not selling — you're solving:</strong> They have a problem, you have a solution</li>
            <li><strong>Rejection is data:</strong> "No" today might be "yes" in 90 days</li>
            <li><strong>Activity creates luck:</strong> More calls = more deals, no shortcuts</li>
            <li><strong>Be curious, not pushy:</strong> Ask questions, listen 70% of the time</li>
          </ul>

          <h3>📊 The Numbers Game</h3>
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

          <h3>⏰ Best Call Times</h3>
          <ul>
            <li><strong>Tuesday-Thursday:</strong> Decision makers are focused</li>
            <li><strong>8-10 AM local time:</strong> Before meetings start</li>
            <li><strong>4-6 PM local time:</strong> After the day's fires</li>
            <li><strong>Avoid:</strong> Monday AM (catching up), Friday PM (checked out)</li>
          </ul>

          <h3>🔄 The Follow-Up System</h3>
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
            <strong className="text-amber-800">💡 Pro Tip:</strong>
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
