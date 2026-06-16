/* ============================================================================
 *  wallet.js — Solana Play-to-Earn layer for $GOAL.
 *
 *  Design: rewards are accrued locally (off-chain ledger) during play and can
 *  be "claimed" to a connected Phantom wallet. The claim function is a clean
 *  integration point — wire it to your backend mint authority / reward program
 *  to actually transfer SPL tokens. Until then it runs in DEMO mode so the full
 *  game loop is playable end-to-end without a live mint.
 * ========================================================================== */

const Wallet = (() => {
  const LS_KEY = 'wc2026_goal_ledger_v1';
  const state = {
    connected: false,
    address: null,
    pendingRewards: 0,   // earned this/previous sessions, not yet claimed
    claimedTotal: 0,     // lifetime claimed to chain
    lastDaily: null,
    history: [],
  };

  function load() {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) Object.assign(state, JSON.parse(raw));
    } catch (e) { /* ignore */ }
  }
  function save() {
    try { localStorage.setItem(LS_KEY, JSON.stringify(state)); } catch (e) { /* ignore */ }
  }

  function getProvider() {
    if (window.solana && window.solana.isPhantom) return window.solana;
    if (window.phantom && window.phantom.solana) return window.phantom.solana;
    return null;
  }

  async function connect() {
    const provider = getProvider();
    if (!provider) {
      // No Phantom installed → DEMO wallet so P2E flow is still demonstrable.
      state.connected = true;
      state.address = 'DEMO' + Math.floor(performance.now() % 1e6).toString(36).toUpperCase() + 'WC26';
      save();
      return { ok: true, demo: true, address: state.address };
    }
    try {
      const resp = await provider.connect();
      state.connected = true;
      state.address = resp.publicKey.toString();
      save();
      return { ok: true, demo: false, address: state.address };
    } catch (e) {
      return { ok: false, error: e.message || 'User rejected connection' };
    }
  }

  async function disconnect() {
    const provider = getProvider();
    if (provider && provider.disconnect) { try { await provider.disconnect(); } catch (e) {} }
    state.connected = false;
    state.address = null;
    save();
  }

  function shortAddr() {
    if (!state.address) return '';
    return state.address.slice(0, 4) + '…' + state.address.slice(-4);
  }

  function award(amount, reason) {
    amount = Math.round(amount);
    state.pendingRewards += amount;
    state.history.unshift({ amount, reason, t: nowStamp() });
    if (state.history.length > 40) state.history.pop();
    save();
    Sound.coin();
    return amount;
  }

  function nowStamp() {
    // Avoid Date in deterministic contexts isn't a concern in-browser.
    const d = new Date();
    return d.toISOString().slice(0, 19).replace('T', ' ');
  }

  function canClaimDaily() {
    if (!state.lastDaily) return true;
    const last = new Date(state.lastDaily);
    const now = new Date();
    return now.toDateString() !== last.toDateString();
  }

  function claimDaily() {
    if (!canClaimDaily()) return 0;
    state.lastDaily = new Date().toISOString();
    return award(CONFIG.TOKEN.DAILY_REWARD, 'Daily login reward');
  }

  /* Claim pending rewards to the connected wallet.
   * INTEGRATION POINT: replace the demo block with a call to your reward
   * program / backend that signs an SPL token transfer of `amount` $GOAL to
   * `state.address`, then resolves on confirmation. */
  async function claimToChain() {
    if (!state.connected) return { ok: false, error: 'Connect a wallet first' };
    if (state.pendingRewards <= 0) return { ok: false, error: 'No rewards to claim' };

    const amount = state.pendingRewards;

    // ---- DEMO settlement (no real transfer) ----
    await new Promise(r => setTimeout(r, 800));
    state.claimedTotal += amount;
    state.pendingRewards = 0;
    state.history.unshift({ amount, reason: 'Claimed to wallet', t: nowStamp(), claim: true });
    save();
    Sound.coin();
    return {
      ok: true, demo: !getProvider(), amount,
      mint: CONFIG.TOKEN.MINT, network: CONFIG.TOKEN.NETWORK,
      // A real implementation returns the confirmed tx signature here:
      signature: 'demo-' + amount + '-' + Math.floor(performance.now()),
    };
  }

  load();

  return {
    state,
    connect, disconnect, shortAddr,
    award, claimDaily, canClaimDaily, claimToChain,
    isConnected: () => state.connected,
    pending: () => state.pendingRewards,
    claimed: () => state.claimedTotal,
    history: () => state.history,
  };
})();
