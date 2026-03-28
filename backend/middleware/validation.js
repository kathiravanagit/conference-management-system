const mongoose = require('mongoose');
const validator = require('validator');

const sendValidationError = (res, message) =>
  res.status(400).json({
    success: false,
    message,
  });

const normalizeString = (value) =>
  String(value || '')
    .replace(/\s+/g, ' ')
    .trim();

const validateRegisterPayload = (req, res, next) => {
  const name = normalizeString(req.body?.name);
  const email = normalizeString(req.body?.email).toLowerCase();
  const password = String(req.body?.password || '');
  const department = normalizeString(req.body?.department);
  const role = normalizeString(req.body?.role).toLowerCase();

  if (!name || !email || !password || !department) {
    return sendValidationError(res, 'Please provide all required fields');
  }

  if (name.length < 2 || name.length > 80) {
    return sendValidationError(res, 'Name must be between 2 and 80 characters');
  }

  if (!validator.isEmail(email)) {
    return sendValidationError(res, 'Please provide a valid email address');
  }

  if (password.length < 8 || password.length > 128) {
    return sendValidationError(res, 'Password must be between 8 and 128 characters');
  }

  if (department.length < 2 || department.length > 100) {
    return sendValidationError(res, 'Department must be between 2 and 100 characters');
  }

  req.body.name = name;
  req.body.email = email;
  req.body.department = department;
  req.body.role = role;

  return next();
};

const validateLoginPayload = (req, res, next) => {
  const email = normalizeString(req.body?.email).toLowerCase();
  const password = String(req.body?.password || '');

  if (!email || !password) {
    return sendValidationError(res, 'Please provide email and password');
  }

  if (!validator.isEmail(email)) {
    return sendValidationError(res, 'Please provide a valid email address');
  }

  if (password.length > 128) {
    return sendValidationError(res, 'Password length is invalid');
  }

  req.body.email = email;
  return next();
};

const validateForgotPasswordPayload = (req, res, next) => {
  const email = normalizeString(req.body?.email).toLowerCase();

  if (!email) {
    return sendValidationError(res, 'Please provide your email address');
  }

  if (!validator.isEmail(email)) {
    return sendValidationError(res, 'Please provide a valid email address');
  }

  req.body.email = email;
  return next();
};

const validateQAPostPayload = (req, res, next) => {
  const conferenceId = normalizeString(req.body?.conferenceId);
  const message = normalizeString(req.body?.message);

  if (!conferenceId || !message) {
    return sendValidationError(res, 'Please provide conference ID and message');
  }

  if (!mongoose.Types.ObjectId.isValid(conferenceId)) {
    return sendValidationError(res, 'Invalid conference ID');
  }

  if (message.length > 500) {
    return sendValidationError(res, 'Message cannot exceed 500 characters');
  }

  req.body.conferenceId = conferenceId;
  req.body.message = message;
  req.body.isQuestion = Boolean(req.body?.isQuestion);

  return next();
};

const validateQAReplyPayload = (req, res, next) => {
  const message = normalizeString(req.body?.message);

  if (!message) {
    return sendValidationError(res, 'Please provide a reply message');
  }

  if (message.length > 500) {
    return sendValidationError(res, 'Reply cannot exceed 500 characters');
  }

  req.body.message = message;
  return next();
};

module.exports = {
  validateRegisterPayload,
  validateLoginPayload,
  validateForgotPasswordPayload,
  validateQAPostPayload,
  validateQAReplyPayload,
};
