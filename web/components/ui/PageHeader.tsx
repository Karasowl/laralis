'use client';

import * as React from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { ChevronLeft } from "lucide-react";

export interface PageHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  subtitle?: string;
  description?: string;
  actions?: React.ReactNode;
  backHref?: string;
}

const PageHeader = React.forwardRef<HTMLDivElement, PageHeaderProps>(
  ({ className, title, subtitle, description, actions, backHref, children, ...props }, ref) => {
    const t = useTranslations('common');

    return (
      <div
        ref={ref}
        className={cn(
          "flex flex-col gap-4 pb-4 sm:pb-6 lg:pb-8 border-b border-border/40",
          className
        )}
        {...props}
      >
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="space-y-2 min-w-0 flex-1">
            {backHref && (
              <Link
                href={backHref}
                className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-2"
              >
                <ChevronLeft className="h-4 w-4" />
                {t('back')}
              </Link>
            )}
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-foreground">
              {title}
            </h1>
            {(subtitle || description) && (
              <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
                {subtitle || description}
              </p>
            )}
          </div>
          {actions && (
            <div className="flex flex-wrap items-center gap-2 justify-end sm:ml-4 shrink-0">
              {actions}
            </div>
          )}
        </div>
        {children}
      </div>
    );
  }
);
PageHeader.displayName = "PageHeader";

export { PageHeader };