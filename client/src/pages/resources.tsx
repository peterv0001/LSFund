import { Sidebar } from "@/components/Sidebar";
import { useQuery } from "@tanstack/react-query";
import { api } from "@shared/routes";
import { 
  BookOpen, 
  Video,
  FileText,
  ExternalLink,
  Download,
  Loader2,
  FolderOpen
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type Resource = {
  id: number;
  title: string;
  description: string | null;
  type: 'video' | 'pdf' | 'link' | 'document';
  url: string;
  thumbnailUrl: string | null;
  category: string;
};

export default function ResourcesPage() {
  const { data: resources, isLoading } = useQuery({
    queryKey: ['resources'],
    queryFn: async () => {
      const res = await fetch(api.resources.list.path, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch');
      return res.json() as Promise<Resource[]>;
    },
  });

  const categories = [
    { id: 'all', label: 'All Resources' },
    { id: 'training', label: 'Training' },
    { id: 'marketing', label: 'Marketing' },
    { id: 'compliance', label: 'Compliance' },
    { id: 'general', label: 'General' },
  ];

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'video': return <Video className="w-5 h-5 text-red-500" />;
      case 'pdf': return <FileText className="w-5 h-5 text-red-600" />;
      case 'link': return <ExternalLink className="w-5 h-5 text-blue-500" />;
      default: return <FileText className="w-5 h-5 text-gray-500" />;
    }
  };

  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'video': return <Badge className="bg-red-100 text-red-700">Video</Badge>;
      case 'pdf': return <Badge className="bg-orange-100 text-orange-700">PDF</Badge>;
      case 'link': return <Badge className="bg-blue-100 text-blue-700">Link</Badge>;
      default: return <Badge className="bg-gray-100 text-gray-700">Document</Badge>;
    }
  };

  const filterResources = (category: string) => {
    if (!resources) return [];
    if (category === 'all') return resources;
    return resources.filter(r => r.category === category);
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen bg-gray-50/50">
        <Sidebar />
        <main className="flex-1 ml-64 p-8 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-gray-50/50">
      <Sidebar />
      
      <main className="flex-1 ml-64 p-8">
        <header className="mb-8">
          <h1 className="text-3xl font-display font-bold text-primary">Resources</h1>
          <p className="text-muted-foreground mt-2">
            Training materials, marketing assets, and more.
          </p>
        </header>

        <Tabs defaultValue="all" className="space-y-6">
          <TabsList className="bg-white border">
            {categories.map(cat => (
              <TabsTrigger key={cat.id} value={cat.id}>
                {cat.label}
              </TabsTrigger>
            ))}
          </TabsList>

          {categories.map(cat => (
            <TabsContent key={cat.id} value={cat.id}>
              {filterResources(cat.id).length > 0 ? (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filterResources(cat.id).map((resource) => (
                    <Card key={resource.id} className="overflow-hidden hover:shadow-md transition-shadow">
                      {resource.thumbnailUrl && (
                        <div className="aspect-video bg-gray-100 overflow-hidden">
                          <img 
                            src={resource.thumbnailUrl} 
                            alt={resource.title}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      )}
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between gap-2">
                          <CardTitle className="text-lg leading-tight">{resource.title}</CardTitle>
                          {getTypeBadge(resource.type)}
                        </div>
                        {resource.description && (
                          <CardDescription className="line-clamp-2">
                            {resource.description}
                          </CardDescription>
                        )}
                      </CardHeader>
                      <CardContent>
                        <a href={resource.url} target="_blank" rel="noopener noreferrer">
                          <Button className="w-full gap-2">
                            {resource.type === 'pdf' ? (
                              <>
                                <Download className="w-4 h-4" />
                                Download PDF
                              </>
                            ) : resource.type === 'video' ? (
                              <>
                                <Video className="w-4 h-4" />
                                Watch Video
                              </>
                            ) : (
                              <>
                                <ExternalLink className="w-4 h-4" />
                                Open Resource
                              </>
                            )}
                          </Button>
                        </a>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <Card>
                  <CardContent className="py-12 text-center">
                    <FolderOpen className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                    <p className="text-muted-foreground">
                      {cat.id === 'all' 
                        ? 'No resources available yet. Check back soon!'
                        : `No ${cat.label.toLowerCase()} resources available.`
                      }
                    </p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          ))}
        </Tabs>
      </main>
    </div>
  );
}
