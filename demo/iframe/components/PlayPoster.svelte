<script>
  import {isStarted, playPoster} from '../stores.js';

  function handlePlay() {
    isStarted.set(true);
  }
</script>

<div class="play-poster">
  {#if $playPoster}
    <img class="play-poster__image" src={$playPoster} alt="Wasm boy play poster">
  {/if}

  <div class="play-poster__shade"></div>

  <button class="play-poster__play-button" on:click={handlePlay}>
    <!-- Google Material Play Icon -->
    <!-- https://material.io/resources/icons -->
    <svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 0 24 24" width="24">
      <path d="M8 5v14l11-7z" fill="#fff" />
      <path d="M0 0h24v24H0z" fill="none"/>
    </svg>
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

    background-color: rgba(0,0,0,0.75);
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

