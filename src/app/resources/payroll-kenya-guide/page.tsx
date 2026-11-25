import type { Metadata } from "next";
import GuideArticle from "@/components/resources/GuideArticle";
import { getGuide } from "@/lib/guides";
import { guideMetadata } from "@/lib/guideSeo";

const guide = getGuide("payroll-kenya-guide")!;

export const metadata: Metadata = guideMetadata(guide);

export default function Page() {
  return <GuideArticle guide={guide} />;
}
