export const GENDERS = ["M", "F", "U"] as const;
export type Gender = (typeof GENDERS)[number];

export const VITAL_STATUSES = [
  "alive",
  "deceased",
  "pregnancy",
  "miscarriage",
  "stillbirth",
  "abortion",
] as const;
export type VitalStatus = (typeof VITAL_STATUSES)[number];

export const STRUCTURAL_KINDS = [
  "marriage",
  "separation",
  "divorce",
  "remarriage",
  "cohabitation",
  "affair",
  "sameSexUnion",
  "parent",
  "adopted",
  "foster",
  "twin",
  "identicalTwin",
] as const;
export type StructuralKind = (typeof STRUCTURAL_KINDS)[number];

export const EMOTIONAL_KINDS = [
  "close",
  "distant",
  "fused",
  "conflict",
  "cutoff",
  "fusedConflict",
  "focused",
  "physicalAbuse",
  "sexualAbuse",
] as const;
export type EmotionalKind = (typeof EMOTIONAL_KINDS)[number];

/** Relationships one person directs at another; drawn with an arrowhead at the receiving person. */
const DIRECTIONAL_EMOTIONAL_KINDS: ReadonlySet<string> = new Set<EmotionalKind>([
  "focused",
  "physicalAbuse",
  "sexualAbuse",
]);

export function isDirectionalEmotion(kind: string): boolean {
  return DIRECTIONAL_EMOTIONAL_KINDS.has(kind);
}

export const RELATIVE_RELATIONS = [
  "self",
  "spouse",
  "father",
  "mother",
  "son",
  "daughter",
  "child",
  "brother",
  "sister",
  "sibling",
  "grandfather",
  "grandmother",
  "grandson",
  "granddaughter",
  "adopted-child",
  "foster-child",
] as const;
export type RelativeRelation = (typeof RELATIVE_RELATIONS)[number];

export type EdgeCategory = "structural" | "emotional";

export type ViewMode = "edit" | "final";

export type PersonData = {
  name: string;
  displayNumber: number;
  gender: Gender;
  vitalStatus: VitalStatus;
  isIndexPerson: boolean;
  birthYear?: number;
  deathYear?: number;
  age?: number;
  occupation?: string;
  tags: string[];
};

export type FamilyNode = {
  id: string;
  type: "familyMember";
  data: PersonData;
};

export type FamilyEdge = {
  id: string;
  source: string;
  target: string;
  category: EdgeCategory;
  kind: StructuralKind | EmotionalKind;
  year?: number;
  label?: string;
};

export type Household = {
  id: string;
  memberIds: string[];
};

/** Sizes a counselor may pick for people off the direct line, as a share of a direct-line glyph. */
export const COLLATERAL_SCALE_OPTIONS = [0.5, 0.6, 0.7, 0.8] as const;
export type CollateralScale = (typeof COLLATERAL_SCALE_OPTIONS)[number];

export function isCollateralScale(value: unknown): value is CollateralScale {
  return COLLATERAL_SCALE_OPTIONS.some((option) => option === value);
}

export type FamilyGraph = {
  nodes: FamilyNode[];
  edges: FamilyEdge[];
  households: Household[];
  /** Chosen collateral size; absent means the default. Saved with the graph so exports and reloads match. */
  collateralScale?: CollateralScale;
};

export const EMPTY_GRAPH: FamilyGraph = {
  nodes: [],
  edges: [],
  households: [],
};
