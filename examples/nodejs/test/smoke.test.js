import test from "node:test";
import assert from "node:assert/strict";

test("returns a stable smoke-test result", () => {
  assert.equal([1, 2, 3].map((value) => value * 2).join(","), "2,4,6");
});
