# Upload de foto de perfil — especificação

**Status:** Draft para revisão; escopo confirmado pelo usuário em 27/09/2026. Esta frente supersede AD-005 por AD-011.

## Problema

RF-PES-004 exige que visitantes e membros possam adicionar e atualizar foto opcional. O modelo já tem `profilePhotoUrl`, mas a especificação consolidada e a decisão AD-005 mantinham upload fora do primeiro corte. O usuário decidiu incluir implementação nesta frente.

## Objetivos

- [ ] Permitir adicionar uma foto opcional ao perfil de visitante ou membro.
- [ ] Permitir substituir a foto atual sem tornar imagem obrigatória para cadastro ou promoção.
- [ ] Restringir exibição e alteração segundo autorização de acesso ao perfil.
- [ ] Preservar o perfil/timeline quando upload ou substituição falhar.

## Fora de escopo

| Item | Motivo |
|---|---|
| Mais de uma foto ativa por perfil | RF-PES-004 pede adicionar/atualizar, não galeria. |
| Foto como prova de identidade | Não faz parte do domínio. |
| Reconhecimento facial, extração biométrica ou análise automática | Fora do produto e não solicitado. |
| Anexo de imagens em notas | RF-TIM-003 exclui imagens/anexos de notas. |
| Consentimento específico novo em formulário | RNF-006 não exige campo no MVP; decisão jurídica futura permanece separada. |

## Premissas e decisões pendentes

| Tema | Padrão | Racional | Confirmado? |
|---|---|---|---|
| Status cobertos | Upload/atualização em perfil de visitante ou membro; foto ausente permitida em qualquer status | RF-PES-004. | Sim. |
| Substituição | Uma foto atual por perfil; a nova vira atual somente após sucesso | Atende “atualizar” sem criar galeria não requerida. | Derivado do requisito; confirmar em design. |
| Acesso | Só ator que já pode consultar/editar aquele perfil pode obter ou alterar a foto | Foto é dado pessoal e o escopo de pessoa já é aplicado a perfis. | Derivado de RF-ACS/RNF-006. |
| Tipo/tamanho/dimensões máximas | Devem ser escolhidos e validados no cliente e servidor durante Design | Requisitos não definem formato nem limites; não inventar valores aqui. | Em aberto antes de implementação. |
| Armazenamento, URL e retenção | Escolher mecanismo que não exponha foto sem autorização e trate substituição/exclusão | RNF-006 e campo de modelo não definem provedor. | Em aberto antes de implementação. |
| Auditoria | Registrar atualização como mudança de Pessoa, sem registrar bytes nem conteúdo da imagem | RNF-005 registra alterações de Pessoa. | Proposta para design. |

**Questões em aberto:** Design deve propor formatos permitidos, limite de tamanho/dimensões, validação de conteúdo real, armazenamento, entrega autenticada e remoção dos arquivos substituídos/inativos. Esses limites precisam de valor aprovado antes de implementação/testes de limite.

## Histórias e critérios de aceite

### P1 — Adicionar foto opcional

Como usuário autorizado, quero adicionar uma imagem ao perfil para reconhecê-lo visualmente.

1. **WHEN** ator autorizado abre perfil de visitante ou membro sem foto e envia imagem que atende aos limites definidos em Design **THEN** o sistema **SHALL** associá-la à Pessoa correta e exibi-la após o salvamento e recarga.
2. **WHEN** visitante é cadastrado ou promovido sem foto **THEN** o sistema **SHALL** permitir concluir a operação sem exigir imagem.
3. **WHEN** pessoa sem foto é exibida **THEN** o sistema **SHALL** manter alternativa visual por iniciais/estado sem imagem.
4. **WHEN** arquivo excede limite, tem tipo/conteúdo inválido ou falha no transporte **THEN** o sistema **SHALL** rejeitar upload com mensagem clara e não alterar estado existente do perfil.

**Teste independente:** anexar imagem QA válida ao perfil autorizado e verificar a mesma imagem após recarga; completar cadastro/promoção sem imagem; testar arquivo inválido sem alteração parcial.

### P1 — Substituir foto e proteger acesso

1. **WHEN** ator autorizado substitui foto atual por imagem válida **THEN** o sistema **SHALL** mostrar a nova foto após confirmação e recarga, mantendo uma única foto como atual.
2. **WHEN** substituição falha antes da conclusão **THEN** o sistema **SHALL** manter a foto anterior exibida e utilizável.
3. **WHEN** pessoa muda para inativa **THEN** o sistema **SHALL** preservar foto existente junto ao perfil histórico; status não provoca remoção inadvertida.
4. **WHEN** ator sem acesso ao perfil solicita exibição ou atualização da foto **THEN** o sistema **SHALL** negar a operação sem entregar conteúdo da imagem.
5. **WHEN** upload é aceito **THEN** o sistema **SHALL** auditar ator, data/hora, Pessoa e ação de atualização sem incluir bytes, credenciais ou URL pública sensível.

**Teste independente:** substituir foto no perfil QA, recarregar, verificar acesso permitido/negado em perfis com e sem escopo e confirmar que erro não remove a foto anterior.

## Casos de borda

- Clique duplo ou retentativa de upload não pode deixar múltiplas fotos ativas para a mesma Pessoa.
- Conteúdo com extensão permitida mas bytes de formato diferente é recusado conforme validação definida em Design.
- Falha de armazenamento não salva referência quebrada.
- Foto de Pessoa inativa permanece disponível apenas a quem pode consultar histórico.
- Erro ao processar/exibir a imagem tem fallback visual e não quebra perfil/timeline.
- Logs não armazenam arquivo, token, cookie ou dado sensível desnecessário.

## Rastreabilidade

| ID | Fonte | Critérios | Status |
|---|---|---|---|
| PHOTO-01 | RF-PES-004 | Adição 1–4 | Draft |
| PHOTO-02 | RF-PES-004, RF-PES-003 | Substituição 1–3 | Draft |
| PHOTO-03 | RF-ACS-007/008, RNF-006 | Proteção 4 | Draft |
| PHOTO-04 | RNF-005 | Proteção 5 | Draft |
| PHOTO-05 | AD-011 | Decisão de escopo | Confirmada |

**Cobertura:** 5 requisitos mapeados; limites e armazenagem devem ser definidos no Design antes das tarefas.

## Sucesso

- [ ] Visitante/membro com autorização consegue adicionar e substituir foto.
- [ ] Foto é opcional em todos os fluxos de cadastro/status.
- [ ] Acesso a foto acompanha permissão do perfil, inclusive para escopo do Líder.
- [ ] Erro de upload não perde foto atual nem corrompe o perfil.
