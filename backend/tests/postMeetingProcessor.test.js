// backend/tests/postMeetingProcessor.test.js - Tests for PostMeetingProcessor service

const proxyquire = require('proxyquire').noCallThru();
const sinon = require('sinon');
const { expect } = require('chai');

let sandbox;
let PostMeetingProcessor;
let ActionItemServiceStub;
let MeetingStub;
let meetingStatsStub;

describe('PostMeetingProcessor', () => {
  beforeEach(() => {
    sandbox = sinon.createSandbox();

    // Create stubs
    ActionItemServiceStub = {
      getPendingForMeeting: sandbox.stub(),
      _toDTO: sandbox.stub()
    };

    MeetingStub = {
      update: sandbox.stub()
    };

    meetingStatsStub = {
      getAudioFileDuration: sandbox.stub()
    };

    // Load module with proxyquire
    PostMeetingProcessor = proxyquire('../src/services/PostMeetingProcessor', {
      './ActionItemService': ActionItemServiceStub,
      '../models/Meeting': MeetingStub,
      '../utils/meetingStats': meetingStatsStub
    });
  });

  afterEach(() => {
    sandbox.restore();
  });

  // --------------------------------------------------------------------
  // processPendingActionItems
  // --------------------------------------------------------------------
  it('should return no pending items', async () => {
    ActionItemServiceStub.getPendingForMeeting.resolves([]);

    const res = await PostMeetingProcessor.processPendingActionItems(1);

    expect(res).to.deep.equal({
      pendingCount: 0,
      requiresConfirmation: false
    });
  });

  it('should return pending items when found', async () => {
    const fake = [{ id: 1 }, { id: 2 }];
    ActionItemServiceStub.getPendingForMeeting.resolves(fake);
    ActionItemServiceStub._toDTO.callsFake((i) => ({ id: i.id }));

    const res = await PostMeetingProcessor.processPendingActionItems(10);

    expect(res.pendingCount).to.equal(2);
    expect(res.items).to.deep.equal([{ id: 1 }, { id: 2 }]);
  });

  it('should handle errors', async () => {
    ActionItemServiceStub.getPendingForMeeting.rejects(new Error('BAD'));

    const res = await PostMeetingProcessor.processPendingActionItems(7);

    expect(res.pendingCount).to.equal(0);
    expect(res.requiresConfirmation).to.be.false;
    expect(res.error).to.equal('BAD');
  });

  // --------------------------------------------------------------------
  // updateRecordingUrl
  // --------------------------------------------------------------------
  it('should return false if no path given', async () => {
    const res = await PostMeetingProcessor.updateRecordingUrl(1, null);
    expect(res).to.be.false;
  });

  it('should update recording URL correctly', async () => {
    MeetingStub.update.resolves(true);

    const res = await PostMeetingProcessor.updateRecordingUrl(5, 'audio.mp3');

    expect(MeetingStub.update.calledOnce).to.be.true;
    expect(res).to.be.true;
  });

  it('should return false on update error', async () => {
    MeetingStub.update.rejects(new Error('FAIL'));

    const res = await PostMeetingProcessor.updateRecordingUrl(9, 'x.mp3');

    expect(res).to.be.false;
  });

  // --------------------------------------------------------------------
  // updateMeetingDuration
  // --------------------------------------------------------------------
  it('should return false if no audio file provided', async () => {
    const res = await PostMeetingProcessor.updateMeetingDuration(1, null);
    expect(res).to.be.false;
  });

  it('should return false if duration cannot be determined', async () => {
    meetingStatsStub.getAudioFileDuration.resolves(0);

    const res = await PostMeetingProcessor.updateMeetingDuration(2, 'bad.mp3');

    expect(res).to.be.false;
  });

  it('should update duration correctly', async () => {
    meetingStatsStub.getAudioFileDuration.resolves(125); // 2 minutes
    MeetingStub.update.resolves(true);

    const res = await PostMeetingProcessor.updateMeetingDuration(7, 'rec.mp3');

    expect(MeetingStub.update.calledOnce).to.be.true;
    expect(res).to.be.true;
  });

  it('should return false if Meeting.update fails', async () => {
    meetingStatsStub.getAudioFileDuration.resolves(100);
    MeetingStub.update.rejects(new Error('ERRRR'));

    const res = await PostMeetingProcessor.updateMeetingDuration(9, 'audio.mp3');

    expect(res).to.be.false;
  });
});
