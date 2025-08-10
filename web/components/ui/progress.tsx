"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  value?: number; // 0-100
}

export const Progress = React.forwardRef<HTMLDivElement, ProgressProps>(
  ({ className, value = 0, ...props }, ref) => {
    const numeric = Number(value);
    const clamped = Math.max(0, Math.min(100, Number.isFinite(numeric) ? numeric : 0));
    return (
      <div
        ref={ref}
        role="progressbar"
        aria-valuemin={0 as unknown as number}
        aria-valuemax={100 as unknown as number}
        aria-valuenow={Math.round(clamped) as unknown as number}
        className={cn("relative h-2 w-full overflow-hidden rounded-full bg-muted", className)}
        {...props}
      >
        <div
          className="h-full w-full flex-1 rounded-full bg-primary transition-all"
          data-progress={clamped}
          style={{ transform: `translateX(-${100 - clamped}%)` }}
        />
      </div>
    );
  }
);

Progress.displayName = "Progress";

export default Progress;


