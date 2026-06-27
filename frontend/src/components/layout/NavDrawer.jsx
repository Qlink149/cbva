import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { X, LogOut } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/lib/AuthContext';

function NavSection({ title, items, location, onClose }) {
  const isActive = (item) =>
    location.pathname === item.path ||
    (item.path !== '/' && location.pathname.startsWith(item.path));

  return (
    <div className="mb-1">
      <p className="px-4 py-2 text-[10px] uppercase tracking-[0.08em] font-semibold text-muted-foreground">
        {title}
      </p>
      <div className="space-y-0.5">
        {items.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            onClick={onClose}
            className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all mx-1 ${
              isActive(item)
                ? 'bg-cbva-navy text-white'
                : 'text-foreground hover:bg-muted'
            }`}
          >
            {item.label}
          </Link>
        ))}
      </div>
    </div>
  );
}

export default function NavDrawer({ open, onClose, sections = [] }) {
  const location = useLocation();
  const { logout } = useAuth();

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="fixed left-0 top-0 bottom-0 z-50 w-64 bg-white shadow-2xl flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-border/60">
              <img
                src="https://media.base44.com/images/public/user_699e998295e6df9ade5456dd/ab50d79a4_CBV_Logo.png"
                alt="CBVA"
                className="h-12 w-auto"
              />
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Nav sections */}
            <nav className="flex-1 overflow-y-auto py-4 px-2">
              {sections.map((section, idx) => (
                <div key={section.title}>
                  {idx > 0 && <div className="my-2 mx-3 border-t border-border/50" />}
                  <NavSection
                    title={section.title}
                    items={section.items}
                    location={location}
                    onClose={onClose}
                  />
                </div>
              ))}
            </nav>

            {/* Sign out */}
            <div className="px-3 py-4 border-t border-border/60">
              <button
                onClick={logout}
                className="flex items-center gap-3 w-full px-4 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
              >
                <LogOut className="w-4 h-4" />
                Sign out
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}