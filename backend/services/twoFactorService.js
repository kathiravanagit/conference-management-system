const speakeasy = require('speakeasy');
const qrcode = require('qrcode');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');

exports.generateTwoFactorSecret = (email) => {
  const secret = speakeasy.generateSecret({
    name: `ConferenceHub (${email})`,
    issuer: 'ConferenceHub',
    length: 32,
  });

  return {
    secret: secret.base32,
    otpauthUrl: secret.otpauth_url,
  };
};

exports.generateQRCode = async (otpauthUrl) => {
  const qrCodeDataUrl = await qrcode.toDataURL(otpauthUrl);
  return qrCodeDataUrl;
};

exports.verifyTOTP = (secret, token) => {
  return speakeasy.totp.verify({
    secret,
    encoding: 'base32',
    token,
    window: 2,
  });
};

exports.generateBackupCodes = (count = 10) => {
  const codes = [];
  for (let i = 0; i < count; i += 1) {
    const code = crypto.randomBytes(4).toString('hex').toUpperCase();
    codes.push(code);
  }
  return codes;
};

exports.hashBackupCodes = async (codes) => {
  const hashedCodes = await Promise.all(
    codes.map((code) => bcrypt.hash(code, 10))
  );
  return hashedCodes;
};

exports.verifyBackupCode = async (hashedCodes, inputCode) => {
  for (let i = 0; i < hashedCodes.length; i += 1) {
    const isMatch = await bcrypt.compare(inputCode, hashedCodes[i]);
    if (isMatch) {
      return i;
    }
  }
  return -1;
};
