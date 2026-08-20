import { describe, expect, it } from "vitest";
import { validateNoteContent } from "./note-service";

describe("note service validation", () => {
  it("trims note content before persistence", () => {
    expect(validateNoteContent("  Acompanhamento realizado.  ")).toBe("Acompanhamento realizado.");
  });

  it("requires note content", () => {
    expect(() => validateNoteContent("   ")).toThrow("conteúdo da nota é obrigatório");
  });
});
