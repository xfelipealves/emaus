export type LoginInput = {
  username: string;
  password: string;
};

type LoginErrors = {
  username?: string;
  password?: string;
};

export type LoginValidation =
  | { success: true; data: LoginInput }
  | { success: false; errors: LoginErrors };

export function validateLoginInput(input: LoginInput): LoginValidation {
  const errors: LoginErrors = {};

  if (!input.username.trim()) {
    errors.username = "Nome de usuário é obrigatório";
  }

  if (!input.password.trim()) {
    errors.password = "Senha é obrigatória";
  }

  if (Object.keys(errors).length > 0) {
    return { success: false, errors };
  }

  return { success: true, data: input };
}
