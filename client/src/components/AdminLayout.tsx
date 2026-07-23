import { AdminSidebar } from "@/components/AdminSidebar";
import { SchemaDriftBanner } from "@/components/SchemaDriftBanner";
import { cn } from "@/lib/utils";

export function AdminLayout({
  children,
  mainClassName,
}: {
  children: React.ReactNode;
  mainClassName?: string;
}) {
  return (
    <div className="flex min-h-screen bg-gray-50">
      <AdminSidebar />
      <main
        className={cn(
          "flex-1 lg:ml-64 p-4 pt-20 lg:pt-8 lg:p-8",
          mainClassName,
        )}
      >
        <SchemaDriftBanner />
        {children}
      </main>
    </div>
  );
}
