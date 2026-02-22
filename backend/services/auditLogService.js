const AuditLog = require('../models/AuditLog');

exports.createAuditLog = async ({
  userId,
  action,
  email,
  ip,
  userAgent,
  metadata,
}) => {
  try {
    await AuditLog.create({
      userId,
      action,
      email,
      ip,
      userAgent,
      metadata,
    });
  } catch (error) {
    console.error('Audit log error:', error.message);
  }
};
