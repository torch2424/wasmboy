<script>
  import {WasmBoy} from '../../../dist/wasmboy.wasm.esm.js'; 
  import {setStatus, hideModal} from '../stores.js';

  const wasmBoySaveStates = WasmBoy.getSaveStates()
    .then(saveStates => {
      // Sort by date
      saveStates.sort((a, b) => {
        if (a.date > b.date) {
          return -1;
        }
        if (a.date < b.date) {
          return 1;
        }
        return 0;
      });
      return Promise.resolve(saveStates);
    })
    .catch(error => {
    console.error(error);
    throw error;
  });

  const handleLoadState = async (saveState) => {
    await WasmBoy.loadState(saveState);
    await WasmBoy.play();
    hideModal();
    setStatus('State Loaded!');
  }
</script>

{#await wasmBoySaveStates}
  <div class="donut"></div>
{:then saveStates}
  <ul>
    {#each saveStates as saveState}
    <li>
      <button on:click={e => handleLoadState(saveState)}>
        <img src={saveState.screenshotCanvasDataURL} alt="Save State Screenshot" />
        <div>
          <h2>{(new Date(saveState.date)).toLocaleString()}</h2>
          <h4>{saveState.isAuto ? 'Auto Save' : 'Manual Save'}</h4>
        </div>
      </button>
    </li>
    {/each}
  </ul>
{:catch error}
  <p style="color: red">{error.message}</p>
{/await}

<style>
  ul {
    margin: 0px;
    padding: 0px;
    list-style-type: none;
  }

  li {
    margin: 10px;
    padding: 10px;

    border-bottom: 2px solid #fff;
  }

  li:last-child {
    border-bottom: none;
  }

  button {
    width: 100%;
    height: 100px;
    background-color: transparent;
    border: none;

    display: flex;
    justify-content: flex-start;
    align-items: center;

    color: #fff;
  }

  button > img {
    height: 100px;
    width: 100px;

    object-fit: cover;
  }

  button > div {
    flex: 1;
    width: 100%;

    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: flex-start;

    margin-left: 10px;
  }
</style>
