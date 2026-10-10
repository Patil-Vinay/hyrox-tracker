// Stand-in for public/firebase-sdk.js used only in tests: same window.FBX API, in-memory data,
// and the same permission logic as firestore.rules (read: signed in; write: own docs or admin).
(function () {
  const seed = window.__SEED || {};           // { col: { id: rawDoc } }
  const admins = window.__RULE_ADMINS || ['admin@test.com'];
  const locked = !!window.__LOCKED;           // rules not published yet: everything refused
  const DB = JSON.parse(JSON.stringify(seed));
  const subs = {};
  let user = null, authCb = null;
  window.__DB = DB; window.__WRITES = []; window.__REFUSED = [];
  const uidOf = email => 'u' + email.split('@')[0].replace(/[^a-z0-9]/gi, '');
  const members = window.__RULE_MEMBERS || null; // like members() in the rules (uids); null = any signed-in account
  const member = () => !!user && (!members || members.includes(user.uid));
  const isAdmin = () => member() && (admins.includes(user.email.toLowerCase()) || admins.includes(user.uid));
  const owns = (col, id) => !!user && ((['profiles', 'bench', 'niggles', 'body', 'myex'].includes(col) && id === user.uid) || (['logs', 'weekly', 'together'].includes(col) && id.split('_')[0] === user.uid));
  const memberPlanDay = col => !!user && col === 'plan_days' && !!(DB.profiles || {})[user.uid]; // v32, like firestore.rules
  const togetherAllows = (col, id) => { // like firestore.rules
    if (!user || col !== 'logs' || !DB.together) return false;
    const T = DB.together, owner = id.split('_')[0], date = id.split('_')[1], mine = T[user.uid + '_' + date];
    if (!mine || mine.in !== true || !mine.g) return false;
    const maker = T[mine.g.split(':')[0] + '_' + date];
    if (!maker || maker.in !== true || maker.g !== mine.g || !(maker.group || []).includes(owner)) return false;
    const od = T[owner + '_' + date]; if (od && (od.g === mine.g ? od.in !== true : od.in !== false)) return false;
    const pr = T[owner + '_prefs']; return !(pr && pr.in === false);
  };

  const snap = col => ({ fromCache: false, docs: Object.keys(DB[col] || {}).sort().map(id => ({ id, data: JSON.parse(JSON.stringify(DB[col][id])) })) });
  const notify = col => (subs[col] || []).forEach(s => setTimeout(() => s.next(snap(col)), 5));
  const OBJ = {}; window.__OBJ = OBJ;
  const storage = {
    upload(path, blob, type, onProgress) {
      return new Promise((resolve, reject) => {
        if (window.__NO_STORAGE) return setTimeout(() => reject({ code: 'storage/unknown' }), 20);
        const m = path.match(/^photos\/([^/]+)\/[^/]+$/);
        if (!member() || !m || !(m[1] === user.uid || isAdmin()) || blob.size >= 25 * 1024 * 1024 || !/^image\//.test(type)) return setTimeout(() => reject({ code: 'storage/unauthorized' }), 20);
        let k = 0; const tick = () => { k += 25; onProgress && onProgress(Math.min(k, 100) * blob.size / 100, blob.size); if (k < 100) setTimeout(tick, 15); else { OBJ[path] = { size: blob.size, type }; resolve({ url: URL.createObjectURL(blob) }); } }; tick();
      });
    },
    async remove(path) { const m = path.match(/^photos\/([^/]+)\//); if (!member() || !m || !(m[1] === user.uid || isAdmin())) throw { code: 'storage/unauthorized' }; delete OBJ[path]; }
  };
  window.FBX = {
    storage,
    init() { window.__FB_STARTED = true; return true; },
    onAuth(cb) { authCb = cb; setTimeout(() => cb(user), 30); return () => { }; },
    async signIn() {
      const email = window.__SIGNIN_AS || 'admin@test.com';
      user = { uid: uidOf(email), email, name: email.split('@')[0] + ' Test', verified: true };
      setTimeout(() => authCb && authCb(user), 20);
    },
    redirectResult: async () => null,
    async signOut() { user = null; authCb && authCb(null); },
    db: {
      collection(col) {
        return {
          onSnapshot(next, err) {
            if (!member() || locked) { setTimeout(() => err({ code: 'permission-denied' }), 20); return () => { }; }
            const s = { next }; (subs[col] = subs[col] || []).push(s);
            if (window.__CACHE_FIRST) setTimeout(() => next({ fromCache: true, docs: [] }), 10); // what Firestore's offline cache gives first
            setTimeout(() => next(snap(col)), 25);
            return () => { subs[col] = (subs[col] || []).filter(x => x !== s); };
          },
          doc(id) {
            return {
              async set(data) {
                if (window.__OFFLINE) return new Promise(() => { }); // never acknowledged, like Firestore offline
                const shapeOk = col === 'together' ? Object.keys(data).every(k => ['j', 'allow', 'g', 'in', 'group'].includes(k)) && typeof data.j === 'string' && Array.isArray(data.allow) && data.allow.length <= 30 && typeof data.g === 'string' && typeof data.in === 'boolean' && Array.isArray(data.group) && data.group.length <= 30 : Object.keys(data).length === 1 && typeof data.j === 'string';
                if (locked || !member() || !shapeOk || !(isAdmin() || owns(col, id) || togetherAllows(col, id) || memberPlanDay(col))) { window.__REFUSED.push(col + '/' + id); throw { code: 'permission-denied' }; }
                DB[col] = DB[col] || {}; DB[col][id] = JSON.parse(JSON.stringify(data)); window.__WRITES.push(col + '/' + id); notify(col);
              },
              async delete() { if (!isAdmin()) throw { code: 'permission-denied' }; delete (DB[col] || {})[id]; notify(col); }
            };
          }
        };
      }
    }
  };
})();
