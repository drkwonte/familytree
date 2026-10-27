"use client";

import { type FormEvent, useState } from "react";
import { FormMessage } from "@/components/forms/FormField";
import { NATIVE_SELECT_CLASS_NAME } from "@/components/forms/select-class";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { INTERACTION_OPTION_GROUPS, findInteractionOption } from "@/lib/genogram/interaction-options";
import { applyInteraction } from "@/lib/genogram/interactions";
import { peopleByNumber, personOptionLabel } from "@/lib/genogram/relations";
import type { FamilyNode } from "@/lib/genogram/types";
import { useFamilyStore } from "@/store/family-store";

const NO_SELECTION = "";
const MIN_PEOPLE_FOR_INTERACTION = 2;
const NOT_ENOUGH_PEOPLE_MESSAGE = "인물정보 탭에서 인물을 두 명 이상 추가하면 상호작용을 표시할 수 있습니다.";
const PICK_PLACEHOLDER = "선택";

type Outcome = { tone: "info" | "error"; text: string };

function PersonSelect({
  id,
  label,
  value,
  people,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  people: FamilyNode[];
  onChange: (personId: string) => void;
}) {
  return (
    <div className="grid min-w-0 gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <select id={id} className={NATIVE_SELECT_CLASS_NAME} value={value} onChange={(event) => onChange(event.target.value)}>
        <option value={NO_SELECTION}>{PICK_PLACEHOLDER}</option>
        {people.map((person) => (
          <option key={person.id} value={person.id}>
            {personOptionLabel(person)}
          </option>
        ))}
      </select>
    </div>
  );
}

function InteractionSelect({ value, onChange }: { value: string; onChange: (optionId: string) => void }) {
  return (
    <div className="grid min-w-0 gap-1.5">
      <Label htmlFor="interaction-kind">상호작용</Label>
      <select
        id="interaction-kind"
        className={NATIVE_SELECT_CLASS_NAME}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value={NO_SELECTION}>{PICK_PLACEHOLDER}</option>
        {INTERACTION_OPTION_GROUPS.map((group) => (
          <optgroup key={group.label} label={group.label}>
            {group.options.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
    </div>
  );
}

/** A pick can outlive its person (deleted, or undone away), so it only counts while that person exists. */
function existingPick(personId: string, people: FamilyNode[]): string {
  return people.some((person) => person.id === personId) ? personId : NO_SELECTION;
}

export function InteractionPanel() {
  const graph = useFamilyStore((state) => state.graph);
  const replaceGraph = useFamilyStore((state) => state.replaceGraph);
  const [firstPick, setFirstPick] = useState(NO_SELECTION);
  const [secondPick, setSecondPick] = useState(NO_SELECTION);
  const [optionId, setOptionId] = useState(NO_SELECTION);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const people = peopleByNumber(graph);
  const firstId = existingPick(firstPick, people);
  const secondId = existingPick(secondPick, people);
  const option = findInteractionOption(optionId);
  const canSubmit = Boolean(firstId && secondId && option);

  function pick(setter: (value: string) => void) {
    return (value: string) => {
      setter(value);
      setOutcome(null);
    };
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!option) return;
    const result = applyInteraction(graph, { firstId, secondId, action: option.action });
    if (result.ok) replaceGraph(result.graph);
    setOutcome({ tone: result.ok ? "info" : "error", text: result.message });
  }

  if (people.length < MIN_PEOPLE_FOR_INTERACTION) {
    return <FormMessage tone="info">{NOT_ENOUGH_PEOPLE_MESSAGE}</FormMessage>;
  }

  return (
    <form lang="ko" onSubmit={handleSubmit} className="grid gap-3">
      <h3 className="text-lg font-semibold">상호작용 표시</h3>
      <div className="grid grid-cols-3 gap-2">
        <PersonSelect id="interaction-first" label="인물 A" value={firstId} people={people} onChange={pick(setFirstPick)} />
        <PersonSelect id="interaction-second" label="인물 B" value={secondId} people={people} onChange={pick(setSecondPick)} />
        <InteractionSelect value={optionId} onChange={pick(setOptionId)} />
      </div>
      <Button type="submit" disabled={!canSubmit}>
        확인
      </Button>
      {outcome ? <FormMessage tone={outcome.tone}>{outcome.text}</FormMessage> : null}
    </form>
  );
}
