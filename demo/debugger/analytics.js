import loadScript from 'load-script';

class DebuggerAnalyticsLib {
  constructor() {
    /*ROLLUP_REPLACE_DEBUGGER_DEV
    this.readyPromise = Promise.resolve();
    return;
    ROLLUP_REPLACE_DEBUGGER_DEV*/

    this.readyPromise = new Promise((resolve, reject) => {
      if (typeof window !== 'undefined') {
        loadScript('https://www.googletagmanager.com/gtag/js?id=UA-125276735-1', (err, script) => {
          if (err) {
            reject(err);
          }

          window.dataLayer = window.dataLayer || [];
          function gtag() {
            window.dataLayer.push(arguments);
          }
          gtag('js', new Date());
          gtag('config', 'UA-125276735-1');

          // Attach Analytics to this class
          this.gtag = gtag;
          resolve();
        });
      } else {
        reject(new Error('Not in a browser Environment'));
      }
    });
  }

  _fireAnalyticsEvent(eventAction) {
    const fireEventTask = async () => {
      await this.readyPromise;

      if (this.gtag) {
        this.gtag('event', eventAction);
      } else {
        console.log('Analytics Event Action:', eventAction);
      }
    };

    fireEventTask().catch(() => {
      // Do Nothing
    });
  }

  // Define our events
  ROMLoadedAndStarted() {
    this._fireAnalyticsEvent('rom_loaded_and_started');
  }

  loadROMSuccess() {
    this._fireAnalyticsEvent('load_rom_success');
  }

  loadROMFail() {
    this._fireAnalyticsEvent('load_rom_fail');
  }

  addBootROMSuccess() {
    this._fireAnalyticsEvent('add_boot_rom_success');
  }

  addBootROMFail() {
    this._fireAnalyticsEvent('add_boot_rom_fail');
  }

  saveState() {
    this._fireAnalyticsEvent('save_state');
  }

  loadState() {
    this._fireAnalyticsEvent('load_state');
  }

  appliedOptions() {
    this._fireAnalyticsEvent('applied_options');
  }

  googleDriveLoad() {
    this._fireAnalyticsEvent('google_drive_load');
  }

  reload() {
    this._fireAnalyticsEvent('reload');
  }
}

const DebuggerAnalytics = new DebuggerAnalyticsLib();
export default DebuggerAnalytics;
