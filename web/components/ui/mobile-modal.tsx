'use client';

import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { cn } from '@/lib/utils';
import { X } from 'lucide-react';

const MobileModal = DialogPrimitive.Root;

const MobileModalTrigger = DialogPrimitive.Trigger;

const MobileModalPortal = DialogPrimitive.Portal;

const MobileModalClose = DialogPrimitive.Close;

const MobileModalOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-50 bg-black/50 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className
    )}
    {...props}
  />
));
MobileModalOverlay.displayName = DialogPrimitive.Overlay.displayName;

const MobileModalContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & {
    hideCloseButton?: boolean;
  }
>(({ className, children, hideCloseButton = false, ...props }, ref) => (
  <MobileModalPortal>
    <MobileModalOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        // Mobile-first design with slide-up animation
        "fixed z-50 grid w-full gap-4 bg-background shadow-2xl transition ease-in-out data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:duration-300 data-[state=open]:duration-500",
        // Mobile: Full screen with rounded top corners
        "inset-x-0 bottom-0 max-h-[95vh] rounded-t-[20px] border-t data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom",
        // Tablet and desktop: Centered modal
        "sm:inset-auto sm:left-[50%] sm:top-[50%] sm:max-h-[90vh] sm:w-full sm:max-w-lg sm:translate-x-[-50%] sm:translate-y-[-50%] sm:rounded-2xl sm:border sm:data-[state=closed]:fade-out-0 sm:data-[state=open]:fade-in-0 sm:data-[state=closed]:zoom-out-95 sm:data-[state=open]:zoom-in-95 sm:data-[state=closed]:slide-out-to-left-1/2 sm:data-[state=closed]:slide-out-to-top-[48%] sm:data-[state=open]:slide-in-from-left-1/2 sm:data-[state=open]:slide-in-from-top-[48%]",
        className
      )}
      {...props}
    >
      {/* Pull indicator for mobile */}
      <div className="mx-auto h-1 w-12 rounded-full bg-muted sm:hidden mt-2" />
      
      {children}
      
      {!hideCloseButton && (
        <DialogPrimitive.Close className="absolute right-4 top-4 rounded-full opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground">
          <X className="h-5 w-5" />
          <span className="sr-only">Close</span>
        </DialogPrimitive.Close>
      )}
    </DialogPrimitive.Content>
  </MobileModalPortal>
));
MobileModalContent.displayName = DialogPrimitive.Content.displayName;

const MobileModalHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col space-y-1.5 text-center sm:text-left px-6 pt-4 pb-2",
      className
    )}
    {...props}
  />
);
MobileModalHeader.displayName = "MobileModalHeader";

const MobileModalFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col-reverse gap-2 px-6 pb-6 pt-4 sm:flex-row sm:justify-end sm:space-x-2",
      className
    )}
    {...props}
  />
);
MobileModalFooter.displayName = "MobileModalFooter";

const MobileModalTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn(
      "text-lg font-semibold leading-none tracking-tight",
      className
    )}
    {...props}
  />
));
MobileModalTitle.displayName = DialogPrimitive.Title.displayName;

const MobileModalDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
));
MobileModalDescription.displayName = DialogPrimitive.Description.displayName;

const MobileModalBody = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex-1 overflow-y-auto px-6 py-4 max-h-[60vh] sm:max-h-[70vh]",
      className
    )}
    {...props}
  />
);
MobileModalBody.displayName = "MobileModalBody";

export {
  MobileModal,
  MobileModalPortal,
  MobileModalOverlay,
  MobileModalClose,
  MobileModalTrigger,
  MobileModalContent,
  MobileModalHeader,
  MobileModalFooter,
  MobileModalTitle,
  MobileModalDescription,
  MobileModalBody,
};