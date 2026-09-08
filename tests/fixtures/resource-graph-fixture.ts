/** Synthetic conversion package descriptors; payloads come from the verified model fixture. */
export function resourceGraphFixture() {
  return {
    resources: [
      { resourceId: "buffer-main", location: { kind: "embedded" }, exportEmbeddingPolicy: "inherit-source" },
      { resourceId: "image-main", location: { kind: "external", relativePath: "textures/fixture.png" }, exportEmbeddingPolicy: "prefer-external" },
    ],
    packages: [
      { id: "surface", members: [{ kind: "material", id: "material-main" }] },
      { id: "conversion", members: [
        { kind: "package", id: "surface" }, { kind: "skin", id: "skin-main" },
        { kind: "animation", id: "animation-main" }, { kind: "provenance", id: "source" },
      ] },
    ],
  };
}
