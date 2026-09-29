import type { Metadata } from "next";
import Link from "next/link";
import CookieSettingsButton from "@/components/CookieSettingsButton";

export const metadata: Metadata = {
  title: "Cookie Policy — Office Manager",
  description: "How Office Manager uses cookies and similar technologies, and how to manage your choices.",
};

export default function CookiePolicyPage() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-300">
      <div className="mx-auto max-w-3xl px-6 py-16">
        <Link href="/" className="mb-8 inline-flex items-center gap-1 text-sm text-slate-400 transition hover:text-white">
          <svg fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-4 w-4"><path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" /></svg>
          Back to home
        </Link>

        <h1 className="text-3xl font-bold text-white">Cookie Policy</h1>
        <p className="mt-2 text-sm text-slate-400">Last updated: 24 September 2026</p>

        <div className="prose prose-invert prose-sm mt-10 space-y-6 text-slate-300">
          <section>
            <h2 className="text-xl font-semibold text-white">1. What are cookies?</h2>
            <p>
              Cookies are small text files placed on your device when you visit a website. They help the site work,
              remember your choices and — where you agree — understand how the site is used. We also use similar
              technologies such as local storage for the same purposes.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white">2. How we use cookies</h2>
            <p>We group the cookies we use into the following categories:</p>
            <ul className="list-disc space-y-2 pl-5">
              <li>
                <strong className="text-white">Strictly necessary.</strong> Required to operate the Service and keep it
                secure. These include the signed, HTTP-only session cookie that keeps you logged in. They cannot be
                switched off.
              </li>
              <li>
                <strong className="text-white">Preferences.</strong> Remember choices you make (such as your cookie
                choice, dismissed notices and interface settings) so you do not have to set them again.
              </li>
              <li>
                <strong className="text-white">Analytics.</strong> Help us understand how the website is used so we can
                improve it. These are only set with your consent.
              </li>
              <li>
                <strong className="text-white">Marketing.</strong> Used to measure campaigns and, where applicable,
                show relevant offers. These are only set with your consent.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white">3. Cookies we set</h2>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-white/10 text-slate-400">
                    <th className="py-2 pr-4 font-semibold">Name</th>
                    <th className="py-2 pr-4 font-semibold">Category</th>
                    <th className="py-2 pr-4 font-semibold">Purpose</th>
                    <th className="py-2 font-semibold">Lifetime</th>
                  </tr>
                </thead>
                <tbody className="align-top">
                  <tr className="border-b border-white/5">
                    <td className="py-2 pr-4 font-mono text-slate-200">om_session</td>
                    <td className="py-2 pr-4">Necessary</td>
                    <td className="py-2 pr-4">Signed session cookie that keeps you signed in securely.</td>
                    <td className="py-2">7 days</td>
                  </tr>
                  <tr className="border-b border-white/5">
                    <td className="py-2 pr-4 font-mono text-slate-200">om_cookie_consent</td>
                    <td className="py-2 pr-4">Necessary / Preferences</td>
                    <td className="py-2 pr-4">Stores your cookie choices so we do not ask again.</td>
                    <td className="py-2">12 months</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="mt-3">
              In production the session cookie is named with the <code>__Host-</code> prefix and the <code>Secure</code>{" "}
              attribute, which restricts it to this site over HTTPS.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white">4. Third parties</h2>
            <p>
              We do not sell your personal information. Where we use a third-party service that sets its own cookies
              (for example, payment or messaging providers), those cookies are governed by that provider&apos;s own
              policy. Analytics and marketing cookies are only used if you consent to them.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white">5. Managing your choices</h2>
            <p>
              When you first visit the site you can <strong>Accept all</strong>, <strong>Reject all</strong> or customise
              which categories you allow. You can change your choice at any time using the{" "}
              <CookieSettingsButton className="font-medium text-sky-300 underline-offset-2 hover:underline">
                Cookie settings
              </CookieSettingsButton>{" "}
              link (also available in the site footer). You can also delete or block cookies in your browser settings;
              the strictly necessary cookies are required for the Service to work, so blocking them may prevent sign-in.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white">6. Contact</h2>
            <p>
              Questions about this policy or your choices? Email{" "}
              <a href="mailto:support@pigiecore.co.ke" className="font-medium text-sky-300 underline-offset-2 hover:underline">
                support@pigiecore.co.ke
              </a>
              .
            </p>
          </section>
        </div>

        <div className="mt-12 border-t border-white/10 pt-6 text-xs text-slate-500">
          <Link href="/privacy" className="transition hover:text-indigo-300">Privacy Policy</Link>
          <span className="mx-2">·</span>
          <Link href="/terms" className="transition hover:text-indigo-300">Terms &amp; Conditions</Link>
        </div>
      </div>
    </main>
  );
}
