// Tabulates focusable and operable elements.
exports.reporter = async page => {
  const report = await require('../../procs/test/focOp').focOp(page, false);
  return report;
};
