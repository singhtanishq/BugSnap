export interface NavItem {
  path: string;
  label: string;
  icon: keyof typeof NAV_ICONS;
  description: string;
}

export const NAV_ICONS = {
  overview: "M3 5.5A2.5 2.5 0 015.5 3h13A2.5 2.5 0 0121 5.5v13a2.5 2.5 0 01-2.5 2.5h-13A2.5 2.5 0 013 18.5v-13zm4 2.5h10M7 12h10M7 16h6",
  report: "M5 4h14a1 1 0 011 1v14a1 1 0 01-1 1H5a1 1 0 01-1-1V5a1 1 0 011-1zm3 5h8M8 13h8M8 17h5",
  steps: "M4 6h6M4 12h6M4 18h6m4-13l3-2 3 2v4l-3 2-3-2V5zm0 11l3-2 3 2v4l-3 2-3-2v-4z",
  evidence: "M4 8.5A2.5 2.5 0 016.5 6H9l2-2.5h4L17 6h2.5A2.5 2.5 0 0122 8.5v9A2.5 2.5 0 0119.5 20h-13A2.5 2.5 0 014 17.5v-9zm6 4.5a3 3 0 106 0 3 3 0 00-6 0z",
  environment: "M12 3a9 9 0 100 18 9 9 0 000-18zm-9 9h18M12 3c2.5 2.3 4 5.4 4 9s-1.5 6.7-4 9c-2.5-2.3-4-5.4-4-9s1.5-6.7 4-9z",
  diagnostics: "M4 6a2 2 0 012-2h12a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm3 3l3 3-3 3m5 1h4",
  review: "M9 12l2 2 4-5m6 3a9 9 0 11-18 0 9 9 0 0118 0z",
  privacy: "M12 3l8 3v6c0 4.5-3.2 7.8-8 9-4.8-1.2-8-4.5-8-9V6l8-3zm-3 9l2 2 4-4",
  help: "M12 3a9 9 0 100 18 9 9 0 000-18zm-2.5 6.5A2.5 2.5 0 0114.5 11c0 1.5-2 1.8-2 3m0 3h.01",
} as const;

export const NAV_ITEMS: NavItem[] = [
  {
    path: "/",
    label: "Overview",
    icon: "overview",
    description: "Start a report, load the sample, review your workflow",
  },
  {
    path: "/report",
    label: "New Report",
    icon: "report",
    description: "Describe the issue and classify it",
  },
  {
    path: "/steps",
    label: "Steps",
    icon: "steps",
    description: "Reproduction steps in order",
  },
  {
    path: "/evidence",
    label: "Evidence",
    icon: "evidence",
    description: "Capture, upload and annotate screenshots",
  },
  {
    path: "/environment",
    label: "Environment",
    icon: "environment",
    description: "Browser and device context, opt-in fields",
  },
  {
    path: "/diagnostics",
    label: "Diagnostics",
    icon: "diagnostics",
    description: "Console output and HAR review with redaction",
  },
  {
    path: "/review",
    label: "Review & Export",
    icon: "review",
    description: "Preview the report and export files",
  },
  {
    path: "/privacy",
    label: "Privacy",
    icon: "privacy",
    description: "What stays local, storage controls",
  },
  {
    path: "/help",
    label: "Help",
    icon: "help",
    description: "Formats, limitations, troubleshooting",
  },
];

export function NavIcon({ name }: { name: keyof typeof NAV_ICONS }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={NAV_ICONS[name]} />
    </svg>
  );
}
