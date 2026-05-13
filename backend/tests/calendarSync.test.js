const { expect } = require('chai');
const sinon = require('sinon');
const proxyquire = require('proxyquire').noCallThru();

describe('calendarSync', function () {
  this.timeout(2000);

  let sandbox;
  let clock;
  let prismaStub;
  let googleStub;
  let buildAuthedClientStub;
  let authClient;
  let listStub;
  let tokenHandler;
  let calendarSync;

  function makeEvent(overrides = {}) {
    return {
      id: 'event-1',
      iCalUID: 'ical-1',
      summary: 'Team Sync',
      description: 'Weekly check-in',
      status: 'confirmed',
      start: { dateTime: '2026-05-13T10:30:00.000Z' },
      end: { dateTime: '2026-05-13T11:00:00.000Z' },
      ...overrides,
    };
  }

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    clock = sinon.useFakeTimers(new Date('2026-05-13T10:00:00.000Z'));
    tokenHandler = null;

    prismaStub = {
      meeting: {
        findFirst: sandbox.stub(),
        update: sandbox.stub(),
        create: sandbox.stub(),
        updateMany: sandbox.stub(),
      },
      calendarConnection: {
        findMany: sandbox.stub(),
        update: sandbox.stub().resolves({}),
      },
    };

    listStub = sandbox.stub();
    authClient = {
      on: sandbox.stub().callsFake((eventName, handler) => {
        if (eventName === 'tokens') tokenHandler = handler;
      }),
    };

    googleStub = {
      calendar: sandbox.stub().returns({
        events: {
          list: listStub,
        },
      }),
    };

    buildAuthedClientStub = sandbox.stub().returns(authClient);

    calendarSync = proxyquire('../src/integrations/calendar/calendarSync', {
      googleapis: { google: googleStub },
      '../../lib/prisma': prismaStub,
      './googleOAuth': { buildAuthedClient: buildAuthedClientStub },
    });
  });

  afterEach(() => {
    sandbox.restore();
    clock.restore();
  });

  it('creates a meeting from a Google Calendar event with conference data', async () => {
    prismaStub.meeting.findFirst.resolves(null);
    prismaStub.meeting.create.resolves({ id: 101 });

    const event = makeEvent({
      conferenceData: {
        entryPoints: [
          { entryPointType: 'video', uri: 'https://meet.google.com/abc-defg-hij' },
        ],
      },
    });

    const result = await calendarSync.upsertEvent(event, { id: 12 }, 3, 44);

    expect(result).to.deep.equal({ action: 'created', meetingId: 101 });
    expect(prismaStub.meeting.create.calledOnce).to.be.true;
    expect(prismaStub.meeting.create.firstCall.args[0]).to.deep.equal({
      data: {
        workspaceId: 3,
        title: 'Team Sync',
        description: 'Weekly check-in',
        meetingLink: 'https://meet.google.com/abc-defg-hij',
        platform: 'google-meet',
        location: null,
        startTime: new Date('2026-05-13T10:30:00.000Z'),
        endTime: new Date('2026-05-13T11:00:00.000Z'),
        duration: 30,
        meetingType: 'scheduled',
        status: 'scheduled',
        isRecurring: false,
        recurrenceRule: null,
        createdById: 44,
        meetingSource: 'google-calendar',
        metadata: {
          calendar: {
            connectionId: 12,
            uid: 'ical-1',
            providerEventId: 'event-1',
            recurrenceId: null,
          },
        },
      },
    });
  });

  it('skips all-day events that do not include a meeting link', async () => {
    const event = makeEvent({
      start: { date: '2026-05-14' },
      end: { date: '2026-05-15' },
    });

    const result = await calendarSync.upsertEvent(event, { id: 12 }, 3, 44);

    expect(result).to.deep.equal({ action: 'skipped_allday' });
    expect(prismaStub.meeting.findFirst.called).to.be.false;
    expect(prismaStub.meeting.create.called).to.be.false;
    expect(prismaStub.meeting.update.called).to.be.false;
  });

  it('updates an existing meeting and preserves unrelated metadata', async () => {
    prismaStub.meeting.findFirst.resolves({
      id: 202,
      metadata: {
        source: 'seeded',
        calendar: { uid: 'stale-uid' },
      },
    });
    prismaStub.meeting.update.resolves({ id: 202 });

    const event = makeEvent({
      id: 'event-2',
      iCalUID: 'ical-2',
      description: 'Join here https://zoom.us/j/123456789',
      recurringEventId: 'series-1',
      recurrence: ['RRULE:FREQ=WEEKLY'],
    });

    const result = await calendarSync.upsertEvent(event, { id: 77 }, 9, 51);

    expect(result).to.deep.equal({ action: 'updated', meetingId: 202 });
    expect(prismaStub.meeting.update.calledOnce).to.be.true;
    expect(prismaStub.meeting.update.firstCall.args[0]).to.deep.equal({
      where: { id: 202 },
      data: {
        title: 'Team Sync',
        description: 'Join here https://zoom.us/j/123456789',
        meetingLink: 'https://zoom.us/j/123456789',
        platform: 'zoom',
        location: null,
        startTime: new Date('2026-05-13T10:30:00.000Z'),
        endTime: new Date('2026-05-13T11:00:00.000Z'),
        duration: 30,
        status: 'scheduled',
        isRecurring: true,
        recurrenceRule: 'RRULE:FREQ=WEEKLY',
        metadata: {
          source: 'seeded',
          calendar: {
            connectionId: 77,
            uid: 'ical-2',
            providerEventId: 'event-2',
            recurrenceId: 'series-1',
          },
        },
        updatedAt: new Date('2026-05-13T10:00:00.000Z'),
      },
    });
  });

  it('soft-cancels an existing meeting when the provider event is cancelled', async () => {
    prismaStub.meeting.updateMany.resolves({ count: 1 });

    const result = await calendarSync.upsertEvent(
      makeEvent({ status: 'cancelled' }),
      { id: 55 },
      4,
      20
    );

    expect(result).to.deep.equal({ action: 'cancelled' });
    expect(prismaStub.meeting.updateMany.calledOnce).to.be.true;
    expect(prismaStub.meeting.updateMany.firstCall.args[0]).to.deep.equal({
      where: {
        workspaceId: 4,
        meetingSource: 'google-calendar',
        metadata: {
          path: ['calendar', 'uid'],
          equals: 'ical-1',
        },
        status: { not: 'cancelled' },
      },
      data: { status: 'cancelled' },
    });
  });

  it('syncs paginated events, persists refreshed tokens, and reports counts', async () => {
    const connection = {
      id: 18,
      userId: 7,
      type: 'oauth_google',
      isEnabled: true,
      accessToken: 'old-token',
      refreshToken: 'refresh-token',
      expiryDate: new Date('2026-05-14T00:00:00.000Z'),
      calendarId: 'primary',
    };

    prismaStub.calendarConnection.findMany.resolves([connection]);
    prismaStub.meeting.findFirst.onFirstCall().resolves(null);
    prismaStub.meeting.findFirst.onSecondCall().resolves({ id: 303, metadata: { note: 'existing' } });
    prismaStub.meeting.create.resolves({ id: 302 });
    prismaStub.meeting.update.resolves({ id: 303 });

    const createdEvent = makeEvent({
      id: 'event-created',
      iCalUID: 'created-uid',
      hangoutLink: 'https://meet.google.com/new-room',
    });
    const skippedEvent = makeEvent({
      id: 'event-skipped',
      iCalUID: 'skipped-uid',
      start: { date: '2026-05-20' },
      end: { date: '2026-05-21' },
      description: null,
    });
    const updatedEvent = makeEvent({
      id: 'event-updated',
      iCalUID: 'updated-uid',
      location: 'Room A https://teams.microsoft.com/l/meetup-join/abc',
    });

    listStub.onFirstCall().callsFake(async (params) => {
      expect(params).to.include({
        calendarId: 'primary',
        singleEvents: true,
        orderBy: 'startTime',
        maxResults: 250,
      });
      expect(params.timeMin).to.equal('2026-05-12T10:00:00.000Z');
      expect(params.timeMax).to.equal('2026-08-11T10:00:00.000Z');
      expect(params.pageToken).to.equal(undefined);

      await tokenHandler({
        access_token: 'fresh-token',
        refresh_token: 'fresh-refresh',
        expiry_date: Date.parse('2026-05-30T00:00:00.000Z'),
      });

      return {
        data: {
          items: [createdEvent],
          nextPageToken: 'page-2',
        },
      };
    });

    listStub.onSecondCall().resolves({
      data: {
        items: [skippedEvent, updatedEvent],
        nextPageToken: undefined,
      },
    });

    const result = await calendarSync.syncGoogleCalendar(7, 99);

    expect(result).to.deep.equal({
      synced: 1,
      created: 1,
      updated: 1,
      skipped: 1,
      errors: 0,
    });

    expect(buildAuthedClientStub.calledOnceWith({
      accessToken: 'old-token',
      refreshToken: 'refresh-token',
      expiryDate: connection.expiryDate,
    })).to.be.true;
    expect(googleStub.calendar.calledOnceWith({ version: 'v3', auth: authClient })).to.be.true;
    expect(listStub.calledTwice).to.be.true;
    expect(listStub.secondCall.args[0].pageToken).to.equal('page-2');

    expect(prismaStub.calendarConnection.update.callCount).to.equal(2);
    expect(prismaStub.calendarConnection.update.firstCall.args[0]).to.deep.equal({
      where: { id: 18 },
      data: {
        accessToken: 'fresh-token',
        expiryDate: new Date('2026-05-30T00:00:00.000Z'),
        refreshToken: 'fresh-refresh',
      },
    });
    expect(prismaStub.calendarConnection.update.secondCall.args[0]).to.deep.equal({
      where: { id: 18 },
      data: {
        lastSyncAt: new Date('2026-05-13T10:00:00.000Z'),
        lastSyncError: null,
      },
    });
  });

  it('records connection errors without aborting the whole sync', async () => {
    const consoleErrorStub = sandbox.stub(console, 'error');

    prismaStub.calendarConnection.findMany.resolves([
      {
        id: 19,
        userId: 7,
        type: 'oauth_google',
        isEnabled: true,
        accessToken: 'bad-token',
        refreshToken: 'refresh-token',
        expiryDate: null,
        calendarId: 'primary',
      },
    ]);

    buildAuthedClientStub.returns({
      on: sandbox.stub(),
    });
    googleStub.calendar.throws(new Error('Google unavailable'));

    const result = await calendarSync.syncGoogleCalendar(7, 99, { connectionId: 19 });

    expect(result).to.deep.equal({
      synced: 1,
      created: 0,
      updated: 0,
      skipped: 0,
      errors: 1,
    });
    expect(prismaStub.calendarConnection.findMany.calledOnceWith({
      where: {
        userId: 7,
        type: 'oauth_google',
        isEnabled: true,
        id: 19,
      },
    })).to.be.true;
    expect(prismaStub.calendarConnection.update.calledOnce).to.be.true;
    expect(prismaStub.calendarConnection.update.firstCall.args[0]).to.deep.equal({
      where: { id: 19 },
      data: { lastSyncError: 'Google unavailable' },
    });
    expect(consoleErrorStub.calledOnce).to.be.true;
    expect(consoleErrorStub.firstCall.args).to.deep.equal([
      '[calendarSync] Connection 19 sync failed:',
      'Google unavailable',
    ]);
  });
});
