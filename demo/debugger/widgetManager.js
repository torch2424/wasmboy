// Organize and hnadle which widgets are currently active

import PreactWidget from './preactWidget';

export default class WidgetManager {
  constructor(dockPanel) {
    this.dockPanel = dockPanel;
    this.widgets = [];
  }

  addPreactWidget(preactWidgetConfig, splitConfig) {
    if (!splitConfig) {
      splitConfig = {
        mode: 'split-right',
        ref: this.widgets[this.widgets.length - 1]
      };
    }

    if (splitConfig.refIndex) {
      splitConfig.ref = this.widgets[refIndex];
      delete splitConfig.refIndex;
    }

    const widget = new PreactWidget(preactWidgetConfig);
    this.widgets.push(widget);

    this.dockPanel.addWidget(widget, splitConfig);
  }
}
