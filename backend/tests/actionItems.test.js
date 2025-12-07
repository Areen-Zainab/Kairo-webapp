// backend/tests/actionItems.test.js - to test ActionItemService with mocked prisma
const { expect } = require("chai");
const sinon = require("sinon");

const ActionItemService = require("../src/services/ActionItemService");
const prisma = require("../src/lib/prisma");
const AgentProcessingService = require("../src/services/AgentProcessingService");

describe("ActionItemService Tests (Mocked)", () => {
  beforeEach(() => {
    // Create fake prisma.actionItem model
    prisma.actionItem = {
      findMany: sinon.stub(),
      create: sinon.stub(),
      update: sinon.stub()
    };
  });

  afterEach(() => {
    sinon.restore();
  });

  // -------------------------------------------------------
  it("should add new action items (mocked)", async () => {
    sinon.stub(AgentProcessingService, "extractActionItems").resolves([
      {
        title: "Prepare slides",
        description: "Slides for meeting",
        assignee: "Areeba",
        dueDate: "2024-02-02",
        confidence: 0.8
      }
    ]);

    prisma.actionItem.findMany.resolves([]); // No existing items
    prisma.actionItem.create.resolves({ id: 1 });

    const longTranscript =
      "This is a transcript sentence that is definitely longer than fifty characters.";

    const result = await ActionItemService.extractAndUpdateActionItems(99, longTranscript);

    expect(result.added).to.equal(1);
    expect(result.updated).to.equal(0);
  });

  // -------------------------------------------------------
  it("should update existing action items (mocked)", async () => {
    const fakeKey = "test123";

    sinon.stub(ActionItemService, "_generateCanonicalKey").returns(fakeKey);

    prisma.actionItem.findMany.resolves([
      {
        id: 44,
        canonicalKey: fakeKey,
        description: "old",
        assignee: "John",
        updateHistory: []
      }
    ]);

    sinon.stub(AgentProcessingService, "extractActionItems").resolves([
      {
        title: "Updated title",
        description: "new details",
        assignee: "John"
      }
    ]);

    prisma.actionItem.update.resolves({ id: 44 });

    const longTranscript =
      "Another long transcript message that exceeds fifty characters to allow extraction.";

    const result = await ActionItemService.extractAndUpdateActionItems(99, longTranscript);

    expect(result.updated).to.equal(1);
    expect(result.added).to.equal(0);
  });
});

