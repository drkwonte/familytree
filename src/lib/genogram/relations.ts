import {
  EMPTY_GRAPH,
  type FamilyEdge,
  type FamilyGraph,
  type FamilyNode,
  type Gender,
  type PersonData,
  type RelativeRelation,
  type VitalStatus,
} from "./types";

export function createPersonId(): string {
  return `node_${crypto.randomUUID().slice(0, 8)}`;
}

export function createEdgeId(): string {
  return `edge_${crypto.randomUUID().slice(0, 8)}`;
}

export function createHouseholdId(): string {
  return `hh_${crypto.randomUUID().slice(0, 8)}`;
}

export function addHousehold(graph: FamilyGraph, memberIds: string[]): FamilyGraph {
  const members = [...new Set(memberIds)].filter((id) => graph.nodes.some((node) => node.id === id));
  if (members.length === 0) return graph;
  return {
    ...graph,
    households: [...graph.households, { id: createHouseholdId(), memberIds: members }],
  };
}

export function nextDisplayNumber(graph: FamilyGraph): number {
  const used = graph.nodes.map((node) => node.data.displayNumber);
  return used.length === 0 ? 1 : Math.max(...used) + 1;
}

export function personCode(displayNumber: number): string {
  return `인물${displayNumber}`;
}

export function ensureDisplayNumbers(graph: FamilyGraph): FamilyGraph {
  let next = 1;
  const used = new Set<number>();
  const nodes = graph.nodes.map((node) => {
    const current = node.data.displayNumber;
    if (current > 0 && !used.has(current)) {
      used.add(current);
      next = Math.max(next, current + 1);
      return node;
    }
    const assigned = next;
    used.add(assigned);
    next += 1;
    return { ...node, data: { ...node.data, displayNumber: assigned } };
  });
  return { ...graph, nodes };
}

export function createEmptyPerson(
  overrides: Partial<PersonData> & Pick<PersonData, "name">,
): PersonData {
  return {
    gender: "U",
    vitalStatus: "alive",
    isIndexPerson: false,
    tags: [],
    displayNumber: 0,
    ...overrides,
  };
}

function inferGenderFromRelation(relation: RelativeRelation): Gender {
  if (
    ["father", "son", "brother", "grandfather", "grandson"].includes(relation)
  ) {
    return "M";
  }
  if (
    [
      "mother",
      "daughter",
      "sister",
      "grandmother",
      "granddaughter",
    ].includes(relation)
  ) {
    return "F";
  }
  return "U";
}

function addEdge(
  graph: FamilyGraph,
  source: string,
  target: string,
  kind: FamilyEdge["kind"],
  category: FamilyEdge["category"] = "structural",
): FamilyGraph {
  const exists = graph.edges.some(
    (edge) =>
      edge.category === category &&
      edge.kind === kind &&
      ((edge.source === source && edge.target === target) ||
        (edge.source === target && edge.target === source)),
  );
  if (exists) return graph;
  return {
    ...graph,
    edges: [
      ...graph.edges,
      { id: createEdgeId(), source, target, category, kind },
    ],
  };
}

function resolveAnchorId(graph: FamilyGraph, requestedId?: string): string | undefined {
  if (requestedId && graph.nodes.some((node) => node.id === requestedId)) {
    return requestedId;
  }
  return graph.nodes[0]?.id;
}

function parentsOfPerson(graph: FamilyGraph, personId: string): string[] {
  return graph.edges
    .filter(
      (edge) =>
        edge.category === "structural" &&
        ["parent", "adopted", "foster"].includes(edge.kind) &&
        edge.target === personId,
    )
    .map((edge) => edge.source);
}

function addCoParentsMarriage(
  graph: FamilyGraph,
  newParentId: string,
  childId: string,
): FamilyGraph {
  const others = parentsOfPerson(graph, childId).filter((id) => id !== newParentId);
  if (others.length !== 1) return graph;
  return addEdge(graph, newParentId, others[0], "marriage");
}

function findSpouse(graph: FamilyGraph, personId: string): string | undefined {
  const coupleKinds = new Set([
    "marriage",
    "separation",
    "divorce",
    "remarriage",
    "cohabitation",
    "sameSexUnion",
  ]);
  const edge = graph.edges.find(
    (item) =>
      item.category === "structural" &&
      coupleKinds.has(item.kind) &&
      (item.source === personId || item.target === personId),
  );
  if (!edge) return undefined;
  return edge.source === personId ? edge.target : edge.source;
}

export function addRelative(
  graph: FamilyGraph,
  params: {
    name: string;
    gender?: Gender;
    vitalStatus?: VitalStatus;
    age?: number;
    birthYear?: number;
    deathYear?: number;
    occupation?: string;
    tags?: string[];
    isIndexPerson?: boolean;
    anchorId?: string;
    relation: RelativeRelation;
  },
): FamilyGraph {
  const nextNode: FamilyNode = {
    id: createPersonId(),
    type: "familyMember",
    data: createEmptyPerson({
      name: params.name,
      displayNumber: nextDisplayNumber(graph),
      gender: params.gender ?? inferGenderFromRelation(params.relation),
      vitalStatus: params.vitalStatus ?? "alive",
      age: params.age,
      birthYear: params.birthYear,
      deathYear: params.deathYear,
      occupation: params.occupation,
      tags: params.tags ?? [],
      isIndexPerson: params.isIndexPerson ?? graph.nodes.length === 0,
    }),
  };

  let next: FamilyGraph = {
    ...graph,
    nodes: graph.nodes.map((node) =>
      params.isIndexPerson
        ? { ...node, data: { ...node.data, isIndexPerson: false } }
        : node,
    ),
  };
  next = { ...next, nodes: [...next.nodes, nextNode] };

  const anchor = resolveAnchorId(graph, params.anchorId);
  if (!anchor || params.relation === "self") {
    return next;
  }
  switch (params.relation) {
    case "spouse":
      return addEdge(next, anchor, nextNode.id, "marriage");
    case "father":
    case "mother": {
      const withParent = addEdge(next, nextNode.id, anchor, "parent");
      return addCoParentsMarriage(withParent, nextNode.id, anchor);
    }
    case "son":
    case "daughter":
    case "child":
    case "adopted-child":
    case "foster-child": {
      const kind =
        params.relation === "adopted-child"
          ? "adopted"
          : params.relation === "foster-child"
            ? "foster"
            : "parent";
      let withChild = addEdge(next, anchor, nextNode.id, kind);
      const spouseId = findSpouse(withChild, anchor);
      if (spouseId) {
        withChild = addEdge(withChild, spouseId, nextNode.id, kind);
      }
      return withChild;
    }
    case "brother":
    case "sister":
    case "sibling": {
      const parentEdges = next.edges.filter(
        (edge) =>
          edge.category === "structural" &&
          ["parent", "adopted", "foster"].includes(edge.kind) &&
          edge.target === anchor,
      );
      return parentEdges.reduce(
        (acc, edge) => addEdge(acc, edge.source, nextNode.id, edge.kind),
        next,
      );
    }
    case "grandfather":
    case "grandmother": {
      const parentEdges = next.edges.filter(
        (edge) =>
          edge.category === "structural" &&
          edge.kind === "parent" &&
          edge.target === anchor,
      );
      if (parentEdges[0]) {
        return addEdge(next, nextNode.id, parentEdges[0].source, "parent");
      }
      return addEdge(next, nextNode.id, anchor, "parent");
    }
    case "grandson":
    case "granddaughter":
      return addEdge(next, anchor, nextNode.id, "parent");
    default:
      return next;
  }
}

export function seedDemoGraph(): FamilyGraph {
  let graph = addRelative(EMPTY_GRAPH, {
    name: "나",
    gender: "F",
    relation: "self",
    isIndexPerson: true,
    age: 32,
    birthYear: 1994,
    occupation: "상담 내담자",
    tags: ["주요 호소: 부부갈등"],
  });
  const me = graph.nodes[0].id;

  graph = addRelative(graph, {
    name: "아버지",
    gender: "M",
    relation: "father",
    anchorId: me,
    age: 61,
    birthYear: 1965,
    occupation: "자영업",
    tags: ["알코올 문제"],
  });
  const father = graph.nodes.find((node) => node.data.name === "아버지")!.id;

  graph = addRelative(graph, {
    name: "어머니",
    gender: "F",
    relation: "mother",
    anchorId: me,
    age: 59,
    birthYear: 1967,
    occupation: "주부",
    tags: ["주요 의논대상"],
  });
  const mother = graph.nodes.find((node) => node.data.name === "어머니")!.id;
  graph = {
    ...graph,
    edges: graph.edges.map((edge) =>
      edge.category === "structural" &&
      isCoupleKind(edge.kind) &&
      ((edge.source === father && edge.target === mother) ||
        (edge.source === mother && edge.target === father))
        ? { ...edge, year: 1990 }
        : edge,
    ),
  };

  graph = addRelative(graph, {
    name: "오빠",
    gender: "M",
    relation: "brother",
    anchorId: me,
    age: 35,
    birthYear: 1991,
    occupation: "회사원",
  });
  graph = addRelative(graph, {
    name: "배우자",
    gender: "M",
    relation: "spouse",
    anchorId: me,
    age: 34,
    birthYear: 1992,
    occupation: "교사",
  });
  const spouse = graph.nodes.find((node) => node.data.name === "배우자")!.id;
  graph = addRelative(graph, {
    name: "아들",
    gender: "M",
    relation: "son",
    anchorId: me,
    age: 4,
    birthYear: 2022,
  });

  graph = {
    ...graph,
    edges: [
      ...graph.edges,
      {
        id: createEdgeId(),
        source: father,
        target: me,
        category: "emotional",
        kind: "cutoff",
        label: "대화 단절",
      },
      {
        id: createEdgeId(),
        source: me,
        target: spouse,
        category: "emotional",
        kind: "conflict",
        label: "갈등",
      },
      {
        id: createEdgeId(),
        source: me,
        target: mother,
        category: "emotional",
        kind: "close",
        label: "친밀",
      },
    ],
    households: [{ id: "hh_1", memberIds: [me, spouse, graph.nodes.find((n) => n.data.name === "아들")!.id] }],
  };

  return graph;
}

export function updatePerson(
  graph: FamilyGraph,
  personId: string,
  patch: Partial<PersonData>,
): FamilyGraph {
  const makingIndex = patch.isIndexPerson === true;
  return {
    ...graph,
    nodes: graph.nodes.map((node) => {
      if (node.id !== personId) {
        if (makingIndex) {
          return { ...node, data: { ...node.data, isIndexPerson: false } };
        }
        return node;
      }
      return { ...node, data: { ...node.data, ...patch } };
    }),
  };
}

export function deletePerson(graph: FamilyGraph, personId: string): FamilyGraph {
  const remaining = graph.nodes.filter((node) => node.id !== personId);
  const hadIndex = graph.nodes.some(
    (node) => node.id === personId && node.data.isIndexPerson,
  );
  const nodes = remaining.map((node, index) =>
    hadIndex && index === 0
      ? { ...node, data: { ...node.data, isIndexPerson: true } }
      : node,
  );
  return {
    nodes,
    edges: graph.edges.filter(
      (edge) => edge.source !== personId && edge.target !== personId,
    ),
    households: graph.households
      .map((household) => ({
        ...household,
        memberIds: household.memberIds.filter((id) => id !== personId),
      }))
      .filter((household) => household.memberIds.length > 0),
  };
}

export function isCoupleKind(kind: string): boolean {
  return [
    "marriage",
    "separation",
    "divorce",
    "remarriage",
    "cohabitation",
    "affair",
    "sameSexUnion",
    "spouse",
  ].includes(kind);
}
