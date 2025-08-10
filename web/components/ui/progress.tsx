"use client";
/* eslint-disable jsx-a11y/aria-proptypes */

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
        className={cn("relative h-2 w-full overflow-hidden rounded-full bg-muted", className)}
        {...props}
      >
        {/* Native progress element for semantics only; no inner text to avoid hydration mismatch */}
        <progress value={clamped} max={100} className="sr-only" aria-hidden="true" />
        <div
          className="h-full w-full flex-1 rounded-full bg-primary transition-all"
          style={{ transform: `translateX(-${100 - clamped}%)` }}
        />
      </div>
    );
  }
);

Progress.displayName = "Progress";

export default Progress;


