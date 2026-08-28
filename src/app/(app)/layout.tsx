import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import Sidebar from "@/components/Sidebar";
import NotificationBell from "@/components/NotificationBell";
import { SessionProvider } from "@/components/SessionProvider";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");
  // Superadmins use the platform console, not the company dashboard.
  if (session.role === "super_admin") redirect("/admin");

  return (
    <SessionProvider session={session}>
      <div className="flex min-h-screen">
        <Sidebar session={session} />
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 ml-auto hidden items-center gap-3 border-b border-slate-200 bg-white/85 px-8 py-2.5 backdrop-blur lg:flex">
            <NotificationBell />
          </header>
          <main className="flex-1 overflow-x-hidden px-6 pb-10 pt-20 lg:px-10 lg:pt-6">{children}</main>
        </div>
      </div>
    </SessionProvider>
  );
}
