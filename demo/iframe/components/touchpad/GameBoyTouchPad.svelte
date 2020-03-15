<script>
  import { onMount, onDestroy } from 'svelte';
  import {modalStore, isTouchPadVisible} from '../../stores.js';

  import GameBoyDpad from './GameBoyDpad.svelte'; 
  import GameBoyLetterButton from './GameBoyLetterButton.svelte';
  import GameBoyWordButton from './GameBoyWordButton.svelte';

  import {WasmBoy} from '../../../../dist/wasmboy.wasm.esm.js';

  let mountResolve;
  let mountPromise = new Promise(resolve => {
    mountResolve = resolve;
  });
  onMount(mountResolve);

  // Subscribe to whether or not the touchpad is shown
  isTouchPadVisible.subscribe((value) => {
    // Get our document class list
    const documentClassList = document.documentElement.classList;
    
    if (value) {
      documentClassList.add('touchpad-visible');
    } else {
      documentClassList.remove('touchpad-visible');
    }
  });


  const removeInputCallbacks = [];
  const addWasmBoyInputs = async () => {

    // Wait to mount
    await mountPromise;

    // Get our touch input elements
    const dpadElement = document.querySelector('#gameboy-dpad');
    const startElement = document.querySelector('#gameboy-start');
    const selectElement = document.querySelector('#gameboy-select');
    const aElement = document.querySelector('#gameboy-a');
    const bElement = document.querySelector('#gameboy-b');

    // Add touch controls
    removeInputCallbacks.push(
      WasmBoy.ResponsiveGamepad.TouchInput.addDpadInput(dpadElement, {
        allowMultipleDirections: false
      })
    );
    removeInputCallbacks.push(
      WasmBoy.ResponsiveGamepad.TouchInput.addButtonInput(aElement, WasmBoy.ResponsiveGamepad.RESPONSIVE_GAMEPAD_INPUTS.A)
    );
    removeInputCallbacks.push(
      WasmBoy.ResponsiveGamepad.TouchInput.addButtonInput(bElement, WasmBoy.ResponsiveGamepad.RESPONSIVE_GAMEPAD_INPUTS.B)
    );
    removeInputCallbacks.push(
      WasmBoy.ResponsiveGamepad.TouchInput.addButtonInput(startElement, WasmBoy.ResponsiveGamepad.RESPONSIVE_GAMEPAD_INPUTS.START)
    );
    removeInputCallbacks.push(
      WasmBoy.ResponsiveGamepad.TouchInput.addButtonInput(selectElement, WasmBoy.ResponsiveGamepad.RESPONSIVE_GAMEPAD_INPUTS.SELECT)
    );
  };
  addWasmBoyInputs();

  onDestroy(() => {
    removeInputCallbacks.forEach(callback => callback());
  })
</script>

<div class="mobile-controls" style={$modalStore === 0 && $isTouchPadVisible === true ? '': 'display: none'}>
  <div class="gameboy-input">
    <div id="gameboy-dpad"><GameBoyDpad /></div>
    <div id="gameboy-a"><GameBoyLetterButton content="A" /></div>
    <div id="gameboy-b"><GameBoyLetterButton content="B" /></div>
    <div id="gameboy-start"><GameBoyWordButton content="start" /></div>
    <div id="gameboy-select"><GameBoyWordButton content="select" /></div>
  </div>
</div>

<style>
  /*GENERAL*/
  .mobile-controls {
    position: fixed;
    top: 0;
    left: 0;

    width: 100%;
    /* - px to make room for controls bar*/
    height: calc(100% - 50px);

    z-index: 3;
  }

  .gameboy-input {
    position: relative;
    top: 0;
    left: 0;

    height: 100%;
    width: 100%;
  }

  .gameboy-input :global(svg) {
    width: 100%;
    height: 100%;

    padding: 3px;
    overflow: visible;
    cursor: pointer;
  }

  .gameboy-input :global(svg) :global(path),
  .gameboy-input :global(svg) :global(rect) {
    stroke: #000;
    stroke-width: 2px;
  }

  .gameboy-input :global(svg) :global(text),
  .gameboy-input :global(svg) :global(polygon) {
    stroke: #000;
    stroke-width: 1px;
  }

  .gameboy-input :global(svg) :global(text) {
    font-size: 80px;
    font-weight: 700;
    text-transform: capitalize;
  }

  #gameboy-select :global(svg) :global(text),
  #gameboy-start :global(svg) :global(text) {
    font-size: 23px;
  }

  /*PORTRAIT*/
  :global(html.portrait) #gameboy-dpad {
    width: 37vw;
    height: 37vw;
    max-width: 170px;
    max-height: 170px;

    position: absolute;
    z-index: 1;
    bottom: 27.5%;
    left: 5%;
  }

  :global(html.portrait) #gameboy-b {
    width: 20vw;
    height: 20vw;
    max-width: 95px;
    max-height: 95px;

    position: absolute;
    z-index: 1;
    bottom: 27.5%;
    right: 21%;
  }

  :global(html.portrait) #gameboy-a {
    width: 20vw;
    height: 20vw;
    max-width: 95px;
    max-height: 95px;

    position: absolute;
    z-index: 1;
    bottom: 37.5%;
    right: 3%;
  }

  :global(html.portrait) #gameboy-select {
    width: 19.5vw;
    height: 19.5vw;
    max-width: 100px;
    max-height: 100px;

    position: absolute;
    z-index: 1;
    left: 25.5%;
    bottom: 13%;
  }

  :global(html.portrait) #gameboy-start {
    width: 19.5vw;
    height: 19.5vw;
    max-width: 100px;
    max-height: 100px;

    position: absolute;
    z-index: 1;
    left: 51.5%;
    bottom: 13%;
  }

  /*LANDSCAPE*/
  :global(html.landscape) #gameboy-dpad {
    width: 20vw;
    height: 20vw;
    position: absolute;
    z-index: 1;
    top: calc(50% - 13vw);
    left: 3%;
  }

  :global(html.landscape) #gameboy-b {
    width: 12vw;
    height: 12vw;
    position: absolute;
    z-index: 1;
    top: calc(50% - 5vw);
    right: 18%;
  }

  :global(html.landscape) #gameboy-a {
    width: 12vw;
    height: 12vw;
    position: absolute;
    z-index: 1;
    top: calc(50% - 13vw);
    right: 3%;
  }

  :global(html.landscape) #gameboy-select {
    width: 22.5vh;
    height: 22.5vh;
    position: absolute;
    z-index: 1;
    left: 30.5%;
    bottom: 7%;
  }

  :global(html.landscape) #gameboy-start {
    width: 22.5vh;
    height: 22.5vh;
    position: absolute;
    z-index: 1;
    left: 54.5%;
    bottom: 7%;
  }
</style>
