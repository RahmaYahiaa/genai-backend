import User, { toPublicUser } from './user.model.js';

export async function create(data) {
  // Ensures unique indexes exist before the first writes (they are built
  // asynchronously in development; a no-op when autoIndex is disabled).
  await User.init();
  return User.create(data);
}

export async function findByEmail(email) {
  return User.findOne({ email: email.toLowerCase() }).lean();
}

/**
 * Login lookup: includes the password hash and token version, which are
 * select:false by default.
 */
export async function findByEmailWithCredentials(email) {
  return User.findOne({ email: email.toLowerCase() }).select('+passwordHash +tokenVersion').lean();
}

/** Auth middleware lookup: needs tokenVersion, never the password hash. */
export async function findByIdWithTokenVersion(userId) {
  return User.findById(userId).select('+tokenVersion').lean();
}

export async function findById(userId) {
  return User.findById(userId).lean();
}

export async function updateById(userId, update) {
  return User.findByIdAndUpdate(userId, update, { new: true }).lean();
}

export { toPublicUser };