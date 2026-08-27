/**
 * Router-compat shim — bridges react-router-dom v6 call sites to
 * @tanstack/react-router without hand-rewriting every component.
 * This is the same load-bearing pattern used in Klar's dev-copy migration.
 */
import {
  useNavigate as tsNavigate,
  useLocation as tsLocation,
  useParams as tsParams,
  useSearch as tsSearch,
  useRouter,
  Link as TSLink,
  Navigate as TSNavigate,
  Outlet as TSOutlet,
} from "@tanstack/react-router";
import { useMemo, useCallback, forwardRef, type ComponentProps, type ReactNode, type CSSProperties } from "react";

// ---------- shared URL parsing ----------

function parseTo(to: string): { pathname: string; search?: Record<string, string>; hash?: string } {
  const [beforeHash, hashStr] = (to ?? "").split("#");
  const [pathname, searchStr] = (beforeHash ?? "").split("?");
  return {
    // react-router keeps the current path for search-only ("?a=1") and
    // hash-only ("#section") targets; TanStack's "." means current route.
    pathname: pathname || ".",
    search: searchStr ? Object.fromEntries(new URLSearchParams(searchStr)) : undefined,
    hash: hashStr || undefined,
  };
}

// ---------- useNavigate ----------

type NavigateOptions = { replace?: boolean; state?: unknown };

/** react-router's partial-path object form: navigate({ pathname, search }) */
export type To = string | { pathname?: string; search?: string; hash?: string };

type NavigateFn = {
  (to: To | number, options?: NavigateOptions): void;
  (delta: number): void;
};

function toString(to: To): string {
  if (typeof to === "string") return to;
  const search = to.search ? (to.search.startsWith("?") ? to.search : `?${to.search}`) : "";
  const hash = to.hash ? (to.hash.startsWith("#") ? to.hash : `#${to.hash}`) : "";
  return `${to.pathname ?? "."}${search}${hash}`;
}

function isExternalUrl(url: string): boolean {
  return /^(https?:|\/\/|mailto:|tel:)/i.test(url);
}

export function useNavigate(): NavigateFn {
  const tsNav = tsNavigate({ strict: false } as never);
  let router: any = null;
  try {
    router = useRouter();
  } catch {}
  return useCallback((to: To | number, options?: NavigateOptions) => {
    if (typeof to === "number") {
      if (router?.history) {
        router.history.go(to);
      } else if (typeof window !== "undefined") {
        window.history.go(to);
      }
      return;
    }
    const target = toString(to);
    if (isExternalUrl(target)) {
      if (typeof window !== "undefined") {
        if (options?.replace) {
          window.location.replace(target);
        } else {
          window.location.href = target;
        }
      }
      return;
    }
    const { pathname, search, hash } = parseTo(target);
    tsNav({
      to: pathname,
      search: search as never,
      hash,
      state: options?.state as never,
      replace: options?.replace,
    });
  }, [tsNav, router]) as NavigateFn;
}

// ---------- useLocation ----------

export function useLocation() {
  const loc = tsLocation({ strict: false } as never);
  return useMemo(
    () => ({
      pathname: loc.pathname,
      search: loc.searchStr ? `?${loc.searchStr}` : "",
      hash: loc.hash ?? "",
      // react-router types state loosely; call sites read arbitrary keys
      // (e.g. location.state?.from), so keep it `any` here.
      state: (loc.state ?? null) as any,
      key: loc.pathname + (loc.searchStr ?? ""),
    }),
    [loc.pathname, loc.searchStr, loc.hash, loc.state],
  );
}

// ---------- useParams ----------

export function useParams<T extends Record<string, string | undefined> = Record<string, string | undefined>>(): T {
  return tsParams({ strict: false } as never) as T;
}


// ---------- useSearchParams (react-router-dom compat) ----------

export function useSearchParams(): [URLSearchParams, (init: URLSearchParams | Record<string, string> | ((prev: URLSearchParams) => URLSearchParams), opts?: { replace?: boolean }) => void] {
  const loc = tsLocation({ strict: false } as never);
  const nav = tsNavigate({ strict: false } as never);
  let router: any = null;
  try {
    router = useRouter();
  } catch {}
  const params = useMemo(() => new URLSearchParams(loc.searchStr ?? ""), [loc.searchStr]);
  const setParams = useCallback(
    (
      init: URLSearchParams | Record<string, string> | ((prev: URLSearchParams) => URLSearchParams),
      opts?: { replace?: boolean },
    ) => {
      // Functional updaters read the router's live location, not the render
      // snapshot — react-router passes call-time params, and chained updates
      // within one tick must see each other's writes.
      const live = router?.state?.location ?? loc;
      const current = new URLSearchParams(live.searchStr ?? "");
      const next =
        typeof init === "function"
          ? init(current)
          : init instanceof URLSearchParams
            ? init
            : new URLSearchParams(init);
      const searchObj: Record<string, string> = {};
      next.forEach((v, k) => { searchObj[k] = v; });
      nav({ to: live.pathname, search: searchObj as never, replace: opts?.replace });
    },
    [nav, router, loc],
  );
  return [params, setParams];
}

// ---------- Link ----------

type LinkProps = Omit<ComponentProps<typeof TSLink>, "to"> & {
  to: string;
  replace?: boolean;
  state?: unknown;
  children?: ReactNode;
};

export const Link = forwardRef<HTMLAnchorElement, LinkProps>(function Link(
  { to, replace, state, children, ...rest },
  ref,
) {
  if (isExternalUrl(to)) {
    return (
      <a ref={ref} href={to} {...(rest as Record<string, unknown>)}>
        {children}
      </a>
    );
  }
  const { pathname, search, hash } = parseTo(to);
  return (
    <TSLink
      ref={ref as never}
      to={pathname as never}
      search={search as never}
      hash={hash}
      replace={replace}
      state={state as never}
      {...((rest ?? {}) as Record<string, unknown>)}
    >
      {children}
    </TSLink>
  );
});


// ---------- Navigate ----------

export function Navigate({ to, replace, state }: { to: string; replace?: boolean; state?: unknown }) {
  if (isExternalUrl(to)) {
    if (typeof window !== "undefined") {
      if (replace) {
        window.location.replace(to);
      } else {
        window.location.href = to;
      }
    }
    return null;
  }
  const { pathname, search, hash } = parseTo(to);
  return <TSNavigate to={pathname as never} search={search as never} hash={hash} state={state as never} replace={replace} />;
}

// ---------- Outlet ----------

export const Outlet = TSOutlet;

// ---------- NavLink ----------

type NavLinkRenderState = { isActive: boolean; isPending: boolean };

export type NavLinkProps = Omit<LinkProps, "className" | "style" | "children"> & {
  className?: string | ((state: NavLinkRenderState) => string | undefined);
  style?: CSSProperties | ((state: NavLinkRenderState) => CSSProperties | undefined);
  children?: ReactNode | ((state: NavLinkRenderState) => ReactNode);
  end?: boolean;
};

export const NavLink = forwardRef<HTMLAnchorElement, NavLinkProps>(function NavLink(
  { to, className, style, children, end, ...rest },
  ref,
) {
  const loc = tsLocation({ strict: false } as never);
  const { pathname } = parseTo(to);
  const isActive =
    pathname === "."
      ? false
      : end
        ? loc.pathname === pathname || loc.pathname === `${pathname}/`
        : loc.pathname === pathname || loc.pathname.startsWith(`${pathname}/`);
  const state: NavLinkRenderState = { isActive, isPending: false };
  return (
    <Link
      ref={ref}
      to={to}
      className={typeof className === "function" ? className(state) : className}
      style={typeof style === "function" ? style(state) : style}
      {...(rest as Record<string, unknown>)}
    >
      {typeof children === "function" ? children(state) : children}
    </Link>
  );
});
