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
  MessageCircle,
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

export interface NavigationOptions {
  onboardingCompleted?: boolean
  showDashboard?: boolean
  showFinance?: boolean
}

export function getNavigationSections(t: any, options: NavigationOptions = {}): NavigationSection[] {
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
          href: '/inbox',
          label: t('navigation.inbox'),
          icon: MessageCircle
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

  const showDashboard = options.showDashboard ?? true
  const showFinance = options.showFinance ?? true
  const financeRoutes = new Set(['/expenses', '/equilibrium', '/assets', '/fixed-costs', '/time', '/reports'])

  const sectionsWithDashboard = showDashboard
    ? baseSections
    : baseSections
      .map(section => ({
        ...section,
        items: section.items.filter(item => item.href !== '/')
      }))
      .filter(section => section.items.length > 0)

  const sections = showFinance
    ? sectionsWithDashboard
    : sectionsWithDashboard
      .map(section => ({
        ...section,
        items: section.items.filter(item => !financeRoutes.has(item.href))
      }))
      .filter(section => section.items.length > 0)

  const onboardingCompleted = options.onboardingCompleted ?? true;

  if (!onboardingCompleted) {
    const allowed = new Set(['/setup', '/services', '/supplies', '/assets', '/fixed-costs']);
    const filtered = sections
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

  return sections;
}
