import type { SVGProps } from 'react';

export type IconName = 'brand' | 'dashboard' | 'returns' | 'users' | 'routes' | 'menu' | 'refresh' | 'warehouse' | 'review' | 'closed' | 'today' | 'chevron';

export function Icon({ name, ...props }: { name: IconName } & SVGProps<SVGSVGElement>) {
  const common = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  const paths: Record<IconName, React.ReactNode> = {
    brand: <><path d="M4.5 10a7.8 7.8 0 0 1 13.2-4.2L20 8"/><path d="M20 3v5h-5"/><path d="M19.5 14a7.8 7.8 0 0 1-13.2 4.2L4 16"/><path d="M4 21v-5h5"/><path d="m9 12 2 2 4-5"/></>,
    dashboard: <><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></>,
    returns: <><path d="M4 7.5 12 3l8 4.5v9L12 21l-8-4.5z"/><path d="m4 7.5 8 4.5 8-4.5M12 12v9"/><path d="m8 5.2 8 4.5"/></>,
    users: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></>,
    routes: <><circle cx="6" cy="18" r="2.5"/><circle cx="18" cy="6" r="2.5"/><path d="M8.2 16.8c2.5-1 2-4.5 4.5-5.5s3.5-1.2 4.2-3"/><path d="M13 18h7"/></>,
    menu: <><path d="M4 6h16M4 12h16M4 18h16"/></>,
    refresh: <><path d="M20 11a8.1 8.1 0 0 0-14.8-4L3 10"/><path d="M3 4v6h6M4 13a8.1 8.1 0 0 0 14.8 4L21 14"/><path d="M21 20v-6h-6"/></>,
    warehouse: <><path d="M3 9 12 3l9 6v12H3z"/><path d="M7 21v-8h10v8M7 16h10"/></>,
    review: <><rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V2h6v2M9 9h6M9 13h6M9 17h4"/></>,
    closed: <><circle cx="12" cy="12" r="9"/><path d="m8 12 2.5 2.5L16 9"/></>,
    today: <><path d="M4 7.5 12 3l8 4.5v9L12 21l-8-4.5z"/><path d="m4 7.5 8 4.5 8-4.5M12 12v9"/><path d="M17 14v5M14.5 16.5h5"/></>,
    chevron: <path d="m8 10 4 4 4-4"/>,
  };
  return <svg viewBox="0 0 24 24" aria-hidden="true" {...common} {...props}>{paths[name]}</svg>;
}
