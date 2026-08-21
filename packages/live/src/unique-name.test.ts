import { describe, expect, it } from "vitest";
import { toZrokUniqueName } from "./unique-name.ts";

describe("toZrokUniqueName", () => {
  it("оставляет читаемый slug для vanity-хоста", () => {
    expect(toZrokUniqueName("button-primary")).toBe("button-primary");
  });

  it("нормализует заголовок в имя, допустимое для zrok", () => {
    expect(toZrokUniqueName("Checkout / Flow")).toBe("checkout-flow");
  });

  it("дописывает префикс, если имя начинается с цифры", () => {
    expect(toZrokUniqueName("2026-review")).toBe("p2026-review");
  });

  it("дополняет слишком короткое имя", () => {
    expect(toZrokUniqueName("ab")).toBe("ab-share");
  });

  it("возвращает undefined для пустого ввода", () => {
    expect(toZrokUniqueName("   ")).toBeUndefined();
    expect(toZrokUniqueName("---")).toBeUndefined();
  });
});
