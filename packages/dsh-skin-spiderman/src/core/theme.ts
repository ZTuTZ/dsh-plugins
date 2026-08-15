/** Everything a skin hero contributes beyond the generic skin runtime. */
export interface HeroSkinContent {
  id: string
  label: string
  /** Sidebar comic kicker (rendered uppercase by CSS). */
  kicker: string
  /** Status-row display name. */
  statusName: string
  markUrl: string
  textureUrl: string
  /** Background effect layers: `base` sits behind, `reveal` is revealed. */
  figures: { base: string; reveal: string }
}
