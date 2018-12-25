import { Pubx } from 'pubx';

import Command from './command';
import WasmBoy from '../wasmboy';
import { PUBX_KEYS } from '../pubx.config';

const loadROM = (file, fileName) => {
  // this.setFileLoadingStatus(true);

  const loadROMTask = async () => {
    await WasmBoy.loadROM(file);
    Pubx.get(PUBX_KEYS.NOTIFICATION).showNotification('Game Loaded! 🎉');
    // this.setFileLoadingStatus(false);

    // To test the new autoplay in safari
    // and in chrome
    // TODO
    /*
    if (this.props.autoplay) {
      WasmBoy.play();
    }
    */
    WasmBoy.play();

    // Fire off Analytics
    if (window !== undefined && window.gtag) {
      gtag('event', 'load_rom_success');
    }
  };

  loadROMTask().catch(error => {
    console.log('Load Game Error:', error);
    Pubx.get(PUBX_KEYS.NOTIFICATION).showNotification('Game Load Error! 😞');
    // this.setFileLoadingStatus(false);

    // Fire off Analytics
    if (window !== undefined && window.gtag) {
      gtag('event', 'load_rom_fail');
    }
  });

  // TODO: Set our file name
};

class OpenLocalFile extends Command {
  constructor() {
    super('open:local');
    this.options.label = 'Local File';

    // Create a hidden input on the page for opening files
    const hiddenInput = document.createElement('input');
    hiddenInput.classList.add('hidden-rom-input');
    hiddenInput.setAttribute('type', 'file');
    hiddenInput.setAttribute('accept', '.gb, .gbc, .zip');
    hiddenInput.setAttribute('hidden', true);
    hiddenInput.addEventListener('change', this.onChange.bind(this));
    document.body.appendChild(hiddenInput);

    this.hiddenInput = hiddenInput;
  }

  execute() {
    console.log('Open Local File!');
    // Allow autoplaying audio to work
    WasmBoy.resumeAudioContext();
    this.hiddenInput.click();
  }

  onChange(event) {
    loadROM(event.target.files[0], event.target.files[0].name);
    // TODO: autoplay
  }
}

const exportedCommands = [new OpenLocalFile()];
export default exportedCommands;
