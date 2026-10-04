/**
 * Pure GTM container audit. Takes the parsed JSON of a container export.
 * Names come from user data, so grouping uses Map (D2). See docs/open-decisions.md (D8) for the known
 * false-positive risk around setup/teardown tags and Trigger Groups, which this module does not change.
 */

/** @typedef {{ name?: string, paused?: boolean, firingTriggerId?: string[], blockingTriggerId?: string[], triggerId?: string, [key: string]: any }} GtmItem */
/** @typedef {{ id: string, text: string }} FindingEntry */
/** @typedef {{ key: string, label: string, items: string[], entries: FindingEntry[], type: "tag" | "variable" | "trigger" | "mixed" }} Finding */
/** @typedef {{ counts: { tags: number, triggers: number, variables: number }, findings: Finding[] }} GtmAudit */

const GENERIC_NAME_RE = /^(tag|trigger|variable)\s*\d*$/i;
const UNTITLED_RE = /^(untitled|new (tag|trigger|variable))/i;

/** @param {string | undefined} name */
export function isGenericName(name) {
  if (!name) return true;
  return GENERIC_NAME_RE.test(name.trim()) || UNTITLED_RE.test(name.trim());
}

/**
 * Collects every `{{Name}}` reference found in any string inside a value.
 * @param {unknown} value
 * @param {Set<string>} refs Filled in place.
 */
export function collectTemplateRefs(value, refs) {
  if (value == null) return;
  if (typeof value === "string") {
    const re = /\{\{([^}]+)\}\}/g;
    let match;
    while ((match = re.exec(value))) refs.add(match[1].trim());
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((v) => collectTemplateRefs(v, refs));
    return;
  }
  if (typeof value === "object") Object.values(value).forEach((v) => collectTemplateRefs(v, refs));
}

/**
 * @param {GtmItem[]} items
 * @returns {Array<[string, GtmItem[]]>} Names used more than once, with their items.
 */
export function findDuplicates(items) {
  /** @type {Map<string, GtmItem[]>} */
  const groups = new Map();
  items.forEach((item) => {
    const name = item.name || "(unnamed)";
    if (!groups.has(name)) groups.set(name, []);
    groups.get(name).push(item);
  });
  return [...groups.entries()].filter(([, arr]) => arr.length > 1);
}

/**
 * @param {string} key
 * @param {string} label
 * @param {string[]} items
 * @param {Finding["type"]} type
 * @returns {Finding}
 */
const finding = (key, label, items, type) => ({
  key,
  label,
  items,
  entries: items.map((text, i) => ({ id: `${key}:${i}`, text })),
  type,
});

/**
 * @param {any} json Parsed container export.
 * @returns {GtmAudit}
 * @throws {Error} When the JSON has no `containerVersion`.
 */
export function auditContainer(json) {
  const cv = json?.containerVersion;
  if (!cv) {
    throw new Error('No "containerVersion" found — this doesn\'t look like a standard GTM export.');
  }
  /** @type {GtmItem[]} */
  const tags = cv.tag || [];
  /** @type {GtmItem[]} */
  const triggers = cv.trigger || [];
  /** @type {GtmItem[]} */
  const variables = cv.variable || [];

  const allRefs = new Set();
  [...tags, ...triggers, ...variables].forEach((item) => collectTemplateRefs(item, allRefs));

  const referencedTriggerIds = new Set();
  tags.forEach((t) => {
    (t.firingTriggerId || []).forEach((id) => referencedTriggerIds.add(id));
    (t.blockingTriggerId || []).forEach((id) => referencedTriggerIds.add(id));
  });

  const names = (/** @type {GtmItem[]} */ list) => list.map((item) => item.name ?? "");
  const duplicateLines = (/** @type {string} */ kind, /** @type {GtmItem[]} */ list) =>
    findDuplicates(list).map(([name, arr]) => `${kind} "${name}" (${arr.length}x)`);
  const genericLines = (/** @type {string} */ kind, /** @type {GtmItem[]} */ list) =>
    list.filter((t) => isGenericName(t.name)).map((t) => `${kind} "${t.name}"`);

  return {
    counts: { tags: tags.length, triggers: triggers.length, variables: variables.length },
    findings: [
      finding("paused_tags", "Paused tags", names(tags.filter((t) => t.paused === true)), "tag"),
      finding(
        "orphan_tags",
        "Tags with no firing trigger",
        names(tags.filter((t) => !t.firingTriggerId || t.firingTriggerId.length === 0)),
        "tag",
      ),
      finding("unused_variables", "Unused variables", names(variables.filter((v) => !allRefs.has(v.name))), "variable"),
      finding(
        "unused_triggers",
        "Unused triggers",
        names(triggers.filter((tr) => !referencedTriggerIds.has(tr.triggerId))),
        "trigger",
      ),
      finding(
        "duplicate_names",
        "Duplicate names",
        [
          ...duplicateLines("Tag", tags),
          ...duplicateLines("Trigger", triggers),
          ...duplicateLines("Variable", variables),
        ],
        "mixed",
      ),
      finding(
        "generic_names",
        "Generic/default names",
        [...genericLines("Tag", tags), ...genericLines("Trigger", triggers), ...genericLines("Variable", variables)],
        "mixed",
      ),
    ],
  };
}
