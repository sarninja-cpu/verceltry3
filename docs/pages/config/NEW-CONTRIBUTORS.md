# Contributors, Roles & Badges – Design Draft

## 1. Contributor Data Structure

Contributors are stored in `contributors.json` using the following structure:

```json
"mattaereal": {
  "slug": "mattaereal",
  "name": "matta",
  "avatar": "https://avatars.githubusercontent.com/mattaereal",
  "github": "https://github.com/mattaereal",
  "twitter": "https://twitter.com/mattaereal",
  "role": "",
  "steward": "",
  "badges": [
      { "name": "Lead", "assigned": "" },
      { "name": "Framework-Steward", "assigned": "", "framework": "" },
      { "name": "Core-Contributor", "assigned": "" },
      { "name": "Early-Contributor", "assigned": "" },
      { "name": "First-Contribution", "assigned": "" },
      { "name": "Contributor-5", "assigned": "" },
      { "name": "Contributor-10", "assigned": "" },
      { "name": "Contributor-25", "assigned": "" },
      { "name": "First-Review", "assigned": "" },
      { "name": "Reviewer-10", "assigned": "" },
      { "name": "Reviewer-25", "assigned": "" },
      { "name": "Issue-Opener-5", "assigned": "" },
      { "name": "Issue-Opener-10", "assigned": "" },
      { "name": "Issue-Opener-25", "assigned": "" },
      { "name": "Active-Last-7d", "assigned": "" },
      { "name": "Active-Last-30d", "assigned": "" },
      { "name": "New-Joiner", "assigned": "" },
      { "name": "Dormant-90d+", "assigned": "" }          
    ]
}
```

### Field Descriptions

| Field | Description |
|-------|-------------|
| `slug` | Unique identifier (GitHub username) |
| `name` | Display name |
| `avatar` | GitHub avatar URL |
| `github` | GitHub profile URL |
| `twitter` | Twitter/X profile URL (optional) |
| `role` | Project role (see below) |
| `steward` | Framework owned (only if role is steward) |
| `badges` | List of achievement and activity badges |

## 2. Project Roles

### Standard Roles

#### **lead**

- Oversees the project as a whole
- Strategic direction and final decision-making

#### **core team**

- Regular, trusted contributors
- Merge rights and governance participation

#### **steward**

- Owns and maintains a specific framework
- Responsible for long-term quality and evolution

#### **reviewer**

- Regularly reviews PRs and provides technical feedback
- May not author content

#### **contributor**

- Has made accepted contributions
- No ongoing governance responsibilities

### Role Hierarchy (Conceptual)

```
lead
└── core team
    └── steward
        └── reviewer / contributor
```

> **Note:** Roles are sticky and change infrequently.

## 3. Badges Overview

Badges are used for recognition and gamification.

They are designed to:

- Be understandable at a glance
- Reflect both achievement and recency
- Be automatable
- Avoid manual micromanagement

Badges are divided into two categories:

1. **Achievement Badges** (historical)
2. **Activity Badges** (time-based)

## 4. Achievement Badges (Persistent)

These badges represent milestones or responsibilities and do not expire.

### Examples

- `Framework-Steward`: **Framework Steward**
- `Core-Contributor`: **Core Team**
- `Top-Reviewer`: **Top Community Reviewer**
- `Contributor-5`: **Rising Contributor (5+)**
- `Contributor-10`: **Gold Contributor (10+)**
- `Contributor-25`: **Elite Contributor (25+)**
- `Reviewer-10`: **Active Reviewer (10+)**
- `Reviewer-25`: **Senior Reviewer (25+)**
- `Issue-Opener-5`: **Bug Hunter (5+)**
- `Issue-Opener-10`: **Discovery Specialist (10+)**
- `Issue-Opener-25`: **Ecosystem Sentinel (25+)**
- `Early-Contributor`: **Early Contributor**

> **Note:** These are awarded when a contributor crosses a threshold, not per action.

## 5. Activity / Recency Badges (Time-Tied)

These badges represent recent or ongoing activity and can be added/removed automatically.

### Suggested Activity Badges

#### `Active-Last-30d`

- At least one merged PR or PR review in the last 30 days

#### `Active-Last-90d`

- Active within the last 3 months

#### `New-Joiner`

- First contribution within the last 30 days

#### `Dormant-90d+` (optional)

- No activity for more than 90 days

These badges allow differentiation between:

- Historically important contributors
- Recently active contributors
- Consistently active contributors

## 6. Time-Aware Badges

Badges may include an assignment timestamp:

```json
"badges": [
  { "name": "Framework-Steward", "assigned": "2025-03-15" },
  { "name": "Contributor-10", "assigned": "2025-12-01" },
  { "name": "Active-Last-30d", "assigned": "2026-01-02" }
]
```

This enables:

- Badge aging
- Automatic cleanup
- Visual differentiation in the UI (e.g., faded inactive badges)

## 7. Example Contributor Entry

```json
"mattaereal": {
  "slug": "mattaereal",
  "name": "matta",
  "avatar": "https://avatars.githubusercontent.com/mattaereal",
  "github": "https://github.com/mattaereal",
  "twitter": "https://twitter.com/mattaereal",
  "role": "steward",
  "steward": "Cloud Security Framework",
  "badges": [
    { "name": "Framework-Steward", "assigned": "2025-03-15" },
    { "name": "Contributor-10", "assigned": "2025-12-01" },
    { "name": "Active-Last-30d", "assigned": "2026-01-02" }
  ]
}
```

## 8. Automation Strategy (Future)

To keep maintenance low:

### Achievement Badges

- Assigned when thresholds are crossed
- Rarely change

### Activity Badges

- Computed automatically (weekly or nightly)
- Added/removed based on GitHub activity

### Possible Automation Sources

- Merged PR count
- PR reviews
- Releases / tags
- Steward role assignment

## 9. UI / Spotlight Zone Implications

Suggested display priority:

1. Role (lead / core team / steward)
2. Stewarded framework (if any)
3. Activity badge (recent activity highlight)
4. Achievement badges

> **Note:** Inactive contributors can remain visible, but visually de-emphasized.

## 10. Core Design Principles

- Project roles > job titles
- Badges > raw points
- Thresholds > per-action scoring
- Recency matters
- Automation first, manual second
- Recognition reflects trust and responsibility

## 11. Open Questions (for Team Discussion)

- Should inactivity remove certain privileges automatically?
- How long should activity badges last (30d vs 60d vs 90d)?
- Should stewards be required to maintain activity?
- Should reviewers have a minimum activity threshold?

"badges": [
      { "name": "Lead", "assigned": "" },
      { "name": "Framework-Steward", "assigned": "", "framework": "" },
      { "name": "Core-Contributor", "assigned": "" },
      { "name": "Early-Contributor", "assigned": "" },
      { "name": "First-Contribution", "assigned": "" },
      { "name": "Contributor-5", "assigned": "" },
      { "name": "Contributor-10", "assigned": "" },
      { "name": "Contributor-25", "assigned": "" },
      { "name": "First-Review", "assigned": "" },
      { "name": "Reviewer-10", "assigned": "" },
      { "name": "Reviewer-25", "assigned": "" },
      { "name": "Issue-Opener-5", "assigned": "" },
      { "name": "Issue-Opener-10", "assigned": "" },
      { "name": "Issue-Opener-25", "assigned": "" },
      { "name": "Active-Last-7d", "assigned": "" },
      { "name": "Active-Last-30d", "assigned": "" },
      { "name": "New-Joiner", "assigned": "" },
      { "name": "Dormant-90d+", "assigned": "" }          
    ]