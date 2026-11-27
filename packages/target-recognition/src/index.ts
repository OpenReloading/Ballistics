export { MAYBE_BELOW } from './confidence-tier.ts'
export { type Grid, grayGrid, shareInside } from './face-image.ts'
export { findFace } from './face-search.ts'
export {
  type FaceLabel,
  type FlaggedRegion,
  type HoleDetectionInput,
  type HoleExample,
  type HoleProposal,
  type Region,
  WORK_DIAMETER,
} from './hole-detection.ts'
export {
  type CorrectionStats,
  correctionStats,
  corrections,
  type HoleMatch,
  matchHoles,
} from './hole-matching.ts'
export type { RgbaImage } from './image.ts'
export {
  holeDetector,
  type InferencePort,
  type ProposalRequest,
  type Proposals,
} from './inference-port.ts'
export { type LabeledHole, type LabeledPhoto, type LabelSet, labelSet } from './label-set.ts'
export {
  learnedDetector,
  ModelContractError,
  type ModelTensor,
  type RunModel,
  UntrainedScaleError,
} from './learned-detector.ts'
export { type ModelManifest, type ModelScores, modelManifest } from './model-manifest.ts'
export { clamp, components, median1 } from './raster-ops.ts'
export {
  type FaceFit,
  type FaceGeometry,
  type FacePlane,
  type FaceSearch,
  faceLabel,
  fitDiameter,
  fitPicked,
  onPhoto,
  type PrintedFace,
  type Ring,
} from './target-face.ts'
export { otsu } from './target-paper.ts'
