import { defineConfig } from 'vocs'
import { sidebar } from './components/shared/sidebar'

export const config = {
  banner: {
    content: '***This is a work in progress and not a release. We are looking for volunteers. See [Issues](https://github.com/security-alliance/frameworks/issues) and [Contribution](https://github.com/security-alliance/frameworks/blob/develop/docs/pages/contribute/contributing.mdx) to know how to collaborate.***',
    height: '30px',
    backgroundColor: '#8b5cf6',
    textColor: 'white',
    dismissable: false
  },
  title: 'Security Frameworks by SEAL',
  description: 'Comprehensive security framework documentation for Web3 projects and blockchain security best practices.',
  logoUrl: 'https://frameworks-static.s3.us-east-2.amazonaws.com/images/logo/frameworks-full.svg',
  iconUrl: 'https://frameworks-static.s3.us-east-2.amazonaws.com/images/logo/favicon.svg',
  ogImageUrl: {
    '/': 'https://frameworks-static.s3.us-east-2.amazonaws.com/images/logo/frameworks-full.png'
  },
  checkDeadlinks: "warn" as const,
  sidebar: sidebar,
  socials: [
    {
      icon: 'github' as const,
      link: 'https://github.com/security-alliance/frameworks',
    },
    {
      icon: 'discord' as const,
      link: 'https://discord.com/invite/securityalliance',
    },
  ],
  editLink: {
    pattern: 'https://github.com/security-alliance/frameworks/edit/develop/docs/pages/:path',
    text: 'Suggest changes to this page'
  }
}

function filterDevItems(items: any[]): any[] {
  return items
    .filter(item => !item.dev)
    .map(item => ({
      ...item,
      items: item.items ? filterDevItems(item.items) : undefined,
    }))
}

if (process.env.CF_PAGES_BRANCH === 'main' || process.env.VERCEL_GIT_COMMIT_REF === 'main') {
  config.sidebar = filterDevItems(config.sidebar)
}

export default defineConfig(config)
