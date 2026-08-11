#!/usr/bin/env node
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { buildSync } = require("esbuild");

const PACKAGE_NAME = "@plasius/gpu-model-core";

async function main() {
  const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), "gpu-model-core-packcheck-"));
  try {
    const packResult = pack(temporaryRoot);
    const packedPaths = (packResult.files ?? []).map((entry) => entry.path);
    requirePackedPaths(packedPaths);
    rejectForbiddenPackedPaths(packedPaths);
    rejectUnexpectedPackedPaths(packedPaths);
    verifyNoForbiddenCodeReferences();

    if (typeof packResult.filename !== "string") {
      throw new Error("npm pack did not return a package filename.");
    }
    const consumerDirectory = path.join(temporaryRoot, "consumer");
    fs.mkdirSync(consumerDirectory, { recursive: true });
    execFileSync(
      "npm",
      [
        "install",
        "--prefix",
        consumerDirectory,
        "--ignore-scripts",
        "--no-save",
        "--no-package-lock",
        "--no-audit",
        "--no-fund",
        "--cache",
        path.join(temporaryRoot, "npm-cache"),
        path.join(temporaryRoot, packResult.filename),
      ],
      { stdio: ["ignore", "pipe", "pipe"] },
    );

    verifyInstalledManifest(consumerDirectory);
    verifyInstalledPublicText(consumerDirectory);
    verifyInstalledTypes(consumerDirectory);
    verifyBrowserBundle(consumerDirectory);
    verifyNodeEntrypoints(consumerDirectory);
    verifyInstalledCanonicalDependencies(consumerDirectory);
    console.log("Public package check passed.");
  } finally {
    fs.rmSync(temporaryRoot, { recursive: true, force: true });
  }
}

function pack(temporaryRoot) {
  const output = execFileSync(
    "npm",
    [
      "pack",
      "--json",
      "--ignore-scripts",
      "--pack-destination",
      temporaryRoot,
      "--cache",
      path.join(temporaryRoot, "npm-cache"),
    ],
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
  );
  const parsed = parseNpmPackJson(output);
  const result = Array.isArray(parsed) ? parsed[0] : undefined;
  if (!result || typeof result !== "object") {
    throw new Error("npm pack did not return one package result.");
  }
  return result;
}

function requirePackedPaths(paths) {
  const required = [
    "package.json",
    "README.md",
    "CHANGELOG.md",
    "LICENSE",
    "SECURITY.md",
    "CONTRIBUTING.md",
    "CODE_OF_CONDUCT.md",
    "CONTRIBUTORS.md",
    "docs/adrs/README.md",
    "docs/adrs/index.md",
    "docs/adrs/adr-template.md",
    "docs/adrs/adr-0001-gpu-model-core-package-boundary.md",
    "docs/adrs/adr-0002-dual-esm-cjs-distribution.md",
    "docs/adrs/adr-0003-dual-module-runtime-boundary.md",
    "docs/adrs/adr-0005-model-gpu-compatibility-contract.md",
    "docs/tdrs/tdr-0001-model-gpu-compatibility-parser-boundary.md",
    "docs/tdrs/index.md",
    "docs/design/model-gpu-compatibility-contract.md",
    "legal/CLA.md",
    "legal/INDIVIDUAL_CLA.md",
    "legal/CORPORATE_CLA.md",
    "dist/index.js",
    "dist/index.cjs",
    "dist/index.d.ts",
    "dist/index.d.cts",
  ];
  const missing = required.filter((requiredPath) => !paths.includes(requiredPath));
  if (missing.length > 0) {
    throw new Error(`Public package is missing required paths: ${missing.join(", ")}`);
  }
}

function rejectForbiddenPackedPaths(paths) {
  const patterns = [
    /(?:^|\/)plasius-ltd-site(?:\/|$)/iu,
    /(?:^|\/)(frontend|backend|dashboard|infra)(?:\/|$)/iu,
    /(?:^|\/)local\.settings(?:\.[^/]+)?\.json$/iu,
    /(?:^|\/)host\.json$/iu,
    /(?:^|\/)tsp-output(?:\/|$)/iu,
    /(?:^|\/)coverage(?:\/|$)/iu,
    /(?:^|\/)node_modules(?:\/|$)/iu,
    /(?:^|\/)CLA-REGISTRY(?:\.[^/]+)?$/iu,
    /\.csv$/iu,
    /[:\\]/u,
    /[^A-Za-z0-9._/-]/u,
  ];
  const forbidden = paths.filter((filePath) =>
    hasControlCharacter(filePath) || patterns.some((pattern) => pattern.test(filePath)),
  );
  if (forbidden.length > 0) {
    throw new Error(`Public package contains forbidden paths: ${forbidden.join(", ")}`);
  }
}

function hasControlCharacter(value) {
  return [...value].some((character) => {
    const codePoint = character.codePointAt(0);
    return codePoint !== undefined && (codePoint <= 0x1f || codePoint === 0x7f);
  });
}

function rejectUnexpectedPackedPaths(paths) {
  const exact = new Set([
    "package.json",
    "README.md",
    "CHANGELOG.md",
    "LICENSE",
    "SECURITY.md",
    "CONTRIBUTING.md",
    "CODE_OF_CONDUCT.md",
    "CONTRIBUTORS.md",
    "legal/CLA.md",
    "legal/INDIVIDUAL_CLA.md",
    "legal/CORPORATE_CLA.md",
  ]);
  const allowed = paths.filter((filePath) => {
    if (exact.has(filePath)) return true;
    if (/^docs\/(?:adrs|tdrs|design)\/[A-Za-z0-9._/-]+\.md$/u.test(filePath)) return true;
    return /^dist\/index\.(?:js|cjs|d\.ts|d\.cts|js\.map|cjs\.map)$/u.test(filePath);
  });
  if (allowed.length !== paths.length) {
    const allowedSet = new Set(allowed);
    throw new Error(
      `Public package contains paths outside its allowlist: ${paths.filter((filePath) => !allowedSet.has(filePath)).join(", ")}`,
    );
  }
}

function verifyInstalledManifest(consumerDirectory) {
  const manifestPath = path.join(
    consumerDirectory,
    "node_modules",
    "@plasius",
    "gpu-model-core",
    "package.json",
  );
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  const root = manifest.exports?.["."];
  if (
    manifest.name !== PACKAGE_NAME
    || manifest.type !== "module"
    || manifest.sideEffects !== false
    || manifest.main !== "./dist/index.cjs"
    || manifest.module !== "./dist/index.js"
    || manifest.types !== "./dist/index.d.ts"
    || root?.types !== "./dist/index.d.ts"
    || root?.import !== "./dist/index.js"
    || root?.require !== "./dist/index.cjs"
    || manifest.exports?.["./package.json"] !== "./package.json"
  ) {
    throw new Error("Packed package manifest does not preserve the public ESM/CJS/type export contract.");
  }
  const expectedFiles = [
    "dist",
    "README.md",
    "CHANGELOG.md",
    "LICENSE",
    "SECURITY.md",
    "CONTRIBUTING.md",
    "CODE_OF_CONDUCT.md",
    "CONTRIBUTORS.md",
    "docs",
    "legal/CLA.md",
    "legal/INDIVIDUAL_CLA.md",
    "legal/CORPORATE_CLA.md",
  ];
  if (
    !Array.isArray(manifest.files)
    || JSON.stringify([...manifest.files].sort()) !== JSON.stringify([...expectedFiles].sort())
  ) {
    throw new Error("Packed package manifest files must equal the reviewed public allowlist.");
  }
}

function verifyInstalledCanonicalDependencies(consumerDirectory) {
  const manifestPath = path.join(
    consumerDirectory,
    "node_modules",
    "@plasius",
    "gpu-model-core",
    "package.json",
  );
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  const expected = {
    "@plasius/asset-contracts": "^0.3.1",
    "@plasius/gpu-shader": "^0.1.3",
  };
  const mismatches = Object.entries(expected).flatMap(([dependency, range]) =>
    manifest.dependencies?.[dependency] === range
      ? []
      : [`${dependency}: expected ${range}, received ${manifest.dependencies?.[dependency] ?? "missing"}`],
  );
  if (mismatches.length > 0) {
    throw new Error(`Packed package canonical dependency mismatch: ${mismatches.join("; ")}`);
  }
}

function verifyInstalledPublicText(consumerDirectory) {
  const packageRoot = path.join(
    consumerDirectory,
    "node_modules",
    "@plasius",
    "gpu-model-core",
  );
  const roots = ["README.md", "CHANGELOG.md", "CONTRIBUTING.md", "docs", "legal"];
  const files = roots.flatMap((relativePath) => {
    const fullPath = path.join(packageRoot, relativePath);
    return fs.statSync(fullPath).isDirectory()
      ? collectFiles(fullPath, new Set([".md"]))
      : [fullPath];
  });
  const patterns = [
    { label: "inherited schema package identity", regex: /@plasius\/schema/iu },
    { label: "inherited schema-library ADR", regex: /schema library purpose and scope/iu },
    { label: "public contributor agreement registry", regex: /CLA-REGISTRY/iu },
    { label: "non-portable external ADR authority", regex: /\bADR 0094\b/iu },
    { label: "malformed contributor mail link", regex: /\]\(mailtocontributors@/iu },
  ];
  for (const file of files) {
    const contents = fs.readFileSync(file, "utf8");
    const match = patterns.find((pattern) => pattern.regex.test(contents));
    if (match) {
      throw new Error(
        `Public package contains ${match.label} in ${path.relative(packageRoot, file)}.`,
      );
    }
  }
}

function verifyInstalledTypes(consumerDirectory) {
  const compilerPath = require.resolve("typescript/lib/tsc.js");
  fs.writeFileSync(
    path.join(consumerDirectory, "consumer.mts"),
    [
      `import { MODEL_GPU_COMPATIBILITY_FIELDS, readModelGpuCompatibility, type ModelAssetManifest } from "${PACKAGE_NAME}";`,
      `import { asSha256Hex, type GpuCompatibleModelResource } from "${PACKAGE_NAME}";`,
      `import { createModelAssetManifest } from "@plasius/asset-contracts";`,
      `const sha = asSha256Hex("0".repeat(64));`,
      `const manifest: ModelAssetManifest = createModelAssetManifest({`,
      `  assetKind: "model", assetId: "model-character", version: "2026.07.15-1",`,
      `  entrypoint: "model.glb", files: [{ path: "model.glb", byteLength: 4, sha256: sha, contentType: "model/gltf-binary", role: "model" }],`,
      `  sourceAdapter: "local-import", createdAt: "2026-07-15T00:00:00.000Z",`,
      `  gpuInterface: { interfaceId: "interface.character", interfaceVersion: "2026.07.15-1", manifestUri: "https://assets.example.invalid/interface.json", manifestSha256: sha, interfaceAbiHash: sha, modelAbiHash: sha },`,
      `  modelAbiHash: sha, providedSemantics: ["position"], defaultStyleProfile: null,`,
      `});`,
      "const resource: GpuCompatibleModelResource = manifest;",
      "void MODEL_GPU_COMPATIBILITY_FIELDS;",
      "void readModelGpuCompatibility(resource);",
    ].join("\n"),
  );
  fs.writeFileSync(
    path.join(consumerDirectory, "consumer.cts"),
    [
      `import core = require("${PACKAGE_NAME}");`,
      "void core.MODEL_GPU_COMPATIBILITY_FIELDS;",
      "void core.readModelGpuCompatibility;",
      "void core.asSha256Hex;",
    ].join("\n"),
  );
  const configPath = path.join(consumerDirectory, "tsconfig.json");
  fs.writeFileSync(configPath, JSON.stringify({
    compilerOptions: {
      target: "ES2022",
      module: "NodeNext",
      moduleResolution: "NodeNext",
      strict: true,
      noEmit: true,
      skipLibCheck: true,
    },
    files: ["consumer.mts", "consumer.cts"],
  }));
  execFileSync(process.execPath, [compilerPath, "--project", configPath], {
    cwd: consumerDirectory,
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function verifyBrowserBundle(consumerDirectory) {
  buildSync({
    stdin: {
      contents: [
        `import { asSha256Hex, parseCanonicalModelGpuCompatibility, readModelGpuCompatibility } from "${PACKAGE_NAME}";`,
        "globalThis.__gpuModelCore = { asSha256Hex, parseCanonicalModelGpuCompatibility, readModelGpuCompatibility };",
      ].join("\n"),
      resolveDir: consumerDirectory,
      sourcefile: "browser-consumer.mjs",
    },
    bundle: true,
    format: "esm",
    logLevel: "silent",
    platform: "browser",
    write: false,
  });
}

function verifyNodeEntrypoints(consumerDirectory) {
  const esm = `
    const core = await import("${PACKAGE_NAME}");
    if (typeof core.asSha256Hex !== "function") process.exit(1);
    if (typeof core.parseCanonicalModelGpuCompatibility !== "function") process.exit(1);
    if (typeof core.readModelGpuCompatibility !== "function") process.exit(1);
  `;
  const cjs = `
    const core = require("${PACKAGE_NAME}");
    if (typeof core.asSha256Hex !== "function") process.exit(1);
    if (typeof core.parseCanonicalModelGpuCompatibility !== "function") process.exit(1);
    if (typeof core.readModelGpuCompatibility !== "function") process.exit(1);
  `;
  execFileSync(process.execPath, ["--input-type=module", "--eval", esm], {
    cwd: consumerDirectory,
    stdio: ["ignore", "pipe", "pipe"],
  });
  execFileSync(process.execPath, ["--eval", cjs], {
    cwd: consumerDirectory,
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function verifyNoForbiddenCodeReferences() {
  const patterns = [
    { label: "private monorepo reference", regex: /\bplasius-ltd-site\b/iu },
    { label: "inherited schema package reference", regex: /@plasius\/schema/iu },
    { label: "proprietary PGP reference", regex: /\bpgp[-_a-z0-9]*\b/iu },
    { label: "proprietary Lunari reference", regex: /\blunari\b/iu },
    { label: "proprietary Pixelverse reference", regex: /\bpixelverse\b/iu },
  ];
  const extensions = new Set([".ts", ".tsx", ".js", ".mjs", ".cjs", ".json"]);
  const files = ["src", "tests", "demo"].flatMap((root) =>
    collectFiles(path.resolve(process.cwd(), root), extensions),
  );
  for (const file of files) {
    const contents = fs.readFileSync(file, "utf8");
    const match = patterns.find((pattern) => pattern.regex.test(contents));
    if (match) {
      throw new Error(
        `Public package contains ${match.label} in ${path.relative(process.cwd(), file)}.`,
      );
    }
  }
}

function collectFiles(root, extensions) {
  if (!fs.existsSync(root)) return [];
  const files = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const fullPath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      if (!new Set(["node_modules", "dist", "dist-cjs"]).has(entry.name)) {
        files.push(...collectFiles(fullPath, extensions));
      }
    } else if (entry.isFile() && extensions.has(path.extname(entry.name))) {
      files.push(fullPath);
    }
  }
  return files;
}

function parseNpmPackJson(rawOutput) {
  const start = rawOutput.indexOf("[");
  const end = rawOutput.lastIndexOf("]");
  if (start < 0 || end < start) {
    throw new Error("Could not find npm pack JSON payload in command output.");
  }
  return JSON.parse(rawOutput.slice(start, end + 1));
}

main().catch((cause) => {
  console.error(cause instanceof Error ? cause.message : cause);
  process.exit(1);
});
