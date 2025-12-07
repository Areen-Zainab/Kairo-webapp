// backend/tests/transcriptionService.test.js - Unit tests for TranscriptionService pure functions

const { expect } = require("chai");
const sinon = require("sinon");
const fs = require("fs");

const TranscriptionService = require("../src/services/TranscriptionService");

describe("TranscriptionService - Pure Function Tests", () => {

  // Create minimal instance
  function createService() {
    // use a fake folder that we stub fs for
    const svc = new TranscriptionService("/tmp/fake", null, 1);
    return svc;
  }

  beforeEach(() => {
    sinon.stub(fs, "existsSync").returns(true);
    sinon.stub(fs, "writeFileSync").returns(true);
    sinon.stub(fs, "appendFileSync").returns(true);
    sinon.stub(fs, "statSync").returns({ size: 200 });
    sinon.stub(fs, "mkdirSync").returns(true);
  });

  afterEach(() => {
    sinon.restore();
  });

  // ------------------------------
  it("cleanTranscriptionText() removes logs and keeps speech", () => {
    const svc = createService();

    const raw = `
      INFO - whisperx.asr loaded
      Hello everyone
      2025-12-03 21:10:10 - whisperx.asr - WARNING - Something
      this is a test phrase
    `;

    const cleaned = svc.cleanTranscriptionText(raw);

    expect(cleaned).to.equal("Hello everyone this is a test phrase");
  });

// ------------------------------
    it("formatSRTTime() formats correctly", () => {
  const svc = createService();

  const inputSec = 3661.245; // 1h 1m 1s + 245ms
  const result = svc.formatSRTTime(inputSec);

  // Validate format
  expect(result).to.match(/^\d{2}:\d{2}:\d{2},\d{3}$/);

  // Parse output
  const [h, m, rest] = result.split(":");
  const [s, ms] = rest.split(",");

  const outH = parseInt(h);
  const outM = parseInt(m);
  const outS = parseInt(s);
  const outMs = parseInt(ms);

  // Check hours/minutes/seconds EXACTLY
  expect(outH).to.equal(1);
  expect(outM).to.equal(1);
  expect(outS).to.equal(1);

  // Expected milliseconds
  const expectedMs = Math.round((inputSec % 1) * 1000); // 245

  // Allow ±1 millisecond due to float rounding differences
  expect(Math.abs(outMs - expectedMs)).to.be.at.most(1);
});

  // ------------------------------
  it("generateSRT() builds SRT correctly", () => {
    const svc = createService();

    svc.utterances = [
      {
        start_time: 0,
        end_time: 2.5,
        speaker: "Speaker 1",
        text: "Hello world"
      }
    ];

    const srt = svc.generateSRT();

    expect(srt).to.contain("1");
    expect(srt).to.contain("00:00:00,000 --> 00:00:02,500");
    expect(srt).to.contain("[Speaker 1] Hello world");
  });

  // ------------------------------
  it("assignSpeakersToUtterances() assigns correct speaker", () => {
    const svc = createService();

    svc.utterances = [
      { start_time: 0, end_time: 3, text: "Hi" }
    ];

    const segments = [
      { start: 0.5, end: 2.5, speaker: "A" }
    ];

    svc.assignSpeakersToUtterances(segments);

    expect(svc.utterances[0].speaker).to.equal("A");
  });

  // ------------------------------
  it("generateStatistics() collects correct stats", () => {
    const svc = createService();

    svc.utterances = [
      { start_time: 0, end_time: 3, speaker: "A", text: "hello world" },
      { start_time: 3, end_time: 6, speaker: "B", text: "this is test" }
    ];

    const stats = svc.generateStatistics();

    expect(stats.total_utterances).to.equal(2);
    expect(stats.total_words).to.equal(5); // hello world (2) + this is test (3)
    expect(stats.speakers).to.deep.equal(["A", "B"]);
    expect(stats.duration_seconds).to.equal(6);
  });

});
