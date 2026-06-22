# Task: Build API Routes for SelfBase

## Summary
Created all 6 API route groups (21 route files total) with complete, functional implementations for the SelfBase backend-as-a-service platform.

## Files Created

### Utility Modules
- `src/lib/api-utils.ts` - Shared response helpers (successResponse, errorResponse, notFoundResponse, parseBody, getParams)
- `src/lib/embedding.ts` - Hash-based text embedding (128-dim) with cosine similarity for semantic search

### AI Layer (`src/app/api/ai/`)
| Route | Methods | Description |
|-------|---------|-------------|
| `llm-config/route.ts` | GET, POST | List/add LLM providers (masks API keys in response) |
| `llm-config/[id]/route.ts` | PUT, DELETE | Update/delete provider |
| `chat/route.ts` | POST | LLM chat completion via z-ai-web-dev-sdk, logs to LlmCall |
| `embed/route.ts` | POST | Generate embedding for text, optionally store with row/table |
| `search/route.ts` | POST | Semantic search using cosine similarity on stored embeddings |
| `rag/route.ts` | POST | RAG pipeline - retrieve by similarity + LLM generate with context |
| `calls/route.ts` | GET | LLM call history with pagination and filtering |

### Functions (`src/app/api/functions/`)
| Route | Methods | Description |
|-------|---------|-------------|
| `route.ts` | GET, POST | List/create serverless functions |
| `[id]/route.ts` | GET, PUT, DELETE | CRUD for individual function |
| `[id]/run/route.ts` | POST | Execute function code (sandboxed Function constructor) |
| `runs/route.ts` | GET | List all function runs with filtering |

### Storage (`src/app/api/storage/`)
| Route | Methods | Description |
|-------|---------|-------------|
| `route.ts` | GET, POST | List files / upload via multipart form |
| `[id]/route.ts` | GET, DELETE | File info + download / delete file |
| `upload-url/route.ts` | POST | Generate presigned upload URL token |

### Logs (`src/app/api/logs/`)
| Route | Methods | Description |
|-------|---------|-------------|
| `route.ts` | GET | List all errors with type/source/date filtering + summary |
| `source-errors/route.ts` | GET | Pipeline/scraper source errors with source grouping |
| `function-errors/route.ts` | GET | Function run errors with function grouping |

### Priority Queue (`src/app/api/queue/`)
| Route | Methods | Description |
|-------|---------|-------------|
| `route.ts` | GET, POST | List deferred requests / add to queue with load score |
| `drain/route.ts` | POST | Process queued requests based on system load |
| `[id]/route.ts` | GET, DELETE | Request status / cancel request |

### Data Access v1 (`src/app/api/v1/`)
| Route | Methods | Description |
|-------|---------|-------------|
| `data/[table]/route.ts` | GET | Fetch table data with ETag versioning (local-first sync) |
| `version/[table]/route.ts` | HEAD | Check table version via ETag header |

## Key Implementation Details

1. **AI SDK**: Uses `z-ai-web-dev-sdk` via `ZAI.create()` → `zai.chat.completions.create()` for chat/RAG
2. **Embeddings**: Hash-based 128-dim vectorization with cosine similarity (production would use real embedding models)
3. **Function Execution**: Sandboxed via `new Function()` constructor with timeout support
4. **File Storage**: Physical files in `/home/z/my-project/storage/`, metadata in SQLite
5. **Queue Load Score**: Weighted calculation from heartbeat metrics (CPU 40%, RAM 30%, connections 20%, req/s 10%)
6. **Local-first Sync**: SHA-256 based version hashing, ETag/If-None-Match conditional responses, 304 Not Modified
7. **Consistent Response Format**: `{ success: boolean, data?: any, error?: string }`

## Verified Endpoints
All 21 routes tested successfully with curl against the running dev server.
