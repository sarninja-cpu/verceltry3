// ============================================================================
// BadgeDisplay.tsx - Enhanced Version
// ============================================================================

import React, { JSX, useEffect, useRef, useState } from 'react';
import './BadgeDisplay.css';
import contributorsData from '../../docs/pages/config/contributors.json';

interface Badge {
  name: string;
  assigned: string;
}

interface Contributor {
  slug: string;
  name: string;
  avatar: string;
  github: string | null;
  twitter: string | null;
  role: string;
  steward: string;
  badges: Badge[];
}

function useIntersectionObserver(options = {}) {
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setIsVisible(true);
        observer.unobserve(entry.target);
      }
    }, options);

    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  return [ref, isVisible] as const;
}

function isNewlyEarned(assignedDate: string): boolean {
  if (!assignedDate) return false;
  try {
    const date = new Date(assignedDate);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays <= 30;
  } catch {
    return false;
  }
}

const BadgeIcon = ({ name, isNew }: { name: string; isNew: boolean }) => {
  const icons: Record<string, JSX.Element> = {
    'Framework-Steward': (
      <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="shield-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#3b82f6" />
            <stop offset="100%" stopColor="#1e40af" />
          </linearGradient>
        </defs>
        {/* Shield background */}
        <path d="M32 6L10 14V28C10 42 18 54 32 58C46 54 54 42 54 28V14L32 6Z" 
              fill="url(#shield-grad)" className="badge-main"/>
        {/* Checkmark/seal */}
        <path d="M22 30L28 36L42 22" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" className="badge-accent"/>
        {/* Framework letters */}
        <text x="32" y="48" fontSize="9" fill="white" fontWeight="bold" textAnchor="middle" fontFamily="monospace">FW</text>
        <circle cx="32" cy="32" r="24" stroke="white" strokeWidth="0.5" opacity="0.2" className="badge-ring"/>
      </svg>
    ),
    
    'Core-Contributor': (
      <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="star-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#fbbf24" />
            <stop offset="100%" stopColor="#f59e0b" />
          </linearGradient>
        </defs>
        {/* Star background */}
        <path d="M32 8L36 24L52 28L40 38L43 54L32 46L21 54L24 38L12 28L28 24L32 8Z" 
              fill="url(#star-grad)" className="badge-main"/>
        {/* Core symbol - circle with rays */}
        <circle cx="32" cy="32" r="8" fill="white" opacity="0.9"/>
        <text x="32" y="37" fontSize="10" fill="#f59e0b" fontWeight="bold" textAnchor="middle" fontFamily="sans-serif">C</text>
        {[0, 45, 90, 135, 180, 225, 270, 315].map((angle, i) => {
          const rad = (angle * Math.PI) / 180;
          const x1 = 32 + Math.cos(rad) * 10;
          const y1 = 32 + Math.sin(rad) * 10;
          const x2 = 32 + Math.cos(rad) * 14;
          const y2 = 32 + Math.sin(rad) * 14;
          return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="white" strokeWidth="2" opacity="0.8"/>;
        })}
      </svg>
    ),
    
    'Top-Reviewer': (
      <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="eye-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#8b5cf6" />
            <stop offset="100%" stopColor="#6d28d9" />
          </linearGradient>
        </defs>
        {/* Badge circle */}
        <circle cx="32" cy="32" r="26" fill="url(#eye-grad)" className="badge-main"/>
        {/* Magnifying glass */}
        <circle cx="28" cy="28" r="10" stroke="white" strokeWidth="3" fill="none"/>
        <line x1="35" y1="35" x2="44" y2="44" stroke="white" strokeWidth="3" strokeLinecap="round"/>
        {/* Checkmark inside */}
        <path d="M23 28L27 32L33 26" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        {/* Trophy icon at bottom */}
        <path d="M26 48L26 50L38 50L38 48" stroke="#fbbf24" strokeWidth="2"/>
        <text x="32" y="55" fontSize="7" fill="#fbbf24" fontWeight="bold" textAnchor="middle">TOP</text>
      </svg>
    ),
    
    'Contributor-5': (
      <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="bronze-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#fb923c" />
            <stop offset="100%" stopColor="#ea580c" />
          </linearGradient>
        </defs>
        {/* Medal circle */}
        <circle cx="32" cy="32" r="22" fill="url(#bronze-grad)" className="badge-main"/>
        <circle cx="32" cy="32" r="18" stroke="white" strokeWidth="2" opacity="0.3"/>
        {/* Number 5 */}
        <text x="32" y="42" fontSize="24" fill="white" fontWeight="bold" textAnchor="middle" fontFamily="sans-serif">5</text>
        {/* Ribbon */}
        <path d="M24 8L28 20L32 8L36 20L40 8L38 24L32 28L26 24L24 8Z" fill="url(#bronze-grad)" opacity="0.8"/>
        {/* Star accent */}
        <path d="M32 16L33 19L36 19L34 21L35 24L32 22L29 24L30 21L28 19L31 19L32 16Z" fill="white" opacity="0.9"/>
      </svg>
    ),
    
    'Contributor-10': (
      <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="gold-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#fbbf24" />
            <stop offset="100%" stopColor="#d97706" />
          </linearGradient>
        </defs>
        {/* Medal circle */}
        <circle cx="32" cy="34" r="20" fill="url(#gold-grad)" className="badge-main"/>
        <circle cx="32" cy="34" r="16" stroke="white" strokeWidth="2" opacity="0.4"/>
        {/* Number 10 */}
        <text x="32" y="44" fontSize="20" fill="white" fontWeight="bold" textAnchor="middle" fontFamily="sans-serif">10</text>
        {/* Ribbon top */}
        <path d="M20 10L26 24L32 10L38 24L44 10L40 28L32 32L24 28L20 10Z" fill="url(#gold-grad)" opacity="0.9"/>
        {/* Stars on ribbon */}
        <path d="M32 14L33 17L36 17L34 19L35 22L32 20L29 22L30 19L28 17L31 17L32 14Z" fill="white" opacity="0.9"/>
      </svg>
    ),
    
    'Contributor-25': (
      <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="diamond-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ec4899" />
            <stop offset="100%" stopColor="#be185d" />
          </linearGradient>
        </defs>
        {/* Medal circle */}
        <circle cx="32" cy="36" r="20" fill="url(#diamond-grad)" className="badge-main"/>
        <circle cx="32" cy="36" r="16" stroke="white" strokeWidth="2" opacity="0.4"/>
        {/* Number 25 */}
        <text x="32" y="44" fontSize="18" fill="white" fontWeight="bold" textAnchor="middle" fontFamily="sans-serif">25</text>
        {/* Triple ribbon */}
        <path d="M18 8L24 26L32 8L40 26L46 8L42 30L32 34L22 30L18 8Z" fill="url(#diamond-grad)" opacity="0.9"/>
        {/* Three stars */}
        <path d="M24 14L25 17L28 17L26 19L27 22L24 20L21 22L22 19L20 17L23 17L24 14Z" fill="white" opacity="0.95"/>
        <path d="M32 12L33 15L36 15L34 17L35 20L32 18L29 20L30 17L28 15L31 15L32 12Z" fill="white" opacity="0.95"/>
        <path d="M40 14L41 17L44 17L42 19L43 22L40 20L37 22L38 19L36 17L39 17L40 14Z" fill="white" opacity="0.95"/>
      </svg>
    ),
    
    'Reviewer-10': (
      <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="review-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#8b5cf6" />
            <stop offset="100%" stopColor="#7c3aed" />
          </linearGradient>
        </defs>
        {/* Badge hexagon */}
        <path d="M32 6L50 18L50 38L32 50L14 38L14 18L32 6Z" fill="url(#review-grad)" className="badge-main"/>
        {/* Document icon */}
        <rect x="22" y="20" width="20" height="24" rx="2" fill="white" opacity="0.9"/>
        <line x1="26" y1="26" x2="38" y2="26" stroke="#7c3aed" strokeWidth="1.5"/>
        <line x1="26" y1="30" x2="38" y2="30" stroke="#7c3aed" strokeWidth="1.5"/>
        <line x1="26" y1="34" x2="34" y2="34" stroke="#7c3aed" strokeWidth="1.5"/>
        {/* Number badge */}
        <circle cx="38" cy="24" r="6" fill="#fbbf24"/>
        <text x="38" y="28" fontSize="7" fill="white" fontWeight="bold" textAnchor="middle">10</text>
      </svg>
    ),
    
    'Reviewer-25': (
      <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="review-master-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#a855f7" />
            <stop offset="100%" stopColor="#9333ea" />
          </linearGradient>
        </defs>
        {/* Star badge */}
        <path d="M32 4L38 22L56 26L44 38L48 56L32 46L16 56L20 38L8 26L26 22L32 4Z" 
              fill="url(#review-master-grad)" className="badge-main"/>
        {/* Document with checkmarks */}
        <rect x="24" y="22" width="16" height="20" rx="1" fill="white" opacity="0.95"/>
        <path d="M27 28L29 30L33 26" stroke="#9333ea" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M27 34L29 36L33 32" stroke="#9333ea" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        {/* Number badge */}
        <circle cx="40" cy="26" r="7" fill="#fbbf24"/>
        <text x="40" y="30" fontSize="8" fill="white" fontWeight="bold" textAnchor="middle">25</text>
      </svg>
    ),
    
    'Issue-Opener-5': (
      <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="issue-5-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#06b6d4" />
            <stop offset="100%" stopColor="#0891b2" />
          </linearGradient>
        </defs>
        {/* Octagon badge */}
        <path d="M20 10L44 10L54 20L54 44L44 54L20 54L10 44L10 20L20 10Z" fill="url(#issue-5-grad)" className="badge-main"/>
        {/* Bug icon */}
        <circle cx="32" cy="28" r="8" stroke="white" strokeWidth="2" fill="none"/>
        <line x1="24" y1="22" x2="20" y2="18" stroke="white" strokeWidth="2" strokeLinecap="round"/>
        <line x1="40" y1="22" x2="44" y2="18" stroke="white" strokeWidth="2" strokeLinecap="round"/>
        <line x1="24" y1="34" x2="20" y2="38" stroke="white" strokeWidth="2" strokeLinecap="round"/>
        <line x1="40" y1="34" x2="44" y2="38" stroke="white" strokeWidth="2" strokeLinecap="round"/>
        {/* Eyes */}
        <circle cx="28" cy="27" r="2" fill="white"/>
        <circle cx="36" cy="27" r="2" fill="white"/>
        {/* Number */}
        <text x="32" y="50" fontSize="12" fill="white" fontWeight="bold" textAnchor="middle">5</text>
      </svg>
    ),
    
    'Issue-Opener-10': (
      <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="issue-10-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#0ea5e9" />
            <stop offset="100%" stopColor="#0284c7" />
          </linearGradient>
        </defs>
        {/* Circle badge */}
        <circle cx="32" cy="32" r="26" fill="url(#issue-10-grad)" className="badge-main"/>
        {/* Magnifying glass with exclamation */}
        <circle cx="28" cy="26" r="10" stroke="white" strokeWidth="3" fill="none"/>
        <line x1="35" y1="33" x2="42" y2="40" stroke="white" strokeWidth="3" strokeLinecap="round"/>
        {/* Exclamation in glass */}
        <line x1="28" y1="22" x2="28" y2="28" stroke="white" strokeWidth="2" strokeLinecap="round"/>
        <circle cx="28" cy="31" r="1" fill="white"/>
        {/* Number badge */}
        <circle cx="42" cy="24" r="8" fill="white"/>
        <text x="42" y="28" fontSize="9" fill="#0284c7" fontWeight="bold" textAnchor="middle">10</text>
      </svg>
    ),
    
    'Issue-Opener-25': (
      <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="issue-25-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#3b82f6" />
            <stop offset="100%" stopColor="#2563eb" />
          </linearGradient>
        </defs>
        {/* Star badge */}
        <path d="M32 4L38 22L56 26L44 38L48 56L32 46L16 56L20 38L8 26L26 22L32 4Z" 
              fill="url(#issue-25-grad)" className="badge-main"/>
        {/* Radar/target icon */}
        <circle cx="32" cy="32" r="12" stroke="white" strokeWidth="2" fill="none" opacity="0.9"/>
        <circle cx="32" cy="32" r="8" stroke="white" strokeWidth="2" fill="none" opacity="0.7"/>
        <circle cx="32" cy="32" r="4" stroke="white" strokeWidth="2" fill="none" opacity="0.5"/>
        {/* Crosshair */}
        <line x1="32" y1="20" x2="32" y2="24" stroke="white" strokeWidth="2"/>
        <line x1="32" y1="40" x2="32" y2="44" stroke="white" strokeWidth="2"/>
        <line x1="20" y1="32" x2="24" y2="32" stroke="white" strokeWidth="2"/>
        <line x1="40" y1="32" x2="44" y2="32" stroke="white" strokeWidth="2"/>
        {/* Number */}
        <circle cx="44" cy="20" r="8" fill="#fbbf24"/>
        <text x="44" y="24" fontSize="8" fill="white" fontWeight="bold" textAnchor="middle">25</text>
      </svg>
    ),
    
    'Early-Contributor': (
      <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="early-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#f59e0b" />
            <stop offset="100%" stopColor="#d97706" />
          </linearGradient>
        </defs>
        {/* Badge circle */}
        <circle cx="32" cy="32" r="26" fill="url(#early-grad)" className="badge-main"/>
        {/* Trophy */}
        <path d="M20 20L20 24C20 28 24 32 28 32L36 32C40 32 44 28 44 24L44 20" stroke="white" strokeWidth="3" strokeLinecap="round" fill="none"/>
        <rect x="26" y="32" width="12" height="8" fill="white" opacity="0.9"/>
        <path d="M22 40L42 40L40 46L24 46L22 40Z" fill="white" opacity="0.9"/>
        {/* #1 badge */}
        <circle cx="32" cy="18" r="8" fill="white"/>
        <text x="32" y="23" fontSize="10" fill="#d97706" fontWeight="bold" textAnchor="middle">#1</text>
        {/* Sparkles */}
        <path d="M14 14L15 16L17 17L15 18L14 20L13 18L11 17L13 16L14 14Z" fill="white" opacity="0.8"/>
        <path d="M50 14L51 16L53 17L51 18L50 20L49 18L47 17L49 16L50 14Z" fill="white" opacity="0.8"/>
      </svg>
    ),
    
    'Active-Last-30d': (
      <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="bolt-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#10b981" />
            <stop offset="100%" stopColor="#059669" />
          </linearGradient>
        </defs>
        {/* Circle badge */}
        <circle cx="32" cy="32" r="26" fill="url(#bolt-grad)" className="badge-main"/>
        {/* Fire/flame icon */}
        <path d="M32 12C32 12 24 20 24 28C24 34 27 38 32 38C37 38 40 34 40 28C40 20 32 12 32 12Z" 
              fill="white" opacity="0.9"/>
        <path d="M32 18C32 18 28 22 28 26C28 29 29.5 31 32 31C34.5 31 36 29 36 26C36 22 32 18 32 18Z" 
              fill="#10b981" opacity="0.8"/>
        {/* Calendar icon at bottom */}
        <rect x="20" y="42" width="24" height="16" rx="2" fill="white" opacity="0.9"/>
        <rect x="20" y="42" width="24" height="4" fill="#10b981"/>
        <text x="32" y="54" fontSize="10" fill="#059669" fontWeight="bold" textAnchor="middle">30d</text>
      </svg>
    ),
    
    'Active-Last-90d': (
      <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="wave-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#14b8a6" />
            <stop offset="100%" stopColor="#0d9488" />
          </linearGradient>
        </defs>
        {/* Rounded square badge */}
        <rect x="6" y="6" width="52" height="52" rx="12" fill="url(#wave-grad)" className="badge-main"/>
        {/* Bar chart showing activity */}
        <rect x="12" y="36" width="6" height="16" fill="white" opacity="0.9" rx="1"/>
        <rect x="21" y="30" width="6" height="22" fill="white" opacity="0.9" rx="1"/>
        <rect x="30" y="26" width="6" height="26" fill="white" opacity="0.9" rx="1"/>
        <rect x="39" y="32" width="6" height="20" fill="white" opacity="0.9" rx="1"/>
        <rect x="48" y="28" width="6" height="24" fill="white" opacity="0.9" rx="1"/>
        {/* Text */}
        <text x="32" y="20" fontSize="10" fill="white" fontWeight="bold" textAnchor="middle">90 DAYS</text>
      </svg>
    ),
    
    'New-Joiner': (
      <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="sparkle-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#fde047" />
            <stop offset="100%" stopColor="#facc15" />
          </linearGradient>
        </defs>
        {/* Star burst background */}
        <path d="M32 4L36 20L52 24L36 28L32 44L28 28L12 24L28 20L32 4Z" 
              fill="url(#sparkle-grad)" className="badge-main"/>
        {/* Welcome banner */}
        <rect x="16" y="26" width="32" height="12" rx="2" fill="white" opacity="0.95"/>
        <text x="32" y="35" fontSize="9" fill="#facc15" fontWeight="bold" textAnchor="middle">WELCOME!</text>
        {/* Hand wave */}
        <text x="32" y="18" fontSize="16">👋</text>
        {/* Small sparkles */}
        <path d="M48 12L49 14L51 15L49 16L48 18L47 16L45 15L47 14L48 12Z" fill="white" opacity="0.9"/>
        <path d="M16 12L17 14L19 15L17 16L16 18L15 16L13 15L15 14L16 12Z" fill="white" opacity="0.9"/>
        <path d="M48 44L49 46L51 47L49 48L48 50L47 48L45 47L47 46L48 44Z" fill="white" opacity="0.8"/>
      </svg>
    ),
    
    'Dormant-90d+': (
      <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="dormant-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#6b7280" />
            <stop offset="100%" stopColor="#4b5563" />
          </linearGradient>
        </defs>
        {/* Circle badge */}
        <circle cx="32" cy="32" r="26" fill="url(#dormant-grad)" className="badge-main"/>
        {/* Sleeping ZZZ */}
        <text x="28" y="28" fontSize="18" fill="white" opacity="0.9" fontFamily="serif" fontStyle="italic">Z</text>
        <text x="34" y="24" fontSize="14" fill="white" opacity="0.7" fontFamily="serif" fontStyle="italic">Z</text>
        <text x="38" y="20" fontSize="10" fill="white" opacity="0.5" fontFamily="serif" fontStyle="italic">Z</text>
        {/* Moon crescent */}
        <path d="M22 42A10 10 0 1 1 22 30A8 8 0 0 0 22 42Z" fill="white" opacity="0.8"/>
        {/* Stars */}
        <circle cx="44" cy="36" r="1.5" fill="white" opacity="0.6"/>
        <circle cx="40" cy="44" r="1" fill="white" opacity="0.6"/>
        <circle cx="48" cy="42" r="1.5" fill="white" opacity="0.6"/>
      </svg>
    ),
    
    'default': (
      <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="default-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#6366f1" />
            <stop offset="100%" stopColor="#4f46e5" />
          </linearGradient>
        </defs>
        <circle cx="32" cy="32" r="26" fill="url(#default-grad)" className="badge-main"/>
        <text x="32" y="38" fontSize="16" fill="white" textAnchor="middle">🏅</text>
        <text x="32" y="50" fontSize="8" fill="white" fontWeight="bold" textAnchor="middle">BADGE</text>
      </svg>
    )
  };

  return (
    <div className={`badge-icon-container ${isNew ? 'badge-new' : ''}`}>
      {icons[name] || icons['default']}
    </div>
  );
};

const BADGE_CONFIG: Record<string, {
  color: string;
  category: 'achievement' | 'activity';
  label: string;
  description: string;
  tier?: 'legendary' | 'epic' | 'rare' | 'common';
}> = {
  'Framework-Steward': {
    color: '#3b82f6',
    category: 'achievement',
    label: 'Framework Steward',
    description: 'Official maintainer responsible for framework quality',
    tier: 'legendary'
  },
  'Core-Contributor': {
    color: '#fbbf24',
    category: 'achievement',
    label: 'Core Team',
    description: 'Elite contributor with governance responsibilities',
    tier: 'legendary'
  },
  'Top-Reviewer': {
    color: '#8b5cf6',
    category: 'achievement',
    label: 'Master Reviewer',
    description: 'Exceptional code review and mentorship',
    tier: 'epic'
  },
  'Contributor-25': {
    color: '#ec4899',
    category: 'achievement',
    label: 'Diamond Contributor',
    description: '25+ merged contributions',
    tier: 'epic'
  },
  'Contributor-10': {
    color: '#f59e0b',
    category: 'achievement',
    label: 'Gold Contributor',
    description: '10+ merged contributions',
    tier: 'rare'
  },
  'Contributor-5': {
    color: '#fb923c',
    category: 'achievement',
    label: 'Bronze Contributor',
    description: '5+ merged contributions',
    tier: 'common'
  },
  'Reviewer-10': {
    color: '#8b5cf6',
    category: 'achievement',
    label: 'Skilled Reviewer',
    description: '10+ code reviews completed',
    tier: 'rare'
  },
  'Reviewer-25': {
    color: '#a855f7',
    category: 'achievement',
    label: 'Review Master',
    description: '25+ code reviews completed',
    tier: 'epic'
  },
  'Issue-Opener-5': {
    color: '#06b6d4',
    category: 'achievement',
    label: 'Issue Reporter',
    description: '5+ issues opened',
    tier: 'common'
  },
  'Issue-Opener-10': {
    color: '#0ea5e9',
    category: 'achievement',
    label: 'Active Reporter',
    description: '10+ issues opened',
    tier: 'rare'
  },
  'Issue-Opener-25': {
    color: '#3b82f6',
    category: 'achievement',
    label: 'Master Reporter',
    description: '25+ issues opened',
    tier: 'epic'
  },
  'Early-Contributor': {
    color: '#f59e0b',
    category: 'achievement',
    label: 'Early Contributor',
    description: 'Among the first contributors to the project',
    tier: 'rare'
  },
  'Active-Last-30d': {
    color: '#10b981',
    category: 'activity',
    label: 'Recently Active',
    description: 'Active in the last 30 days',
    tier: 'common'
  },
  'Active-Last-90d': {
    color: '#14b8a6',
    category: 'activity',
    label: 'Active Contributor',
    description: 'Active in the last 90 days',
    tier: 'common'
  },
  'New-Joiner': {
    color: '#fde047',
    category: 'activity',
    label: 'New Joiner',
    description: 'Welcome to the community!',
    tier: 'common'
  },
  'Dormant-90d+': {
    color: '#6b7280',
    category: 'activity',
    label: 'Dormant',
    description: 'Inactive for 90+ days',
    tier: 'common'
  }
};

function getBadgeConfig(badgeName: string) {
  return BADGE_CONFIG[badgeName] || {
    color: '#6366f1',
    category: 'achievement' as const,
    label: badgeName,
    description: 'Community recognition',
    tier: 'common' as const
  };
}

function formatDate(dateString: string): string {
  if (!dateString) return '';
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return dateString;
  }
}

interface BadgeDisplayProps {
  contributorSlug?: string;
  badges?: Badge[];
  compact?: boolean;
  showCount?: boolean;
  layout?: 'grid' | 'stack';
}

export function BadgeDisplay({ 
  contributorSlug, 
  badges, 
  compact = false, 
  showCount = false,
  layout = 'grid' 
}: BadgeDisplayProps) {
  const [containerRef, isVisible] = useIntersectionObserver({ threshold: 0.1 });
  const [hoveredBadge, setHoveredBadge] = useState<string | null>(null);

  let displayBadges: Badge[] = [];

  if (badges) {
    displayBadges = badges.filter(b => b.name && b.name.trim() !== '');
  } else if (contributorSlug) {
    const contributors = contributorsData as Record<string, Contributor>;
    const contributor = contributors[contributorSlug];
    if (contributor?.badges) {
      displayBadges = contributor.badges.filter(b => b.name && b.name.trim() !== '');
    }
  }

  if (displayBadges.length === 0) return null;

  // Sort badges by tier and category
  const sortedBadges = [...displayBadges].sort((a, b) => {
    const configA = getBadgeConfig(a.name);
    const configB = getBadgeConfig(b.name);
    
    const tierOrder = { legendary: 0, epic: 1, rare: 2, common: 3 };
    const tierA = tierOrder[configA.tier || 'common'];
    const tierB = tierOrder[configB.tier || 'common'];
    
    if (tierA !== tierB) return tierA - tierB;
    if (configA.category !== configB.category) {
      return configA.category === 'achievement' ? -1 : 1;
    }
    return 0;
  });

  return (
    <div 
      ref={containerRef} 
      className={`badge-display ${compact ? 'compact' : ''} ${layout} ${isVisible ? 'visible' : ''}`}
    >
      {showCount && !compact && (
        <div className="badge-summary">
          <span className="badge-count">{displayBadges.length}</span>
          <span className="badge-count-label">Achievement{displayBadges.length !== 1 ? 's' : ''}</span>
        </div>
      )}
      
      <div className={`badges-container ${layout}`}>
        {sortedBadges.map((badge, index) => {
          const config = getBadgeConfig(badge.name);
          const isNew = isNewlyEarned(badge.assigned);
          const badgeDate = formatDate(badge.assigned);

          return (
            <div
              key={`${badge.name}-${index}`}
              className={`badge-wrapper tier-${config.tier} ${isNew ? 'newly-earned' : ''} ${config.category}`}
              style={{
                '--delay': `${index * 0.08}s`,
                '--badge-color': config.color,
                '--tier-glow': `${config.color}33`
              } as React.CSSProperties}
              onMouseEnter={() => setHoveredBadge(badge.name)}
              onMouseLeave={() => setHoveredBadge(null)}
              title={`${config.label} - ${config.description}`}
            >
              <div className="badge-card">
                <BadgeIcon name={badge.name} isNew={isNew} />
                {isNew && (
                  <div className="new-indicator">
                    <span className="pulse-dot"></span>
                  </div>
                )}
                {!compact && (
                  <div className="badge-tier-indicator">
                    {config.tier === 'legendary' && '👑'}
                    {config.tier === 'epic' && '💎'}
                    {config.tier === 'rare' && '⭐'}
                  </div>
                )}
              </div>

              {hoveredBadge === badge.name && (
                <div className="badge-tooltip">
                  <div className="tooltip-header">
                    <strong>{config.label}</strong>
                    <span className={`tier-badge tier-${config.tier}`}>
                      {config.tier?.toUpperCase()}
                    </span>
                  </div>
                  <p className="tooltip-description">{config.description}</p>
                  {badgeDate && (
                    <div className="tooltip-footer">
                      <span className="tooltip-date">
                        {isNew && <span className="new-badge-text">✨ NEW</span>}
                        Earned {badgeDate}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default BadgeDisplay;