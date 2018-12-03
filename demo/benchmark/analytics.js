import loadScript from 'load-script';

// Setup Google Analytics
if (typeof window !== 'undefined') {
  loadScript('https://www.googletagmanager.com/gtag/js?id=UA-125276735-2', function(err, script) {
    if (!err) {
      window.dataLayer = window.dataLayer || [];
      function gtag() {
        window.dataLayer.push(arguments);
      }
      gtag('js', new Date());
      gtag('config', 'UA-125276735-2');
      // Attach Analytics to window
      window.gtag = gtag;
    }
  });
}

export function sendAnalyticsEvent(eventName, eventParams) {
  // console.log('Sending Analytics Event:', eventName, eventParams);
  if (typeof window !== 'undefined' && window.gtag) {
    if (eventParams) {
      window.gtag('event', eventName, eventParams);
    } else {
      window.gtag('event', eventName);
    }
  }
}
