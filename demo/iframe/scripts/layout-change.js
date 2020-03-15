import devtoolsDetect from 'devtools-detect';

// Add all of our layout events
let layoutChangeThrottle = undefined;

export const setupLayoutChange = () => {
  // devtools change for mobile
  // uses devtools-detect
  window.addEventListener('devtoolschange', e => {
    handleLayoutChange();
  });

  window.addEventListener('resize', () => {
    if (layoutChangeThrottle) {
      return;
    }

    layoutChangeThrottle = setTimeout(() => {
      handleLayoutChange();
      layoutChangeThrottle = undefined;
    }, 500);
  });

  window.addEventListener('orientationchange', () => {
    if (layoutChangeThrottle) {
      return;
    }

    layoutChangeThrottle = setTimeout(() => {
      handleLayoutChange();
      layoutChangeThrottle = undefined;
    }, 500);
  });
};

const handleLayoutChange = () => {
  const isDevtoolsOpen = devtoolsDetect.open;

  let isWide = window.matchMedia('(max-width: 500px)').matches;

  if (!isDevtoolsOpen) {
    isWide = window.matchMedia('(max-width: 1024px)').matches;
  }

  let landscape = window.matchMedia('screen and (orientation: landscape)').matches;
  let portrait = window.matchMedia('screen and (orientation: portrait)').matches;

  // Get our document class list
  const documentClassList = document.documentElement.classList;

  // Add all Media query based on mobile vs desktop
  documentClassList.add('mobile');

  if (landscape) {
    documentClassList.add('landscape');
    documentClassList.remove('portrait');
  } else if (portrait) {
    documentClassList.add('portrait');
    documentClassList.remove('landscape');
  }

  if (!landscape && !portrait && isWide) {
    documentClassList.add('landscape');
    documentClassList.remove('portrait');
  }
};
// Handle the layoutchange onn load
handleLayoutChange();
