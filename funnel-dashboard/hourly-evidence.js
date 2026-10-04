/* Shared display calculations; this file does not send mail or enforce quotas. */
(function(root) {
  const MAX_SOURCE_AGE = 90 * 60 * 1000;
  function sourceTime(f) {
    return f?.sourceChecks?.gmail?.checkedAt || f?.sourceChecks?.gmailPrimary?.checkedAt || f?.lastChecked || f?.lastRun || null;
  }
  function freshness(f, now = Date.now()) {
    if (f?.freshness === 'TELEMETRY_SYNC_BLOCKED') return 'TELEMETRY_SYNC_BLOCKED';
    const at = Date.parse(sourceTime(f));
    if (!Number.isFinite(at) || at > now + 300000) return 'AWAITING_FIRST_SYNC';
    return now - at > MAX_SOURCE_AGE ? 'STALE' : 'LIVE';
  }
  function slotBudget(q, hour) {
    if (!Number.isInteger(hour) || hour < 9 || hour > 19) return 0;
    const k = hour - 9;
    return Math.floor(q * (k + 1) / 11) - Math.floor(q * k / 11);
  }
  function runState(r, now = Date.now()) {
    if (!r) return 'Report unavailable';
    if (r.status === 'AWAITING_FIRST_RUN') {
      const start = Date.parse(r.effectiveAt);
      return Number.isFinite(start) && now - start > MAX_SOURCE_AGE ? 'First run report overdue' : 'Awaiting first run';
    }
    if (r.status === 'RUNNING') {
      const at = Date.parse(r.heartbeatAt || r.startedAt);
      return !Number.isFinite(at) || at > now + 300000 || now - at > 45 * 60000 ? 'Completion unverified' : 'Running (reported)';
    }
    if (!['COMPLETE', 'PARTIAL', 'BLOCKED'].includes(r.status)) return 'State unverified';
    const finished = Date.parse(r.finishedAt);
    if (!Number.isFinite(finished) || finished > now + 300000) return 'Completion unverified';
    return (now - finished > MAX_SOURCE_AGE ? 'Stale · ' : '') + r.status.toLowerCase();
  }
  const api = {sourceTime, freshness, slotBudget, runState};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.HourlyEvidence = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
