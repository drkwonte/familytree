import assert from "node:assert/strict";
import { test } from "node:test";
import {
  CLIENT_AGE_MAX,
  CLIENT_BIRTH_YEAR_MIN,
  CLIENT_NAME_MAX_LENGTH,
  describeClientFields,
  toClientFieldsDraft,
  validateClientFields,
} from "./client-fields";

const CURRENT_YEAR = 2026;

test("accepts a name alone and trims it", () => {
  const result = validateClientFields({ name: "  홍길동 ", age: "", birthYear: "" }, CURRENT_YEAR);
  assert.deepEqual(result, { ok: true, value: { name: "홍길동", age: null, birthYear: null } });
});

test("rejects a blank name and a name longer than the database allows", () => {
  const blank = validateClientFields({ name: "   ", age: "", birthYear: "" }, CURRENT_YEAR);
  assert.equal(blank.ok, false);
  const tooLong = validateClientFields(
    { name: "가".repeat(CLIENT_NAME_MAX_LENGTH + 1), age: "", birthYear: "" },
    CURRENT_YEAR,
  );
  assert.equal(tooLong.ok, false);
  assert.ok(!tooLong.ok && tooLong.errors.name);
});

test("accepts age and birth year at their boundaries", () => {
  const result = validateClientFields(
    { name: "김", age: String(CLIENT_AGE_MAX), birthYear: String(CURRENT_YEAR - CLIENT_AGE_MAX) },
    CURRENT_YEAR,
  );
  assert.equal(result.ok, true);
  const newborn = validateClientFields({ name: "김", age: "0", birthYear: String(CURRENT_YEAR) }, CURRENT_YEAR);
  assert.equal(newborn.ok, true);
});

test("rejects out of range, negative, decimal and non-numeric numbers", () => {
  for (const age of [String(CLIENT_AGE_MAX + 1), "-1", "3.5", "열살"]) {
    const result = validateClientFields({ name: "김", age, birthYear: "" }, CURRENT_YEAR);
    assert.ok(!result.ok && result.errors.age, `age ${age} should be rejected`);
  }
  for (const birthYear of [String(CLIENT_BIRTH_YEAR_MIN - 1), String(CURRENT_YEAR + 1)]) {
    const result = validateClientFields({ name: "김", age: "", birthYear }, CURRENT_YEAR);
    assert.ok(!result.ok && result.errors.birthYear, `birth year ${birthYear} should be rejected`);
  }
});

test("allows a one-year gap between age and birth year but rejects larger mismatches", () => {
  const beforeBirthday = validateClientFields({ name: "김", age: "33", birthYear: "1992" }, CURRENT_YEAR);
  assert.equal(beforeBirthday.ok, true);
  const mismatch = validateClientFields({ name: "김", age: "20", birthYear: "1992" }, CURRENT_YEAR);
  assert.ok(!mismatch.ok && mismatch.errors.birthYear);
});

test("round-trips stored fields into an editable draft and a summary", () => {
  const fields = { name: "이영희", age: 34, birthYear: 1992 };
  assert.deepEqual(toClientFieldsDraft(fields), { name: "이영희", age: "34", birthYear: "1992" });
  assert.deepEqual(toClientFieldsDraft(null), { name: "", age: "", birthYear: "" });
  assert.equal(describeClientFields(fields), "34세 · 1992년생");
  assert.equal(describeClientFields({ name: "이영희", age: null, birthYear: null }), "");
});
