import { Component } from "preact";
import "./wasmboyGamepad.css";

// Simple mobile contreols for the wasmboy debugger
export class WasmBoyGamepad extends Component {
  constructor() {
    super();
  }

  render() {
    return (
      <div class="wasmboy__gamepad">
        {/* DPAD */}
        <svg
          id="gamepadDpad"
          height="24"
          viewBox="0 0 24 24"
          width="24"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path d="M0 0h24v24H0z" fill="none" />
          <path d="M15 7.5V2H9v5.5l3 3 3-3zM7.5 9H2v6h5.5l3-3-3-3zM9 16.5V22h6v-5.5l-3-3-3 3zM16.5 9l-3 3 3 3H22V9h-5.5z" />
        </svg>

        {/* Start */}
        <svg
          id="gamepadStart"
          height="24"
          viewBox="6 6 12 12"
          width="24"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path d="M19 13H5v-2h14v2z" />
          <path d="M0 0h24v24H0z" fill="none" />
          <text x="21" y="55" transform="scale(0.325)">
            Start
          </text>
        </svg>

        {/* Select */}
        <svg
          id="gamepadSelect"
          height="24"
          viewBox="6 6 12 12"
          width="24"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path d="M19 13H5v-2h14v2z" />
          <path d="M0 0h24v24H0z" fill="none" />
          <text x="16" y="55" transform="scale(0.325)">
            Select
          </text>
        </svg>

        {/* A */}
        <svg
          id="gamepadA"
          height="24"
          viewBox="0 0 24 24"
          width="24"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8z" />
          <path d="M0 0h24v24H0z" fill="none" />
          <text x="7.5" y="16.25">
            A
          </text>
        </svg>

        {/* B */}
        <svg
          id="gamepadB"
          height="24"
          viewBox="0 0 24 24"
          width="24"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8z" />
          <path d="M0 0h24v24H0z" fill="none" />
          <text x="7.5" y="17.25">
            B
          </text>
        </svg>
      </div>
    );
  }
}
