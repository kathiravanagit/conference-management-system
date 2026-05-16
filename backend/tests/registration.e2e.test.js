const request = require('supertest');
const mongoose = require('mongoose');

// If no MONGO_URI is provided, skip the heavy e2e tests (they require a real DB)
if (!process.env.MONGO_URI) {
  test('skipping e2e tests - set MONGO_URI to run them', () => {
    expect(true).toBe(true);
  });
} else {
  const User = require('../models/User');
  const Conference = require('../models/Conference');
  const Registration = require('../models/Registration');

  let app, server;

  describe('Registration e2e (requires MONGO_URI)', () => {
    beforeAll(async () => {
      // Ensure server connects to the provided MongoDB
      process.env.NODE_ENV = process.env.NODE_ENV || 'test';
      const srv = require('../server');
      app = srv.app;
      server = srv.server;
      // Wait for mongoose to connect
      if (mongoose.connection.readyState !== 1) {
        // connectDB called by server; wait briefly for connection
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    });

    afterAll(async () => {
      // Clean up DB entries created by tests
      try {
        await Registration.deleteMany({});
        await Conference.deleteMany({});
        await User.deleteMany({});
      } catch (e) {
        // ignore
      }
      if (server && server.close) server.close();
      await mongoose.disconnect();
    });

    test('full registration + waitlist promotion flow', async () => {
      // Create users directly
      const userA = await User.create({ name: 'Alice', email: 'alice-e2e@example.com', password: 'password', department: 'CSE', isEmailConfirmed: true });
      const userB = await User.create({ name: 'Bob', email: 'bob-e2e@example.com', password: 'password', department: 'CSE', isEmailConfirmed: true });

      const agentA = request.agent(app);
      const agentB = request.agent(app);

      // Login to set auth cookies
      await agentA.post('/api/auth/login').send({ email: 'alice-e2e@example.com', password: 'password' }).expect(200);
      await agentB.post('/api/auth/login').send({ email: 'bob-e2e@example.com', password: 'password' }).expect(200);

      // Create a conference directly with maxAttendees 1
      const conference = await Conference.create({ title: 'E2E Conf', description: 'desc', date: new Date(), createdBy: userA._id, maxAttendees: 1 });

      // User A registers (should be registered)
      const resA = await agentA.post('/api/registrations').send({ conferenceId: conference._id }).expect(201);
      expect(resA.body.waitlisted).toBe(false);

      // User B registers (should be waitlisted)
      const resB = await agentB.post('/api/registrations').send({ conferenceId: conference._id }).expect(201);
      expect(resB.body.waitlisted).toBe(true);

      // Cancel User A registration
      const regA = await Registration.findOne({ userId: userA._id, conferenceId: conference._id });
      await agentA.delete(`/api/registrations/${regA._id}`).expect(200);

      // After cancellation, User B should be promoted to registered
      const regB = await Registration.findOne({ userId: userB._id, conferenceId: conference._id });
      expect(regB.status).toBe('registered');
    }, 120000);
  });
}
