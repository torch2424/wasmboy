<script>
  import {playPoster, romName, romUrl} from '../stores.js';
  import packageJson from "../../../package.json";
</script>

<div class="about">

  <h1>WasmBoy Embed Player</h1>
  <p>This is a dynamic GameBoy / GameBoy color ROM player powered by WasmBoy. WasmBoy is a Game Boy / Game Boy Color emulation library, 🎮written for WebAssembly using <a href="https://github.com/AssemblyScript/assemblyscript" target="_blank">AssemblyScript</a>. 🚀 This embed is built with <a href="https://svelte.dev/" target="_blank">Svelte</a>, and input is handled by <a href="https://github.com/torch2424/responsive-gamepad" target="_blank">Responsive Gamepad</a>. WasmBoy is written by <a href="https://github.com/torch2424" target="_blank">Aaron Turner (torch2424)</a>, and Licensed under <a href="https://github.com/torch2424/wasmboy/blob/master/LICENSE" target="_blank">GPL 3.0</a>. Also, shoutout to fred-dim ikenna (evillizard) for requesting this feature for WasmBoy, and helping with the general direction!</p>
  <div>WasmBoy Version: {packageJson.version}</div>
  <h1>WasmBoy Links</h1>
  <ul>
    <li><a href="https://github.com/torch2424/wasmboy" target="_blank">Github Repo</a></li> 
    <li><a href="https://www.npmjs.com/package/wasmboy" target="_blank">NPM Package</a></li>
  </ul>
  <h1>Embed Configuration</h1>
  <ul>
    {#if $romName}
      <li><b>ROM Name:</b> {$romName}</li>
    {/if}
    {#if $romUrl}
      <li><b>ROM URL:</b> <a href={$romUrl} target="_blank">{$romUrl}</a></li>
    {/if}
    {#if $playPoster}
      <li><b>Play Poster:</b> <a href={$playPoster} target="_blank">{$playPoster}</a></li>
    {/if}
  </ul>
  <h1>Help</h1>
  <h2>Controls</h2>
  <p>This player supports Keyboard and Gamepad input per the default <a href="https://github.com/torch2424/responsive-gamepad" target="_blank">Responsive Gamepad</a> configuration. For keyboard controls: Directional (Dpad) controls are handled by the arrows keys, or WASD on your keyboard. The A button is controlled by the "Z" key. The B button is controlled by the "X" key. Start is handled by the "Enter" key. Select is handled by the "Shift" key.</p>
  <h2>Saves States / Loading States</h2>
  <p>Save states can be made by clicking the save icon in the control bar at the bottom of the page. Save states will also be made whenever you navigate away from the running iframe, or when the page is refreshed. Save states can be loaded by clicking the load icon in the control bar, and choosing the appropiate save state represented by the screenshot, and time at which the save states was made. Save states are stored locally in your browser in the IndexedDB API. Meaning they are not backed up to a server, and can be accidentally deleted when clearing your browser cache.</p>
  <h2>Reporting Bugs / Making Suggestions</h2>
  <p>Please feel free to file any bugs, suggestions, issues, etc.. At the <a href="https://github.com/torch2424/wasmboy" target="_blank">WasmBoy Github repo</a>.</p>
</div>


<style>
  .about {
    color: #fff;
    font-size: 1.15em;
  }

  .about a, .about a:visited {
    color: #b5cbfc;
    word-break: break-all;
  }
</style>
