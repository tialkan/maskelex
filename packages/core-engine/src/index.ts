// packages/core-engine/src/index.ts
export * from './types/contracts';
export * as checksums from './validators/checksums';
export * as citation from './legal/citation';
export * as amount from './fuzz/amount';
export * as morphology from './morphology/morphology';
export * as coref from './coref/persons';
export * as twins from './twins/twins';
export * as rehydrate from './unmask/rehydrate';
export { merge } from './pipeline/merge';
export { allocateTokens, buildMaskEdits } from './pipeline/maskText';
export { BUILT_IN_TEMPLATES, KORUMA, fillTemplate } from './pipeline/templates';
export { createNerClient } from './ner/client';
export type { PortLike } from './ner/protocol';
export { isGivenName, isSurname } from './names/ruleDetector';
export { leakAudit } from './pipeline/leakAudit';
export { createEngine, type EnginePorts } from './pipeline/engine';
