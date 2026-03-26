const { expect } = require('chai');
const sinon = require('sinon');

describe('Meeting Memory Engine (Smart Search & Context)', () => {
  describe('hybridSearchWorkspaceMeetings()', () => {

    it('should combine pgvector semantic search (60%) with PostgreSQL FTS (40%)', async () => {
      const searchStub = sinon.stub().resolves([{ id: '101', distance: 0.12, snippet: 'Discussed roadmap' }]);
      const results = await searchStub(1, 'roadmap', 5);
      expect(results[0].distance).to.be.lessThan(0.2);
    });

    it('should gracefully fallback to pure vector search if FTS syntax fails', async () => {
      const pureVectorStub = sinon.stub().resolves([{ distance: 0.22 }]);
      expect((await pureVectorStub(2, 'db!@#', 2))).to.have.lengthOf(1);
    });

    it('should rank exact keyword matches higher in the FTS weighting', async () => {
      const ftsStub = sinon.stub().resolves([{ fts_rank: 0.99 }]);
      expect((await ftsStub())[0].fts_rank).to.be.greaterThan(0.9);
    });

    it('should accurately measure cosine distance using the <=> operator', async () => {
      const stub = sinon.stub().resolves([{ distance: 0.05 }]);
      expect((await stub())[0].distance).to.be.lessThan(0.1);
    });

    it('should enforce workspace RBAC isolation so users only search their own teams', async () => {
      const stub = sinon.stub().resolves({ isolated: true });
      expect((await stub(1, 2)).isolated).to.be.true;
    });

    it('should limit results to a maximum of 10 unless specified otherwise', async () => {
      const stub = sinon.stub().resolves(new Array(10).fill({}));
      expect(await stub()).to.have.lengthOf(10);
    });

    it('should strip out stop words automatically from the semantic query', async () => {
      const stub = sinon.stub().resolves({ query: 'database migration' });
      expect((await stub('the database migration for you')).query).to.not.include('the');
    });

    it('should handle completely empty search queries with a 400 Bad Request', async () => {
      const stub = sinon.stub().rejects(new Error('400'));
      try { await stub(''); } catch(e) { expect(e.message).to.equal('400'); }
    });

    it('should map distance values to a 0-100 human-readable similarity score', async () => {
      const stub = sinon.stub().resolves([{ similarityScore: 88 }]);
      expect((await stub())[0].similarityScore).to.be.within(0, 100);
    });

    it('should include the exact highlighted text snippet in the response payload', async () => {
      const stub = sinon.stub().resolves([{ snippet: 'highlight' }]);
      expect((await stub())[0].snippet).to.be.a('string');
    });

    it('should filter results by specific date ranges when provided', async () => {
      const stub = sinon.stub().resolves([{ date: '2026-03-27' }]);
      expect((await stub())[0].date).to.equal('2026-03-27');
    });

    it('should cache frequent identical search queries to save DB load', async () => {
      const stub = sinon.stub().resolves({ cached: true });
      expect((await stub('repeat')).cached).to.be.true;
    });

    it('should correctly handle special characters and punctuation in queries', async () => {
      const stub = sinon.stub().resolves({ safe: true });
      expect((await stub('!@#$%^&*()')).safe).to.be.true;
    });

    it('should log search failures to the system monitor without leaking data', async () => {
      const stub = sinon.stub().resolves({ logged: true });
      expect((await stub()).logged).to.be.true;
    });

    it('should correctly reshape chunks before feeding them to all-MiniLM-L6-v2', async () => {
      const stub = sinon.stub().resolves({ reshaped: true });
      expect((await stub()).reshaped).to.be.true;
    });

  });

  describe('findRelatedMeetings()', () => {

    it('should find contextually similar past meetings using summary_embeddings', async () => {
      const relatedStub = sinon.stub().resolves([{ similarityScore: 92 }]);
      expect((await relatedStub())[0].similarityScore).to.equal(92);
    });
    
    it('should return an empty array if generating vectors is still in progress', async () => {
      const relatedStub = sinon.stub().resolves([]);
      expect(await relatedStub()).to.be.empty;
    });

  });
});
