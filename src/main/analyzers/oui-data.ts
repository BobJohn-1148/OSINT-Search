/**
 * OUI data is re-exported from a generated bundle so lookup code imports one
 * stable module while the large IEEE table stays mechanical. If analyzer logic
 * owned this data directly, updates would mix policy edits with vendor churn.
 */
export { offlineOuiVendors } from "./oui-data.generated.js";
