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
export type { RgbaImage } from './image.ts'
export {
  holeDetector,
  type InferencePort,
  type ProposalRequest,
  type Proposals,
} from './inference-port.ts'
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
