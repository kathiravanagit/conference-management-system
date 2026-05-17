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
const { OAuth2Client } = require('google-auth-library');
const crypto = require('crypto');
const { createAuditLog } = require('../services/auditLogService');
const { generateCSRFToken } = require('../middleware/csrf');
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
    const allowedRoles = ['student', 'staff', 'it', 'admin'];
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
    const { email, password, rememberMe = true } = req.body;

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
      const twoFactorToken = generateToken(user._id, user.role, true, rememberMe);

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

    const token = generateToken(user._id, user.role, false, rememberMe);

    await createAuditLog({
      userId: user._id,
      action: 'LOGIN_SUCCESS',
      email: user.email,
      ip: req.ip,
      userAgent: req.get('user-agent'),
    });

    // Set httpOnly cookie instead of returning token in body
    const maxAge = rememberMe ? 30 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
    res.cookie('authToken', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      // Use 'lax' in development to allow top-level POSTs from the SPA.
      // In production (cross-site), set to 'none' and require secure.
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge,
    });

    // Also generate and send a CSRF token (sets header + cookie)
    try {
      generateCSRFToken(req, res, () => {});
    } catch (e) {
      // Non-fatal: continue without blocking login
    }

    res.status(200).json({
      success: true,
      message: 'Login successful',
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

/**
 * Login or Register user via Google OAuth
 * POST /api/auth/google
 */
exports.googleLogin = async (req, res, next) => {
  try {
    const { credential } = req.body;
    console.log('[Google Auth] Received credential (length):', credential?.length);

    if (!credential) {
      return res.status(400).json({
        success: false,
        message: 'No credentials provided',
      });
    }

    const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID || 'dummy-client-id');

    // Accept either an ID token (JWT) or an access token.
    let payload = null;
    try {
      if (typeof credential === 'string' && credential.split('.').length === 3) {
        // Looks like an ID token (JWT) — verify it
        console.log('[Google Auth] Detected ID token, verifying with google-auth-library');
        const ticket = await client.verifyIdToken({ idToken: credential, audience: process.env.GOOGLE_CLIENT_ID });
        payload = ticket.getPayload();
      } else {
        // Treat as access token — fetch userinfo
        console.log('[Google Auth] Treating credential as access token, fetching userinfo');
        const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: { Authorization: `Bearer ${credential}` }
        });
        console.log('[Google Auth] Google API response status:', response.status);

        if (!response.ok) {
          const errorText = await response.text();
          console.error('[Google Auth] Google API error:', response.status, errorText);
          return res.status(401).json({
            success: false,
            message: `Invalid Google token: ${response.status}`,
          });
        }

        payload = await response.json();
      }
    } catch (err) {
      console.error('[Google Auth] Token verification/fetch failed:', err);
      return res.status(401).json({ success: false, message: 'Invalid Google credentials' });
    }
    console.log('[Google Auth] User profile retrieved:', payload.email);
    const { email, name, picture } = payload || {};

    let user = await User.findOne({ email }).select('+password');

    if (!user) {
      // Create user if they don't exist
      const randomPassword = crypto.randomBytes(16).toString('hex');
      user = await User.create({
        name,
        email,
        password: randomPassword,
        department: 'OTHER', // Default for Google login
        role: 'student',
        photo: picture,
      });

      // Automatically confirm email since Google has verified it
      user.isEmailConfirmed = true;
      user.isVerified = true;
      await user.save();

      await createAuditLog({
        userId: user._id,
        action: 'REGISTER_GOOGLE',
        email: user.email,
        ip: req.ip,
        userAgent: req.get('user-agent'),
      });
    }

    // Two factor bypass or require? Let's check:
    if (user.twoFactorEnabled) {
      const twoFactorToken = generateToken(user._id, user.role, true);

      await createAuditLog({
        userId: user._id,
        action: 'LOGIN_ATTEMPT_GOOGLE',
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
      action: 'LOGIN_SUCCESS_GOOGLE',
      email: user.email,
      ip: req.ip,
      userAgent: req.get('user-agent'),
    });

    // Set httpOnly cookie (same as regular login) so the session persists
    const maxAge = 30 * 24 * 60 * 60 * 1000; // 30 days for Google login
    res.cookie('authToken', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge,
    });

    // Also generate and send a CSRF token
    try {
      generateCSRFToken(req, res, () => {});
    } catch (e) {
      // Non-fatal: continue without blocking login
    }

    res.status(200).json({
      success: true,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        department: user.department,
        photo: user.photo,
      },
    });

  } catch (error) {
    res.status(400).json({
      success: false,
      message: 'Google authentication failed: ' + error.message,
    });
  }
};

/**
 * Delete User Account
 * DELETE /api/auth/delete-account
 */
exports.deleteAccount = async (req, res) => {
  try {
    const { password } = req.body;

    // 1. Get user with password
    const user = await User.findById(req.user.id).select('+password');
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // 2. Check password if user has one (they might only have google login)
    if (user.password) {
      if (!password) {
        return res.status(400).json({ success: false, message: 'Please provide your password to confirm deletion.' });
      }
      const isMatch = await user.matchPassword(password);
      if (!isMatch) {
        return res.status(401).json({ success: false, message: 'Invalid password. Account deletion failed.' });
      }
    }

    // 3. Log the deletion before we actually delete them
    await createAuditLog({
      userId: user._id,
      action: 'ACCOUNT_DELETED',
      email: user.email,
      ip: req.ip,
      userAgent: req.get('user-agent'),
      metadata: { deletedAt: new Date() }
    });

    // 4. Delete the user
    await User.findByIdAndDelete(req.user.id);

    // Note: In an enterprise app, we would also cascade delete to Registrations, Feedback, etc.
    // For this scope, deleting the auth user is sufficient for the "Danger Zone" demo.

    res.status(200).json({
      success: true,
      message: 'Account permanently deleted. We are sorry to see you go!',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to delete account: ' + error.message,
    });
  }
};

/**
 * Logout User
 * POST /api/auth/logout
 */
exports.logout = async (req, res) => {
  try {
    await createAuditLog({
      userId: req.user?.id,
      action: 'LOGOUT',
      email: req.user?.email,
      ip: req.ip,
      userAgent: req.get('user-agent'),
    });

    // Clear the httpOnly auth cookie
    res.clearCookie('authToken', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
    });

    res.status(200).json({
      success: true,
      message: 'Logged out successfully',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Logout failed: ' + error.message,
    });
  }
};
