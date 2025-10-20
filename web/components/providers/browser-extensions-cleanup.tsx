'use client'

import Script from 'next/script'

export function BrowserExtensionsCleanup() {
  return (
    <Script
      id="browser-extensions-cleanup"
      strategy="afterInteractive"
      dangerouslySetInnerHTML={{
        __html: `
          (function() {
            // PERFORMANCE FIX: Remove browser extension attributes with throttling
            let cleanupTimeout = null;
            let observersDisconnected = false;

            function cleanupExtensionAttributes() {
              // Throttle: only run once per 500ms
              if (cleanupTimeout) return;

              cleanupTimeout = setTimeout(() => {
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

                cleanupTimeout = null;
              }, 500);
            }

            // Run immediately
            cleanupExtensionAttributes();

            // Run on DOM ready (cleanup not needed since DOMContentLoaded only fires once)
            if (document.readyState === 'loading') {
              document.addEventListener('DOMContentLoaded', cleanupExtensionAttributes, { once: true });
            }

            // PERFORMANCE FIX: Observe for 30 seconds max, then disconnect
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

              // PERFORMANCE FIX: Disconnect after 30s (extensions have already loaded by then)
              setTimeout(() => {
                if (!observersDisconnected) {
                  observer.disconnect();
                  bodyObserver.disconnect();
                  observersDisconnected = true;
                  console.log('[Performance] Extension cleanup observers disconnected after 30s');
                }
              }, 30000);
            }
          })();
        `
      }}
    />
  )
}