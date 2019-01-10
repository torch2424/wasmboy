// Buttons taken from mobile exapanded mode from
// Vaporboy
// https://vaporboy.net/
// https://github.com/torch2424/vaporBoy

import { h } from 'preact';

export const vaporboyExpandedDpad = (
  <svg id="cqmygconoq" viewBox="0 0 189 189" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <radialGradient id="ButtonBackgroundFill" cx="0.5" cy="0.5" r="0.75" fx="0.5" fy="0.95">
        <stop offset="0%" stop-color="rgba(255, 255, 255, 0.5)" stop-opacity="0.5" />
        <stop offset="100%" stop-color="rgba(255, 255, 255, 0.5)" stop-opacity="0.5" />
      </radialGradient>
      <linearGradient id="ButtonTriangleFillUp" x2="0%" y2="100%">
        <stop offset="0%" stop-color="rgba(175, 175, 175, 0.25)" stop-opacity="0.25" />
        <stop offset="100%" stop-color="rgba(175, 175, 175, 0.25)" stop-opacity="0.25" />
      </linearGradient>
      <linearGradient id="ButtonTriangleFillDown" x2="0%" y2="100%">
        <stop offset="0%" stop-color="rgba(175, 175, 175, 0.25)" stop-opacity="0.25" />
        <stop offset="100%" stop-color="rgba(175, 175, 175, 0.25)" stop-opacity="0.25" />
      </linearGradient>
      <linearGradient id="ButtonTriangleFillHorizontal" x2="0%" y2="100%">
        <stop offset="0%" stop-color="rgba(175, 175, 175, 0.25)" stop-opacity="0.25" />
        <stop offset="75%" stop-color="rgba(175, 175, 175, 0.25)" stop-opacity="0.25" />
        <stop offset="100%" stop-color="rgba(175, 175, 175, 0.25)" stop-opacity="0.25" />
      </linearGradient>
      <linearGradient id="ButtonTriangleStroke" x2="0%" y2="100%">
        <stop offset="0%" stop-color="rgba(175, 175, 175, 0.25)" stop-opacity="0.25" />
        <stop offset="75%" stop-color="rgba(175, 175, 175, 0.25)" stop-opacity="0.25" />
        <stop offset="100%" stop-color="rgba(175, 175, 175, 0.25)" stop-opacity="0.25" />
      </linearGradient>
    </defs>
    <path
      d="M58,58 L58,8.00037538 C58,3.5859394 61.5833386,0 66.0036109,0 L122.996389,0 C127.417239,0 131,3.58189007 131,8.00037538 L131,58 L180.999625,58 C185.414061,58 189,61.5833386 189,66.0036109 L189,122.996389 C189,127.417239 185.41811,131 180.999625,131 L131,131 L131,180.999625 C131,185.414061 127.416661,189 122.996389,189 L66.0036109,189 C61.5827606,189 58,185.41811 58,180.999625 L58,131 L8.00037538,131 C3.5859394,131 0,127.416661 0,122.996389 L0,66.0036109 C0,61.5827606 3.58189007,58 8.00037538,58 L58,58 Z"
      fill="url(#ButtonBackgroundFill)"
    />
    <polygon points="75,45 115,45 95,10" fill="url(#ButtonTriangleFillUp)" stroke="url(#ButtonTriangleStroke)" />
    <polygon points="75,145 115,145 95,180" fill="url(#ButtonTriangleFillDown)" stroke="url(#ButtonTriangleStroke)" />
    <polygon points="10,95 46.5,115 45,75" fill="url(#ButtonTriangleFillHorizontal)" stroke="url(#ButtonTriangleStroke)" />
    <polygon points="180,95 143.5,115 145,75" fill="url(#ButtonTriangleFillHorizontal)" stroke="url(#ButtonTriangleStroke)" />
  </svg>
);

export const vaporboyExpandedBButton = (
  <svg id="qpdbmxqkpyh" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
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
    <rect x="0" y="0" width="100" height="100" rx="50%" ry="50%" fill="url(#ButtonBackgroundFill)" />
    <text x="25" y="80" fill="url(#ButtonLetterFill)" stroke="url(#ButtonLetterStroke)">
      B
    </text>
  </svg>
);

export const vaporboyExpandedAButton = (
  <svg id="ikwwjzch" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
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
    <rect x="0" y="0" width="100" height="100" rx="50%" ry="50%" fill="url(#ButtonBackgroundFill)" />
    <text x="25" y="80" fill="url(#ButtonLetterFill)" stroke="url(#ButtonLetterStroke)">
      A
    </text>
  </svg>
);

export const vaporboyExpandedStartButton = (
  <svg id="aanglxuazflmjs" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
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
      start
    </text>
  </svg>
);

export const vaporboyExpandedSelectButton = (
  <svg id="pfdzinzttcnualjg" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
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
      select
    </text>
  </svg>
);
