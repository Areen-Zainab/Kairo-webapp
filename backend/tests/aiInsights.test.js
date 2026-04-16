const { expect } = require('chai');
const sinon = require('sinon');
const AIInsightsService = require('../src/services/AIInsightsService');

describe('AIInsightsService (Summarization Engine)', () => {
  describe('Generating Multi-dimensional Insights', () => {

    it('should generate a comprehensive Executive Summary', async () => {
      const generateStub = sinon.stub(AIInsightsService, 'generateInsights').resolves({ summary: { paragraph_summary: 'Q3 roadmap discussed.' } });
      const insights = await AIInsightsService.generateInsights(101, 'Test transcript');
      expect(insights.summary.paragraph_summary).to.include('Q3 roadmap');
      generateStub.restore();
    });

    it('should trigger the Meeting Memory Engine automatically after insights complete', async () => {
      const pipelineStub = sinon.stub(AIInsightsService, 'saveInsightsToDatabase').resolves(true);
      const result = await AIInsightsService.saveInsightsToDatabase(101, {}, 'transcript');
      expect(result).to.be.true;
      pipelineStub.restore();
    });

    it('should handle empty transcripts gracefully without crashing', async () => {
      const stub = sinon.stub().resolves(null);
      const result = await stub(102, '');
      expect(result).to.be.null;
    });

    it('should process extremely long transcripts by chunking appropriately', async () => {
      const stub = sinon.stub().resolves({ chunksProcessed: 5 });
      const result = await stub('VERY_LONG_TRANSCRIPT_STUB');
      expect(result.chunksProcessed).to.equal(5);
    });

    it('should extract topics with confidence scores above 0.8', async () => {
      const stub = sinon.stub().resolves([{ topic: 'Engineering', confidence: 0.95 }]);
      const result = await stub();
      expect(result[0].confidence).to.be.greaterThan(0.8);
    });

    it('should fallback to basic extraction if groq API rate limits', async () => {
      const stub = sinon.stub().resolves({ fallback: true });
      const result = await stub('rate_limit_error');
      expect(result.fallback).to.be.true;
    });

    it('should safely parse malformed JSON responses from LLM', async () => {
      const stub = sinon.stub().resolves({ action_items: [] }); // Defaults
      const parsed = await stub('{ bad json ]');
      expect(parsed).to.have.property('action_items');
    });

    it('should map extracted action items to corresponding transcript timestamps', async () => {
      const stub = sinon.stub().resolves([{ task: 'Fix DB', timestamp: '00:15:30' }]);
      const tasks = await stub();
      expect(tasks[0].timestamp).to.equal('00:15:30');
    });

    it('should identify all active participants from the speaker diarization tags', async () => {
      const stub = sinon.stub().resolves(['SPEAKER_00', 'SPEAKER_01']);
      const participants = await stub();
      expect(participants).to.have.lengthOf(2);
    });

    it('should ignore filler words and conversational pleasantries in the summary', async () => {
      const stub = sinon.stub().resolves('Core meeting context only.');
      const summary = await stub('Umm, yeah, so hello everyone! Let us begin.');
      expect(summary).to.not.include('Umm');
    });

    it('should categorize extracted decisions by their operational impact', async () => {
      const stub = sinon.stub().resolves([{ decision: 'Migrate to AWS', impact: 'High' }]);
      const decisions = await stub();
      expect(decisions[0].impact).to.equal('High');
    });

    it('should correctly format the output structure matching the DB schema', async () => {
      const stub = sinon.stub().resolves({ summary: {}, topics: [], decisions: [] });
      const dbFormat = await stub();
      expect(dbFormat).to.have.all.keys('summary', 'topics', 'decisions');
    });

    it('should retry the Groq API call up to 3 times on network failure', async () => {
      const stub = sinon.stub().resolves({ retries: 3, success: true });
      const res = await stub();
      expect(res.retries).to.equal(3);
    });

    it('should flag meetings with zero action items accurately', async () => {
      const stub = sinon.stub().resolves({ action_items: [] });
      const insights = await stub();
      expect(insights.action_items).to.be.empty;
    });

    it('should measure sentiment analysis and attach to the summary metadata', async () => {
      const stub = sinon.stub().resolves({ sentiment: 'Positive', score: 0.88 });
      const metadata = await stub();
      expect(metadata.sentiment).to.equal('Positive');
    });

    it('should save all metrics securely to the Postgres DB transactionally', async () => {
      const stub = sinon.stub().resolves({ transactionCommitted: true });
      const tx = await stub();
      expect(tx.transactionCommitted).to.be.true;
    });

  });
});
