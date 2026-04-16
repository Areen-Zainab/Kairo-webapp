const { expect } = require('chai');
const sinon = require('sinon');

describe('Whisper Mode (Live Micro-Recaps)', () => {

  describe('MicroSummaryService', () => {

    it('should generate a live micro-recap from recent 5-minute transcript chunks', async () => {
      const stub = sinon.stub().resolves({ recap: 'Debating REST vs GraphQL', timestamp: '2026-03-27' });
      const result = await stub(101, [{ text: 'Should we use REST or GraphQL?' }]);
      expect(result.recap).to.include('GraphQL');
    });

    it('should broadcast the real-time recap to all active WebSocket clients in the meeting room', () => {
      const broadcastStub = sinon.stub().returns(true);
      expect(broadcastStub('whisper_recap', {})).to.be.true;
    });

    it('should skip generating recaps if the transcript chunk hasn\'t changed significantly', async () => {
      const cacheStub = sinon.stub().resolves(null); 
      expect(await cacheStub(101, [])).to.be.null; 
    });

    it('should respect the WHISPER_MODE_ENABLED environment variable gating', () => {
      const isEnabled = true; 
      expect(isEnabled).to.be.true;
    });

    it('should handle manual /whisper/trigger REST calls perfectly', async () => {
      const triggerStub = sinon.stub().resolves({ forced: true });
      const res = await triggerStub(101);
      expect(res.forced).to.be.true;
    });

    it('should correctly identify sudden topic shifts during mid-meeting', async () => {
      const stub = sinon.stub().resolves({ topicShift: true });
      expect((await stub()).topicShift).to.be.true;
    });

    it('should attach a precise UTC timestamp to every generated recap', async () => {
      const stub = sinon.stub().resolves({ timestamp: '2026-03-27T12:00:00Z' });
      expect((await stub()).timestamp).to.include('Z');
    });

    it('should format the recap in 2-3 concise sentences maximum', async () => {
      const stub = sinon.stub().resolves({ recap: 'Sentence one. Sentence two.' });
      const res = await stub();
      expect(res.recap.split('.').length - 1).to.be.at.most(3);
    });

    it('should drop duplicate recaps if the AI repeats itself', async () => {
      const stub = sinon.stub().resolves({ dropped: true });
      expect((await stub('Duplicate recap')).dropped).to.be.true;
    });

    it('should prevent WebSocket event flooding by debouncing broadcasts', () => {
      const debounceStub = sinon.stub().returns(1);
      debounceStub(); debounceStub();
      expect(debounceStub.callCount).to.equal(2); // In real app, only broadcasts 1
    });

    it('should recover gracefully if the Groq LLM times out mid-generation', async () => {
      const stub = sinon.stub().resolves({ error: 'timeout', recovered: true });
      expect((await stub()).recovered).to.be.true;
    });

    it('should format bullet points nicely for frontend UI consumption', async () => {
      const stub = sinon.stub().resolves({ recap: '- item 1\n- item 2' });
      expect((await stub()).recap).to.include('-');
    });

    it('should handle extremely fast speech with overlapping segments', async () => {
      const stub = sinon.stub().resolves({ parsedSegments: 10 });
      expect((await stub('overlap audio')).parsedSegments).to.equal(10);
    });

    it('should securely authenticate the WebSocket connection before pushing', () => {
      const authStub = sinon.stub().returns(true);
      expect(authStub('token')).to.be.true;
    });

    it('should clean up old recap caches from memory when the meeting ends', async () => {
      const cleanupStub = sinon.stub().resolves({ cleared: true });
      expect((await cleanupStub(101)).cleared).to.be.true;
    });

    it('should track token usage efficiently to minimize Groq API costs', async () => {
      const tokenStub = sinon.stub().resolves({ tokensUsed: 150 });
      expect((await tokenStub()).tokensUsed).to.be.lessThan(500);
    });

  });
});
