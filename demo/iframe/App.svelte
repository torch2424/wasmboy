<script>

  import PlayPoster from './components/PlayPoster.svelte'; 
  import WasmBoy from './components/WasmBoy.svelte'; 
  import ControlsBar from './components/ControlsBar.svelte'; 

  import {isStarted, isLoaded} from './stores.js';
</script>

<main class="app">
  {#if $isStarted === false}
    <PlayPoster />
  {:else}
    <WasmBoy />
    {#if $isLoaded}
      <ControlsBar />
    {/if}
  {/if}
</main>

<style>
  .app {
    width: 100%;
    height: 100%;
  }
</style>
