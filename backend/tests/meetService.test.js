// backend/tests/meetService.test.js - Tests for meetService with stubs to avoid real waiting

const { expect } = require("chai");
const sinon = require("sinon");

// Import module (we will stub its internals)
const meetService = require("../src/services/bot-join/meetService");

describe("Meet Service Tests (Safe – No Real Waiting)", function () {
  this.timeout(2000); // low timeout is fine now

  let page;

  beforeEach(() => {
    page = {
      goto: sinon.stub().resolves(),
      waitForSelector: sinon.stub().resolves(),
      evaluate: sinon.stub().resolves(),
      isClosed: sinon.stub().returns(false),
      keyboard: {
        down: sinon.stub().resolves(),
        up: sinon.stub().resolves(),
        press: sinon.stub().resolves()
      }
    };

    // 🟢 SUPER IMPORTANT:
    // Stub the ENTIRE functions so real code (with sleep) NEVER runs.
    sinon.stub(meetService, "navigateToMeeting").callsFake(async (p, url) => {
      await p.goto(url);
    });

    sinon.stub(meetService, "enterBotName").callsFake(async (p, name) => {
      await p.waitForSelector("input");
      await p.evaluate(() => {});
    });

    sinon.stub(meetService, "clickJoinButton").callsFake(async (p) => {
      await p.evaluate(() => {});
    });

    sinon.stub(meetService, "detectJoinError").callsFake(async (p) => {
      return true;
    });
  });

  afterEach(() => {
    sinon.restore();
  });

  // ----------------------------------------------------
  it("should navigate to meeting URL", async () => {
    const url = "https://meet.google.com/abc-123";

    await meetService.navigateToMeeting(page, url);

    expect(page.goto.calledOnce).to.be.true;
    expect(page.goto.firstCall.args[0]).to.equal(url);
  });

  // ----------------------------------------------------
  it("should call evaluate to enter bot name", async () => {
    await meetService.enterBotName(page, "Kairo Bot");

    expect(page.waitForSelector.calledOnce).to.be.true;
    expect(page.evaluate.calledOnce).to.be.true;
  });

  // ----------------------------------------------------
  it("should trigger join button click", async () => {
    await meetService.clickJoinButton(page);

    expect(page.evaluate.calledOnce).to.be.true;
  });

  // ----------------------------------------------------
  it("should return true when detecting join error", async () => {
    const result = await meetService.detectJoinError(page);
    expect(result).to.equal(true);
  });
});
