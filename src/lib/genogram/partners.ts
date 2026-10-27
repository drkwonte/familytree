import { isCoupleKind } from "./relations";
import type { FamilyEdge, FamilyGraph, FamilyNode, Gender } from "./types";

const PARENT_KINDS: ReadonlySet<string> = new Set(["parent", "adopted", "foster"]);
/** Couple lines that leave a person free to marry again: an ended marriage, or a partner who never was a spouse. */
const NOT_A_CURRENT_SPOUSE_KINDS: ReadonlySet<string> = new Set(["divorce", "affair"]);

/** Left-to-right seats for a couple: husband left, wife right, unknown gender last. */
export function coupleOrder(a: FamilyNode, b: FamilyNode): [FamilyNode, FamilyNode] {
  const rank = (gender: Gender) => (gender === "M" ? 0 : gender === "F" ? 1 : 2);
  return rank(a.data.gender) <= rank(b.data.gender) ? [a, b] : [b, a];
}

function isCoupleEdge(edge: FamilyEdge): boolean {
  return edge.category === "structural" && isCoupleKind(edge.kind);
}

function partnerOn(edge: FamilyEdge, personId: string): string {
  return edge.source === personId ? edge.target : edge.source;
}

function partnerIds(graph: FamilyGraph, personId: string): string[] {
  return graph.edges
    .filter((edge) => isCoupleEdge(edge) && (edge.source === personId || edge.target === personId))
    .map((edge) => partnerOn(edge, personId));
}

export function makesCurrentSpouse(kind: string): boolean {
  return isCoupleKind(kind) && !NOT_A_CURRENT_SPOUSE_KINDS.has(kind);
}

/** Whether this person is still married or living with someone, apart from `ignoredPartnerId`. */
export function hasCurrentSpouse(graph: FamilyGraph, personId: string, ignoredPartnerId?: string): boolean {
  return graph.edges.some(
    (edge) =>
      edge.category === "structural" &&
      makesCurrentSpouse(edge.kind) &&
      (edge.source === personId || edge.target === personId) &&
      partnerOn(edge, personId) !== ignoredPartnerId,
  );
}

function childIdsOf(graph: FamilyGraph, parentId: string): Set<string> {
  return new Set(
    graph.edges
      .filter((edge) => edge.category === "structural" && PARENT_KINDS.has(edge.kind) && edge.source === parentId)
      .map((edge) => edge.target),
  );
}

function shareChildren(graph: FamilyGraph, firstId: string, secondId: string): boolean {
  const secondChildren = childIdsOf(graph, secondId);
  return [...childIdsOf(graph, firstId)].some((childId) => secondChildren.has(childId));
}

/**
 * The one partner who shares this person's seat in the family structure: the co-parent
 * of their children, otherwise the first partner recorded. Any other partner is a later
 * partner, drawn outside that couple so the structure stays as it was.
 */
export function findSpouseId(graph: FamilyGraph, personId: string): string | undefined {
  const partners = partnerIds(graph, personId);
  return partners.find((partnerId) => shareChildren(graph, personId, partnerId)) ?? partners[0];
}

/** Partners of this person beyond the main spouse, in the order they were recorded. */
export function laterPartnerIds(graph: FamilyGraph, personId: string): string[] {
  const spouseId = findSpouseId(graph, personId);
  if (!spouseId) return [];
  return partnerIds(graph, personId).filter(
    (partnerId) => partnerId !== spouseId && findSpouseId(graph, partnerId) === personId,
  );
}

export function isLaterPartner(graph: FamilyGraph, personId: string): boolean {
  const spouseId = findSpouseId(graph, personId);
  return spouseId != null && laterPartnerIds(graph, spouseId).includes(personId);
}

export function isLaterPartnerEdge(graph: FamilyGraph, edge: FamilyEdge): boolean {
  return isCoupleEdge(edge) && (isLaterPartner(graph, edge.source) || isLaterPartner(graph, edge.target));
}

/**
 * Later partners sit on the side away from the main spouse, whatever their gender:
 * the husband-left rule would put them inside the first couple and break its lines.
 * Returns +1 for the right side and -1 for the left.
 */
export function laterPartnerSide(graph: FamilyGraph, person: FamilyNode): 1 | -1 {
  const spouseId = findSpouseId(graph, person.id);
  const spouse = spouseId ? graph.nodes.find((node) => node.id === spouseId) : undefined;
  if (!spouse) return 1;
  return coupleOrder(person, spouse)[0].id === person.id ? -1 : 1;
}
