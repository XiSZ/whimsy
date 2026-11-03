import { describe, expect, it } from "vitest";
import { onAccentColor } from "./settings";

describe("onAccentColor", () => {
  it("puts dark text on light accents and white text on dark ones", () => {
    expect(onAccentColor("#ffcf94")).toBe("#0a0c16"); // default peach
    expect(onAccentColor("#7dd3fc")).toBe("#0a0c16");
    expect(onAccentColor("#3a3a3a")).toBe("#fff"); // dark grey
    expect(onAccentColor("#6b4d87")).toBe("#fff");
  });
});
