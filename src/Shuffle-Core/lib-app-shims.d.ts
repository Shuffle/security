/**
 * Type-only shims for app-level modules imported by Shuffle-Core library files.
 * These are resolved at runtime by the host app; this file satisfies tsc during
 * the library DTS build without pulling in the full app dependency graph.
 */

declare module '@/hooks/useEntityLabel' {
  export function useEntityPreference(...args: any[]): any;
}

declare module '@/hooks/useHostMonitorCount' {
  export function useHostMonitorCount(...args: any[]): any;
}

declare module '@/hooks/useIOCTypes' {
  export function seedDefaultIOCTypes(...args: any[]): any;
}

declare module '@/components/threat-intel/ThreatIntelReadinessBanner' {
  import * as React from 'react';
  export function ThreatIntelReadinessBanner(props: any): React.ReactElement | null;
}

declare module '@/components/common/ShuffleLogo' {
  import * as React from 'react';
  export function ShuffleCompanyLogo(props: any): React.ReactElement | null;
  export function ShuffleLogo(props: any): React.ReactElement | null;
  export function ShuffleSecurityLogo(props: any): React.ReactElement | null;
}

declare module '@/context/AuthContext' {
  export function useAuth(...args: any[]): any;
  export function useOptionalAuth(...args: any[]): any;
}

declare module '@/hooks/useUsers' {
  export function invalidateUsersCache(...args: any[]): any;
}
