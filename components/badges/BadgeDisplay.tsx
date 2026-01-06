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

// Badge type definitions with colors and icons
const BADGE_CONFIG: Record<string, { color: string; bgColor: string; icon: string; category: 'achievement' | 'activity' }> = {
  'Framework-Steward': {
    color: '#0366d6',
    bgColor: 'rgba(3, 102, 214, 0.1)',
    icon: '🛡️',
    category: 'achievement'
  },
  'Core-Contributor': {
    color: '#28a745',
    bgColor: 'rgba(40, 167, 69, 0.1)',
    icon: '⭐',
    category: 'achievement'
  },
  'Top-Reviewer': {
    color: '#6f42c1',
    bgColor: 'rgba(111, 66, 193, 0.1)',
    icon: '👁️',
    category: 'achievement'
  },
  'Contributor-5': {
    color: '#e34c26',
    bgColor: 'rgba(227, 76, 38, 0.1)',
    icon: '🎯',
    category: 'achievement'
  },
  'Contributor-10': {
    color: '#e34c26',
    bgColor: 'rgba(227, 76, 38, 0.1)',
    icon: '🎯',
    category: 'achievement'
  },
  'Contributor-25': {
    color: '#e34c26',
    bgColor: 'rgba(227, 76, 38, 0.1)',
    icon: '🎯',
    category: 'achievement'
  },
  'Reviewer-10': {
    color: '#6f42c1',
    bgColor: 'rgba(111, 66, 193, 0.1)',
    icon: '👁️',
    category: 'achievement'
  },
  'Reviewer-25': {
    color: '#6f42c1',
    bgColor: 'rgba(111, 66, 193, 0.1)',
    icon: '👁️',
    category: 'achievement'
  },
  'Early-Contributor': {
    color: '#f6c32c',
    bgColor: 'rgba(246, 195, 44, 0.1)',
    icon: '🌱',
    category: 'achievement'
  },
  'Active-Last-30d': {
    color: '#28a745',
    bgColor: 'rgba(40, 167, 69, 0.1)',
    icon: '⚡',
    category: 'activity'
  },
  'Active-Last-90d': {
    color: '#17a2b8',
    bgColor: 'rgba(23, 162, 184, 0.1)',
    icon: '🔥',
    category: 'activity'
  },
  'New-Joiner': {
    color: '#ffc107',
    bgColor: 'rgba(255, 193, 7, 0.1)',
    icon: '✨',
    category: 'activity'
  },
  'Dormant-90d+': {
    color: '#6c757d',
    bgColor: 'rgba(108, 117, 125, 0.1)',
    icon: '💤',
    category: 'activity'
  }
};

function getBadgeConfig(badgeName: string) {
  return BADGE_CONFIG[badgeName] || {
    color: '#6c757d',
    bgColor: 'rgba(108, 117, 125, 0.1)',
    icon: '🏅',
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

function isRecentActivity(badgeName: string, assignedDate: string): boolean {
  if (!assignedDate) return false;
  const activityBadges = ['Active-Last-30d', 'Active-Last-90d', 'New-Joiner'];
  if (!activityBadges.includes(badgeName)) return false;
  
  try {
    const date = new Date(assignedDate);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays <= 90;
  } catch {
    return false;
  }
}

interface BadgeDisplayProps {
  contributorSlug?: string;
  badges?: Badge[];
  compact?: boolean;
}

export function BadgeDisplay({ contributorSlug, badges, compact = false }: BadgeDisplayProps) {
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

  if (displayBadges.length === 0) {
    return null;
  }

  // Separate badges by category
  const achievementBadges = displayBadges.filter(b => {
    const config = getBadgeConfig(b.name);
    return config.category === 'achievement';
  });
  
  const activityBadges = displayBadges.filter(b => {
    const config = getBadgeConfig(b.name);
    return config.category === 'activity';
  });

  return (
    <div className={`badge-display ${compact ? 'badge-display-compact' : ''}`}>
      {achievementBadges.length > 0 && (
        <div className="badge-category">
          {!compact && <div className="badge-category-label">Achievements</div>}
          <div className="badge-list">
            {achievementBadges.map((badge, index) => {
              const config = getBadgeConfig(badge.name);
              return (
                <div
                  key={`${badge.name}-${index}`}
                  className="badge-item badge-achievement"
                  style={{
                    '--badge-color': config.color,
                    '--badge-bg': config.bgColor,
                  } as React.CSSProperties}
                  title={badge.assigned ? `Awarded ${formatDate(badge.assigned)}` : badge.name}
                >
                  <span className="badge-icon">{config.icon}</span>
                  <span className="badge-name">{badge.name}</span>
                  {badge.assigned && !compact && (
                    <span className="badge-date">{formatDate(badge.assigned)}</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
      
      {activityBadges.length > 0 && (
        <div className="badge-category">
          {!compact && <div className="badge-category-label">Activity</div>}
          <div className="badge-list">
            {activityBadges.map((badge, index) => {
              const config = getBadgeConfig(badge.name);
              const isRecent = isRecentActivity(badge.name, badge.assigned);
              return (
                <div
                  key={`${badge.name}-${index}`}
                  className={`badge-item badge-activity ${isRecent ? 'badge-recent' : ''}`}
                  style={{
                    '--badge-color': config.color,
                    '--badge-bg': config.bgColor,
                  } as React.CSSProperties}
                  title={badge.assigned ? `Active since ${formatDate(badge.assigned)}` : badge.name}
                >
                  <span className="badge-icon">{config.icon}</span>
                  <span className="badge-name">{badge.name}</span>
                  {badge.assigned && !compact && (
                    <span className="badge-date">{formatDate(badge.assigned)}</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// Standalone component to show all contributors' badges
export function AllBadgesDisplay() {
  const contributors = Object.values(contributorsData as Record<string, Contributor>);
  const contributorsWithBadges = contributors.filter(c => 
    c.badges && c.badges.some(b => b.name && b.name.trim() !== '')
  );

  if (contributorsWithBadges.length === 0) {
    return (
      <div className="badge-display-empty">
        <p>No badges have been awarded yet. Check back soon!</p>
      </div>
    );
  }

  return (
    <div className="all-badges-display">
      <h2 className="badge-section-title">Contributor Badges</h2>
      <div className="badge-stats">
        <div className="badge-stat-item">
          <span className="badge-stat-number">{contributorsWithBadges.length}</span>
          <span className="badge-stat-label">Contributors with Badges</span>
        </div>
        <div className="badge-stat-item">
          <span className="badge-stat-number">
            {contributorsWithBadges.reduce((sum, c) => 
              sum + (c.badges?.filter(b => b.name && b.name.trim() !== '').length || 0), 0
            )}
          </span>
          <span className="badge-stat-label">Total Badges Awarded</span>
        </div>
      </div>
      
      <div className="badge-contributors-grid">
        {contributorsWithBadges.map(contributor => (
          <div key={contributor.slug} className="badge-contributor-card">
            <div className="badge-contributor-header">
              <img 
                src={contributor.avatar} 
                alt={contributor.name}
                className="badge-contributor-avatar"
              />
              <div className="badge-contributor-info">
                <div className="badge-contributor-name">{contributor.name}</div>
                {contributor.steward && (
                  <div className="badge-contributor-steward">Steward: {contributor.steward}</div>
                )}
              </div>
            </div>
            <BadgeDisplay badges={contributor.badges} compact={false} />
          </div>
        ))}
      </div>
    </div>
  );
}

export default BadgeDisplay;

