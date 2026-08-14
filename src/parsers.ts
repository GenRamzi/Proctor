import { createHash } from "node:crypto";
import type { TestResult } from "./types.js";

function hash(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function number(value: string | undefined): number {
  return value ? Number.parseInt(value, 10) || 0 : 0;
}

function result(framework: TestResult["framework"], source: string, passed: number, failed: number, skipped: number, errors = 0, filter?: string): TestResult {
  return { framework, source, passed, failed, skipped, errors, total: passed + failed + skipped + errors, filter, rawHash: hash(source) };
}

export function parsePytest(text: string, source = "pytest-output"): TestResult | undefined {
  const passed = text.match(/(\d+)\s+passed\b/i)?.[1];
  const failed = text.match(/(\d+)\s+failed\b/i)?.[1];
  const skipped = text.match(/(\d+)\s+(?:skipped|xfailed)\b/i)?.[1];
  const errors = text.match(/(\d+)\s+errors?\b/i)?.[1];
  if (!passed && !failed && !skipped && !errors) return undefined;
  const command = text.match(/pytest(?:\s+[^\n]*?)(?:\s+-k\s+([^\n]+)|\s+([^\n]*\.py[^\n]*))/i);
  const filter = command?.[1]?.trim();
  return result("pytest", source, number(passed), number(failed), number(skipped), number(errors), filter);
}

export function parseNodeTest(text: string, source = "node-test-output"): TestResult | undefined {
  const normalized = text.replace(/\u001b\[[0-?]*[ -\/]*[@-~]/g, "").replace(/\r/g, "");
  if (!/(?:^|\n)\s*ℹ\s+tests\s+\d+/i.test(normalized) || !/(?:^|\n)\s*ℹ\s+pass\s+\d+/i.test(normalized)) return undefined;
  const read = (label: string) => number(normalized.match(new RegExp(`(?:^|\\n)\\s*ℹ\\s+${label}\\s+(\\d+)`, "im"))?.[1]);
  return result("node", source, read("pass"), read("fail"), read("skipped"), read("cancelled"));
}

export function parseJestVitest(text: string, source = "jest-vitest-output"): TestResult | undefined {
  if (!/(?:Tests:|\bJest\b|\bVitest\b)/i.test(text)) return undefined;
  const summary = text.match(/Tests:\s*(?:(\d+)\s+failed,\s*)?(?:(\d+)\s+passed,\s*)?(?:(\d+)\s+skipped,\s*)?(\d+)\s+total/i)
    ?? text.match(/(\d+)\s+passed(?:,\s*(\d+)\s+failed)?(?:,\s*(\d+)\s+skipped)?/i);
  if (!summary) return undefined;
  const failed = number(summary[1]);
  const passed = summary[2] ? number(summary[2]) : number(summary[1]);
  const skipped = summary[3] ? number(summary[3]) : 0;
  const total = summary[4] ? number(summary[4]) : passed + failed + skipped;
  const framework: TestResult["framework"] = /vitest/i.test(text) ? "vitest" : "jest";
  return { ...result(framework, source, passed, failed, skipped), total, rawHash: hash(source) };
}

export function parseGoTest(text: string, source = "go-test-output"): TestResult | undefined {
  const pass = [...text.matchAll(/^---\s+PASS:/gm)].length;
  const fail = [...text.matchAll(/^---\s+FAIL:/gm)].length;
  const skip = [...text.matchAll(/^---\s+SKIP:/gm)].length;
  if (pass + fail + skip === 0 && !/\bPASS\b|\bFAIL\b/.test(text)) return undefined;
  return result("go", source, pass, fail, skip);
}

export function parseJUnitXml(text: string, source = "junit.xml"): TestResult | undefined {
  const suite = text.match(/<testsuite\b[^>]*>/i);
  if (!suite) return undefined;
  const attr = (name: string) => suite[0].match(new RegExp(`${name}=["'](\\d+)["']`, "i"))?.[1];
  return result("junit", source, number(attr("tests")) - number(attr("failures")) - number(attr("errors")) - number(attr("skipped")), number(attr("failures")), number(attr("skipped")), number(attr("errors")));
}

export function parseTap(text: string, source = "tap-output"): TestResult | undefined {
  if (!/^TAP version/m.test(text) && !/^\s*(?:not )?ok\b/m.test(text)) return undefined;
  const passed = [...text.matchAll(/^\s*ok\b/gm)].length;
  const failed = [...text.matchAll(/^\s*not ok\b/gm)].length;
  const skipped = [...text.matchAll(/#\s*(?:SKIP|TODO)\b/gi)].length;
  return result("tap", source, passed, failed, skipped);
}

export function parseTestOutput(text: string, source = "transcript"): TestResult[] {
  const parsed = [parsePytest(text, source), parseNodeTest(text, source), parseJestVitest(text, source), parseGoTest(text, source), parseJUnitXml(text, source), parseTap(text, source)].filter((item): item is TestResult => Boolean(item));
  return parsed.length ? parsed : [];
}
