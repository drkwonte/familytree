import { isCoupleKind } from "./relations";
import type { FamilyEdge, FamilyGraph, FamilyNode } from "./types";

const COUPLE_OPERATORS: Record<string, string> = {
  marriage: "--",
  remarriage: "--",
  sameSexUnion: "--",
  divorce: "-x-",
  separation: "-/-",
  cohabitation: "~",
  affair: "~",
};

const EMOTIONAL_TYPES: Record<string, { type: string; directional: boolean }> = {
  close: { type: "close", directional: false },
  distant: { type: "distant", directional: false },
  fused: { type: "fused", directional: false },
  conflict: { type: "conflict", directional: false },
  cutoff: { type: "cutoff", directional: false },
  fusedConflict: { type: "fused-hostile", directional: false },
  focused: { type: "focused", directional: true },
  physicalAbuse: { type: "physical-abuse", directional: true },
  sexualAbuse: { type: "sexual-abuse", directional: true },
};

export function toSchematexId(id: string): string {
  const cleaned = id.replace(/[^a-zA-Z0-9_-]/g, "_");
  return /^[a-zA-Z]/.test(cleaned) ? cleaned : `p_${cleaned}`;
}

function quote(value: string): string {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function personLabel(node: FamilyNode): string {
  const extras = [node.data.occupation, ...node.data.tags].filter(Boolean);
  if (extras.length === 0) return node.data.name;
  return `${node.data.name} · ${extras.join(" · ")}`;
}

function personAttributes(node: FamilyNode, extras: string[] = []): string {
  const parts: string[] = [];
  if (node.data.gender === "M") parts.push("male");
  else if (node.data.gender === "F") parts.push("female");
  else parts.push("unknown");

  if (node.data.vitalStatus === "deceased") parts.push("deceased");
  if (node.data.vitalStatus === "stillbirth") parts.push("stillborn");
  if (node.data.vitalStatus === "miscarriage") parts.push("miscarriage");
  if (node.data.vitalStatus === "abortion") parts.push("abortion");
  if (node.data.birthYear) parts.push(String(node.data.birthYear));
  if (node.data.deathYear) parts.push(`death: ${node.data.deathYear}`);
  if (node.data.age !== undefined) parts.push(`age: ${node.data.age}`);
  if (node.data.isIndexPerson) parts.push("index");
  parts.push(`label: ${quote(personLabel(node))}`);
  parts.push(...extras);
  return parts.join(", ");
}

function personLine(node: FamilyNode, indent: string, extras: string[] = []): string {
  return `${indent}${toSchematexId(node.id)} [${personAttributes(node, extras)}]`;
}

type CoupleGroup = {
  edge: FamilyEdge;
  left: FamilyNode;
  right: FamilyNode;
  children: FamilyNode[];
};

function nodeMap(graph: FamilyGraph): Map<string, FamilyNode> {
  return new Map(graph.nodes.map((node) => [node.id, node]));
}

function coupleGroups(graph: FamilyGraph): CoupleGroup[] {
  const nodes = nodeMap(graph);
  const groups = graph.edges
    .filter((edge) => edge.category === "structural" && isCoupleKind(edge.kind))
    .flatMap((edge) => {
      const source = nodes.get(edge.source);
      const target = nodes.get(edge.target);
      if (!source || !target) return [];
      const maleFirst =
        source.data.gender === "M" || (source.data.gender !== "F" && target.data.gender === "F");
      const left = maleFirst ? source : target;
      const right = left === source ? target : source;
      const children = graph.nodes
        .filter((child) =>
          graph.edges.some(
            (item) =>
              item.category === "structural" &&
              ["parent", "adopted", "foster"].includes(item.kind) &&
              item.target === child.id &&
              (item.source === source.id || item.source === target.id),
          ),
        )
        .sort(
          (a, b) =>
            (a.data.birthYear ?? a.data.age ?? 0) - (b.data.birthYear ?? b.data.age ?? 0) ||
            a.data.name.localeCompare(b.data.name),
        );
      const uniqueChildren = [...new Map(children.map((child) => [child.id, child])).values()];
      return [{ edge, left, right, children: uniqueChildren }];
    });

  return groups.sort((a, b) => {
    const yearA = Math.min(a.left.data.birthYear ?? 9999, a.right.data.birthYear ?? 9999);
    const yearB = Math.min(b.left.data.birthYear ?? 9999, b.right.data.birthYear ?? 9999);
    return yearA - yearB;
  });
}

function childExtras(graph: FamilyGraph, child: FamilyNode, couple: CoupleGroup): string[] {
  const extras: string[] = [];
  const kinds = graph.edges
    .filter(
      (edge) =>
        edge.category === "structural" &&
        edge.target === child.id &&
        (edge.source === couple.left.id || edge.source === couple.right.id),
    )
    .map((edge) => edge.kind);
  if (kinds.includes("adopted")) extras.push("adopted");
  if (kinds.includes("foster")) extras.push("foster");
  const twin = graph.edges.find(
    (edge) =>
      edge.category === "structural" &&
      ["twin", "identicalTwin"].includes(edge.kind) &&
      (edge.source === child.id || edge.target === child.id),
  );
  if (twin?.kind === "identicalTwin") extras.push("twin-identical");
  if (twin?.kind === "twin") extras.push("twin-fraternal");
  return extras;
}

function isStructuralChild(graph: FamilyGraph, personId: string): boolean {
  return graph.edges.some(
    (edge) =>
      edge.category === "structural" &&
      ["parent", "adopted", "foster"].includes(edge.kind) &&
      edge.target === personId,
  );
}

function orphanParentCouples(graph: FamilyGraph, coveredChildren: Set<string>): string[] {
  const nodes = nodeMap(graph);
  const lines: string[] = [];
  const remaining = graph.nodes.filter(
    (node) => isStructuralChild(graph, node.id) && !coveredChildren.has(node.id),
  );
  const parentLinks = graph.edges.filter(
    (edge) =>
      edge.category === "structural" &&
      ["parent", "adopted", "foster"].includes(edge.kind) &&
      remaining.some((node) => node.id === edge.target),
  );

  const byParentPair = new Map<string, { parents: string[]; children: FamilyNode[] }>();
  for (const child of remaining) {
    const parents = parentLinks
      .filter((edge) => edge.target === child.id)
      .map((edge) => edge.source);
    if (parents.length === 0) continue;
    const key = [...parents].sort().join("+");
    const group = byParentPair.get(key) ?? { parents, children: [] };
    group.children.push(child);
    byParentPair.set(key, group);
  }

  for (const group of byParentPair.values()) {
    const first = nodes.get(group.parents[0]);
    if (!first) continue;
    if (group.parents.length === 1) {
      const unknownId = `unknown_${toSchematexId(first.id)}`;
      lines.push(`  ${unknownId} [unknown, label: ${quote("미상")}]`);
      lines.push(`  ${toSchematexId(first.id)} -- ${unknownId}`);
    } else {
      const second = nodes.get(group.parents[1]);
      if (!second) continue;
      lines.push(`  ${toSchematexId(first.id)} -- ${toSchematexId(second.id)}`);
    }
    for (const child of group.children) {
      lines.push(personLine(child, "    "));
      coveredChildren.add(child.id);
    }
  }
  return lines;
}

export function familyGraphToDsl(graph: FamilyGraph): string {
  if (graph.nodes.length === 0) {
    return `genogram ${quote("가계도")}\n`;
  }

  const couples = coupleGroups(graph);
  const declared = new Set<string>();
  const lines = [`genogram ${quote("가계도")}`];

  const roots = graph.nodes.filter((node) => !isStructuralChild(graph, node.id));
  for (const node of roots) {
    lines.push(personLine(node, "  "));
    declared.add(node.id);
  }

  const pending = [...couples];
  while (pending.length > 0) {
    const index = pending.findIndex(
      (couple) => declared.has(couple.left.id) || declared.has(couple.right.id),
    );
    const couple = pending.splice(index === -1 ? 0 : index, 1)[0];
    if (!declared.has(couple.left.id)) {
      lines.push(personLine(couple.left, "  "));
      declared.add(couple.left.id);
    }
    if (!declared.has(couple.right.id)) {
      lines.push(personLine(couple.right, "  "));
      declared.add(couple.right.id);
    }

    const operator = COUPLE_OPERATORS[couple.edge.kind] ?? "--";
    const yearLabel = couple.edge.year ? ` ${quote(`m. ${couple.edge.year}`)}` : "";
    lines.push(
      `  ${toSchematexId(couple.left.id)} ${operator} ${toSchematexId(couple.right.id)}${yearLabel}`,
    );
    for (const child of couple.children) {
      lines.push(personLine(child, "    ", childExtras(graph, child, couple)));
      declared.add(child.id);
    }
  }

  lines.push(...orphanParentCouples(graph, declared));

  for (const node of graph.nodes) {
    if (!declared.has(node.id)) {
      lines.push(personLine(node, "  "));
      declared.add(node.id);
    }
  }

  for (const edge of graph.edges.filter((item) => item.category === "emotional")) {
    const mapping = EMOTIONAL_TYPES[edge.kind];
    if (!mapping) continue;
    const connector = mapping.directional ? `-${mapping.type}->` : `-${mapping.type}-`;
    const label = edge.label ? ` ${quote(edge.label)}` : "";
    lines.push(
      `  ${toSchematexId(edge.source)} ${connector} ${toSchematexId(edge.target)}${label}`,
    );
  }

  return `${lines.join("\n")}\n`;
}
