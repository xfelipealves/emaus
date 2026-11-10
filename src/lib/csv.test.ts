import { describe, expect, it } from "vitest";
import { guessMapping, parseCsv, parseDate, parseStatus } from "./csv";

describe("csv", () => {
  it("reconhece cabeçalhos comuns em português", () => {
    const { headers } = parseCsv("Nome;Telefone;Data de Nascimento;Situação\nAna;11999;01/02/1990;Membro\n");
    expect(guessMapping(headers)).toMatchObject({
      fullName: "Nome",
      phone: "Telefone",
      birthDate: "Data de Nascimento",
      status: "Situação",
    });
  });

  it("converte datas brasileiras", () => {
    expect(parseDate("01/02/1990")).toBe("1990-02-01");
    expect(parseDate("1990-2-1")).toBe("1990-02-01");
    expect(parseDate("31/13/1990")).toBeUndefined();
    expect(parseDate("")).toBeUndefined();
  });

  it("interpreta status", () => {
    expect(parseStatus("Membro")).toBe("member");
    expect(parseStatus("visitante")).toBe("visitor");
    expect(parseStatus("Afastado")).toBe("inactive");
  });
});

describe("toCsv", () => {
  it("neutraliza fórmulas de planilha", async () => {
    const { toCsv } = await import("./csv");
    expect(toCsv([{ Nome: "=HYPERLINK(\"http://x\")" }])).toContain("'=HYPERLINK");
  });
});
