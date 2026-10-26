import type { ReactNode } from "react";
import CrmSectionNav from "@/components/crm/CrmSectionNav";

/** Shell for the CRM workspace. Section tabs grow as areas ship. */
export default function CrmLayout({ children }: { children: ReactNode }) {
  return (
    <div className="space-y-4">
      <CrmSectionNav />
      {children}
    </div>
  );
}
