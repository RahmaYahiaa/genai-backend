export function createGradingQueue({ gradingService, logger }) {
  const queue = [];
  let running = false;

  async function drain() {
    if (running) return;
    running = true;
    try {
      while (queue.length > 0) {
        const submissionId = queue.shift();
        try {
          await gradingService.gradeAttemptAnswers(submissionId);
        } catch (error) {
          logger.error(`grading job failed for submission ${submissionId}: ${error?.message}`);
        }
      }
    } finally {
      running = false;
    }
  }

  function enqueue(submissionId) {
    queue.push(String(submissionId));
    drain();
  }

  return { enqueue };
}