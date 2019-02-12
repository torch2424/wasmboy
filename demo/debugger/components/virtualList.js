// From: https://github.com/developit/preact-virtual-list
// Modified to allow manually setting height as a prop

import { h, Component } from 'preact';

import './virtualListWidget.css';

const STYLE_INNER = 'position:relative; overflow:hidden; width:100%; min-height:100%;';

const STYLE_CONTENT = 'position:absolute; top:0; left:0; height:100%; width:100%; overflow:visible;';

/** Virtual list, renders only visible items.
 *	@param {Array<*>} data         List of data items
 *	@param {Function} renderRow    Renders a single row
 *	@param {Number} rowHeight      Static height of a row
 *	@param {Number} overscanCount  Amount of rows to render above and below visible area of the list
 *	@param {Boolean} [sync=false]  true forces synchronous rendering
 *	@example
 *		<VirtualList
 *			data={['a', 'b', 'c']}
 *			renderRow={ row => <div>{row}</div> }
 *			rowHeight={22}
 *      height={450}
 *			sync
 *		/>
 */
export default class VirtualList extends Component {
  handleScroll = () => {
    this.setState({ offset: this.base.scrollTop });
    if (this.props.sync) this.forceUpdate();
  };

  render({ data, rowHeight, renderRow, overscanCount = 10, sync, height, ...props }, { offset = 0 }) {
    // Increase our height, for some reason doesn't work without this :p
    height = height * 2.5;

    // first visible row index
    let start = (offset / rowHeight) | 0;

    // actual number of visible rows (without overscan)
    let visibleRowCount = (height / rowHeight) | 0;

    // Overscan: render blocks of rows modulo an overscan row count
    // This dramatically reduces DOM writes during scrolling
    if (overscanCount) {
      start = Math.max(0, start - (start % overscanCount));
      visibleRowCount += overscanCount;
    }

    // last visible + overscan row index
    let end = start + 1 + visibleRowCount;

    // data slice currently in viewport plus overscan items
    let selection = data.slice(start, end);

    return (
      <div onScroll={this.handleScroll} {...props}>
        <div style={`${STYLE_INNER} height:${data.length * rowHeight}px;`}>
          <div style={`${STYLE_CONTENT} top:${start * rowHeight}px;`}>{selection.map(renderRow)}</div>
        </div>
      </div>
    );
  }
}
