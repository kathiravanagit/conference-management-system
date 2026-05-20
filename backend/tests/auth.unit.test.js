jest.mock('../models/User');
jest.mock('../utils/helpers');
jest.mock('../services/auditLogService');

const User = require('../models/User');
const helpers = require('../utils/helpers');
const { createAuditLog } = require('../services/auditLogService');
const { login } = require('../controllers/authController');

describe('Auth Controller - Login (unit)', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  test('should log in successfully with correct credentials and matching role', async () => {
    const req = {
      body: {
        email: 'student@example.com',
        password: 'password123',
        role: 'student',
      },
      ip: '127.0.0.1',
      get: jest.fn().mockReturnValue('mock-agent'),
    };

    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      cookie: jest.fn(),
    };

    const mockUser = {
      _id: 'user123',
      name: 'John Student',
      email: 'student@example.com',
      role: 'student',
      department: 'CSE',
      isEmailConfirmed: true,
      twoFactorEnabled: false,
      matchPassword: jest.fn().mockResolvedValue(true),
    };

    User.findOne = jest.fn().mockReturnValue({
      select: jest.fn().mockResolvedValue(mockUser),
    });

    helpers.generateToken = jest.fn().mockReturnValue('mock-token');

    await login(req, res, jest.fn());

    expect(User.findOne).toHaveBeenCalledWith({ email: 'student@example.com' });
    expect(mockUser.matchPassword).toHaveBeenCalledWith('password123');
    expect(createAuditLog).toHaveBeenCalledWith(expect.objectContaining({
      action: 'LOGIN_SUCCESS',
      email: 'student@example.com',
    }));
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: true,
      message: 'Login successful',
      user: expect.objectContaining({
        role: 'student',
      }),
    }));
  });

  test('should fail login when selected role mismatches database role', async () => {
    const req = {
      body: {
        email: 'staff@example.com',
        password: 'password123',
        role: 'student', // Mismatched selection!
      },
      ip: '127.0.0.1',
      get: jest.fn().mockReturnValue('mock-agent'),
    };

    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    const mockUser = {
      _id: 'user123',
      name: 'Dr. Staff',
      email: 'staff@example.com',
      role: 'staff', // Actually staff
      department: 'CSE',
      isEmailConfirmed: true,
      twoFactorEnabled: false,
      matchPassword: jest.fn().mockResolvedValue(true),
    };

    User.findOne = jest.fn().mockReturnValue({
      select: jest.fn().mockResolvedValue(mockUser),
    });

    await login(req, res, jest.fn());

    expect(mockUser.matchPassword).toHaveBeenCalledWith('password123');
    expect(createAuditLog).toHaveBeenCalledWith(expect.objectContaining({
      action: 'LOGIN_FAILURE',
      email: 'staff@example.com',
      metadata: { reason: 'Role mismatch' },
    }));
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: 'Invalid credentials',
    });
  });
});
