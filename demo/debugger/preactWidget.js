import { h, render, Component } from 'preact';
import phosphorWidgets from '@phosphor/widgets';

const createPreactNode = component => {
  let node = document.createElement('div');
  let content = document.createElement('div');

  render(component, content);

  node.appendChild(content);
  return node;
};

// Our default widget config, spead with the value sent to us
const defaultWidgetConfig = {
  component: undefined,
  classes: ['default-wasmboy-widget'],
  label: 'Preact Widget',
  closable: true,
  caption: 'Description for Preact Widget'
};

export default class PreactWidget extends phosphorWidgets.Widget {
  constructor(passedWidgetConfig) {
    const widgetConfig = {
      ...defaultWidgetConfig,
      ...passedWidgetConfig
    };

    if (!widgetConfig.component) {
      throw new Error('You must supply a component to the Preact Widget');
    }

    super({
      node: createPreactNode(widgetConfig.component)
    });
    this.addClass('content');

    if (widgetConfig.classes) {
      widgetConfig.classes.forEach(classString => {
        this.addClass(classString);
      });
    }

    this.title.label = widgetConfig.label;
    this.title.closable = !!widgetConfig.closable;
    this.title.caption = widgetConfig.caption;
  }

  onActivateRequest(msg) {
    if (this.isAttached) {
      // Called whenever panel is focused
    }
  }
}
