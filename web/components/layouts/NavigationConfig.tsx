import {
  Users,
  Calendar,
  Receipt,
  Package,
  DollarSign,
  PiggyBank,
  Briefcase,
  Calculator,
  Megaphone,
  Wrench,
  XCircle,
  BarChart3,
  Clock,
  ClipboardList,
  Settings
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
          label: t('navigation.dashboard'),
          icon: BarChart3
        },
        {
          href: '/treatments',
          label: t('navigation.treatments'),
          icon: Calendar
        },
        {
          href: '/patients',
          label: t('navigation.patients'),
          icon: Users
        },
        {
          href: '/expenses',
          label: t('navigation.expenses'),
          icon: Receipt
        },
        {
          href: '/prescriptions',
          label: t('navigation.prescriptions'),
          icon: ClipboardList
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
        }
      ]
    },
    {
      title: t('navigation.finance'),
      items: [
        {
          href: '/equilibrium',
          label: t('navigation.equilibrium'),
          icon: Calculator
        }
      ]
    },
    {
      title: t('navigation.configuration'),
      items: [
        {
          href: '/time',
          label: t('navigation.time'),
          icon: Clock
        },
        {
          href: '/assets',
          label: t('navigation.assets'),
          icon: PiggyBank
        },
        {
          href: '/fixed-costs',
          label: t('navigation.fixed_costs'),
          icon: DollarSign
        },
        {
          href: '/settings',
          label: t('navigation.settings'),
          icon: Settings
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
