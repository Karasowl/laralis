'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import {
  MobileModal,
  MobileModalContent,
  MobileModalHeader,
  MobileModalTitle,
  MobileModalDescription,
  MobileModalBody,
  MobileModalFooter,
  MobileModalTrigger,
} from '@/components/ui/mobile-modal';

interface FormModalProps {
  // Modal state
  open: boolean;
  onOpenChange: (open: boolean) => void;

  // Header
  title: string;
  description?: string;

  // Trigger (optional - if not provided, control externally)
  trigger?: React.ReactNode;

  // Form
  children: React.ReactNode;
  onSubmit?: (e: React.FormEvent) => void | Promise<void>;

  // Footer actions
  cancelLabel?: string;
  submitLabel?: string;
  isSubmitting?: boolean;
  showFooter?: boolean;

  // Secondary action (e.g., "Save & Add Another")
  secondaryAction?: {
    label: string;
    onClick: (e: React.FormEvent) => void | Promise<void>;
  };

  // Styling
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  className?: string;
  // Radix Dialog modal prop (blocks background scroll when true)
  modal?: boolean;
}

export function FormModal({
  open,
  onOpenChange,
  title,
  description,
  trigger,
  children,
  onSubmit,
  cancelLabel = 'Cancel',
  submitLabel = 'Save',
  isSubmitting = false,
  showFooter = true,
  secondaryAction,
  maxWidth = 'lg',
  className,
  modal = true,
}: FormModalProps) {
  // Track which button triggered the submit (for showing correct spinner)
  const [activeSubmit, setActiveSubmit] = React.useState<'primary' | 'secondary' | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setActiveSubmit('primary');
    try {
      if (onSubmit) {
        await onSubmit(e);
      }
    } finally {
      setActiveSubmit(null);
    }
  };

  const handleSecondarySubmit = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!secondaryAction) return;
    setActiveSubmit('secondary');
    try {
      await secondaryAction.onClick(e as unknown as React.FormEvent);
    } finally {
      setActiveSubmit(null);
    }
  };

  const maxWidthClass = {
    sm: 'sm:max-w-sm',
    md: 'sm:max-w-md',
    lg: 'sm:max-w-lg',
    xl: 'sm:max-w-xl',
    '2xl': 'sm:max-w-2xl',
  }[maxWidth];

  const modalContent = (
    <MobileModalContent className={`${maxWidthClass} ${className || ''} max-h-[90vh] overflow-hidden`}>
      <MobileModalHeader className="flex-shrink-0">
        <MobileModalTitle>{title}</MobileModalTitle>
        {description ? (
          <MobileModalDescription>{description}</MobileModalDescription>
        ) : (
          <MobileModalDescription className="sr-only">
            Dialog content
          </MobileModalDescription>
        )}
      </MobileModalHeader>

      {showFooter ? (
        <form onSubmit={handleSubmit} id="form-modal" className="flex flex-col flex-1 overflow-hidden">
          <MobileModalBody className="flex-1 overflow-y-auto">{children}</MobileModalBody>

          <MobileModalFooter className="flex-shrink-0 border-t pt-4">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting || activeSubmit !== null}
              className="w-full sm:w-auto"
            >
              {cancelLabel}
            </Button>
            {secondaryAction && (
              <Button
                type="button"
                variant="outline"
                onClick={handleSecondarySubmit}
                disabled={isSubmitting || activeSubmit !== null}
                className="w-full sm:w-auto"
              >
                {activeSubmit === 'secondary' && (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                )}
                {secondaryAction.label}
              </Button>
            )}
            <Button
              type="submit"
              disabled={isSubmitting || activeSubmit !== null}
              className="w-full sm:w-auto"
            >
              {(isSubmitting || activeSubmit === 'primary') && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              {submitLabel}
            </Button>
          </MobileModalFooter>
        </form>
      ) : (
        <MobileModalBody>{children}</MobileModalBody>
      )}
    </MobileModalContent>
  );

  if (trigger) {
    return (
      <MobileModal open={open} onOpenChange={onOpenChange} modal={modal}>
        <MobileModalTrigger asChild>{trigger}</MobileModalTrigger>
        {modalContent}
      </MobileModal>
    );
  }

  return (
    <MobileModal open={open} onOpenChange={onOpenChange} modal={modal}>
      {modalContent}
    </MobileModal>
  );
}

// Convenience wrapper for simple dialogs without forms
interface SimpleModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  trigger?: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  className?: string;
}

export function SimpleModal({
  open,
  onOpenChange,
  title,
  description,
  children,
  trigger,
  maxWidth = 'lg',
  className,
}: SimpleModalProps) {
  const maxWidthClass = {
    sm: 'sm:max-w-sm',
    md: 'sm:max-w-md',
    lg: 'sm:max-w-lg',
    xl: 'sm:max-w-xl',
    '2xl': 'sm:max-w-2xl',
  }[maxWidth];

  const modalContent = (
    <MobileModalContent className={`${maxWidthClass} ${className || ''}`}>
      <MobileModalHeader>
        <MobileModalTitle>{title}</MobileModalTitle>
        {description ? (
          <MobileModalDescription>{description}</MobileModalDescription>
        ) : (
          <MobileModalDescription className="sr-only">
            Dialog content
          </MobileModalDescription>
        )}
      </MobileModalHeader>
      
      <MobileModalBody>{children}</MobileModalBody>
    </MobileModalContent>
  );

  if (trigger) {
    return (
      <MobileModal open={open} onOpenChange={onOpenChange}>
        <MobileModalTrigger asChild>{trigger}</MobileModalTrigger>
        {modalContent}
      </MobileModal>
    );
  }

  return (
    <MobileModal open={open} onOpenChange={onOpenChange}>
      {modalContent}
    </MobileModal>
  );
}
