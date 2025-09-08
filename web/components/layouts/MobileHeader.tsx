'use client'

import { Button } from '@/components/ui/button'
import { Menu, X } from 'lucide-react'
import { LanguageSwitcher } from '@/components/LanguageSwitcher'
import { cn } from '@/lib/utils'

interface MobileHeaderProps {
  isOpen: boolean
  onToggle: () => void
  logo?: React.ReactNode
  className?: string
}

export function MobileHeader({ 
  isOpen, 
  onToggle, 
  logo,
  className 
}: MobileHeaderProps) {
  return (
    <header className={cn(
      "lg:hidden fixed top-0 left-0 right-0 z-40 bg-background border-b",
      className
    )}>
      <div className="flex items-center justify-between px-4 h-16">
        {logo && (
          <div className="flex items-center">
            {logo}
          </div>
        )}
        <div className="flex items-center gap-1">
          <LanguageSwitcher compact={true} />
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggle}
            aria-label={isOpen ? "Close menu" : "Open menu"}
          >
            {isOpen ? (
              <X className="h-6 w-6" />
            ) : (
              <Menu className="h-6 w-6" />
            )}
          </Button>
        </div>
      </div>
    </header>
  )
}
