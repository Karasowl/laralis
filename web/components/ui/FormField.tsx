import * as React from "react";
import { cn } from "@/lib/utils";
import { Label } from "./label";

export interface FormFieldProps extends React.HTMLAttributes<HTMLDivElement> {
  label: string;
  description?: string;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
}

const FormField = React.forwardRef<HTMLDivElement, FormFieldProps>(
  ({ className, label, description, error, required, children, ...props }, ref) => {
    const fieldId = React.useId();
    const descriptionId = description ? `${fieldId}-description` : undefined;
    const errorId = error ? `${fieldId}-error` : undefined;

    return (
      <div
        ref={ref}
        className={cn("space-y-2", className)}
        {...props}
      >
        <Label htmlFor={fieldId} className="text-sm font-medium">
          {label}
          {required && (
            <span className="text-destructive ml-1" aria-label="required">
              *
            </span>
          )}
        </Label>
        
        {description && (
          <p
            id={descriptionId}
            className="text-sm text-muted-foreground"
          >
            {description}
          </p>
        )}
        
        <div>
          {React.cloneElement(children as React.ReactElement, {
            id: fieldId,
            "aria-describedby": cn(descriptionId, errorId).trim() || undefined,
            "aria-invalid": error ? "true" : undefined,
            className: cn(
              error && "border-destructive focus-visible:ring-destructive",
              (children as React.ReactElement).props?.className
            ),
          })}
        </div>
        
        {error && (
          <p
            id={errorId}
            className="text-sm text-destructive"
            role="alert"
          >
            {error}
          </p>
        )}
      </div>
    );
  }
);
FormField.displayName = "FormField";

export { FormField };