import { isCoupleKind, isCurrentSpouseEdge } from "./relations";
import type { FamilyEdge, FamilyGraph, FamilyNode, Gender } from "./types";

const PARENT_KINDS: ReadonlySet<string> = new Set(["parent", "adopted", "foster"]);

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

/** Partners this person is still married to or living with. */
export function currentSpouseIds(graph: FamilyGraph, personId: string): string[] {
  return graph.edges
    .filter((edge) => isCurrentSpouseEdge(graph, edge, personId))
    .map((edge) => partnerOn(edge, personId));
}

/** Whether this person is still married or living with someone, apart from `ignoredPartnerId`. */
export function hasCurrentSpouse(graph: FamilyGraph, personId: string, ignoredPartnerId?: string): boolean {
  return currentSpouseIds(graph, personId).some((partnerId) => partnerId !== ignoredPartnerId);
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

/** Which side of this person a partner sits on by the husband-left rule: +1 for right, -1 for left. */
export function partnerSide(person: FamilyNode, partner: FamilyNode): 1 | -1 {
  return coupleOrder(person, partner)[0].id === person.id ? 1 : -1;
}

/**
 * A later partner on the main spouse's side sits between the first couple, so that
 * couple must leave room; one on the other side only needs room beside the person.
 */
export function sitsInsideFirstCouple(graph: FamilyGraph, person: FamilyNode, partner: FamilyNode): boolean {
  const spouseId = findSpouseId(graph, person.id);
  const spouse = spouseId ? graph.nodes.find((node) => node.id === spouseId) : undefined;
  return spouse != null && partnerSide(person, spouse) === partnerSide(person, partner);
}
