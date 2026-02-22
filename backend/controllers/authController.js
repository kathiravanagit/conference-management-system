const User = require('../models/User');
const {
  generateToken,
  generateRandomToken,
  hashToken,
  generateOTP,
} = require('../utils/helpers');
const {
  sendLoginConfirmationEmail,
  sendPasswordResetEmail,
} = require('../utils/email');
const { createAuditLog } = require('../services/auditLogService');
const {
  generateTwoFactorSecret,
  generateQRCode,
  verifyTOTP,
  generateBackupCodes,
  hashBackupCodes,
  verifyBackupCode,
} = require('../services/twoFactorService');

/**
 * Register a new user (Student or Admin)
 * POST /api/auth/register
 */
exports.register = async (req, res, next) => {
  try {
    const { name, email, password, department, role } = req.body;

    // Validation
    if (!name || !email || !password || !department) {
      return res.status(400).json({
        success: false,
        message: 'Please provide all required fields',
      });
    }

    // Check if user already exists
    let user = await User.findOne({ email });
    if (user) {
      return res.status(400).json({
        success: false,
        message: 'Email already registered',
      });
    }

    // Create new user
    const allowedRoles = ['student', 'staff', 'it'];
    const normalizedRole = allowedRoles.includes(role) ? role : 'student';

    user = await User.create({
      name,
      email,
      password,
      department,
      role: normalizedRole,
    });

    const token = generateRandomToken();
    user.emailConfirmToken = hashToken(token);
    user.emailConfirmTokenExpiresAt = new Date(Date.now() + 15 * 60 * 1000);
    await user.save();

    await sendLoginConfirmationEmail(user.email, token);

    await createAuditLog({
      userId: user._id,
      action: 'REGISTER',
      email: user.email,
      ip: req.ip,
      userAgent: req.get('user-agent'),
    });

    await createAuditLog({
      userId: user._id,
      action: 'EMAIL_CONFIRMATION_SENT',
      email: user.email,
      ip: req.ip,
      userAgent: req.get('user-agent'),
    });

    res.status(201).json({
      success: true,
      message: 'Registration successful! Please check your email to confirm your account.',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        department: user.department,
      },
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Login user
 * POST /api/auth/login
 */
exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // Validation
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide email and password',
      });
    }

    // Check for user and get password field
    const user = await User.findOne({ email }).select('+password');

    if (!user) {
      await createAuditLog({
        action: 'LOGIN_FAILURE',
        email,
        ip: req.ip,
        userAgent: req.get('user-agent'),
        metadata: { reason: 'User not found' },
      });
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials',
      });
    }

    // Check if password matches
    const isMatch = await user.matchPassword(password);

    if (!isMatch) {
      await createAuditLog({
        userId: user._id,
        action: 'LOGIN_FAILURE',
        email: user.email,
        ip: req.ip,
        userAgent: req.get('user-agent'),
        metadata: { reason: 'Invalid credentials' },
      });
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials',
      });
    }

    if (!user.isEmailConfirmed) {
      const confirmToken = generateRandomToken();
      user.emailConfirmToken = hashToken(confirmToken);
      user.emailConfirmTokenExpiresAt = new Date(Date.now() + 15 * 60 * 1000);
      await user.save();

      await sendLoginConfirmationEmail(user.email, confirmToken);

      await createAuditLog({
        userId: user._id,
        action: 'EMAIL_CONFIRMATION_SENT',
        email: user.email,
        ip: req.ip,
        userAgent: req.get('user-agent'),
      });

      return res.status(200).json({
        success: true,
        message: 'Confirmation email sent. Please check your inbox to complete login.',
        confirmationRequired: true,
      });
    }

    if (user.twoFactorEnabled) {
      const twoFactorToken = generateToken(user._id, user.role, true);

      await createAuditLog({
        userId: user._id,
        action: 'LOGIN_ATTEMPT',
        email: user.email,
        ip: req.ip,
        userAgent: req.get('user-agent'),
        metadata: { twoFactorRequired: true },
      });

      return res.status(200).json({
        success: true,
        message: 'Two-factor verification required',
        requires2FA: true,
        twoFactorToken,
      });
    }

    const token = generateToken(user._id, user.role);

    await createAuditLog({
      userId: user._id,
      action: 'LOGIN_SUCCESS',
      email: user.email,
      ip: req.ip,
      userAgent: req.get('user-agent'),
    });

    res.status(200).json({
      success: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        department: user.department,
      },
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Confirm login via email link
 * GET /api/auth/confirm-login
 */
exports.confirmLogin = async (req, res) => {
  try {
    const { token } = req.query;

    if (!token) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or missing token',
      });
    }

    const hashedToken = hashToken(token);

    const user = await User.findOne({
      emailConfirmToken: hashedToken,
      emailConfirmTokenExpiresAt: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired confirmation link',
      });
    }

    user.emailConfirmToken = undefined;
    user.emailConfirmTokenExpiresAt = undefined;
    user.isEmailConfirmed = true;
    user.isVerified = true;
    await user.save();

    await createAuditLog({
      userId: user._id,
      action: 'EMAIL_CONFIRMED',
      email: user.email,
      ip: req.ip,
      userAgent: req.get('user-agent'),
    });

    if (user.twoFactorEnabled) {
      const twoFactorToken = generateToken(user._id, user.role, true);

      return res.status(200).json({
        success: true,
        message: 'Email confirmed. Two-factor verification required.',
        requires2FA: true,
        twoFactorToken,
      });
    }

    const authToken = generateToken(user._id, user.role);

    await createAuditLog({
      userId: user._id,
      action: 'LOGIN_SUCCESS',
      email: user.email,
      ip: req.ip,
      userAgent: req.get('user-agent'),
    });

    return res.status(200).json({
      success: true,
      message: 'Login confirmed',
      token: authToken,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        department: user.department,
      },
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Request password reset
 * POST /api/auth/forgot-password
 */
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Please provide email',
      });
    }

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Email not found',
      });
    }

    const otp = generateOTP();
    user.otp = hashToken(otp);
    user.otpExpiresAt = new Date(Date.now() + 5 * 60 * 1000);
    await user.save();

    await sendPasswordResetEmail(user.email, otp);

    await createAuditLog({
      userId: user._id,
      action: 'PASSWORD_RESET_REQUEST',
      email: user.email,
      ip: req.ip,
      userAgent: req.get('user-agent'),
    });

    return res.status(200).json({
      success: true,
      message: 'Password reset code sent to your email',
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Reset password with OTP
 * POST /api/auth/reset-password
 */
exports.resetPassword = async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;

    if (!email || !otp || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Please provide email, otp, and new password',
      });
    }

    const user = await User.findOne({
      email,
      otp: hashToken(otp),
      otpExpiresAt: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired code',
      });
    }

    user.password = newPassword;
    user.otp = undefined;
    user.otpExpiresAt = undefined;
    await user.save();

    await createAuditLog({
      userId: user._id,
      action: 'PASSWORD_RESET_SUCCESS',
      email: user.email,
      ip: req.ip,
      userAgent: req.get('user-agent'),
    });

    return res.status(200).json({
      success: true,
      message: 'Password reset successful. Please log in.',
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Setup 2FA
 * POST /api/auth/2fa/setup
 */
exports.setup2FA = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('+twoFactorSecret');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    if (user.twoFactorEnabled) {
      return res.status(400).json({
        success: false,
        message: '2FA is already enabled',
      });
    }

    const { secret, otpauthUrl } = generateTwoFactorSecret(user.email);
    const qrCode = await generateQRCode(otpauthUrl);

    user.twoFactorSecret = secret;
    user.twoFactorVerified = false;
    await user.save();

    await createAuditLog({
      userId: user._id,
      action: '2FA_SETUP_INITIATED',
      email: user.email,
      ip: req.ip,
      userAgent: req.get('user-agent'),
    });

    return res.status(200).json({
      success: true,
      message: 'Scan the QR code with your authenticator app',
      data: {
        qrCode,
        secret,
      },
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Verify 2FA setup
 * POST /api/auth/2fa/verify-setup
 */
exports.verify2FASetup = async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({
        success: false,
        message: 'Please provide 2FA token',
      });
    }

    const user = await User.findById(req.user.id)
      .select('+twoFactorSecret +twoFactorBackupCodes');

    if (!user?.twoFactorSecret) {
      return res.status(400).json({
        success: false,
        message: 'Please initiate 2FA setup first',
      });
    }

    const verified = verifyTOTP(user.twoFactorSecret, token);

    if (!verified) {
      return res.status(401).json({
        success: false,
        message: 'Invalid 2FA token',
      });
    }

    const backupCodes = generateBackupCodes();
    const hashedCodes = await hashBackupCodes(backupCodes);

    user.twoFactorEnabled = true;
    user.twoFactorVerified = true;
    user.twoFactorBackupCodes = hashedCodes;
    await user.save();

    await createAuditLog({
      userId: user._id,
      action: '2FA_ENABLED',
      email: user.email,
      ip: req.ip,
      userAgent: req.get('user-agent'),
    });

    return res.status(200).json({
      success: true,
      message: '2FA enabled successfully',
      data: {
        backupCodes,
      },
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Verify 2FA during login
 * POST /api/auth/verify-2fa
 */
exports.verify2FA = async (req, res) => {
  try {
    const { token, backupCode } = req.body;

    if (!req.user.twoFactorPending) {
      return res.status(400).json({
        success: false,
        message: '2FA verification not required',
      });
    }

    const user = await User.findById(req.user.id)
      .select('+twoFactorSecret +twoFactorBackupCodes');

    if (!user?.twoFactorEnabled) {
      return res.status(400).json({
        success: false,
        message: '2FA is not enabled for this account',
      });
    }

    let verified = false;

    if (token) {
      verified = verifyTOTP(user.twoFactorSecret, token);
    }

    if (!verified && backupCode) {
      const codeIndex = await verifyBackupCode(
        user.twoFactorBackupCodes,
        backupCode
      );

      if (codeIndex !== -1) {
        verified = true;
        user.twoFactorBackupCodes.splice(codeIndex, 1);
        await user.save();
      }
    }

    if (!verified) {
      await createAuditLog({
        userId: user._id,
        action: 'LOGIN_FAILURE',
        email: user.email,
        ip: req.ip,
        userAgent: req.get('user-agent'),
        metadata: { reason: 'Invalid 2FA code' },
      });

      return res.status(401).json({
        success: false,
        message: 'Invalid 2FA code or backup code',
      });
    }

    const authToken = generateToken(user._id, user.role, false);

    await createAuditLog({
      userId: user._id,
      action: '2FA_VERIFIED',
      email: user.email,
      ip: req.ip,
      userAgent: req.get('user-agent'),
    });

    await createAuditLog({
      userId: user._id,
      action: 'LOGIN_SUCCESS',
      email: user.email,
      ip: req.ip,
      userAgent: req.get('user-agent'),
    });

    return res.status(200).json({
      success: true,
      message: 'Login successful',
      token: authToken,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        department: user.department,
      },
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Disable 2FA
 * POST /api/auth/2fa/disable
 */
exports.disable2FA = async (req, res) => {
  try {
    const { password, token } = req.body;

    if (!password) {
      return res.status(400).json({
        success: false,
        message: 'Password is required',
      });
    }

    const user = await User.findById(req.user.id)
      .select('+password +twoFactorSecret +twoFactorBackupCodes');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    const isMatch = await user.matchPassword(password);

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid password',
      });
    }

    if (user.twoFactorEnabled && (!token || !verifyTOTP(user.twoFactorSecret, token))) {
      return res.status(401).json({
        success: false,
        message: 'Invalid 2FA token',
      });
    }

    user.twoFactorEnabled = false;
    user.twoFactorSecret = undefined;
    user.twoFactorBackupCodes = undefined;
    user.twoFactorVerified = false;
    await user.save();

    await createAuditLog({
      userId: user._id,
      action: '2FA_DISABLED',
      email: user.email,
      ip: req.ip,
      userAgent: req.get('user-agent'),
    });

    return res.status(200).json({
      success: true,
      message: '2FA disabled successfully',
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Get current logged in user
 * GET /api/auth/me
 */
exports.getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);

    res.status(200).json({
      success: true,
      user,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Update user profile
 * PUT /api/auth/updateprofile
 */
exports.updateProfile = async (req, res, next) => {
  try {
    const { name, phone, photo } = req.body;

    const user = await User.findByIdAndUpdate(
      req.user.id,
      { name, phone, photo },
      { new: true, runValidators: true }
    );

    res.status(200).json({
      success: true,
      user,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Change user password while logged in
 * PUT /api/auth/change-password
 */
exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Current password and new password are required',
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'New password must be at least 6 characters long',
      });
    }

    const user = await User.findById(req.user.id).select('+password');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    const isMatch = await user.matchPassword(currentPassword);

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Current password is incorrect',
      });
    }

    user.password = newPassword;
    await user.save();

    await createAuditLog({
      userId: user._id,
      action: 'PASSWORD_CHANGED',
      email: user.email,
      ip: req.ip,
      userAgent: req.get('user-agent'),
    });

    return res.status(200).json({
      success: true,
      message: 'Password changed successfully',
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};
