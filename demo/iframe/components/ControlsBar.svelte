<script>
  import {isPlaying, setStatus, status, triggerSaveState, showLoadState, showAbout} from '../stores.js';
  import PlayIcon from './icons/PlayIcon.svelte';
  import PauseIcon from './icons/PauseIcon.svelte';
  import SaveIcon from './icons/SaveIcon.svelte';
  import LoadIcon from './icons/LoadIcon.svelte';
  import AboutIcon from './icons/AboutIcon.svelte';

  // Subscribe to our current status
  let displayStatus = false;
  let statusTimeout;
  // Subscribe to status changes, and show the status message
  // on changes
  status.subscribe(value => {

    if (statusTimeout) {
      clearTimeout(statusTimeout);
    }

    displayStatus = true;

    if (value.timeout < 0) {
      return false;
    }

    statusTimeout = setTimeout(() => {
      displayStatus = false;
      statusTimeout = undefined;
    }, value.timeout)
  });

  const handlePlayPause = () => {
    if ($isPlaying) {
      isPlaying.set(false);
      setStatus('Paused', -1);
    } else {
      isPlaying.set(true);
      setStatus('Playing!');
    }
  };

  const handleSave = () => {
    triggerSaveState();
  };

  const handleLoad = () => {
    showLoadState();
  };

  const handleAbout = () => {
    showAbout();
  };
</script>

<footer class="controls-bar">
  {#if displayStatus}
    <div class="status">{$status.message}</div>
  {/if}

  <ul class="controls-buttons">
    <li>
      <button class="icon-button" on:click={handlePlayPause}>
        {#if $isPlaying}
          <PauseIcon />
        {:else}
          <PlayIcon />
        {/if}
      </button>
    </li>

    <li>
      <button class="icon-button" on:click={handleSave}>
        <SaveIcon />
      </button>
    </li>

    <li>
      <button class="icon-button" on:click={handleLoad}>
        <LoadIcon />
      </button>
    </li>

    <li>
      <button class="icon-button" on:click={handleAbout}>
        <AboutIcon />
      </button>
    </li>
  </ul>
</footer>

<style>

  .controls-bar {
    position: fixed;
    bottom: 0;
    right: 0;
    width: 100%;
    height: 100%;

    transform: translateY(0px);
    transition: transform 0.5s;
  }

  :global(html):hover .controls-bar, :global(body):hover .controls-bar {
    transform: translateY(-50px);
  }

  .status, .controls-buttons {
    position: absolute;
    bottom: 0;
    right: 0;
    background-color: rgba(0,0,0,0.85);
  }

  .status {
    display: flex;
    justify-content: center;
    align-items: center;
    text-align: center;

    padding: 20px;

    color: #fff;

    z-index: 1;
  }

  .controls-buttons {
    display: flex;
    justify-content: space-around;
    align-items: center;

    list-style-type: none;

    transform: translateY(50px);
    height: 50px;
    width: 100%;
    margin: 0px;
    padding: 0px;
  }
</style>
