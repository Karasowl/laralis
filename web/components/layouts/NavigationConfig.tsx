import {
  Home,
  Users,
  Calendar,
  Receipt,
  Package,
  DollarSign,
  Settings as SettingsIcon,
  PiggyBank,
  Briefcase,
  Calculator,
  Building,
  Megaphone,
  Wrench,
  XCircle,
  BarChart3,
  Shield
} from 'lucide-react'

export interface NavigationItem {
  href: string
  label: string
  icon: any
  badge?: string | number
}

export interface NavigationSection {
  title?: string
  items: NavigationItem[]
}

export function getNavigationSections(t: any, options: { onboardingCompleted?: boolean } = {}): NavigationSection[] {
  const baseSections: NavigationSection[] = [
    {
      items: [
        {
          href: '/',
          label: t('navigation.insights'),
          icon: BarChart3
        },
        {
          href: '/patients',
          label: t('navigation.patients'),
          icon: Users
        },
        {
          href: '/treatments',
          label: t('navigation.treatments'),
          icon: Calendar
        }
      ]
    },
    {
      title: t('navigation.operations'),
      items: [
        {
          href: '/services',
          label: t('navigation.services'),
          icon: Briefcase
        },
        {
          href: '/supplies',
          label: t('navigation.supplies'),
          icon: Package
        },
        {
          href: '/marketing',
          label: t('navigation.marketing'),
          icon: Megaphone
        },
        {
          href: '/expenses',
          label: t('navigation.expenses'),
          icon: Receipt
        }
      ]
    },
    {
      title: t('navigation.finance'),
      items: [
        {
          href: '/fixed-costs',
          label: t('navigation.fixed_costs'),
          icon: DollarSign
        },
        {
          href: '/tariffs',
          label: t('navigation.tariffs'),
          icon: Calculator
        },
        {
          href: '/assets',
          label: t('navigation.assets'),
          icon: PiggyBank
        },
        {
          href: '/equilibrium',
          label: t('navigation.equilibrium'),
          icon: Calculator
        }
      ]
    },
    {
      title: t('navigation.administration'),
      items: [
        {
          href: '/settings',
          label: t('navigation.settings'),
          icon: SettingsIcon
        },
        {
          href: '/settings/workspaces',
          label: t('navigation.workspaces'),
          icon: Building
        },
        {
          href: '/settings/account',
          label: t('navigation.account'),
          icon: Home
        },
        {
          href: '/settings/preferences',
          label: t('navigation.preferences'),
          icon: Calculator
        },
        {
          href: '/settings/security',
          label: t('navigation.security'),
          icon: Shield
        },
        {
          href: '/settings/data',
          label: t('navigation.dataMaintenance'),
          icon: Receipt
        },
        {
          href: '/settings/reset',
          label: t('navigation.reset'),
          icon: XCircle
        }
      ]
    }
  ];

  const onboardingCompleted = options.onboardingCompleted ?? true;

  if (!onboardingCompleted) {
    const allowed = new Set(['/setup', '/services', '/supplies', '/assets', '/fixed-costs']);
    const filtered = baseSections
      .map(section => ({
        ...section,
        items: section.items.filter(item => allowed.has(item.href))
      }))
      .filter(section => section.items.length > 0);

    const setupSection: NavigationSection = {
      items: [
        {
          href: '/setup',
          label: t('navigation.setup'),
          icon: Wrench
        },
        {
          href: '/setup/cancel',
          label: t('navigation.cancel_setup'),
          icon: XCircle
        }
      ]
    };

    return [setupSection, ...filtered];
  }

  return baseSections;
}
