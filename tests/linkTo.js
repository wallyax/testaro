/*
  linkTo
  Derived from the bbc-a11y anchorsMustHaveHrefs test.
  This test reports failures to equip links with destinations.
*/
exports.reporter = async (page, withItems) => {
  // Identify the visible links without href attributes.
  const badLinkTexts = await page.$$eval(
    'a:not([href]):visible',
    badLinks => {
      // FUNCTION DEFINITION START
      // Returns a space-minimized copy of a string.
      const compact = string => string.replace(/[\t\n]/g, '').replace(/\s{2,}/g, ' ').trim();
      // FUNCTION DEFINITION END
      return badLinks.map(link => compact(link.textContent));
    }
  );
  const data = {
    totals: badLinkTexts.length
  };
  if (withItems) {
    data.items = badLinkTexts;
  }
  return {result: data};
};