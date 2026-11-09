import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { AccountResetForm } from "./account-reset-form";

vi.mock("./actions", () => ({ resetAccountPasswordAction: vi.fn() }));

describe("administrator account reset form", () => {
  it("selects the account to reset and collects one new password", () => {
    const markup = renderToStaticMarkup(
      <AccountResetForm
        accounts={[
          { id: "account-1", personName: "Pessoa Um", username: "pessoa-um" },
          { id: "account-2", personName: "Pessoa Dois", username: "pessoa-dois" },
        ]}
        defaultAccountId="account-2"
      />,
    );

    expect(markup).toContain("Redefinir senha manualmente");
    expect(markup).toContain('name="accountId"');
    expect(markup).toContain('value="account-2" selected=""');
    expect(markup).toContain('name="password"');
    expect(markup).toContain('type="password"');
    expect(markup).toContain("Nova senha");
    expect(markup).toContain("Redefinir senha");
  });
});
