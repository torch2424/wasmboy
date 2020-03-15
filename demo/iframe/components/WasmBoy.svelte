<script>
  import { onMount } from 'svelte';
  import {isStarted, isLoaded, isPlaying, romUrl, romName, saveState, setStatus} from '../stores.js';
  import {WasmBoy} from '../../../dist/wasmboy.wasm.esm.js';

  let mountResolve;
  let mountPromise = new Promise(resolve => {
    mountResolve = resolve;
  });
  onMount(mountResolve);

  let canvasStyle = 'display: none';

  const loadWasmBoy = async () => {
    await mountPromise;

    const wasmBoyCanvas = document.querySelector('.canvas-container > canvas');

    const EmbedPlugin = {
      name: 'EmbedPlugin',
      saveState: saveStateObject => {
        if (wasmBoyCanvas) {
          saveStateObject.screenshotCanvasDataURL = wasmBoyCanvas.toDataURL();
        }
      },
      play: () => isPlaying.set(true),
      pause: () => {
        isPlaying.set(false);
        setStatus('Paused', -1);
      }
    };

    await WasmBoy.config({
      isGbcEnabled: true,
      isGbcColorizationEnabled: true,
      isAudioEnabled: true,
      gameboyFrameRate: 60,
      maxNumberOfAutoSaveStates: 3
    });

    await WasmBoy.setCanvas(wasmBoyCanvas);
    WasmBoy.addPlugin(EmbedPlugin);
    await WasmBoy.loadROM($romUrl);
    await WasmBoy.play();

    canvasStyle = 'display: block';
    isLoaded.set(true)
    isPlaying.set(true);
  }
  const wasmBoyPromise = loadWasmBoy().catch(error => {
    console.error(error);
    throw error;
  });

  isPlaying.subscribe(async (value) => {
    if(!WasmBoy.isPlaying() && value) {
      await WasmBoy.play();
    } else if (WasmBoy.isPlaying() && !value) {
      await WasmBoy.pause();
    }
  });

  saveState.subscribe(() => {
    if ($isStarted && $isLoaded) {
      WasmBoy.saveState().then(() => {
        WasmBoy.play();
        setStatus('State Saved!');
      }).catch(() => {
        setStatus('Error saving the state...')
      });
    }
  });
</script>

<div class="canvas-container" style={canvasStyle}>
  <canvas />
</div>

{#if $isLoaded === false}
<div class="status">
  {#await wasmBoyPromise}
    {#if $romName}
      <h2>Loading {$romName} ...</h2>
    {:else}
      <h2>Loading...</h2>
    {/if}
    <div class="donut"></div>
  {:catch error}
    <div class="error">
      {#if $romName}
        <h2>Error loading {$romName} ...</h2>
      {:else}
        <h3>Error!</h3>
      {/if}
      <h3>{error.message}</h3>
    </div>
  {/await}
</div>
{/if}

<style>
  .canvas-container {
    width: 100%;
    height: 100%;

    background-color: #000;
  }

  .canvas-container > canvas {
    width: 100%;
    height: 100%;
  }

  :global(.touchpad-visible.portrait) .canvas-container > canvas {
    width: 100%;
    height: 300px;
  }

  :global(.touchpad-visible.landscape) .canvas-container > canvas {
    width: 100%;
    height: calc(100% - 50px);
  }

  .status {
    width: 100%;
    height: 100%;

    text-align: center;

    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
  }
</style>
