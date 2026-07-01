import React, { useState } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Wallet, Users, Briefcase, CheckSquare, Building2,
  BookOpen, FileText, Settings, ChevronLeft,
  ChevronRight, Bell, LogOut, BarChart3
} from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useAuth } from '@/lib/AuthContext';

const LOGO_SRC = 'https://media.base44.com/images/public/user_699e998295e6df9ade5456dd/ab50d79a4_CBV_Logo.png';

const LEADER_NAV = [
  { label: 'Dashboard', path: '/my-plan/dashboard', icon: LayoutDashboard },
  { label: 'Engagements', path: '/my-plan/engagements', icon: Briefcase },
  { label: 'Collections', path: '/my-plan/collections', icon: Wallet },
  { label: 'Team', path: '/my-plan/team', icon: Users },
  { label: 'Actions', path: '/my-plan/actions', icon: CheckSquare },
  { label: 'Meetings', path: '/my-plan/meetings', icon: Bell },
];

const FIRMWIDE_NAV = [
  { label: 'Consolidated', path: '/firmwide/consolidated', icon: BarChart3 },
  { label: 'All Clients', path: '/firmwide/clients', icon: Building2 },
  { label: 'Origination', path: '/firmwide/origination', icon: BookOpen, disabled: true },
  { label: 'Board Pack', path: '/firmwide/board-pack', icon: FileText, disabled: true },
];

const ADMIN_NAV = [
  { label: 'Admin', path: '/admin', icon: Settings },
];

function isActivePath(location, item) {
  return location.pathname === item.path ||
    (item.path !== '/my-plan/dashboard' && location.pathname.startsWith(item.path));
}

function NavItem({ item, collapsed, active }) {
  const iconClass = `nav-icon shrink-0 transition-all ${collapsed ? 'h-5 w-5' : 'h-4 w-4'}`;

  if (item.disabled) {
    return (
      <div
        title={collapsed ? item.label : undefined}
        className="flex cursor-not-allowed items-center gap-3 rounded-xl border border-transparent px-3 py-2.5 text-sm font-medium text-[rgb(var(--muted-rgb)/0.45)]"
      >
        <item.icon className={iconClass} />
        {!collapsed && (
          <span className="flex min-w-0 items-center gap-1.5 truncate">
            {item.label}
            <span className="rounded-full border border-[rgb(var(--navy-rgb)/0.08)] bg-white/70 px-1.5 py-0.5 text-[8px] uppercase tracking-[0.12em] text-[rgb(var(--muted-rgb)/0.58)]">
              Soon
            </span>
          </span>
        )}
      </div>
    );
  }

  return (
    <Link
      to={item.path}
      title={collapsed ? item.label : undefined}
      className={`group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-all duration-150 ${
        active ? 'nav-link-active' : 'nav-link-idle'
      }`}
    >
      <item.icon className={iconClass} />
      {!collapsed && <span className="truncate">{item.label}</span>}
    </Link>
  );
}

function SidebarSection({ title, items, collapsed, location }) {
  return (
    <div className="mb-3">
      {!collapsed && title && (
        <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[rgb(var(--muted-rgb)/0.7)]">
          {title}
        </p>
      )}
      {collapsed && title && <div className="mx-3 my-2 border-t border-[rgb(var(--navy-rgb)/0.1)]" />}
      <div className="space-y-1">
        {items.map((item) => (
          <NavItem
            key={item.path}
            item={item}
            collapsed={collapsed}
            active={isActivePath(location, item)}
          />
        ))}
      </div>
    </div>
  );
}

function MobileNav({ sections, location }) {
  const items = sections.flatMap((section) => section.items.filter((item) => !item.disabled));

  return (
    <div className="md:hidden">
      <div className="flex gap-2 overflow-x-auto px-4 py-2">
        {items.map((item) => {
          const active = isActivePath(location, item);
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex shrink-0 items-center gap-2 rounded-full px-3 py-2 text-xs font-semibold ${
                active ? 'nav-link-active' : 'nav-link-idle bg-white/75'
              }`}
            >
              <item.icon className="nav-icon h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

export default function AppLayout({ user }) {
  const location = useLocation();
  const { logout } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const role = user?.role || 'user';
  const displayName = user?.full_name || 'User';
  const initials = displayName.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2) || '?';

  const sections = [{ title: 'My Plan', items: LEADER_NAV }];
  if (role === 'management' || role === 'admin') {
    sections.push({ title: 'Firm View', items: FIRMWIDE_NAV });
  }
  if (role === 'admin') {
    sections.push({ title: '', items: ADMIN_NAV });
  }

  return (
    <div className="executive-shell min-h-screen text-slate-900">
      <div className="exec-blob-mid" />

      <div
        className="sticky top-0 z-[60] h-[2px] w-full"
        style={{
          background:
            'linear-gradient(90deg, rgba(31,7,152,0.88) 0%, rgba(141,87,222,0.42) 52%, transparent 100%)',
        }}
      />

      <header
        className="sticky top-[2px] z-50 backdrop-blur-xl"
        style={{
          background: 'rgba(255,255,255,0.94)',
          borderBottom: '1px solid rgb(var(--navy-rgb)/0.09)',
          boxShadow: '0 1px 2px rgb(var(--navy-rgb)/0.04), 0 4px 20px rgb(var(--navy-rgb)/0.04)',
        }}
      >
        <div className="page-width px-4 sm:px-6 lg:px-8">
          <div className="flex h-14 items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <img src={LOGO_SRC} alt="CBV & Associates" className="h-7 w-auto shrink-0 object-contain sm:h-8" />
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <button type="button" className="brand-button-ghost h-9 w-9 p-0" aria-label="Notifications">
                <Bell className="h-4 w-4" />
              </button>
              <div className="executive-pill flex items-center gap-2 rounded-full py-1 pl-1 pr-3">
                <Avatar className="h-7 w-7">
                  <AvatarFallback className="text-xs font-semibold text-white" style={{ background: 'linear-gradient(135deg,#8d57de,#5d27ca)' }}>
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="hidden sm:block">
                  <p className="max-w-36 truncate text-xs font-semibold leading-tight text-[var(--text)]">{displayName}</p>
                  <p className="text-[10px] capitalize leading-tight text-[var(--muted)]">{role === 'admin' ? 'Business Leader' : role}</p>
                </div>
              </div>
            </div>
          </div>
          <MobileNav sections={sections} location={location} />
        </div>
      </header>

      <div className="page-width relative z-10 flex px-4 py-6 sm:px-6 lg:px-8">
        <aside
          className={`executive-glass sticky top-[82px] hidden h-[calc(100vh-104px)] shrink-0 flex-col overflow-y-auto p-3 transition-all duration-200 md:flex ${
            collapsed ? 'w-[72px]' : 'w-[236px]'
          }`}
        >
          <nav className="flex-1 space-y-4">
            {sections.map((section, i) => (
              <SidebarSection
                key={i}
                title={section.title}
                items={section.items}
                collapsed={collapsed}
                location={location}
              />
            ))}
          </nav>

          <div className={`mt-4 border-t border-[rgb(var(--navy-rgb)/0.09)] pt-3 ${collapsed ? 'text-center' : ''}`}>
            <button
              type="button"
              onClick={logout}
              title={collapsed ? 'Sign out' : undefined}
              className="brand-button-ghost w-full px-3 py-2 text-xs"
            >
              <LogOut className="h-4 w-4" />
              {!collapsed && 'Sign out'}
            </button>
          </div>

          <button
            type="button"
            onClick={() => setCollapsed((v) => !v)}
            className="mt-2 flex items-center justify-center rounded-xl border border-[rgb(var(--navy-rgb)/0.1)] bg-white/70 py-2 text-[var(--muted)] transition-colors hover:text-[var(--violet)]"
            aria-label={collapsed ? 'Expand navigation' : 'Collapse navigation'}
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
        </aside>

        <main className="min-w-0 flex-1 pb-24 md:pl-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
