"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { personCode, personHasParent } from "@/lib/genogram/relations";
import type { FamilyNode, Gender, RelativeRelation, VitalStatus } from "@/lib/genogram/types";
import { validateNewPerson } from "@/lib/genogram/validate";
import { useFamilyStore } from "@/store/family-store";

const RELATION_OPTIONS: { value: RelativeRelation; label: string }[] = [
  { value: "spouse", label: "배우자" },
  { value: "father", label: "아버지" },
  { value: "mother", label: "어머니" },
  { value: "child", label: "자녀" },
  { value: "sibling", label: "형제 자매" },
  { value: "grandfather", label: "할아버지" },
  { value: "grandmother", label: "할머니" },
  { value: "adopted-child", label: "입양 자녀" },
  { value: "foster-child", label: "위탁 자녀" },
];

const selectClassName =
  "h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

type FormFields = {
  gender: Gender;
  vitalStatus: VitalStatus;
  age: string;
  birthYear: string;
  deathYear: string;
  occupation: string;
  tags: string;
  isIndexPerson: boolean;
};

const EMPTY_FIELDS: FormFields = {
  gender: "U",
  vitalStatus: "alive",
  age: "",
  birthYear: "",
  deathYear: "",
  occupation: "",
  tags: "",
  isIndexPerson: false,
};

function fieldsFromPerson(person: FamilyNode): FormFields {
  return {
    gender: person.data.gender,
    vitalStatus: person.data.vitalStatus,
    age: person.data.age !== undefined ? String(person.data.age) : "",
    birthYear: person.data.birthYear !== undefined ? String(person.data.birthYear) : "",
    deathYear: person.data.deathYear !== undefined ? String(person.data.deathYear) : "",
    occupation: person.data.occupation ?? "",
    tags: person.data.tags.join(", "),
    isIndexPerson: person.data.isIndexPerson,
  };
}

function parseOptionalNumber(value: string): number | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function personPatch(fields: FormFields, name: string) {
  return {
    name,
    gender: fields.gender,
    vitalStatus: fields.vitalStatus,
    age: parseOptionalNumber(fields.age),
    birthYear: parseOptionalNumber(fields.birthYear),
    deathYear: parseOptionalNumber(fields.deathYear),
    occupation: fields.occupation || undefined,
    tags: fields.tags
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean),
    isIndexPerson: fields.isIndexPerson,
  };
}

export function PersonForm() {
  const graph = useFamilyStore((state) => state.graph);
  const selectedPersonId = useFamilyStore((state) => state.selectedPersonId);
  const selectPerson = useFamilyStore((state) => state.selectPerson);
  const addPerson = useFamilyStore((state) => state.addPerson);
  const updatePerson = useFamilyStore((state) => state.updatePerson);
  const deletePerson = useFamilyStore((state) => state.deletePerson);
  const editingPerson = graph.nodes.find((node) => node.id === selectedPersonId) ?? null;
  const [fields, setFields] = useState<FormFields>(EMPTY_FIELDS);
  const [anchorId, setAnchorId] = useState(graph.nodes[0]?.id ?? "");
  const [relation, setRelation] = useState<RelativeRelation | "">("");

  useEffect(() => {
    if (!editingPerson) {
      setFields(EMPTY_FIELDS);
      setRelation("");
      return;
    }
    setFields(fieldsFromPerson(editingPerson));
  }, [editingPerson?.id]);

  useEffect(() => {
    const anchorStillExists = graph.nodes.some((node) => node.id === anchorId);
    if (!anchorStillExists) {
      setAnchorId(graph.nodes[0]?.id ?? "");
    }
  }, [anchorId, graph.nodes]);

  function patchField<Key extends keyof FormFields>(key: Key, value: FormFields[Key]) {
    setFields((current) => ({ ...current, [key]: value }));
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const error = validateNewPerson({
      age: fields.age,
      vitalStatus: fields.vitalStatus,
      hasExistingPeople: editingPerson ? false : graph.nodes.length > 0,
      relation,
      anchorId,
      anchorHasParent: personHasParent(graph, anchorId),
    });
    if (error) {
      window.alert(error);
      return;
    }
    if (editingPerson) {
      updatePerson(editingPerson.id, personPatch(fields, editingPerson.data.name));
      return;
    }
    addPerson({
      ...personPatch(
        { ...fields, isIndexPerson: graph.nodes.length === 0 || fields.isIndexPerson },
        "",
      ),
      anchorId: graph.nodes.length === 0 ? undefined : anchorId,
      relation: graph.nodes.length === 0 ? "self" : (relation as RelativeRelation),
    });
    setFields(EMPTY_FIELDS);
    setRelation("");
  }

  function handleDelete() {
    if (!editingPerson) return;
    if (!window.confirm(`${personCode(editingPerson.data.displayNumber)}을(를) 삭제할까요?`)) {
      return;
    }
    deletePerson(editingPerson.id);
  }

  const showRelationFields = !editingPerson && graph.nodes.length > 0;

  return (
    <form lang="ko" onSubmit={handleSubmit} className="grid gap-3">
      <h3 className="text-lg font-semibold">
        {editingPerson
          ? `${personCode(editingPerson.data.displayNumber)} 수정`
          : "인물 추가"}
      </h3>
      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="gender">성별</Label>
          <select
            id="gender"
            className={selectClassName}
            value={fields.gender}
            onChange={(event) => patchField("gender", event.target.value as Gender)}
          >
            <option value="U">기타/미상</option>
            <option value="M">남</option>
            <option value="F">여</option>
          </select>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="vital">생사/상태</Label>
          <select
            id="vital"
            className={selectClassName}
            value={fields.vitalStatus}
            onChange={(event) => patchField("vitalStatus", event.target.value as VitalStatus)}
          >
            <option value="alive">생존</option>
            <option value="deceased">사망</option>
            <option value="pregnancy">임신</option>
            <option value="miscarriage">자연유산</option>
            <option value="stillbirth">사산</option>
            <option value="abortion">인공유산</option>
          </select>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="age">나이</Label>
          <Input
            id="age"
            value={fields.age}
            onChange={(event) => patchField("age", event.target.value)}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="birth">출생연도</Label>
          <Input
            id="birth"
            value={fields.birthYear}
            onChange={(event) => patchField("birthYear", event.target.value)}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="death">사망연도</Label>
          <Input
            id="death"
            value={fields.deathYear}
            onChange={(event) => patchField("deathYear", event.target.value)}
          />
        </div>
      </div>
      {showRelationFields ? (
        <>
          <div className="grid gap-1.5">
            <Label htmlFor="anchor">기준 인물 *</Label>
            <select
              id="anchor"
              className={selectClassName}
              value={anchorId}
              onChange={(event) => setAnchorId(event.target.value)}
            >
              {graph.nodes.map((node) => (
                <option key={node.id} value={node.id}>
                  {personCode(node.data.displayNumber)}
                  {node.data.occupation ? ` · ${node.data.occupation}` : ""}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="relation">기준 인물과의 관계 *</Label>
            <select
              id="relation"
              className={selectClassName}
              value={relation}
              onChange={(event) => setRelation(event.target.value as RelativeRelation | "")}
            >
              <option value="">선택해 주세요</option>
              {RELATION_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </>
      ) : null}
      <div className="grid gap-1.5">
        <Label htmlFor="job">직업</Label>
        <Input
          id="job"
          name="직업"
          inputMode="text"
          autoComplete="off"
          autoCorrect="off"
          value={fields.occupation}
          onChange={(event) => patchField("occupation", event.target.value)}
        />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="tags">특이사항 (쉼표로 구분)</Label>
        <Textarea
          id="tags"
          value={fields.tags}
          onChange={(event) => patchField("tags", event.target.value)}
          placeholder="조기사망, 주요 의논대상, 우울증"
        />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={fields.isIndexPerson}
          onChange={(event) => patchField("isIndexPerson", event.target.checked)}
        />
        내담자 (이중 테두리로 표시)
      </label>
      {editingPerson ? (
        <div className="grid gap-2">
          <Button type="submit">저장</Button>
          <Button type="button" variant="destructive" onClick={handleDelete}>
            삭제
          </Button>
          <Button type="button" variant="outline" onClick={() => selectPerson(null)}>
            ← 추가모드
          </Button>
        </div>
      ) : (
        <Button type="submit">확인</Button>
      )}
    </form>
  );
}
