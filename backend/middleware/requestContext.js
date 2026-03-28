const crypto = require('crypto');

const createRequestId = () => {
  if (typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return crypto.randomBytes(16).toString('hex');
};

const attachRequestContext = (req, res, next) => {
  req.requestId = createRequestId();
  res.setHeader('X-Request-Id', req.requestId);
  next();
};

const logRequestLifecycle = (req, res, next) => {
  const startedAt = Date.now();

  res.on('finish', () => {
    const durationMs = Date.now() - startedAt;
    const ip = req.ip || 'unknown';
    const method = req.method;
    const url = req.originalUrl;
    const status = res.statusCode;

    console.log(`[${req.requestId}] ${method} ${url} ${status} ${durationMs}ms ip=${ip}`);
  });

  next();
};

module.exports = {
  attachRequestContext,
  logRequestLifecycle,
};
