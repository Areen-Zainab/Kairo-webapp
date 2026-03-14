# Meeting Memory Engine — Production Guide (pgvector)

This document describes how to use pgvector in production for the Meeting Memory Engine: storing embeddings for transcripts, summaries, action items, and decisions, and running semantic similarity search. FAISS is not used; all vector storage and search is in PostgreSQL via pgvector.

---

## 1. Embedding dimension: 1536

- **Use dimension 1536** for all embeddings stored in `meeting_embeddings.embedding` and `meeting_memory_contexts.summary_embedding`.
- This matches **OpenAI text-embedding-ada-002** and **text-embedding-3-small** (default). If you switch to another model, ensure the DB column type matches (e.g. `vector(1536)` or the new dimension).
- Do not mix dimensions in the same column; the column type is `vector(1536)`.

---

## 2. Chunk transcripts: 400–700 words per chunk

- Store **chunked** transcript text, not one giant blob per meeting.
- **Target chunk size: 400–700 words** per chunk. This balances context quality and retrieval accuracy.
- Use the existing `chunk_index` and `content_type` on `meeting_embeddings`:
  - `content_type`: `'transcript'`, `'summary'`, `'action_item'`, `'decision'`, `'topic'`, etc.
  - `chunk_index`: order of the chunk within that content (e.g. 0, 1, 2 for transcript chunks).
- One row per chunk: one `content` (text) and one `embedding` (vector). Create one embedding per chunk from your embedding API.

---

## 3. Filter by workspace

- **Always scope similarity search by workspace.** Do not search across all workspaces.
- `meeting_embeddings` is keyed by `meeting_id`; meetings are scoped by `workspace_id`. So filter via a join:

```sql
SELECT me.id, me.content, me.embedding <=> $1::vector(1536) AS distance
FROM meeting_embeddings me
JOIN meetings m ON m.id = me.meeting_id
WHERE m.workspace_id = $2
ORDER BY me.embedding <=> $1::vector(1536)
LIMIT $3;
```

- In application code, pass `workspaceId` (or `workspace_id`) and use it in the `WHERE` clause so results only come from that workspace.

---

## 4. Store cleaned chunks, not raw transcript

- **Store cleaned, meaningful text** in `meeting_embeddings.content`, not raw transcript dump.
- Clean by:
  - Trimming filler (e.g. “um”, “uh”), normalizing whitespace, and optional light punctuation normalization.
  - Keeping sentence boundaries so chunks are readable and semantically coherent.
- The same cleaning should be applied before sending text to the embedding API. What you store in `content` should match what was embedded (for debugging and display).

---

## 5. Use cosine similarity (`<=>`)

- **Use cosine distance** for similarity search. In pgvector, the operator is **`<=>`** (cosine distance).
- Our HNSW indexes are built with **`vector_cosine_ops`**, which supports `<=>`. Queries that use `ORDER BY embedding <=> $query_vector` can use the index.
- Example (with workspace filter):

```sql
SELECT me.id, me.meeting_id, me.content_type, me.content, me.embedding <=> $1::vector(1536) AS distance
FROM meeting_embeddings me
JOIN meetings m ON m.id = me.meeting_id
WHERE m.workspace_id = $2
ORDER BY me.embedding <=> $1::vector(1536)
LIMIT 20;
```

- Smaller distance = more similar. For “similarity score” in [0,1], you can use `1 - (distance / 2)` when needed (cosine distance is in [0, 2] for normalized vectors).

---

## 6. Rely on HNSW indexes

- **HNSW indexes are already created** for:
  - `meeting_embeddings.embedding` → `meeting_embeddings_embedding_idx`
  - `meeting_memory_contexts.summary_embedding` → `meeting_memory_contexts_summary_embedding_idx`
- Keep queries in the form that uses these indexes: `ORDER BY column <=> $vector` (and optional `WHERE` on other columns). Avoid wrapping the vector column in functions so the index can be used.
- Do not drop these indexes in production; they make similarity search fast at scale.

---

## 7. Summary of production checklist

| Item | Practice |
|------|----------|
| Dimension | 1536 for all embeddings |
| Chunking | 400–700 words per chunk; use `chunk_index` and `content_type` |
| Scoping | Always filter by `workspace_id` via join with `meetings` |
| Content | Store cleaned chunks in `content`; same text that was embedded |
| Similarity | Use `<=>` (cosine distance); index supports it |
| Indexes | Use existing HNSW indexes; don’t drop them |

---

## 8. Example: insert chunk and run search (Node + Prisma)

- Prisma does not support `vector` natively; use **raw SQL** for inserts and similarity search (e.g. `$executeRawUnsafe` / `$queryRawUnsafe`).

**Insert a chunk (after computing `embedding` array of length 1536):**

```js
const embeddingStr = '[' + embeddingArray.join(',') + ']';
await prisma.$executeRawUnsafe(
  `INSERT INTO meeting_embeddings (id, meeting_id, content_type, content, embedding, chunk_index, created_at, updated_at)
   VALUES (gen_random_uuid(), $1, $2, $3, $4::vector(1536), $5, NOW(), NOW())`,
  meetingId, 'transcript', cleanedChunkText, embeddingStr, chunkIndex
);
```

**Similarity search (with workspace filter):**

```js
const embeddingStr = '[' + queryEmbedding.join(',') + ']';
const results = await prisma.$queryRawUnsafe(
  `SELECT me.id, me.meeting_id, me.content_type, me.content,
          me.embedding <=> $1::vector(1536) AS distance
   FROM meeting_embeddings me
   JOIN meetings m ON m.id = me.meeting_id
   WHERE m.workspace_id = $2
   ORDER BY me.embedding <=> $1::vector(1536)
   LIMIT 20`,
  embeddingStr, workspaceId
);
```

Use the same pattern for `meeting_memory_contexts.summary_embedding` when searching by meeting-level summary vectors.
