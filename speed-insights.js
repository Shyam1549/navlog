// Vercel Speed Insights initialization
// This script loads and initializes Vercel Speed Insights for performance monitoring

(function() {
  'use strict';
  
  // Initialize the Speed Insights queue
  if (window.si) return;
  
  window.si = function() {
    (window.siq = window.siq || []).push(arguments);
  };
  
  // Create and inject the Speed Insights script
  const script = document.createElement('script');
  script.src = '/_vercel/speed-insights/script.js';
  script.defer = true;
  script.setAttribute('data-sdkn', '@vercel/speed-insights');
  script.setAttribute('data-sdkv', '1.3.1');
  
  // Inject the script into the document head
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      document.head.appendChild(script);
    });
  } else {
    document.head.appendChild(script);
  }
})();
