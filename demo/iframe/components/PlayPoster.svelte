<script>
  import {isStarted, playPoster} from '../stores.js';
  import PlayIcon from './icons/PlayIcon.svelte';
  import {WasmBoy} from '../../../dist/wasmboy.wasm.esm.js';

  function handlePlay() {
    // Calling resume Audio Context here, as it is always touched on mobile
    WasmBoy.resumeAudioContext();
    isStarted.set(true);
  }
</script>

<div class="play-poster">
  {#if $playPoster}
    <img class="play-poster__image" src={$playPoster} alt="Wasm boy play poster">
  {/if}

  <div class="play-poster__shade"></div>

  <button class="play-poster__play-button" on:click={handlePlay}>
    <PlayIcon />
  </button>
</div>

<style>
  .play-poster {
    position: relative;
    width: 100%;
    height: 100%;

    display: flex;
    justify-content: center;
    align-items: center;
  }

  .play-poster__image {
    position: absolute;
    left: 0;
    top: 0;
    width: 100%;
    height: 100%;

    z-index: -1;
    object-fit: cover;
  }

  .play-poster__shade {
    position: absolute;
    left: 0;
    top: 0;
    width: 100%;
    height: 100%;

    background-color: rgba(0,0,0,0.85);
  }

  .play-poster__play-button {
    background-color: transparent;
    border: none;

    width: 100%;
    height:100%;
    max-width: 300px;
    max-height: 300px;

    z-index: 1;
  }

  .play-poster__play-button svg {
    width: 100%;
    height: 100%;
  }
</style>

