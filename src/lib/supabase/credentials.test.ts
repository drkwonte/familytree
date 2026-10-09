import assert from "node:assert/strict";
import { test } from "node:test";
import {
  hasErrors,
  normalizeEmail,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  validateEmail,
  validateNewPassword,
} from "./credentials";

test("normalizes and validates email addresses", () => {
  assert.equal(normalizeEmail("  Counselor@Example.COM "), "counselor@example.com");
  assert.equal(validateEmail("counselor@example.com"), undefined);
  assert.ok(validateEmail(""));
  assert.ok(validateEmail("counselor@example"));
  assert.ok(validateEmail("counselor example.com"));
});

test("enforces password length boundaries", () => {
  const shortest = "a".repeat(PASSWORD_MIN_LENGTH);
  assert.deepEqual(validateNewPassword(shortest, shortest), {});
  const tooShort = "a".repeat(PASSWORD_MIN_LENGTH - 1);
  assert.ok(validateNewPassword(tooShort, tooShort).password);
  const tooLong = "a".repeat(PASSWORD_MAX_LENGTH + 1);
  assert.ok(validateNewPassword(tooLong, tooLong).password);
});

test("requires the confirmation to match", () => {
  const errors = validateNewPassword("password-1", "password-2");
  assert.ok(errors.passwordConfirm);
  assert.equal(hasErrors(errors), true);
  assert.equal(hasErrors({ email: undefined }), false);
});
