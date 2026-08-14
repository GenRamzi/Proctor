export const RECEIPT_SCHEMA_VERSION = 1;

export type Verdict = "PROVEN" | "CONTRADICTED" | "UNPROVEN" | "UNVERIFIABLE";
export type FindingSeverity = "low" | "medium" | "high" | "critical";

export interface EvidenceRef {
  id: string;
  kind: "command" | "file" | "diff" | "test" | "git" | "transcript" | "receipt";
  label: string;
  detail: string;
  hash?: string | undefined;
  line?: number | undefined;
}

export interface CommandRecord {
  id: string;
  argv: string[];
  cwd: string;
  startedAt: string;
  endedAt: string;
  durationMs: number;
  exitCode: number | null;
  signal?: string | undefined;
  actuallyRan: boolean;
  outputHash?: string | undefined;
  sensitive: boolean;
}

export interface FileMutation {
  path: string;
  status: "added" | "modified" | "deleted" | "renamed" | "untracked";
  beforeHash?: string | undefined;
  afterHash?: string | undefined;
  diff?: string | undefined;
  outsideGit: boolean;
}

export interface TestResult {
  framework: "pytest" | "node" | "jest" | "vitest" | "go" | "junit" | "tap" | "unknown";
  source: string;
  passed: number;
  failed: number;
  skipped: number;
  errors: number;
  total: number;
  filter?: string | undefined;
  files?: string[] | undefined;
  rawHash?: string | undefined;
}

export interface GitOperation {
  command: string;
  flags: string[];
  cwd: string;
  timestamp: string;
  risk: "normal" | "sensitive";
}

export interface Snapshot {
  capturedAt: string;
  gitHead?: string | undefined;
  trackedHash: string;
  files: Record<string, string>;
  contents?: Record<string, string> | undefined;
}

export interface Ledger {
  runId: string;
  startedAt: string;
  endedAt: string;
  cwd: string;
  command: string[];
  exitCode: number;
  transcript: string;
  transcriptHash: string;
  commands: CommandRecord[];
  mutations: FileMutation[];
  tests: TestResult[];
  gitOperations: GitOperation[];
  before: Snapshot;
  after: Snapshot;
  chain: string[];
}

export interface Claim {
  id: string;
  text: string;
  kind: "test" | "file" | "change" | "coverage" | "compatibility" | "generic";
  verdict: Verdict;
  evidence: EvidenceRef[];
  reason: string;
}

export interface Finding {
  id: string;
  title: string;
  severity: FindingSeverity;
  path?: string;
  line?: number | undefined;
  message: string;
  evidence: EvidenceRef[];
}

export interface IntegrityScore {
  score: number;
  label: "strong" | "caution" | "weak" | "failed";
  deductions: Array<{ reason: string; points: number }>;
}

export interface ReceiptSignature {
  algorithm: "Ed25519";
  publicKey: string;
  signature: string;
}

export interface Receipt {
  schemaVersion: number;
  tool: { name: "proctor"; version: string };
  runId: string;
  createdAt: string;
  cwd: string;
  command: string[];
  ledger: Ledger;
  claims: Claim[];
  findings: Finding[];
  integrity: IntegrityScore;
  status: "PASSED" | "FAILED";
  signed?: ReceiptSignature;
}

export interface VerifyOptions {
  strict?: boolean;
  claimText?: string;
  reportJson?: boolean;
}

export interface RunOptions {
  cwd: string;
  receiptDir?: string | undefined;
  transcriptPath?: string | undefined;
  ignorePath?: string | undefined;
}
