// Inspired / Forked from:
// https://github.com/59naga/pixel-to-svg

class Pixel {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.width = 1;
    this.height = 1;
  }

  toPathD() {
    // 1 pixel = <path d='M0,0 h1 v1 h-1 z'>
    return 'M' + this.x + ',' + this.y + 'h' + this.width + 'v' + this.height + 'h-' + this.width + 'Z';
  }
}

class PixelPath {
  constructor() {
    this.lines = {};
  }

  drawPoints(points) {
    points.forEach(point => {
      // points to line
      let continualLine = this.lines[`${point.x - 1},${point.y}`];

      if (continualLine) {
        continualLine.width++;
        this.lines[`${point.x},${point.y}`] = continualLine;
      } else {
        this.lines[`${point.x},${point.y}`] = new Pixel(point.x, point.y);
      }
    });
  }

  toElement() {
    let d = '';
    let rendered = [];
    let rects = {};
    let history = {};

    for (let point in this.lines) {
      let line = this.lines[point];

      if (rendered.indexOf(line) > -1) {
        continue;
      }

      let { x, y, width } = line;
      let continualRect = history[`${x},${y - 1}`];
      if (continualRect && continualRect.width === width) {
        continualRect.height++;
        history[`${x},${y}`] = continualRect;
      } else {
        rects[`${x},${y}`] = line;
        history[`${x},${y}`] = line;
      }
      rendered.push(line);
    }

    for (let point in rects) {
      d += rects[point].toPathD();
    }

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', d);

    return path;
  }
}

export default function(width, height, byteMemory, frameLocation) {
  let svg;
  const createSvg = () => {
    svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    svg.setAttribute('shape-rendering', 'crispEdges');
  };
  createSvg();

  // Create our svg group
  let g = document.createElementNS('http://www.w3.org/2000/svg', 'g');

  // Assume the most common color as the background. Should help in rendering time.
  let commonBg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  commonBg.setAttribute('x', '0');
  commonBg.setAttribute('y', '0');
  commonBg.setAttribute('width', '160');
  commonBg.setAttribute('height', '144');
  commonBg.setAttribute('style', 'z-index: -100');

  // Organizing by colors so we can draw one at a time
  // And do some better batch processing
  let pointsSortedByColor = {};

  const loopPixels = () => {
    for (let x = 0; x < width; x++) {
      for (let y = 0; y < height; y++) {
        // Each color has an R G B component
        // In the passed rgba component
        let pixelStart = (y * width + x) * 3;

        // Get the rgba fill of the pixel
        let r = byteMemory[frameLocation + pixelStart + 0];
        let g = byteMemory[frameLocation + pixelStart + 1];
        let b = byteMemory[frameLocation + pixelStart + 2];

        let rgba = `rgba(${r}, ${g}, ${b}, 255)`;

        // Add the color to our points if we havent seen the color before
        if (!pointsSortedByColor[rgba]) {
          pointsSortedByColor[rgba] = [];
        }

        // Push the point onto the color
        pointsSortedByColor[rgba].push({
          x,
          y
        });
      }
    }
  };
  loopPixels();

  // Set the most popular color as our bg, and remove it from the points
  let popularRgba;
  Object.keys(pointsSortedByColor).forEach(rgba => {
    if (!popularRgba || pointsSortedByColor[rgba] > pointsSortedByColor[popularRgba]) {
      popularRgba = rgba;
    }
  });
  commonBg.setAttribute('fill', popularRgba);
  g.appendChild(commonBg);

  delete pointsSortedByColor[popularRgba];

  // Get our pixel paths per color
  const pixelPathsSortedByColor = {};
  Object.keys(pointsSortedByColor).forEach(colorKey => {
    pixelPathsSortedByColor[colorKey] = new PixelPath();
    pixelPathsSortedByColor[colorKey].drawPoints(pointsSortedByColor[colorKey]);

    let pathElement = pixelPathsSortedByColor[colorKey].toElement();
    pathElement.setAttribute('fill', colorKey);
    g.appendChild(pathElement);
  });

  svg.appendChild(g);
  return svg;
}
