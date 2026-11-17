import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type AnchorHTMLAttributes,
  type ReactNode,
} from "react";

/**
 * Minimal hash-based router.
 * Hash routing is used deliberately: GitHub Pages serves the app from the
 * /BugSnap/ project subpath without rewrite rules, so deep links and page
 * refreshes keep working with no server-side fallback.
 */

export interface RouteState {
  path: string;
  navigate: (to: string) => void;
}

function readHashPath(): string {
  const hash = window.location.hash;
  if (!hash || hash === "#" || hash === "#/") return "/";
  const path = hash.startsWith("#") ? hash.slice(1) : hash;
  const normalized = path.startsWith("/") ? path : `/${path}`;
  // Strip trailing slash except for root
  return normalized.length > 1 && normalized.endsWith("/")
    ? normalized.slice(0, -1)
    : normalized;
}

const RouterContext = createContext<RouteState>({
  path: "/",
  navigate: () => {},
});

export function RouterProvider({ children }: { children: ReactNode }) {
  const [path, setPath] = useState<string>(() => readHashPath());

  useEffect(() => {
    const onHashChange = () => setPath(readHashPath());
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  const navigate = useCallback((to: string) => {
    const target = to.startsWith("/") ? to : `/${to}`;
    if (readHashPath() === target) return;
    window.location.hash = target;
  }, []);

  const value = useMemo<RouteState>(() => ({ path, navigate }), [path, navigate]);

  return <RouterContext.Provider value={value}>{children}</RouterContext.Provider>;
}

export function useRoute(): RouteState {
  return useContext(RouterContext);
}

export interface LinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  to: string;
  children: ReactNode;
}

export function Link({ to, children, onClick, ...rest }: LinkProps) {
  const { navigate } = useRoute();
  return (
    <a
      href={`#${to}`}
      onClick={(event) => {
        onClick?.(event);
        if (event.defaultPrevented) return;
        event.preventDefault();
        navigate(to);
      }}
      {...rest}
    >
      {children}
    </a>
  );
}
