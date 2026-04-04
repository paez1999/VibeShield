const { query } = require('../db/pool');
const logger = require('../utils/logger');

/**
 * Logs an action to the immutable audit_log table.
 */
async function auditLog({ orgId, userId, action, resourceType, resourceId, ip, userAgent, metadata = {} }) {
  try {
    await query(
      `INSERT INTO audit_log(org_id, user_id, action, resource_type, resource_id, ip_address, user_agent, metadata)
       VALUES($1, $2, $3, $4, $5, $6::inet, $7, $8)`,
      [orgId, userId || null, action, resourceType || null, resourceId || null, ip || null, userAgent || null, JSON.stringify(metadata)]
    );
  } catch (err) {
    logger.error('Failed to write audit log', { error: err.message, action });
  }
}

/**
 * Express middleware factory — auto-logs on response finish.
 */
function auditMiddleware(action, resourceType) {
  return (req, res, next) => {
    res.on('finish', () => {
      if (res.statusCode < 400 && req.user) {
        auditLog({
          orgId: req.user.orgId,
          userId: req.user.id,
          action,
          resourceType,
          resourceId: req.params.id || null,
          ip: req.ip,
          userAgent: req.headers['user-agent'],
        });
      }
    });
    next();
  };
}

module.exports = { auditLog, auditMiddleware };
