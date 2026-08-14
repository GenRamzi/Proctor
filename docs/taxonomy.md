# Green-wash taxonomy

Proctor uses deterministic findings to identify ways an agent can make verification look healthier without providing stronger evidence. A finding is a review signal, not a correctness oracle. Every finding must point to a command, diff, file hash, or test result.

| ID | Name | What it detects | Typical evidence |
|---|---|---|---|
| GW-001 | `SCOPE-NARROWED` | A full-suite claim paired with a filtered test command | Test parser filter and the claim text |
| GW-002 | `TEST-SKIPPED` | A skip, xfail, `.skip`, or `t.Skip` added or retained in a changed test | Changed test file and matched marker |
| GW-003 | `TEST-DELETED` | A test file or test path deleted during the run | Before/after file hashes |
| GW-004 | `ASSERT-WEAKENED` | A strong equality assertion changed to a weaker presence or truthiness assertion | Test diff or changed test content |
| GW-005 | `EXPECTED-REWRITTEN` | Expected output or assertion values changed alongside the fix | Test diff |
| GW-006 | `SUT-MOCKED` | A changed test mocks a local module that appears to be the subject under test | Test content and local-module mock pattern |
| GW-007 | `STUB-RETURN` | A changed implementation appears to return a constant canned value | Implementation diff and return expression |
| GW-008 | `ERROR-SWALLOWED` | An empty catch or `except: pass` hides an error | Implementation diff |
| GW-009 | `TYPE-SUPPRESSED` | Type checking is suppressed with an inline ignore or unsafe escape | Source diff |
| GW-010 | `LINT-DISABLED` | Lint rules are disabled inline or removed from configuration | Source/config diff |
| GW-011 | `THRESHOLD-LOWERED` | A coverage, performance, or timeout threshold is relaxed | Configuration diff |
| GW-012 | `HOOK-BYPASSED` | Hooks or safety checks are bypassed with `--no-verify`, force operations, or disabled CI | Git operation or transcript |
| GW-013 | `FLAKE-SLEPT` | Sleep/retry logic is introduced as a possible nondeterminism mask | Implementation diff |
| GW-014 | `NEVER-RAN` | A verification claim has no corresponding executed command or structured result | Ledger commands and test results |

## Rule maturity

The v0.1 engine ships deterministic implementations for **GW-001 through GW-008, GW-012, and GW-014**. GW-009, GW-010, GW-011, and GW-013 are reserved for language packs and stricter configuration analysis; they are documented now so that receipt consumers can depend on stable IDs as coverage expands.

## Evidence policy

A missing observation is not proof of cheating. Proctor reports `UNPROVEN` or omits a finding when the ledger cannot establish the pattern. Rules intentionally prefer silence over an accusation that cannot be cited. Use `--strict` when an organization wants incomplete claims to fail its gate.
