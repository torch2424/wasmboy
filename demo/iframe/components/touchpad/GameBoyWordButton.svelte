<script>
  export let content = '';
</script>

<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
  <defs>
  <radialGradient id="ButtonBackgroundFill" cx="0.5" cy="0.5" r="0.75" fx="0.5" fy="0.95">
  <stop offset="0%" stop-color="rgba(255, 255, 255, 0.5)" stop-opacity="0.5" />
  <stop offset="100%" stop-color="rgba(255, 255, 255, 0.5)" stop-opacity="0.5" />
  </radialGradient>
  <radialGradient id="ButtonLetterFill" cx="0.5" cy="0.5" r="0.75" fx="0.5" fy="0.95">
  <stop offset="0%" stop-color="rgba(150, 150, 150, 0.25)" stop-opacity="0.25" />
  <stop offset="100%" stop-color="rgba(150, 150, 150, 0.25)" stop-opacity="0.25" />
  </radialGradient>
  <radialGradient id="ButtonLetterStroke" cx="0.5" cy="0.5" r="0.75" fx="0.5" fy="0.75">
  <stop offset="0%" stop-color="rgba(200, 200, 200, 0.25)" stop-opacity="0.25" />
  <stop offset="75%" stop-color="rgba(200, 200, 200, 0.25)" stop-opacity="0.25" />
  <stop offset="100%" stop-color="rgba(200, 200, 200, 0.25)" stop-opacity="0.25" />
  </radialGradient>
  </defs>
  <rect x="0" y="50" width="100" height="50" rx="50%" ry="50%" fill="url(#ButtonBackgroundFill)" />
  <text x="20" y="85" fill="url(#ButtonLetterFill)" stroke="url(#ButtonLetterStroke)">
  {content}
  </text>
</svg>


<style>
  svg {
    width: 100%;
    height: 100%;
  }
</style>
