<script>
  import {modalStore, hideModal} from '../stores';
  import LoadState from './LoadState.svelte';
  import About from './About.svelte';
  import CloseIcon from './icons/CloseIcon.svelte';

  const handleClose = () => {
    hideModal();
  }
</script>

{#if $modalStore > 0}
  <dialog>

  <div class="modal-header">
      {#if $modalStore === 1}
        <h2>Load State</h2>
      {:else if $modalStore === 2}
        <h2>About</h2>
      {/if}

      <button class="icon-button" on:click={handleClose}>
        <CloseIcon />
      </button>
    </div>

    <div class="modal-content">
      {#if $modalStore === 1}
        <LoadState />
      {:else if $modalStore === 2}
        <About />
      {/if}
    </div>
  </dialog>
{/if}

<style>
  dialog {
    width: calc(100% - 50px);
    height: 800px;
    max-width: 800px;
    max-height: calc(100% - 100px);
    margin-top: 10px;
    margin-left: auto;
    margin-right: auto;

    position: fixed;
    top: 0;
    left: 0;
    z-index: 2;

    display: flex;
    flex-direction: column;
    justify-content: flex-start;
    align-items: center;

    background-color: rgba(0,0,0,0.85);

    border-radius: 5px;
  }

  .modal-header {
    width: 100%;
    display: flex;
    justify-content: flex-end;
    align-items: center;
  }

  .modal-header > h2 {
    margin-right: auto;
    color: #fff;
  }

  .modal-content {
    width: 100%;
    height: 100%;
    flex: 1;

    overflow-y: auto;
  }
</style>
