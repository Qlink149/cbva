import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, Bell, ChevronDown } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAuth } from '@/lib/AuthContext';
import NavDrawer from './NavDrawer';

export default function TopNav({ user, navItems, sections }) {
  const location = useLocation();
  const { logout } = useAuth();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const displayName = user?.full_name || '';
  const initials = displayName.split(' ').map(n => n[0]).join('').toUpperCase() || '?';

  // Current page label for breadcrumb hint
  const currentNav = navItems.find(item =>
    location.pathname === item.path ||
    (item.path !== '/' && location.pathname.startsWith(item.path))
  );

  return (
    <>
      <NavDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} navItems={navItems} sections={sections} />

      <header className="sticky top-0 z-30 bg-white border-b border-border/60 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
        <div className="w-full max-w-[1440px] mx-auto px-4 sm:px-6 h-14 flex items-center gap-4">

          {/* Hamburger */}
          <button
            onClick={() => setDrawerOpen(true)}
            className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0"
            aria-label="Open menu"
          >
            <Menu className="w-5 h-5" />
          </button>

          {/* Logo — bigger */}
          <Link to="/" className="flex items-center shrink-0">
            <img
              src="https://media.base44.com/images/public/user_699e998295e6df9ade5456dd/ab50d79a4_CBV_Logo.png"
              alt="CBVA"
              className="h-12 w-auto"
            />
          </Link>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Right: Notifications + Avatar */}
          <div className="flex items-center gap-2 shrink-0">
            <button className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors relative">
              <Bell className="w-4 h-4" />
            </button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 pl-2 pr-1 py-1 rounded-lg hover:bg-muted transition-colors">
                  <Avatar className="w-7 h-7">
                    <AvatarFallback className="bg-cbva-navy text-white text-xs font-medium">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <ChevronDown className="w-3 h-3 text-muted-foreground" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <div className="px-2 py-1.5">
                  <p className="text-sm font-medium">{displayName}</p>
                  <p className="text-xs text-muted-foreground capitalize">{user?.role}</p>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={logout}>
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>
    </>
  );
}