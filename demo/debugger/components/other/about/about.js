import { h, Component } from 'preact';

import './about.css';

export default class AboutComponent extends Component {
  render() {
    return (
      <div>
        <h1>About</h1>
        <div>
          WasmBoy is a Game Boy / Game Boy Color Emulation Library, written for Web Assembly using{' '}
          <a href="https://github.com/AssemblyScript/assemblyscript" target="_blank">
            AssemblyScript
          </a>
          . 🚀 This application is a debugger written in{' '}
          <a href="https://preactjs.com/" target="_blank">
            Preact
          </a>{' '}
          ⚛️.{' '}
          <a href="http://phosphorjs.github.io/" target="_blank">
            PhosphorJS
          </a>{' '}
          is used for the Desktop UI.{' '}
          <a href="https://www.npmjs.com/package/pubx" target="_blank">
            Pubx
          </a>{' '}
          is used for for state management. This debugger is meant for developing / debugging the emulation lib, as well as game boy
          homebrew development. WasmBoy is written by{' '}
          <a href="https://github.com/torch2424" target="_blank">
            Aaron Turner (torch2424)
          </a>
          , and Licensed under{' '}
          <a href="https://choosealicense.com/licenses/apache-2.0/" target="_blank">
            Apache 2.0
          </a>
          .
          <br />
          <br />
          For standard game boy emulation playing for fun, speed running, etc... Check out{' '}
          <a href="https://vaporboy.net/" target="_blank">
            VaporBoy
          </a>
          , a full featured GB / GBC Emulator Progressive Web App.
        </div>
        <h2>WasmBoy Links</h2>
        <ul>
          <li>
            <a href="https://github.com/torch2424/wasmBoy" target="_blank">
              Github Repo
            </a>
          </li>
          <li>
            <a href="https://www.npmjs.com/package/wasmboy" target="_blank">
              NPM Package
            </a>
          </li>
          <li>
            <a href="https://wasmboy.app/benchmark/" target="_blank">
              WasmBoy Benchmarking Tool
            </a>
          </li>
          <li>
            <a href="https://www.npmjs.com/package/responsive-gamepad" target="_blank">
              Responsive Gamepad - WasmBoy Input Library
            </a>
          </li>
        </ul>
      </div>
    );
  }
}
