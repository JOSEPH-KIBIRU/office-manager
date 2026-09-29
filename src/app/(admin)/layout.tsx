import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import SuperAdminSidebar from "@/components/SuperAdminSidebar";
import UserMenu from "@/components/UserMenu";
import AnnouncementBanner from "@/components/AnnouncementBanner";
import BackButton from "@/components/BackButton";
import IdleSessionTimeout from "@/components/IdleSessionTimeout";
import { ToastProvider } from "@/components/toast";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");
  // Only superadmins may use the platform console.
  if (session.role !== "super_admin") redirect("/dashboard");

  return (
    <ToastProvider>
      <IdleSessionTimeout />
      <div className="flex min-h-screen">
        <SuperAdminSidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/85 backdrop-blur print:hidden">
            <AnnouncementBanner />
            <div className="ml-auto hidden items-center justify-end gap-3 px-8 py-2.5 lg:flex">
              <UserMenu name={session.name} role={session.role} />
            </div>
          </header>
          <main className="mx-auto w-full max-w-7xl flex-1 overflow-x-hidden bg-slate-50 px-4 pb-10 pt-6 sm:px-6 lg:px-8">
            <BackButton />
            {children}
          </main>
        </div>
      </div>
    </ToastProvider>
  );
}