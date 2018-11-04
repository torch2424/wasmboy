// Need h for rendering the elements in an object
import { h } from 'preact';

// Import our demo roms
import blarggsCpuROM from '../../test/accuracy/testroms/blargg/cpu_instrs.gb';
import tobuTobuGirlROM from '../../test/performance/testroms/tobutobugirl/tobutobugirl.gb';
import backToColorDemoROM from '../../test/performance/testroms/back-to-color/back-to-color.gbc';

export const openSourceROMs = {
  tobutobugirl: {
    title: 'tobu tobu girl',
    url: tobuTobuGirlROM,
    image: 'assets/tobutobugirl.png',
    link: 'http://tangramgames.dk/tobutobugirl/',
    infoElement: (
      <div>
        <p>
          Tobu Tobu Girl is a fun and challenging arcade platformer developed by Tangram Games featuring an original soundtrack by
          potato-tan. Licensed under MIT/CC-BY.
        </p>
      </div>
    )
  },
  blarggsCpu: {
    title: "Blargg's CPU Test",
    url: blarggsCpuROM,
    image: 'assets/cpu_instrs.golden.png',
    link: 'http://gbdev.gg8.se/wiki/articles/Test_ROMs',
    infoElement: (
      <div>
        <p>Test ROM for testing CPU instructions. Made by Blargg.</p>
      </div>
    )
  },
  backToColor: {
    title: 'Back to Color',
    url: backToColorDemoROM,
    image: 'assets/back-to-color.gbc.noPerformanceOptions.png',
    link: 'https://github.com/AntonioND/back-to-color',
    infoElement: (
      <div>
        <p>Back to Color, a GBC demo for the GBDev 2014 compo. Made by AntonioND.</p>
      </div>
    )
  }
};

export const getOpenSourceROMElements = loadROMCallback => {
  const openSourceROMElements = [];
  Object.keys(openSourceROMs).forEach(romKey => {
    const openSourceROM = openSourceROMs[romKey];
    openSourceROMElements.push(
      <div class="open-source-rom">
        <button
          class="open-source-rom__button"
          onClick={() => {
            loadROMCallback(openSourceROM);
          }}
        >
          <div class="open-source-rom__left">
            <img src={openSourceROM.image} />
          </div>
          <div class="open-source-rom__right">
            <h3>{openSourceROM.title}</h3>
            <div class="open-source-rom__info">{openSourceROM.infoElement}</div>
          </div>
        </button>
        <a href={openSourceROM.link} target="blank_" class="open-source-rom__link">
          {/*Google Material Link Icon*/}
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
            <path d="M0 0h24v24H0z" fill="none" />
            <path d="M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z" />
          </svg>
        </a>
      </div>
    );
  });
  return openSourceROMElements;
};
