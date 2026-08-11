/**
 * Image and username depth sources are constrained because Phase 11 enriches
 * correlation trees, not arbitrary scraping. If loose source strings spread
 * across the app, save-to-case evidence could not explain which path found it.
 */
export const imageSearchSourceValues = ["browser-google-lens", "browser-yandex", "openweb-ninja", "bright-data"] as const;
export type ImageSearchSource = (typeof imageSearchSourceValues)[number];
