import loadScript from 'load-script';

// Load our analytics
export const loadAnalytics = () => {
  if (typeof window !== 'undefined') {
    loadScript('https://www.googletagmanager.com/gtag/js?id=UA-125276735-3', (err, script) => {
      if (err) {
        console.error(err);
        return;
      }

      window.dataLayer = window.dataLayer || [];
      function gtag() {
        window.dataLayer.push(arguments);
      }
      gtag('js', new Date());
      gtag('config', 'UA-125276735-3');
    });
  }
};
