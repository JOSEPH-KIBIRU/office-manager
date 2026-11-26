import type { Metadata } from "next";
import GuideArticle from "@/components/resources/GuideArticle";
import { getGuide } from "@/lib/guides";
import { guideMetadata } from "@/lib/guideSeo";

const guide = getGuide("spreadsheets-vs-office-software")!;

export const metadata: Metadata = guideMetadata(guide);

export default function Page() {
  return <GuideArticle guide={guide} />;
}
