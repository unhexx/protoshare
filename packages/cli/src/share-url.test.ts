import { describe, expect, it } from "vitest";
import { resolveShareUrl } from "./share-url.ts";

const live = "https://checkout.share.zrok.io";
const remote = "https://cdn.example/checkout/gallery.tgz";
const gallery = "http://127.0.0.1:4177";

describe("resolveShareUrl", () => {
  it("session: live > remote > gallery", () => {
    expect(resolveShareUrl({ live, remote, gallery }, "session")).toBe(live);
    expect(resolveShareUrl({ live, remote }, "session")).toBe(live);
    expect(resolveShareUrl({ live, gallery }, "session")).toBe(live);
    expect(resolveShareUrl({ remote, gallery }, "session")).toBe(remote);
    expect(resolveShareUrl({ live }, "session")).toBe(live);
    expect(resolveShareUrl({ remote }, "session")).toBe(remote);
    expect(resolveShareUrl({ gallery }, "session")).toBe(gallery);
    expect(resolveShareUrl({}, "session")).toBeUndefined();
  });

  it("catalog: remote > live > gallery", () => {
    expect(resolveShareUrl({ live, remote, gallery }, "catalog")).toBe(remote);
    expect(resolveShareUrl({ live, remote }, "catalog")).toBe(remote);
    expect(resolveShareUrl({ remote, gallery }, "catalog")).toBe(remote);
    expect(resolveShareUrl({ live, gallery }, "catalog")).toBe(live);
    expect(resolveShareUrl({ live }, "catalog")).toBe(live);
    expect(resolveShareUrl({ remote }, "catalog")).toBe(remote);
    expect(resolveShareUrl({ gallery }, "catalog")).toBe(gallery);
    expect(resolveShareUrl({}, "catalog")).toBeUndefined();
  });

  it("пустые строки не считаются URL", () => {
    expect(resolveShareUrl({ live: "", remote, gallery }, "session")).toBe(remote);
    expect(resolveShareUrl({ live, remote: "", gallery }, "catalog")).toBe(live);
    expect(resolveShareUrl({ live: "", remote: "", gallery: "" }, "session")).toBeUndefined();
    expect(resolveShareUrl({ live: "", remote: "", gallery: "" }, "catalog")).toBeUndefined();
  });
});
