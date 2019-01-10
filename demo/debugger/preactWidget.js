import { h, render, Component } from 'preact';
import { Pubx } from 'pubx';
import { PUBX_KEYS } from './pubx.config';
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

    this.widgetConfig = widgetConfig;

    if (this.widgetConfig.classes) {
      widgetConfig.classes.forEach(classString => {
        this.addClass(classString);
      });
    }

    this.title.label = this.widgetConfig.label;
    this.title.closable = !!this.widgetConfig.closable;
    this.title.caption = this.widgetConfig.caption;
  }

  toJSON() {
    // Make our widget config serializeable
    const widgetConfigAsJson = {
      ...this.widgetConfig
    };
    widgetConfigAsJson.component = this.widgetConfig.component.nodeName.name;

    // Create a widget json object
    const jsonObject = {
      type: 'PreactWidget',
      widgetConfig: widgetConfigAsJson
    };

    return JSON.stringify(jsonObject);
  }

  onActivateRequest(msg) {
    if (this.isAttached) {
      // Called whenever panel is focused
    }
  }

  onCloseRequest() {
    Pubx.get(PUBX_KEYS.WIDGET).widgetClosed(this);

    if (this.parent) {
      this.parent = null;
    } else if (this.isAttached) {
      phosphorWidgets.Widget.detach(this);
    }
  }

  onResize() {
    Pubx.get(PUBX_KEYS.WIDGET).widgetResized(this);
  }
}
