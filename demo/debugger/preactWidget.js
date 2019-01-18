import { h, render, Component } from 'preact';
import { Pubx } from 'pubx';
import { PUBX_KEYS } from './pubx.config';
import phosphorWidgets from '@phosphor/widgets';

const createPreactNodeObject = component => {
  let containerNode = document.createElement('div');
  let contentNode = document.createElement('div');

  const preactNode = render(component, contentNode);

  // https://github.com/developit/preact/issues/1151
  const destroyPreactNode = () => {
    render(null, contentNode, preactNode);
  };

  containerNode.appendChild(contentNode);
  return {
    containerNode,
    contentNode,
    preactNode,
    destroyPreactNode
  };
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

    const preactNodeObject = createPreactNodeObject(widgetConfig.component);

    super({
      node: preactNodeObject.containerNode
    });
    this.addClass('content');

    this.widgetConfig = widgetConfig;
    this.preactNodeObject = preactNodeObject;

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

    this.preactNodeObject.destroyPreactNode();

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
