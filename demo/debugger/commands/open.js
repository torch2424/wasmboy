import Command from './command';
import WasmBoy from '../wasmboy';

const loadROM = (file, fileName) => {
  this.setFileLoadingStatus(true);

  const loadROMTask = async () => {
    await WasmBoy.loadROM(file);
    this.props.showNotification('Game Loaded! 🎉');
    this.setFileLoadingStatus(false);

    // To test the new autoplay in safari
    // and in chrome
    if (this.props.autoplay) {
      WasmBoy.play();
    }

    // Fire off Analytics
    if (window !== undefined && window.gtag) {
      gtag('event', 'load_rom_success');
    }
  };

  loadROMTask().catch(error => {
    console.log('Load Game Error:', error);
    this.props.showNotification('Game Load Error! 😞');
    this.setFileLoadingStatus(false);

    // Fire off Analytics
    if (window !== undefined && window.gtag) {
      gtag('event', 'load_rom_fail');
    }
  });

  // Set our file name
  const newState = Object.assign({}, this.state);
  newState.currentFileName = fileName;
  this.setState(newState);
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
