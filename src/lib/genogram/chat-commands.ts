import type { ChatChange } from "./chat-changes";
import { personCode } from "./relations";
import type { EmotionalKind, StructuralKind } from "./types";

type RelationKind = StructuralKind | EmotionalKind;

/**
 * Counselors mostly type the same pattern ("인물1과 인물2 사이에 단절 표시해줘"), which
 * needs no model at all. Only sentences these rules read for certain are handled here;
 * anything else returns null and still goes to the AI, so a guess never reaches the drawing.
 */
const KIND_WORDS: readonly (readonly [word: string, kind: RelationKind])[] = [
  ["친밀", "close"],
  ["소원", "distant"],
  ["융합", "fused"],
  ["밀착", "fused"],
  ["갈등", "conflict"],
  ["단절", "cutoff"],
  ["융합갈등", "fusedConflict"],
  ["과잉개입", "focused"],
  ["신체학대", "physicalAbuse"],
  ["성학대", "sexualAbuse"],
  ["결혼", "marriage"],
  ["재혼", "remarriage"],
  ["별거", "separation"],
  ["이혼", "divorce"],
  ["동거", "cohabitation"],
  ["외도", "affair"],
  ["동성 결합", "sameSexUnion"],
  ["입양", "adopted"],
  ["위탁", "foster"],
  ["쌍둥이", "twin"],
  ["일란성 쌍둥이", "identicalTwin"],
];

const KIND_LABELS: Record<RelationKind, string> = {
  close: "친밀",
  distant: "소원",
  fused: "융합",
  conflict: "갈등",
  cutoff: "단절",
  fusedConflict: "융합갈등",
  focused: "과잉개입",
  physicalAbuse: "신체학대",
  sexualAbuse: "성학대",
  marriage: "결혼",
  remarriage: "재혼",
  separation: "별거",
  divorce: "이혼",
  cohabitation: "동거",
  affair: "외도",
  sameSexUnion: "동성 결합",
  parent: "부모-자녀",
  adopted: "입양",
  foster: "위탁",
  twin: "쌍둥이",
  identicalTwin: "일란성 쌍둥이",
};

const HOUSEHOLD_WORDS = ["가구", "함께 살", "함께 사", "같이 살", "같이 사"];
const REMOVE_WORDS = ["지워", "지우", "삭제", "없애", "제거"];
/** "A 말고 B" or "A가 아니라 B" names two kinds for one pair; only a model can tell which one is meant. */
const NEGATION_WORDS = ["말고", "아니", "대신", "빼고"];
const PAIR_SIZE = 2;
const MIN_HOUSEHOLD_SIZE = 2;
const NOTHING_APPLIED_MESSAGE = "반영한 내용이 없습니다.";

function withoutSpaces(text: string): string {
  return text.replace(/\s/g, "");
}

const KIND_BY_WORD = new Map(KIND_WORDS.map(([word, kind]) => [withoutSpaces(word), kind]));

/** Any space typed inside a phrase ("일란성 쌍둥이", "인물 3") is optional. */
function wordPattern(words: readonly string[]): string {
  return [...words]
    .sort((left, right) => right.length - left.length)
    .map((word) => word.split("").map((char) => (char === " " ? "\\s*" : char)).join(""))
    .join("|");
}

const TOKEN_PATTERN = new RegExp(
  [
    String.raw`인물\s*(?<person>\d+)`,
    String.raw`(?<year>\d{4})\s*년`,
    `(?<household>${wordPattern(HOUSEHOLD_WORDS)})`,
    `(?<remove>${wordPattern(REMOVE_WORDS)})`,
    `(?<negation>${wordPattern(NEGATION_WORDS)})`,
    `(?<kind>${wordPattern(KIND_WORDS.map(([word]) => word))})`,
  ].join("|"),
  "g",
);

/** The people named together and what the sentence says to do with them. */
type Clause = { people: number[]; kinds: Set<RelationKind>; year?: number; household: boolean; remove: boolean };

function emptyClause(): Clause {
  return { people: [], kinds: new Set(), household: false, remove: false };
}

function hasAction(clause: Clause): boolean {
  return clause.kinds.size > 0 || clause.household || clause.remove;
}

/** A person named after an action starts the next clause; null when the sentence is ambiguous. */
function readClauses(text: string): Clause[] | null {
  const clauses: Clause[] = [];
  let current = emptyClause();
  for (const match of text.matchAll(TOKEN_PATTERN)) {
    const groups = match.groups ?? {};
    if (groups.negation) return null;
    if (groups.person) {
      if (hasAction(current)) {
        clauses.push(current);
        current = emptyClause();
      }
      current.people.push(Number(groups.person));
    } else if (groups.year) current.year = Number(groups.year);
    else if (groups.household) current.household = true;
    else if (groups.remove) current.remove = true;
    else if (groups.kind) current.kinds.add(KIND_BY_WORD.get(withoutSpaces(groups.kind)) as RelationKind);
  }
  clauses.push(current);
  return clauses;
}

function pairsOf(people: number[]): [number, number][] | null {
  if (people.length === 0 || people.length % PAIR_SIZE !== 0) return null;
  const pairs: [number, number][] = [];
  for (let index = 0; index < people.length; index += PAIR_SIZE) pairs.push([people[index], people[index + 1]]);
  return pairs;
}

function householdChange(clause: Clause): ChatChange[] | null {
  if (clause.remove) return clause.people.length > 0 ? [{ type: "removeHousehold", members: clause.people }] : null;
  return clause.people.length >= MIN_HOUSEHOLD_SIZE ? [{ type: "setHousehold", members: clause.people }] : null;
}

function relationChanges(clause: Clause): ChatChange[] | null {
  const pairs = pairsOf(clause.people);
  if (!pairs) return null;
  if (clause.remove) return pairs.map(([from, to]) => ({ type: "removeRelation", from, to }));
  if (clause.kinds.size !== 1) return null;
  const [kind] = clause.kinds;
  const year = clause.year === undefined ? {} : { year: clause.year };
  return pairs.map(([from, to]) => ({ type: "setRelation", from, to, kind, ...year }));
}

function clauseChanges(clause: Clause): ChatChange[] | null {
  if (!hasAction(clause)) return null;
  return clause.household ? householdChange(clause) : relationChanges(clause);
}

/** The changes a patterned request asks for, or null when the request should go to the AI. */
export function parseRelationCommand(text: string): ChatChange[] | null {
  const clauses = readClauses(text);
  if (!clauses) return null;
  const changes: ChatChange[] = [];
  for (const clause of clauses) {
    const found = clauseChanges(clause);
    if (!found) return null;
    changes.push(...found);
  }
  return changes;
}

function describeChange(change: ChatChange): string {
  switch (change.type) {
    case "setRelation": {
      const when = change.year === undefined ? "" : `${change.year}년 `;
      return `${personCode(change.from)}·${personCode(change.to)} 사이에 ${when}${KIND_LABELS[change.kind]} 관계를 표시했습니다.`;
    }
    case "removeRelation":
      return `${personCode(change.from)}·${personCode(change.to)} 사이의 관계선을 지웠습니다.`;
    case "setHousehold":
      return `${change.members.map(personCode).join(", ")}을(를) 동거 가구로 묶었습니다.`;
    case "removeHousehold":
      return `${change.members.map(personCode).join(", ")}이(가) 속한 동거 가구를 지웠습니다.`;
  }
}

export function describeChatChanges(changes: ChatChange[]): string {
  return changes.length > 0 ? changes.map(describeChange).join("\n") : NOTHING_APPLIED_MESSAGE;
}
