/**
 * Local Mode - skip Electric SQL, use local SQLite only.
 *
 * Set SUPERSET_LOCAL_MODE=1 for single-developer workflow without Caddy proxy.
 */

/**
 * Check if Local Mode is enabled.
 *
 * In Local Mode, the app skips Electric SQL sync and uses local SQLite only.
 * This is useful for single-developer workflows where you don't need real-time sync.
 *
 * @returns true if SUPERSET_LOCAL_MODE=1
 */
export const isLocalMode = () => process.env.SUPERSET_LOCAL_MODE === "1";
