import { 
  Home, 
  Users, 
  Calendar, 
  Receipt, 
  Package, 
  DollarSign, 
  TrendingUp, 
  Settings as SettingsIcon,
  PiggyBank,
  Briefcase,
  Calculator,
  Shield,
  Building,
  Megaphone
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

export function getNavigationSections(t: any): NavigationSection[] {
  return [
    {
      items: [
        {
          href: '/',
          label: t('navigation.dashboard'),
          icon: Home
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
          href: '/assets',
          label: t('navigation.assets'),
          icon: PiggyBank
        },
        {
          href: '/equilibrium',
          label: t('navigation.equilibrium'),
          icon: Calculator
        },
        {
          href: '/reports',
          label: t('navigation.reports'),
          icon: TrendingUp
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
          href: '/settings/clinics',
          label: t('navigation.clinics'),
          icon: Shield
        },
        {
          href: '/settings/marketing',
          label: t('navigation.marketing'),
          icon: Megaphone
        }
      ]
    }
  ]
}