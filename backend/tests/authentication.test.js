// backend/tests/authentication.test.js - Tests for authentication middleware

const { expect } = require("chai");
const sinon = require("sinon");
const jwt = require("jsonwebtoken");

const User = require("../src/models/User");
const {
  authenticateToken,
  optionalAuth,
} = require("../src/middleware/auth");

// Stub Express request/response/next
const reqStub = (token) => ({
  headers: token
    ? { authorization: `Bearer ${token}` }
    : {},
});
const resStub = () => {
  const res = {};
  res.status = sinon.stub().returns(res);
  res.json = sinon.stub().returns(res);
  return res;
};
const nextStub = sinon.stub();

// Reset stubs before each test
beforeEach(() => {
  sinon.restore();
  nextStub.resetHistory();
});

describe("Authentication Middleware Tests", () => {
  // -----------------------------------------
  // 1️⃣ Missing Token
  // -----------------------------------------
  it("should return 401 when no token is provided", async () => {
    const req = reqStub(null);
    const res = resStub();

    await authenticateToken(req, res, nextStub);

    expect(res.status.calledWith(401)).to.be.true;
    expect(res.json.calledWithMatch({ error: "Access token required" })).to.be
      .true;
  });

  // -----------------------------------------
  // 2️⃣ Invalid Token
  // -----------------------------------------
  it("should return 401 for invalid token", async () => {
    sinon.stub(jwt, "verify").throws({ name: "JsonWebTokenError" });

    const req = reqStub("invalidtoken123");
    const res = resStub();

    await authenticateToken(req, res, nextStub);

    expect(res.status.calledWith(401)).to.be.true;
    expect(res.json.calledWithMatch({ error: "Invalid token" })).to.be.true;
  });

  // -----------------------------------------
  // 3️⃣ Expired Token
  // -----------------------------------------
  it("should return 401 for expired token", async () => {
    sinon.stub(jwt, "verify").throws({ name: "TokenExpiredError" });

    const req = reqStub("expired.token.value");
    const res = resStub();

    await authenticateToken(req, res, nextStub);

    expect(res.status.calledWith(401)).to.be.true;
    expect(res.json.calledWithMatch({ error: "Token expired" })).to.be.true;
  });

  // -----------------------------------------
  // 4️⃣ User Not Found
  // -----------------------------------------
  it("should return 401 when user does not exist", async () => {
    sinon.stub(jwt, "verify").returns({ id: 123 });
    sinon.stub(User, "findById").resolves(null);

    const req = reqStub("validtoken");
    const res = resStub();

    await authenticateToken(req, res, nextStub);

    expect(res.status.calledWith(401)).to.be.true;
    expect(res.json.calledWithMatch({ error: "Invalid or inactive user" })).to
      .be.true;
  });

  // -----------------------------------------
  // 5️⃣ User is Inactive
  // -----------------------------------------
  it("should return 401 when user is inactive", async () => {
    sinon.stub(jwt, "verify").returns({ id: 1 });
    sinon.stub(User, "findById").resolves({ isActive: false });

    const req = reqStub("validtoken");
    const res = resStub();

    await authenticateToken(req, res, nextStub);

    expect(res.status.calledWith(401)).to.be.true;
    expect(res.json.calledWithMatch({ error: "Invalid or inactive user" })).to
      .be.true;
  });

  // -----------------------------------------
  // 6️⃣ Valid Token + Active User
  // -----------------------------------------
  it("should allow request to proceed when token and user are valid", async () => {
    sinon.stub(jwt, "verify").returns({ id: 10 });
    sinon
      .stub(User, "findById")
      .resolves({ id: 10, name: "Areeba", isActive: true });

    const req = reqStub("validtoken");
    const res = resStub();

    await authenticateToken(req, res, nextStub);

    expect(nextStub.calledOnce).to.be.true;
    expect(req.user.name).to.equal("Areeba");
  });

  // ------------------------------------------------
  // optionalAuth Tests
  // ------------------------------------------------
  it("optionalAuth: should set req.user = null when no token", async () => {
    const req = reqStub(null);
    const res = resStub();

    await optionalAuth(req, res, nextStub);

    expect(req.user).to.equal(null);
    expect(nextStub.calledOnce).to.be.true;
  });

  it("optionalAuth: should set user when token is valid", async () => {
    sinon.stub(jwt, "verify").returns({ id: 5 });
    sinon.stub(User, "findById").resolves({ id: 5, isActive: true });

    const req = reqStub("validtoken");
    const res = resStub();

    await optionalAuth(req, res, nextStub);

    expect(req.user.id).to.equal(5);
    expect(nextStub.calledOnce).to.be.true;
  });
});
