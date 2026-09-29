import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import Sidebar from "@/components/Sidebar";
import NotificationBell from "@/components/NotificationBell";
import AnnouncementBanner from "@/components/AnnouncementBanner";
import ImpersonationBanner from "@/components/ImpersonationBanner";
import UserMenu from "@/components/UserMenu";
import BackButton from "@/components/BackButton";
import IdleSessionTimeout from "@/components/IdleSessionTimeout";
import { SessionProvider } from "@/components/SessionProvider";
import { ToastProvider } from "@/components/toast";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");
  // Superadmins use the platform console, not the company dashboard —
  // unless they are impersonating a company admin.
  if (session.role === "super_admin" && !session.impersonating) redirect("/admin");

  return (
    <SessionProvider session={session}>
      <ToastProvider>
      <IdleSessionTimeout />
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-slate-900 focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white"
      >
        Skip to content
      </a>
      <div className="flex min-h-screen">
        <Sidebar session={session} />
        <div className="flex min-w-0 flex-1 flex-col">
          {session.impersonating && (
            <ImpersonationBanner companyName={session.impersonating.companyName} />
          )}
          <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/85 backdrop-blur print:hidden">
            <AnnouncementBanner />
            <div className="ml-auto hidden items-center justify-end gap-3 px-8 py-2.5 lg:flex">
              <NotificationBell />
              <UserMenu
                name={session.name}
                role={session.impersonating ? session.impersonating.originalRole : session.role}
              />
            </div>
          </header>
          <main id="main" className="mx-auto w-full max-w-7xl flex-1 overflow-x-hidden px-4 pb-10 pt-20 sm:px-6 lg:px-8 lg:pt-6">
            <BackButton />
            {children}
          </main>
        </div>
      </div>
      </ToastProvider>
    </SessionProvider>
  );
}
