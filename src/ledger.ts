import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import fg from "fast-glob";
import picomatch from "picomatch";
import pty from "node-pty";
import type { CommandRecord, FileMutation, GitOperation, Ledger, RunOptions, Snapshot } from "./types.js";

const SECRET_PATTERNS = [
  /(api[_-]?key|token|secret|password)\s*[=:]\s*[^\s]+/gi,
  /ghp_[A-Za-z0-9_]+/g,
  /sk-[A-Za-z0-9_-]+/g,
  /-----BEGIN [A-Z ]+ PRIVATE KEY-----[\s\S]*?-----END [A-Z ]+ PRIVATE KEY-----/g,
];

export function sha256(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

export function redactSecrets(value: string): string {
  return SECRET_PATTERNS.reduce((result, pattern) => result.replace(pattern, (match) => {
    if (/^(?:ghp_|sk-)/.test(match)) return "[REDACTED TOKEN]";
    if (/^-----BEGIN /.test(match)) return "[REDACTED PRIVATE KEY]";
    const separator = match.includes("=") ? "=" : ": ";
    const key = match.split(/[=:]/, 1)[0] ?? "secret";
    return `${key}${separator}[REDACTED]`;
  }), value);
}

function git(cwd: string, args: string[]): string {
  try {
    return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return "";
  }
}

function loadIgnore(cwd: string, path?: string): ((file: string) => boolean) {
  const ignoreFile = path ?? join(cwd, ".proctorignore");
  const patterns = existsSync(ignoreFile)
    ? readFileSync(ignoreFile, "utf8").split(/\r?\n/).map((line) => line.trim()).filter((line) => line && !line.startsWith("#"))
    : [];
  const matchers = patterns.map((pattern) => picomatch(pattern, { dot: true }));
  return (file) => file === ".proctor" || matchers.some((matcher) => matcher(file) || matcher(`/${file}`));
}

export function snapshotWorkspace(cwd: string, ignorePath?: string): Snapshot {
  const root = resolve(cwd);
  const ignored = loadIgnore(root, ignorePath);
  const files = fg.sync(["**/*"], {
    cwd: root,
    dot: true,
    onlyFiles: true,
    unique: true,
    ignore: [".git/**", ".proctor/**", "node_modules/**", "dist/**"],
  }).filter((file) => !ignored(file));
  const hashes: Record<string, string> = {};
  const contents: Record<string, string> = {};
  for (const file of files) {
    try {
      const full = join(root, file);
      if (statSync(full).isFile()) {
        const data = readFileSync(full);
        hashes[file] = sha256(data);
        if (data.length < 1_000_000 && !data.includes(0)) contents[file] = data.toString("utf8");
      }
    } catch {
      // Files can disappear during a concurrent agent run; the absence is evidence itself.
    }
  }
  const head = git(root, ["rev-parse", "HEAD"]);
  const trackedHash = sha256(JSON.stringify(Object.entries(hashes).sort()));
  return { capturedAt: new Date().toISOString(), gitHead: head || undefined, trackedHash, files: hashes, contents };
}

function diffMutations(before: Snapshot, after: Snapshot, cwd: string): FileMutation[] {
  const all = new Set([...Object.keys(before.files), ...Object.keys(after.files)]);
  return [...all].sort().flatMap((path): FileMutation[] => {
    const beforeHash = before.files[path];
    const afterHash = after.files[path];
    if (beforeHash === afterHash) return [];
    const status: FileMutation["status"] = beforeHash === undefined ? "added" : afterHash === undefined ? "deleted" : "modified";
    const pathDiff = git(cwd, ["diff", "--no-ext-diff", "--unified=3", "HEAD", "--", path]) || undefined;
    const outsideGit = !git(cwd, ["ls-files", "--error-unmatch", "--", path]);
    return [{ path, status, beforeHash, afterHash, ...(pathDiff ? { diff: pathDiff } : {}), outsideGit }];
  });
}

function detectGitOperations(transcript: string, cwd: string): GitOperation[] {
  const operations: GitOperation[] = [];
  for (const line of transcript.split(/\r?\n/)) {
    const match = line.match(/(?:^|\$\s*)(git\s+(?:commit|push|checkout|reset|clean|restore|add|rebase|merge)\b.*)/);
    if (!match?.[1]) continue;
    const command = match[1].trim();
    const flags = command.split(/\s+/).filter((part) => part.startsWith("-"));
    const sensitive = flags.some((flag) => ["--no-verify", "--force", "-f", "--hard"].includes(flag)) || /git\s+clean\b/.test(command);
    operations.push({ command, flags, cwd, timestamp: new Date().toISOString(), risk: sensitive ? "sensitive" : "normal" });
  }
  return operations;
}

function chainRecords(commands: CommandRecord[], mutations: FileMutation[], transcript: string): string[] {
  const records = [
    ...commands.map((record) => JSON.stringify(record)),
    ...mutations.map((record) => JSON.stringify(record)),
    JSON.stringify({ transcriptHash: sha256(transcript) }),
  ];
  let previous = "0".repeat(64);
  return records.map((record) => {
    previous = sha256(`${previous}:${record}`);
    return previous;
  });
}

export async function runLedger(command: string[], options: RunOptions): Promise<Ledger> {
  if (command.length === 0) throw new Error("No command supplied. Use: proctor run -- <command> [args...]");
  const cwd = resolve(options.cwd);
  const started = new Date();
  const before = snapshotWorkspace(cwd, options.ignorePath);
  let transcript = "";
  let exitCode = 1;
  let signal: string | undefined;
  const child = pty.spawn(command[0]!, command.slice(1), {
    name: "xterm-color",
    cols: 160,
    rows: 48,
    cwd,
    env: { ...process.env, TERM: "xterm-256color" } as Record<string, string>,
  });
  child.onData((data) => {
    transcript += data;
    process.stdout.write(data);
  });
  await new Promise<void>((resolvePromise) => {
    child.onExit(({ exitCode: code, signal: childSignal }) => {
      exitCode = code;
      signal = childSignal ? String(childSignal) : undefined;
      resolvePromise();
    });
  });
  const ended = new Date();
  const safeTranscript = redactSecrets(transcript);
  const after = snapshotWorkspace(cwd, options.ignorePath);
  const mutations = diffMutations(before, after, cwd);
  const commandRecord: CommandRecord = {
    id: "cmd-001",
    argv: command,
    cwd,
    startedAt: started.toISOString(),
    endedAt: ended.toISOString(),
    durationMs: ended.getTime() - started.getTime(),
    exitCode,
    signal,
    actuallyRan: true,
    outputHash: sha256(safeTranscript),
    sensitive: command.some((part) => /token|secret|password|key/i.test(part)),
  };
  const gitOperations = detectGitOperations(safeTranscript, cwd);
  const ledger: Ledger = {
    runId: started.toISOString().replace(/[:.]/g, "-") ,
    startedAt: started.toISOString(),
    endedAt: ended.toISOString(),
    cwd,
    command,
    exitCode,
    transcript: safeTranscript,
    transcriptHash: sha256(safeTranscript),
    commands: [commandRecord],
    mutations,
    tests: [],
    gitOperations,
    before,
    after,
    chain: chainRecords([commandRecord], mutations, safeTranscript),
  };
  if (options.transcriptPath) {
    const { writeFileSync } = await import("node:fs");
    writeFileSync(options.transcriptPath, safeTranscript, "utf8");
  }
  return ledger;
}

export function findPrintedCommands(transcript: string): string[] {
  return transcript.split(/\r?\n/).flatMap((line) => {
    const match = line.match(/^\s*(?:\$|>)\s+(.+)$/);
    return match?.[1] ? [match[1]] : [];
  });
}
