<script>
  import PlayPoster from './components/PlayPoster.svelte'; 
  import WasmBoy from './components/WasmBoy.svelte'; 
  import Modal from './components/Modal.svelte';
  import ControlsBar from './components/ControlsBar.svelte';
  import GameBoyTouchPad from './components/touchpad/GameBoyTouchPad.svelte';
  import {isStarted, isLoaded} from './stores.js';

  import {setupLayoutChange} from './scripts/layout-change.js';
  import {setupHotkeys} from './scripts/hotkeys.js';
  import {loadAnalytics} from './scripts/load-analytics.js';

  setupLayoutChange();
  setupHotkeys();
  loadAnalytics();
</script>

<main class="app">
  {#if $isStarted === false}
    <PlayPoster />
  {:else}
    <WasmBoy />
    {#if $isLoaded}
      <Modal />
      <ControlsBar />
      <GameBoyTouchPad />
    {/if}
  {/if}
</main>

<style>
  .app {
    width: 100%;
    height: 100%;
  }

  :global(.icon-button) {
    width: 50px;
    height: 50px;
    background-color: transparent;
    border: none;
    cursor: pointer;
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

  :global(.donut) {
    display: inline-block;
    border: 4px solid rgba(0, 0, 0, 0.1);
    border-left-color: #654ff0;
    border-radius: 50%;
    width: 50px;
    height: 50px;
    animation: donut-spin 1.2s linear infinite;
  }

  :global(.error) {
    color: red;
  }
</style>
