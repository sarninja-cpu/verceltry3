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
          <filter id="glow">
            <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>
        <path d="M32 8L12 16V30C12 42 19 52 32 56C45 52 52 42 52 30V16L32 8Z" 
              fill="url(#shield-grad)" filter="url(#glow)" className="badge-main"/>
        <path d="M32 20L28 28H24L32 36L40 28H36L32 20Z" fill="white" className="badge-accent" opacity="0.9"/>
        <circle cx="32" cy="32" r="20" stroke="white" strokeWidth="1" opacity="0.2" className="badge-ring"/>
      </svg>
    ),
    
    'Core-Contributor': (
      <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="star-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#fbbf24" />
            <stop offset="100%" stopColor="#f59e0b" />
          </linearGradient>
          <radialGradient id="star-radial">
            <stop offset="0%" stopColor="#fef3c7" stopOpacity="0.8"/>
            <stop offset="100%" stopColor="#fbbf24" stopOpacity="0"/>
          </radialGradient>
        </defs>
        <circle cx="32" cy="32" r="24" fill="url(#star-radial)" className="badge-glow"/>
        <path d="M32 12L36 26L50 28L40 38L43 52L32 44L21 52L24 38L14 28L28 26L32 12Z" 
              fill="url(#star-grad)" className="badge-main"/>
        <circle cx="32" cy="32" r="6" fill="white" className="badge-core" opacity="0.9"/>
        <circle cx="32" cy="32" r="20" stroke="#fbbf24" strokeWidth="0.5" opacity="0.3" className="badge-ring"/>
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
        <ellipse cx="32" cy="32" rx="26" ry="16" fill="url(#eye-grad)" opacity="0.2" className="badge-bg"/>
        <path d="M8 32C8 32 16 20 32 20C48 20 56 32 56 32C56 32 48 44 32 44C16 44 8 32 8 32Z" 
              stroke="url(#eye-grad)" strokeWidth="3" className="badge-main"/>
        <circle cx="32" cy="32" r="8" fill="url(#eye-grad)" className="badge-pupil"/>
        <circle cx="32" cy="32" r="4" fill="white" className="badge-highlight"/>
        <line x1="8" y1="32" x2="56" y2="32" stroke="#8b5cf6" strokeWidth="0.5" opacity="0.5" className="badge-scan"/>
      </svg>
    ),
    
    'Contributor-5': (
      <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="bronze-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#fb923c" />
            <stop offset="100%" stopColor="#ea580c" />
          </linearGradient>
          <radialGradient id="bronze-glow">
            <stop offset="0%" stopColor="#fed7aa" stopOpacity="0.6"/>
            <stop offset="100%" stopColor="#fb923c" stopOpacity="0"/>
          </radialGradient>
        </defs>
        <circle cx="32" cy="32" r="24" fill="url(#bronze-glow)" className="badge-glow"/>
        <circle cx="32" cy="32" r="20" fill="url(#bronze-grad)" className="badge-main"/>
        <circle cx="32" cy="32" r="14" stroke="white" strokeWidth="2" opacity="0.4" className="badge-inner"/>
        <path d="M32 18L34 24L40 26L34 28L32 34L30 28L24 26L30 24L32 18Z" fill="white" opacity="0.9" className="badge-accent"/>
        <circle cx="32" cy="32" r="18" stroke="#fb923c" strokeWidth="0.5" opacity="0.3" className="badge-ring"/>
      </svg>
    ),
    
    'Contributor-10': (
      <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="gold-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#fbbf24" />
            <stop offset="100%" stopColor="#d97706" />
          </linearGradient>
          <radialGradient id="gold-glow">
            <stop offset="0%" stopColor="#fef3c7" stopOpacity="0.8"/>
            <stop offset="100%" stopColor="#fbbf24" stopOpacity="0"/>
          </radialGradient>
        </defs>
        <circle cx="32" cy="32" r="24" fill="url(#gold-glow)" className="badge-glow"/>
        <circle cx="32" cy="32" r="22" fill="url(#gold-grad)" className="badge-main"/>
        <circle cx="32" cy="32" r="16" stroke="white" strokeWidth="2" opacity="0.4" className="badge-inner"/>
        <circle cx="32" cy="32" r="10" fill="white" opacity="0.8" className="badge-center"/>
        <path d="M32 18L36 28L44 32L36 36L32 46L28 36L20 32L28 28L32 18Z" fill="#d97706" opacity="0.6" className="badge-accent"/>
      </svg>
    ),
    
    'Contributor-25': (
      <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="diamond-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ec4899" />
            <stop offset="100%" stopColor="#be185d" />
          </linearGradient>
          <radialGradient id="diamond-glow">
            <stop offset="0%" stopColor="#fce7f3" stopOpacity="0.8"/>
            <stop offset="100%" stopColor="#ec4899" stopOpacity="0"/>
          </radialGradient>
        </defs>
        <circle cx="32" cy="32" r="26" fill="url(#diamond-glow)" className="badge-glow"/>
        <path d="M32 8L48 24L32 56L16 24L32 8Z" fill="url(#diamond-grad)" opacity="0.9" className="badge-main"/>
        <path d="M32 8L48 24L32 32L16 24L32 8Z" fill="white" opacity="0.3" className="badge-facet"/>
        <path d="M32 32L16 24L32 56L48 24L32 32Z" fill="black" opacity="0.2" className="badge-shadow"/>
        {[0, 1, 2, 3].map(i => (
          <circle key={i} cx="32" cy="32" r={12 + i * 4} stroke="#ec4899" strokeWidth="0.5" 
                  opacity={0.3 - i * 0.07} className="badge-ripple" 
                  style={{ animationDelay: `${i * 0.3}s` }}/>
        ))}
      </svg>
    ),
    
    'Reviewer-10': (
      <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="review-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#8b5cf6" />
            <stop offset="100%" stopColor="#7c3aed" />
          </linearGradient>
          <radialGradient id="review-glow">
            <stop offset="0%" stopColor="#ede9fe" stopOpacity="0.6"/>
            <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0"/>
          </radialGradient>
        </defs>
        <circle cx="32" cy="32" r="24" fill="url(#review-glow)" className="badge-glow"/>
        <circle cx="32" cy="32" r="20" fill="url(#review-grad)" className="badge-main"/>
        <path d="M24 28L28 32L24 36M40 28L36 32L40 36" stroke="white" strokeWidth="2.5" strokeLinecap="round" className="badge-accent"/>
        <path d="M28 42L32 38L36 42" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="badge-accent"/>
        <circle cx="32" cy="32" r="18" stroke="#a78bfa" strokeWidth="0.5" opacity="0.4" className="badge-ring"/>
      </svg>
    ),
    
    'Reviewer-25': (
      <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="review-master-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#a855f7" />
            <stop offset="100%" stopColor="#9333ea" />
          </linearGradient>
          <radialGradient id="review-master-glow">
            <stop offset="0%" stopColor="#f3e8ff" stopOpacity="0.8"/>
            <stop offset="100%" stopColor="#a855f7" stopOpacity="0"/>
          </radialGradient>
        </defs>
        <circle cx="32" cy="32" r="26" fill="url(#review-master-glow)" className="badge-glow"/>
        <circle cx="32" cy="32" r="22" fill="url(#review-master-grad)" className="badge-main"/>
        <path d="M32 12L36 26L50 28L40 38L43 52L32 44L21 52L24 38L14 28L28 26L32 12Z" 
              fill="white" opacity="0.9" className="badge-accent"/>
        <path d="M24 28L28 32L24 36M40 28L36 32L40 36" stroke="#9333ea" strokeWidth="2" strokeLinecap="round" opacity="0.6"/>
        <circle cx="32" cy="32" r="20" stroke="#c4b5fd" strokeWidth="0.5" opacity="0.4" className="badge-ring"/>
      </svg>
    ),
    
    'Issue-Opener-5': (
      <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="issue-5-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#06b6d4" />
            <stop offset="100%" stopColor="#0891b2" />
          </linearGradient>
          <radialGradient id="issue-5-glow">
            <stop offset="0%" stopColor="#cffafe" stopOpacity="0.6"/>
            <stop offset="100%" stopColor="#06b6d4" stopOpacity="0"/>
          </radialGradient>
        </defs>
        <circle cx="32" cy="32" r="24" fill="url(#issue-5-glow)" className="badge-glow"/>
        <circle cx="32" cy="32" r="20" stroke="url(#issue-5-grad)" strokeWidth="3" fill="none" className="badge-main"/>
        <circle cx="32" cy="24" r="3" fill="url(#issue-5-grad)" className="badge-accent"/>
        <path d="M32 30V40" stroke="url(#issue-5-grad)" strokeWidth="3" strokeLinecap="round" className="badge-accent"/>
        <path d="M20 34L32 46L44 34" stroke="#06b6d4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.5" className="badge-arrow"/>
      </svg>
    ),
    
    'Issue-Opener-10': (
      <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="issue-10-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#0ea5e9" />
            <stop offset="100%" stopColor="#0284c7" />
          </linearGradient>
          <radialGradient id="issue-10-glow">
            <stop offset="0%" stopColor="#e0f2fe" stopOpacity="0.8"/>
            <stop offset="100%" stopColor="#0ea5e9" stopOpacity="0"/>
          </radialGradient>
        </defs>
        <circle cx="32" cy="32" r="24" fill="url(#issue-10-glow)" className="badge-glow"/>
        <circle cx="32" cy="32" r="22" fill="url(#issue-10-grad)" className="badge-main"/>
        <circle cx="32" cy="24" r="3" fill="white" opacity="0.9"/>
        <rect x="29" y="30" width="6" height="14" rx="1" fill="white" opacity="0.9" className="badge-accent"/>
        <path d="M22 42L32 52L42 42" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="badge-arrow"/>
        <circle cx="32" cy="32" r="20" stroke="#38bdf8" strokeWidth="0.5" opacity="0.4" className="badge-ring"/>
      </svg>
    ),
    
    'Issue-Opener-25': (
      <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="issue-25-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#3b82f6" />
            <stop offset="100%" stopColor="#2563eb" />
          </linearGradient>
          <radialGradient id="issue-25-glow">
            <stop offset="0%" stopColor="#dbeafe" stopOpacity="0.9"/>
            <stop offset="100%" stopColor="#3b82f6" stopOpacity="0"/>
          </radialGradient>
        </defs>
        <circle cx="32" cy="32" r="26" fill="url(#issue-25-glow)" className="badge-glow"/>
        <circle cx="32" cy="32" r="24" fill="url(#issue-25-grad)" className="badge-main"/>
        <path d="M32 12L36 26L50 28L40 38L43 52L32 44L21 52L24 38L14 28L28 26L32 12Z" 
              fill="white" opacity="0.95" className="badge-accent"/>
        <circle cx="32" cy="28" r="2.5" fill="#2563eb" className="badge-dot"/>
        <rect x="30" y="32" width="4" height="8" rx="1" fill="#2563eb" opacity="0.8"/>
        <circle cx="32" cy="32" r="22" stroke="#93c5fd" strokeWidth="0.5" opacity="0.4" className="badge-ring"/>
      </svg>
    ),
    
    'Early-Contributor': (
      <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="early-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#f59e0b" />
            <stop offset="100%" stopColor="#d97706" />
          </linearGradient>
          <radialGradient id="early-glow">
            <stop offset="0%" stopColor="#fef3c7" stopOpacity="0.7"/>
            <stop offset="100%" stopColor="#f59e0b" stopOpacity="0"/>
          </radialGradient>
        </defs>
        <circle cx="32" cy="32" r="24" fill="url(#early-glow)" className="badge-glow"/>
        <circle cx="32" cy="32" r="20" fill="url(#early-grad)" className="badge-main"/>
        <path d="M32 16V32L40 40" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="badge-accent"/>
        <circle cx="32" cy="32" r="3" fill="white" className="badge-center"/>
        {[0, 45, 90, 135, 180, 225, 270, 315].map((angle, i) => {
          const rad = (angle * Math.PI) / 180;
          const x = 32 + Math.cos(rad) * 17;
          const y = 32 + Math.sin(rad) * 17;
          return <circle key={i} cx={x} cy={y} r="1.5" fill="white" opacity="0.6"/>;
        })}
        <circle cx="32" cy="32" r="18" stroke="#fbbf24" strokeWidth="0.5" opacity="0.3" className="badge-ring"/>
      </svg>
    ),
    
    'Active-Last-30d': (
      <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="bolt-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#10b981" />
            <stop offset="100%" stopColor="#059669" />
          </linearGradient>
          <radialGradient id="bolt-glow">
            <stop offset="0%" stopColor="#d1fae5" stopOpacity="0.7"/>
            <stop offset="100%" stopColor="#10b981" stopOpacity="0"/>
          </radialGradient>
        </defs>
        <circle cx="32" cy="32" r="24" fill="url(#bolt-glow)" className="badge-pulse"/>
        <path d="M35 8L20 32H32L29 56L44 32H32L35 8Z" fill="url(#bolt-grad)" className="badge-main"/>
        <path d="M35 8L20 32H32L29 56L44 32H32L35 8Z" fill="white" opacity="0.3" className="badge-shine"/>
        {[0, 1, 2].map(i => (
          <circle key={i} cx="32" cy="32" r={14 + i * 6} stroke="#10b981" strokeWidth="0.5" 
                  opacity={0.4 - i * 0.12} className="badge-ripple" 
                  style={{ animationDelay: `${i * 0.4}s` }}/>
        ))}
      </svg>
    ),
    
    'Active-Last-90d': (
      <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="wave-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#14b8a6" />
            <stop offset="100%" stopColor="#0d9488" />
          </linearGradient>
          <radialGradient id="wave-glow">
            <stop offset="0%" stopColor="#ccfbf1" stopOpacity="0.6"/>
            <stop offset="100%" stopColor="#14b8a6" stopOpacity="0"/>
          </radialGradient>
        </defs>
        <circle cx="32" cy="32" r="24" fill="url(#wave-glow)" className="badge-glow"/>
        <circle cx="32" cy="32" r="20" fill="url(#wave-grad)" className="badge-main"/>
        <path d="M16 32C16 32 20 24 24 24C28 24 28 40 32 40C36 40 36 24 40 24C44 24 48 32 48 32" 
              stroke="white" strokeWidth="3" fill="none" strokeLinecap="round" className="badge-accent"/>
        <circle cx="24" cy="24" r="2" fill="white" className="badge-dot"/>
        <circle cx="32" cy="40" r="2" fill="white" className="badge-dot"/>
        <circle cx="40" cy="24" r="2" fill="white" className="badge-dot"/>
      </svg>
    ),
    
    'New-Joiner': (
      <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="sparkle-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#fde047" />
            <stop offset="100%" stopColor="#facc15" />
          </linearGradient>
          <radialGradient id="sparkle-glow">
            <stop offset="0%" stopColor="#fef9c3" stopOpacity="0.8"/>
            <stop offset="100%" stopColor="#fde047" stopOpacity="0"/>
          </radialGradient>
        </defs>
        <circle cx="32" cy="32" r="26" fill="url(#sparkle-glow)" className="badge-glow"/>
        <path d="M32 8L36 24L52 28L36 32L32 48L28 32L12 28L28 24L32 8Z" 
              fill="url(#sparkle-grad)" className="badge-main"/>
        <path d="M48 12L50 18L56 20L50 22L48 28L46 22L40 20L46 18L48 12Z" 
              fill="url(#sparkle-grad)" opacity="0.7" className="badge-sparkle"/>
        <path d="M16 44L18 50L24 52L18 54L16 60L14 54L8 52L14 50L16 44Z" 
              fill="url(#sparkle-grad)" opacity="0.5" className="badge-sparkle-2"/>
        <circle cx="32" cy="32" r="22" stroke="#fde047" strokeWidth="0.5" opacity="0.4" className="badge-ring"/>
      </svg>
    ),
    
    'Dormant-90d+': (
      <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="dormant-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#6b7280" />
            <stop offset="100%" stopColor="#4b5563" />
          </linearGradient>
          <radialGradient id="dormant-glow">
            <stop offset="0%" stopColor="#e5e7eb" stopOpacity="0.4"/>
            <stop offset="100%" stopColor="#6b7280" stopOpacity="0"/>
          </radialGradient>
        </defs>
        <circle cx="32" cy="32" r="24" fill="url(#dormant-glow)" className="badge-glow"/>
        <path d="M40 16A18 18 0 1 1 24 16A14 14 0 0 0 40 16Z" fill="url(#dormant-grad)" opacity="0.8" className="badge-main"/>
        <circle cx="28" cy="28" r="2.5" fill="white" opacity="0.6" className="badge-star"/>
        <circle cx="36" cy="24" r="1.5" fill="white" opacity="0.4" className="badge-star"/>
        <circle cx="34" cy="32" r="2" fill="white" opacity="0.5" className="badge-star"/>
        <path d="M20 36C20 36 24 32 28 32C32 32 36 36 36 36" stroke="white" strokeWidth="1.5" 
              strokeLinecap="round" opacity="0.3" className="badge-accent"/>
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
        <circle cx="32" cy="32" r="24" fill="url(#default-grad)" opacity="0.9" className="badge-main"/>
        <circle cx="32" cy="32" r="18" stroke="white" strokeWidth="2" opacity="0.3"/>
        <path d="M32 20L36 28L44 32L36 36L32 44L28 36L20 32L28 28L32 20Z" fill="white" opacity="0.9"/>
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
  // Add all other badge configs...
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

              {hoveredBadge === badge.name && !compact && (
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