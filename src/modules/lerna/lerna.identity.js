/**
 * Deterministic identity mapping onto the LeRna student domain. The LeRna
 * service keeps its own JSON profiles keyed by a plain string id; the
 * `genai-` prefix makes collisions with LeRna demo ids structurally
 * impossible. Only this module (and the backend) knows the mapping.
 */
export function toLernaStudentId(user) {
  return `genai-${user.id ?? user._id}`;
}
