import { config } from '../../config/index.js';
import { logger } from '../../config/logger.js';

/**
 * LeRna-first structured AI (Strategy decorator over the local provider).
 *
 * Every `completeJson({ task, system, user })` call in the backend (question
 * generation, answer evaluation, grading, remedial content, study-tool
 * resources, topic detection...) is executed by LeRna first through
 * POST /platform/tasks/run. When LeRna is disabled, unreachable, slow or
 * returns an error, the SAME call runs on the local provider, so every
 * feature keeps working when LeRna is down. Callers still validate the output
 * with their Zod schemas either way.
 */
export function createLernaFirstLlmProvider({ local, lernaClient, timeoutMs, probeTimeoutMs }) {
  // Short memory of LeRna's state so a down engine costs one fast probe per
  // window instead of a timeout on every request.
  let state = { up: null, at: 0 };
  const UP_TTL = 60_000;
  const DOWN_TTL = 20_000;

  async function lernaUp() {
    if (!config.lerna.enabled || !lernaClient) return false;
    const now = Date.now();
    if (state.up !== null && now - state.at < (state.up ? UP_TTL : DOWN_TTL)) return state.up;
    let up = false;
    try {
      const health = await lernaClient.get('/health', { timeoutMs: probeTimeoutMs });
      up = health?.status === 'ok';
    } catch {
      up = false;
    }
    state = { up, at: now };
    return up;
  }

  function markDown() {
    state = { up: false, at: Date.now() };
  }

  function parseUser(user) {
    if (typeof user !== 'string') return user;
    try {
      return JSON.parse(user);
    } catch {
      return user;
    }
  }

  return {
    name: `lerna-first(${local?.name ?? 'local'})`,
    get model() {
      return local?.model ?? null;
    },
    lastSource: null,
    async completeJson(prompt) {
      if (await lernaUp()) {
        try {
          const response = await lernaClient.post('/platform/tasks/run', {
            timeoutMs,
            body: {
              task: prompt.task,
              system: prompt.system ?? null,
              input: parseUser(prompt.user),
              language: prompt.language ?? null,
            },
          });
          if (response && typeof response.output === 'object' && response.output !== null) {
            this.lastSource = 'lerna';
            return response.output;
          }
          throw new Error('LeRna returned no output');
        } catch (error) {
          // 5xx / network / timeout: engine or its providers are down -> local.
          // A 4xx (unknown task) is a contract issue: also use local, don't mark down.
          const message = String(error?.message ?? '');
          if (!/\(4\d\d\)/.test(message)) markDown();
          logger.warn({ task: prompt.task, err: message }, 'LeRna task failed, using local AI');
        }
      }
      this.lastSource = 'local';
      return local.completeJson(prompt);
    },
  };
}
