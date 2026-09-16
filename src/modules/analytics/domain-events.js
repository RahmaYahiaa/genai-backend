const DEBOUNCE_MS = Number(process.env.ANALYTICS_DEBOUNCE_MS ?? 200);

/**
 * In-process domain events (fixed stack: no broker). `emit` is synchronous
 * fire-and-forget; handlers never throw into the publisher. The analytics
 * scheduler subscribes to the domain events and coalesces recompute work per
 * course, so a 200-submission bulk approval collapses into ONE snapshot
 * recompute after the debounce window.
 */
export function createDomainEvents() {
  const listeners = new Map();

  return {
    on(event, handler) {
      const set = listeners.get(event) ?? new Set();
      set.add(handler);
      listeners.set(event, set);
    },

    emit(event, payload) {
      for (const handler of listeners.get(event) ?? []) {
        try {
          handler(payload);
        } catch {
          // A broken subscriber must never break the publishing flow.
        }
      }
    },
  };
}

export function createAnalyticsScheduler({ recomputeCourse, logger }) {
  const dirtyCourseIds = new Set();
  let timer = null;

  async function flush() {
    const courseIds = Array.from(dirtyCourseIds);
    dirtyCourseIds.clear();
    timer = null;
    for (const courseId of courseIds) {
      try {
        await recomputeCourse(courseId);
      } catch (error) {
        logger.error(
          { courseId, err: error.message },
          'analytics snapshot recompute failed',
        );
      }
    }
  }

  return {
    schedule(courseId) {
      dirtyCourseIds.add(String(courseId));
      if (timer) return;
      timer = setTimeout(() => {
        void flush();
      }, DEBOUNCE_MS);
      if (typeof timer.unref === 'function') {
        timer.unref();
      }
    },

    async flushNow() {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      await flush();
    },
  };
}