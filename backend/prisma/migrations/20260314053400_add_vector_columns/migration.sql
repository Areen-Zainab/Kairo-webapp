/*
  Warnings:

  - Added the required column `embedding` to the `meeting_embeddings` table without a default value. This is not possible if the table is not empty.
  - Added the required column `summary_embedding` to the `meeting_memory_contexts` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "meeting_embeddings" ADD COLUMN     "embedding" vector(1536) NOT NULL;

-- AlterTable
ALTER TABLE "meeting_memory_contexts" ADD COLUMN     "summary_embedding" vector(1536) NOT NULL;
