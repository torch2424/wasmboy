// Helper functions for widgets that contain a virtual list

export function virtualListWidgetScrollToAddress(address, data, base, rowHeight, classRowNumberPrefix) {
  const virtualListElement = base.querySelector('.virtual-list-widget__list__virtual');

  if (virtualListElement) {
    // We need to find which row the address is closest to.
    let rowIndex = 0;
    for (let i = address; i > 0; i--) {
      if (data[i] && (data[i].address === address || address > data[i].address)) {
        rowIndex = i;
        i = 0;
      }
    }

    // Get a row offset
    let rowOffset = 2;
    if (rowIndex < rowOffset || address >= 0xffd0) {
      rowOffset = 0;
    }

    // Set the scrolltop
    let top = rowHeight * rowIndex;
    top -= rowHeight * rowOffset;
    virtualListElement.scrollTop = top;

    // Now the virtual list is weird, so this will now render the rows
    // So now let's find the element, and figure out how far out of view it is
    setTimeout(() => {
      let row = base.querySelector(`.virtual-list-widget__list__virtual .${classRowNumberPrefix}-row-${address}`);
      if (!row) {
        row = base.querySelector(`.virtual-list-widget__list__virtual > div > div > div[id]`);
      }

      if (!row) {
        return;
      }

      const listRect = virtualListElement.getBoundingClientRect();
      const rowRect = row.getBoundingClientRect();

      const difference = listRect.y - rowRect.y;
      if (difference > 0) {
        top = virtualListElement.scrollTop - difference;
        top -= rowHeight * rowOffset;
        virtualListElement.scrollTop = top;
      }
    });
  }
}
