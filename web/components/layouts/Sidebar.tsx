'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { ChevronLeft } from 'lucide-react'
import { LucideIcon } from 'lucide-react'

interface SidebarItem {
  href: string
  label: string
  icon: LucideIcon
  badge?: string | number
}

interface SidebarSection {
  title?: string
  items: SidebarItem[]
}

interface SidebarProps {
  sections: SidebarSection[]
  isCollapsed: boolean
  onToggleCollapse: () => void
  className?: string
}

export function Sidebar({ 
  sections, 
  isCollapsed, 
  onToggleCollapse,
  className 
}: SidebarProps) {
  const pathname = usePathname()
  const tRoot = useT()

  return (
    <aside className={cn(
      "bg-card border-r transition-all duration-300 flex flex-col h-full",
      isCollapsed ? "w-16" : "w-64",
      className
    )}>
      {/* Collapse Button */}
      <div className="p-4 border-b flex-shrink-0">
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggleCollapse}
          className="ml-auto"
          aria-label={isCollapsed 
            ? tRoot('expand_sidebar', { fallback: 'Expand Sidebar' }) 
            : tRoot('collapse_sidebar', { fallback: 'Collapse Sidebar' })}
        >
          <ChevronLeft className={cn(
            "h-4 w-4 transition-transform",
            isCollapsed && "rotate-180"
          )} />
        </Button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto overscroll-contain scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-700">
        <div className="p-4 space-y-6 pb-8">
          {sections.map((section, sectionIndex) => (
            <div key={sectionIndex} className="space-y-1">
              {section.title && !isCollapsed && (
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  {section.title}
                </h3>
              )}
              
              {section.items.map((item) => {
                const isActive = pathname === item.href
                const Icon = item.icon
                
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2 rounded-lg transition-colors relative group",
                      isActive 
                        ? "bg-primary text-primary-foreground" 
                        : "hover:bg-muted text-muted-foreground hover:text-foreground",
                      isCollapsed && "justify-center"
                    )}
                  >
                    <Icon className="h-5 w-5 flex-shrink-0" />
                    
                    {!isCollapsed && (
                      <>
                        <span className="flex-1">{item.label}</span>
                        {item.badge && (
                          <span className="ml-auto flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs">
                            {item.badge}
                          </span>
                        )}
                      </>
                    )}
                    
                    {/* Tooltip for collapsed state */}
                    {isCollapsed && (
                      <div className="absolute left-full ml-2 px-2 py-1 bg-popover text-popover-foreground rounded-md opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 shadow-md">
                        {item.label}
                        {item.badge && (
                          <span className="ml-2 text-xs">({item.badge})</span>
                        )}
                      </div>
                    )}
                  </Link>
                )
              })}
            </div>
          ))}
        </div>
      </nav>
    </aside>
  )
}
