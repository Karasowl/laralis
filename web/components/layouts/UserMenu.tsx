'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { 
  User, 
  Settings, 
  LogOut, 
  HelpCircle,
  CreditCard,
  Building,
  ChevronDown
} from 'lucide-react'
import { useAuth } from '@/hooks/use-auth'

interface UserMenuProps {
  user?: {
    name?: string
    email?: string
    avatar?: string
  }
  showLabel?: boolean
}

export function UserMenu({ user, showLabel = true }: UserMenuProps) {
  const t = useTranslations()
  const router = useRouter()
  const { logout } = useAuth()
  const [open, setOpen] = useState(false)

  const initials = user?.name
    ?.split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase() || 'U'

  const menuItems = [
    {
      icon: User,
      label: t('navigation.profile'),
      onClick: () => router.push('/profile')
    },
    {
      icon: Building,
      label: t('navigation.workspaces'),
      onClick: () => router.push('/settings/workspaces')
    },
    {
      icon: CreditCard,
      label: t('navigation.billing'),
      onClick: () => router.push('/billing')
    },
    {
      icon: Settings,
      label: t('navigation.settings'),
      onClick: () => router.push('/settings')
    },
    {
      icon: HelpCircle,
      label: t('navigation.help'),
      onClick: () => router.push('/help')
    }
  ]

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="ghost" 
          className="flex items-center gap-2 h-auto p-2"
        >
          <Avatar className="h-8 w-8">
            <AvatarImage src={user?.avatar} alt={user?.name} />
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
          
          {showLabel && (
            <>
              <div className="flex flex-col items-start">
                <span className="text-sm font-medium">{user?.name || t('navigation.profile')}</span>
                <span className="text-xs text-muted-foreground">{user?.email}</span>
              </div>
              <ChevronDown className="h-4 w-4 ml-2 opacity-50" />
            </>
          )}
        </Button>
      </DropdownMenuTrigger>
      
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium">{user?.name || t('navigation.profile')}</p>
            <p className="text-xs text-muted-foreground">{user?.email}</p>
          </div>
        </DropdownMenuLabel>
        
        <DropdownMenuSeparator />
        
        {menuItems.map((item, index) => {
          const Icon = item.icon
          return (
            <DropdownMenuItem
              key={index}
              onClick={item.onClick}
              className="cursor-pointer"
            >
              <Icon className="mr-2 h-4 w-4" />
              <span>{item.label}</span>
            </DropdownMenuItem>
          )
        })}
        
        <DropdownMenuSeparator />
        
        <DropdownMenuItem
          onClick={logout}
          className="cursor-pointer text-red-600 focus:text-red-600"
        >
          <LogOut className="mr-2 h-4 w-4" />
          <span>{t('logout')}</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
