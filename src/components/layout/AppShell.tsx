import { useEffect, useState, type ReactNode } from "react";
import { Link, useRoute } from "@/app/router";
import { NAV_ITEMS, NavIcon } from "./navItems";
import { Wordmark } from "./Wordmark";
import { computeCompleteness } from "@/lib/report/completeness";
import { useReportState } from "@/app/providers/ReportProvider";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/Badge";

/**
 * Responsive application shell: persistent sidebar on desktop, collapsible
 * top-bar navigation on mobile. The report progress indicator reflects real
 * completeness state. Only navigation items whose pages exist are shown.
 */
export function AppShell({
  children,
  availablePaths,
}: {
  children: ReactNode;
  availablePaths: string[];
}) {
  const { path } = useRoute();
  const report = useReportState();
  const completeness = computeCompleteness(report);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const visibleNavItems = NAV_ITEMS.filter((item) => availablePaths.includes(item.path));

  // Close the mobile nav whenever the route changes.
  useEffect(() => {
    setMobileNavOpen(false);
  }, [path]);

  const current = visibleNavItems.find((item) => item.path === path);

  const navList = (
    <nav aria-label="Primary" className="flex flex-col gap-0.5">
      {visibleNavItems.map((item) => {
        const isActive = item.path === path;
        return (
          <Link
            key={item.path}
            to={item.path}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors",
              isActive
                ? "bg-accent-50 font-semibold text-accent-800 ring-1 ring-accent-200"
                : "text-ink-600 hover:bg-ink-100 hover:text-ink-900",
            )}
          >
            <span className={isActive ? "text-accent-700" : "text-ink-400"}>
              <NavIcon name={item.icon} />
            </span>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );

  const progressPanel = (
    <div className="rounded-xl border border-ink-200 bg-white p-3.5 shadow-panel">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-semibold text-ink-700">Report progress</span>
        <Badge tone={completeness.missingRequired.length === 0 ? "accent" : "neutral"}>
          {Math.round(completeness.fraction * 100)}%
        </Badge>
      </div>
      <div
        className="h-1.5 w-full overflow-hidden rounded-full bg-ink-100"
        role="progressbar"
        aria-valuenow={Math.round(completeness.fraction * 100)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Report completion"
      >
        <div
          className="h-full rounded-full bg-accent-600 transition-[width] duration-300"
          style={{ width: `${Math.round(completeness.fraction * 100)}%` }}
        />
      </div>
      <ul className="mt-2.5 space-y-1" aria-label="Report completion checklist">
        {completeness.checks.map((check) => (
          <li key={check.key} className="flex items-center gap-1.5 text-[11px]">
            <span
              aria-hidden="true"
              className={cn(
                "inline-flex h-3.5 w-3.5 items-center justify-center rounded-full border",
                check.done
                  ? "border-accent-600 bg-accent-600 text-white"
                  : "border-ink-300 bg-white",
              )}
            >
              {check.done ? (
                <svg width="8" height="8" viewBox="0 0 10 10" fill="none">
                  <path
                    d="M2 5.5L4 7.5L8 3"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                  />
                </svg>
              ) : null}
            </span>
            <span className={check.done ? "text-ink-600" : "text-ink-800 font-medium"}>
              {check.label}
            </span>
            {!check.done && REQUIRED_LABELS.has(check.key) ? (
              <span className="ml-auto text-red-600 font-medium" aria-label="required">
                required
              </span>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );

  return (
    <div className="flex min-h-full flex-col lg:flex-row">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col gap-5 border-r border-ink-200 bg-white px-4 py-5 lg:flex">
        <Link to="/" className="rounded-lg px-1 py-0.5 hover:opacity-80" aria-label="BugSnap overview">
          <Wordmark />
        </Link>
        {navList}
        <div className="mt-auto">{progressPanel}</div>
        <p className="text-center text-[10px] leading-relaxed text-ink-300">
          Local-first · No uploads
        </p>
      </aside>

      {/* Mobile header */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-ink-200 bg-white px-4 py-3 lg:hidden">
        <Link to="/" aria-label="BugSnap overview">
          <Wordmark />
        </Link>
        <button
          type="button"
          className="rounded-lg border border-ink-200 px-3 py-1.5 text-sm font-medium text-ink-700"
          aria-expanded={mobileNavOpen}
          aria-controls="mobile-nav"
          onClick={() => setMobileNavOpen((open) => !open)}
        >
          {current?.label ?? "Menu"}
        </button>
      </header>
      {mobileNavOpen ? (
        <div
          id="mobile-nav"
          className="sticky top-[57px] z-30 border-b border-ink-200 bg-white px-4 py-3 shadow-panel lg:hidden"
        >
          {navList}
          <div className="mt-3">{progressPanel}</div>
        </div>
      ) : null}

      <main className="min-w-0 flex-1 px-4 py-6 sm:px-8 sm:py-8" id="main-content">
        <div className="mx-auto w-full max-w-5xl">{children}</div>
      </main>
    </div>
  );
}

const REQUIRED_LABELS = new Set(["Title", "Reproduction steps", "Expected result", "Actual result"]);
