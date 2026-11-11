# LLM assistant engineering guide

[← Project overview](../README.md)

The assistant is an application agent over structured church-management data. The model chooses from a fixed tool catalog; server-side TypeScript validates arguments and executes domain operations using the current user’s permissions. The model is not given an arbitrary SQL execution tool.

## Request lifecycle

1. `POST /api/assistente` resolves the session and rejects unauthenticated users and accounts that must change their password.
2. The route checks provider configuration and the per-user rate limit, then validates a message of 1–4,000 characters with Zod. The rate limit is currently 20 requests per minute per user.
3. The agent creates or loads a conversation owned by that user. It checks the saved role/ministry scope and provider API kind, then locks an existing conversation against concurrent turns.
4. The prompt includes the church timezone, current date, user role, and scope. Tool definitions are generated from Zod schemas.
5. The provider loop streams text and collects tool calls. Each call passes through tool-name lookup, Zod validation, and the tool’s authorization/domain functions.
6. Tool results return to the model for another iteration. Execution is capped at 12 iterations per turn.
7. The agent saves conversation history and run metrics and emits a final event. Successful mutations receive audit records attributed to the user and marked “Via assistente”.

The route exports a 300-second maximum duration. Actual execution limits depend on the deployment platform and plan.

## Tool catalog

The names below are the public function names exposed to the model in [`tools.ts`](../src/server/ai/tools.ts).

| Query tool | Purpose |
| --- | --- |
| `buscar_pessoas` | Search and filter visible people. |
| `detalhes_pessoa` | Retrieve a person’s profile and contextual records. |
| `listar_ministerios` | List accessible ministries. |
| `detalhes_ministerio` | Inspect a ministry and its membership. |
| `listar_encontros` | Find events in a date range. |
| `presenca_encontro` | Inspect attendance for an event. |
| `panorama` | Retrieve a community overview. |
| `pessoas_sumidas` | Find people whose absence exceeds the care threshold. |
| `aniversariantes` | List upcoming birthdays. |
| `listar_acompanhamentos` | Retrieve follow-ups. |
| `buscar_anotacoes` | Search notes within the user’s access. |
| `listar_familias` | Retrieve household information. |

| Mutation tool | Purpose |
| --- | --- |
| `cadastrar_pessoa` | Create a person. |
| `atualizar_pessoa` | Update a person’s details. |
| `mudar_status` | Change status with domain history. |
| `registrar_presenca` | Record attendance for one or more people. |
| `adicionar_anotacao` | Add a note. |
| `criar_acompanhamento` | Create a follow-up. |
| `concluir_acompanhamento` | Complete a follow-up. |
| `adicionar_ao_ministerio` | Add a ministry membership. |
| `remover_do_ministerio` | End a ministry membership. |
| `criar_encontro` | Create an event. |
| `cancelar_encontro` | Cancel or reactivate an event. |

`excluir_pessoa` is the 24th tool. It does **not** delete a record: it resolves the person and returns a profile link with instructions to use the application’s deletion confirmation. It is not classified as a mutation by the tool registry.

## Provider configuration

Set keys on the server; never put them in a `NEXT_PUBLIC_*` variable. The model catalog and adapter implementation live in [`agent.ts`](../src/server/ai/agent.ts). The catalog describes configured defaults, not a guarantee of provider availability or current pricing.

| Provider ID | Environment variable | Adapter |
| --- | --- | --- |
| `openai` | `OPENAI_API_KEY` | OpenAI Responses API |
| `anthropic` | `ANTHROPIC_API_KEY` or `ANTHROPIC_AUTH_TOKEN` | Anthropic SDK |
| `groq` | `GROQ_API_KEY` | OpenAI-compatible chat |
| `cerebras` | `CEREBRAS_API_KEY` | OpenAI-compatible chat |
| `gemini` | `GEMINI_API_KEY` | Gemini’s OpenAI-compatible endpoint |
| `openai-compatible` | `EMAUS_AI_API_KEY` and `EMAUS_AI_BASE_URL` | Custom OpenAI-compatible chat endpoint |

Provider selection prefers a configured choice saved in **Configurações → IA**. Otherwise the agent tries `EMAUS_AI_PROVIDER`, followed by OpenAI, Groq, Cerebras, Gemini, and Anthropic. This is configuration selection, not automatic failover after a provider request fails. A custom compatible endpoint requires `EMAUS_AI_MODEL` when no saved model is selected.

```dotenv
EMAUS_AI_PROVIDER=openai-compatible
EMAUS_AI_BASE_URL=https://your-provider.example/v1
EMAUS_AI_API_KEY=your-server-side-key
EMAUS_AI_MODEL=your-tool-capable-model-id
EMAUS_AI_PRICE_IN=0
EMAUS_AI_PRICE_OUT=0
```

`EMAUS_AI_EFFORT` sets Responses API reasoning effort (`none`, `low`, `medium`, `high`; default `low`). The custom-endpoint price variables are USD per million tokens. A zero value produces a zero cost estimate; it does not make provider requests free.

Groq, Cerebras, and Gemini use the implementation’s lean mode: two historical turns, tool-result truncation to 4,000 characters, a smaller output allowance, and additional SDK retries for rate limits. Availability and commercial terms must be checked with the chosen provider.

## Streaming contract

The endpoint returns `application/x-ndjson`: one JSON event per line, rather than Server-Sent Events. The UI consumes these event types:

| Event | Meaning |
| --- | --- |
| `conversation` | Conversation ID and title. |
| `text` | A text delta for the assistant response. |
| `tool` | Tool name, label, arguments, and mutation flag. |
| `tool_result` | Execution success or a tool error. |
| `done` | Run ID, estimated cost in USD, and elapsed milliseconds. |
| `error` | A failure message. |

See the exported `AgentEvent` union and [`chat.tsx`](../src/app/%28app%29/assistente/chat.tsx) for the implementation. Provider adapters differ in how they deliver text; not every provider produces tokens at the same cadence.

## Authorization and data boundaries

- Queries and writes use the authenticated `CurrentUser`, including ministry scope.
- Confidential pastoral notes are filtered for administrators. Model instructions are an additional behavioral guard; server-side access checks enforce access.
- Conversations are owned by one user. A changed role or ministry scope prevents reuse of history captured under the previous scope. Legacy conversations without a scope key are restricted to administrators.
- Model instructions tell the assistant to obtain IDs and facts from tools, clarify ambiguity, and treat retrieved names and notes as data rather than instructions.
- Relevant prompts, conversation history, context, and tool results are sent to the configured provider. Structured retrieval still sends retrieved information to that provider.
- Prompts, conversation messages, run information, and feedback are stored in the application database. Limit administrative access and include these tables in data-retention and backup decisions.

## Failure behavior and limits

Mutations execute during the tool loop. There is no universal preview/approval gate or transaction spanning an entire conversation turn. A successful write remains committed if a later tool or model call fails; the agent preserves a consistent history boundary and tells the user to check completed changes before retrying.

An existing conversation has a five-minute lock. A process crash can leave it locked until expiry. Provider API-kind changes require a fresh conversation; choosing another model with the same API kind is not equivalent to a new conversation.

The assistant can misunderstand a request or produce an incorrect interpretation. Typed arguments and authorization checks do not establish answer accuracy. Large query results may be limited, and lean mode truncation reduces available context. The current test suite covers date, recurrence, and CSV utilities; it does not provide model evaluations, prompt-injection testing, or full assistant/permission regression coverage.

## Observability

Administrators can open **Configurações → IA** to inspect recent runs, input/output/cache tokens, estimated costs, p50/p95 latency, failures, tool usage, activity per user, and thumbs-up/down feedback. Estimates use the configured price table and are not provider billing reconciliation. Cache usage reflects provider-reported usage; it is not a cache of application query results.

## Verify an assistant change

Use only synthetic data and an isolated database. With your own configured provider, verify:

1. A read-only question produces tool calls and links to the expected records.
2. A ministry leader cannot retrieve a person outside their ministry scope or confidential notes.
3. An ambiguous name is clarified before writing.
4. A requested follow-up appears in the UI and audit history under the actor’s account.
5. A deletion request returns instructions and leaves the record intact until UI confirmation.
6. Concurrent messages, provider failures, and cancellation leave history and completed writes understandable.
7. A changed access scope prevents reopening old conversations, and run metrics and feedback remain visible to the appropriate user.

These are suggested verification scenarios, not a claim that a live-provider evaluation was run for this documentation update.
