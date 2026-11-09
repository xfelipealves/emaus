// Scripts CLI (tsx) não carregam .env sozinhos como o Next faz.
try {
  process.loadEnvFile(".env");
} catch {
  // sem .env: usa variáveis do ambiente
}
