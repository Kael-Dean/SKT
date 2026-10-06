// src/components/ui/tabIds.js
// id helpers shared by <Tabs> and the consumer's tabpanel (kept out of Tabs.jsx
// so that file only exports a component — react-refresh rule).
const slug = (v) => String(v).replace(/[^a-zA-Z0-9_-]/g, "_")

/** id of the tab button for `value` */
export const tabId = (idBase, v) => `${idBase}-tab-${slug(v)}`
/** id of the tabpanel the consumer renders for `value` */
export const panelId = (idBase, v) => `${idBase}-panel-${slug(v)}`
