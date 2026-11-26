import Link from "next/link";

const NAV = [
  { href: "/solutions", label: "Solutions" },
  { href: "/industries", label: "Industries" },
  { href: "/pricing", label: "Pricing" },
  { href: "/security", label: "Security" },
  { href: "/templates", label: "Templates" },
  { href: "/resources", label: "Guides" },
  { href: "/about", label: "About" },
];

export function MarketingHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
        <Link href="/" className="flex min-w-0 items-center gap-2">
          <span className="flex h-9 w-9 flex-none items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 text-sm font-bold text-white">
            OM
          </span>
          <span className="truncate font-semibold tracking-tight text-slate-900">Office Manager</span>
        </Link>
        <nav className="hidden items-center gap-0.5 lg:flex" aria-label="Marketing">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-lg px-2.5 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-blue-700"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="flex flex-none items-center gap-2">
          <details className="group relative lg:hidden">
            <summary className="flex min-h-10 cursor-pointer list-none items-center rounded-lg border border-slate-300 px-3 text-sm font-semibold text-slate-700 [&::-webkit-details-marker]:hidden">
              Menu
            </summary>
            <div className="absolute right-0 z-40 mt-2 w-56 rounded-xl border border-slate-200 bg-white p-2 shadow-xl">
              {NAV.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="block rounded-lg px-3 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100 hover:text-blue-700"
                >
                  {item.label}
                </Link>
              ))}
              <Link
                href="/login"
                className="mt-1 block rounded-lg border-t border-slate-100 px-3 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100 hover:text-blue-700"
              >
                Sign in
              </Link>
            </div>
          </details>
          <Link href="/login" className="hidden rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:text-blue-700 sm:block lg:block">
            Sign in
          </Link>
          <Link
            href="/#contact"
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-500"
          >
            Request a demo
          </Link>
        </div>
      </div>
    </header>
  );
}

export function MarketingFooter() {
  return (
    <footer className="border-t border-slate-200 bg-slate-50">
      <div className="mx-auto max-w-6xl px-4 py-10">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <Link href="/" className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-700 text-xs font-bold text-white">
                OM
              </span>
              <span className="font-semibold text-slate-900">Office Manager</span>
            </Link>
            <p className="mt-3 text-sm leading-relaxed text-slate-600">
              All-in-one office management software for Kenyan SMEs — payroll, accounting, eTIMS,
              operations and healthcare add-ons.
            </p>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Product</h3>
            <ul className="mt-3 space-y-2 text-sm text-slate-600">
              <li><Link href="/solutions" className="hover:text-blue-700">Solutions</Link></li>
              <li><Link href="/industries" className="hover:text-blue-700">Industries</Link></li>
              <li><Link href="/pricing" className="hover:text-blue-700">Pricing</Link></li>
              <li><Link href="/security" className="hover:text-blue-700">Security</Link></li>
              <li><Link href="/templates" className="hover:text-blue-700">Free templates</Link></li>
              <li><Link href="/resources" className="hover:text-blue-700">Guides</Link></li>
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Company</h3>
            <ul className="mt-3 space-y-2 text-sm text-slate-600">
              <li><Link href="/about" className="hover:text-blue-700">About us</Link></li>
              <li><Link href="/subprocessors" className="hover:text-blue-700">Subprocessors</Link></li>
              <li><Link href="/status" className="hover:text-blue-700">Service status</Link></li>
              <li><Link href="/#contact" className="hover:text-blue-700">Contact</Link></li>
              <li><Link href="/login" className="hover:text-blue-700">Sign in</Link></li>
              <li><a href="https://pigiecore.co.ke" target="_blank" rel="noopener noreferrer" className="hover:text-blue-700">PigieCore Solutions</a></li>
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Get in touch</h3>
            <ul className="mt-3 space-y-2 text-sm text-slate-600">
              <li><a href="tel:+254798118515" className="hover:text-blue-700">0798 118 515</a></li>
              <li><a href="tel:+254708769459" className="hover:text-blue-700">0708 769 459</a></li>
              <li><a href="mailto:support@pigiecore.co.ke" className="hover:text-blue-700">support@pigiecore.co.ke</a></li>
            </ul>
          </div>
        </div>
        <div className="mt-8 flex flex-col items-center justify-between gap-3 border-t border-slate-200 pt-6 text-xs text-slate-500 sm:flex-row">
          <p>© {new Date().getFullYear()} Office Manager · Made for Kenyan businesses</p>
          <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
            <Link href="/terms" className="hover:text-blue-700">Terms</Link>
            <Link href="/privacy" className="hover:text-blue-700">Privacy</Link>
            <Link href="/cookie-policy" className="hover:text-blue-700">Cookies</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
