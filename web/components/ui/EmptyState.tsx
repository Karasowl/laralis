import * as React from "react";
import { cn } from "@/lib/utils";

export interface EmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

const EmptyState = React.forwardRef<HTMLDivElement, EmptyStateProps>(
  ({ className, icon, title, description, action, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "flex flex-col items-center justify-center p-12 text-center space-y-4",
          className
        )}
        {...props}
      >
        {icon && (
          <div className="flex items-center justify-center w-16 h-16 rounded-full bg-muted/50 text-muted-foreground">
            {icon}
          </div>
        )}
        <div className="space-y-2">
          <h3 className="text-lg font-medium text-foreground">{title}</h3>
          {description && (
            <p className="text-sm text-muted-foreground max-w-sm">
              {description}
            </p>
          )}
        </div>
        {action && (
          <div className="pt-2">
            {action}
          </div>
        )}
      </div>
    );
  }
);
EmptyState.displayName = "EmptyState";

export { EmptyState };