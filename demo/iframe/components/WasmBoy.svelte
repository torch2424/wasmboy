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

    await WasmBoy.config({
      isGbcEnabled: true,
      isGbcColorizationEnabled: true,
      isAudioEnabled: true,
      gameboyFrameRate: 60,
      maxNumberOfAutoSaveStates: 3,
      onPlay: () => {
        isPlaying.set(true);
      },
      onPause: () => {
        isPlaying.set(false);
        setStatus('Paused', -1);
      }
    });

    await WasmBoy.setCanvas(wasmBoyCanvas);
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
  }

  .canvas-container > canvas {
    width: 100%;
    height: 100%;
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

  /* https://www.30secondsofcode.org/css/s/donut-spinner/ */
  @keyframes donut-spin {
    0% {
      transform: rotate(0deg);
    }
    100% {
      transform: rotate(360deg);
    }
  }

  .donut {
    display: inline-block;
    border: 4px solid rgba(0, 0, 0, 0.1);
    border-left-color: #654ff0;
    border-radius: 50%;
    width: 50px;
    height: 50px;
    animation: donut-spin 1.2s linear infinite;
  }

  .error {
    color: red;
  }
</style>
