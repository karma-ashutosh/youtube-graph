'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { WorkspaceSelector } from './WorkspaceSelector';
import CreatorOnboardingModal from './CreatorOnboardingModal';

export default function Navigation() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const appMode = process.env.NEXT_PUBLIC_APP_MODE || 'internal';

  const allNavLinks = [
    { href: '/', label: 'Home', modes: ['internal', 'external'] },
    { href: '/chat', label: 'Chat', modes: ['internal', 'external'] },
    { href: '/videos', label: 'Videos', modes: ['internal', 'external'] },
    { href: '/concepts', label: 'Concepts', modes: ['internal'] },
    { href: '/segments', label: 'Segments', modes: ['internal'] },
    { href: '/query', label: 'Query', modes: ['internal'] },
  ];

  // Filter nav links based on app mode
  const navLinks = allNavLinks.filter(link => link.modes.includes(appMode));

  return (
    <nav className="border-b border-border-subtle bg-surface-dark shadow-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-20">
          {/* Logo */}
          <div className="flex items-center space-x-3 md:space-x-6 min-w-0 flex-1">
            <Link href="/" className="flex items-center space-x-2 md:space-x-3 shrink-0">
              <Image
                src="/logo.png"
                alt="YouTube Knowledge Graph"
                width={48}
                height={48}
                className="hover:opacity-80 transition-opacity duration-300"
              />
              <span className="text-lg md:text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-text-light to-accent-cool">
                YouTube Graph
              </span>
            </Link>
            {/* Workspace Selector */}
            <div className="hidden md:block">
              <WorkspaceSelector />
            </div>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="inline-flex items-center px-4 py-2 text-sm font-medium text-text-light hover:text-accent-cool hover:glow-text-cool transition-all duration-200 rounded-lg hover:bg-accent-cool/5"
              >
                {link.label}
              </Link>
            ))}
            {/* CTA Button */}
            <button
              onClick={() => setIsFormOpen(true)}
              className="ml-4 inline-flex items-center px-6 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-accent-cool to-accent-warm hover:from-accent-cool/80 hover:to-accent-warm/80 rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105"
            >
              Onboard Your Favorite Creator
            </button>
          </div>

          {/* Mobile Menu Button */}
          <div className="md:hidden flex items-center shrink-0">
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="inline-flex items-center justify-center p-2 rounded-lg text-text-light hover:text-accent-cool hover:bg-accent-cool/5 transition-all duration-200"
              aria-expanded={isMenuOpen}
              aria-label="Toggle navigation menu"
            >
              {isMenuOpen ? (
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {isMenuOpen && (
        <div className="md:hidden border-t border-border-subtle">
          <div className="px-2 pt-2 pb-3 space-y-1">
            {/* Workspace Selector for Mobile */}
            <div className="px-3 py-2">
              <WorkspaceSelector />
            </div>
            <div className="border-t border-border-subtle my-2"></div>
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setIsMenuOpen(false)}
                className="block px-3 py-2 rounded-lg text-base font-medium text-text-light hover:text-accent-cool hover:bg-accent-cool/5 transition-all duration-200"
              >
                {link.label}
              </Link>
            ))}
            {/* Mobile CTA Button */}
            <div className="border-t border-border-subtle my-2"></div>
            <button
              onClick={() => {
                setIsMenuOpen(false);
                setIsFormOpen(true);
              }}
              className="w-full text-center px-3 py-2.5 text-base font-semibold text-white bg-gradient-to-r from-accent-cool to-accent-warm hover:from-accent-cool/80 hover:to-accent-warm/80 rounded-lg shadow-lg transition-all duration-200"
            >
              Onboard Your Favorite Creator
            </button>
          </div>
        </div>
      )}

      {/* Onboarding Modal */}
      <CreatorOnboardingModal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
      />
    </nav>
  );
}
