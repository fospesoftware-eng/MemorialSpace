declare module "simplify-js" {
  interface Pt { x: number; y: number }
  function simplify(points: Pt[], tolerance?: number, highQuality?: boolean): Pt[];
  export default simplify;
}
