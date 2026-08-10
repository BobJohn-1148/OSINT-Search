/**
 * Asset modules are declared separately from preload globals so TypeScript keeps
 * the declarations ambient. If Vite assets depended on imported types, the
 * renderer could lose image and stylesheet module coverage during typecheck.
 */
declare module "*.png" {
  const src: string;
  export default src;
}

declare module "*.css" {
  const src: string;
  export default src;
}
