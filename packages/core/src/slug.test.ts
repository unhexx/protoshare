import { describe, expect, it } from "vitest";
import { toShareSlug } from "./slug.ts";

describe("toShareSlug", () => {
  it("нормализует заголовок в короткий slug", () => {
    expect(toShareSlug("Button / Primary")).toBe("button-primary");
  });

  it("для пустого имени даёт preview", () => {
    expect(toShareSlug("   ")).toBe("preview");
  });
});
