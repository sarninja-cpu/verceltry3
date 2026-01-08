import React, { useEffect, useRef, useState } from 'react';
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

// Custom Hook for Intersection Observer
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

// Helper to check if a badge was earned recently (< 30 days)
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

// Custom Animated SVG Icons
const BadgeIcon = ({ name, color, isAchievement }: { name: string, color: string, isAchievement: boolean }) => {
  const getIcon = () => {
    switch (name) {
      case 'Framework-Steward':
        return (
          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2L4 5V11C4 16.19 7.41 21.05 12 22C16.59 21.05 20 16.19 20 11V5L12 2Z" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <path className="svg-pulse" d="M12 7V17M7 12H17" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        );
      case 'Core-Contributor':
        return (
          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path className="svg-rotate" d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" fill={color} opacity="0.8" />
            <circle className="svg-pulse" cx="12" cy="12" r="3" fill="white" />
          </svg>
        );
      case 'Top-Reviewer':
      case 'Reviewer-10':
      case 'Reviewer-25':
        return (
          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M1 12C1 12 5 4 12 4C19 4 23 12 23 12C23 12 19 20 12 20C5 20 1 12 1 12Z" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <circle className="svg-pulse" cx="12" cy="12" r="3" stroke={color} strokeWidth="2" />
            <line className="svg-scan" x1="1" y1="12" x2="23" y2="12" stroke={color} strokeWidth="1" opacity="0.5" />
          </svg>
        );
      case 'Contributor-5':
      case 'Contributor-10':
      case 'Contributor-25':
        return (
          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="12" cy="12" r="10" stroke={color} strokeWidth="2" />
            <circle className="svg-expand" cx="12" cy="12" r="6" stroke={color} strokeWidth="2" opacity="0.6" />
            <circle className="svg-pulse" cx="12" cy="12" r="2" fill={color} />
          </svg>
        );
      case 'Early-Contributor':
        return (
          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path className="svg-grow" d="M12 22V10M12 10C12 10 12 6 16 6M12 10C12 10 12 6 8 6" stroke={color} strokeWidth="2" strokeLinecap="round" />
            <circle className="svg-float" cx="16" cy="6" r="2" fill={color} />
            <circle className="svg-float-delay" cx="8" cy="6" r="2" fill={color} />
          </svg>
        );
      case 'Active-Last-30d':
      case 'Active-Last-90d':
        return (
          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path className="svg-flicker" d="M13 2L3 14H12L11 22L21 10H12L13 2Z" fill={color} />
          </svg>
        );
      case 'New-Joiner':
        return (
          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path className="svg-sparkle" d="M12 3L13.5 8.5L19 10L13.5 11.5L12 17L10.5 11.5L5 10L10.5 8.5L12 3Z" fill={color} />
            <path className="svg-sparkle-delay" d="M19 15L19.5 17.5L22 18L19.5 18.5L19 21L18.5 18.5L16 18L18.5 17.5L19 15Z" fill={color} opacity="0.6" />
          </svg>
        );
      case 'Dormant-90d+':
        return (
          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path className="svg-float" d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z" fill={color} opacity="0.7" />
          </svg>
        );
      default:
        return (
          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="12" cy="12" r="10" stroke={color} strokeWidth="2" />
            <path d="M12 8V12L15 15" stroke={color} strokeWidth="2" strokeLinecap="round" />
          </svg>
        );
    }
  };

  return (
    <div className={`badge-icon-svg ${isAchievement ? 'svg-achievement' : 'svg-activity'}`}>
      {getIcon()}
    </div>
  );
};

// Badge type definitions
const BADGE_CONFIG: Record<string, { color: string; bgColor: string; category: 'achievement' | 'activity'; role?: boolean }> = {
  'Framework-Steward': {
    color: '#0366d6',
    bgColor: 'rgba(3, 102, 214, 0.1)',
    category: 'achievement',
    role: true
  },
  'Core-Contributor': {
    color: '#28a745',
    bgColor: 'rgba(40, 167, 69, 0.1)',
    category: 'achievement',
    role: true
  },
  'Top-Reviewer': {
    color: '#6f42c1',
    bgColor: 'rgba(111, 66, 193, 0.1)',
    category: 'achievement'
  },
  'Contributor-5': {
    color: '#e34c26',
    bgColor: 'rgba(227, 76, 38, 0.1)',
    category: 'achievement'
  },
  'Contributor-10': {
    color: '#e34c26',
    bgColor: 'rgba(227, 76, 38, 0.1)',
    category: 'achievement'
  },
  'Contributor-25': {
    color: '#e34c26',
    bgColor: 'rgba(227, 76, 38, 0.1)',
    category: 'achievement'
  },
  'Reviewer-10': {
    color: '#6f42c1',
    bgColor: 'rgba(111, 66, 193, 0.1)',
    category: 'achievement'
  },
  'Reviewer-25': {
    color: '#6f42c1',
    bgColor: 'rgba(111, 66, 193, 0.1)',
    category: 'achievement'
  },
  'Early-Contributor': {
    color: '#f6c32c',
    bgColor: 'rgba(246, 195, 44, 0.1)',
    category: 'achievement'
  },
  'Active-Last-30d': {
    color: '#28a745',
    bgColor: 'rgba(40, 167, 69, 0.1)',
    category: 'activity'
  },
  'Active-Last-90d': {
    color: '#17a2b8',
    bgColor: 'rgba(23, 162, 184, 0.1)',
    category: 'activity'
  },
  'New-Joiner': {
    color: '#ffc107',
    bgColor: 'rgba(255, 193, 7, 0.1)',
    category: 'activity'
  },
  'Dormant-90d+': {
    color: '#6c757d',
    bgColor: 'rgba(108, 117, 125, 0.1)',
    category: 'activity'
  }
};

function getBadgeConfig(badgeName: string) {
  return BADGE_CONFIG[badgeName] || {
    color: '#6c757d',
    bgColor: 'rgba(108, 117, 125, 0.1)',
    category: 'achievement' as const
  };
}

function formatDate(dateString: string): string {
  if (!dateString) return '';
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  } catch {
    return dateString;
  }
}

interface BadgeDisplayProps {
  contributorSlug?: string;
  badges?: Badge[];
  compact?: boolean;
  showCount?: boolean;
}

export function BadgeDisplay({ contributorSlug, badges, compact = false, showCount = false }: BadgeDisplayProps) {
  const [containerRef, isVisible] = useIntersectionObserver({ threshold: 0.1 });
  let displayBadges: Badge[] = [];

  if (badges) {
    displayBadges = badges.filter(b => b.name && b.name.trim() !== '');
  } else if (contributorSlug) {
    const contributors = contributorsData as Record<string, Contributor>;
    const contributor = contributors[contributorSlug];
    if (contributor && contributor.badges) {
      displayBadges = contributor.badges.filter(b => b.name && b.name.trim() !== '');
    }
  }

  if (displayBadges.length === 0) return null;

  const renderBadgeList = (badges: Badge[], startIndex: number) => (
    <div className="badge-list">
      {badges.map((badge, index) => {
        const config = getBadgeConfig(badge.name);
        const isNew = isNewlyEarned(badge.assigned);
        const badgeDate = badge.assigned ? formatDate(badge.assigned) : '';
        const globalIndex = startIndex + index;

        return (
          <div
            key={`${badge.name}-${index}`}
            className={`badge-item ${config.category === 'achievement' ? 'badge-achievement' : 'badge-activity'} ${config.role ? 'badge-role' : ''} ${isNew ? 'newly-earned' : ''} ${isVisible ? 'visible' : ''}`}
            style={{
              '--badge-color': config.color,
              'transitionDelay': `${globalIndex * 100}ms`
            } as React.CSSProperties}
            data-badge-name={badge.name}
            data-badge-date={badgeDate ? `${isNew ? '✨ New! ' : ''}Awarded ${badgeDate}` : ''}
          >
            <span className="badge-icon">
              <BadgeIcon name={badge.name} color={config.color} isAchievement={config.category === 'achievement'} />
            </span>
            <span className="badge-name">{badge.name}</span>
            {badge.assigned && (
              <span className="badge-date">{formatDate(badge.assigned)}</span>
            )}
          </div>
        );
      })}
    </div>
  );

  const achievements = displayBadges.filter(b => getBadgeConfig(b.name).category === 'achievement');
  const activities = displayBadges.filter(b => getBadgeConfig(b.name).category === 'activity');

  return (
    <div ref={containerRef} className={`badge-display ${compact ? 'badge-display-compact' : ''}`}>
      {showCount && <div className="badge-count-indicator">{displayBadges.length}</div>}

      {achievements.length > 0 && (
        <div className="badge-category">
          {!compact && <div className="badge-category-label">Achievements</div>}
          {renderBadgeList(achievements, 0)}
        </div>
      )}

      {activities.length > 0 && (
        <div className="badge-category">
          {!compact && <div className="badge-category-label">Activity</div>}
          {renderBadgeList(activities, achievements.length)}
        </div>
      )}
    </div>
  );
}

export function AllBadgesDisplay() {
  const contributors = Object.values(contributorsData as Record<string, Contributor>);
  const contributorsWithBadges = contributors.filter(c =>
    c.badges && c.badges.some(b => b.name && b.name.trim() !== '')
  );

  if (contributorsWithBadges.length === 0) return null;

  return (
    <div className="all-badges-display">
      <h2 className="badge-section-title">Contributor Badges</h2>
      <div className="badge-stats">
        <div className="badge-stat-item">
          <span className="badge-stat-number">{contributorsWithBadges.length}</span>
          <span className="badge-stat-label">Active Contributors</span>
        </div>
        <div className="badge-stat-item">
          <span className="badge-stat-number">
            {contributorsWithBadges.reduce((sum, c) => sum + (c.badges?.length || 0), 0)}
          </span>
          <span className="badge-stat-label">Milestones Reached</span>
        </div>
        <div className="badge-stat-item">
          <span className="badge-stat-number">
            {contributorsWithBadges.reduce((sum, c) =>
              sum + (c.badges?.filter(b => isNewlyEarned(b.assigned)).length || 0), 0
            )}
          </span>
          <span className="badge-stat-label">New This Month ✨</span>
        </div>
      </div>

      <div className="badge-contributors-grid">
        {contributorsWithBadges.map((contributor, index) => (
          <div
            key={contributor.slug}
            className="badge-contributor-card"
            style={{ '--card-index': index } as React.CSSProperties}
          >
            <div className="badge-contributor-header">
              <img src={contributor.avatar} alt="" className="badge-contributor-avatar" />
              <div className="badge-contributor-info">
                <div className="badge-contributor-name">{contributor.name}</div>
                {contributor.steward && <div className="badge-contributor-steward">{contributor.steward}</div>}
              </div>
            </div>
            <BadgeDisplay badges={contributor.badges} />
          </div>
        ))}
      </div>
    </div>
  );
}

export default BadgeDisplay;
