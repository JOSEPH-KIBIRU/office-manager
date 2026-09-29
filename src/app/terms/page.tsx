import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms & Conditions — Office Manager",
  description: "Terms and Conditions for using Office Manager, the office management system.",
};

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-300">
      <div className="mx-auto max-w-3xl px-6 py-16">
        <Link href="/" className="mb-8 inline-flex items-center gap-1 text-sm text-slate-400 transition hover:text-white">
          <svg fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-4 w-4"><path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" /></svg>
          Back to home
        </Link>
        <h1 className="text-3xl font-bold text-white">Terms &amp; Conditions</h1>
        <p className="mt-2 text-sm text-slate-400">
          Last updated: 3 September 2026
        </p>

        <div className="prose prose-invert prose-sm mt-10 space-y-6 text-slate-300">
          <section>
            <h2 className="text-xl font-semibold text-white">1. Acceptance of Terms</h2>
            <p>
              By accessing or using Office Manager (the &ldquo;Service&rdquo;), you agree to be bound by these Terms
              &amp; Conditions. If you do not agree to all the terms, you may not access or use the Service, including
              by signing in through your organisation&rsquo;s administrator.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white">2. Use of the Service</h2>
            <p>The Service provides office management tools, including employee records, leave, attendance, billing,
              payroll, meetings and minutes, petty cash and vehicle logs. You agree to use the Service only for
              legitimate business purposes and in accordance with your organisation&rsquo;s policies.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white">3. Accounts and Security</h2>
            <p>
              Accounts are provisioned by your organisation&rsquo;s administrator. You are responsible for safeguarding
              your credentials and for all activity performed under your account. You must notify your administrator
              immediately of any unauthorised use. Sessions are automatically ended after a period of inactivity for
              your security.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white">4. Privacy</h2>
            <p>
              Your privacy matters to us. Our handling of personal data is described in our{" "}
              <Link href="/privacy" className="text-blue-400 underline decoration-blue-400/40 hover:text-blue-300">Privacy Policy</Link>.
              By using the Service you consent to the processing described there.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white">5. Acceptable Use</h2>
            <p>You agree not to misuse the Service, including attempting to access other accounts, using the Service
              for unlawful activity, interfering with its operation, or reverse engineering any part of it.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white">6. Limitation of Liability</h2>
            <p>
              To the maximum extent permitted by law, the Service is provided &ldquo;as is&rdquo; and &ldquo;as
              available&rdquo;. We are not liable for any indirect, incidental, or consequential damages arising from
              your use of, or inability to use, the Service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white">7. Termination</h2>
            <p>
              Your organisation may revoke your access at any time. Upon termination, your right to use the Service
              ends immediately and we may delete or return your data in line with your organisation&rsquo;s requests
              and our privacy practices.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white">8. Changes to These Terms</h2>
            <p>
              We may update these Terms from time to time. Continued use of the Service after changes take effect
              constitutes acceptance of the updated Terms.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white">9. Governing Law</h2>
            <p>These Terms are governed by the laws of the Republic of Kenya.</p>
          </section>
        </div>
      </div>
    </main>
  );
}