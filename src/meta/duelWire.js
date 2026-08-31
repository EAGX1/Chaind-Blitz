/** Shared host/join wire: start / build / pick inbox. */

export function makePushSession() {
  const inbox = [];
  const waiters = [];
  const closeCbs = new Set();
  let startWait = null;
  let startPayload = null;
  let buildWait = null;
  let buildPayload = null;
  let closed = false;
  let sender = () => false;
  let closer = () => {};

  function flush() {
    while (inbox.length && waiters.length) {
      const w = waiters.shift();
      w(inbox.shift());
    }
  }

  function markClosed() {
    if (closed) return;
    closed = true;
    startWait?.(null);
    buildWait?.(null);
    startWait = null;
    buildWait = null;
    while (waiters.length) waiters.shift()(null);
    for (const cb of closeCbs) {
      try { cb(); } catch { /* ignore */ }
    }
  }

  return {
    get closed() {
      return closed;
    },
    setSender(fn) {
      if (typeof fn === "function") sender = fn;
    },
    setCloser(fn) {
      if (typeof fn === "function") closer = fn;
    },
    ingest(raw) {
      let msg = raw;
      if (typeof raw === "string") {
        try { msg = JSON.parse(raw); } catch { return; }
      }
      if (!msg || typeof msg !== "object") return;
      if (msg.type === "start") {
        startPayload = msg;
        startWait?.(msg);
        startWait = null;
        return;
      }
      if (msg.type === "build") {
        buildPayload = msg;
        buildWait?.(msg);
        buildWait = null;
        return;
      }
      if (msg.type === "pick") {
        inbox.push(msg);
        flush();
      }
    },
    send(payload) {
      if (closed) return false;
      return sender(payload);
    },
    pullAction(_method, _player) {
      if (inbox.length) return Promise.resolve(inbox.shift().packed ?? null);
      if (closed) return Promise.resolve(null);
      return new Promise((resolve) => {
        waiters.push((msg) => resolve(msg ? msg.packed ?? null : null));
      });
    },
    onClose(cb) {
      if (typeof cb === "function") closeCbs.add(cb);
    },
    waitStart(ms = 120000) {
      if (startPayload) return Promise.resolve(startPayload);
      if (closed) return Promise.resolve(null);
      return new Promise((resolve) => {
        const t = setTimeout(() => {
          if (startWait) { startWait = null; resolve(null); }
        }, ms);
        startWait = (msg) => { clearTimeout(t); resolve(msg); };
      });
    },
    waitBuild(ms = 120000) {
      if (buildPayload) return Promise.resolve(buildPayload);
      if (closed) return Promise.resolve(null);
      return new Promise((resolve) => {
        const t = setTimeout(() => {
          if (buildWait) { buildWait = null; resolve(null); }
        }, ms);
        buildWait = (msg) => { clearTimeout(t); resolve(msg); };
      });
    },
    markClosed,
    close() {
      markClosed();
      try { closer(); } catch { /* ignore */ }
    }
  };
}
