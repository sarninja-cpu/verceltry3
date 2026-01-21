import React, { Children, isValidElement, ReactNode } from 'react'
import { sidebar } from '../shared/sidebar'

const isMainBranch = process.env.CF_PAGES_BRANCH === 'main' || process.env.VERCEL_GIT_COMMIT_REF === 'main'

interface SidebarItem {
  text?: string
  link?: string
  dev?: boolean
  items?: SidebarItem[]
}

/**
 * Recursively extracts all dev-only links from the sidebar config
 */
function getDevOnlyLinks(items: SidebarItem[]): Set<string> {
  const devLinks = new Set<string>()

  function traverse(items: SidebarItem[], parentIsDev = false) {
    for (const item of items) {
      const isDev = parentIsDev || item.dev === true

      if (item.link && isDev) {
        devLinks.add(item.link)
      }

      if (item.items) {
        traverse(item.items, isDev)
      }
    }
  }

  traverse(items)
  return devLinks
}

const devOnlyLinks = getDevOnlyLinks(sidebar as SidebarItem[])

interface ElementProps {
  href?: string
  children?: React.ReactNode
  [key: string]: unknown
}

/**
 * Extracts the href from an element, checking both direct props and nested anchor tags
 */
function extractHref(element: React.ReactElement<ElementProps>): string | null {
  const props = element.props as ElementProps

  // Check direct href prop
  if (props?.href) {
    return props.href
  }

  // Check children for anchor tags (MDX headings with links)
  const children = props?.children
  if (children) {
    const childArray = Children.toArray(children)
    for (const child of childArray) {
      if (isValidElement(child)) {
        const href = extractHref(child as React.ReactElement<ElementProps>)
        if (href) return href
      }
    }
  }

  return null
}

/**
 * Checks if a link points to a dev-only framework
 */
function isDevOnlyLink(href: string): boolean {
  // Normalize the href (remove trailing slash, handle /overview suffix)
  const normalized = href.replace(/\/$/, '')

  // Check if this exact link or its overview is dev-only
  return devOnlyLinks.has(normalized) ||
    devOnlyLinks.has(normalized + '/overview') ||
    devOnlyLinks.has(normalized.replace('/overview', ''))
}

interface Props {
  children: ReactNode
}

/**
 * Filters the overview page content based on the current branch.
 * On main branch, sections linking to dev-only frameworks are hidden.
 *
 * The component identifies framework sections by finding h2 headings with links,
 * then includes/excludes everything until the next h2.
 */
export function FrameworkOverviewFilter({ children }: Props) {
  // On dev branches, show everything
  if (!isMainBranch) {
    return <>{children}</>
  }

  const childArray = Children.toArray(children)
  const result: ReactNode[] = []
  let skipUntilNextH2 = false

  for (let i = 0; i < childArray.length; i++) {
    const child = childArray[i]

    if (!isValidElement(child)) {
      if (!skipUntilNextH2) {
        result.push(child)
      }
      continue
    }

    // Check if this is an h2 heading
    const type = child.type
    const isH2 = typeof type === 'string'
      ? type === 'h2'
      : ((type as any)?.displayName === 'h2' || (type as any)?.name === 'h2')

    if (isH2) {
      const href = extractHref(child as React.ReactElement<ElementProps>)

      if (href && isDevOnlyLink(href)) {
        // This is a dev-only framework section, skip it and following content
        skipUntilNextH2 = true
      } else {
        // This is a regular framework section, include it
        skipUntilNextH2 = false
        result.push(child)
      }
    } else if (!skipUntilNextH2) {
      result.push(child)
    }
  }

  return <>{result}</>
}
