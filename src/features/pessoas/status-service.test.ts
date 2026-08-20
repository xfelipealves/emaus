import { describe, expect, it } from "vitest";
import { validatePromotionInput } from "./status-service";

describe("Person status validation", () => {
  it("requires a phone when promoting a visitor", () => {
    expect(() =>
      validatePromotionInput({ phone: "   ", birthDate: new Date("1990-01-01T00:00:00.000Z") }),
    ).toThrow("Telefone é obrigatório para promover a membro.");
  });

  it("requires a birth date when promoting a visitor", () => {
    expect(() => validatePromotionInput({ phone: "(11) 99999-0000", birthDate: undefined as never })).toThrow(
      "Data de nascimento é obrigatória para promover a membro.",
    );
  });

  it("normalizes the promotion phone without changing the birth date", () => {
    const birthDate = new Date("1990-01-01T00:00:00.000Z");

    expect(validatePromotionInput({ phone: "  (11) 99999-0000  ", birthDate })).toEqual({
      phone: "(11) 99999-0000",
      birthDate,
    });
  });
});
