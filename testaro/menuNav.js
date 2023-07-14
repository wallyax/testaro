/*
  menuNav
  This test reports nonstandard keyboard navigation among menu items.
  Standards are based on https://www.w3.org/TR/wai-aria-practices-1.1/#menu.
  A prior version of this test covered all menus and, before operating on their menu items, set
  their display style property to revert, their visibility style properties to visible, their
  opacity style property to 1, the tabIndex style properties of the menu item to be operated on
  to 0, and the tabIndex style properties of the other menu items to -1.
*/

// ########## IMPORTS

// Module to get locator data.
const {getLocatorData} = require('../procs/getLocatorData');

// ########## FUNCTIONS

// Returns an adjacent index, with wrapping.
const wrap = (groupSize, startIndex, increment) => {
  let newIndex = startIndex + increment;
  if (newIndex < 0) {
    return groupSize - 1;
  }
  else if (newIndex > groupSize - 1) {
    return 0;
  }
};
// Returns the index of the menu item expected to be focused or pseudofocused after a keypress.
const getNewFocus = (isHorizontal, groupLocs, startIndex, key) => {
  if (key === 'Home') {
    return 0;
  }
  else if (key === 'End') {
    return groupLocs.length - 1;
  }
  else if (key === 'ArrowUp' && ! isHorizontal) {
    return wrap(groupLocs.length, startIndex, -1);
  }
  else if (key === 'ArrowDown' && ! isHorizontal) {
    return wrap(groupLocs.length, startIndex, 1);
  }
  else if (key === 'ArrowLeft' && isHorizontal) {
    return wrap(groupLocs.length, startIndex, -1);
  }
  else if (key === 'ArrowRight' && isHorizontal) {
    return wrap(groupLocs.length, startIndex, 1);
  }
  else if (key === 'Tab') {
    return -1;
  }
  else {
    return startIndex;
  }
};
// Returns the index of the menu item that is focused.
const getFocus = async groupLoc => {
  const focus = await groupLoc.evaluateAll(elements => {
    const focEl = document.activeElement;
    const focus = elements.indexOf(focEl);
    return focus;
  });
  return focus;
};
exports.reporter = async (page, withItems) => {
  // Initialize the result.
  const data = {};
  const totals = [0, 0, 0, 0];
  const standardInstances = [];
  // Get locators for all visible menus.
  const menuLocAll = page.locator('[role=menu]:visible, [role=menubar]:visible');
  const menuLocsAll = await menuLocAll.all();
  // For each of them:
  for (const menuLoc of menuLocsAll) {
    // Get its orientation.
    const menuRole = await menuLoc.getAttribute('role');
    let orientation = await menuLoc.getAttribute('aria-orientation');
    if (! orientation) {
      orientation = menuRole === 'menubar' ? 'horizontal' : 'vertical';
    }
    // Get locators for its direct menu items.
    const menuItemLocAll = menuLoc.locator(
      ':scope [role=menuitem]:not([role=menu] [role=menuitem]):not([role=menubar] [role=menuitem])'
    );
    const menuItemLocsAll = await menuItemLocAll.all();
    // If there are at least 2 of them:
    if (menuItemLocsAll.length > 1) {
      // For each of them:
      for (const index in menuItemLocsAll) {
        const loc = menuItemLocsAll[index];
        // Get data on the element.
        const elData = await getLocatorData(loc);
        // For each navigation key:
        for (const key of ['Home', 'End', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']) {
          // Focus the menu item and press the key.
          await loc.press(key);
          // Get the index of the menu item expected to be focused.
          const okFocus = getNewFocus(orientation === 'horizontal', menuItemLocsAll, index, key);
          // Get the index of the menu item actually focused.
          const actualFocus = getFocus(menuItemLocAll);
          // If they differ:
          if (actualFocus !== okFocus) {
            // Add to the totals.
            totals[0]++;
            // If itemization is required:
            if (withItems) {
              // Add an instance to the result.
              standardInstances.push({
                ruleID: 'menuNav',
                what: `Menu item responds nonstandardly to the ${key} key`,
                ordinalSeverity: 0,
                tagName: elData.tagName,
                id: elData.id,
                location: elData.location,
                excerpt: elData.excerpt
              });
            }
          }
        }
      }
    }
  }
  // If itemization is not required and there are any instances:
  if (! withItems && totals[0]) {
    // Add a summary instance to the result.
    standardInstances.push({
      ruleID: 'menuNav',
      what: 'Menu items respond nonstandardly to navigation keys',
      count: totals[0],
      ordinalSeverity: 0,
      tagName: '',
      id: '',
      location: {
        doc: '',
        type: '',
        spec: ''
      },
      excerpt: ''
    });
  }
  // Reload the page.
  try {
    await page.reload({timeout: 15000});
  }
  catch(error) {
    console.log('ERROR: page reload timed out');
  }
  return {
    data,
    totals,
    standardInstances
  };
};
