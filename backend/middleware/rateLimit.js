const requestBuckets = new Map();

const cleanupExpiredBuckets = () => {
  const now = Date.now();
  for (const [key, bucket] of requestBuckets.entries()) {
    if (bucket.expiresAt <= now) {
      requestBuckets.delete(key);
    }
  }
};

const createRateLimiter = ({ windowMs, max, namespace, message }) => {
  if (!windowMs || !max || !namespace) {
    throw new Error('Rate limiter requires windowMs, max, and namespace');
  }

  return (req, res, next) => {
    cleanupExpiredBuckets();

    const identifier = req.user?.id || req.ip || 'anonymous';
    const key = `${namespace}:${identifier}`;
    const now = Date.now();

    const current = requestBuckets.get(key);
    if (!current || current.expiresAt <= now) {
      requestBuckets.set(key, {
        count: 1,
        expiresAt: now + windowMs,
      });
      return next();
    }

    if (current.count >= max) {
      const retryAfterSeconds = Math.ceil((current.expiresAt - now) / 1000);
      res.set('Retry-After', String(Math.max(retryAfterSeconds, 1)));
      return res.status(429).json({
        success: false,
        message,
      });
    }

    current.count += 1;
    requestBuckets.set(key, current);
    return next();
  };
};

const authLoginLimiter = createRateLimiter({
  windowMs: 10 * 60 * 1000,
  max: 8,
  namespace: 'auth-login',
  message: 'Too many login attempts. Please try again in a few minutes.',
});

const authRegisterLimiter = createRateLimiter({
  windowMs: 10 * 60 * 1000,
  max: 5,
  namespace: 'auth-register',
  message: 'Too many registration attempts. Please try again later.',
});

const authForgotPasswordLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 5,
  namespace: 'auth-forgot-password',
  message: 'Too many password reset requests. Please try again later.',
});

const qaPostLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 20,
  namespace: 'qa-post-message',
  message: 'Too many Q&A messages. Please slow down and try again.',
});

const qaReplyLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 20,
  namespace: 'qa-reply-message',
  message: 'Too many replies. Please slow down and try again.',
});

module.exports = {
  createRateLimiter,
  authLoginLimiter,
  authRegisterLimiter,
  authForgotPasswordLimiter,
  qaPostLimiter,
  qaReplyLimiter,
};
