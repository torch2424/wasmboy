# wasmBoy-amp

An Experiment of using the WasmBoy TS Core inside of AMP

# Amp Script Notes

- Empty amp script wont build. Should default to a 1x1 to force build
- Need better docs on using the core
- Need to export helper functions used on the core into a seperate npm module
- Images are sanitized :p

This hack didnt work

```
// Create an svg with an image tag (hack around img bad list)
const svg = document.createElement('svg');
svg.setAttribute('width', 160);
svg.setAttribute('height', 144);
const image = document.createElement('image');
image.setAttribute('xlink:href', imageDataUrl);
image.setAttribute('x', 0);
image.setAttribute('y', 0);
image.setAttribute('width', 160);
image.setAttribute('height', 144);

svg.appendChild(image);
document.body.appendChild(svg);
```

- No classList on nodes
- Cant create amp-image with data uri
- c.replace is not a function :p
- Can't set attribute to a number
- Query selector on element not working?
- Couldn't add event listener to button unless I created it
- Can't append child to element gotten by id
- key down event only works on divs sometimes?
