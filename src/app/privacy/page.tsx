import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy — Office Manager",
  description: "Privacy Policy for Office Manager, the office management system.",
};

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-300">
      <div className="mx-auto max-w-3xl px-6 py-16">
        <Link href="/" className="mb-8 inline-flex items-center gap-1 text-sm text-slate-400 transition hover:text-white">
          <svg fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-4 w-4"><path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" /></svg>
          Back to home
        </Link>
        <h1 className="text-3xl font-bold text-white">Privacy Policy</h1>
        <p className="mt-2 text-sm text-slate-400">
          Last updated: 3 September 2026
        </p>

        <div className="prose prose-invert prose-sm mt-10 space-y-6 text-slate-300">
          <section>
            <h2 className="text-xl font-semibold text-white">1. Introduction</h2>
            <p>
              This Privacy Policy explains how Office Manager (&ldquo;we&rdquo;, &ldquo;us&rdquo;) collects, uses and
              protects personal information processed through the Service on behalf of your organisation.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white">2. Information We Collect</h2>
            <p>
              We collect information you or your administrator provide in operating the Service, including names,
              emails, phone numbers, payroll and leave data, meeting minutes, vehicle logs and account credentials.
              We also collect technical data such as IP addresses for security and rate limiting.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white">3. How We Use Information</h2>
            <p>
              The data we process is used to operate and secure the Service: authenticating users, generating payroll,
              managing leave and records, delivering communications, preventing abuse, and improving our Service. We
              do not sell your personal data.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white">4. Lawful Basis and Control</h2>
            <p>
              We process personal information under your organisation&rsquo;s instructions as a data processor. Your
              organisation is responsible for the lawful basis of processing under applicable law. Users should direct
              access, correction or deletion requests to their administrator in the first instance.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white">5. Data Sharing</h2>
            <p>
              We share data only with service providers necessary to operate the Service (such as hosting and secure
              delivery of communications), under confidentiality obligations, and where required by law.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white">6. Security</h2>
            <p>
              We use industry-standard safeguards, including encrypted connections and minimum-privilege access, to
              protect your information. Sessions are time-limited and automatically ended after inactivity.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white">7. Retention</h2>
            <p>
              We retain data only as long as your organisation requires the Service, subject to legal obligations.
              Upon request by your administrator, data may be deleted or returned.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white">8. Your Rights</h2>
            <p>
              Depending on applicable law, you may have rights to access, correct, restrict, or delete your personal
              information, and to object to certain processing. Please contact your administrator to exercise these
              rights.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white">9. Contact</h2>
            <p>For privacy questions, please contact your organisation&rsquo;s administrator.</p>
          </section>
        </div>
      </div>
    </main>
  );
}