(function () {
  const RPC_TO_AIRCRAFT = {
    "832": "C152",
    "840": "C152",
    "860": "C152",
    "831": "C152",
    "8749": "C152",
    "8596": "C152",
    "8152": "C152",
    "8804": "C152",
    "8747": "C152",
    "3288": "C172",
    "833": "C172",
    "8734": "Seneca",
  };
  const SUPABASE_URL_KEY = "navlog_supabase_url";
  const SUPABASE_ANON_KEY = "navlog_supabase_anon_key";
  const ADMIN_REMEMBER_KEY = "navlog_admin_remember";
  const ADMIN_EMAIL_KEY = "navlog_admin_email";
  const ADMIN_PASSWORD_KEY = "navlog_admin_password";
  const ADMIN_GAME_HIGH_SCORE_KEY = "navlog_admin_game_high_score";
  const ANNOUNCEMENT_SEEN_KEY = "navlog_announcement_seen_signature";
  const UTC_ADMIN_CLICK_WINDOW_MS = 1500;
  const UTC_ADMIN_TOTAL_TIMEOUT_MS = 5000;
  const ADDITIONAL_INFO_DEFAULT_ROWS = 19;
  const ADDITIONAL_INFO_DEFAULT_COLS = 9;

  const app = document.getElementById("app");
  const state = {
    view: "setup",
    navlog: createBlankNavlog(),
    settings: createDefaultSettings(),
    bugReport: {
      open: false,
      submitting: false,
      status: "",
      note: "",
    },
    catalog: {
      airports: [],
      routePresets: [],
      content: {
        manualHtml: "",
        privacyHtml: "",
        announcements: [],
        maintenanceMode: false,
        additionalInfoTable: [],
      },
    },
    announcement: {
      open: false,
      items: [],
      index: 0,
      activeSignature: "",
    },
    admin: {
      clickCount: 0,
      lastClickAt: 0,
      firstClickAt: 0,
      supabaseUrl: readStoredValue(SUPABASE_URL_KEY) || readSupabaseConfigValue("supabaseUrl"),
      supabaseAnonKey: readStoredValue(SUPABASE_ANON_KEY) || readSupabaseConfigValue("supabaseAnonKey"),
      loading: false,
      notice: "",
      error: "",
      session: null,
      presets: [],
      airports: [],
      selectedPresetId: "",
      selectedAirportCode: "",
      presetForm: createEmptyPresetForm(),
      airportForm: createEmptyAirportForm(),
      manualHtmlDraft: "",
      privacyHtmlDraft: "",
      manualDraftBaselineText: "",
      privacyDraftBaselineText: "",
      manualDraftBaselineHtml: "",
      privacyDraftBaselineHtml: "",
      loginEmail: readStoredValue(ADMIN_EMAIL_KEY),
      loginPassword: readStoredValue(ADMIN_PASSWORD_KEY),
      rememberLogin: readStoredValue(ADMIN_REMEMBER_KEY) === "1",
      manualSaveStatus: "",
      privacySaveStatus: "",
      announcementDrafts: [createEmptyAnnouncementDraft()],
      announcementSaveStatus: "",
      maintenanceMode: false,
      maintenanceSaveStatus: "",
      panel: "dashboard",
      additionalInfoPanel: "",
      additionalInfoDraft: [],
      additionalInfoSaveStatus: "",
    },
    meta: {
      hasOpenedSheet: false,
      usingPresetRoute: false,
      lastNonDocView: "setup",
      docBackView: "",
      additionalInfoPanel: "",
    },
  };
  const TRIG_TOLERANCE = 1e-6;
  const FEET_PER_METER = 3.280839895013123;
  const KNOTS_PER_MPH = 0.868976;
  const KNOTS_PER_KMH = 1 / 1.852;
  const KNOTS_PER_MS = 1.9438444924406046;
  const NM_PER_KM = 1 / 1.852;
  const NM_PER_SM = 1 / 1.150779;
  let supabaseClient = null;
  let loadingPublicCatalog = false;
  let utcTimer = null;
  let manualMathRetryCount = 0;
  let adminGameState = null;
  let adminGameAnimation = null;

  function createBlankLeg(route) {
    return {
      route: route || "",
      cas: "",
      alt: "",
      temp: "",
      windDir: "",
      windSpd: "",
      tc: "",
      wca: "",
      th: "",
      var: "",
      mh: "",
      dev: "",
      ta: "",
      gs: "",
      distance: "",
      ee: "",
      et: "",
      at: "",
      _manual: route ? { route: true } : {},
      _derived: {},
      _errors: {},
    };
  }

  function createBlankRadioRow() {
    return {
      location: "",
      cptAtis: "",
      depAap: "",
      twr: "",
      gnd: "",
      fss: "",
      remarks: "",
    };
  }

  function createBlankNavlog() {
    return {
      setup: { departure: "", destination: "" },
      header: {
        aircraft: "",
        rpCNo: "",
        gphPph: "",
        date: "",
        timeUtc: "",
      },
      legs: [createBlankLeg(""), createBlankLeg(""), createBlankLeg("")],
      tocTod: {
        roc: "",
        rod: "",
        tocEditing: true,
        todEditing: true,
        tocDistance: "",
        tocTime: "",
        todDistance: "",
        todTime: "",
      },
      radios: [createBlankRadioRow()],
      depAtisCode: "",
      destinAtisCode: "",
    };
  }

  function createEmptyPresetForm() {
    return {
      departure: "",
      destination: "",
      rows: [createEmptyPresetRow()],
    };
  }

  function createEmptyPresetRow() {
    return {
      route: "",
      tc: "",
      distance: "",
    };
  }

  function createEmptyAirportForm() {
    return {
      id: "",
      code: "",
      cptAtis: "",
      depAap: "",
      twr: "",
      gnd: "",
      fss: "",
      remarks: "",
    };
  }

  function createEmptyAnnouncementDraft() {
    return {
      id: createAnnouncementId(),
      heading: "",
      body: "",
      startDate: "",
      startTimeUtc: "",
      endDate: "",
      endTimeUtc: "",
      permanent: false,
      collapsed: false,
    };
  }

  function createAnnouncementId() {
    return `ann_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  }

  function createEmptyAdditionalInfoTable(rowCount = ADDITIONAL_INFO_DEFAULT_ROWS, columnCount = ADDITIONAL_INFO_DEFAULT_COLS) {
    const rows = Math.max(1, Number(rowCount) || ADDITIONAL_INFO_DEFAULT_ROWS);
    const cols = Math.max(1, Number(columnCount) || ADDITIONAL_INFO_DEFAULT_COLS);
    return Array.from({ length: rows }, () => Array.from({ length: cols }, () => ""));
  }

  function getAdditionalInfoRowCount(value) {
    const source = Array.isArray(value) ? value : [];
    const detected = source.length;
    return Math.max(1, detected || ADDITIONAL_INFO_DEFAULT_ROWS);
  }

  function getAdditionalInfoColumnCount(value) {
    const source = Array.isArray(value) ? value : [];
    const detected = source.reduce((max, row) => {
      const rowCols = Array.isArray(row) ? row.length : 0;
      return Math.max(max, rowCols);
    }, 0);
    return Math.max(1, detected || ADDITIONAL_INFO_DEFAULT_COLS);
  }

  function normalizeAdditionalInfoTable(value, fallbackRows = 1, fallbackCols = 1) {
    const source = Array.isArray(value) ? value : [];
    const detectedRows = getAdditionalInfoRowCount(source);
    const detectedCols = getAdditionalInfoColumnCount(source);
    const fallbackRowCount = Math.max(1, Number(fallbackRows) || 1);
    const fallback = Math.max(1, Number(fallbackCols) || ADDITIONAL_INFO_DEFAULT_COLS);
    const rowsCount = Math.max(detectedRows, fallbackRowCount);
    const cols = Math.max(detectedCols, fallback);
    const rows = Array.from({ length: rowsCount }, (_, rowIndex) => {
      const row = Array.isArray(source[rowIndex]) ? source[rowIndex] : [];
      return Array.from({ length: cols }, (_, colIndex) => String(row[colIndex] || ""));
    });
    return rows;
  }

  function resizeAdditionalInfoColumns(value, nextCols) {
    const currentRows = getAdditionalInfoRowCount(value);
    const cols = Math.max(1, Number(nextCols) || 1);
    const source = normalizeAdditionalInfoTable(value, currentRows, cols);
    return Array.from({ length: currentRows }, (_, rowIndex) => {
      const row = source[rowIndex] || [];
      return Array.from({ length: cols }, (_, colIndex) => String(row[colIndex] || ""));
    });
  }

  function resizeAdditionalInfoRows(value, nextRows) {
    const rows = Math.max(1, Number(nextRows) || 1);
    const cols = getAdditionalInfoColumnCount(value);
    const source = normalizeAdditionalInfoTable(value, rows, cols);
    return Array.from({ length: rows }, (_, rowIndex) => {
      const row = source[rowIndex] || [];
      return Array.from({ length: cols }, (_, colIndex) => String(row[colIndex] || ""));
    });
  }

  function readStoredValue(key) {
    try {
      return String(window.localStorage.getItem(key) || "");
    } catch {
      return "";
    }
  }

  function readSupabaseConfigValue(field) {
    try {
      const config = window.NAVLOG_CONFIG || {};
      return String(config[field] || "").trim();
    } catch {
      return "";
    }
  }

  function writeStoredValue(key, value) {
    try {
      if (!value) window.localStorage.removeItem(key);
      else window.localStorage.setItem(key, String(value));
    } catch {
      // ignore storage failures (private mode / blocked storage)
    }
  }

  function clonePreset(preset) {
    return {
      id: String(preset.id || ""),
      name: String(preset.name || ""),
      departure: normalizeCode(preset.departure),
      destination: normalizeCode(preset.destination),
      legs: Array.isArray(preset.legs) ? preset.legs.map((leg) => ({ ...leg })) : [],
    };
  }

  function normalizeAirportRecord(airport) {
    return {
      id: String(airport.id || airport.code || "").trim().toUpperCase(),
      code: String(airport.code || airport.id || "").trim().toUpperCase(),
      cptAtis: String(airport.cptAtis || ""),
      depAap: String(airport.depAap || ""),
      twr: String(airport.twr || ""),
      gnd: String(airport.gnd || ""),
      fss: String(airport.fss || ""),
      remarks: String(airport.remarks || ""),
    };
  }

  function render() {
    evaluateAnnouncementsPrompt();
    computeRouteMath();
    if (state.view === "setup") app.innerHTML = renderSetupScreen();
    else if (state.view === "manual") app.innerHTML = renderManualScreen();
    else if (state.view === "privacy") app.innerHTML = renderPrivacyScreen();
    else if (state.view === "additional-info") app.innerHTML = renderAdditionalInfoScreen();
    else if (state.view === "admin-login") app.innerHTML = renderAdminLoginScreen();
    else if (state.view === "admin") app.innerHTML = renderAdminScreen();
    else app.innerHTML = renderNavlogScreen();
    startUtcClock();
    if (state.view === "setup") wireSetup();
    else if (state.view === "manual") wireManual();
    else if (state.view === "privacy") wirePrivacy();
    else if (state.view === "additional-info") wireAdditionalInfo();
    else if (state.view === "admin-login") wireAdminLogin();
    else if (state.view === "admin") wireAdminPanel();
    else wireNavlog();
    wireUtcAdminTrigger();
    wireFooterActions();
    wireBugReportModal();
    wireAnnouncementModal();
    if (state.view === "manual") typesetManualMath();
  }

  function createDefaultSettings() {
    return {
      open: false,
      altitudeUnit: "ft",
      speedUnit: "kts",
      distanceUnit: "nm",
      temperatureUnit: "c",
      roundTimeValues: true,
      roundDistanceValues: true,
      showDistanceToGo: false,
      variationDeviationEnabled: false,
      pdfLayout: "default",
    };
  }

  function renderSetupScreen() {
    const presetStatus = getPresetStatusMarkup();
    const showResume = shouldShowResumeButton();
    const maintenanceBanner = state.catalog.content.maintenanceMode
      ? '<p class="maintenance-warning">Under maintenance: service is undergoing maintenance. Do not trust.</p>'
      : "";
    return `
      <div class="ui-scale">
      <main class="entry-page">
        <section class="entry-hero entry-hero-centered">
          <div class="top-center">
            <h1>Navlog</h1>
            <div class="utc-pill" id="utc-clock">UTC ${formatUtcNow()}</div>
            <p class="setup-caption">Enter your DEP and ARR aerodrome.</p>
            ${maintenanceBanner}
          </div>
        </section>
        <section class="setup-card">
          <div class="setup-grid">
            <label class="setup-field">
              <span>Departure</span>
              <input id="setup-departure" value="${escapeAttr(state.navlog.setup.departure)}" />
            </label>
            <button class="swap-button" id="swap-airports" type="button" aria-label="Swap departure and destination">&#8646;</button>
            <label class="setup-field">
              <span>Destination</span>
              <input id="setup-destination" value="${escapeAttr(state.navlog.setup.destination)}" />
            </label>
          </div>
          <div id="preset-status-slot">${presetStatus}</div>
          <div class="entry-actions">
            <button class="action primary" id="open-sheet">Open navlog</button>
            ${showResume ? `<button class="action" id="resume-sheet">Resume current sheet</button>` : ""}
          </div>
        </section>
        ${renderFrontFooter()}
        ${renderBugReportModal()}
        ${renderAnnouncementModal()}
      </main>
      </div>
    `;
  }

  function renderFrontFooter() {
    const year = new Date().getUTCFullYear();
    return `
      <footer class="front-footer">
        <div class="front-footer-links">
          <button class="footer-link" id="open-bug-report" type="button">Bug report</button>
          <button class="footer-link" id="open-manual" type="button">User manual</button>
          <button class="footer-link" id="open-additional-info" type="button">Additional Information</button>
          <button class="footer-link" id="open-privacy" type="button">Privacy policy</button>
        </div>
        <p class="front-footer-copy">© ${year} Navlog. All rights reserved.</p>
      </footer>
    `;
  }

  function renderBugReportModal() {
    if (!state.bugReport.open) return "";
    const disabled = state.bugReport.submitting ? "disabled" : "";
    const submitLabel = state.bugReport.submitting ? "Sending..." : "Send report";
    const statusClass = state.bugReport.status === "ok" ? "bug-report-status ok" : "bug-report-status error";
    return `
      <div class="bug-report-overlay" id="bug-report-overlay">
        <section class="bug-report-modal" role="dialog" aria-modal="true" aria-label="Bug report form">
          <div class="bug-report-head">
            <h3>Report a bug</h3>
            <button class="action bug-report-close" id="close-bug-report" type="button" ${disabled}>Close</button>
          </div>
          <form id="bug-report-form" class="bug-report-form">
            <label>
              <span>What went wrong?</span>
              <textarea id="bug-report-message" maxlength="2000" required placeholder="Describe what happened and how to reproduce it."></textarea>
            </label>
            <label>
              <span>Your email (optional)</span>
              <input id="bug-report-email" type="email" maxlength="200" placeholder="you@example.com" />
            </label>
            ${state.bugReport.note ? `<p class="${statusClass}">${escapeHtml(state.bugReport.note)}</p>` : ""}
            <div class="bug-report-actions">
              <button class="action primary" type="submit" ${disabled}>${submitLabel}</button>
            </div>
          </form>
        </section>
      </div>
    `;
  }

  function renderAnnouncementModal() {
    if (!state.announcement.open || !Array.isArray(state.announcement.items) || !state.announcement.items.length) return "";
    const index = Math.max(0, Math.min(state.announcement.index, state.announcement.items.length - 1));
    const total = state.announcement.items.length;
    const current = state.announcement.items[index];
    const isLast = index >= total - 1;
    const isMaintenance = String(current.kind || "") === "maintenance";
    const modalClass = isMaintenance ? "announcement-modal maintenance" : "announcement-modal";
    const bodyClass = isMaintenance ? "announcement-body maintenance" : "announcement-body";
    return `
      <div class="announcement-overlay" id="announcement-overlay">
        <section class="${modalClass}" role="dialog" aria-modal="true" aria-label="Announcement">
          <div class="announcement-head">
            <h3>${escapeHtml(current.heading || "Announcement")}</h3>
            <span class="announcement-count">${index + 1} / ${total}</span>
          </div>
          <p class="${bodyClass}">${escapeHtml(current.body || "")}</p>
          <div class="announcement-actions">
            ${
              isLast
                ? '<button class="action primary" id="announcement-close" type="button">Close</button>'
                : '<button class="action primary" id="announcement-next" type="button">Next</button>'
            }
          </div>
        </section>
      </div>
    `;
  }

  function renderManualScreen() {
    const customManual = String(state.catalog.content.manualHtml || "").trim();
    return `
      <div class="ui-scale">
      <main class="entry-page">
        <section class="topbar centered">
          <div class="top-side"><button class="back-link" id="back-from-manual">Back</button></div>
          <div class="top-center">
            <h1>User Manual</h1>
            <p class="setup-caption">Formulas, features, limits</p>
          </div>
          <div class="top-side right"></div>
        </section>
        <section class="setup-card privacy-card">
          <article class="privacy-content">
            ${
              customManual
                ? customManual
                : "<p>Manual content is not available yet. Use admin to add it.</p>"
            }
          </article>
        </section>
        ${renderFrontFooter()}
        ${renderBugReportModal()}
        ${renderAnnouncementModal()}
      </main>
      </div>
    `;
  }

  function renderPrivacyScreen() {
    const customPrivacy = String(state.catalog.content.privacyHtml || "").trim();
    return `
      <div class="ui-scale">
      <main class="entry-page">
        <section class="topbar centered">
          <div class="top-side"><button class="back-link" id="back-from-privacy">Back</button></div>
          <div class="top-center">
            <h1>Privacy Policy</h1>
            <p class="setup-caption">Last updated: ${formatPolicyDate()}</p>
          </div>
          <div class="top-side right"></div>
        </section>
        <section class="setup-card privacy-card">
          <article class="privacy-content">
            ${
              customPrivacy
                ? customPrivacy
                : "<p>Privacy policy content is not available yet. Use admin to add it.</p>"
            }
          </article>
        </section>
        ${renderFrontFooter()}
        ${renderBugReportModal()}
        ${renderAnnouncementModal()}
      </main>
      </div>
    `;
  }

  function renderAdditionalInfoScreen() {
    const sourceRows = getAdditionalInfoRowCount(state.catalog.content.additionalInfoTable);
    const sourceCols = getAdditionalInfoColumnCount(state.catalog.content.additionalInfoTable);
    const table = normalizeAdditionalInfoTable(state.catalog.content.additionalInfoTable, sourceRows, sourceCols);
    const viewPanel = String(state.meta.additionalInfoPanel || "");
    return `
      <div class="ui-scale">
      <main class="entry-page">
        <section class="topbar centered">
          <div class="top-side"><button class="back-link" id="back-from-additional-info">Back</button></div>
          <div class="top-center">
            <h1>Additional Information</h1>
          </div>
          <div class="top-side right"></div>
        </section>
        <section class="additional-info-page">
          <div class="additional-info-menu-links${viewPanel ? " hidden" : ""}">
            <button class="additional-info-link" data-additional-info-panel="aircraft" type="button">Aircraft Information</button>
          </div>
          <div class="${viewPanel === "aircraft" ? "" : "hidden"}">
            <h3 class="additional-info-subtitle">Aircraft Information</h3>
            <div class="additional-info-wrap">
              <table class="additional-info-table">
                <tbody>
                  ${table.map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`).join("")}
                </tbody>
              </table>
            </div>
          </div>
        </section>
        ${renderFrontFooter()}
        ${renderBugReportModal()}
        ${renderAnnouncementModal()}
      </main>
      </div>
    `;
  }

  function renderAdminLoginScreen() {
    const hasSupabaseConfig = Boolean(state.admin.supabaseUrl && state.admin.supabaseAnonKey);
    const statusText = state.admin.error || state.admin.notice || (!hasSupabaseConfig ? "Supabase config missing. Set window.NAVLOG_CONFIG in index.html." : "");
    const statusClass = state.admin.error || !hasSupabaseConfig ? "admin-status error" : "admin-status ok";
    const loading = Boolean(state.admin.loading);
    return `
      <div class="ui-scale">
      <main class="entry-page">
        <section class="topbar centered">
          <div class="top-side"><button class="back-link" id="back-from-admin-login">Back</button></div>
          <div class="top-center">
            <h1>Admin Login</h1>
            <p class="setup-caption">Sign in with your admin email and password</p>
          </div>
          <div class="top-side right"></div>
        </section>
        <section class="setup-card admin-card">
          <div class="admin-grid two-col">
            <label class="setup-field">
              <span>Admin email</span>
              <input id="admin-login-email" type="email" placeholder="admin@example.com" value="${escapeAttr(state.admin.loginEmail)}" ${loading ? "disabled" : ""} />
            </label>
            <label class="setup-field">
              <span>Password</span>
              <input id="admin-login-password" type="password" placeholder="••••••••" value="${escapeAttr(state.admin.loginPassword)}" ${loading ? "disabled" : ""} />
            </label>
          </div>
          <label class="admin-remember">
            <input id="admin-login-remember" type="checkbox" ${state.admin.rememberLogin ? "checked" : ""} ${loading ? "disabled" : ""} />
            <span>Save login info</span>
          </label>
          <div class="entry-actions admin-login-actions">
            <button class="action primary" id="admin-login-submit" ${(hasSupabaseConfig && !loading) ? "" : "disabled"}>${loading ? "Signing in..." : "Sign in"}</button>
            ${loading ? '<span class="admin-login-spinner" aria-hidden="true"></span>' : ""}
          </div>
          ${statusText ? `<p class="${statusClass}">${escapeHtml(statusText)}</p>` : ""}
        </section>
        ${renderFrontFooter()}
        ${renderBugReportModal()}
        ${renderAnnouncementModal()}
      </main>
      </div>
    `;
  }

  function renderAdminScreen() {
    if (!state.admin.session) return renderAdminLoginScreen();
    const statusText = state.admin.error || state.admin.notice;
    const statusClass = state.admin.error ? "admin-status error" : "admin-status ok";
    const panel = String(state.admin.panel || "dashboard");
    const presetLookup = getPresetLookupState();
    const airportLookup = getAirportLookupState();
    const presetRows = Array.isArray(state.admin.presetForm.rows) && state.admin.presetForm.rows.length
      ? state.admin.presetForm.rows
      : [createEmptyPresetRow()];
    const presetCodeOptions = collectPresetAirportCodes()
      .map((code) => `<option value="${escapeAttr(code)}"></option>`)
      .join("");
    const airportCodeOptions = state.admin.airports
      .map((airport) => `<option value="${escapeAttr(airport.code)}"></option>`)
      .join("");
    const additionalInfoPanel = String(state.admin.additionalInfoPanel || "");
    const additionalInfoRows = normalizeAdditionalInfoTable(
      state.admin.additionalInfoDraft,
      getAdditionalInfoRowCount(state.admin.additionalInfoDraft),
      getAdditionalInfoColumnCount(state.admin.additionalInfoDraft),
    );
    const panelButtons = [
      { id: "dashboard", label: "Overview" },
      { id: "presets", label: "Presets" },
      { id: "airports", label: "Airport Info" },
      { id: "announcements", label: "Announcements" },
      { id: "additional-info", label: "Additional Info" },
      { id: "manual", label: "User Manual" },
      { id: "privacy", label: "Privacy Policy" },
    ];
    return `
      <div class="ui-scale">
      <main class="entry-page">
        <section class="topbar centered">
          <div class="top-side"><button class="back-link" id="back-from-admin">Back</button></div>
          <div class="top-center">
            <h1>Admin Console</h1>
          </div>
          <div class="top-side right">
            <button class="action" id="admin-sign-out">Sign out</button>
          </div>
        </section>
        <section class="setup-card admin-card">
          <div class="admin-shell">
            <aside class="admin-menu">
              ${panelButtons.map((item) => `
                <button class="admin-menu-btn${panel === item.id ? " active" : ""}" data-admin-panel="${item.id}" type="button">${item.label}</button>
              `).join("")}
            </aside>
            <div class="admin-panel-wrap">
          <div class="manual-section${panel === "presets" ? "" : " hidden"}">
            <h3>Route Presets</h3><br>
            <datalist id="admin-preset-code-list">${presetCodeOptions}</datalist>
            <div class="admin-grid two-col">
              <label class="setup-field">
                <span>Departure</span>
                <input id="admin-preset-departure" list="admin-preset-code-list" value="${escapeAttr(state.admin.presetForm.departure)}" />
              </label>
              <label class="setup-field">
                <span>Destination</span>
                <input id="admin-preset-destination" list="admin-preset-code-list" value="${escapeAttr(state.admin.presetForm.destination)}" />
              </label>
            </div>
            <div class="preset-status ${presetLookup.active ? (presetLookup.exists ? "available" : "missing") : ""}">${presetLookup.active ? (presetLookup.exists ? "preset avbl" : "preset unavbl") : ""}</div>
            <section class="admin-preset-table">
              <div class="admin-preset-head">
                <div><button class="mini-plus inline admin-head-plus" id="admin-preset-add-row" type="button" aria-label="Add preset row">+</button>ROUTE</div>
                <div>TC</div>
                <div>DIS</div>
                <div></div>
              </div>
              <div class="admin-preset-body">
                ${presetRows.map((row, index) => {
                  const rowHasContent = String(row.route || "").trim() !== ""
                    || String(row.tc || "").trim() !== ""
                    || String(row.distance || "").trim() !== "";
                  return `
                    <div class="admin-preset-row">
                      <input data-admin-preset-row="${index}:route" value="${escapeAttr(row.route)}" />
                      <input data-admin-preset-row="${index}:tc" value="${escapeAttr(row.tc)}" />
                      <input data-admin-preset-row="${index}:distance" value="${escapeAttr(row.distance)}" />
                      <button class="action admin-mini-btn${rowHasContent ? " active" : ""}" data-admin-preset-remove="${index}" type="button" aria-label="Remove preset row" ${rowHasContent ? "" : "disabled"}>-</button>
                    </div>
                  `;
                }).join("")}
              </div>
            </section>
            <div class="entry-actions">
              <button class="action primary" id="admin-preset-save">Save</button>
              <button class="action" id="admin-preset-delete"${presetLookup.exists ? "" : " disabled"}>Delete</button>
            </div>
          </div>
          <div class="manual-section${panel === "airports" ? "" : " hidden"}">
            <h3>Airport Information</h3><br>
            <datalist id="admin-airport-code-list">${airportCodeOptions}</datalist>
            <div class="preset-status ${airportLookup.active ? (airportLookup.exists ? "available" : "missing") : ""}">${airportLookup.active ? (airportLookup.exists ? "airport avbl" : "airport unavbl") : ""}</div>
            <section class="admin-airport-table">
              <div class="admin-airport-head">
                <div>LOCATION</div>
                <div>CPT/ATIS</div>
                <div>DEP/AAP</div>
                <div>TWR</div>
                <div>GND</div>
                <div>FSS</div>
                <div>REMARKS</div>
              </div>
              <div class="admin-airport-row">
                <input id="admin-airport-code" list="admin-airport-code-list" value="${escapeAttr(state.admin.airportForm.code)}" />
                <input id="admin-airport-cptAtis" value="${escapeAttr(state.admin.airportForm.cptAtis)}" />
                <input id="admin-airport-depAap" value="${escapeAttr(state.admin.airportForm.depAap)}" />
                <input id="admin-airport-twr" value="${escapeAttr(state.admin.airportForm.twr)}" />
                <input id="admin-airport-gnd" value="${escapeAttr(state.admin.airportForm.gnd)}" />
                <input id="admin-airport-fss" value="${escapeAttr(state.admin.airportForm.fss)}" />
                <input id="admin-airport-remarks" value="${escapeAttr(state.admin.airportForm.remarks)}" />
              </div>
            </section>
            <div class="entry-actions">
              <button class="action primary" id="admin-airport-save">Save</button>
              <button class="action" id="admin-airport-delete"${airportLookup.exists ? "" : " disabled"}>Delete</button>
            </div>
          </div>
          <div class="manual-section${panel === "announcements" ? "" : " hidden"}">
            <div class="admin-announcement-title-row">
              <h3>Announcements</h3>
              <button class="action" id="admin-announcement-add">Add</button>
            </div>
            <section class="admin-announcement-list">
              ${state.admin.announcementDrafts.length ? state.admin.announcementDrafts.map((draft, index) => `
                <article class="admin-announcement-item${draft.collapsed ? " collapsed" : ""}">
                  <div class="admin-announcement-item-head">
                    <button class="admin-announcement-toggle" data-admin-announcement-toggle="${index}" type="button" aria-label="Expand or collapse announcement">
                      <span class="admin-announcement-arrow">▾</span>
                      <span class="admin-announcement-preview">${escapeHtml(String(draft.heading || "").trim())}</span>
                    </button>
                    <button class="action admin-mini-btn active" data-admin-announcement-remove="${index}" type="button">-</button>
                  </div>
                  <div class="admin-announcement-body-wrap">
                  <div class="admin-grid one-col">
                    <label class="setup-field admin-title-gap">
                      <span>Heading</span>
                      <input data-admin-announcement-field="${index}:heading" value="${escapeAttr(draft.heading)}" />
                    </label>
                  </div>
                  <label class="setup-field admin-title-gap">
                    <span>Body</span>
                    <textarea data-admin-announcement-field="${index}:body" class="admin-textarea">${escapeHtml(draft.body)}</textarea>
                  </label>
                  <div class="admin-grid two-col">
                    <label class="setup-field admin-announcement-datetime admin-title-gap">
                      <span>Start (Y/M/D) / UTC</span>
                      <div class="admin-inline-inputs">
                        <input data-admin-announcement-field="${index}:startDate" value="${escapeAttr(formatAnnouncementDateInput(draft.startDate))}" placeholder="yyyy/mm/dd" ${draft.permanent ? "disabled" : ""} />
                        <input data-admin-announcement-field="${index}:startTimeUtc" value="${escapeAttr(formatAnnouncementTimeInput(draft.startTimeUtc))}" placeholder="hh:mm" ${draft.permanent ? "disabled" : ""} />
                      </div>
                    </label>
                    <label class="setup-field admin-announcement-datetime admin-title-gap">
                      <span>End (Y/M/D) / UTC</span>
                      <div class="admin-inline-inputs">
                        <input data-admin-announcement-field="${index}:endDate" value="${escapeAttr(formatAnnouncementDateInput(draft.endDate))}" placeholder="yyyy/mm/dd" ${draft.permanent ? "disabled" : ""} />
                        <input data-admin-announcement-field="${index}:endTimeUtc" value="${escapeAttr(formatAnnouncementTimeInput(draft.endTimeUtc))}" placeholder="hh:mm" ${draft.permanent ? "disabled" : ""} />
                      </div>
                    </label>
                  </div>
                  <label class="admin-toggle-line">
                    <input data-admin-announcement-field="${index}:permanent" type="checkbox" ${draft.permanent ? "checked" : ""} />
                    <span>Permanent announcement</span>
                  </label>
                  <div class="entry-actions">
                    <button class="action primary" data-admin-announcement-save="${index}" type="button">Save</button>
                  </div>
                  </div>
                </article>
              `).join("") : '<p class="setup-caption">No announcements yet. Click Add to create one.</p>'}
            </section>
            <span class="admin-subtle-status">${escapeHtml(state.admin.announcementSaveStatus)}</span>
          </div>
          <div class="manual-section admin-maintenance-panel${panel === "announcements" ? "" : " hidden"}">
            <h3>Maintenance</h3>
            <label class="admin-toggle-line admin-maintenance-toggle">
              <input id="admin-maintenance-flag" type="checkbox" ${state.admin.maintenanceMode ? "checked" : ""} />
              <span>Under maintenance</span>
            </label>
            <span class="admin-subtle-status">${escapeHtml(state.admin.maintenanceSaveStatus)}</span>
          </div>
          <div class="manual-section${panel === "manual" ? "" : " hidden"}">
            <h3>User Manual Content</h3><br>
            <label class="setup-field">
              <textarea id="admin-manual-html" class="admin-textarea admin-textarea-large">${escapeHtml(state.admin.manualHtmlDraft)}</textarea>
            </label>
            <div class="entry-actions">
              <button class="action primary" id="admin-manual-save">Save</button>
              <span class="admin-subtle-status">${escapeHtml(state.admin.manualSaveStatus)}</span>
            </div>
          </div>
          <div class="manual-section${panel === "privacy" ? "" : " hidden"}">
            <h3>Privacy Policy Content</h3><br>
            <label class="setup-field">
              <textarea id="admin-privacy-html" class="admin-textarea admin-textarea-large">${escapeHtml(state.admin.privacyHtmlDraft)}</textarea>
            </label>
            <div class="entry-actions">
              <button class="action primary" id="admin-privacy-save">Save</button>
              <span class="admin-subtle-status">${escapeHtml(state.admin.privacySaveStatus)}</span>
            </div>
          </div>
          <div class="manual-section${panel === "additional-info" ? "" : " hidden"}">
            <h3>Additional Information</h3><br>
            <div class="additional-info-menu-links${additionalInfoPanel ? " hidden" : ""}">
              <button class="additional-info-link" data-admin-additional-panel="aircraft" type="button">Aircraft Information</button>
            </div>
            <div class="additional-info-subsection${additionalInfoPanel === "aircraft" ? "" : " hidden"}">
              <div class="entry-actions additional-info-inline-back">
                <button class="back-link" id="admin-additional-back" type="button">Back</button>
              </div>
              <h4 class="additional-info-subtitle">Aircraft Information</h4>
              <div class="additional-info-wrap">
                <table class="additional-info-table editable">
                  <tbody>
                    ${additionalInfoRows.map((row, rowIndex) => `
                      <tr>
                        ${row.map((cell, colIndex) => `<td><input data-admin-additional="${rowIndex}:${colIndex}" value="${escapeAttr(cell)}" /></td>`).join("")}
                        <td class="additional-info-row-action">
                          <button class="action admin-mini-btn active" data-admin-additional-remove-row="${rowIndex}" type="button" aria-label="Remove row">-</button>
                        </td>
                      </tr>
                    `).join("")}
                  </tbody>
                </table>
              </div>
              <div class="entry-actions additional-info-controls additional-info-controls-bottom">
                <button class="action" id="admin-additional-add-row" type="button" aria-label="Add vertical row">+</button>
              </div>
            </div>
            <div class="entry-actions">
              <button class="action primary" id="admin-additional-save">Save</button>
              <span class="admin-subtle-status">${escapeHtml(state.admin.additionalInfoSaveStatus)}</span>
            </div>
          </div>
          <div class="manual-section${panel === "dashboard" ? "" : " hidden"}">
            <h3>Overview</h3><br>
            <p class="setup-caption">Select a section from the left menu to manage content.</p>
            <div class="admin-game-card">
              <div class="admin-game-stage">
                <canvas id="admin-mini-game" width="980" height="180" aria-label="Mini runner game"></canvas>
                <span class="admin-subtle-status admin-game-highscore" id="admin-game-highscore"></span>
              </div>
              <div class="entry-actions">
                <button class="action primary" id="admin-game-start" type="button">Start</button>
                <span class="admin-subtle-status" id="admin-game-status"></span>
              </div>
            </div>
          </div>
          </div>
          </div>
          ${statusText ? `<p class="${statusClass}">${escapeHtml(statusText)}</p>` : ""}
        </section>
        ${renderFrontFooter()}
        ${renderBugReportModal()}
        ${renderAnnouncementModal()}
      </main>
      </div>
    `;
  }

  function renderNavlogScreen() {
    const h = state.navlog.header;
    const settingsPanel = renderSettingsPanel();
    return `
      <div class="ui-scale">
      <main class="page">
        <section class="topbar centered">
          <div class="top-side"><button class="back-link" id="back-to-setup">Route setup</button></div>
          <div class="top-center">
            <h1>Navlog</h1>
            <div class="utc-pill" id="utc-clock">UTC ${formatUtcNow()}</div>
          </div>
          <div class="top-side right">
            <button class="action" id="open-settings">Settings</button>
            <button class="action" id="new-sheet">New</button>
            <button class="action primary" id="save-sheet">Save</button>
          </div>
        </section>

        ${settingsPanel}

        <section class="sheet-wrap">
          <div class="sheet">
            <section class="sheet-header">
              ${renderHeaderInputBox("AIRCRAFT", `<input data-header="aircraft" value="${escapeAttr(h.aircraft)}" />`, "aircraft-box")}
              <div class="header-box dark static planning-box">PREFLIGHT PLANNER</div>
              ${renderHeaderInputBox("RP-C NO.", `<input data-header="rpCNo" value="${escapeAttr(h.rpCNo)}" />`, "rpc-box")}
               ${renderHeaderInputBox("DATE", renderDateHeaderControl(h.date), "date-box")}
              ${renderHeaderInputBox("GPH/PPH", `<input data-header="gphPph" value="${escapeAttr(h.gphPph)}" />`, "gph-box")}
              <div class="header-box static navlog-box">NAVIGATION LOG</div>
              ${renderHeaderInputBox("UTC TIME", `<input data-header="timeUtc" value="${escapeAttr(h.timeUtc)}" />`, "utc-box")}
            </section>

            ${renderRouteTable()}
            ${renderTocTod()}
            ${renderLocationTable()}
            ${renderAtisSection()}
          </div>
        </section>
        ${renderFrontFooter()}
        ${renderBugReportModal()}
        ${renderAnnouncementModal()}
      </main>
      </div>
    `;
  }

  function renderHeaderInputBox(label, controlMarkup, extraClass) {
    return `
      <label class="header-box ${extraClass || ""}">
        <span class="header-box-label">${label}</span>
        <span class="header-box-input">${controlMarkup}</span>
      </label>
    `;
  }

  function renderRouteTable() {
    const variationDeviationEnabled = Boolean(state.settings.variationDeviationEnabled);
    const speedUnitLabel =
      state.settings.speedUnit === "mph"
        ? "MPH"
        : state.settings.speedUnit === "kmh"
          ? "KM/H"
          : state.settings.speedUnit === "ms"
            ? "M/S"
            : "KTS";
    const distanceUnitLabel =
      state.settings.distanceUnit === "km"
        ? "KM"
        : state.settings.distanceUnit === "sm"
          ? "SM"
          : "NM";
    const altUnitLabel = state.settings.altitudeUnit === "m" ? "M" : "FT";
    const tempUnitLabel =
      state.settings.temperatureUnit === "f"
        ? "F"
        : state.settings.temperatureUnit === "k"
          ? "K"
          : "C";
    const headClass = variationDeviationEnabled ? "nav-head-grid nav-head-grid-vd" : "nav-head-grid";
    const tableHead = variationDeviationEnabled
      ? `
        <div class="${headClass}">
          <div class="head-cell tall route-head">ROUTE <button class="mini-plus inline" id="add-leg" type="button">+</button></div>
          <div class="head-cell group cruise-head">CRUISE</div>
          <div class="head-cell group wind-head">WIND</div>
          <div class="head-cell sub split-top tcv-head">TC</div>
          <div class="head-cell sub split-top thv-head">TH</div>
          <div class="head-cell sub split-top mhv-head">MH</div>
          <div class="head-cell tall ta-head-vd">TA (${speedUnitLabel})</div>
          <div class="head-cell tall gs-head-vd">GS (${speedUnitLabel})</div>
          <div class="head-cell tall dis-head-vd">DIS (${distanceUnitLabel})</div>
          <div class="head-cell tall ee-head-vd">EE</div>
          <div class="head-cell tall et-head-vd"><span class="time-head"><span>ET</span><small>(HHMM)</small></span></div>
          <div class="head-cell tall at-head-vd"><span class="time-head"><span>AT</span><small>(HHMM)</small></span></div>
          <div class="head-cell sub cas-head">CAS (${speedUnitLabel})</div>
          <div class="head-cell sub alt-head">ALT (${altUnitLabel})</div>
          <div class="head-cell sub temp-head">TEMP (${tempUnitLabel})</div>
          <div class="head-cell sub dir-head">DIR</div>
          <div class="head-cell sub spd-head">SPD (${speedUnitLabel})</div>
          <div class="head-cell sub wcav-head">WCA</div>
          <div class="head-cell sub varv-head">VAR</div>
          <div class="head-cell sub devv-head">DEV</div>
        </div>
      `
      : `
        <div class="${headClass}">
          <div class="head-cell tall route-head">ROUTE <button class="mini-plus inline" id="add-leg" type="button">+</button></div>
          <div class="head-cell group cruise-head">CRUISE</div>
          <div class="head-cell group wind-head">WIND</div>
          <div class="head-cell tall tc-head">TC</div>
          <div class="head-cell tall wca-head">WCA</div>
          <div class="head-cell tall ta-head">TA (${speedUnitLabel})</div>
          <div class="head-cell tall gs-head">GS (${speedUnitLabel})</div>
          <div class="head-cell tall dis-head">DIS (${distanceUnitLabel})</div>
          <div class="head-cell tall ee-head">EE</div>
          <div class="head-cell tall et-head"><span class="time-head"><span>ET</span><small>(HHMM)</small></span></div>
          <div class="head-cell tall at-head"><span class="time-head"><span>AT</span><small>(HHMM)</small></span></div>
          <div class="head-cell sub cas-head">CAS (${speedUnitLabel})</div>
          <div class="head-cell sub alt-head">ALT (${altUnitLabel})</div>
          <div class="head-cell sub temp-head">TEMP (${tempUnitLabel})</div>
          <div class="head-cell sub dir-head">DIR</div>
          <div class="head-cell sub spd-head">SPD (${speedUnitLabel})</div>
        </div>
      `;
    return `
      <section class="nav-table">
        ${tableHead}
        <div class="table-body">
          ${state.navlog.legs.map((leg, index) => renderLegRow(leg, index, variationDeviationEnabled)).join("")}
        </div>
      </section>
    `;
  }

  function legFieldClass(leg, field, extraClasses = "") {
    const classes = ["field"];
    if (extraClasses) classes.push(...extraClasses.split(" "));
    if (leg._derived && leg._derived[field]) classes.push("derived");
    if (leg._errors && leg._errors[field]) classes.push("error");
    return classes.join(" ");
  }

  function legFieldValue(leg, field) {
    if (leg._errors && leg._errors[field] && !(leg._manual && leg._manual[field])) {
      return "";
    }
    return leg[field];
  }

  function getDistanceToGoDisplay(index) {
    if (!state.settings.showDistanceToGo) return "";
    if (!Array.isArray(state.navlog.legs) || index < 0 || index >= state.navlog.legs.length) return "";
    // DTG sequence:
    // Row 1: total of all leg distances (rows after the first route row).
    // Row N: previous DTG minus the distance on that row.
    const firstLegIndex = 1;
    if (state.navlog.legs.length <= firstLegIndex) return "";

    let totalDistance = 0;
    let hasDistance = false;
    for (let legIndex = firstLegIndex; legIndex < state.navlog.legs.length; legIndex += 1) {
      const parsedDistance = parseDistanceInput(state.navlog.legs[legIndex]?.distance);
      if (parsedDistance == null || !Number.isFinite(parsedDistance)) continue;
      totalDistance += Math.max(0, parsedDistance);
      hasDistance = true;
    }
    if (!hasDistance) return "";
    if (index === 0) return formatDistanceDisplay(totalDistance);

    let distanceToGo = totalDistance;
    for (let legIndex = firstLegIndex; legIndex <= index && legIndex < state.navlog.legs.length; legIndex += 1) {
      const parsedDistance = parseDistanceInput(state.navlog.legs[legIndex]?.distance);
      if (parsedDistance == null || !Number.isFinite(parsedDistance)) continue;
      distanceToGo -= Math.max(0, parsedDistance);
    }
    return formatDistanceDisplay(Math.max(0, distanceToGo));
  }

  function renderLegRow(leg, index, variationDeviationEnabled = false) {
    const removable = index > 0 && index < state.navlog.legs.length - 1;
    const altExtra = index === 0 ? "first-alt" : "";
    const distanceToGo = getDistanceToGoDisplay(index);
    const isFirstRoute = index === 0;
    const isLastRoute = index === state.navlog.legs.length - 1;
    const routeCellExtra = isFirstRoute ? "first-route-hint" : (isLastRoute ? "last-route-hint" : "");
    const rowClass = variationDeviationEnabled ? "leg-row leg-row-vd" : "leg-row";
    const lateralCells = variationDeviationEnabled
      ? `
        <div class="${legFieldClass(leg, "tc", "stack-field")}">
          <input data-leg-field="${index}:tc" value="${escapeAttr(legFieldValue(leg, "tc"))}" />
          <input data-leg-field="${index}:wca" value="${escapeAttr(legFieldValue(leg, "wca"))}" />
        </div>
        <div class="${legFieldClass(leg, "th", "stack-field")}">
          <input data-leg-field="${index}:th" value="${escapeAttr(legFieldValue(leg, "th"))}" />
          <input data-leg-field="${index}:var" value="${escapeAttr(legFieldValue(leg, "var"))}" />
        </div>
        <div class="${legFieldClass(leg, "mh", "stack-field")}">
          <input data-leg-field="${index}:mh" value="${escapeAttr(legFieldValue(leg, "mh"))}" />
          <input data-leg-field="${index}:dev" value="${escapeAttr(legFieldValue(leg, "dev"))}" />
        </div>
      `
      : `
        <div class="${legFieldClass(leg, "tc")}"><input data-leg-field="${index}:tc" value="${escapeAttr(legFieldValue(leg, "tc"))}" /></div>
        <div class="${legFieldClass(leg, "wca")}"><input data-leg-field="${index}:wca" value="${escapeAttr(legFieldValue(leg, "wca"))}" /></div>
      `;
    return `
      <div class="${rowClass}">
        <div class="${legFieldClass(leg, "route", `route route-cell ${routeCellExtra}`.trim())}">
          <div class="route-main">
            <input data-leg-field="${index}:route" value="${escapeAttr(leg.route)}" />
            ${removable ? `<button type="button" class="remove-chip" data-remove-leg="${index}">-</button>` : `<span class="blank-chip"></span>`}
            ${
              isFirstRoute
                ? '<span class="route-inline-hint route-inline-hint-dep" aria-hidden="true">departure<br>airport</span>'
                : isLastRoute
                  ? '<span class="route-inline-hint route-inline-hint-dest" aria-hidden="true">destination<br>airport</span>'
                  : ""
            }
          </div>
          ${state.settings.showDistanceToGo ? `<span class="route-dtg">${distanceToGo ? `(${escapeAttr(distanceToGo)})` : ""}</span>` : ""}
        </div>
        <div class="${legFieldClass(leg, "cas")}"><input data-leg-field="${index}:cas" value="${escapeAttr(legFieldValue(leg, "cas"))}" /></div>
        <div class="${legFieldClass(leg, "alt", altExtra)}">
          <input data-leg-field="${index}:alt" value="${escapeAttr(legFieldValue(leg, "alt"))}" />
          ${
            index === 0
              ? '<span class="alt-departure-hint" aria-hidden="true"><span>enter departure</span><span>elevation</span></span><span class="alt-info-wrap" aria-hidden="true"><span class="alt-info-badge">i</span><span class="alt-info-text">Differential (DEP elevation, WPT 1 ALT) is used for TOC calculation. Default=0</span></span>'
              : ""
          }
        </div>
        <div class="${legFieldClass(leg, "temp")}"><input data-leg-field="${index}:temp" value="${escapeAttr(legFieldValue(leg, "temp"))}" /></div>
        <div class="${legFieldClass(leg, "windDir")}"><input data-leg-field="${index}:windDir" value="${escapeAttr(legFieldValue(leg, "windDir"))}" /></div>
        <div class="${legFieldClass(leg, "windSpd")}"><input data-leg-field="${index}:windSpd" value="${escapeAttr(legFieldValue(leg, "windSpd"))}" /></div>
        ${lateralCells}
        <div class="${legFieldClass(leg, "ta")}"><input data-leg-field="${index}:ta" value="${escapeAttr(legFieldValue(leg, "ta"))}" /></div>
        <div class="${legFieldClass(leg, "gs")}"><input data-leg-field="${index}:gs" value="${escapeAttr(legFieldValue(leg, "gs"))}" /></div>
        <div class="${legFieldClass(leg, "distance")}"><input data-leg-field="${index}:distance" value="${escapeAttr(legFieldValue(leg, "distance"))}" /></div>
        <div class="${legFieldClass(leg, "ee")}"><input data-leg-field="${index}:ee" value="${escapeAttr(legFieldValue(leg, "ee"))}" /></div>
        <div class="${legFieldClass(leg, "et")}"><input data-leg-field="${index}:et" value="${escapeAttr(legFieldValue(leg, "et"))}" /></div>
        <div class="${legFieldClass(leg, "at")}"><input data-leg-field="${index}:at" value="${escapeAttr(legFieldValue(leg, "at"))}" ${index === 0 ? 'placeholder="AB TIME"' : ""} /></div>
      </div>
    `;
  }

  function renderSettingsPanel() {
    const s = state.settings;
    const classes = `settings-panel${s.open ? " open" : ""}`;
    return `
      <section class="${classes}">
        <div class="settings-head">
          <div class="settings-title-wrap">
            <h3>Settings</h3>
          </div>
          <button type="button" class="action" id="close-settings">Close</button>
        </div>
        <div class="settings-group">
          <h4>Units</h4>
          <div class="settings-grid">
            <label class="settings-item">
              <span>Altitude</span>
              <select id="setting-altitude-unit">
                <option value="ft" ${s.altitudeUnit === "ft" ? "selected" : ""}>feet (ft)</option>
                <option value="m" ${s.altitudeUnit === "m" ? "selected" : ""}>meters (m)</option>
              </select>
            </label>
            <label class="settings-item">
              <span>Speed</span>
              <select id="setting-speed-unit">
                <option value="kts" ${s.speedUnit === "kts" ? "selected" : ""}>knots (kts)</option>
                <option value="mph" ${s.speedUnit === "mph" ? "selected" : ""}>miles/hour (mph)</option>
                <option value="kmh" ${s.speedUnit === "kmh" ? "selected" : ""}>kilometers/hour (km/h)</option>
                <option value="ms" ${s.speedUnit === "ms" ? "selected" : ""}>meters/second (m/s)</option>
              </select>
            </label>
            <label class="settings-item">
              <span>Distance</span>
              <select id="setting-distance-unit">
                <option value="nm" ${s.distanceUnit === "nm" ? "selected" : ""}>nautical miles (NM)</option>
                <option value="km" ${s.distanceUnit === "km" ? "selected" : ""}>kilometers (KM)</option>
                <option value="sm" ${s.distanceUnit === "sm" ? "selected" : ""}>statute miles (SM)</option>
              </select>
            </label>
            <label class="settings-item">
              <span>Temperature</span>
              <select id="setting-temperature-unit">
                <option value="c" ${s.temperatureUnit === "c" ? "selected" : ""}>celsius (C)</option>
                <option value="f" ${s.temperatureUnit === "f" ? "selected" : ""}>fahrenheit (F)</option>
                <option value="k" ${s.temperatureUnit === "k" ? "selected" : ""}>kelvin (K)</option>
              </select>
            </label>
          </div>
        </div>
        <div class="settings-group">
          <h4>Rounding Toggle</h4>
          <div class="settings-grid settings-grid-rounding">
            <label class="settings-item settings-item-check">
              <input type="checkbox" id="setting-round-time" ${s.roundTimeValues ? "checked" : ""} />
              <span>Time (EE and TOC/TOD)</span>
            </label>
            <label class="settings-item settings-item-check">
              <input type="checkbox" id="setting-round-distance" ${s.roundDistanceValues ? "checked" : ""} />
              <span>Distance (DIS and TOC/TOD)</span>
            </label>
          </div>
        </div>
        <div class="settings-group">
          <h4>Features</h4>
          <div class="settings-grid settings-grid-rounding">
            <label class="settings-item settings-item-check">
              <input type="checkbox" id="setting-distance-to-go" ${s.showDistanceToGo ? "checked" : ""} />
              <span>Show distance-to-go under route waypoints</span>
            </label>
            <label class="settings-item settings-item-check">
              <input type="checkbox" id="setting-variation-deviation" ${s.variationDeviationEnabled ? "checked" : ""} />
              <span>Variation/Deviation</span>
            </label>
          </div>
        </div>
        <div class="settings-group">
          <h4>PDF Export</h4>
          <div class="settings-pdf-options">
            <label class="settings-radio">
              <input type="radio" name="setting-pdf-layout" value="default" ${s.pdfLayout === "default" ? "checked" : ""} />
              <span>Default</span>
            </label>
            <label class="settings-radio">
              <input type="radio" name="setting-pdf-layout" value="printable" ${s.pdfLayout === "printable" ? "checked" : ""} />
              <span>Printable</span>
              <span class="settings-info-wrap" aria-hidden="true">
                <span class="settings-info-badge">i</span>
                <span class="settings-info-text">Knee board size appropriate</span>
              </span>
            </label>
          </div>
        </div>
        <div class="settings-actions">
          <button type="button" class="action" id="settings-reset-defaults">Reset Defaults</button>
        </div>
      </section>
    `;
  }

  function renderTocTod() {
    const t = state.navlog.tocTod;
    return `
      <section class="toc-tod">
        <div class="toc-tod-card ${!t.tocEditing ? "resolved" : ""}">
          <button type="button" class="toc-tod-title" data-edit-toc="toc">TOC</button>
          ${
            t.tocEditing
              ? `<input class="toc-entry" data-toc-entry="roc" value="${escapeAttr(t.roc)}" placeholder="Enter ROC" />`
              : `
                <input data-toc="tocDistance" value="${escapeAttr(t.tocDistance)}" placeholder="Distance" readonly />
                <input data-toc="tocTime" value="${escapeAttr(t.tocTime)}" placeholder="Time" readonly />
              `
          }
        </div>
        <div class="toc-tod-card ${!t.todEditing ? "resolved" : ""}">
          <button type="button" class="toc-tod-title" data-edit-toc="tod">TOD</button>
          ${
            t.todEditing
              ? `<input class="toc-entry" data-toc-entry="rod" value="${escapeAttr(t.rod)}" placeholder="Enter ROD" />`
              : `
                <input data-toc="todDistance" value="${escapeAttr(t.todDistance)}" placeholder="Distance" readonly />
                <input data-toc="todTime" value="${escapeAttr(t.todTime)}" placeholder="Time" readonly />
              `
          }
        </div>
      </section>
    `;
  }

  function renderLocationTable() {
    return `
      <section class="radio-block">
        <div class="radio-head">
          <div>LOCATION <button class="mini-plus inline" id="add-radio-row" type="button">+</button></div>
          <div>CPT*/ATIS</div>
          <div>DEP**/AAP</div>
          <div>TWR</div>
          <div>GND</div>
          <div>FSS</div>
          <div>REMARKS</div>
        </div>
        <div class="radio-body">
          ${state.navlog.radios.map((row, index) => renderRadioRow(row, index)).join("")}
        </div>
      </section>
    `;
  }

  function renderRadioRow(row, index) {
    return `
      <div class="radio-row">
        <div class="location-cell">
          <input data-radio-field="${index}:location" value="${escapeAttr(row.location)}" />
          ${index > 0 ? `<button type="button" class="remove-chip" data-remove-radio="${index}">-</button>` : `<span class="blank-chip"></span>`}
        </div>
        <div><input data-radio-field="${index}:cptAtis" value="${escapeAttr(row.cptAtis)}" /></div>
        <div><input data-radio-field="${index}:depAap" value="${escapeAttr(row.depAap)}" /></div>
        <div><input data-radio-field="${index}:twr" value="${escapeAttr(row.twr)}" /></div>
        <div><input data-radio-field="${index}:gnd" value="${escapeAttr(row.gnd)}" /></div>
        <div><input data-radio-field="${index}:fss" value="${escapeAttr(row.fss)}" /></div>
        <div><input data-radio-field="${index}:remarks" value="${escapeAttr(row.remarks)}" /></div>
      </div>
    `;
  }

  function renderAtisSection() {
    return `
      <section class="atis-block">
        <div class="atis-cell">
          <span>DEP ATIS CODE</span>
          <input data-footer="depAtisCode" value="${escapeAttr(state.navlog.depAtisCode)}" />
        </div>
        <div class="atis-cell">
          <span>DESTIN ATIS CODE</span>
          <input data-footer="destinAtisCode" value="${escapeAttr(state.navlog.destinAtisCode)}" />
        </div>
      </section>
    `;
  }

  function wireSetup() {
    document.getElementById("setup-departure").addEventListener("input", (event) => {
      state.navlog.setup.departure = event.target.value;
      syncSetupPresetStatus();
    });
    document.getElementById("setup-destination").addEventListener("input", (event) => {
      state.navlog.setup.destination = event.target.value;
      syncSetupPresetStatus();
    });
    document.getElementById("swap-airports").addEventListener("click", () => {
      const currentDeparture = state.navlog.setup.departure;
      state.navlog.setup.departure = state.navlog.setup.destination;
      state.navlog.setup.destination = currentDeparture;
      document.getElementById("setup-departure").value = state.navlog.setup.departure;
      document.getElementById("setup-destination").value = state.navlog.setup.destination;
      syncSetupPresetStatus();
    });
    document.getElementById("open-sheet").addEventListener("click", () => {
      seedLegs();
      state.settings = createDefaultSettings();
      state.meta.hasOpenedSheet = true;
      state.view = "navlog";
      render();
    });
    const resumeButton = document.getElementById("resume-sheet");
    if (resumeButton) {
      resumeButton.addEventListener("click", () => {
        state.settings.open = false;
        state.meta.hasOpenedSheet = true;
        state.view = "navlog";
        render();
      });
    }
  }

  function wireNavlog() {
    document.getElementById("back-to-setup").addEventListener("click", () => {
      state.view = "setup";
      render();
    });
    document.getElementById("open-settings").addEventListener("click", () => {
      state.settings.open = !state.settings.open;
      render();
    });
    const closeSettingsButton = document.getElementById("close-settings");
    if (closeSettingsButton) {
      closeSettingsButton.addEventListener("click", () => {
        state.settings.open = false;
        render();
      });
    }
    document.getElementById("new-sheet").addEventListener("click", () => {
      if (!window.confirm("Clear this navlog?")) return;
      state.navlog = createBlankNavlog();
      state.settings = createDefaultSettings();
      state.meta.hasOpenedSheet = false;
      state.meta.usingPresetRoute = false;
      render();
    });
    document.getElementById("save-sheet").addEventListener("click", downloadPdf);
    document.getElementById("add-leg").addEventListener("click", () => {
      const newLeg = createBlankLeg("");
      state.navlog.legs.splice(state.navlog.legs.length - 1, 0, newLeg);
      const aircraftFromRpc = getMappedAircraftFromRpc(state.navlog.header.rpCNo);
      if (aircraftFromRpc === "C152") {
        const insertedIndex = Math.max(1, state.navlog.legs.length - 2);
        setLegCasDefault(insertedIndex, "85");
      }
      render();
    });
    document.getElementById("add-radio-row").addEventListener("click", () => {
      state.navlog.radios.push(createBlankRadioRow());
      render();
    });

    document.querySelectorAll("[data-remove-leg]").forEach((button) => {
      button.addEventListener("click", () => {
        const removeIndex = Number(button.dataset.removeLeg);
        const shouldResetSuccessorTc = state.meta.usingPresetRoute;
        state.navlog.legs.splice(removeIndex, 1);
        if (shouldResetSuccessorTc && state.navlog.legs[removeIndex]) {
          const successorLeg = state.navlog.legs[removeIndex];
          successorLeg.tc = "";
          successorLeg._manual = successorLeg._manual || {};
          successorLeg._manual.tc = false;
          successorLeg._derived = successorLeg._derived || {};
          delete successorLeg._derived.tc;
        }
        render();
      });
    });
    document.querySelectorAll("[data-remove-radio]").forEach((button) => {
      button.addEventListener("click", () => {
        state.navlog.radios.splice(Number(button.dataset.removeRadio), 1);
        render();
      });
    });

    document.querySelectorAll("[data-header]").forEach((input) => {
      input.addEventListener("input", (event) => {
        const field = event.target.dataset.header;
        state.navlog.header[field] = field === "date" ? normalizeDisplayDate(event.target.value) : event.target.value;
        if (field === "date") {
          const dateProxy = document.querySelector("[data-date-picker]");
          if (dateProxy) dateProxy.value = normalizeDateInputValue(state.navlog.header.date);
        }
        if (field === "rpCNo") {
          const mappedAircraft = getMappedAircraftFromRpc(event.target.value);
          if (mappedAircraft) {
            state.navlog.header.aircraft = mappedAircraft;
            const aircraftInput = document.querySelector('[data-header="aircraft"]');
            if (aircraftInput) aircraftInput.value = mappedAircraft;
          }
          applyDefaultCasForAircraft(mappedAircraft);
          syncAircraftFuelDefaults();
          computeRouteMath();
          updateComputedCells();
        }
        if (field === "aircraft") {
          syncAircraftFuelDefaults();
        }
      });
      input.addEventListener("change", (event) => {
        const field = event.target.dataset.header;
        state.navlog.header[field] = field === "date" ? normalizeDisplayDate(event.target.value) : event.target.value;
        if (field === "date") {
          const dateProxy = document.querySelector("[data-date-picker]");
          if (dateProxy) dateProxy.value = normalizeDateInputValue(state.navlog.header.date);
        }
        if (field === "rpCNo") {
          const mappedAircraft = getMappedAircraftFromRpc(event.target.value);
          if (mappedAircraft) {
            state.navlog.header.aircraft = mappedAircraft;
            const aircraftInput = document.querySelector('[data-header="aircraft"]');
            if (aircraftInput) aircraftInput.value = mappedAircraft;
          }
          applyDefaultCasForAircraft(mappedAircraft);
          syncAircraftFuelDefaults();
          computeRouteMath();
          updateComputedCells();
        }
        if (field === "aircraft") {
          syncAircraftFuelDefaults();
        }
      });
    });

    document.querySelectorAll("[data-leg-field]").forEach((input) => {
      input.addEventListener("input", (event) => {
        const [indexText, field] = event.target.dataset.legField.split(":");
        const index = Number(indexText);
        const leg = state.navlog.legs[index];
        let nextValue = event.target.value;
        if (field === "ee") {
          const parsedEeMinutes = parseEeInput(nextValue);
          if (parsedEeMinutes != null) {
            nextValue = formatMinutesAsHhmm(parsedEeMinutes);
            event.target.value = nextValue;
          }
        } else if (field === "at") {
          const parsedAtMinutes = parseAtInput(nextValue);
          if (parsedAtMinutes != null) {
            nextValue = formatMinutesAsHhmm(parsedAtMinutes);
            event.target.value = nextValue;
          }
        }
        if (isDegreeField(field)) {
          const parsed = num(nextValue);
          if (parsed != null) {
            nextValue = String(roundHalfUp(parsed));
            event.target.value = nextValue;
          }
        }
        leg[field] = nextValue;
        leg._manual = leg._manual || {};
        leg._manual[field] = nextValue.trim() !== "";
        computeRouteMath({ index, field });
        updateComputedCells({ index, field });
        if (index === 0 && field === "alt") syncFirstAltHint();
        if (field === "route") syncRouteHints();
      });
      input.addEventListener("focus", () => {
        syncFirstAltHint();
        syncRouteHints();
      });
      input.addEventListener("blur", () => {
        syncFirstAltHint();
        syncRouteHints();
      });
    });
    document.querySelectorAll(".alt-info-badge").forEach((badge) => {
      badge.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        const wrap = badge.closest(".alt-info-wrap");
        if (!wrap) return;
        const shouldOpen = !wrap.classList.contains("alt-info-open");
        document.querySelectorAll(".alt-info-wrap.alt-info-open").forEach((node) => node.classList.remove("alt-info-open"));
        if (shouldOpen) wrap.classList.add("alt-info-open");
      });
    });
    if (!document.body.dataset.altInfoCloseBound) {
      document.body.dataset.altInfoCloseBound = "1";
      document.addEventListener("click", (event) => {
        const target = event.target;
        if (target && target.closest && target.closest(".alt-info-wrap")) return;
        document.querySelectorAll(".alt-info-wrap.alt-info-open").forEach((node) => node.classList.remove("alt-info-open"));
      });
    }
    const datePickerInput = document.querySelector("[data-date-picker]");
    if (datePickerInput) {
      const dateDisplayInput = document.querySelector('[data-header="date"]');
      if (dateDisplayInput) {
        const openDatePicker = () => {
          if (typeof datePickerInput.showPicker === "function") datePickerInput.showPicker();
          else datePickerInput.click();
        };
        dateDisplayInput.addEventListener("click", openDatePicker);
        dateDisplayInput.addEventListener("focus", openDatePicker);
      }
      datePickerInput.addEventListener("change", (event) => {
        const picked = formatDateToDisplay(event.target.value);
        state.navlog.header.date = picked;
        const dateInput = document.querySelector('[data-header="date"]');
        if (dateInput) dateInput.value = picked;
      });
    }

    document.querySelectorAll("[data-toc-entry]").forEach((input) => {
      input.addEventListener("input", (event) => {
        const field = event.target.dataset.tocEntry;
        state.navlog.tocTod[field] = event.target.value;
      });
      input.addEventListener("keydown", (event) => {
        if (event.key !== "Enter") return;
        event.preventDefault();
        const field = event.target.dataset.tocEntry;
        const value = event.target.value.trim();
        state.navlog.tocTod[field] = value;
        if (field === "roc") state.navlog.tocTod.tocEditing = false;
        if (field === "rod") state.navlog.tocTod.todEditing = false;
        computeRouteMath();
        render();
      });
    });

    document.querySelectorAll("[data-edit-toc]").forEach((button) => {
      button.addEventListener("click", () => {
        if (button.dataset.editToc === "toc") state.navlog.tocTod.tocEditing = true;
        if (button.dataset.editToc === "tod") state.navlog.tocTod.todEditing = true;
        render();
      });
    });

    document.querySelectorAll("[data-radio-field]").forEach((input) => {
      input.addEventListener("input", (event) => {
        const [indexText, field] = event.target.dataset.radioField.split(":");
        const index = Number(indexText);
        state.navlog.radios[index][field] = event.target.value;
        if (field === "location" && String(event.target.value || "").trim() === "") {
          state.navlog.radios[index] = {
            ...state.navlog.radios[index],
            cptAtis: "",
            depAap: "",
            twr: "",
            gnd: "",
            fss: "",
            remarks: "",
          };
          render();
        }
      });
    });

    document.querySelectorAll("[data-radio-field$=':location']").forEach((input) => {
      input.addEventListener("keydown", (event) => {
        if (event.key !== "Enter") return;
        event.preventDefault();
        const [indexText] = event.target.dataset.radioField.split(":");
        autofillAirportRow(Number(indexText), event.target.value);
      });
    });

    document.querySelectorAll("[data-footer]").forEach((input) => {
      input.addEventListener("input", (event) => {
        state.navlog[event.target.dataset.footer] = event.target.value;
      });
    });

    const altitudeUnitSelect = document.getElementById("setting-altitude-unit");
    if (altitudeUnitSelect) {
      altitudeUnitSelect.addEventListener("change", (event) => {
        applySettingsChange({ altitudeUnit: event.target.value });
      });
    }
    const speedUnitSelect = document.getElementById("setting-speed-unit");
    if (speedUnitSelect) {
      speedUnitSelect.addEventListener("change", (event) => {
        applySettingsChange({ speedUnit: event.target.value });
      });
    }
    const distanceUnitSelect = document.getElementById("setting-distance-unit");
    if (distanceUnitSelect) {
      distanceUnitSelect.addEventListener("change", (event) => {
        applySettingsChange({ distanceUnit: event.target.value });
      });
    }
    const temperatureUnitSelect = document.getElementById("setting-temperature-unit");
    if (temperatureUnitSelect) {
      temperatureUnitSelect.addEventListener("change", (event) => {
        applySettingsChange({ temperatureUnit: event.target.value });
      });
    }
    const roundTimeToggle = document.getElementById("setting-round-time");
    if (roundTimeToggle) {
      roundTimeToggle.addEventListener("change", (event) => {
        applySettingsChange({ roundTimeValues: event.target.checked });
      });
    }
    const roundDistanceToggle = document.getElementById("setting-round-distance");
    if (roundDistanceToggle) {
      roundDistanceToggle.addEventListener("change", (event) => {
        applySettingsChange({ roundDistanceValues: event.target.checked });
      });
    }
    const distanceToGoToggle = document.getElementById("setting-distance-to-go");
    if (distanceToGoToggle) {
      distanceToGoToggle.addEventListener("change", (event) => {
        applySettingsChange({ showDistanceToGo: event.target.checked });
      });
    }
    const variationDeviationToggle = document.getElementById("setting-variation-deviation");
    if (variationDeviationToggle) {
      variationDeviationToggle.addEventListener("change", (event) => {
        applySettingsChange({ variationDeviationEnabled: event.target.checked });
      });
    }
    document.querySelectorAll('[name="setting-pdf-layout"]').forEach((input) => {
      input.addEventListener("change", (event) => {
        applySettingsChange({ pdfLayout: event.target.value });
      });
    });
    const resetDefaultsButton = document.getElementById("settings-reset-defaults");
    if (resetDefaultsButton) {
      resetDefaultsButton.addEventListener("click", () => {
        applySettingsChange({
          altitudeUnit: "ft",
          speedUnit: "kts",
          distanceUnit: "nm",
          temperatureUnit: "c",
          roundTimeValues: true,
          roundDistanceValues: true,
          showDistanceToGo: false,
          variationDeviationEnabled: false,
          pdfLayout: "default",
        });
      });
    }

    syncFirstAltHint();
    syncRouteHints();
  }

  function applySettingsChange(partial) {
    const previous = { ...state.settings };
    const next = { ...state.settings, ...partial };
    const affectsMathFormatting =
      previous.altitudeUnit !== next.altitudeUnit
      || previous.speedUnit !== next.speedUnit
      || previous.distanceUnit !== next.distanceUnit
      || previous.temperatureUnit !== next.temperatureUnit
      || previous.roundTimeValues !== next.roundTimeValues
      || previous.roundDistanceValues !== next.roundDistanceValues;
    const changed =
      affectsMathFormatting
      || previous.showDistanceToGo !== next.showDistanceToGo
      || previous.variationDeviationEnabled !== next.variationDeviationEnabled
      || previous.pdfLayout !== next.pdfLayout;
    if (!changed) return;

    if (affectsMathFormatting) {
      convertStoredValuesForSettingsChange(previous, next);
    }
    state.settings = next;
    if (affectsMathFormatting) {
      computeRouteMath();
    }
    render();
  }

  function convertStoredValuesForSettingsChange(previous, next) {
    state.navlog.legs.forEach((leg) => {
      convertLegField(leg, "alt", previous, next, parseAltitudeInputWithUnit, formatAltitudeDisplayForUnit);
      convertLegField(leg, "cas", previous, next, parseSpeedInputWithUnit, formatSpeedDisplayForUnit);
      convertLegField(leg, "temp", previous, next, parseTemperatureInputWithUnit, formatTemperatureDisplayForUnit);
      convertLegField(leg, "windSpd", previous, next, parseSpeedInputWithUnit, formatSpeedDisplayForUnit);
      convertLegField(leg, "ta", previous, next, parseSpeedInputWithUnit, formatSpeedDisplayForUnit);
      convertLegField(leg, "gs", previous, next, parseSpeedInputWithUnit, formatSpeedDisplayForUnit);
      convertLegField(leg, "distance", previous, next, parseDistanceInputWithUnit, formatDistanceDisplayWithRounding);
      convertLegField(leg, "ee", previous, next, parseEeInput, formatEeDisplayWithTimeRounding);
    });

    if (previous.altitudeUnit !== next.altitudeUnit) {
      const rocInternal = parseClimbRateInputWithUnit(state.navlog.tocTod.roc, previous.altitudeUnit);
      const rodInternal = parseClimbRateInputWithUnit(state.navlog.tocTod.rod, previous.altitudeUnit);
      state.navlog.tocTod.roc = rocInternal == null ? state.navlog.tocTod.roc : formatClimbRateDisplayForUnit(rocInternal, next.altitudeUnit);
      state.navlog.tocTod.rod = rodInternal == null ? state.navlog.tocTod.rod : formatClimbRateDisplayForUnit(rodInternal, next.altitudeUnit);
    }

    if (previous.roundTimeValues !== next.roundTimeValues) {
      const tocMinutes = parseDurationInputWithTimeRounding(state.navlog.tocTod.tocTime, previous.roundTimeValues);
      const todMinutes = parseDurationInputWithTimeRounding(state.navlog.tocTod.todTime, previous.roundTimeValues);
      if (tocMinutes != null) state.navlog.tocTod.tocTime = formatGeneralMinutesWithTimeRounding(tocMinutes, next.roundTimeValues);
      if (todMinutes != null) state.navlog.tocTod.todTime = formatGeneralMinutesWithTimeRounding(todMinutes, next.roundTimeValues);
    }

    if (previous.roundDistanceValues !== next.roundDistanceValues || previous.distanceUnit !== next.distanceUnit) {
      const tocDistance = parseDistanceInputWithRounding(state.navlog.tocTod.tocDistance, previous.roundDistanceValues, previous.distanceUnit);
      const todDistance = parseDistanceInputWithRounding(state.navlog.tocTod.todDistance, previous.roundDistanceValues, previous.distanceUnit);
      if (tocDistance != null) state.navlog.tocTod.tocDistance = formatDistanceDisplayWithRounding(tocDistance, next.roundDistanceValues, next.distanceUnit);
      if (todDistance != null) state.navlog.tocTod.todDistance = formatDistanceDisplayWithRounding(todDistance, next.roundDistanceValues, next.distanceUnit);
    }
  }

  function convertLegField(leg, field, previous, next, parseFn, formatFn) {
    const raw = String(leg[field] ?? "").trim();
    if (!raw) return;
    let parseMode = previous.speedUnit;
    let formatMode = next.speedUnit;
    if (field === "ee") {
      parseMode = previous.roundTimeValues;
      formatMode = next.roundTimeValues;
    } else if (field === "distance") {
      parseMode = previous.distanceUnit;
      formatMode = next.distanceUnit;
    } else if (field === "alt") {
      parseMode = previous.altitudeUnit;
      formatMode = next.altitudeUnit;
    } else if (field === "temp") {
      parseMode = previous.temperatureUnit;
      formatMode = next.temperatureUnit;
    }
    const internal = parseFn(raw, parseMode);
    if (internal == null) return;
    if (field === "distance") {
      leg[field] = formatFn(internal, next.roundDistanceValues, formatMode);
      return;
    }
    leg[field] = formatFn(internal, formatMode, next.roundTimeValues);
  }

  function seedLegs() {
    const departure = normalizeCode(state.navlog.setup.departure);
    const destination = normalizeCode(state.navlog.setup.destination);
    const presetLegs = getPresetLegs(departure, destination);
    state.meta.usingPresetRoute = Boolean(presetLegs);
    state.navlog.legs = presetLegs || [
      createBlankLeg(state.navlog.setup.departure),
      createBlankLeg(""),
      createBlankLeg(state.navlog.setup.destination),
    ];
    applyDefaultCasForAircraft(getMappedAircraftFromRpc(state.navlog.header.rpCNo));
  }

  function getPresetLegs(departure, destination) {
    const match = state.catalog.routePresets.find(
      (preset) => normalizeCode(preset.departure) === departure && normalizeCode(preset.destination) === destination,
    );
    if (!match || !Array.isArray(match.legs) || match.legs.length === 0) return null;
    return match.legs.map((leg) => createPresetLeg(leg));
  }

  function getPresetStatusMarkup() {
    const departure = normalizeCode(state.navlog.setup.departure);
    const destination = normalizeCode(state.navlog.setup.destination);
    if (!departure || !destination) return "";
    const hasPreset = Boolean(getPresetLegs(departure, destination));
    return `<div class="preset-status ${hasPreset ? "available" : "missing"}">${hasPreset ? "preset avbl" : "preset not avbl"}</div>`;
  }

  function createPresetLeg(fields) {
    const leg = createBlankLeg(fields.route || "");
    leg._manual = leg._manual || {};
    leg._derived = {};
    leg._errors = {};
    Object.entries(fields).forEach(([field, value]) => {
      if (field === "cas") return;
      leg[field] = String(value);
      leg._manual[field] = true;
    });
    return leg;
  }

  function autofillAirportRow(index, rawValue) {
    const code = String(rawValue || "").trim().toUpperCase();
    const airport = state.catalog.airports.find((item) => item.code === code || item.id === code);
    if (!airport) {
      if (!code) {
        state.navlog.radios[index] = {
          ...state.navlog.radios[index],
          location: "",
          cptAtis: "",
          depAap: "",
          twr: "",
          gnd: "",
          fss: "",
          remarks: "",
        };
        render();
      }
      return;
    }
    state.navlog.radios[index] = {
      ...state.navlog.radios[index],
      location: airport.code,
      cptAtis: airport.cptAtis,
      depAap: airport.depAap,
      twr: airport.twr,
      gnd: airport.gnd,
      fss: airport.fss,
      remarks: airport.remarks,
    };
    render();
  }

  function computeRouteMath(activeEdit) {
    state.navlog.legs = state.navlog.legs.map((leg, index) => solveLeg(leg, activeEdit && activeEdit.index === index ? activeEdit.field : null));
    computeEtAtTimeline();
    computeTocTod();
  }

  function solveLeg(leg, lockedField) {
    const manual = leg._manual || {};
    const values = {
      cas: manual.cas ? parseSpeedInput(leg.cas) : null,
      alt: manual.alt ? parseAltitudeInput(leg.alt) : null,
      temp: manual.temp ? parseTemperatureInput(leg.temp) : null,
      windDir: manual.windDir ? num(leg.windDir) : null,
      windSpd: manual.windSpd ? parseSpeedInput(leg.windSpd) : null,
      tc: manual.tc ? num(leg.tc) : null,
      wca: manual.wca ? num(leg.wca) : null,
      th: manual.th ? num(leg.th) : null,
      var: manual.var ? num(leg.var) : null,
      mh: manual.mh ? num(leg.mh) : null,
      dev: manual.dev ? num(leg.dev) : null,
      ta: manual.ta ? parseSpeedInput(leg.ta) : null,
      gs: manual.gs ? parseSpeedInput(leg.gs) : null,
      distance: manual.distance ? parseDistanceInput(leg.distance) : null,
      ee: manual.ee ? parseEeInput(leg.ee) : null,
    };
    const derived = {};
    const errors = {};
    const canDerive = (field) => !manual[field] && lockedField !== field;
    const assignDerived = (field, nextValue) => {
      if (!canDerive(field)) return;
      if (values[field] != null && values[field] !== "") return;
      if (nextValue == null || !Number.isFinite(nextValue)) return;
      values[field] = nextValue;
      derived[field] = true;
    };

    for (let pass = 0; pass < 8; pass += 1) {
      const factorFromAltTemp = tasFactor(values.temp, values.alt);
      if (factorFromAltTemp != null && factorFromAltTemp !== 0) {
        if (values.ta != null) assignDerived("cas", values.ta / factorFromAltTemp);
        if (values.cas != null) assignDerived("ta", values.cas * factorFromAltTemp);
      }

      if (values.cas != null && values.ta != null && values.cas !== 0) {
        const factorFromSpeeds = values.ta / values.cas;
        if (factorFromSpeeds > 0) {
          if (values.alt != null) {
            assignDerived("temp", tempFromTasFactor(factorFromSpeeds, values.alt));
          }
          if (values.temp != null) {
            assignDerived("alt", altitudeFromTasFactor(factorFromSpeeds, values.temp, values.alt));
          }
        }
      }

      const relative = values.windDir != null && values.tc != null ? normalizeSignedAngle(values.windDir - values.tc) : null;
      const relativeRad = relative != null ? toRadians(relative) : null;
      const wcaRad = values.wca != null ? toRadians(values.wca) : null;
      const sinRel = relativeRad == null ? null : Math.sin(relativeRad);
      const cosRel = relativeRad == null ? null : Math.cos(relativeRad);
      const sinWca = wcaRad == null ? null : Math.sin(wcaRad);
      const cosWca = wcaRad == null ? null : Math.cos(wcaRad);

      if (canDerive("wca") && values.ta != null && values.ta > TRIG_TOLERANCE && relativeRad != null && values.windSpd != null) {
        const ratio = (values.windSpd * sinRel) / values.ta;
        if (Math.abs(ratio) > 1) {
          errors.wca = "Wind too strong";
        } else {
          assignDerived("wca", toDegrees(Math.asin(clamp(ratio, -1, 1))));
          delete errors.wca;
        }
      } else {
        delete errors.wca;
      }

      if (values.gs != null && values.windSpd != null && cosRel != null && cosWca != null && Math.abs(cosWca) > TRIG_TOLERANCE) {
        assignDerived("ta", (values.gs + (values.windSpd * cosRel)) / cosWca);
      }
      if (values.windSpd != null && sinRel != null && sinWca != null && Math.abs(sinWca) > TRIG_TOLERANCE) {
        assignDerived("ta", (values.windSpd * sinRel) / sinWca);
      }

      if (values.ta != null && values.wca != null && values.windSpd != null && cosRel != null && cosWca != null && Math.abs(cosWca) > TRIG_TOLERANCE) {
        const computedGs = (values.ta * cosWca) - (values.windSpd * cosRel);
        if (computedGs > TRIG_TOLERANCE) {
          assignDerived("gs", computedGs);
          delete errors.gs;
        } else if (canDerive("gs")) {
          errors.gs = "Wind too strong";
        }
      } else {
        delete errors.gs;
      }

      if (values.ta != null && values.wca != null && values.gs != null && cosRel != null && cosWca != null && Math.abs(cosRel) > TRIG_TOLERANCE) {
        assignDerived("windSpd", ((values.ta * cosWca) - values.gs) / cosRel);
      }
      if (values.ta != null && values.wca != null && sinRel != null && sinWca != null && Math.abs(sinRel) > TRIG_TOLERANCE) {
        assignDerived("windSpd", (values.ta * sinWca) / sinRel);
      }

      if (values.distance != null && values.gs != null && values.gs > TRIG_TOLERANCE) {
        assignDerived("ee", (values.distance / values.gs) * 60);
      }
      if (values.ee != null && values.ee > TRIG_TOLERANCE && values.gs != null) {
        assignDerived("distance", (values.gs * values.ee) / 60);
      }
      if (values.distance != null && values.ee != null && values.ee > TRIG_TOLERANCE) {
        assignDerived("gs", values.distance / (values.ee / 60));
      }

      if (values.tc != null && values.wca != null) assignDerived("th", normalizeAngle(values.tc + values.wca));
      if (values.th != null && values.tc != null) assignDerived("wca", normalizeSignedAngle(values.th - values.tc));
      if (values.th != null && values.wca != null) assignDerived("tc", normalizeAngle(values.th - values.wca));

      if (values.th != null && values.var != null) assignDerived("mh", normalizeAngle(values.th + values.var));
      if (values.mh != null && values.th != null) assignDerived("var", normalizeSignedAngle(values.mh - values.th));
      if (values.mh != null && values.var != null) assignDerived("th", normalizeAngle(values.mh - values.var));

    }

    if (errors.wca && canDerive("wca")) {
      values.wca = null;
      delete derived.wca;
    }

    Object.keys(derived).forEach((field) => {
      if (manual[field] || values[field] == null || !Number.isFinite(values[field])) delete derived[field];
    });

    return {
      ...leg,
      _manual: manual,
      _derived: derived,
      _errors: errors,
      cas: resolveDisplayField(leg, manual, lockedField, "cas", values.cas, formatSpeedDisplay),
      alt: resolveDisplayField(leg, manual, lockedField, "alt", values.alt, formatAltitudeDisplay),
      temp: resolveDisplayField(leg, manual, lockedField, "temp", values.temp, formatTemperatureDisplay),
      windDir: resolveDisplayField(leg, manual, lockedField, "windDir", values.windDir, maybeDegrees),
      windSpd: resolveDisplayField(leg, manual, lockedField, "windSpd", values.windSpd, formatSpeedDisplay),
      tc: resolveDisplayField(leg, manual, lockedField, "tc", values.tc, maybeHeadingDegrees),
      wca: resolveDisplayField(leg, manual, lockedField, "wca", values.wca, maybeSignedDegrees),
      th: resolveDisplayField(leg, manual, lockedField, "th", values.th, maybeHeadingDegrees),
      var: resolveDisplayField(leg, manual, lockedField, "var", values.var, maybeSignedDegrees),
      mh: resolveDisplayField(leg, manual, lockedField, "mh", values.mh, maybeHeadingDegrees),
      dev: resolveDisplayField(leg, manual, lockedField, "dev", values.dev, maybeSignedDegrees),
      ta: resolveDisplayField(leg, manual, lockedField, "ta", values.ta, formatSpeedDisplay),
      gs: resolveDisplayField(leg, manual, lockedField, "gs", values.gs, formatSpeedDisplay),
      distance: resolveDisplayField(leg, manual, lockedField, "distance", values.distance, formatDistanceDisplay),
      ee: resolveDisplayField(leg, manual, lockedField, "ee", values.ee, formatEeDisplay),
    };
  }

  function wireManual() {
    document.getElementById("back-from-manual").addEventListener("click", () => {
      if (state.meta.docBackView) {
        state.view = state.meta.docBackView;
        if (state.view === "additional-info") state.meta.additionalInfoPanel = "";
        state.meta.docBackView = "";
      } else {
        state.view = state.meta.lastNonDocView || "setup";
      }
      render();
    });
  }

  function wireFooterActions() {
    const openManualButton = document.getElementById("open-manual");
    if (openManualButton) {
      openManualButton.addEventListener("click", () => {
        if (state.view === "manual" || state.view === "privacy" || state.view === "additional-info") {
          state.meta.docBackView = state.view;
        } else {
          state.meta.lastNonDocView = state.view;
          state.meta.docBackView = "";
        }
        state.view = "manual";
        render();
      });
    }
    const openPrivacyButton = document.getElementById("open-privacy");
    if (openPrivacyButton) {
      openPrivacyButton.addEventListener("click", () => {
        if (state.view === "manual" || state.view === "privacy" || state.view === "additional-info") {
          state.meta.docBackView = state.view;
        } else {
          state.meta.lastNonDocView = state.view;
          state.meta.docBackView = "";
        }
        state.view = "privacy";
        render();
      });
    }
    const openAdditionalButton = document.getElementById("open-additional-info");
    if (openAdditionalButton) {
      openAdditionalButton.addEventListener("click", () => {
        if (state.view === "manual" || state.view === "privacy" || state.view === "additional-info") {
          state.meta.docBackView = state.view;
        } else {
          state.meta.lastNonDocView = state.view;
          state.meta.docBackView = "";
        }
        state.meta.additionalInfoPanel = "";
        state.view = "additional-info";
        render();
      });
    }
    const openBugReportButton = document.getElementById("open-bug-report");
    if (openBugReportButton) {
      openBugReportButton.addEventListener("click", () => {
        state.bugReport.open = true;
        state.bugReport.submitting = false;
        state.bugReport.status = "";
        state.bugReport.note = "";
        render();
      });
    }
  }

  function wireBugReportModal() {
    const closeBugReportButton = document.getElementById("close-bug-report");
    if (closeBugReportButton) {
      closeBugReportButton.addEventListener("click", () => {
        closeBugReport();
      });
    }

    const bugReportOverlay = document.getElementById("bug-report-overlay");
    if (bugReportOverlay) {
      bugReportOverlay.addEventListener("click", (event) => {
        if (event.target !== bugReportOverlay || state.bugReport.submitting) return;
        closeBugReport();
      });
    }

    document.removeEventListener("keydown", handleBugReportEscape);
    if (state.bugReport.open) {
      document.addEventListener("keydown", handleBugReportEscape);
      const messageInput = document.getElementById("bug-report-message");
      if (messageInput) messageInput.focus();
    }

    const bugReportForm = document.getElementById("bug-report-form");
    if (bugReportForm) {
      bugReportForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        if (state.bugReport.submitting) return;
        const messageInput = document.getElementById("bug-report-message");
        const emailInput = document.getElementById("bug-report-email");
        const message = (messageInput ? messageInput.value : "").trim();
        const reporterEmail = (emailInput ? emailInput.value : "").trim();
        if (!message) {
          state.bugReport.status = "error";
          state.bugReport.note = "Please add bug details first.";
          render();
          return;
        }
        state.bugReport.submitting = true;
        state.bugReport.status = "";
        state.bugReport.note = "";
        render();
        try {
          const response = await fetch("/api/bug-report", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              message,
              reporterEmail,
              page: state.view,
              departure: state.navlog.setup.departure || "",
              destination: state.navlog.setup.destination || "",
              userAgent: window.navigator.userAgent || "",
            }),
          });
          const payload = await response.json().catch(() => ({}));
          if (!response.ok) throw new Error(payload.error || "Could not submit bug report.");
          state.bugReport.submitting = false;
          state.bugReport.status = "ok";
          state.bugReport.note = "Thanks. Your bug report was sent.";
          render();
        } catch (error) {
          state.bugReport.submitting = false;
          state.bugReport.status = "error";
          state.bugReport.note = error && error.message ? error.message : "Could not submit bug report.";
          render();
        }
      });
    }
  }

  function wireAnnouncementModal() {
    if (!state.announcement.open) return;
    const nextButton = document.getElementById("announcement-next");
    if (nextButton) {
      nextButton.addEventListener("click", () => {
        if (state.announcement.index < state.announcement.items.length - 1) {
          state.announcement.index += 1;
          render();
          return;
        }
        dismissAnnouncements();
      });
    }
    const closeButton = document.getElementById("announcement-close");
    if (closeButton) {
      closeButton.addEventListener("click", () => {
        dismissAnnouncements();
      });
    }
    const overlay = document.getElementById("announcement-overlay");
    if (overlay) {
      overlay.addEventListener("click", (event) => {
        if (event.target !== overlay) return;
        dismissAnnouncements();
      });
    }
  }

  function dismissAnnouncements() {
    state.announcement.open = false;
    state.announcement.index = 0;
    state.announcement.items = [];
    if (state.announcement.activeSignature) writeStoredValue(ANNOUNCEMENT_SEEN_KEY, state.announcement.activeSignature);
    render();
  }

  function wirePrivacy() {
    const backButton = document.getElementById("back-from-privacy");
    if (!backButton) return;
    backButton.addEventListener("click", () => {
      if (state.meta.docBackView) {
        state.view = state.meta.docBackView;
        if (state.view === "additional-info") state.meta.additionalInfoPanel = "";
        state.meta.docBackView = "";
      } else {
        state.view = state.meta.lastNonDocView || "setup";
      }
      render();
    });
  }

  function wireAdditionalInfo() {
    const backButton = document.getElementById("back-from-additional-info");
    if (backButton) {
      backButton.addEventListener("click", () => {
        if (state.meta.additionalInfoPanel) {
          state.meta.additionalInfoPanel = "";
          render();
          return;
        }
        if (state.meta.docBackView) {
          state.view = state.meta.docBackView;
          state.meta.docBackView = "";
        } else {
          state.view = state.meta.lastNonDocView || "setup";
        }
        render();
      });
    }
    const panelButtons = Array.from(document.querySelectorAll("[data-additional-info-panel]"));
    panelButtons.forEach((button) => {
      button.addEventListener("click", () => {
        const nextPanel = String(button.getAttribute("data-additional-info-panel") || "");
        if (!nextPanel || nextPanel === state.meta.additionalInfoPanel) return;
        state.meta.additionalInfoPanel = nextPanel;
        render();
      });
    });
  }

  function wireUtcAdminTrigger() {
    document.querySelectorAll("#utc-clock").forEach((clockNode) => {
      clockNode.addEventListener("click", handleUtcAdminTap);
    });
  }

  function handleUtcAdminTap() {
    const now = Date.now();
    const timedOut =
      !state.admin.lastClickAt
      || (now - state.admin.lastClickAt) > UTC_ADMIN_CLICK_WINDOW_MS
      || (state.admin.firstClickAt && (now - state.admin.firstClickAt) > UTC_ADMIN_TOTAL_TIMEOUT_MS);
    if (timedOut) {
      state.admin.clickCount = 0;
      state.admin.firstClickAt = now;
    }
    if (state.admin.clickCount === 0) state.admin.firstClickAt = now;
    state.admin.clickCount += 1;
    state.admin.lastClickAt = now;

    if (state.admin.clickCount < 3) return;
    state.admin.clickCount = 0;
    state.admin.lastClickAt = 0;
    state.admin.firstClickAt = 0;
    state.admin.error = "";
    state.admin.notice = "";
    state.meta.lastNonDocView = state.view;
    state.view = "admin-login";
    render();
  }

  function wireAdminLogin() {
    if (!state.admin.supabaseUrl) state.admin.supabaseUrl = readSupabaseConfigValue("supabaseUrl");
    if (!state.admin.supabaseAnonKey) state.admin.supabaseAnonKey = readSupabaseConfigValue("supabaseAnonKey");
    const backButton = document.getElementById("back-from-admin-login");
    if (backButton) {
      backButton.addEventListener("click", () => {
        state.view = state.meta.lastNonDocView || "setup";
        render();
      });
    }

    const rememberInput = document.getElementById("admin-login-remember");
    if (rememberInput) {
      rememberInput.addEventListener("change", () => {
        state.admin.rememberLogin = Boolean(rememberInput.checked);
      });
    }

    const submitButton = document.getElementById("admin-login-submit");
    if (submitButton) {
      submitButton.addEventListener("click", async () => {
        await signInAdmin();
      });
    }

    ["admin-login-email", "admin-login-password"].forEach((id) => {
      const field = document.getElementById(id);
      if (!field) return;
      field.addEventListener("keydown", async (event) => {
        if (event.key !== "Enter") return;
        event.preventDefault();
        await signInAdmin();
      });
    });
  }

  function wireAdminPanel() {
    if (!state.admin.session) {
      state.view = "admin-login";
      render();
      return;
    }
    const backButton = document.getElementById("back-from-admin");
    if (backButton) {
      backButton.addEventListener("click", () => {
        state.view = "setup";
        render();
      });
    }
    const signOutButton = document.getElementById("admin-sign-out");
    if (signOutButton) {
      signOutButton.addEventListener("click", async () => {
        await signOutAdmin();
      });
    }
    const adminPanelButtons = Array.from(document.querySelectorAll("[data-admin-panel]"));
    adminPanelButtons.forEach((button) => {
      button.addEventListener("click", () => {
        const nextPanel = String(button.getAttribute("data-admin-panel") || "");
        if (!nextPanel || nextPanel === state.admin.panel) return;
        state.admin.panel = nextPanel;
        if (nextPanel === "additional-info") state.admin.additionalInfoPanel = "";
        render();
      });
    });
    if (state.admin.panel === "dashboard") initAdminMiniGame();
    else stopAdminMiniGame();

    ["admin-preset-departure", "admin-preset-destination"].forEach((id) => {
      const field = document.getElementById(id);
      if (!field) return;
      const onPresetPairChange = () => {
        readPresetFormFromInputs();
        loadPresetByPair();
        render();
      };
      field.addEventListener("change", onPresetPairChange);
    });

    const presetRowInputs = Array.from(document.querySelectorAll("[data-admin-preset-row]"));
    presetRowInputs.forEach((node) => {
      node.addEventListener("input", () => {
        readPresetFormFromInputs();
        syncAdminPresetRemoveButtons();
      });
    });

    const presetAddRowButton = document.getElementById("admin-preset-add-row");
    if (presetAddRowButton) {
      presetAddRowButton.addEventListener("click", () => {
        readPresetFormFromInputs();
        state.admin.presetForm.rows.push(createEmptyPresetRow());
        render();
      });
    }

    const presetRemoveButtons = Array.from(document.querySelectorAll("[data-admin-preset-remove]"));
    presetRemoveButtons.forEach((button) => {
      button.addEventListener("click", () => {
        readPresetFormFromInputs();
        const rawIndex = String(button.getAttribute("data-admin-preset-remove") || "");
        const index = Number(rawIndex);
        if (!Number.isFinite(index) || index < 0 || index >= state.admin.presetForm.rows.length) return;
        if (state.admin.presetForm.rows.length === 1) {
          state.admin.presetForm.rows = [createEmptyPresetRow()];
        } else {
          state.admin.presetForm.rows.splice(index, 1);
        }
        render();
      });
    });
    syncAdminPresetRemoveButtons();

    const presetSaveButton = document.getElementById("admin-preset-save");
    if (presetSaveButton) {
      presetSaveButton.addEventListener("click", async () => {
        readPresetFormFromInputs();
        await savePresetFromAdmin();
      });
    }
    const presetDeleteButton = document.getElementById("admin-preset-delete");
    if (presetDeleteButton) {
      presetDeleteButton.addEventListener("click", async () => {
        readPresetFormFromInputs();
        await deletePresetFromAdmin();
      });
    }

    const airportCodeInput = document.getElementById("admin-airport-code");
    if (airportCodeInput) {
      const onAirportCodeInput = () => {
        readAirportFormFromInputs();
        loadAirportByCode();
        render();
      };
      airportCodeInput.addEventListener("input", onAirportCodeInput);
      airportCodeInput.addEventListener("change", onAirportCodeInput);
    }

    ["admin-airport-cptAtis", "admin-airport-depAap", "admin-airport-twr", "admin-airport-gnd", "admin-airport-fss", "admin-airport-remarks"].forEach((id) => {
      const field = document.getElementById(id);
      if (!field) return;
      field.addEventListener("input", () => {
        readAirportFormFromInputs();
      });
    });

    const airportSaveButton = document.getElementById("admin-airport-save");
    if (airportSaveButton) {
      airportSaveButton.addEventListener("click", async () => {
        readAirportFormFromInputs();
        await saveAirportFromAdmin();
      });
    }
    const airportDeleteButton = document.getElementById("admin-airport-delete");
    if (airportDeleteButton) {
      airportDeleteButton.addEventListener("click", async () => {
        readAirportFormFromInputs();
        await deleteAirportFromAdmin();
      });
    }

    const manualSaveButton = document.getElementById("admin-manual-save");
    if (manualSaveButton) {
      manualSaveButton.addEventListener("click", async () => {
        const manualInput = document.getElementById("admin-manual-html");
        state.admin.manualHtmlDraft = String(manualInput ? manualInput.value : "");
        await saveContentPage("manual", resolveAdminContentHtmlForSave("manual", state.admin.manualHtmlDraft));
      });
    }
    const privacySaveButton = document.getElementById("admin-privacy-save");
    if (privacySaveButton) {
      privacySaveButton.addEventListener("click", async () => {
        const privacyInput = document.getElementById("admin-privacy-html");
        state.admin.privacyHtmlDraft = String(privacyInput ? privacyInput.value : "");
        await saveContentPage("privacy", resolveAdminContentHtmlForSave("privacy", state.admin.privacyHtmlDraft));
      });
    }

    const manualInput = document.getElementById("admin-manual-html");
    if (manualInput) {
      manualInput.addEventListener("input", () => {
        state.admin.manualHtmlDraft = String(manualInput.value || "");
        state.admin.manualSaveStatus = "";
      });
    }
    const privacyInput = document.getElementById("admin-privacy-html");
    if (privacyInput) {
      privacyInput.addEventListener("input", () => {
        state.admin.privacyHtmlDraft = String(privacyInput.value || "");
        state.admin.privacySaveStatus = "";
      });
    }

    const announcementAddButton = document.getElementById("admin-announcement-add");
    if (announcementAddButton) {
      announcementAddButton.addEventListener("click", () => {
        state.admin.announcementDrafts.unshift(createEmptyAnnouncementDraft());
        render();
      });
    }
    const announcementRemoveButtons = Array.from(document.querySelectorAll("[data-admin-announcement-remove]"));
    announcementRemoveButtons.forEach((button) => {
      button.addEventListener("click", async () => {
        const rawIndex = String(button.getAttribute("data-admin-announcement-remove") || "");
        const index = Number(rawIndex);
        if (!Number.isFinite(index) || index < 0 || index >= state.admin.announcementDrafts.length) return;
        if (!window.confirm("Are you sure you want to delete this announcement?")) return;
        state.admin.announcementDrafts.splice(index, 1);
        state.admin.announcementSaveStatus = "";
        await persistAnnouncementsToDatabase(normalizeAnnouncementDrafts(state.admin.announcementDrafts, false), "Saved");
      });
    });
    const announcementToggleButtons = Array.from(document.querySelectorAll("[data-admin-announcement-toggle]"));
    announcementToggleButtons.forEach((button) => {
      button.addEventListener("click", () => {
        const rawIndex = String(button.getAttribute("data-admin-announcement-toggle") || "");
        const index = Number(rawIndex);
        if (!Number.isFinite(index) || index < 0 || index >= state.admin.announcementDrafts.length) return;
        state.admin.announcementDrafts[index].collapsed = !state.admin.announcementDrafts[index].collapsed;
        render();
      });
    });
    const announcementFields = Array.from(document.querySelectorAll("[data-admin-announcement-field]"));
    announcementFields.forEach((field) => {
      field.addEventListener("input", () => {
        readAnnouncementDraftsFromInputs();
        state.admin.announcementSaveStatus = "";
        const key = String(field.getAttribute("data-admin-announcement-field") || "");
        const [indexText, prop] = key.split(":");
        const index = Number(indexText);
        if (prop === "permanent" && Number.isFinite(index) && state.admin.announcementDrafts[index]) render();
      });
      if (String(field.getAttribute("type") || "").toLowerCase() === "checkbox") {
        field.addEventListener("change", () => {
          readAnnouncementDraftsFromInputs();
          state.admin.announcementSaveStatus = "";
          render();
        });
      }
    });
    const announcementSaveButtons = Array.from(document.querySelectorAll("[data-admin-announcement-save]"));
    announcementSaveButtons.forEach((button) => {
      button.addEventListener("click", async () => {
        readAnnouncementDraftsFromInputs();
        const rawIndex = String(button.getAttribute("data-admin-announcement-save") || "");
        const index = Number(rawIndex);
        await saveAnnouncementByIndex(index);
      });
    });
    const maintenanceToggle = document.getElementById("admin-maintenance-flag");
    if (maintenanceToggle) {
      maintenanceToggle.addEventListener("change", async () => {
        const enabled = Boolean(maintenanceToggle.checked);
        state.admin.maintenanceMode = enabled;
        state.catalog.content.maintenanceMode = enabled;
        await saveMaintenanceModeFromAdmin(enabled);
      });
    }
    const additionalPanelButtons = Array.from(document.querySelectorAll("[data-admin-additional-panel]"));
    additionalPanelButtons.forEach((button) => {
      button.addEventListener("click", () => {
        const nextPanel = String(button.getAttribute("data-admin-additional-panel") || "");
        if (!nextPanel || nextPanel === state.admin.additionalInfoPanel) return;
        state.admin.additionalInfoPanel = nextPanel;
        render();
      });
    });
    const additionalBackButton = document.getElementById("admin-additional-back");
    if (additionalBackButton) {
      additionalBackButton.addEventListener("click", () => {
        state.admin.additionalInfoPanel = "";
        render();
      });
    }
    const additionalInputs = Array.from(document.querySelectorAll("[data-admin-additional]"));
    additionalInputs.forEach((input) => {
      input.addEventListener("input", () => {
        readAdditionalInfoFromInputs();
        state.admin.additionalInfoSaveStatus = "";
      });
    });
    const additionalAddRowButton = document.getElementById("admin-additional-add-row");
    if (additionalAddRowButton) {
      additionalAddRowButton.addEventListener("click", () => {
        const currentRows = getAdditionalInfoRowCount(state.admin.additionalInfoDraft);
        state.admin.additionalInfoDraft = resizeAdditionalInfoRows(state.admin.additionalInfoDraft, currentRows + 1);
        render();
      });
    }
    const additionalRemoveRowButtons = Array.from(document.querySelectorAll("[data-admin-additional-remove-row]"));
    additionalRemoveRowButtons.forEach((button) => {
      button.addEventListener("click", () => {
        readAdditionalInfoFromInputs();
        const rawIndex = String(button.getAttribute("data-admin-additional-remove-row") || "");
        const rowIndex = Number(rawIndex);
        const rows = normalizeAdditionalInfoTable(
          state.admin.additionalInfoDraft,
          getAdditionalInfoRowCount(state.admin.additionalInfoDraft),
          getAdditionalInfoColumnCount(state.admin.additionalInfoDraft),
        );
        if (!Number.isFinite(rowIndex) || rowIndex < 0 || rowIndex >= rows.length) return;
        if (rows.length <= 1) {
          const colCount = getAdditionalInfoColumnCount(rows);
          state.admin.additionalInfoDraft = createEmptyAdditionalInfoTable(1, colCount);
          render();
          return;
        }
        rows.splice(rowIndex, 1);
        state.admin.additionalInfoDraft = rows;
        state.admin.additionalInfoSaveStatus = "";
        render();
      });
    });
    const additionalSaveButton = document.getElementById("admin-additional-save");
    if (additionalSaveButton) {
      additionalSaveButton.addEventListener("click", async () => {
        const currentRows = getAdditionalInfoRowCount(state.admin.additionalInfoDraft);
        state.admin.additionalInfoDraft = normalizeAdditionalInfoTable(
          state.admin.additionalInfoDraft,
          currentRows,
          getAdditionalInfoColumnCount(state.admin.additionalInfoDraft),
        );
        readAdditionalInfoFromInputs();
        await saveAdditionalInfoFromAdmin();
      });
    }
  }

  function initAdminMiniGame() {
    const canvas = document.getElementById("admin-mini-game");
    const startButton = document.getElementById("admin-game-start");
    const status = document.getElementById("admin-game-status");
    const highScoreNode = document.getElementById("admin-game-highscore");
    if (!canvas || !startButton || !status) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const readHighScore = () => {
      const raw = Number(readStoredValue(ADMIN_GAME_HIGH_SCORE_KEY));
      return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 0;
    };
    const writeHighScore = (score) => {
      const normalized = Math.max(0, Math.floor(score));
      writeStoredValue(ADMIN_GAME_HIGH_SCORE_KEY, String(normalized));
      if (highScoreNode) highScoreNode.textContent = `High ${normalized}`;
    };
    const setHighScoreLabel = () => {
      if (!highScoreNode) return;
      highScoreNode.textContent = `High ${readHighScore()}`;
    };

    if (!adminGameState || adminGameState.canvas !== canvas) {
      adminGameState = {
        canvas,
        ctx,
        running: false,
        score: 0,
        speed: 3.2,
        gravity: 0.42,
        jump: -8.8,
        player: { x: 56, y: 126, w: 16, h: 20, vy: 0, onGround: true },
        obstacles: [],
        spawnTick: 0,
        highScore: readHighScore(),
      };
    }

    const draw = () => {
      const game = adminGameState;
      if (!game || game.canvas !== canvas) return;
      const { ctx: drawCtx } = game;
      drawCtx.clearRect(0, 0, canvas.width, canvas.height);
      drawCtx.fillStyle = "#f4ecdd";
      drawCtx.fillRect(0, 0, canvas.width, canvas.height);
      drawCtx.strokeStyle = "rgba(46, 41, 35, 0.24)";
      drawCtx.beginPath();
      drawCtx.moveTo(0, 146);
      drawCtx.lineTo(canvas.width, 146);
      drawCtx.stroke();

      drawCtx.fillStyle = "#214c5a";
      drawCtx.fillRect(game.player.x, game.player.y, game.player.w, game.player.h);

      drawCtx.fillStyle = "#8e2e23";
      game.obstacles.forEach((o) => drawCtx.fillRect(o.x, o.y, o.w, o.h));

      drawCtx.fillStyle = "#181612";
      drawCtx.font = "12px Trebuchet MS";
      drawCtx.fillText(`Score: ${Math.floor(game.score)}`, 10, 16);
    };

    const step = () => {
      const game = adminGameState;
      if (!game || !game.running || game.canvas !== canvas) return;
      game.score += 0.14;
      game.speed = Math.min(7, 3.2 + game.score / 90);

      game.player.vy += game.gravity;
      game.player.y += game.player.vy;
      if (game.player.y >= 126) {
        game.player.y = 126;
        game.player.vy = 0;
        game.player.onGround = true;
      } else game.player.onGround = false;

      game.spawnTick -= 1;
      if (game.spawnTick <= 0) {
        const height = Math.random() > 0.62 ? 26 : 18;
        game.obstacles.push({ x: canvas.width + 4, y: 146 - height, w: 12, h: height });
        game.spawnTick = 65 + Math.floor(Math.random() * 45);
      }

      game.obstacles.forEach((o) => { o.x -= game.speed; });
      game.obstacles = game.obstacles.filter((o) => o.x + o.w > -8);

      const hit = game.obstacles.some((o) => (
        game.player.x < o.x + o.w
        && game.player.x + game.player.w > o.x
        && game.player.y < o.y + o.h
        && game.player.y + game.player.h > o.y
      ));
      if (hit) {
        game.running = false;
        const scored = Math.floor(game.score);
        if (scored > game.highScore) {
          game.highScore = scored;
          writeHighScore(scored);
        } else setHighScoreLabel();
        status.textContent = `Game over. Score ${scored}.`;
        draw();
        return;
      }
      draw();
      adminGameAnimation = requestAnimationFrame(step);
    };

    const jump = () => {
      const game = adminGameState;
      if (!game) return;
      if (!game.running) return;
      if (!game.player.onGround) return;
      game.player.vy = game.jump;
      game.player.onGround = false;
    };

    if (!canvas.dataset.bound) {
      const onKey = (event) => {
        if (event.code !== "Space") return;
        if (state.view !== "admin" || state.admin.panel !== "dashboard") return;
        event.preventDefault();
        jump();
      };
      document.addEventListener("keydown", onKey);
      canvas.dataset.bound = "1";
      canvas.dataset.keyHandler = "1";
    }

    startButton.onclick = () => {
      const game = adminGameState;
      if (!game) return;
      game.highScore = readHighScore();
      game.score = 0;
      game.speed = 3.2;
      game.player.y = 126;
      game.player.vy = 0;
      game.player.onGround = true;
      game.obstacles = [];
      game.spawnTick = 20;
      game.running = true;
      status.textContent = "Running...";
      if (adminGameAnimation) cancelAnimationFrame(adminGameAnimation);
      draw();
      adminGameAnimation = requestAnimationFrame(step);
    };

    const onTap = (event) => {
      if (state.view !== "admin" || state.admin.panel !== "dashboard") return;
      event.preventDefault();
      const game = adminGameState;
      if (!game) return;
      if (!game.running) {
        startButton.click();
        return;
      }
      jump();
    };

    if (!canvas.dataset.tapBound) {
      if (window.PointerEvent) canvas.addEventListener("pointerdown", onTap, { passive: false });
      else canvas.addEventListener("touchstart", onTap, { passive: false });
      canvas.dataset.tapBound = "1";
    }

    setHighScoreLabel();
    draw();
    if (!status.textContent) status.textContent = "Press Start";
  }

  function stopAdminMiniGame() {
    if (adminGameAnimation) {
      cancelAnimationFrame(adminGameAnimation);
      adminGameAnimation = null;
    }
    if (adminGameState) adminGameState.running = false;
  }

  async function connectSupabaseClient(forceRecreate) {
    state.admin.error = "";
    if (!state.admin.supabaseUrl || !state.admin.supabaseAnonKey) {
      state.admin.error = "Supabase URL and anon key are required.";
      return false;
    }
    if (!window.supabase || typeof window.supabase.createClient !== "function") {
      state.admin.error = "Supabase SDK did not load.";
      return false;
    }
    if (
      forceRecreate
      || !supabaseClient
      || supabaseClient.__navlogUrl !== state.admin.supabaseUrl
      || supabaseClient.__navlogAnon !== state.admin.supabaseAnonKey
    ) {
      supabaseClient = window.supabase.createClient(state.admin.supabaseUrl, state.admin.supabaseAnonKey);
      supabaseClient.__navlogUrl = state.admin.supabaseUrl;
      supabaseClient.__navlogAnon = state.admin.supabaseAnonKey;
    }
    try {
      const { data, error } = await supabaseClient.auth.getSession();
      if (error) throw error;
      state.admin.session = data ? data.session : null;
      return true;
    } catch (error) {
      state.admin.error = error && error.message ? error.message : "Could not connect to Supabase.";
      return false;
    }
  }

  async function signInAdmin() {
    const ok = await connectSupabaseClient(false);
    if (!ok) {
      render();
      return;
    }
    const emailInput = document.getElementById("admin-login-email");
    const passwordInput = document.getElementById("admin-login-password");
    const rememberInput = document.getElementById("admin-login-remember");
    const email = String(emailInput ? emailInput.value : "").trim();
    const password = String(passwordInput ? passwordInput.value : "");
    const rememberLogin = Boolean(rememberInput ? rememberInput.checked : state.admin.rememberLogin);
    state.admin.loginEmail = email;
    state.admin.loginPassword = password;
    state.admin.rememberLogin = rememberLogin;
    if (!email || !password) {
      state.admin.error = "Email and password are required.";
      render();
      return;
    }
    state.admin.loading = true;
    state.admin.error = "";
    state.admin.notice = "";
    render();
    try {
      const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
      if (error) throw error;
      state.admin.session = data ? data.session : null;
      if (rememberLogin) {
        writeStoredValue(ADMIN_REMEMBER_KEY, "1");
        writeStoredValue(ADMIN_EMAIL_KEY, email);
        writeStoredValue(ADMIN_PASSWORD_KEY, password);
      } else {
        writeStoredValue(ADMIN_REMEMBER_KEY, "");
        writeStoredValue(ADMIN_EMAIL_KEY, "");
        writeStoredValue(ADMIN_PASSWORD_KEY, "");
      }
      await loadAdminData();
      state.view = "admin";
      state.admin.panel = "dashboard";
      state.admin.notice = "";
    } catch (error) {
      state.admin.error = error && error.message ? error.message : "Admin sign-in failed.";
    } finally {
      state.admin.loading = false;
      render();
    }
  }

  async function signOutAdmin() {
    if (supabaseClient) {
      try {
        await supabaseClient.auth.signOut();
      } catch {
        // ignore
      }
    }
    state.admin.session = null;
    state.admin.selectedPresetId = "";
    state.admin.selectedAirportCode = "";
    state.admin.notice = "Signed out.";
    state.admin.error = "";
    state.view = "admin-login";
    render();
  }

  async function loadAdminData() {
    const ok = await connectSupabaseClient(false);
    if (!ok) {
      render();
      return;
    }
    state.admin.loading = true;
    state.admin.error = "";
    state.admin.notice = "";
    try {
      let [presetResult, airportResult, contentResult] = await Promise.all([
        supabaseClient.from("route_presets").select("*").order("name", { ascending: true }),
        supabaseClient.from("airports").select("*").order("code", { ascending: true }),
        supabaseClient.from("content_pages").select("*"),
      ]);
      if (presetResult.error) throw presetResult.error;
      if (airportResult.error) throw airportResult.error;
      if (contentResult.error) throw contentResult.error;

      state.admin.presets = (presetResult.data || []).map((row) => ({
        id: String(row.id),
        name: String(row.name || ""),
        departure: normalizeCode(row.departure),
        destination: normalizeCode(row.destination),
        legs: Array.isArray(row.legs_json) ? row.legs_json : [],
      }));
      state.admin.airports = (airportResult.data || []).map((row) => normalizeAirportRecord({
        id: row.id,
        code: row.code,
        cptAtis: row.cpt_atis,
        depAap: row.dep_aap,
        twr: row.twr,
        gnd: row.gnd,
        fss: row.fss,
        remarks: row.remarks,
      }));
      const contentMap = {};
      (contentResult.data || []).forEach((row) => {
        contentMap[String(row.key || "").toLowerCase()] = String(row.body_html || "");
      });
      state.catalog.routePresets = state.admin.presets.map((preset) => clonePreset(preset));
      state.catalog.airports = state.admin.airports.map((airport) => ({ ...airport }));
      state.catalog.content.manualHtml = contentMap.manual || "";
      state.catalog.content.privacyHtml = contentMap.privacy || "";
      state.catalog.content.announcements = parseAnnouncementsContent(contentMap.announcements || "");
      state.catalog.content.maintenanceMode = parseMaintenanceModeContent(contentMap.maintenance_mode || "");
      state.catalog.content.additionalInfoTable = parseAdditionalInfoContent(contentMap.additional_info || "");
      state.admin.manualHtmlDraft = contentHtmlToEditorText("manual", state.catalog.content.manualHtml);
      state.admin.privacyHtmlDraft = contentHtmlToEditorText("privacy", state.catalog.content.privacyHtml);
      state.admin.manualDraftBaselineHtml = state.catalog.content.manualHtml;
      state.admin.privacyDraftBaselineHtml = state.catalog.content.privacyHtml;
      state.admin.manualDraftBaselineText = state.admin.manualHtmlDraft;
      state.admin.privacyDraftBaselineText = state.admin.privacyHtmlDraft;
      state.admin.announcementDrafts = normalizeAnnouncementDrafts(state.catalog.content.announcements, false);
      state.admin.maintenanceMode = Boolean(state.catalog.content.maintenanceMode);
      state.admin.maintenanceSaveStatus = "";
      state.admin.additionalInfoDraft = normalizeAdditionalInfoTable(state.catalog.content.additionalInfoTable);
      evaluateAnnouncementsPrompt();

      if (state.admin.selectedPresetId) selectPresetForEditing(state.admin.selectedPresetId);
      else loadPresetByPair();

      if (state.admin.selectedAirportCode) selectAirportForEditing(state.admin.selectedAirportCode);
      else if (state.admin.airportForm.code) loadAirportByCode();

      state.admin.notice = "";
    } catch (error) {
      state.admin.error = error && error.message ? error.message : "Could not load admin data.";
    } finally {
      state.admin.loading = false;
      render();
    }
  }

  function readAdditionalInfoFromInputs() {
    const inputs = Array.from(document.querySelectorAll("[data-admin-additional]"));
    const maxRowFromInputs = inputs.reduce((max, input) => {
      const key = String(input.getAttribute("data-admin-additional") || "");
      const parts = key.split(":");
      const row = Number(parts[0]);
      return Number.isFinite(row) ? Math.max(max, row) : max;
    }, -1);
    const maxColFromInputs = inputs.reduce((max, input) => {
      const key = String(input.getAttribute("data-admin-additional") || "");
      const parts = key.split(":");
      const col = Number(parts[1]);
      return Number.isFinite(col) ? Math.max(max, col) : max;
    }, -1);
    const fallbackRows = getAdditionalInfoRowCount(state.admin.additionalInfoDraft);
    const fallbackCols = getAdditionalInfoColumnCount(state.admin.additionalInfoDraft);
    const rowCount = Math.max(1, maxRowFromInputs + 1, fallbackRows);
    const colCount = Math.max(1, maxColFromInputs + 1, fallbackCols);
    const rows = createEmptyAdditionalInfoTable(rowCount, colCount);
    inputs.forEach((input) => {
      const key = String(input.getAttribute("data-admin-additional") || "");
      const [rowText, colText] = key.split(":");
      const row = Number(rowText);
      const col = Number(colText);
      if (!Number.isFinite(row) || !Number.isFinite(col)) return;
      if (row < 0 || row >= rowCount || col < 0 || col >= colCount) return;
      rows[row][col] = String(input.value || "");
    });
    state.admin.additionalInfoDraft = rows;
  }

  function readAnnouncementDraftsFromInputs() {
    const previous = Array.isArray(state.admin.announcementDrafts) ? state.admin.announcementDrafts : [];
    const fields = Array.from(document.querySelectorAll("[data-admin-announcement-field]"));
    const byIndex = [];
    fields.forEach((field) => {
      const key = String(field.getAttribute("data-admin-announcement-field") || "");
      const [indexText, prop] = key.split(":");
      const index = Number(indexText);
      if (!Number.isFinite(index) || index < 0 || !prop) return;
      if (!byIndex[index]) byIndex[index] = createEmptyAnnouncementDraft();
      if (previous[index]) byIndex[index].collapsed = Boolean(previous[index].collapsed);
      if (prop === "permanent") {
        byIndex[index][prop] = Boolean(field.checked);
      } else {
        byIndex[index][prop] = String(field.value || "");
      }
    });
    state.admin.announcementDrafts = normalizeAnnouncementDrafts(byIndex, false);
  }

  function readPresetFormFromInputs() {
    const departureInput = document.getElementById("admin-preset-departure");
    const destinationInput = document.getElementById("admin-preset-destination");
    const rowInputs = Array.from(document.querySelectorAll("[data-admin-preset-row]"));
    const rows = [];
    rowInputs.forEach((node) => {
      const key = String(node.getAttribute("data-admin-preset-row") || "");
      const [indexText, field] = key.split(":");
      const index = Number(indexText);
      if (!Number.isFinite(index) || index < 0 || !field) return;
      if (!rows[index]) rows[index] = createEmptyPresetRow();
      rows[index][field] = String(node.value || "");
    });
    state.admin.presetForm = {
      departure: normalizeCode(departureInput ? departureInput.value : state.admin.presetForm.departure),
      destination: normalizeCode(destinationInput ? destinationInput.value : state.admin.presetForm.destination),
      rows: normalizePresetRows(rows.length ? rows : state.admin.presetForm.rows),
    };
  }

  function normalizePresetRows(rows) {
    const source = Array.isArray(rows) ? rows : [];
    const normalized = source
      .map((row) => ({
        route: String(row && row.route != null ? row.route : ""),
        tc: String(row && row.tc != null ? row.tc : ""),
        distance: String(row && row.distance != null ? row.distance : ""),
      }));
    return normalized.length ? normalized : [createEmptyPresetRow()];
  }

  function syncAdminPresetRemoveButtons() {
    const buttons = Array.from(document.querySelectorAll("[data-admin-preset-remove]"));
    buttons.forEach((button) => {
      const rawIndex = String(button.getAttribute("data-admin-preset-remove") || "");
      const index = Number(rawIndex);
      const row = Number.isFinite(index) && index >= 0 ? state.admin.presetForm.rows[index] : null;
      const hasContent = Boolean(
        row
        && (
          String(row.route || "").trim() !== ""
          || String(row.tc || "").trim() !== ""
          || String(row.distance || "").trim() !== ""
        )
      );
      button.disabled = !hasContent;
      button.classList.toggle("active", hasContent);
    });
  }

  function presetRowsFromLegs(legs) {
    if (!Array.isArray(legs) || legs.length === 0) return [createEmptyPresetRow()];
    return normalizePresetRows(
      legs.map((leg) => ({
        route: leg && leg.route != null ? leg.route : "",
        tc: leg && leg.tc != null ? leg.tc : "",
        distance: leg && leg.distance != null ? leg.distance : "",
      })),
    );
  }

  function presetLegsFromRows(rows) {
    const source = Array.isArray(rows) ? rows : [];
    const legs = [];
    source.forEach((row) => {
      const route = String(row && row.route != null ? row.route : "").trim();
      const tcRaw = String(row && row.tc != null ? row.tc : "").trim();
      const distanceRaw = String(row && row.distance != null ? row.distance : "").trim();
      if (!route && !tcRaw && !distanceRaw) return;
      const leg = {};
      if (route) leg.route = route;
      const tc = num(tcRaw);
      const distance = num(distanceRaw);
      if (tc != null) leg.tc = roundHalfUp(tc);
      if (distance != null) leg.distance = distance;
      legs.push(leg);
    });
    return legs;
  }

  function readAirportFormFromInputs() {
    const get = (id) => {
      const node = document.getElementById(id);
      return String(node ? node.value : "");
    };
    const code = get("admin-airport-code");
    state.admin.airportForm = normalizeAirportRecord({
      id: code,
      code,
      cptAtis: get("admin-airport-cptAtis"),
      depAap: get("admin-airport-depAap"),
      twr: get("admin-airport-twr"),
      gnd: get("admin-airport-gnd"),
      fss: get("admin-airport-fss"),
      remarks: get("admin-airport-remarks"),
    });
  }

  function selectPresetForEditing(presetId) {
    state.admin.selectedPresetId = String(presetId || "");
    const selected = state.admin.presets.find((preset) => preset.id === state.admin.selectedPresetId);
    if (!selected) {
      state.admin.presetForm = createEmptyPresetForm();
      return;
    }
    state.admin.presetForm = {
      departure: normalizeCode(selected.departure),
      destination: normalizeCode(selected.destination),
      rows: presetRowsFromLegs(selected.legs),
    };
  }

  function collectPresetAirportCodes() {
    const seen = new Set();
    state.admin.presets.forEach((preset) => {
      const dep = normalizeCode(preset.departure);
      const dest = normalizeCode(preset.destination);
      if (dep) seen.add(dep);
      if (dest) seen.add(dest);
    });
    return Array.from(seen).sort();
  }

  function findPresetByPair(departure, destination) {
    const dep = normalizeCode(departure);
    const dest = normalizeCode(destination);
    if (!dep || !dest) return null;
    return state.admin.presets.find((preset) => normalizeCode(preset.departure) === dep && normalizeCode(preset.destination) === dest) || null;
  }

  function loadPresetByPair() {
    const match = findPresetByPair(state.admin.presetForm.departure, state.admin.presetForm.destination);
    if (!match) {
      const hadSelection = Boolean(state.admin.selectedPresetId);
      state.admin.selectedPresetId = "";
      state.admin.presetForm.rows = hadSelection ? [createEmptyPresetRow()] : normalizePresetRows(state.admin.presetForm.rows);
      return;
    }
    selectPresetForEditing(match.id);
  }

  function getPresetLookupState() {
    const dep = normalizeCode(state.admin.presetForm.departure);
    const dest = normalizeCode(state.admin.presetForm.destination);
    if (!dep || !dest) return { active: false, exists: false, message: "" };
    const match = findPresetByPair(dep, dest);
    if (match) return { active: true, exists: true, message: `Existing preset found (${match.name || `${dep} to ${dest}`}).` };
    return { active: true, exists: false, message: "No preset found for this DEP/ARR pair. Saving will create one." };
  }

  function selectAirportForEditing(code) {
    state.admin.selectedAirportCode = normalizeCode(code);
    const selected = state.admin.airports.find((airport) => airport.code === state.admin.selectedAirportCode);
    if (!selected) {
      state.admin.airportForm = {
        ...createEmptyAirportForm(),
        code: state.admin.selectedAirportCode,
        id: state.admin.selectedAirportCode,
      };
      return;
    }
    state.admin.airportForm = normalizeAirportRecord(selected);
  }

  function loadAirportByCode() {
    const code = normalizeCode(state.admin.airportForm.code);
    if (!code) {
      state.admin.selectedAirportCode = "";
      state.admin.airportForm = createEmptyAirportForm();
      return;
    }
    selectAirportForEditing(code);
  }

  function getAirportLookupState() {
    const code = normalizeCode(state.admin.airportForm.code);
    if (!code) return { active: false, exists: false, message: "Enter airport code to check existing record." };
    const match = state.admin.airports.find((airport) => airport.code === code);
    if (match) return { active: true, exists: true, message: `Existing airport found (${match.code}).` };
    return { active: true, exists: false, message: "No airport found for this code. Saving will create one." };
  }

  async function savePresetFromAdmin() {
    const ok = await connectSupabaseClient(false);
    if (!ok) {
      render();
      return;
    }
    const rows = normalizePresetRows(state.admin.presetForm.rows);
    const parsedLegs = presetLegsFromRows(rows);
    const payload = {
      name: `${state.admin.presetForm.departure} to ${state.admin.presetForm.destination}`,
      departure: normalizeCode(state.admin.presetForm.departure),
      destination: normalizeCode(state.admin.presetForm.destination),
      legs_json: parsedLegs,
    };
    if (!payload.departure || !payload.destination) {
      state.admin.error = "Preset departure and destination are required.";
      state.admin.notice = "";
      render();
      return;
    }
    if (!parsedLegs.length) {
      state.admin.error = "Add at least one ROUTE/TC/DIS row before saving.";
      state.admin.notice = "";
      render();
      return;
    }
    state.admin.error = "";
    state.admin.notice = "";
    try {
      const existingByPair = findPresetByPair(payload.departure, payload.destination);
      const targetId = existingByPair ? existingByPair.id : state.admin.selectedPresetId;
      let result;
      if (targetId) {
        result = await supabaseClient.from("route_presets").update(payload).eq("id", targetId).select().single();
      } else {
        result = await supabaseClient.from("route_presets").insert(payload).select().single();
      }
      if (result.error) throw result.error;
      if (result.data && result.data.id) state.admin.selectedPresetId = String(result.data.id);
      state.admin.presetForm.rows = presetRowsFromLegs(parsedLegs);
      await loadAdminData();
      state.admin.notice = "Preset saved.";
      render();
    } catch (error) {
      state.admin.error = error && error.message ? error.message : "Could not save preset.";
      render();
    }
  }

  async function deletePresetFromAdmin() {
    const ok = await connectSupabaseClient(false);
    const lookup = findPresetByPair(state.admin.presetForm.departure, state.admin.presetForm.destination);
    const targetId = lookup ? lookup.id : state.admin.selectedPresetId;
    if (!ok || !targetId) {
      render();
      return;
    }
    if (!window.confirm("Delete this preset?")) return;
    state.admin.error = "";
    state.admin.notice = "";
    try {
      const { error } = await supabaseClient.from("route_presets").delete().eq("id", targetId);
      if (error) throw error;
      state.admin.selectedPresetId = "";
      state.admin.presetForm = createEmptyPresetForm();
      await loadAdminData();
      state.admin.notice = "Preset deleted.";
      render();
    } catch (error) {
      state.admin.error = error && error.message ? error.message : "Could not delete preset.";
      render();
    }
  }

  async function saveAirportFromAdmin() {
    const ok = await connectSupabaseClient(false);
    if (!ok) {
      render();
      return;
    }
    const airport = normalizeAirportRecord(state.admin.airportForm);
    if (!airport.code) {
      state.admin.error = "Airport code is required.";
      state.admin.notice = "";
      render();
      return;
    }
    const payload = {
      code: airport.code,
      id: airport.id || airport.code,
      cpt_atis: airport.cptAtis,
      dep_aap: airport.depAap,
      twr: airport.twr,
      gnd: airport.gnd,
      fss: airport.fss,
      remarks: airport.remarks,
    };
    state.admin.error = "";
    state.admin.notice = "";
    try {
      const { error } = await supabaseClient.from("airports").upsert(payload, { onConflict: "code" });
      if (error) throw error;
      state.admin.selectedAirportCode = airport.code;
      await loadAdminData();
      state.admin.notice = "Airport saved.";
      render();
    } catch (error) {
      state.admin.error = error && error.message ? error.message : "Could not save airport.";
      render();
    }
  }

  async function deleteAirportFromAdmin() {
    const ok = await connectSupabaseClient(false);
    const code = normalizeCode(state.admin.airportForm.code) || state.admin.selectedAirportCode;
    if (!ok || !code) {
      render();
      return;
    }
    if (!window.confirm("Delete this airport?")) return;
    state.admin.error = "";
    state.admin.notice = "";
    try {
      const { error } = await supabaseClient.from("airports").delete().eq("code", code);
      if (error) throw error;
      state.admin.selectedAirportCode = "";
      state.admin.airportForm = createEmptyAirportForm();
      await loadAdminData();
      state.admin.notice = "Airport deleted.";
      render();
    } catch (error) {
      state.admin.error = error && error.message ? error.message : "Could not delete airport.";
      render();
    }
  }

  function normalizeEditorText(value) {
    return String(value || "").replace(/\r\n?/g, "\n");
  }

  function normalizeAnnouncementDrafts(items, ensureOne = true) {
    const source = Array.isArray(items) ? items : [];
    const normalized = source.map((item) => {
      const startParts = extractAnnouncementParts(item && item.startAt ? item.startAt : "", item && item.startDate ? item.startDate : "", item && item.startTimeUtc ? item.startTimeUtc : "");
      const endParts = extractAnnouncementParts(item && item.endAt ? item.endAt : "", item && item.endDate ? item.endDate : "", item && item.endTimeUtc ? item.endTimeUtc : "");
      return {
        id: String(item && item.id ? item.id : createAnnouncementId()),
        heading: String(item && item.heading ? item.heading : ""),
        body: String(item && item.body ? item.body : ""),
        startDate: startParts.date,
        startTimeUtc: startParts.time,
        endDate: endParts.date,
        endTimeUtc: endParts.time,
        permanent: Boolean(item && item.permanent),
        collapsed: Boolean(item && item.collapsed),
      };
    });
    if (normalized.length) return normalized;
    return ensureOne ? [createEmptyAnnouncementDraft()] : [];
  }

  function normalizeAnnouncementDateInput(value) {
    const text = String(value || "").trim().replaceAll("-", "/");
    if (!text) return "";
    const match = text.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
    if (!match) return "";
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return "";
    if (month < 1 || month > 12 || day < 1 || day > 31) return "";
    return `${String(year).padStart(4, "0")}/${String(month).padStart(2, "0")}/${String(day).padStart(2, "0")}`;
  }

  function normalizeAnnouncementTimeInput(value) {
    const text = String(value || "").trim();
    if (!text) return "";
    const match = text.match(/^(\d{1,2}):(\d{2})$/);
    if (!match) return "";
    const hours = Number(match[1]);
    const minutes = Number(match[2]);
    if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return "";
    if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return "";
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
  }

  function parseUtcIsoToAnnouncementParts(isoText) {
    const text = String(isoText || "").trim();
    if (!text) return { date: "", time: "" };
    const dateObj = new Date(text);
    if (!Number.isFinite(dateObj.getTime())) return { date: "", time: "" };
    const year = String(dateObj.getUTCFullYear()).padStart(4, "0");
    const month = String(dateObj.getUTCMonth() + 1).padStart(2, "0");
    const day = String(dateObj.getUTCDate()).padStart(2, "0");
    const hour = String(dateObj.getUTCHours()).padStart(2, "0");
    const minute = String(dateObj.getUTCMinutes()).padStart(2, "0");
    return { date: `${year}/${month}/${day}`, time: `${hour}:${minute}` };
  }

  function extractAnnouncementParts(isoText, dateText, timeText) {
    const normalizedDate = normalizeAnnouncementDateInput(dateText);
    const normalizedTime = normalizeAnnouncementTimeInput(timeText);
    if (normalizedDate || normalizedTime) return { date: normalizedDate, time: normalizedTime };
    return parseUtcIsoToAnnouncementParts(isoText);
  }

  function announcementPartsToUtcIso(dateText, timeText) {
    const date = normalizeAnnouncementDateInput(dateText);
    const time = normalizeAnnouncementTimeInput(timeText);
    if (!date || !time) return "";
    const match = date.match(/^(\d{4})\/(\d{2})\/(\d{2})$/);
    if (!match) return "";
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const timeMatch = time.match(/^(\d{2}):(\d{2})$/);
    if (!timeMatch) return "";
    const hour = Number(timeMatch[1]);
    const minute = Number(timeMatch[2]);
    const utcMs = Date.UTC(year, month - 1, day, hour, minute, 0, 0);
    if (!Number.isFinite(utcMs)) return "";
    return new Date(utcMs).toISOString();
  }

  function formatAnnouncementDateInput(value) {
    return normalizeAnnouncementDateInput(value);
  }

  function formatAnnouncementTimeInput(value) {
    return normalizeAnnouncementTimeInput(value);
  }

  function parseAnnouncementsContent(raw) {
    const text = String(raw || "").trim();
    if (!text) return [];
    try {
      const parsed = JSON.parse(text);
      if (!Array.isArray(parsed)) return [];
      return normalizeAnnouncementDrafts(parsed, false);
    } catch {
      return [];
    }
  }

  function parseMaintenanceModeContent(raw) {
    const text = String(raw || "").trim().toLowerCase();
    return text === "1" || text === "true" || text === "yes" || text === "on";
  }

  function parseAdditionalInfoContent(raw) {
    const text = String(raw || "").trim();
    if (!text) return createEmptyAdditionalInfoTable();
    try {
      const parsed = JSON.parse(text);
      return normalizeAdditionalInfoTable(parsed);
    } catch {
      return createEmptyAdditionalInfoTable();
    }
  }

  function isAnnouncementActive(item, nowMs) {
    if (!item) return false;
    if (item.permanent) return true;
    const startAt = announcementPartsToUtcIso(item.startDate, item.startTimeUtc);
    const endAt = announcementPartsToUtcIso(item.endDate, item.endTimeUtc);
    const startMs = startAt ? new Date(startAt).getTime() : Number.NaN;
    const endMs = endAt ? new Date(endAt).getTime() : Number.NaN;
    const hasStart = Number.isFinite(startMs);
    const hasEnd = Number.isFinite(endMs);
    if (hasStart && nowMs < startMs) return false;
    if (hasEnd && nowMs > endMs) return false;
    return hasStart || hasEnd;
  }

  function computeAnnouncementSignature(items) {
    return (Array.isArray(items) ? items : [])
      .map((item) => `${item.id}|${item.kind || ""}|${item.heading}|${item.body}|${item.startDate}|${item.startTimeUtc}|${item.endDate}|${item.endTimeUtc}|${item.permanent ? 1 : 0}`)
      .join("||");
  }

  function evaluateAnnouncementsPrompt() {
    if (state.view === "admin" || state.view === "admin-login") return;
    const announcements = Array.isArray(state.catalog.content.announcements) ? state.catalog.content.announcements.slice() : [];
    if (!announcements.length) {
      state.announcement.open = false;
      state.announcement.items = [];
      state.announcement.index = 0;
      state.announcement.activeSignature = "";
      return;
    }
    const nowMs = Date.now();
    const active = announcements
      .filter((item) => isAnnouncementActive(item, nowMs))
      .filter((item) => String(item.heading || "").trim() !== "" || String(item.body || "").trim() !== "");
    if (!active.length) {
      state.announcement.open = false;
      state.announcement.items = [];
      state.announcement.index = 0;
      state.announcement.activeSignature = "";
      return;
    }
    const signature = computeAnnouncementSignature(active);
    const previousSignature = state.announcement.activeSignature;
    state.announcement.activeSignature = signature;
    if (state.announcement.open && previousSignature === signature && state.announcement.items.length) return;
    const seenSignature = readStoredValue(ANNOUNCEMENT_SEEN_KEY);
    if (seenSignature === signature) return;
    state.announcement.items = active;
    state.announcement.index = 0;
    state.announcement.open = true;
  }

  function normalizeEditorComparison(value) {
    return normalizeEditorText(value).trim();
  }

  function createHtmlContainer(html) {
    const container = document.createElement("div");
    container.innerHTML = String(html || "");
    return container;
  }

  function plainNodeText(node) {
    if (!node) return "";
    return String(node.textContent || "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function trimEmptyBoundaryLines(lines) {
    const next = Array.isArray(lines) ? lines.slice() : [];
    while (next.length && !String(next[0] || "").trim()) next.shift();
    while (next.length && !String(next[next.length - 1] || "").trim()) next.pop();
    return next;
  }

  function splitLinesIntoParagraphs(lines) {
    const groups = [];
    let current = [];
    (Array.isArray(lines) ? lines : []).forEach((line) => {
      const text = String(line || "");
      if (!text.trim()) {
        if (current.length) {
          groups.push(current);
          current = [];
        }
        return;
      }
      current.push(text.trim());
    });
    if (current.length) groups.push(current);
    return groups;
  }

  function parseEditorSections(text) {
    const sections = [];
    const lines = normalizeEditorText(text).split("\n");
    let current = { title: "", lines: [] };
    const flush = () => {
      const trimmedLines = trimEmptyBoundaryLines(current.lines);
      if (current.title || trimmedLines.length) {
        sections.push({
          title: String(current.title || "").trim(),
          lines: trimmedLines,
        });
      }
    };
    lines.forEach((rawLine) => {
      const line = String(rawLine || "");
      const headingMatch = line.match(/^\s*##+\s*(.+?)\s*$/);
      if (headingMatch) {
        flush();
        current = { title: headingMatch[1], lines: [] };
      } else {
        current.lines.push(line);
      }
    });
    flush();
    return sections;
  }

  function looksLikeHtml(text) {
    return /<\s*\/?\s*[a-z!][^>]*>/i.test(String(text || ""));
  }

  function genericHtmlToEditorText(html) {
    const root = createHtmlContainer(html);
    const blocks = [];
    Array.from(root.querySelectorAll("h1, h2, h3, h4, h5, h6, p, li")).forEach((node) => {
      const line = plainNodeText(node);
      if (line) blocks.push(line);
    });
    if (blocks.length) return blocks.join("\n\n").trim();
    return plainNodeText(root);
  }

  function manualHtmlToEditorText(html) {
    const source = String(html || "");
    if (!source.trim()) return "";
    const root = createHtmlContainer(source);
    const sectionNodes = Array.from(root.querySelectorAll(".manual-section"));
    if (!sectionNodes.length) return genericHtmlToEditorText(source);

    const sectionTexts = sectionNodes.map((sectionNode) => {
      const lines = [];
      const title = plainNodeText(sectionNode.querySelector("h3"));
      if (title) lines.push(`## ${title}`);

      const variableRows = Array.from(sectionNode.querySelectorAll(".manual-vars p"));
      if (variableRows.length) {
        variableRows.forEach((row) => {
          const symbol = plainNodeText(row.querySelector("strong"));
          const description = plainNodeText(row.querySelector("span"));
          if (!symbol && !description) return;
          if (symbol && description) lines.push(`${symbol}: ${description}`);
          else lines.push(symbol || description);
        });
      } else {
        const manualRows = Array.from(sectionNode.querySelectorAll(".manual-row"));
        if (manualRows.length) {
          manualRows.forEach((row) => {
            const formula = plainNodeText(row.querySelector(".manual-formula"));
            const note = plainNodeText(row.querySelector(".manual-note"));
            if (!formula && !note) return;
            if (formula && note) lines.push(`${formula} :: ${note}`);
            else if (formula) lines.push(formula);
            else lines.push(`:: ${note}`);
          });
        } else {
          Array.from(sectionNode.querySelectorAll("p, li")).forEach((row) => {
            const text = plainNodeText(row);
            if (text) lines.push(text);
          });
        }
      }
      return lines.join("\n").trim();
    }).filter(Boolean);

    return sectionTexts.join("\n\n").trim();
  }

  function privacyHtmlToEditorText(html) {
    const source = String(html || "");
    if (!source.trim()) return "";
    const root = createHtmlContainer(source);
    const children = Array.from(root.children);
    if (!children.length) return genericHtmlToEditorText(source);

    const sectionTexts = [];
    let activeTitle = "";
    let activeParagraphs = [];

    const flush = () => {
      if (!activeTitle && !activeParagraphs.length) return;
      const lines = [];
      if (activeTitle) lines.push(`## ${activeTitle}`);
      activeParagraphs.forEach((paragraph, index) => {
        if (index > 0) lines.push("");
        lines.push(paragraph);
      });
      sectionTexts.push(lines.join("\n").trim());
      activeTitle = "";
      activeParagraphs = [];
    };

    children.forEach((child) => {
      const tag = String(child.tagName || "").toUpperCase();
      if (/^H[1-6]$/.test(tag)) {
        flush();
        activeTitle = plainNodeText(child);
        return;
      }
      if (tag === "UL" || tag === "OL") {
        const listLines = Array.from(child.querySelectorAll("li"))
          .map((li) => plainNodeText(li))
          .filter(Boolean)
          .map((line) => `- ${line}`);
        if (listLines.length) activeParagraphs.push(listLines.join("\n"));
        return;
      }
      const text = plainNodeText(child);
      if (text) activeParagraphs.push(text);
    });
    flush();

    if (sectionTexts.length) return sectionTexts.join("\n\n").trim();
    return genericHtmlToEditorText(source);
  }

  function manualTextToHtml(text) {
    const source = normalizeEditorText(text);
    if (!source.trim()) return "";
    const sections = parseEditorSections(source);
    if (!sections.length) return "";

    const htmlSections = sections.map((section) => {
      const title = escapeHtml(section.title || "Section");
      const lines = section.lines.map((line) => String(line || "").trim()).filter(Boolean);
      if (/^variables$/i.test(section.title || "")) {
        const variableRows = lines.map((line) => {
          const rowText = line.replace(/^[-*]\s*/, "");
          const separatorMatch = rowText.match(/^([^:=]+?)\s*[:=]\s*(.+)$/);
          const symbol = escapeHtml((separatorMatch ? separatorMatch[1] : rowText).trim());
          const description = escapeHtml((separatorMatch ? separatorMatch[2] : "").trim());
          return `      <p><strong>${symbol}</strong><span>${description}</span></p>`;
        }).join("\n");
        return [
          '  <div class="manual-section">',
          `    <h3>${title}</h3>`,
          '    <div class="manual-vars">',
          variableRows,
          "    </div>",
          "  </div>",
        ].join("\n");
      }

      const rowMarkup = lines.map((line) => {
        const rowText = line.replace(/^[-*]\s*/, "");
        const separatorIndex = rowText.indexOf("::");
        const formula = separatorIndex >= 0 ? rowText.slice(0, separatorIndex).trim() : rowText.trim();
        const note = separatorIndex >= 0 ? rowText.slice(separatorIndex + 2).trim() : "";
        if (!formula && !note) return "";
        return [
          '      <div class="manual-row">',
          `        <p class="manual-formula">${escapeHtml(formula)}</p>`,
          `        <p class="manual-note">${escapeHtml(note)}</p>`,
          "      </div>",
        ].join("\n");
      }).filter(Boolean).join("\n");

      return [
        '  <div class="manual-section">',
        `    <h3>${title}</h3>`,
        rowMarkup || '    <div class="manual-row"><p class="manual-formula"></p><p class="manual-note"></p></div>',
        "  </div>",
      ].join("\n");
    });

    return htmlSections.join("\n\n");
  }

  function privacyTextToHtml(text) {
    const source = normalizeEditorText(text);
    if (!source.trim()) return "";
    const sections = parseEditorSections(source);
    if (!sections.length) return "";

    const blocks = [];
    sections.forEach((section) => {
      const title = escapeHtml(section.title || "Section");
      blocks.push(`<h3>${title}</h3>`);
      const paragraphs = splitLinesIntoParagraphs(section.lines);
      paragraphs.forEach((paragraphLines) => {
        if (paragraphLines.every((line) => /^[-*]\s+/.test(line))) {
          const items = paragraphLines
            .map((line) => line.replace(/^[-*]\s+/, "").trim())
            .filter(Boolean)
            .map((item) => `<li>${escapeHtml(item)}</li>`)
            .join("");
          if (items) blocks.push(`<ul>${items}</ul>`);
          return;
        }
        const paragraphText = paragraphLines.join(" ").trim();
        if (paragraphText) blocks.push(`<p>${escapeHtml(paragraphText)}</p>`);
      });
    });

    return blocks.join("\n\n");
  }

  function contentHtmlToEditorText(key, html) {
    const pageKey = String(key || "").trim().toLowerCase();
    if (pageKey === "manual") return manualHtmlToEditorText(html);
    if (pageKey === "privacy") return privacyHtmlToEditorText(html);
    return genericHtmlToEditorText(html);
  }

  function editorTextToContentHtml(key, text) {
    const pageKey = String(key || "").trim().toLowerCase();
    const source = String(text || "");
    if (!source.trim()) return "";
    if (looksLikeHtml(source)) return source;
    if (pageKey === "manual") return manualTextToHtml(source);
    if (pageKey === "privacy") return privacyTextToHtml(source);
    return `<p>${escapeHtml(source)}</p>`;
  }

  function resolveAdminContentHtmlForSave(key, draftText) {
    const pageKey = String(key || "").trim().toLowerCase();
    const draft = String(draftText || "");
    if (pageKey === "manual") {
      const unchanged = normalizeEditorComparison(draft) === normalizeEditorComparison(state.admin.manualDraftBaselineText);
      if (unchanged) return String(state.admin.manualDraftBaselineHtml || "");
      return editorTextToContentHtml("manual", draft);
    }
    if (pageKey === "privacy") {
      const unchanged = normalizeEditorComparison(draft) === normalizeEditorComparison(state.admin.privacyDraftBaselineText);
      if (unchanged) return String(state.admin.privacyDraftBaselineHtml || "");
      return editorTextToContentHtml("privacy", draft);
    }
    return editorTextToContentHtml(pageKey, draft);
  }

  async function saveContentPage(key, bodyHtml) {
    const ok = await connectSupabaseClient(false);
    if (!ok) {
      render();
      return;
    }
    const pageKey = String(key || "").trim().toLowerCase();
    if (!pageKey) return;
    state.admin.error = "";
    state.admin.notice = "";
    try {
      const payload = { key: pageKey, body_html: String(bodyHtml || "") };
      const { error } = await supabaseClient.from("content_pages").upsert(payload, { onConflict: "key" });
      if (error) throw error;
      state.admin.notice = `${pageKey} content saved.`;
      if (pageKey === "manual") state.admin.manualSaveStatus = `Saved ${formatAdminSaveTime()}`;
      if (pageKey === "privacy") state.admin.privacySaveStatus = `Saved ${formatAdminSaveTime()}`;
      await loadAdminData();
    } catch (error) {
      state.admin.error = error && error.message ? error.message : `Could not save ${pageKey} content.`;
      if (pageKey === "manual") state.admin.manualSaveStatus = "Save failed";
      if (pageKey === "privacy") state.admin.privacySaveStatus = "Save failed";
      render();
    }
  }

  function serializeAnnouncementForStorage(item) {
    return {
      id: String(item && item.id ? item.id : createAnnouncementId()),
      heading: String(item && item.heading ? item.heading : ""),
      body: String(item && item.body ? item.body : ""),
      startAt: announcementPartsToUtcIso(item && item.startDate ? item.startDate : "", item && item.startTimeUtc ? item.startTimeUtc : ""),
      endAt: announcementPartsToUtcIso(item && item.endDate ? item.endDate : "", item && item.endTimeUtc ? item.endTimeUtc : ""),
      permanent: Boolean(item && item.permanent),
    };
  }

  async function persistAnnouncementsToDatabase(drafts, successPrefix) {
    const normalized = normalizeAnnouncementDrafts(drafts, false)
      .filter((item) => String(item.heading || "").trim() !== "" || String(item.body || "").trim() !== "")
      .map((item) => serializeAnnouncementForStorage(item));
    const payload = JSON.stringify(normalized);
    const ok = await connectSupabaseClient(false);
    if (!ok) {
      render();
      return false;
    }
    state.admin.error = "";
    state.admin.notice = "";
    try {
      const { error } = await supabaseClient.from("content_pages").upsert(
        { key: "announcements", body_html: payload },
        { onConflict: "key" },
      );
      if (error) throw error;
      state.admin.announcementSaveStatus = `${successPrefix || "Saved"} ${formatAdminSaveTime()}`;
      state.admin.error = "";
      await loadAdminData();
      evaluateAnnouncementsPrompt();
      return true;
    } catch (error) {
      state.admin.error = error && error.message ? error.message : "Could not save announcements.";
      state.admin.announcementSaveStatus = "Save failed";
      render();
      return false;
    }
  }

  async function saveAnnouncementByIndex(index) {
    const normalizedAll = normalizeAnnouncementDrafts(state.admin.announcementDrafts);
    if (!Number.isFinite(index) || index < 0 || index >= normalizedAll.length) return;
    const target = normalizedAll[index];
    const hasContent = String(target.heading || "").trim() !== "" || String(target.body || "").trim() !== "";
    if (!hasContent) {
      state.admin.error = "Heading or body is required before saving.";
      state.admin.announcementSaveStatus = "";
      render();
      return;
    }
    if (!target.permanent) {
      const hasStart = Boolean(announcementPartsToUtcIso(target.startDate, target.startTimeUtc));
      const hasEnd = Boolean(announcementPartsToUtcIso(target.endDate, target.endTimeUtc));
      if (!hasStart && !hasEnd) {
        state.admin.error = "Set start or end date/time, or enable Permanent.";
        state.admin.announcementSaveStatus = "";
        render();
        return;
      }
    }
    await persistAnnouncementsToDatabase(normalizedAll, "Saved");
  }

  async function saveMaintenanceModeFromAdmin(enabled) {
    const ok = await connectSupabaseClient(false);
    if (!ok) {
      render();
      return false;
    }
    state.admin.error = "";
    state.admin.notice = "";
    try {
      const { error } = await supabaseClient.from("content_pages").upsert(
        { key: "maintenance_mode", body_html: enabled ? "1" : "0" },
        { onConflict: "key" },
      );
      if (error) throw error;
      state.catalog.content.maintenanceMode = Boolean(enabled);
      state.admin.maintenanceMode = Boolean(enabled);
      state.admin.maintenanceSaveStatus = `Saved ${formatAdminSaveTime()}`;
      evaluateAnnouncementsPrompt();
      render();
      return true;
    } catch (error) {
      state.admin.error = error && error.message ? error.message : "Could not save maintenance mode.";
      state.admin.maintenanceSaveStatus = "Save failed";
      render();
      return false;
    }
  }

  async function saveAdditionalInfoFromAdmin() {
    const ok = await connectSupabaseClient(false);
    if (!ok) {
      render();
      return;
    }
    state.admin.error = "";
    state.admin.notice = "";
    try {
      const body = JSON.stringify(normalizeAdditionalInfoTable(state.admin.additionalInfoDraft));
      const { error } = await supabaseClient.from("content_pages").upsert(
        { key: "additional_info", body_html: body },
        { onConflict: "key" },
      );
      if (error) throw error;
      state.admin.additionalInfoSaveStatus = `Saved ${formatAdminSaveTime()}`;
      await loadAdminData();
    } catch (error) {
      state.admin.error = error && error.message ? error.message : "Could not save additional information.";
      state.admin.additionalInfoSaveStatus = "Save failed";
      render();
    }
  }

  function formatAdminSaveTime() {
    const now = new Date();
    return now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  function handleBugReportEscape(event) {
    if (event.key !== "Escape" || !state.bugReport.open || state.bugReport.submitting) return;
    closeBugReport();
  }

  function closeBugReport() {
    state.bugReport.open = false;
    state.bugReport.status = "";
    state.bugReport.note = "";
    document.removeEventListener("keydown", handleBugReportEscape);
    render();
  }

  function typesetManualMath() {
    if (!window.MathJax || !window.MathJax.typesetPromise) {
      if (manualMathRetryCount >= 20) return;
      manualMathRetryCount += 1;
      setTimeout(() => {
        if (state.view === "manual") typesetManualMath();
      }, 120);
      return;
    }
    manualMathRetryCount = 0;
    window.MathJax.typesetClear?.();
    window.MathJax.typesetPromise().catch(() => {});
  }

  function computeTocTod() {
    const firstLeg = state.navlog.legs[0];
    const secondLeg = state.navlog.legs[1];
    const last = state.navlog.legs[state.navlog.legs.length - 1];
    const secondLast = state.navlog.legs[state.navlog.legs.length - 2];
    const roc = parseClimbRateInput(state.navlog.tocTod.roc);
    const rod = parseClimbRateInput(state.navlog.tocTod.rod);

    const firstAlt = parseAltitudeInput(firstLeg?.alt);
    const secondAlt = parseAltitudeInput(secondLeg?.alt);
    const firstGs = firstAvailableValue("gs");
    const lastAlt = parseAltitudeInput(last?.alt);
    const secondLastAlt = parseAltitudeInput(secondLast?.alt);
    const lastGs = parseSpeedInput(last?.gs);

    state.navlog.tocTod.tocDistance = "";
    state.navlog.tocTod.tocTime = "";
    state.navlog.tocTod.todDistance = "";
    state.navlog.tocTod.todTime = "";

    if (!state.navlog.tocTod.tocEditing && roc != null && roc > 0 && secondAlt != null && firstGs != null) {
      const departureElevation = firstAlt == null ? 0 : firstAlt;
      const altitudeToGain = secondAlt - departureElevation;
      const tocTime = Math.max(0, altitudeToGain / roc);
      const tocDistance = tocTime * (firstGs / 60);
      state.navlog.tocTod.tocTime = formatGeneralMinutes(tocTime);
      state.navlog.tocTod.tocDistance = formatDistanceDisplay(tocDistance);
    }

    if (!state.navlog.tocTod.todEditing && rod != null && rod > 0 && lastAlt != null && secondLastAlt != null && lastGs != null) {
      const altitudeToLose = Math.max(0, secondLastAlt - lastAlt);
      const todTime = altitudeToLose / rod;
      const todDistance = todTime * (lastGs / 60);
      state.navlog.tocTod.todTime = formatGeneralMinutes(todTime);
      state.navlog.tocTod.todDistance = formatDistanceDisplay(todDistance);
    }
  }

  function firstAvailableValue(field) {
    const firstTwoLegs = state.navlog.legs.slice(0, 2);
    for (const leg of firstTwoLegs) {
      const raw = leg?.[field];
      const value =
        field === "gs" || field === "cas" || field === "windSpd" || field === "ta"
          ? parseSpeedInput(raw)
          : field === "alt"
            ? parseAltitudeInput(raw)
            : num(raw);
      if (value != null) return value;
    }
    return null;
  }

  function updateComputedCells(activeEdit) {
    state.navlog.legs.forEach((leg, index) => {
      syncLegField(index, "cas", leg.cas, activeEdit, leg);
      syncLegField(index, "alt", leg.alt, activeEdit, leg);
      syncLegField(index, "temp", leg.temp, activeEdit, leg);
      syncLegField(index, "windDir", leg.windDir, activeEdit, leg);
      syncLegField(index, "windSpd", leg.windSpd, activeEdit, leg);
      syncLegField(index, "tc", leg.tc, activeEdit, leg);
      syncLegField(index, "wca", leg.wca, activeEdit, leg);
      syncLegField(index, "th", leg.th, activeEdit, leg);
      syncLegField(index, "var", leg.var, activeEdit, leg);
      syncLegField(index, "mh", leg.mh, activeEdit, leg);
      syncLegField(index, "dev", leg.dev, activeEdit, leg);
      syncLegField(index, "ta", leg.ta, activeEdit, leg);
      syncLegField(index, "gs", leg.gs, activeEdit, leg);
      syncLegField(index, "distance", leg.distance, activeEdit, leg);
      syncLegField(index, "ee", leg.ee, activeEdit, leg);
      syncLegField(index, "et", leg.et, activeEdit, leg);
      syncLegField(index, "at", leg.at, activeEdit, leg);

      syncLegDerived(index, "cas", Boolean(leg._derived && leg._derived.cas));
      syncLegDerived(index, "alt", Boolean(leg._derived && leg._derived.alt));
      syncLegDerived(index, "temp", Boolean(leg._derived && leg._derived.temp));
      syncLegDerived(index, "windDir", Boolean(leg._derived && leg._derived.windDir));
      syncLegDerived(index, "windSpd", Boolean(leg._derived && leg._derived.windSpd));
      syncLegDerived(index, "tc", Boolean(leg._derived && leg._derived.tc));
      syncLegDerived(index, "wca", Boolean(leg._derived && leg._derived.wca));
      syncLegDerived(index, "th", Boolean(leg._derived && leg._derived.th));
      syncLegDerived(index, "var", Boolean(leg._derived && leg._derived.var));
      syncLegDerived(index, "mh", Boolean(leg._derived && leg._derived.mh));
      syncLegDerived(index, "dev", Boolean(leg._derived && leg._derived.dev));
      syncLegDerived(index, "ta", Boolean(leg._derived && leg._derived.ta));
      syncLegDerived(index, "gs", Boolean(leg._derived && leg._derived.gs));
      syncLegDerived(index, "distance", Boolean(leg._derived && leg._derived.distance));
      syncLegDerived(index, "ee", Boolean(leg._derived && leg._derived.ee));
      syncLegDerived(index, "et", Boolean(leg._derived && leg._derived.et));

      syncLegError(index, "wca", Boolean(leg._errors && leg._errors.wca));
      syncLegError(index, "gs", Boolean(leg._errors && leg._errors.gs));
    });
    syncDistanceToGo();
    syncFirstAltHint();
    syncRouteHints();

    const tocDistance = document.querySelector('[data-toc="tocDistance"]');
    const tocTime = document.querySelector('[data-toc="tocTime"]');
    const todDistance = document.querySelector('[data-toc="todDistance"]');
    const todTime = document.querySelector('[data-toc="todTime"]');
    if (tocDistance) tocDistance.value = state.navlog.tocTod.tocDistance;
    if (tocTime) tocTime.value = state.navlog.tocTod.tocTime;
    if (todDistance) todDistance.value = state.navlog.tocTod.todDistance;
    if (todTime) todTime.value = state.navlog.tocTod.todTime;
  }

  function syncDistanceToGo() {
    if (!state.settings.showDistanceToGo) return;
    state.navlog.legs.forEach((_, index) => {
      const routeInput = document.querySelector(`[data-leg-field="${index}:route"]`);
      const routeCell = routeInput && routeInput.closest(".route-cell");
      const distanceNode = routeCell && routeCell.querySelector(".route-dtg");
      if (!distanceNode) return;
      const distanceToGo = getDistanceToGoDisplay(index);
      distanceNode.textContent = distanceToGo ? `(${distanceToGo})` : "";
    });
  }

  function syncLegField(index, field, value, activeEdit, leg) {
    if (activeEdit && activeEdit.index === index && activeEdit.field === field) return;
    const node = document.querySelector(`[data-leg-field="${index}:${field}"]`);
    if (!node) return;
    const displayValue =
      leg && leg._errors && leg._errors[field] && !(leg._manual && leg._manual[field])
        ? ""
        : value;
    node.value = displayValue;
  }

  function syncLegDerived(index, field, isDerived) {
    const node = document.querySelector(`[data-leg-field="${index}:${field}"]`);
    const wrapper = node && node.closest(".field");
    if (wrapper) wrapper.classList.toggle("derived", Boolean(isDerived));
  }

  function syncLegError(index, field, hasError) {
    const node = document.querySelector(`[data-leg-field="${index}:${field}"]`);
    const wrapper = node && node.closest(".field");
    if (!wrapper) return;
    wrapper.classList.toggle("error", Boolean(hasError));
    const leg = state.navlog.legs[index];
    const errorText = leg && leg._errors ? leg._errors[field] : "";
    if (hasError && errorText) {
      const displayError = errorText === "Wind too strong" ? "Wind\ntoo strong" : errorText;
      wrapper.setAttribute("data-error", displayError);
    }
    else wrapper.removeAttribute("data-error");
  }

  function syncFirstAltHint() {
    const node = document.querySelector('[data-leg-field="0:alt"]');
    const wrapper = node && node.closest(".field");
    if (!node || !wrapper) return;
    const showHint = String(node.value || "").trim() === "" && document.activeElement !== node;
    wrapper.classList.toggle("show-alt-hint", showHint);
  }

  function syncRouteHints() {
    state.navlog.legs.forEach((_, index) => {
      const node = document.querySelector(`[data-leg-field="${index}:route"]`);
      const wrapper = node && node.closest(".route-cell");
      if (!node || !wrapper) return;
      const showHint = String(node.value || "").trim() === "" && document.activeElement !== node;
      wrapper.classList.toggle("show-route-hint", showHint);
    });
  }

  function resolveDisplayField(leg, manual, lockedField, field, derivedValue, formatter) {
    if (lockedField === field) return leg[field];
    if (manual[field]) return leg[field];
    return derivedValue == null ? "" : formatter(derivedValue);
  }

  function tasFactor(tempC, pressureAltitude) {
    if (tempC == null || pressureAltitude == null) return null;
    const h = 0.3048 * pressureAltitude;
    const lapseTerm = 1 - ((0.0065 * h) / 288.15);
    if (lapseTerm <= 0) return null;
    const pressure = 101325 * (lapseTerm ** 5.2558797);
    const kelvin = tempC + 273.15;
    if (kelvin <= 0) return null;
    const density = pressure / (287.05 * kelvin);
    if (!Number.isFinite(density) || density <= 0) return null;
    return Math.sqrt(1.225 / density);
  }

  function tempFromTasFactor(factor, pressureAltitude) {
    if (factor == null || pressureAltitude == null || factor <= 0) return null;
    const h = 0.3048 * pressureAltitude;
    const lapseTerm = 1 - ((0.0065 * h) / 288.15);
    if (lapseTerm <= 0) return null;
    const pressure = 101325 * (lapseTerm ** 5.2558797);
    const density = 1.225 / (factor ** 2);
    if (!Number.isFinite(density) || density <= 0) return null;
    const kelvin = pressure / (287.05 * density);
    if (!Number.isFinite(kelvin) || kelvin <= 0) return null;
    return kelvin - 273.15;
  }

  function altitudeFromTasFactor(factor, tempC, seedAltitude) {
    if (factor == null || tempC == null || factor <= 0) return null;

    const evaluateError = (altitude) => {
      const computedFactor = tasFactor(tempC, altitude);
      if (computedFactor == null || !Number.isFinite(computedFactor)) return null;
      return computedFactor - factor;
    };

    let bestAltitude = Number.isFinite(seedAltitude) ? seedAltitude : null;
    let bestError = bestAltitude == null ? Infinity : Math.abs(evaluateError(bestAltitude) ?? Infinity);

    for (let altitude = -1000; altitude <= 30000; altitude += 250) {
      const error = evaluateError(altitude);
      if (error == null) continue;
      const absError = Math.abs(error);
      if (absError < bestError) {
        bestError = absError;
        bestAltitude = altitude;
      }
    }

    if (bestAltitude == null) return null;

    const refinementSteps = [50, 10, 2];
    for (const step of refinementSteps) {
      for (let altitude = bestAltitude - (10 * step); altitude <= bestAltitude + (10 * step); altitude += step) {
        const error = evaluateError(altitude);
        if (error == null) continue;
        const absError = Math.abs(error);
        if (absError < bestError) {
          bestError = absError;
          bestAltitude = altitude;
        }
      }
    }

    return Number.isFinite(bestAltitude) ? bestAltitude : null;
  }

  function num(value) {
    if (value === "" || value == null) return null;
    const cleaned = String(value).replace(/[^\d.-]/g, "");
    if (!cleaned) return null;
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : null;
  }

  function maybeFormat(value) {
    return value == null || !Number.isFinite(value) ? "" : String(roundHalfUp(value));
  }

  function formatOneDecimal(value) {
    if (value == null || !Number.isFinite(value)) return "";
    const rounded = Math.round(value * 10) / 10;
    return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
  }

  function parseAltitudeInput(value) {
    return parseAltitudeInputWithUnit(value, state.settings.altitudeUnit);
  }

  function parseAltitudeInputWithUnit(value, unit) {
    const parsed = num(value);
    if (parsed == null) return null;
    return unit === "m" ? parsed * FEET_PER_METER : parsed;
  }

  function formatAltitudeDisplay(valueFeet) {
    return formatAltitudeDisplayForUnit(valueFeet, state.settings.altitudeUnit);
  }

  function formatAltitudeDisplayForUnit(valueFeet, unit) {
    if (valueFeet == null || !Number.isFinite(valueFeet)) return "";
    const display = unit === "m" ? valueFeet / FEET_PER_METER : valueFeet;
    return maybeFormat(display);
  }

  function parseSpeedInput(value) {
    return parseSpeedInputWithUnit(value, state.settings.speedUnit);
  }

  function parseSpeedInputWithUnit(value, unit) {
    const parsed = num(value);
    if (parsed == null) return null;
    if (unit === "mph") return parsed * KNOTS_PER_MPH;
    if (unit === "kmh") return parsed * KNOTS_PER_KMH;
    if (unit === "ms") return parsed * KNOTS_PER_MS;
    return parsed;
  }

  function formatSpeedDisplay(valueKnots) {
    return formatSpeedDisplayForUnit(valueKnots, state.settings.speedUnit);
  }

  function formatSpeedDisplayForUnit(valueKnots, unit) {
    if (valueKnots == null || !Number.isFinite(valueKnots)) return "";
    const display =
      unit === "mph"
        ? valueKnots / KNOTS_PER_MPH
        : unit === "kmh"
          ? valueKnots / KNOTS_PER_KMH
          : unit === "ms"
            ? valueKnots / KNOTS_PER_MS
            : valueKnots;
    return maybeFormat(display);
  }

  function parseTemperatureInput(value) {
    return parseTemperatureInputWithUnit(value, state.settings.temperatureUnit);
  }

  function parseTemperatureInputWithUnit(value, unit) {
    const parsed = num(value);
    if (parsed == null) return null;
    if (unit === "f") return (parsed - 32) * (5 / 9);
    if (unit === "k") return parsed - 273.15;
    return parsed;
  }

  function formatTemperatureDisplay(valueCelsius) {
    return formatTemperatureDisplayForUnit(valueCelsius, state.settings.temperatureUnit);
  }

  function formatTemperatureDisplayForUnit(valueCelsius, unit) {
    if (valueCelsius == null || !Number.isFinite(valueCelsius)) return "";
    const display =
      unit === "f"
        ? (valueCelsius * (9 / 5)) + 32
        : unit === "k"
          ? valueCelsius + 273.15
          : valueCelsius;
    return maybeFormat(display);
  }

  function parseDistanceInput(value) {
    return parseDistanceInputWithRounding(value, state.settings.roundDistanceValues);
  }

  function parseDistanceInputWithRounding(value, _roundDistanceValues, unit = state.settings.distanceUnit) {
    return parseDistanceInputWithUnit(value, unit);
  }

  function parseDistanceInputWithUnit(value, unit) {
    const parsed = num(value);
    if (parsed == null) return null;
    if (unit === "km") return parsed * NM_PER_KM;
    if (unit === "sm") return parsed * NM_PER_SM;
    return parsed;
  }

  function formatDistanceDisplay(valueNm) {
    return formatDistanceDisplayWithRounding(valueNm, state.settings.roundDistanceValues);
  }

  function formatDistanceDisplayWithRounding(valueNm, roundDistanceValues, unit = state.settings.distanceUnit) {
    if (valueNm == null || !Number.isFinite(valueNm)) return "";
    const display =
      unit === "km"
        ? valueNm / NM_PER_KM
        : unit === "sm"
          ? valueNm / NM_PER_SM
          : valueNm;
    return roundDistanceValues ? maybeFormat(display) : formatOneDecimal(display);
  }

  function parseClimbRateInput(value) {
    return parseClimbRateInputWithUnit(value, state.settings.altitudeUnit);
  }

  function parseClimbRateInputWithUnit(value, altitudeUnit) {
    const parsed = num(value);
    if (parsed == null) return null;
    return altitudeUnit === "m" ? parsed * FEET_PER_METER : parsed;
  }

  function formatClimbRateDisplayForUnit(valueFeetPerMin, altitudeUnit) {
    if (valueFeetPerMin == null || !Number.isFinite(valueFeetPerMin)) return "";
    const display = altitudeUnit === "m" ? valueFeetPerMin / FEET_PER_METER : valueFeetPerMin;
    return maybeFormat(display);
  }

  function normalizeCode(value) {
    return String(value || "").trim().toUpperCase();
  }

  function normalizeAircraft(value) {
    return String(value || "").trim().toUpperCase();
  }

  function syncSetupPresetStatus() {
    const slot = document.getElementById("preset-status-slot");
    if (slot) slot.innerHTML = getPresetStatusMarkup();
  }

  function shouldShowResumeButton() {
    return state.meta.hasOpenedSheet && hasMeaningfulSheetData();
  }

  function hasMeaningfulSheetData() {
    const header = state.navlog.header;
    const headerValues = [header.aircraft, header.rpCNo, header.gphPph, header.date, header.timeUtc];
    const legValues = state.navlog.legs.flatMap((leg) => [leg.route, leg.cas, leg.alt, leg.temp, leg.windDir, leg.windSpd, leg.tc, leg.wca, leg.ta, leg.gs, leg.distance, leg.ee, leg.et, leg.at]);
    const radioValues = state.navlog.radios.flatMap((row) => [row.location, row.cptAtis, row.depAap, row.twr, row.gnd, row.fss, row.remarks]);
    const tocTodValues = [state.navlog.tocTod.roc, state.navlog.tocTod.rod, state.navlog.tocTod.tocDistance, state.navlog.tocTod.tocTime, state.navlog.tocTod.todDistance, state.navlog.tocTod.todTime];
    const footerValues = [state.navlog.depAtisCode, state.navlog.destinAtisCode];
    return [...headerValues, ...legValues, ...radioValues, ...tocTodValues, ...footerValues].some((value) => String(value || "").trim() !== "");
  }

  function getMappedAircraftFromRpc(rpcValue) {
    const key = String(rpcValue || "").trim();
    return key ? RPC_TO_AIRCRAFT[key] : "";
  }

  function setLegCasDefault(index, casValue) {
    const leg = state.navlog.legs[index];
    if (!leg) return;
    leg.cas = String(casValue || "");
    leg._manual = leg._manual || {};
    leg._derived = leg._derived || {};
    leg._manual.cas = leg.cas.trim() !== "";
    delete leg._derived.cas;
  }

  function applyDefaultCasForAircraft(aircraftType) {
    const mappedType = String(aircraftType || "").trim();
    if (mappedType !== "C152") return;
    if (!Array.isArray(state.navlog.legs) || state.navlog.legs.length === 0) return;

    setLegCasDefault(0, "");
    if (state.navlog.legs.length > 1) setLegCasDefault(1, "70");
    for (let index = 2; index < state.navlog.legs.length; index += 1) {
      setLegCasDefault(index, "85");
    }
  }

  function syncAircraftFuelDefaults() {
    const aircraft = normalizeAircraft(state.navlog.header.aircraft);
    const fuelInput = document.querySelector('[data-header="gphPph"]');
    if (aircraft === "C152") {
      state.navlog.header.gphPph = "6";
      if (fuelInput) fuelInput.value = "6";
      return;
    }
    if (state.navlog.header.gphPph === "6") {
      state.navlog.header.gphPph = "";
      if (fuelInput) fuelInput.value = "";
    }
  }

  function roundHalfUp(value) {
    if (!Number.isFinite(value)) return value;
    const sign = value < 0 ? -1 : 1;
    return sign * Math.floor((Math.abs(value) + 0.5));
  }

  function isDegreeField(field) {
    return field === "tc" || field === "wca" || field === "windDir" || field === "th" || field === "var" || field === "mh" || field === "dev";
  }

  function maybeDegrees(value) {
    if (value == null || !Number.isFinite(value)) return "";
    return String(roundHalfUp(value));
  }

  function maybeHeadingDegrees(value) {
    if (value == null || !Number.isFinite(value)) return "";
    return String(roundHalfUp(normalizeAngle(value)));
  }

  function maybeSignedDegrees(value) {
    if (value == null || !Number.isFinite(value)) return "";
    const rounded = roundHalfUp(value);
    return rounded > 0 ? `+${rounded}` : String(rounded);
  }

  function formatGeneralMinutes(minutesFloat) {
    return formatGeneralMinutesWithTimeRounding(minutesFloat, state.settings.roundTimeValues);
  }

  function formatGeneralMinutesWithTimeRounding(minutesFloat, roundTimeValues) {
    return formatMinutesDisplayWithTimeRounding(minutesFloat, roundTimeValues);
  }

  function formatEeDisplay(minutesFloat) {
    return formatEeDisplayWithTimeRounding(minutesFloat, state.settings.roundTimeValues);
  }

  function formatEeDisplayWithTimeRounding(minutesFloat, _roundTimeValues) {
    if (!Number.isFinite(minutesFloat)) return "";
    return formatMinutesAsHhmm(minutesFloat);
  }

  function formatMinutesAsHhmm(minutesFloat) {
    if (!Number.isFinite(minutesFloat)) return "";
    const totalMinutes = Math.max(0, roundHalfUp(minutesFloat));
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${String(hours).padStart(2, "0")}${String(minutes).padStart(2, "0")}`;
  }

  function formatMinutesDisplayWithTimeRounding(minutesFloat, roundTimeValues) {
    if (!Number.isFinite(minutesFloat)) return "";
    const bounded = Math.max(0, minutesFloat);
    if (roundTimeValues) return String(Math.ceil(bounded));
    return formatMinutesAsClock(bounded);
  }

  function formatMinutesAsClock(minutesFloat) {
    if (!Number.isFinite(minutesFloat)) return "";
    const totalSeconds = Math.max(0, Math.round(minutesFloat * 60));
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    if (hours > 0) return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  function parseDurationInput(value) {
    return parseDurationInputWithTimeRounding(value, state.settings.roundTimeValues);
  }

  function parseEeInput(value) {
    const text = String(value || "").trim();
    if (!text) return null;
    const hhmm = parseHhmmToMinutes(text);
    if (hhmm != null) return hhmm;
    const parsed = num(text);
    return parsed == null ? null : Math.max(0, parsed);
  }

  function parseAtInput(value) {
    const text = String(value || "").trim();
    if (!text) return null;
    return parseHhmmToMinutes(text);
  }

  function parseHhmmToMinutes(text) {
    const compact = String(text || "").replace(/[^\d]/g, "");
    if (!compact) return null;
    if (compact.length <= 2) {
      const minutesOnly = Number(compact);
      return Number.isFinite(minutesOnly) ? Math.max(0, minutesOnly) : null;
    }
    const splitAt = compact.length - 2;
    const hours = Number(compact.slice(0, splitAt));
    const minutes = Number(compact.slice(splitAt));
    if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
    if (hours < 0 || minutes < 0 || minutes >= 60) return null;
    return (hours * 60) + minutes;
  }

  function parseDurationInputWithTimeRounding(value, _roundTimeValues) {
    const text = String(value || "").trim();
    if (!text) return null;
    if (text.includes(":")) return parseClockToMinutes(text);
    const match = text.match(/-?(?:\d+\.?\d*|\.\d+)/);
    if (!match) return null;
    const parsed = Number(match[0]);
    return Number.isFinite(parsed) ? parsed : null;
  }

  function parseClockToMinutes(text) {
    const parts = String(text).trim().split(":");
    if (parts.length < 2 || parts.length > 3) return null;
    const nums = parts.map((part) => Number(part));
    if (nums.some((n) => !Number.isFinite(n))) return null;
    let hours = 0;
    let minutes = 0;
    let seconds = 0;
    if (nums.length === 3) {
      [hours, minutes, seconds] = nums;
    } else {
      [minutes, seconds] = nums;
    }
    if (minutes < 0 || seconds < 0 || hours < 0) return null;
    if (nums.length === 3 && minutes >= 60) return null;
    if (seconds >= 60) return null;
    return (hours * 60) + minutes + (seconds / 60);
  }

  function computeEtAtTimeline() {
    const departureAtMinutes = parseAtInput(state.navlog.legs[0] && state.navlog.legs[0].at);
    let elapsedMinutes = 0;
    state.navlog.legs.forEach((leg, index) => {
      leg._derived = leg._derived || {};
      if (index === 0) {
        leg.et = "";
        delete leg._derived.et;
        return;
      }
      const eeMinutes = parseEeInput(leg.ee);
      if (departureAtMinutes == null || eeMinutes == null || !Number.isFinite(eeMinutes) || eeMinutes < 0) {
        leg.et = "";
        delete leg._derived.et;
        return;
      }
      elapsedMinutes += eeMinutes;
      leg.et = formatMinutesAsHhmm(departureAtMinutes + elapsedMinutes);
      leg._derived.et = true;
    });
  }

  function normalizeAngle(angle) {
    let result = angle % 360;
    if (result < 0) result += 360;
    return result;
  }

  function normalizeSignedAngle(angle) {
    let result = normalizeAngle(angle);
    if (result > 180) result -= 360;
    return result;
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function toRadians(value) {
    return value * Math.PI / 180;
  }

  function toDegrees(value) {
    return value * 180 / Math.PI;
  }

  function formatUtcNow() {
    return new Date().toISOString().slice(11, 19);
  }

  function startUtcClock() {
    stopUtcClock();
    updateClock();
    utcTimer = setInterval(updateClock, 1000);
  }

  function stopUtcClock() {
    if (utcTimer) clearInterval(utcTimer);
    utcTimer = null;
  }

  function updateClock() {
    const now = formatUtcNow();
    document.querySelectorAll("#utc-clock").forEach((node) => {
      node.textContent = `UTC ${now}`;
    });
  }

  async function downloadPdf() {
    const sheet = document.querySelector(".sheet");
    if (!sheet || !window.html2canvas || !window.jspdf) return;
    const saveButton = document.getElementById("save-sheet");
    if (saveButton) saveButton.textContent = "Saving...";
    const pdfViewportWidth = 1366;
    const pdfViewportHeight = 1024;
    const pdfLayout = state.settings.pdfLayout || "default";

    try {
      const canvas = await window.html2canvas(sheet, {
        scale: 2,
        backgroundColor: "#f7f2e7",
        useCORS: true,
        windowWidth: pdfViewportWidth,
        windowHeight: pdfViewportHeight,
        onclone: (doc) => {
          doc.body.classList.add("pdf-export");
          doc.body.classList.add(pdfLayout === "printable" ? "pdf-export-printable" : "pdf-export-default");

          // Force a desktop-like render box so mobile/tablet exports match desktop proportions.
          doc.documentElement.style.width = `${pdfViewportWidth}px`;
          doc.body.style.width = `${pdfViewportWidth}px`;

          const clonedTableBody = doc.querySelector(".table-body");
          const clonedRadioBody = doc.querySelector(".radio-body");
          while (clonedTableBody && clonedTableBody.children.length < 8) {
            clonedTableBody.insertAdjacentHTML("beforeend", renderLegRow(createBlankLeg(""), 0));
          }
          while (clonedRadioBody && clonedRadioBody.children.length < 5) {
            clonedRadioBody.insertAdjacentHTML("beforeend", renderRadioRow(createBlankRadioRow(), 0));
          }
          doc.querySelectorAll(".field input, .location-cell input, .radio-row input, .atis-cell input, .toc-tod-card input").forEach((input) => {
            const wrapped = doc.createElement("div");
            wrapped.className = "pdf-wrap-value";
            wrapped.textContent = input.value;
            input.replaceWith(wrapped);
          });
          // Route cells use a strict single centered node in PDF mode.
          doc.querySelectorAll(".route-cell").forEach((routeCell) => {
            const routeValueNode = routeCell.querySelector(".pdf-wrap-value");
            const routeValue = routeValueNode ? (routeValueNode.textContent || "") : "";
            routeCell.innerHTML = "";
            const centered = doc.createElement("div");
            centered.className = "pdf-route-center";
            centered.textContent = routeValue;
            routeCell.appendChild(centered);
          });
          doc.querySelectorAll("input").forEach((input) => {
            input.placeholder = "";
          });
        },
      });
      const image = canvas.toDataURL("image/png");
      const { jsPDF } = window.jspdf;
      let pdf;
      if (pdfLayout === "printable") {
        pdf = new jsPDF("p", "mm", "a4");
        const pageHeight = 297;
        const marginLeft = 8;
        const marginTop = 8;
        const bottomPadding = 10;
        const exportWidth = 108;
        const usableWidth = exportWidth;
        const usableHeight = pageHeight - marginTop - bottomPadding;
        const imageHeight = (canvas.height * usableWidth) / canvas.width;
        let remaining = imageHeight;
        let y = marginTop;
        pdf.addImage(image, "PNG", marginLeft, y, usableWidth, imageHeight);
        remaining -= usableHeight;
        while (remaining > 0) {
          pdf.addPage();
          y = marginTop - (imageHeight - remaining);
          pdf.addImage(image, "PNG", marginLeft, y, usableWidth, imageHeight);
          remaining -= usableHeight;
        }
      } else {
        const orientation = canvas.width >= canvas.height ? "l" : "p";
        pdf = new jsPDF({ orientation, unit: "px", format: [canvas.width, canvas.height] });
        pdf.addImage(image, "PNG", 0, 0, canvas.width, canvas.height);
      }
      pdf.save("vfr-navlog.pdf");
    } finally {
      if (saveButton) saveButton.textContent = "Save";
    }
  }

  function escapeAttr(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;");
  }

  function normalizeDisplayDate(value) {
    const raw = String(value || "").trim();
    if (!raw) return "";
    const asIso = normalizeDateInputValue(raw);
    if (asIso) return formatDateToDisplay(asIso);
    return raw.replaceAll("-", "/");
  }

  function normalizeDateInputValue(value) {
    const text = String(value || "").trim();
    if (!text) return "";
    if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
    const slash = text.match(/^(\d{2})\/(\d{2})\/(\d{2})$/);
    if (slash) {
      const year = 2000 + Number(slash[1]);
      const month = Number(slash[2]);
      const day = Number(slash[3]);
      if (month >= 1 && month <= 12 && day >= 1 && day <= 31) return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }
    return "";
  }

  function formatDateToDisplay(isoDate) {
    const iso = normalizeDateInputValue(isoDate);
    if (!iso) return "";
    const [year, month, day] = iso.split("-");
    return `${year.slice(-2)}/${month}/${day}`;
  }

  function formatPolicyDate() {
    const now = new Date();
    const year = now.getUTCFullYear();
    const month = String(now.getUTCMonth() + 1).padStart(2, "0");
    const day = String(now.getUTCDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function renderDateHeaderControl(displayDateValue) {
    const normalizedDisplay = normalizeDisplayDate(displayDateValue);
    const isoValue = normalizeDateInputValue(normalizedDisplay);
    return `
      <span class="date-input-wrap">
        <input data-header="date" value="${escapeAttr(normalizedDisplay)}" placeholder="yy/mm/dd" />
        <input type="date" class="date-picker-proxy" data-date-picker value="${escapeAttr(isoValue)}" tabindex="-1" aria-hidden="true" />
      </span>
    `;
  }

  async function loadPublicCatalogFromSupabase() {
    if (loadingPublicCatalog) return;
    if (!state.admin.supabaseUrl || !state.admin.supabaseAnonKey) return;
    const ok = await connectSupabaseClient(false);
    if (!ok || !supabaseClient) return;
    loadingPublicCatalog = true;
    try {
      const [presetResult, airportResult, contentResult] = await Promise.all([
        supabaseClient.from("route_presets").select("*").order("name", { ascending: true }),
        supabaseClient.from("airports").select("*").order("code", { ascending: true }),
        supabaseClient.from("content_pages").select("*"),
      ]);
      if (presetResult.error || airportResult.error || contentResult.error) return;

      const dbPresets = (presetResult.data || []).map((row) => ({
        id: String(row.id),
        name: String(row.name || ""),
        departure: normalizeCode(row.departure),
        destination: normalizeCode(row.destination),
        legs: Array.isArray(row.legs_json) ? row.legs_json : [],
      }));
      const dbAirports = (airportResult.data || []).map((row) => normalizeAirportRecord({
        id: row.id,
        code: row.code,
        cptAtis: row.cpt_atis,
        depAap: row.dep_aap,
        twr: row.twr,
        gnd: row.gnd,
        fss: row.fss,
        remarks: row.remarks,
      }));
      const contentMap = {};
      (contentResult.data || []).forEach((row) => {
        contentMap[String(row.key || "").toLowerCase()] = String(row.body_html || "");
      });

      state.catalog.routePresets = dbPresets.map((preset) => clonePreset(preset));
      state.catalog.airports = dbAirports.map((airport) => ({ ...airport }));
      if (typeof contentMap.manual === "string") state.catalog.content.manualHtml = contentMap.manual;
      if (typeof contentMap.privacy === "string") state.catalog.content.privacyHtml = contentMap.privacy;
      state.catalog.content.announcements = parseAnnouncementsContent(contentMap.announcements || "");
      state.catalog.content.maintenanceMode = parseMaintenanceModeContent(contentMap.maintenance_mode || "");
      state.catalog.content.additionalInfoTable = parseAdditionalInfoContent(contentMap.additional_info || "");
    } finally {
      loadingPublicCatalog = false;
    }
  }

  async function initializeApp() {
    await loadPublicCatalogFromSupabase();
    evaluateAnnouncementsPrompt();
    render();
  }

  window.addEventListener("beforeunload", (event) => {
    event.preventDefault();
    event.returnValue = "";
  });

  initializeApp();
})();



