function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withRetry(operation, options = {}) {
  const {
    maxAttempts = 3,
    baseDelayMs = 1000,
    onRetry = null,
  } = options;

  let lastError;
  let lastDurationMs = 0;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const startedAt = Date.now();

    try {
      const result = await operation(attempt);

      return {
        success: true,
        result,
        attempts: attempt,
        durationMs: Date.now() - startedAt,
      };
    } catch (error) {
      const durationMs = Date.now() - startedAt;
      lastDurationMs = durationMs;
      lastError = error;

      console.log(
        `Attempt ${attempt}/${maxAttempts} failed: ${error.message}`
      );

      if (attempt === maxAttempts) {
        break;
      }

      const delay =
        baseDelayMs * Math.pow(2, attempt - 1) + Math.random() * 300;

      console.log(`Waiting ${delay}ms before retry...`);

      if (onRetry) {
        await onRetry({
          attempt,
          nextAttempt: attempt + 1,
          delay,
          error,
          durationMs,
        });
      }

      await sleep(delay);
    }
  }

  return {
    success: false,
    result: null,
    attempts: maxAttempts,
    error: lastError,
    durationMs: lastDurationMs,
  };
}

module.exports = {
  withRetry,
};