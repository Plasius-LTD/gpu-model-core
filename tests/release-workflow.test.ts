import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const workflow = readFileSync(
  new URL("../.github/workflows/release-prepare.yml", import.meta.url),
  "utf8",
);
const ciWorkflow = readFileSync(
  new URL("../.github/workflows/ci.yml", import.meta.url),
  "utf8",
);
const cdWorkflow = readFileSync(
  new URL("../.github/workflows/cd.yml", import.meta.url),
  "utf8",
);

const section = (source: string, start: string, end: string): string => {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex + start.length);
  if (startIndex < 0 || endIndex < 0) {
    throw new Error(`Workflow section not found: ${start} -> ${end}`);
  }
  return source.slice(startIndex, endIndex);
};

describe("release preparation workflow", () => {
  it("does not let checkout credentials override the release-prep app token", () => {
    expect(workflow).toContain("persist-credentials: false");
  });

  it("retries a protected merge while required checks complete", () => {
    expect(workflow).toContain(
      'if gh pr merge "${PR_NUMBER}" --squash --delete-branch >/dev/null 2>&1; then',
    );
    expect(workflow).toContain(
      "merged after required checks completed.",
    );
  });

  it("runs trusted pull-request and exact-main validation on hosted runners", () => {
    expect(ciWorkflow).toContain("pull_request:");
    expect(ciWorkflow).toContain("name: Trusted head admission");
    expect(ciWorkflow.match(/^ {4}runs-on: ubuntu-latest$/gmu)).toHaveLength(3);
    expect(ciWorkflow).not.toContain("self-hosted");
  });

  it("preserves the Schema release contract with a bounded bootstrap extension", () => {
    expect(cdWorkflow).toContain("runs-on: ubuntu-latest");
    expect(cdWorkflow).toContain("environment: production");
    expect(cdWorkflow).toContain("id-token: write");
    expect(cdWorkflow).toContain("Wait for successful exact-SHA main CI");
    expect(cdWorkflow).toContain("refs/remotes/origin/main");
    expect(cdWorkflow).toContain("-f branch=main");
    expect(cdWorkflow).toContain("-f event=push");
    expect(cdWorkflow).toContain('-f head_sha="${EXPECTED_SHA}"');
    expect(cdWorkflow).toContain('conclusion == "success"');
    expect(cdWorkflow).toContain('"24.18.0"');
    expect(cdWorkflow).toContain('"11.5.1"');
    expect(cdWorkflow).toContain(
      "node scripts/verify-public-package.cjs --inventory-stdin",
    );
    expect(cdWorkflow).toContain('npm publish "./${TARBALL}"');
    expect(cdWorkflow).toContain("--provenance");
    expect(cdWorkflow).toContain("bootstrap_first_publish:");
    expect(cdWorkflow).toContain(
      'if: steps.release.outputs.should_publish_npm == \'true\' && inputs.bootstrap_first_publish != true',
    );
    expect(cdWorkflow).not.toMatch(/NPM_TOKEN|NODE_AUTH_TOKEN/u);
  });

  it("forwards only an explicit first-publication bootstrap and never falls back to it", () => {
    const bootstrapInput = section(
      cdWorkflow,
      "      bootstrap_first_publish:",
      "\n\npermissions:",
    );
    const queuePublish = section(
      cdWorkflow,
      "  queue_publish:",
      "\n  validate_and_pack:",
    );
    const bootstrapBoundary = section(
      cdWorkflow,
      "      - name: Enforce one-time first-publication boundary",
      "      - name: Publish first package with the one-time bootstrap credential",
    );
    const bootstrapPublish = section(
      cdWorkflow,
      "      - name: Publish first package with the one-time bootstrap credential",
      "      - name: Publish package through npm OIDC",
    );
    const oidcPublish = section(
      cdWorkflow,
      "      - name: Publish package through npm OIDC",
      "      - name: Skip duplicate npm publication",
    );

    expect(bootstrapInput).toContain("type: boolean");
    expect(bootstrapInput).toContain("default: false");
    expect(queuePublish).toContain(
      "BOOTSTRAP_FIRST_PUBLISH: ${{ inputs.bootstrap_first_publish }}",
    );
    expect(queuePublish).toContain(
      '--arg bootstrap_first_publish "${BOOTSTRAP_FIRST_PUBLISH}"',
    );
    expect(queuePublish).toContain(
      '"bootstrap_first_publish": $bootstrap_first_publish',
    );
    expect(queuePublish).not.toContain('"bootstrap_first_publish": "false"');

    expect(bootstrapBoundary).toContain("inputs.bootstrap_first_publish == true");
    expect(bootstrapBoundary).toContain('PACKAGE_VERSION}" != "0.1.0"');
    expect(bootstrapBoundary).toContain('npm view "${PACKAGE_NAME}" name');
    expect(bootstrapBoundary).toContain("E404");
    expect(bootstrapBoundary).toContain(
      "Unable to prove that the package is absent",
    );

    expect(bootstrapPublish).toContain("inputs.bootstrap_first_publish == true");
    expect(bootstrapPublish).toContain("secrets.NPM_BOOTSTRAP_TOKEN");
    expect(bootstrapPublish).not.toMatch(
      /failure\(\)|continue-on-error|steps\.[^\n]+\.outcome/u,
    );
    expect(oidcPublish).toContain("inputs.bootstrap_first_publish != true");
    expect(oidcPublish).not.toMatch(/NPM_BOOTSTRAP|_authToken|userconfig/u);
    expect(cdWorkflow.match(/secrets\.NPM_BOOTSTRAP_TOKEN/gu)).toHaveLength(1);
  });

  it("runs Schema privacy and sealed-package checks in CI", () => {
    expect(ciWorkflow.indexOf("Verify private artifact policy")).toBeLessThan(
      ciWorkflow.indexOf("Install deps"),
    );
    expect(ciWorkflow).toContain("Test private artifact policy");
    expect(ciWorkflow).toContain("Verify public package contents");
  });
});
