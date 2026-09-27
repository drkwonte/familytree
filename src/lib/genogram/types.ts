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

export type FamilyGraph = {
  nodes: FamilyNode[];
  edges: FamilyEdge[];
  households: Household[];
};

export const EMPTY_GRAPH: FamilyGraph = {
  nodes: [],
  edges: [],
  households: [],
};
