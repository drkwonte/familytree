import assert from "node:assert/strict";
import { test } from "node:test";
import { toClientRecord, toClientRow } from "./client-repository";
import { toSaveOutcome } from "./genogram-repository";

const SAVED_AT = "2026-10-09T00:00:00Z";

test("a save that updated a row reports the new revision", () => {
  assert.deepEqual(toSaveOutcome([{ revision: 4, updated_at: SAVED_AT }]), {
    status: "saved",
    revision: 4,
    updatedAt: SAVED_AT,
  });
});

test("a save that updated no row is a conflict with newer work", () => {
  assert.deepEqual(toSaveOutcome([]), { status: "conflict" });
});

test("client rows map to and from the editor's field names", () => {
  const row = { id: "c1", name: "홍길동", age: 34, birth_year: 1992, created_at: SAVED_AT, updated_at: SAVED_AT };
  const record = toClientRecord(row);
  assert.deepEqual(record, {
    id: "c1",
    name: "홍길동",
    age: 34,
    birthYear: 1992,
    createdAt: SAVED_AT,
    updatedAt: SAVED_AT,
  });
  assert.deepEqual(toClientRow(record), { name: "홍길동", age: 34, birth_year: 1992 });
});
