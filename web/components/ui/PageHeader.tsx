import * as React from "react";
import { cn } from "@/lib/utils";

export interface PageHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  subtitle?: string;
  description?: string;
  actions?: React.ReactNode;
}

const PageHeader = React.forwardRef<HTMLDivElement, PageHeaderProps>(
  ({ className, title, subtitle, description, actions, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "flex flex-col gap-4 pb-8 border-b border-border/40",
          className
        )}
        {...props}
      >
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="space-y-2 min-w-0 flex-1">
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
            <div className="flex items-center gap-2 sm:ml-4 shrink-0">
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