import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { CreateCategoryForm, EditCategoryForm } from "./category-forms";

vi.mock("./actions", () => ({
  createCategoryAction: vi.fn(),
  updateCategoryAction: vi.fn(),
}));

describe("category administration forms", () => {
  it("offers a name and optional description when creating a category", () => {
    const markup = renderToStaticMarkup(<CreateCategoryForm />);

    expect(markup).toContain("Nova categoria");
    expect(markup).toContain('name="name"');
    expect(markup).toContain('name="description"');
    expect(markup).toContain("Criar categoria");
  });

  it("pre-fills category details for editing without a delete action", () => {
    const markup = renderToStaticMarkup(<EditCategoryForm category={{ id: "cat-1", name: "Culto de domingo", description: "Celebração semanal" }} />);

    expect(markup).toContain('name="categoryId"');
    expect(markup).toContain('value="cat-1"');
    expect(markup).toContain('value="Culto de domingo"');
    expect(markup).toContain("Celebração semanal");
    expect(markup).toContain("Salvar alterações");
    expect(markup).not.toContain("Excluir");
  });
});
