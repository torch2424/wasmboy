// Responsive Gamepad plugin to simulate GB Inputs

import { ResponsiveGamepad } from 'responsive-gamepad';

export default function ResponsiveGamepadPluginGB() {
  return {
    onGetState: state => {
      const gamepadA = state.A;
      const gamepadB = state.B;

      state.A = gamepadA || state.X;
      state.B = gamepadB || state.Y;

      return state;
    }
  };
}
