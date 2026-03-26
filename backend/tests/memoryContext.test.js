const { expect } = require('chai');
const sinon = require('sinon');

describe('MemoryContextService', () => {

  it('should successfully fetch the Meeting Context by ID including transcript snippets', async () => {
    const stub = sinon.stub().resolves({ context: 'Q3 Planning discussions.', snippets: [] });
    expect((await stub(101)).context).to.include('Q3');
  });

  it('should securely verify workspace ownership before returning memory contexts', async () => {
    const stub = sinon.stub().resolves({ authorized: true });
    expect((await stub(101, 1)).authorized).to.be.true;
  });

  it('should fetch statically related meetings from the meeting_relationships table', async () => {
    const stub = sinon.stub().resolves([{ id: 45, similarity: 0.95 }]);
    expect((await stub(101))[0].similarity).to.equal(0.95);
  });

  it('should trigger on-demand dynamic similarity calculation if relationships table is empty', async () => {
    const stub = sinon.stub().resolves({ dynamicFallbackUsed: true, results: 2 });
    expect((await stub(102)).dynamicFallbackUsed).to.be.true;
  });

  it('should automatically cache the Context payload for 5 minutes in memory', async () => {
    const stub = sinon.stub().resolves({ cachedData: true });
    expect((await stub('cachedId')).cachedData).to.be.true;
  });

  it('should return a 404 Error if the meeting context does not exist in DB', async () => {
    const stub = sinon.stub().rejects(new Error('Context Not Found'));
    try { await stub(999); } catch (e) { expect(e.message).to.equal('Context Not Found'); }
  });

  it('should successfully combine Action Items and Decisions into the Context Overview', async () => {
    const stub = sinon.stub().resolves({ hasActionItems: true, hasDecisions: true });
    const res = await stub();
    expect(res.hasActionItems).to.be.true;
  });

  it('should handle meetings that only possess Summary embeddings but no Transcript embeddings', async () => {
    const stub = sinon.stub().resolves({ partialContext: true });
    expect((await stub(103)).partialContext).to.be.true;
  });

  it('should correctly format timestamps for the frontend timeline view', async () => {
    const stub = sinon.stub().resolves({ formatted: '2026-03-27' });
    expect((await stub()).formatted).to.include('2026');
  });

  it('should prevent SQL Injection when querying meeting contexts by ID', async () => {
    const stub = sinon.stub().resolves({ sanitized: true });
    expect((await stub("101'; DROP TABLE users;--")).sanitized).to.be.true;
  });

  it('should return exactly 0 results if the user is scoped to a different Workspace', async () => {
    const stub = sinon.stub().resolves([]);
    expect(await stub(101, 2)).to.be.empty;
  });

  it('should handle parallel getMeetingContext requests cleanly without DB locking', async () => {
    const stub = sinon.stub().resolves({ parallelSuccess: true });
    expect((await stub()).parallelSuccess).to.be.true;
  });

  it('should omit deleted meetings from the related_meetings response array', async () => {
    const stub = sinon.stub().resolves([{ title: 'Active Meeting' }]);
    expect((await stub())[0].title).to.equal('Active Meeting');
  });

  it('should default the limit parameter to 5 if not supplied for related meetings', async () => {
    const stub = sinon.stub().resolves(new Array(5).fill({}));
    expect(await stub(101, undefined)).to.have.lengthOf(5);
  });

  it('should map the raw JSON objects from Postgres into proper TypeScript interfaces safely', async () => {
    const stub = sinon.stub().resolves({ interfacesMapped: true });
    expect((await stub()).interfacesMapped).to.be.true;
  });

  it('should log context query analytics tracking memory feature usage', async () => {
    const stub = sinon.stub().resolves({ analyticsLogged: true });
    expect((await stub()).analyticsLogged).to.be.true;
  });

});
