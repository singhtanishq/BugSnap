import type { ReactNode } from "react";
import { RouterProvider, useRoute, Link } from "@/app/router";
import { ToastProvider } from "@/components/feedback/Toast";
import { ReportProvider } from "@/app/providers/ReportProvider";
import { AppShell } from "@/components/layout/AppShell";
import { OverviewPage } from "@/features/overview/OverviewPage";
import { ReportBuilderPage } from "@/features/report-builder/ReportBuilderPage";
import { StepsPage } from "@/features/reproduction-steps/StepsPage";
import { EvidencePage } from "@/features/evidence/EvidencePage";
import { EnvironmentPage } from "@/features/environment/EnvironmentPage";
import { DiagnosticsPage } from "@/features/diagnostics/DiagnosticsPage";
import { ReviewPage } from "@/features/review/ReviewPage";
import { PrivacyPage } from "@/features/privacy/PrivacyPage";
import { HelpPage } from "@/features/help/HelpPage";
import { ErrorBoundary } from "@/components/feedback/ErrorBoundary";
import { Button } from "@/components/ui/Button";

/**
 * Route table. Pages appear here (and in the sidebar) only once their
 * feature is implemented — every visible navigation item must work.
 */
const ROUTES: Array<{ path: string; element: ReactNode }> = [
  { path: "/", element: <OverviewPage /> },
  { path: "/report", element: <ReportBuilderPage /> },
  { path: "/steps", element: <StepsPage /> },
  { path: "/evidence", element: <EvidencePage /> },
  { path: "/environment", element: <EnvironmentPage /> },
  { path: "/diagnostics", element: <DiagnosticsPage /> },
  { path: "/review", element: <ReviewPage /> },
  { path: "/privacy", element: <PrivacyPage /> },
  { path: "/help", element: <HelpPage /> },
];

function AppRoutes() {
  const { path, navigate } = useRoute();
  const match = ROUTES.find((route) => route.path === path);

  if (!match) {
    return (
      <div className="py-16 text-center">
        <p className="text-sm font-semibold text-ink-800">Page not found</p>
        <p className="mt-1 text-xs text-ink-500">
          The path <code className="font-mono">{path}</code> does not exist.
        </p>
        <div className="mt-4">
          <Link to="/" onClick={() => navigate("/")}>
            <Button variant="primary">Back to overview</Button>
          </Link>
        </div>
      </div>
    );
  }

  return <ErrorBoundary label="this page">{match.element}</ErrorBoundary>;
}

export function App() {
  return (
    <RouterProvider>
      <ToastProvider>
        <ReportProvider>
          <AppShell availablePaths={ROUTES.map((route) => route.path)}>
            <AppRoutes />
          </AppShell>
        </ReportProvider>
      </ToastProvider>
    </RouterProvider>
  );
}
