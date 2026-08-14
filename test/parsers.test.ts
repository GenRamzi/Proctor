import test from "node:test";
import assert from "node:assert/strict";
import { parseGoTest, parseJestVitest, parseJUnitXml, parseNodeTest, parsePytest, parseTap } from "../src/parsers.js";

test("parses filtered pytest output", () => {
  const parsed = parsePytest("pytest tests/test_http.py -k retry\n12 passed, 1 skipped in 0.42s");
  assert.equal(parsed?.framework, "pytest");
  assert.equal(parsed?.passed, 12);
  assert.equal(parsed?.skipped, 1);
  assert.equal(parsed?.filter, "retry");
});

test("parses Node.js built-in test output", () => {
  const parsed = parseNodeTest("ℹ tests 2\nℹ pass 2\nℹ fail 0\nℹ skipped 0\nℹ cancelled 0");
  assert.deepEqual({ framework: parsed?.framework, passed: parsed?.passed, failed: parsed?.failed, skipped: parsed?.skipped }, { framework: "node", passed: 2, failed: 0, skipped: 0 });
});

test("parses Jest and Vitest summaries", () => {
  const parsed = parseJestVitest("vitest\nTests: 1 failed, 8 passed, 2 skipped, 11 total");
  assert.equal(parsed?.framework, "vitest");
  assert.equal(parsed?.failed, 1);
  assert.equal(parsed?.passed, 8);
  assert.equal(parsed?.skipped, 2);
});

test("parses Go test output", () => {
  const parsed = parseGoTest("--- PASS: TestOne (0.01s)\n--- SKIP: TestTwo (0.00s)\n--- FAIL: TestThree (0.02s)");
  assert.deepEqual({ passed: parsed?.passed, skipped: parsed?.skipped, failed: parsed?.failed }, { passed: 1, skipped: 1, failed: 1 });
});

test("parses JUnit XML", () => {
  const parsed = parseJUnitXml('<testsuite tests="5" failures="1" errors="0" skipped="1"></testsuite>');
  assert.equal(parsed?.framework, "junit");
  assert.equal(parsed?.passed, 3);
  assert.equal(parsed?.failed, 1);
  assert.equal(parsed?.skipped, 1);
});

test("parses TAP output", () => {
  const parsed = parseTap("TAP version 13\n1..2\nok 1 - works\nnot ok 2 - broken # TODO");
  assert.equal(parsed?.passed, 1);
  assert.equal(parsed?.failed, 1);
  assert.equal(parsed?.skipped, 1);
});
