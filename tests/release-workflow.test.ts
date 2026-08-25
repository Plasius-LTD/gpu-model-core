import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const readWorkflow = (name: string): string =>
  readFileSync(resolve(process.cwd(), `.github/workflows/${name}.yml`), "utf8");
const cdWorkflow = readWorkflow("cd");
const ciWorkflow = readWorkflow("ci");

const section = (source: string, start: string, end: string): string => {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex + start.length);
  if (startIndex < 0 || endIndex < 0) {
    throw new Error(`Workflow section not found: ${start} -> ${end}`);
  }
  return source.slice(startIndex, endIndex);
};

describe("package release trust boundary", () => {
  it("uses exact-main hosted OIDC with a bounded first-publication bootstrap", () => {
    expect(cdWorkflow).toContain("runs-on: ubuntu-latest");
    expect(cdWorkflow).toContain("environment: production");
    expect(cdWorkflow).toContain("id-token: write");
    expect(cdWorkflow).toContain("Enforce exact-main successful CI");
    expect(cdWorkflow).toContain("refs/remotes/origin/main");
    expect(cdWorkflow).toContain("-f branch=main");
    expect(cdWorkflow).toContain("-f event=push");
    expect(cdWorkflow).toContain('-f head_sha="${EXPECTED_SHA}"');
    expect(cdWorkflow).toContain('conclusion == "success"');
    expect(cdWorkflow).toContain("Verify release runtime");
    expect(cdWorkflow).toContain('ACTUAL_NODE%%.*');
    expect(cdWorkflow).toContain('"11.5.1"');
    expect(cdWorkflow).toContain("--provenance");
    expect(cdWorkflow).toContain("bootstrap_first_publish:");
    expect(cdWorkflow).toContain('PACKAGE_VERSION}" != "0.1.0"');
    expect(cdWorkflow).toContain('npm view "${PACKAGE_NAME}" name');
    expect(cdWorkflow).toContain("secrets.NPM_BOOTSTRAP_TOKEN");
    expect(cdWorkflow).toContain("trap cleanup EXIT");
    expect(cdWorkflow).toContain("--ignore-scripts --userconfig");
    expect(cdWorkflow).toContain("inputs.bootstrap_first_publish != true");
    expect(cdWorkflow).not.toMatch(/NPM_TOKEN|NODE_AUTH_TOKEN/u);
  });

  it("isolates pull-request CI on ephemeral hosted runners", () => {
    expect(ciWorkflow).toContain("pull_request:");
    expect(ciWorkflow).toContain(
      "fromJSON(github.event_name == 'pull_request' && '[\"ubuntu-latest\"]' || '[\"self-hosted\",\"Linux\",\"X64\"]')",
    );
    expect(ciWorkflow).toContain("github.event.pull_request.head.repo.full_name == github.repository");
    expect(ciWorkflow).not.toContain("pull_request_target");
    expect(ciWorkflow).not.toContain("fromJSON(vars.");
  });

  it("forwards only an explicit first-publication bootstrap through prepare and never falls back to it", () => {
    const bootstrapInput = section(cdWorkflow, "      bootstrap_first_publish:", "\n\npermissions:");
    const queuePublish = section(cdWorkflow, "  queue_publish:", "\n  validate_and_pack:");
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
    expect(queuePublish).toContain("BOOTSTRAP_FIRST_PUBLISH: ${{ inputs.bootstrap_first_publish }}");
    expect(queuePublish).toContain('--arg bootstrap_first_publish "${BOOTSTRAP_FIRST_PUBLISH}"');
    expect(queuePublish).toContain('"bootstrap_first_publish": $bootstrap_first_publish');
    expect(queuePublish).not.toContain('"bootstrap_first_publish": "false"');

    expect(bootstrapBoundary).toContain("inputs.bootstrap_first_publish == true");
    expect(bootstrapBoundary).toContain('PACKAGE_VERSION}" != "0.1.0"');
    expect(bootstrapBoundary).toContain('npm view "${PACKAGE_NAME}" name');
    expect(bootstrapBoundary).toContain("E404");
    expect(bootstrapBoundary).toContain("Unable to prove that the package is absent");

    expect(bootstrapPublish).toContain("inputs.bootstrap_first_publish == true");
    expect(bootstrapPublish).toContain("secrets.NPM_BOOTSTRAP_TOKEN");
    expect(bootstrapPublish).not.toMatch(/failure\(\)|continue-on-error|steps\.[^\n]+\.outcome/u);
    expect(oidcPublish).toContain("inputs.bootstrap_first_publish != true");
    expect(oidcPublish).not.toMatch(/NPM_BOOTSTRAP|_authToken|userconfig/u);
    expect(cdWorkflow.match(/secrets\.NPM_BOOTSTRAP_TOKEN/gu)).toHaveLength(1);
  });
});
