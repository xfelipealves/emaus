export type LoginInput = {
  username: string;
  password: string;
};

type LoginValidationSuccess = {
  success: true;
  data: LoginInput;
};

type LoginValidationFailure = {
  success: false;
  errors: {
    username?: string;
    password?: string;
  };
};

export type LoginValidationResult =
  | LoginValidationSuccess
  | LoginValidationFailure;

export function validateLoginInput(input: LoginInput): LoginValidationResult {
  const errors: LoginValidationFailure["errors"] = {};

  if (!input.username.trim()) {
    errors.username = "Informe o nome de usuário.";
  }

  if (!input.password.trim()) {
    errors.password = "Informe a senha.";
  }

  if (Object.keys(errors).length > 0) {
    return { success: false, errors };
  }

  return {
    success: true,
    data: {
      username: input.username.trim(),
      password: input.password,
    },
  };
}
