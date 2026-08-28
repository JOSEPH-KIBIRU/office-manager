import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import SuperAdminSidebar from "@/components/SuperAdminSidebar";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");
  // Only superadmins may use the platform console.
  if (session.role !== "super_admin") redirect("/dashboard");

  return (
    <div className="flex min-h-screen">
      <SuperAdminSidebar />
      <main className="flex-1 overflow-x-hidden bg-slate-50 px-6 pb-10 pt-20 lg:px-10 lg:pt-8">{children}</main>
    </div>
  );
}
