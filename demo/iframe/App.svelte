<script>
  import PlayPoster from './components/PlayPoster.svelte'; 
  import WasmBoy from './components/WasmBoy.svelte'; 
  import Modal from './components/Modal.svelte';
  import ControlsBar from './components/ControlsBar.svelte'; 
  import {isStarted, isLoaded} from './stores.js';

  import loadScript from 'load-script';

  // Load our analytics
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
</script>

<main class="app">
  {#if $isStarted === false}
    <PlayPoster />
  {:else}
    <WasmBoy />
    {#if $isLoaded}
      <Modal />
      <ControlsBar />
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
