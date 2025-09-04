'use client'

import Script from 'next/script'

export function BrowserExtensionsCleanup() {
  return (
    <Script
      id="browser-extensions-cleanup"
      strategy="beforeInteractive"
      dangerouslySetInnerHTML={{
        __html: `
          (function() {
            // Remove browser extension attributes immediately
            function cleanupExtensionAttributes() {
              const extensionAttrs = [
                'data-new-gr-c-s-check-loaded',
                'data-gr-ext-installed', 
                'data-gr-ext-disabled',
                'data-gr-ext-css-loaded'
              ];
              
              extensionAttrs.forEach(attr => {
                document.documentElement.removeAttribute(attr);
                document.body && document.body.removeAttribute(attr);
              });
            }
            
            // Run immediately
            cleanupExtensionAttributes();
            
            // Run on DOM ready
            if (document.readyState === 'loading') {
              document.addEventListener('DOMContentLoaded', cleanupExtensionAttributes);
            }
            
            // Observe for new attributes
            if (typeof MutationObserver !== 'undefined') {
              const observer = new MutationObserver(cleanupExtensionAttributes);
              observer.observe(document.documentElement, {
                attributes: true,
                attributeFilter: [
                  'data-new-gr-c-s-check-loaded',
                  'data-gr-ext-installed',
                  'data-gr-ext-disabled', 
                  'data-gr-ext-css-loaded'
                ]
              });
              
              // Also observe body when it's available
              const bodyObserver = new MutationObserver(() => {
                if (document.body) {
                  observer.observe(document.body, {
                    attributes: true,
                    attributeFilter: [
                      'data-new-gr-c-s-check-loaded',
                      'data-gr-ext-installed',
                      'data-gr-ext-disabled',
                      'data-gr-ext-css-loaded'
                    ]
                  });
                  bodyObserver.disconnect();
                }
              });
              bodyObserver.observe(document.documentElement, {
                childList: true
              });
            }
          })();
        `
      }}
    />
  )
}