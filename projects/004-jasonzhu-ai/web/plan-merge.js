export const planFields = ['audience', 'task', 'current', 'signals', 'sources', 'nextQuestion'];

export function mergePlan(current, additions, limits = {}) {
  const values = Object.fromEntries(planFields.map((name) => [name, typeof current[name] === 'string' ? current[name] : '']));
  const fits = (name, value) => !Number.isInteger(limits[name]) || limits[name] < 0 || value.length <= limits[name];
  const source = typeof additions.sources === 'string' ? additions.sources.trim() : '';
  let sourceStatus = 'empty';
  if (source) {
    if (values.sources.includes(source)) sourceStatus = 'duplicate';
    else {
      const next = values.sources.trim() ? `${values.sources}\n\n${source}` : source;
      if (!fits('sources', next)) return { values, filledFields: [], sourceStatus: 'full', changed: false };
      values.sources = next;
      sourceStatus = 'added';
    }
  }
  const filledFields = [];
  for (const name of planFields) {
    if (name === 'sources' || values[name].trim()) continue;
    const value = typeof additions[name] === 'string' ? additions[name].trim() : '';
    if (value && fits(name, value)) {
      values[name] = value;
      filledFields.push(name);
    }
  }
  return { values, filledFields, sourceStatus, changed: sourceStatus === 'added' || filledFields.length > 0 };
}
