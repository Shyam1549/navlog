(function () {
  const SUPABASE_URL_KEY = "navlog_supabase_url";
  const SUPABASE_ANON_KEY = "navlog_supabase_anon_key";
  const ADMIN_REMEMBER_KEY = "navlog_admin_remember";
  const ADMIN_EMAIL_KEY = "navlog_admin_email";
  const ADMIN_PASSWORD_KEY = "navlog_admin_password";
  const ANNOUNCEMENT_SEEN_KEY = "navlog_announcement_seen_signature";
  const NAVLOG_KIOSK_PAYLOAD_KEY = "navlog_kiosk_payload_v1";
  const NAVLOG_KIOSK_PAD_KEY = "navlog_kiosk_pad_v1";
  const NAVLOG_PUBLIC_CATALOG_CACHE_KEY = "navlog_public_catalog_cache_v2";
  const NAVLOG_ACCESS_KEY_UNLOCK = "navlog_access_unlocked_v1";
  const NAVLOG_WELCOME_BEHAVIOUR_SEEN = "navlog_welcome_behaviour_seen_v1";
  const NAVLOG_MONTHLY_VISITOR_KEY = "navlog_monthly_visitor_marker";
  const NAVLOG_MONTHLY_VISITOR_COUNT_KEY = "navlog_monthly_visitor_count";
  const UTC_ADMIN_CLICK_WINDOW_MS = 1500;
  const UTC_ADMIN_TOTAL_TIMEOUT_MS = 5000;
  const ADDITIONAL_INFO_DEFAULT_ROWS = 19;
  const ADDITIONAL_INFO_DEFAULT_COLS = 9;
  const AIRPORT_CHARTS_BUCKET = "airport-charts";
  const GPS_STALE_RESTART_MS = 45000;

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
      waypoints: [],
      rpcRegistry: [],
      charts: [],
      content: {
        manualHtml: "",
        privacyHtml: "",
        announcements: [],
        maintenanceMode: false,
        maintenanceText: "under maintenance: service is undergoing maintenance. do not trust.",
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
      waypoints: [],
      rpcRegistry: [],
      charts: [],
      selectedPresetId: "",
      selectedAirportCode: "",
      selectedWaypointName: "",
      selectedRpcRegistration: "",
      presetForm: createEmptyPresetForm(),
      presetManualMode: false,
      waypointForm: createEmptyWaypointForm(),
      rpcRegistryForm: createEmptyRpcRegistryForm(),
      airportForm: createEmptyAirportForm(),
      chartForm: createEmptyChartForm(),
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
      maintenanceTextDraft: "under maintenance: service is undergoing maintenance. do not trust.",
      maintenanceSaveStatus: "",
      panel: "dashboard",
      additionalInfoPanel: "",
      additionalInfoDraft: [],
      additionalInfoSaveStatus: "",
      chartUploadStatus: "",
    },
    meta: {
      hasOpenedSheet: false,
      usingPresetRoute: false,
      lastNonDocView: "setup",
      docBackView: "",
      additionalInfoPanel: "",
      chartAirportQuery: "",
      chartSearchSubmitted: false,
      navlogUnlocked: readStoredValue(NAVLOG_ACCESS_KEY_UNLOCK) === "1",
      accessError: "",
      showWelcomeBehaviourNotice: false,
      activateInfoOpen: false,
      activateGpsEnabled: false,
      kioskRouteEstimate: createEmptyKioskRouteEstimateState(),
      kioskEventTimer: createEmptyKioskEventTimerState(),
      kioskTimerAlerts: createEmptyKioskTimerAlertState(),
      kioskGps: createEmptyKioskGpsState(),
      activateHeadingMode: "tc",
      chartPreview: createEmptyChartPreviewState(),
      gpsPermissionPromptOpen: false,
      routeProgressMarkerSnapshot: null,
      monthlyVisitors: 0,
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
  let kioskPadState = null;
  let viewportFitResizeBound = false;
  let gpsWatchId = null;
  let gpsLastPoint = null;
  let gpsSpeedSamplesKts = [];
  let suggestionMenuState = null;
  let lastRenderedView = "";
  let adminStatusSignature = "";
  let adminStatusClearTimer = null;
  let adminStatusRevealTimer = null;

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
      ch: "",
      ta: "",
      gs: "",
      distance: "",
      ee: "",
      et: "",
      at: "",
      _manual: route ? { route: true } : {},
      _derived: {},
      _errors: {},
      _kioskCreated: false,
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
        tocManual: false,
        todManual: false,
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

  function createEmptyWaypointForm() {
    return {
      rows: [createEmptyWaypointRow()],
    };
  }

  function createEmptyWaypointRow() {
    return {
      name: "",
      aliases: [],
      coord: "",
      _coordAutofilledFromName: false,
    };
  }

  function createEmptyRpcRegistryForm() {
    return {
      rows: [createEmptyRpcRegistryRow()],
    };
  }

  function createEmptyRpcRegistryRow() {
    return {
      registration: "",
      aircraftType: "",
      casClimb: "",
      casCruise: "",
      gph: "",
    };
  }

  function createEmptyKioskRouteEstimateState() {
    return {
      open: false,
      legIndex: -1,
      routeLabel: "",
      routeCode: "",
      direction: "",
      distance: "10",
      groundspeed: "",
      error: "",
      resultLabel: "",
      resultHhmm: "",
      resultMinuteOfDay: null,
    };
  }

  function createEmptyKioskEventTimerState() {
    return [];
  }

  function createEmptyKioskTimerAlertState() {
    return [];
  }

  function createEmptyKioskGpsState() {
    return {
      supported: false,
      tracking: false,
      error: "",
      speedKts: null,
      headingTrue: null,
      latitude: null,
      longitude: null,
      accuracyMeters: null,
      lastFixMs: null,
      speedCellMode: "gs",
      speedCellModeByLeg: {},
      whereAmI: {
        open: false,
        query: "",
        result: null,
        error: "",
      },
    };
  }

  function normalizeActivateRows(addExtraAirportRow = false) {
    normalizeDestinationLegPlacement();
    if (!Array.isArray(state.navlog.radios)) state.navlog.radios = [];
    if (state.navlog.radios.length === 0) state.navlog.radios.push(createBlankRadioRow());
    if (addExtraAirportRow) state.navlog.radios.push(createBlankRadioRow());
  }

  function normalizeDestinationLegPlacement(navlog = state.navlog) {
    const legs = Array.isArray(navlog.legs) ? navlog.legs : [];
    if (legs.length < 2) return;

    const destinationCode = normalizeCode(navlog.setup && navlog.setup.destination);
    let destinationIndex = -1;

    if (destinationCode) {
      for (let index = 0; index < legs.length; index += 1) {
        if (normalizeCode(legs[index] && legs[index].route) === destinationCode) destinationIndex = index;
      }
    }

    if (destinationIndex < 0) {
      for (let index = legs.length - 1; index >= 1; index -= 1) {
        const routeText = String((legs[index] && legs[index].route) || "").trim();
        if (routeText) {
          destinationIndex = index;
          break;
        }
      }
    }

    if (destinationIndex <= 0 || destinationIndex >= (legs.length - 1)) return;
    const [destinationLeg] = legs.splice(destinationIndex, 1);
    legs.push(destinationLeg);
  }

  function buildActivateNavlogSnapshot() {
    autofillAllCoordinateNavigationValues();
    computeRouteMath();
    const snapshot = JSON.parse(JSON.stringify(state.navlog || createBlankNavlog()));
    normalizeDestinationLegPlacement(snapshot);
    snapshot.tocTod = {
      ...createBlankNavlog().tocTod,
      ...(snapshot.tocTod && typeof snapshot.tocTod === "object" ? snapshot.tocTod : {}),
      tocEditing: false,
      todEditing: false,
    };
    if (!Array.isArray(snapshot.radios)) snapshot.radios = [];
    if (Array.isArray(snapshot.legs)) {
      snapshot.legs = snapshot.legs.map((leg) => ({
        ...leg,
        _kioskCreated: false,
      }));
    }
    snapshot.radios.push(createBlankRadioRow());
    return snapshot;
  }

  function createEmptyPresetForm() {
    return {
      departure: "",
      destination: "",
      locked: true,
      rows: [createEmptyPresetRow()],
    };
  }

  function createEmptyPresetRow() {
    return {
      route: "",
      coord: "",
      _manual: {
        coord: false,
      },
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
      legs: Array.isArray(preset.legs)
        ? preset.legs.map((leg) => ({
          route: String(leg && leg.route != null ? leg.route : ""),
          coord: String(leg && (leg.coord ?? leg.coordinates ?? leg.latlon) != null ? (leg.coord ?? leg.coordinates ?? leg.latlon) : ""),
          tc: String(leg && leg.tc != null ? leg.tc : ""),
          distance: String(leg && leg.distance != null ? leg.distance : ""),
        }))
        : [],
    };
  }

  function createEmptyChartForm() {
    return {
      id: "",
      airportCode: "",
      name: "",
      category: "",
      storagePath: "",
    };
  }

  function createEmptyChartPreviewState() {
    return {
      open: false,
      airportCode: "",
      selectedChartId: "",
      viewer: false,
      activateMode: false,
    };
  }

  function cloneWaypointRecord(record) {
    return normalizeWaypointRecord(record);
  }

  function cloneRpcRegistryRecord(record) {
    return normalizeRpcRegistryRecord(record);
  }

  function cloneAirportChartRecord(record) {
    return normalizeAirportChartRecord(record);
  }

  function normalizeWaypointRecord(record) {
    const rawName = String(record && (record.name ?? record.code ?? record.route) != null ? (record.name ?? record.code ?? record.route) : "").trim();
    const nameParts = parseWaypointNameParts(rawName);
    const explicitAliases = Array.isArray(record && record.aliases) ? record.aliases : [];
    return {
      id: String(record && record.id != null ? record.id : ""),
      name: nameParts.primary,
      rawName: nameParts.raw,
      aliases: Array.from(new Set([
        ...nameParts.aliases,
        ...explicitAliases.map((alias) => normalizeCode(alias)),
      ].filter((alias) => alias && alias !== nameParts.primary))),
      coord: String(record && (record.coord ?? record.coordinates ?? record.latlon ?? record.coordinate) != null ? (record.coord ?? record.coordinates ?? record.latlon ?? record.coordinate) : ""),
    };
  }

  function parseWaypointNameParts(value) {
    const raw = String(value || "").trim();
    const parts = raw.split("/").map((part) => normalizeCode(part)).filter(Boolean);
    const primary = parts[0] || "";
    return {
      raw: raw || primary,
      primary,
      aliases: Array.from(new Set(parts.slice(1).filter((part) => part && part !== primary))),
    };
  }

  function formatWaypointStorageName(record) {
    const normalized = normalizeWaypointRecord(record);
    const names = [normalized.name, ...(Array.isArray(normalized.aliases) ? normalized.aliases : [])]
      .map((part) => normalizeCode(part))
      .filter(Boolean);
    return Array.from(new Set(names)).join("/");
  }

  function normalizeRpcRegistryRecord(record) {
    const registration = normalizeCode(record && (record.registration ?? record.rpCNo ?? record.rpc));
    return {
      id: String(record && record.id != null ? record.id : ""),
      registration,
      aircraftType: String(record && (record.aircraftType ?? record.aircraft_type ?? record.aircraft ?? "") || ""),
      casClimb: String(record && (record.casClimb ?? record.cas_climb ?? "") || ""),
      casCruise: String(record && (record.casCruise ?? record.cas_cruise ?? "") || ""),
      gph: String(record && (record.gph ?? record.gph_pph ?? "") || ""),
    };
  }

  function normalizeAirportChartRecord(record) {
    return {
      id: String(record && record.id != null ? record.id : ""),
      airportCode: normalizeCode(record && (record.airportCode ?? record.airport_code ?? record.code)),
      name: String(record && (record.name ?? record.chart_name) != null ? (record.name ?? record.chart_name) : "").trim(),
      category: String(record && (record.category ?? record.chart_category) != null ? (record.category ?? record.chart_category) : "").trim(),
      storagePath: String(record && (record.storagePath ?? record.storage_path) != null ? (record.storagePath ?? record.storage_path) : "").trim(),
    };
  }

  function getAirportChartPublicUrl(record) {
    const chart = normalizeAirportChartRecord(record);
    if (!supabaseClient || !chart.storagePath) return "";
    const result = supabaseClient.storage.from(AIRPORT_CHARTS_BUCKET).getPublicUrl(chart.storagePath);
    return String(result && result.data && result.data.publicUrl ? result.data.publicUrl : "");
  }

  function getChartCategoryOptions(includeAdminDraft = true) {
    const values = new Set();
    const addValue = (value) => {
      const text = String(value || "").trim();
      if (text) values.add(text);
    };
    (Array.isArray(state.catalog.charts) ? state.catalog.charts : []).forEach((chart) => addValue(chart && chart.category));
    (Array.isArray(state.admin.charts) ? state.admin.charts : []).forEach((chart) => addValue(chart && chart.category));
    if (includeAdminDraft) addValue(state.admin && state.admin.chartForm ? state.admin.chartForm.category : "");
    return Array.from(values).sort((left, right) => left.localeCompare(right));
  }

  function getChartsForAirportCode(airportCode) {
    const code = normalizeCode(airportCode);
    if (!code) return [];
    return (Array.isArray(state.catalog.charts) ? state.catalog.charts : [])
      .map((chart) => normalizeAirportChartRecord(chart))
      .filter((chart) => chart.airportCode === code && chart.storagePath)
      .sort((left, right) => {
        const categoryCompare = String(left.category || "").localeCompare(String(right.category || ""));
        if (categoryCompare !== 0) return categoryCompare;
        return String(left.name || "").localeCompare(String(right.name || ""));
      });
  }

  function groupChartsByCategory(charts) {
    const groups = new Map();
    (Array.isArray(charts) ? charts : []).forEach((chart) => {
      const normalized = normalizeAirportChartRecord(chart);
      const key = String(normalized.category || "").trim() || "Uncategorized";
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(normalized);
    });
    return Array.from(groups.entries())
      .sort((left, right) => left[0].localeCompare(right[0]))
      .map(([category, items]) => ({ category, items }));
  }

  function getSuggestionValuesForSource(source) {
    const key = String(source || "").trim().toLowerCase();
    if (key === "waypoints") return getWaypointSuggestionOptions();
    if (key === "airports") return state.catalog.airports.map((airport) => normalizeCode(airport && airport.code)).filter(Boolean).sort();
    if (key === "preset-airports") return collectPresetAirportCodes();
    if (key === "rpc") return getRpcRegistryOptions().map((entry) => entry.registration);
    if (key === "chart-airports") {
      return Array.from(new Set((state.catalog.charts || []).map((chart) => normalizeCode(chart && chart.airportCode)).filter(Boolean))).sort();
    }
    if (key === "chart-categories") return getChartCategoryOptions();
    return [];
  }

  function filterSuggestionValues(values, query) {
    const needle = normalizeCode(query);
    const unique = new Map();
    (Array.isArray(values) ? values : []).forEach((item) => {
      const option = normalizeSuggestionOption(item);
      if (!option.value || unique.has(option.value)) return;
      unique.set(option.value, option);
    });
    const list = Array.from(unique.values());
    if (!needle) return list;
    const prefixMatches = [];
    const containsMatches = [];
    list.forEach((option) => {
      const normalized = normalizeCode(`${option.value} ${option.search}`);
      if (!normalized.includes(needle)) return;
      const primary = normalizeCode(option.value);
      const searchParts = String(option.search || "").split(" ").map((part) => normalizeCode(part)).filter(Boolean);
      if (primary.startsWith(needle) || searchParts.some((part) => part.startsWith(needle))) prefixMatches.push(option);
      else containsMatches.push(option);
    });
    return [...prefixMatches, ...containsMatches];
  }

  function normalizeSuggestionOption(item) {
    if (item && typeof item === "object") {
      const value = String(item.value || item.label || "").trim();
      return {
        value,
        label: String(item.label || value).trim(),
        search: String(item.search || "").trim(),
      };
    }
    const value = String(item || "").trim();
    return { value, label: value, search: "" };
  }

  function getSuggestionCommitValue(item) {
    return normalizeSuggestionOption(item).value;
  }

  function getSuggestionDisplayLabel(item) {
    return normalizeSuggestionOption(item).label;
  }

  function closeSuggestionMenu() {
    if (suggestionMenuState && suggestionMenuState.menu && suggestionMenuState.menu.parentNode) {
      suggestionMenuState.menu.parentNode.removeChild(suggestionMenuState.menu);
    }
    suggestionMenuState = null;
  }

  function ensureSuggestionMenu() {
    if (suggestionMenuState && suggestionMenuState.menu && suggestionMenuState.menu.parentNode) return suggestionMenuState.menu;
    const menu = document.createElement("div");
    menu.className = "suggestion-menu";
    document.body.appendChild(menu);
    if (!document.body.dataset.suggestionPointerBound) {
      document.body.dataset.suggestionPointerBound = "1";
      document.addEventListener("pointerdown", (event) => {
        const target = event.target;
        if (!suggestionMenuState) return;
        if (target === suggestionMenuState.input) return;
        if (target && target.closest && target.closest(".suggestion-menu")) return;
        closeSuggestionMenu();
      });
    }
    suggestionMenuState = { ...(suggestionMenuState || {}), menu, activeIndex: -1, values: [] };
    return menu;
  }

  function positionSuggestionMenu(input, menu) {
    const rect = input.getBoundingClientRect();
    menu.style.left = `${Math.round(window.scrollX + rect.left)}px`;
    menu.style.top = `${Math.round(window.scrollY + rect.bottom + 6)}px`;
    menu.style.width = `${Math.max(180, Math.round(rect.width))}px`;
  }

  function commitSuggestionValue(input, value) {
    if (!input) return;
    input.value = getSuggestionCommitValue(value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
    closeSuggestionMenu();
  }

  function renderSuggestionMenu(input) {
    const source = input ? input.getAttribute("data-suggest-source") : "";
    if (!source) {
      closeSuggestionMenu();
      return;
    }
    const query = String(input.value || "");
    const showOnFocus = input.getAttribute("data-suggest-open-on-focus") === "true";
    if (!showOnFocus && !query.trim()) {
      closeSuggestionMenu();
      return;
    }
    const values = filterSuggestionValues(getSuggestionValuesForSource(source), query);
    if (!values.length) {
      closeSuggestionMenu();
      return;
    }
    const menu = ensureSuggestionMenu();
    suggestionMenuState = { menu, input, values, activeIndex: -1 };
    menu.innerHTML = values.map((value, index) => `
      <button class="suggestion-option" data-suggestion-index="${index}" type="button">${escapeHtml(getSuggestionDisplayLabel(value))}</button>
    `).join("");
    positionSuggestionMenu(input, menu);
    Array.from(menu.querySelectorAll("[data-suggestion-index]")).forEach((button) => {
      button.addEventListener("mousedown", (event) => {
        event.preventDefault();
        const rawIndex = Number(button.getAttribute("data-suggestion-index"));
        const nextValue = suggestionMenuState && Number.isFinite(rawIndex) ? suggestionMenuState.values[rawIndex] : "";
        commitSuggestionValue(input, nextValue);
      });
    });
  }

  function moveSuggestionSelection(direction) {
    if (!suggestionMenuState || !Array.isArray(suggestionMenuState.values) || !suggestionMenuState.values.length) return;
    const total = suggestionMenuState.values.length;
    const nextIndex = suggestionMenuState.activeIndex < 0
      ? (direction > 0 ? 0 : total - 1)
      : (suggestionMenuState.activeIndex + direction + total) % total;
    suggestionMenuState.activeIndex = nextIndex;
    const menu = suggestionMenuState.menu;
    Array.from(menu.querySelectorAll("[data-suggestion-index]")).forEach((button, index) => {
      button.classList.toggle("active", index === nextIndex);
    });
  }

  function wireSuggestionInputs() {
    document.querySelectorAll("[data-suggest-source]").forEach((input) => {
      input.setAttribute("autocomplete", "off");
      if (!input.hasAttribute("spellcheck")) input.setAttribute("spellcheck", "false");
      input.addEventListener("focus", () => {
        renderSuggestionMenu(input);
      });
      input.addEventListener("input", () => {
        renderSuggestionMenu(input);
      });
      input.addEventListener("keydown", (event) => {
        if (event.key === "ArrowDown") {
          event.preventDefault();
          renderSuggestionMenu(input);
          moveSuggestionSelection(1);
          return;
        }
        if (event.key === "ArrowUp") {
          event.preventDefault();
          renderSuggestionMenu(input);
          moveSuggestionSelection(-1);
          return;
        }
        if (event.key === "Enter" && suggestionMenuState && suggestionMenuState.input === input && suggestionMenuState.activeIndex >= 0) {
          event.preventDefault();
          commitSuggestionValue(input, suggestionMenuState.values[suggestionMenuState.activeIndex]);
          return;
        }
        if (event.key === "Escape") closeSuggestionMenu();
      });
      input.addEventListener("blur", () => {
        window.setTimeout(() => {
          if (suggestionMenuState && suggestionMenuState.input === input) closeSuggestionMenu();
        }, 120);
      });
    });
  }

  function openChartPreviewModal(airportCode = "", chartId = "", options = {}) {
    const activateMode = Object.prototype.hasOwnProperty.call(options, "activateMode") ? Boolean(options.activateMode) : state.view === "ipad-kiosk";
    const code = normalizeCode(activateMode && !chartId ? airportCode : (airportCode || state.meta.chartAirportQuery || state.meta.chartPreview.airportCode));
    const charts = getChartsForAirportCode(code);
    const selected = charts.find((chart) => chart.id === String(chartId || "")) || charts[0] || null;
    state.meta.chartPreview = {
      open: true,
      airportCode: code,
      selectedChartId: selected ? selected.id : "",
      viewer: Object.prototype.hasOwnProperty.call(options, "viewer") ? Boolean(options.viewer) : Boolean(chartId),
      activateMode,
    };
    render();
  }

  function closeChartPreviewModal() {
    state.meta.chartPreview = createEmptyChartPreviewState();
    render();
  }

  function openChartInNewTab(chart) {
    const url = getAirportChartPublicUrl(chart);
    if (!url) return;
    const opened = window.open(url, "_blank", "noopener,noreferrer");
    if (opened && typeof opened.focus === "function") opened.focus();
  }

  function getRouteEndpointChartAirportCodes(navlog = state.navlog) {
    const codes = new Set();
    const setup = navlog && navlog.setup ? navlog.setup : {};
    [setup.departure, setup.destination].forEach((value) => {
      const code = normalizeCode(value);
      if (code) codes.add(code);
    });
    return Array.from(codes);
  }

  function warmAirportChartsForActivate(navlog = state.navlog) {
    const urls = [];
    getRouteEndpointChartAirportCodes(navlog).forEach((airportCode) => {
      getChartsForAirportCode(airportCode).forEach((chart) => {
        const url = getAirportChartPublicUrl(chart);
        if (url) urls.push(url);
      });
    });
    Array.from(new Set(urls)).forEach((url) => {
      fetch(url, { mode: "no-cors", cache: "reload" }).catch(() => {
        // Best-effort offline warmup only.
      });
    });
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

  function parseHemisphericCoordinateToken(rawToken, kind) {
    const text = String(rawToken || "").trim().toUpperCase();
    if (!text) return null;
    let hemisphere = "";
    let numericText = text;
    if (/^[NSEW]/.test(numericText)) {
      hemisphere = numericText[0];
      numericText = numericText.slice(1);
    }
    if (/[NSEW]$/.test(numericText)) {
      hemisphere = numericText.slice(-1);
      numericText = numericText.slice(0, -1);
    }
    numericText = numericText.replaceAll("°", " ").replaceAll("'", " ").replaceAll("\"", " ").replace(/\s+/g, " ").trim();
    if (!numericText) return null;

    let value = null;
    const parts = numericText.split(" ").filter(Boolean);
    if (parts.length >= 2) {
      const deg = Number(parts[0]);
      const minutes = Number(parts[1]);
      const seconds = Number(parts[2] || 0);
      if (Number.isFinite(deg) && Number.isFinite(minutes) && Number.isFinite(seconds)) {
        value = Math.abs(deg) + (Math.abs(minutes) / 60) + (Math.abs(seconds) / 3600);
      }
    }
    if (value == null) {
      const numeric = Number(numericText);
      if (!Number.isFinite(numeric)) return null;
      value = numeric;
      if (/^\d{4,}(\.\d+)?$/.test(numericText)) {
        const abs = Math.abs(numeric);
        const degrees = Math.floor(abs / 100);
        const minutes = abs - (degrees * 100);
        if (minutes < 60) value = degrees + (minutes / 60);
      }
    }

    const normalizedKind = kind === "lat" ? "lat" : "lon";
    let signed = Number(value);
    if (hemisphere) {
      if (hemisphere === "S" || hemisphere === "W") signed *= -1;
      if (hemisphere === "N" || hemisphere === "E") signed = Math.abs(signed);
    }
    if (normalizedKind === "lat") {
      if (signed < -90 || signed > 90) return null;
    } else if (signed < -180 || signed > 180) {
      return null;
    }
    return signed;
  }

  function parseWaypointCoordinate(rawValue) {
    const text = String(rawValue || "").trim();
    if (!text) return null;
    const compact = text.replace(/\s+/g, " ").trim();

    const decimalPair = compact.match(/^\s*([+-]?\d+(?:\.\d+)?)\s*[, ]\s*([+-]?\d+(?:\.\d+)?)\s*$/);
    if (decimalPair) {
      const lat = Number(decimalPair[1]);
      const lon = Number(decimalPair[2]);
      if (Number.isFinite(lat) && Number.isFinite(lon) && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180) {
        return { lat, lon };
      }
    }

    const parts = compact.split(/[, ]+/).filter(Boolean);
    if (parts.length >= 2) {
      const lat = parseHemisphericCoordinateToken(parts[0], "lat");
      const lon = parseHemisphericCoordinateToken(parts[1], "lon");
      if (lat != null && lon != null) return { lat, lon };
    }

    const merged = compact.toUpperCase().replace(/\s+/g, "");
    const mergedMatch = merged.match(/^([NS]?[0-9.]+[NS]?)([EW]?[0-9.]+[EW]?)$/);
    if (mergedMatch) {
      const lat = parseHemisphericCoordinateToken(mergedMatch[1], "lat");
      const lon = parseHemisphericCoordinateToken(mergedMatch[2], "lon");
      if (lat != null && lon != null) return { lat, lon };
    }

    return null;
  }

  function buildWaypointDataCatalog() {
    const catalog = new Map();
    const addEntry = (name, coordRaw = "", extraAliases = []) => {
      const nameParts = parseWaypointNameParts(name);
      const code = nameParts.primary;
      if (!code) return;
      const current = catalog.get(code) || { code, hasCoords: false, coordText: "", lat: null, lon: null };
      const nextCoordRaw = String(coordRaw || "").trim();
      const aliases = Array.from(new Set([
        ...(current.aliases || []),
        ...nameParts.aliases,
        ...(Array.isArray(extraAliases) ? extraAliases : []),
      ].map((alias) => normalizeCode(alias)).filter((alias) => alias && alias !== code)));
      if (!nextCoordRaw) {
        if (!catalog.has(code)) catalog.set(code, { ...current, aliases });
        return;
      }
      const parsed = parseWaypointCoordinate(nextCoordRaw);
      if (!parsed) {
        if (!catalog.has(code)) catalog.set(code, { ...current, aliases });
        return;
      }
      catalog.set(code, {
        code,
        aliases,
        hasCoords: true,
        lat: parsed.lat,
        lon: parsed.lon,
        coordText: nextCoordRaw,
      });
    };

    const waypointRows = Array.isArray(state.catalog.waypoints) ? state.catalog.waypoints : [];
    waypointRows.forEach((row) => addEntry(row && row.name, row && row.coord, row && row.aliases));
    const adminWaypointRows = Array.isArray(state.admin && state.admin.waypointForm && state.admin.waypointForm.rows)
      ? state.admin.waypointForm.rows
      : [];
    adminWaypointRows.forEach((row) => addEntry(row && row.name, row && row.coord, row && row.aliases));

    const presets = Array.isArray(state.catalog.routePresets) ? state.catalog.routePresets : [];
    presets.forEach((preset) => {
      const legs = Array.isArray(preset && preset.legs) ? preset.legs : [];
      legs.forEach((leg) => addEntry(leg && leg.route, leg && (leg.coord ?? leg.coordinates ?? leg.latlon ?? leg.coordinate ?? "")));
    });

    const navlogLegs = Array.isArray(state.navlog && state.navlog.legs) ? state.navlog.legs : [];
    navlogLegs.forEach((leg) => addEntry(leg && leg.route, leg && (leg.coord ?? leg.coordinates ?? leg.latlon ?? leg.coordinate ?? "")));

    const withAliases = new Map(catalog);
    catalog.forEach((entry) => {
      (entry.aliases || []).forEach((alias) => {
        if (!alias || withAliases.has(alias)) return;
        withAliases.set(alias, { ...entry, aliasFor: entry.code });
      });
    });
    return withAliases;
  }

  function buildWaypointCoordinateCatalog() {
    const catalog = new Map();
    buildWaypointDataCatalog().forEach((entry, code) => {
      if (!entry || !entry.hasCoords) return;
      catalog.set(code, {
        code,
        lat: entry.lat,
        lon: entry.lon,
        coordText: entry.coordText,
      });
    });
    return catalog;
  }

  function getWaypointCoordinate(routeText) {
    const code = normalizeCode(routeText);
    if (!code) return null;
    const catalog = buildWaypointCoordinateCatalog();
    return catalog.get(code) || null;
  }

  function getWaypointData(routeText) {
    const code = normalizeCode(routeText);
    if (!code) return null;
    return buildWaypointDataCatalog().get(code) || null;
  }

  function isRecognizedRoute(routeText) {
    const code = normalizeCode(routeText);
    if (!code) return false;
    const data = getWaypointData(code);
    return Boolean(data && data.hasCoords);
  }

  function getWaypointCodesForSuggestions() {
    return Array.from(buildWaypointDataCatalog().values())
      .filter((entry) => entry && !entry.aliasFor)
      .map((entry) => entry.code)
      .filter(Boolean)
      .sort();
  }

  function getWaypointSuggestionOptions() {
    return Array.from(buildWaypointDataCatalog().values())
      .filter((entry) => entry && !entry.aliasFor && entry.code)
      .map((entry) => ({
        value: entry.code,
        label: entry.code,
        search: (entry.aliases || []).join(" "),
      }))
      .sort((left, right) => left.value.localeCompare(right.value));
  }

  function getWaypointPickerOptions() {
    return Array.from(buildWaypointDataCatalog().values())
      .filter((entry) => entry && !entry.aliasFor)
      .map((entry) => ({
        code: String(entry.code || ""),
        hasCoords: Boolean(entry.hasCoords),
        coordText: String(entry.coordText || ""),
      }))
      .filter((entry) => entry.code)
      .sort((left, right) => left.code.localeCompare(right.code));
  }

  function getRpcRegistryData() {
    const catalog = new Map();
    const addEntry = (record, source = "") => {
      const normalized = normalizeRpcRegistryRecord(record);
      if (!normalized.registration) return;
      const current = catalog.get(normalized.registration) || {};
      catalog.set(normalized.registration, {
        ...current,
        id: normalized.id || current.id || normalized.registration,
        registration: normalized.registration,
        aircraftType: normalized.aircraftType || current.aircraftType || "",
        casClimb: normalized.casClimb || current.casClimb || "",
        casCruise: normalized.casCruise || current.casCruise || "",
        gph: normalized.gph || current.gph || "",
        source,
      });
    };

    (Array.isArray(state.catalog.rpcRegistry) ? state.catalog.rpcRegistry : []).forEach((record) => addEntry(record, "catalog"));
    (Array.isArray(state.admin.rpcRegistry) ? state.admin.rpcRegistry : []).forEach((record) => addEntry(record, "admin"));
    (Array.isArray(state.admin && state.admin.rpcRegistryForm && state.admin.rpcRegistryForm.rows) ? state.admin.rpcRegistryForm.rows : [])
      .forEach((record) => addEntry(record, "form"));
    return catalog;
  }

  function getRpcRegistryRecord(rpcValue) {
    const key = normalizeCode(rpcValue);
    if (!key) return null;
    return getRpcRegistryData().get(key) || null;
  }

  function getRpcRegistryOptions() {
    return Array.from(getRpcRegistryData().values())
      .map((entry) => ({
        registration: String(entry.registration || ""),
        hasValues: Boolean(entry.aircraftType || entry.casClimb || entry.casCruise || entry.gph),
        aircraftType: String(entry.aircraftType || ""),
      }))
      .filter((entry) => entry.registration)
      .sort((left, right) => left.registration.localeCompare(right.registration));
  }

  function renderAdminWaypointPickerMenu() {
    return getWaypointPickerOptions()
      .map((entry) => {
        const label = entry.hasCoords ? entry.code : `${entry.code} - missing coords`;
        return `<button type="button" class="admin-code-picker-option${entry.hasCoords ? "" : " missing"}" data-admin-waypoint-pick="${escapeAttr(entry.code)}">${escapeHtml(label)}</button>`;
      })
      .join("");
  }

  function renderAdminRpcPickerMenu() {
    return getRpcRegistryOptions()
      .map((entry) => {
        const label = entry.hasValues ? `${entry.registration} - ${entry.aircraftType || "Unassigned"}` : `${entry.registration} - unassigned`;
        return `<button type="button" class="admin-code-picker-option${entry.hasValues ? "" : " missing"}" data-admin-rpc-pick="${escapeAttr(entry.registration)}">${escapeHtml(label)}</button>`;
      })
      .join("");
  }

  function shouldTreatDistanceAsAutofill(leg) {
    if (!leg || !leg._manual) return true;
    if (!leg._manual.distance) return true;
    return leg._distanceAutofillFromCoords === true;
  }

  function shouldTreatTrueCourseAsAutofill(leg) {
    if (!leg || !leg._manual) return true;
    if (!leg._manual.tc) return true;
    return leg._tcAutofillFromCoords === true;
  }

  function autofillDistanceBetweenWaypoints(distanceLegIndex) {
    const legIndex = Number(distanceLegIndex);
    if (!Number.isFinite(legIndex) || legIndex <= 0 || legIndex >= state.navlog.legs.length) return false;
    const targetLeg = state.navlog.legs[legIndex];
    if (!targetLeg || !shouldTreatDistanceAsAutofill(targetLeg)) return false;
    const fromRoute = state.navlog.legs[legIndex - 1] ? state.navlog.legs[legIndex - 1].route : "";
    const toRoute = targetLeg.route;
    const fromCoord = getWaypointCoordinate(fromRoute);
    const toCoord = getWaypointCoordinate(toRoute);
    if (!fromCoord || !toCoord) {
      if (targetLeg._distanceAutofillFromCoords === true) {
        targetLeg.distance = "";
        targetLeg._manual = targetLeg._manual || {};
        targetLeg._manual.distance = false;
        targetLeg._distanceAutofillFromCoords = false;
        return true;
      }
      return false;
    }
    const distanceNm = computeGreatCircleDistanceNm(fromCoord.lat, fromCoord.lon, toCoord.lat, toCoord.lon);
    if (!Number.isFinite(distanceNm) || distanceNm <= 0) return false;
    targetLeg.distance = formatDistanceDisplay(distanceNm);
    targetLeg._manual = targetLeg._manual || {};
    targetLeg._manual.distance = true;
    targetLeg._distanceAutofillFromCoords = true;
    return true;
  }

  function autofillTrueCourseBetweenWaypoints(courseLegIndex) {
    const legIndex = Number(courseLegIndex);
    if (!Number.isFinite(legIndex) || legIndex <= 0 || legIndex >= state.navlog.legs.length) return false;
    const targetLeg = state.navlog.legs[legIndex];
    if (!targetLeg || !shouldTreatTrueCourseAsAutofill(targetLeg)) return false;
    const fromRoute = state.navlog.legs[legIndex - 1] ? state.navlog.legs[legIndex - 1].route : "";
    const toRoute = targetLeg.route;
    const fromCoord = getWaypointCoordinate(fromRoute);
    const toCoord = getWaypointCoordinate(toRoute);
    if (!fromCoord || !toCoord) {
      if (targetLeg._tcAutofillFromCoords === true) {
        targetLeg.tc = "";
        targetLeg._manual = targetLeg._manual || {};
        targetLeg._manual.tc = false;
        targetLeg._tcAutofillFromCoords = false;
        return true;
      }
      return false;
    }
    const trueCourse = computeInitialTrueBearing(fromCoord.lat, fromCoord.lon, toCoord.lat, toCoord.lon);
    if (!Number.isFinite(trueCourse)) return false;
    targetLeg.tc = formatHeadingDisplay(trueCourse);
    targetLeg._manual = targetLeg._manual || {};
    targetLeg._manual.tc = true;
    targetLeg._tcAutofillFromCoords = true;
    return true;
  }

  function applyCoordinateDistanceAutofillAroundRoute(routeIndex) {
    const index = Number(routeIndex);
    if (!Number.isFinite(index)) return false;
    const changedCurrent = autofillDistanceBetweenWaypoints(index);
    const changedNext = autofillDistanceBetweenWaypoints(index + 1);
    return changedCurrent || changedNext;
  }

  function applyCoordinateCourseAutofillAroundRoute(routeIndex) {
    const index = Number(routeIndex);
    if (!Number.isFinite(index)) return false;
    const changedCurrent = autofillTrueCourseBetweenWaypoints(index);
    const changedNext = autofillTrueCourseBetweenWaypoints(index + 1);
    return changedCurrent || changedNext;
  }

  function applyCoordinateAutofillAroundRoute(routeIndex) {
    const changedDistance = applyCoordinateDistanceAutofillAroundRoute(routeIndex);
    const changedCourse = applyCoordinateCourseAutofillAroundRoute(routeIndex);
    return changedDistance || changedCourse;
  }

  function autofillAllCoordinateDistances() {
    if (!Array.isArray(state.navlog.legs) || state.navlog.legs.length < 2) return;
    for (let index = 1; index < state.navlog.legs.length; index += 1) {
      autofillDistanceBetweenWaypoints(index);
    }
  }

  function autofillAllCoordinateCourses() {
    if (!Array.isArray(state.navlog.legs) || state.navlog.legs.length < 2) return;
    for (let index = 1; index < state.navlog.legs.length; index += 1) {
      autofillTrueCourseBetweenWaypoints(index);
    }
  }

  function autofillAllCoordinateNavigationValues() {
    autofillAllCoordinateDistances();
    autofillAllCoordinateCourses();
  }

  function computeGreatCircleDistanceNm(fromLatDeg, fromLonDeg, toLatDeg, toLonDeg) {
    const toRad = (value) => value * Math.PI / 180;
    const lat1 = toRad(Number(fromLatDeg));
    const lon1 = toRad(Number(fromLonDeg));
    const lat2 = toRad(Number(toLatDeg));
    const lon2 = toRad(Number(toLonDeg));
    if (![lat1, lon1, lat2, lon2].every((value) => Number.isFinite(value))) return null;
    const dLat = lat2 - lat1;
    const dLon = lon2 - lon1;
    const a = (Math.sin(dLat / 2) ** 2) + (Math.cos(lat1) * Math.cos(lat2) * (Math.sin(dLon / 2) ** 2));
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const earthRadiusNm = 3440.065;
    return earthRadiusNm * c;
  }

  function computeInitialTrueBearing(fromLatDeg, fromLonDeg, toLatDeg, toLonDeg) {
    const toRad = (value) => value * Math.PI / 180;
    const toDeg = (value) => value * 180 / Math.PI;
    const lat1 = toRad(Number(fromLatDeg));
    const lat2 = toRad(Number(toLatDeg));
    const deltaLon = toRad(Number(toLonDeg) - Number(fromLonDeg));
    if (![lat1, lat2, deltaLon].every((value) => Number.isFinite(value))) return null;
    const y = Math.sin(deltaLon) * Math.cos(lat2);
    const x = (Math.cos(lat1) * Math.sin(lat2)) - (Math.sin(lat1) * Math.cos(lat2) * Math.cos(deltaLon));
    const bearing = toDeg(Math.atan2(y, x));
    return normalizeAngle(bearing);
  }

  function bearingToCompass16(bearingDegrees) {
    const value = Number(bearingDegrees);
    if (!Number.isFinite(value)) return "";
    const labels = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
    const index = Math.floor(((normalizeAngle(value) + 11.25) % 360) / 22.5);
    return labels[index % 16];
  }

  function render() {
    const viewChanged = state.view !== lastRenderedView;
    captureViewScrollState();
    closeSuggestionMenu();
    prepareAdminStatusForRender();
    if (state.view !== "ipad-kiosk") document.body.classList.remove("kiosk-mode");
    document.body.classList.remove("kiosk-phone-mode");
    document.body.classList.remove("ipad-desktop-scale");
    document.body.classList.remove("iphone-navlog-vd-mode");
    document.body.classList.toggle(
      "kiosk-modal-scroll-lock",
      state.view === "ipad-kiosk" && Boolean(
        state.meta?.kioskRouteEstimate?.open
        || (Array.isArray(state.meta?.kioskTimerAlerts) && state.meta.kioskTimerAlerts.length > 0)
        || state.meta?.kioskGps?.whereAmI?.open
        || state.meta?.gpsPermissionPromptOpen
        || state.meta?.chartPreview?.open,
      ),
    );
    document.body.classList.toggle("iphone-ui", isIphoneDevice());
    if (isIpadDevice() && (state.view === "navlog" || state.view === "ipad-kiosk")) {
      document.body.classList.add("ipad-desktop-scale");
    }
    if (isPhoneActivateMode()) document.body.classList.add("kiosk-phone-mode");
    if (state.view === "navlog" && isIphoneDevice() && state.settings.variationDeviationEnabled) {
      document.body.classList.add("iphone-navlog-vd-mode");
    }
    evaluateAnnouncementsPrompt();
    computeRouteMath();
    if (state.view === "access") app.innerHTML = renderAccessScreen();
    else if (state.view === "setup") app.innerHTML = renderSetupScreen();
    else if (state.view === "manual") app.innerHTML = renderManualScreen();
    else if (state.view === "privacy") app.innerHTML = renderPrivacyScreen();
    else if (state.view === "additional-info") app.innerHTML = renderAdditionalInfoScreen();
    else if (state.view === "admin-login") app.innerHTML = renderAdminLoginScreen();
    else if (state.view === "admin") app.innerHTML = renderAdminScreen();
    else if (state.view === "ipad-kiosk") app.innerHTML = renderIpadKioskScreen();
    else app.innerHTML = renderNavlogScreen();
    startUtcClock();
    if (state.view === "access") wireAccess();
    else if (state.view === "setup") wireSetup();
    else if (state.view === "manual") wireManual();
    else if (state.view === "privacy") wirePrivacy();
    else if (state.view === "additional-info") wireAdditionalInfo();
    else if (state.view === "admin-login") wireAdminLogin();
    else if (state.view === "admin") wireAdminPanel();
    else if (state.view === "ipad-kiosk") wireIpadKiosk();
    else wireNavlog();
    wireSuggestionInputs();
    wireChartPreviewControls();
    if (viewChanged) {
      lastRenderedView = state.view;
      if (!(state.view === "navlog" && state.meta && state.meta.viewScrollState)) {
        scrollCurrentViewToTop();
      }
    }
    if (state.view === "ipad-kiosk") {
      syncKioskGpsTrackingForView();
      return;
    }
    syncKioskGpsTrackingForView();
    restoreViewScrollState();
    wireUtcAdminTrigger();
    wireFooterActions();
    wireBugReportModal();
    wireAnnouncementModal();
    if (state.view === "manual") typesetManualMath();
  }

  function getAdminStatusSignature() {
    if (!state.admin) return "";
    const type = state.admin.error ? "error" : (state.admin.notice ? "notice" : "");
    const text = state.admin.error || state.admin.notice || "";
    return type && text ? `${type}:${text}` : "";
  }

  function prepareAdminStatusForRender() {
    const signature = getAdminStatusSignature();
    if (!signature) {
      adminStatusSignature = "";
      state.meta.adminStatusVisible = true;
      if (adminStatusClearTimer) clearTimeout(adminStatusClearTimer);
      if (adminStatusRevealTimer) clearTimeout(adminStatusRevealTimer);
      adminStatusClearTimer = null;
      adminStatusRevealTimer = null;
      return;
    }
    if (signature !== adminStatusSignature) {
      const hadStatus = Boolean(adminStatusSignature);
      adminStatusSignature = signature;
      if (adminStatusClearTimer) clearTimeout(adminStatusClearTimer);
      if (adminStatusRevealTimer) clearTimeout(adminStatusRevealTimer);
      adminStatusClearTimer = null;
      adminStatusRevealTimer = null;
      if (hadStatus) {
        state.meta.adminStatusVisible = false;
        adminStatusRevealTimer = setTimeout(() => {
          state.meta.adminStatusVisible = true;
          scheduleAdminStatusClear(signature);
          render();
        }, 60);
      } else {
        state.meta.adminStatusVisible = true;
        scheduleAdminStatusClear(signature);
      }
    }
  }

  function scheduleAdminStatusClear(signature) {
    if (adminStatusClearTimer) clearTimeout(adminStatusClearTimer);
    adminStatusClearTimer = setTimeout(() => {
      if (getAdminStatusSignature() !== signature) return;
      state.admin.error = "";
      state.admin.notice = "";
      adminStatusSignature = "";
      state.meta.adminStatusVisible = true;
      render();
    }, 1500);
  }

  function scrollCurrentViewToTop() {
    requestAnimationFrame(() => {
      try {
        window.scrollTo({ top: 0, left: 0, behavior: "auto" });
      } catch {
        window.scrollTo(0, 0);
      }
      document.querySelectorAll(".sheet-wrap, .additional-info-wrap").forEach((node) => {
        node.scrollTop = 0;
        node.scrollLeft = 0;
      });
    });
  }

  function captureViewScrollState() {
    if (state.view !== "navlog" || !isIphoneDevice()) return;
    const wrap = document.querySelector(".sheet-wrap");
    if (!wrap) return;
    state.meta.viewScrollState = {
      view: "navlog",
      sheetWrap: {
        left: wrap.scrollLeft,
        top: wrap.scrollTop,
      },
    };
  }

  function restoreViewScrollState() {
    const snapshot = state.meta && state.meta.viewScrollState ? state.meta.viewScrollState : null;
    if (!snapshot || snapshot.view !== "navlog" || state.view !== "navlog" || !isIphoneDevice()) return;
    const apply = () => {
      const wrap = document.querySelector(".sheet-wrap");
      if (!wrap) return;
      wrap.scrollLeft = Number(snapshot.sheetWrap && snapshot.sheetWrap.left) || 0;
      wrap.scrollTop = Number(snapshot.sheetWrap && snapshot.sheetWrap.top) || 0;
    };
    requestAnimationFrame(() => {
      apply();
      requestAnimationFrame(apply);
    });
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
      showDistanceToGo: true,
      variationDeviationEnabled: false,
      pdfLayout: "default",
    };
  }

  function renderSetupScreen() {
    const presetStatus = getPresetStatusMarkup();
    const showResume = shouldShowResumeButton();
    const welcomeBehaviourNotice = state.meta.showWelcomeBehaviourNotice
      ? '<p class="welcome-behaviour-note">Welcome to Navlog. Please read "Navlog Behaviours" in the User Manual before proceeding.</p>'
      : "";
    const maintenanceBanner = state.catalog.content.maintenanceMode
      ? `<p class="maintenance-warning">${escapeHtml(state.catalog.content.maintenanceText || "under maintenance: service is undergoing maintenance. do not trust.")}</p>`
      : "";
    return `
      <div class="ui-scale">
      <main class="entry-page">
        <section class="entry-hero entry-hero-centered">
          <div class="top-center">
            <h1>Navlog</h1>
            <div class="utc-pill" id="utc-clock">UTC ${formatUtcNow()}</div>
            <p class="setup-caption">Enter your DEP and ARR aerodrome.</p>
            ${welcomeBehaviourNotice}
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
            <div class="bug-report-field">
              <label for="bug-report-message">What went wrong?</label>
              <textarea id="bug-report-message" maxlength="2000" required placeholder="Describe what happened and how to reproduce it."></textarea>
            </div>
            <div class="bug-report-field">
              <label for="bug-report-email">Your email (optional)</label>
              <input id="bug-report-email" type="email" maxlength="200" placeholder="you@example.com" />
            </div>
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

  function renderBackButton(id, ariaLabel = "Back", extraClass = "") {
    const className = ["back-link", extraClass].filter(Boolean).join(" ");
    return `
      <button class="${className}" id="${id}" type="button" aria-label="${escapeAttr(ariaLabel)}">
        <span class="back-link-icon" aria-hidden="true">&#8592;</span>
      </button>
    `;
  }

  function renderLockGlyph(locked) {
    if (locked) {
      return `
        <svg class="admin-lock-glyph" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M7.75 10.25V7.75a4.25 4.25 0 1 1 8.5 0v2.5"></path>
          <path d="M7 10.25h10a1.75 1.75 0 0 1 1.75 1.75v6a1.75 1.75 0 0 1-1.75 1.75H7A1.75 1.75 0 0 1 5.25 18v-6A1.75 1.75 0 0 1 7 10.25Z"></path>
          <path d="M12 14v2.8"></path>
        </svg>
      `;
    }
    return `
      <svg class="admin-lock-glyph" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M9 10.25V8.4a4.25 4.25 0 0 1 7.28-3"></path>
        <path d="M16.25 5.4 18.1 3.55"></path>
        <path d="M7 10.25h10a1.75 1.75 0 0 1 1.75 1.75v6A1.75 1.75 0 0 1 17 19.75H7A1.75 1.75 0 0 1 5.25 18v-6A1.75 1.75 0 0 1 7 10.25Z"></path>
        <path d="M12 14v2.8"></path>
        </svg>
    `;
  }

  function renderChartPreviewModal() {
    const model = state.meta && state.meta.chartPreview ? state.meta.chartPreview : createEmptyChartPreviewState();
    if (!model.open) return "";
    const airportCode = normalizeCode(model.airportCode);
    const charts = getChartsForAirportCode(airportCode);
    const groupedCharts = groupChartsByCategory(charts);
    const selectedChart = charts.find((chart) => chart.id === String(model.selectedChartId || "")) || charts[0] || null;
    const selectedUrl = selectedChart ? getAirportChartPublicUrl(selectedChart) : "";
    const frameUrl = selectedUrl ? `${selectedUrl}#toolbar=0&navpanes=0&scrollbar=0&view=FitH&zoom=page-width` : "";
    if (model.viewer) {
      return `
        <div class="chart-fullscreen-overlay" id="chart-preview-overlay">
          <section class="chart-fullscreen-viewer" role="dialog" aria-modal="true" aria-label="Chart preview">
            ${
              frameUrl
                ? `<iframe class="chart-fullscreen-frame" title="${escapeAttr(selectedChart ? selectedChart.name || "Chart preview" : "Chart preview")}" src="${escapeAttr(frameUrl)}"></iframe>`
                : '<p class="chart-search-message">Chart preview unavailable.</p>'
            }
          </section>
        </div>
      `;
    }
    return `
      <div class="bug-report-overlay" id="chart-preview-overlay">
        <section class="bug-report-modal chart-preview-modal" role="dialog" aria-modal="true" aria-label="Chart preview">
          <div class="bug-report-head">
            <h3>Charts</h3>
            <button class="action bug-report-close" id="chart-preview-close" type="button">Close</button>
          </div>
          <section class="chart-search-card chart-search-card-modal">
            <label class="setup-field chart-search-field">
              <span>Airport code</span>
              <input id="chart-preview-airport-search" value="${escapeAttr(airportCode)}" autocomplete="off" inputmode="text" autocapitalize="characters" spellcheck="false" data-suggest-source="chart-airports" data-suggest-open-on-focus="true" />
            </label>
            <button class="action primary" id="chart-preview-search-button" type="button">Search</button>
          </section>
          <div class="chart-preview-simple">
            <div class="chart-preview-list chart-preview-list-simple" aria-live="polite">
              ${
                !airportCode
                  ? ""
                  : !groupedCharts.length
                    ? `<p class="chart-search-message error">No charts are available for ${escapeHtml(airportCode)}.</p>`
                    : groupedCharts.map((group) => `
                      <section class="chart-preview-group">
                        ${group.category ? `<h4>${escapeHtml(group.category)}</h4>` : ""}
                        ${group.items.map((chart) => `
                          <button class="chart-preview-select${selectedChart && selectedChart.id === chart.id ? " active" : ""}" data-chart-preview-select="${escapeAttr(chart.id)}" type="button">
                            <span>${escapeHtml(chart.category || chart.airportCode || "Chart")}</span>
                            <strong>${escapeHtml(chart.name || "Airport chart")}</strong>
                            ${model.activateMode ? "" : '<small>Preview</small>'}
                          </button>
                        `).join("")}
                      </section>
                    `).join("")
              }
            </div>
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
          <div class="top-side">${renderBackButton("back-from-manual", "Back to setup")}</div>
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
          <div class="top-side">${renderBackButton("back-from-privacy", "Back to setup")}</div>
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
    const chartQuery = normalizeCode(state.meta.chartAirportQuery);
    const chartSearchSubmitted = Boolean(state.meta.chartSearchSubmitted);
    const matchingCharts = (Array.isArray(state.catalog.charts) ? state.catalog.charts : [])
      .map((chart) => normalizeAirportChartRecord(chart))
      .filter((chart) => chart.airportCode === chartQuery && chart.storagePath);
    return `
      <div class="ui-scale">
      <main class="entry-page">
        <section class="topbar centered">
          <div class="top-side">${renderBackButton("back-from-additional-info", "Back to setup")}</div>
          <div class="top-center">
            <h1>Additional Information</h1>
          </div>
          <div class="top-side right"></div>
        </section>
        <section class="additional-info-page">
          <div class="additional-info-menu-links${viewPanel ? " hidden" : ""}">
            <button class="additional-info-link" data-additional-info-panel="aircraft" type="button">Aircraft Information</button>
            <button class="additional-info-link" data-additional-info-panel="charts" type="button">Charts</button>
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
          <div class="${viewPanel === "charts" ? "" : "hidden"}">
            <section class="chart-search-card">
              <label class="setup-field chart-search-field">
                <span>Airport code</span>
                <input id="chart-airport-search" value="${escapeAttr(chartQuery)}" autocomplete="off" spellcheck="false" data-suggest-source="chart-airports" data-suggest-open-on-focus="true" />
              </label>
              <button class="action primary" id="chart-airport-search-button" type="button">Search</button>
            </section>
            <div class="chart-results" aria-live="polite">
              ${
                !chartSearchSubmitted
                  ? '<p class="chart-search-message">Enter an airport code to view available charts.</p>'
                  : !chartQuery
                    ? '<p class="chart-search-message error">Enter an airport code.</p>'
                    : !matchingCharts.length
                      ? `<p class="chart-search-message error">No charts are available for ${escapeHtml(chartQuery)}.</p>`
                      : groupChartsByCategory(matchingCharts).map((group) => `
                        <section class="chart-result-group">
                          <h4>${escapeHtml(group.category)}</h4>
                          ${group.items.map((chart) => `
                            <article class="chart-result-card" data-preview-chart-card="${escapeAttr(chart.airportCode)}" data-chart-preview-id="${escapeAttr(chart.id)}" role="button" tabindex="0">
                              <div>
                                <span>${escapeHtml(chart.airportCode)}</span>
                                <strong>${escapeHtml(chart.name || "Airport chart")}</strong>
                              </div>
                              <button class="action primary" data-open-chart-url="${escapeAttr(chart.id)}" type="button">Open</button>
                            </article>
                          `).join("")}
                        </section>
                      `).join("")
              }
            </div>
          </div>
        </section>
        ${renderFrontFooter()}
        ${renderBugReportModal()}
        ${renderAnnouncementModal()}
        ${renderChartPreviewModal()}
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
          <div class="top-side">${renderBackButton("back-from-admin-login", "Back to setup")}</div>
          <div class="top-center">
            <h1>Admin Login</h1>
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
          ${statusText && state.meta.adminStatusVisible !== false ? `<p class="${statusClass}">${escapeHtml(statusText)}</p>` : ""}
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
    const presetRows = normalizePresetRows(
      Array.isArray(state.admin.presetForm.rows) && state.admin.presetForm.rows.length
        ? state.admin.presetForm.rows
        : [createEmptyPresetRow()],
    );
    const waypointRows = normalizeWaypointRows(
      Array.isArray(state.admin.waypointForm.rows) && state.admin.waypointForm.rows.length
        ? state.admin.waypointForm.rows
        : [createEmptyWaypointRow()],
    );
    const rpcRows = normalizeRpcRegistryRows(
      Array.isArray(state.admin.rpcRegistryForm.rows) && state.admin.rpcRegistryForm.rows.length
        ? state.admin.rpcRegistryForm.rows
        : [createEmptyRpcRegistryRow()],
    );
    const existingRpcRecords = (Array.isArray(state.admin.rpcRegistry) ? state.admin.rpcRegistry : [])
      .map((record) => normalizeRpcRegistryRecord(record))
      .filter((record) => record.registration)
      .sort((left, right) => left.registration.localeCompare(right.registration));
    const adminChartQuery = normalizeCode(state.admin.chartForm && state.admin.chartForm.airportCode);
    const adminCharts = (Array.isArray(state.admin.charts) ? state.admin.charts : [])
      .map((chart) => normalizeAirportChartRecord(chart))
      .filter((chart) => adminChartQuery && chart.airportCode === adminChartQuery)
      .sort((left, right) => left.airportCode.localeCompare(right.airportCode) || String(left.category || "").localeCompare(String(right.category || "")) || left.name.localeCompare(right.name));
    const presetLockEnabled = Boolean(state.admin.presetForm.locked);
    const additionalInfoPanel = String(state.admin.additionalInfoPanel || "");
    const additionalInfoRows = normalizeAdditionalInfoTable(
      state.admin.additionalInfoDraft,
      getAdditionalInfoRowCount(state.admin.additionalInfoDraft),
      getAdditionalInfoColumnCount(state.admin.additionalInfoDraft),
    );
    const panelButtons = [
      { id: "dashboard", label: "Dashboard" },
      { id: "presets", label: "Presets" },
      { id: "coordinates", label: "Coordinates" },
      { id: "rpc-reg", label: "Aircraft" },
      { id: "airports", label: "Airport Info" },
      { id: "charts", label: "Charts" },
      { id: "announcements", label: "Announcements" },
      { id: "additional-info", label: "Aircraft Info" },
      { id: "manual", label: "User Manual" },
      { id: "privacy", label: "Privacy Policy" },
    ];
    return `
      <div class="ui-scale">
      <main class="entry-page">
        <section class="topbar centered">
          <div class="top-side">${renderBackButton("back-from-admin", "Back to setup")}</div>
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
            <div class="admin-grid two-col">
              <label class="setup-field">
                <span>Departure</span>
                <input id="admin-preset-departure" value="${escapeAttr(state.admin.presetForm.departure)}" data-suggest-source="preset-airports" data-suggest-open-on-focus="true" />
              </label>
              <label class="setup-field">
                <span>Destination</span>
                <input id="admin-preset-destination" value="${escapeAttr(state.admin.presetForm.destination)}" data-suggest-source="preset-airports" data-suggest-open-on-focus="true" />
              </label>
            </div>
            <div class="admin-preset-lock-rail">
              <div class="admin-lock-caption">TC / DIST</div>
              <button class="action admin-lock-btn${presetLockEnabled ? " active" : ""}" id="admin-preset-lock" type="button" aria-label="${presetLockEnabled ? "Unlock TC and distance overrides" : "Lock TC and distance overrides"}" title="${presetLockEnabled ? "Unlock TC and distance overrides" : "Lock TC and distance overrides"}">${renderLockGlyph(presetLockEnabled)}</button>
            </div>
            <div class="preset-status ${presetLookup.active ? (presetLookup.exists ? "available" : "missing") : ""}">${presetLookup.active ? (presetLookup.exists ? "preset avbl" : "preset unavbl") : ""}</div>
            <section class="admin-preset-table">
              <div class="admin-preset-head admin-preset-head-extended">
                <div>ROUTE <button class="mini-plus" id="admin-preset-add-row" type="button" aria-label="Add route row">+</button></div>
                <div>TC</div>
                <div>DIST</div>
                <div></div>
              </div>
              <div class="admin-preset-body">
                ${presetRows.map((row, index) => {
                  return `
                    <div class="admin-preset-row admin-preset-row-extended" data-admin-row-index="${index}">
                      <label class="admin-field-cell" data-label="Route">
                        <input data-admin-preset-row="${index}:route" value="${escapeAttr(row.route)}" data-suggest-source="waypoints" />
                      </label>
                      <label class="admin-field-cell admin-field-cell-derived${presetLockEnabled ? " is-locked" : ""}" data-label="TC">
                        <input data-admin-preset-row="${index}:tc" value="${escapeAttr(row.tc)}" ${presetLockEnabled ? 'disabled tabindex="-1"' : ""} placeholder="000" />
                      </label>
                      <label class="admin-field-cell admin-field-cell-derived${presetLockEnabled ? " is-locked" : ""}" data-label="Dist">
                        <input data-admin-preset-row="${index}:distance" value="${escapeAttr(row.distance)}" ${presetLockEnabled ? 'disabled tabindex="-1"' : ""} placeholder="0.0" />
                      </label>
                      <div class="admin-row-action-cell">
                        <button class="action admin-mini-btn" data-admin-preset-remove-row="${index}" type="button" aria-label="Remove route row">-</button>
                      </div>
                    </div>
                  `;
                }).join("")}
              </div>
            </section>
            <div class="admin-preset-add-mobile">
              <button class="action admin-preset-add-mobile-btn" id="admin-preset-add-row-mobile" type="button" aria-label="Add route row">+</button>
            </div>
            <div class="entry-actions">
              <button class="action primary" id="admin-preset-save">Save</button>
              <button class="action" id="admin-preset-delete"${presetLookup.exists ? "" : " disabled"}>Delete</button>
            </div>
          </div>
          <div class="manual-section${panel === "coordinates" ? "" : " hidden"}">
            <h3>Coordinates</h3><br>
            <section class="admin-preset-table admin-waypoint-table">
              <div class="admin-preset-head admin-waypoint-head">
                <div>WAYPOINT</div>
                <div>COORDS</div>
              </div>
              <div class="admin-preset-body">
                ${waypointRows.map((row, index) => {
                  const aliases = Array.isArray(row.aliases) ? row.aliases : [];
                  return `
                    <div class="admin-preset-row admin-waypoint-row" data-admin-row-index="${index}">
                      <div class="admin-waypoint-main">
                        <label class="admin-field-cell" data-label="Waypoint">
                          <input data-admin-waypoint-row="${index}:name" value="${escapeAttr(row.name)}" data-suggest-source="waypoints" />
                        </label>
                        <button class="action admin-add-alias-btn${row.name.trim() ? " active" : ""}" data-admin-waypoint-add-alias="${index}" type="button" ${row.name.trim() ? "" : "disabled"}>Add alias</button>
                      </div>
                      <label class="admin-field-cell" data-label="Coords">
                        <input data-admin-waypoint-row="${index}:coord" value="${escapeAttr(row.coord)}" placeholder="+/-lat, +/-long" />
                      </label>
                      ${aliases.length ? `
                        <div class="admin-waypoint-aliases" data-admin-waypoint-aliases="${index}">
                          ${aliases.map((alias, aliasIndex) => `
                            <label class="admin-waypoint-alias-cell" data-label="Alias">
                              <input data-admin-waypoint-row="${index}:alias:${aliasIndex}" value="${escapeAttr(alias)}" placeholder="Alias ${aliasIndex + 1}" />
                              <button class="action admin-mini-btn" data-admin-waypoint-remove-alias="${index}:${aliasIndex}" type="button" aria-label="Remove alias">-</button>
                            </label>
                          `).join("")}
                        </div>
                      ` : ""}
                    </div>
                  `;
                }).join("")}
              </div>
            </section>
            <div class="entry-actions">
              <button class="action primary" id="admin-waypoint-save">Save</button>
              <button class="action" id="admin-waypoint-delete">Delete</button>
            </div>
          </div>
          <div class="manual-section${panel === "rpc-reg" ? "" : " hidden"}">
            <h3>Aircraft</h3><br>
            <section class="admin-preset-table admin-rpc-table">
              <div class="admin-preset-head admin-rpc-head">
                <div>REGISTRATION</div>
                <div>AIRCRAFT TYPE</div>
                <div>CAS CLIMB</div>
                <div>CAS CRUISE</div>
                <div>GPH</div>
              </div>
              <div class="admin-preset-body">
                ${rpcRows.map((row, index) => {
                  return `
                    <div class="admin-preset-row admin-rpc-row" data-admin-row-index="${index}">
                      <label class="admin-field-cell" data-label="Registration">
                        <input data-admin-rpc-row="${index}:registration" value="${escapeAttr(row.registration)}" data-suggest-source="rpc" data-suggest-open-on-focus="true" />
                      </label>
                      <label class="admin-field-cell" data-label="Aircraft type">
                        <input data-admin-rpc-row="${index}:aircraftType" value="${escapeAttr(row.aircraftType)}" />
                      </label>
                      <label class="admin-field-cell" data-label="CAS climb">
                        <input data-admin-rpc-row="${index}:casClimb" value="${escapeAttr(row.casClimb)}" />
                      </label>
                      <label class="admin-field-cell" data-label="CAS cruise">
                        <input data-admin-rpc-row="${index}:casCruise" value="${escapeAttr(row.casCruise)}" />
                      </label>
                      <label class="admin-field-cell" data-label="GPH">
                        <input data-admin-rpc-row="${index}:gph" value="${escapeAttr(row.gph)}" />
                      </label>
                    </div>
                  `;
                }).join("")}
              </div>
            </section>
            <div class="entry-actions">
              <button class="action primary" id="admin-rpc-save">Save</button>
              <button class="action" id="admin-rpc-delete">Delete</button>
            </div>
            <section class="admin-record-picker">
              <h4>Existing registrations</h4>
              <div class="admin-record-picker-grid">
                ${existingRpcRecords.length ? existingRpcRecords.map((record) => `
                  <button class="admin-record-picker-item${normalizeCode(state.admin.selectedRpcRegistration) === record.registration ? " active" : ""}" data-admin-rpc-select="${escapeAttr(record.registration)}" type="button">
                    <strong>${escapeHtml(record.registration)}</strong>
                    <span>${escapeHtml(record.aircraftType || "Unspecified aircraft")}</span>
                  </button>
                `).join("") : '<p class="setup-caption">No registrations saved yet.</p>'}
              </div>
            </section>
          </div>
          <div class="manual-section${panel === "airports" ? "" : " hidden"}">
            <h3>Airport Information</h3><br>
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
                <label class="admin-field-cell" data-label="Location"><input id="admin-airport-code" value="${escapeAttr(state.admin.airportForm.code)}" data-suggest-source="airports" data-suggest-open-on-focus="true" /></label>
                <label class="admin-field-cell" data-label="CPT/ATIS"><input id="admin-airport-cptAtis" value="${escapeAttr(state.admin.airportForm.cptAtis)}" /></label>
                <label class="admin-field-cell" data-label="DEP/AAP"><input id="admin-airport-depAap" value="${escapeAttr(state.admin.airportForm.depAap)}" /></label>
                <label class="admin-field-cell" data-label="TWR"><input id="admin-airport-twr" value="${escapeAttr(state.admin.airportForm.twr)}" /></label>
                <label class="admin-field-cell" data-label="GND"><input id="admin-airport-gnd" value="${escapeAttr(state.admin.airportForm.gnd)}" /></label>
                <label class="admin-field-cell" data-label="FSS"><input id="admin-airport-fss" value="${escapeAttr(state.admin.airportForm.fss)}" /></label>
                <label class="admin-field-cell" data-label="Remarks"><input id="admin-airport-remarks" value="${escapeAttr(state.admin.airportForm.remarks)}" /></label>
              </div>
            </section>
            <div class="entry-actions">
              <button class="action primary" id="admin-airport-save">Save</button>
              <button class="action" id="admin-airport-delete"${airportLookup.exists ? "" : " disabled"}>Delete</button>
            </div>
          </div>
          <div class="manual-section${panel === "charts" ? "" : " hidden"}">
            <h3>Airport Charts</h3>
            <p class="setup-caption">Upload named PDF charts and assign them to an airport code.</p>
            <section class="admin-chart-upload-card">
              <div class="admin-grid three-col">
                <label class="setup-field">
                  <span>Airport code</span>
                  <input id="admin-chart-airport-code" value="${escapeAttr(state.admin.chartForm.airportCode)}" autocomplete="off" spellcheck="false" data-suggest-source="chart-airports" data-suggest-open-on-focus="true" />
                </label>
                <label class="setup-field">
                  <span>Chart name</span>
                  <input id="admin-chart-name" value="${escapeAttr(state.admin.chartForm.name)}" autocomplete="off" />
                </label>
                <label class="setup-field">
                  <span>Category</span>
                  <input id="admin-chart-category" value="${escapeAttr(state.admin.chartForm.category)}" autocomplete="off" spellcheck="false" data-suggest-source="chart-categories" data-suggest-open-on-focus="true" />
                </label>
              </div>
              <label class="setup-field admin-chart-file-field">
                <span>PDF document</span>
                <input id="admin-chart-file" type="file" accept="application/pdf,.pdf" />
              </label>
              <div class="entry-actions">
                <button class="action primary" id="admin-chart-upload" type="button">${state.admin.chartForm.id ? "Save chart" : "Upload chart"}</button>
                <span class="admin-subtle-status">${escapeHtml(state.admin.chartUploadStatus)}</span>
              </div>
            </section>
            <section class="admin-chart-list">
              ${!adminChartQuery ? '<p class="setup-caption">Enter an airport code to view associated charts.</p>' : adminCharts.length ? groupChartsByCategory(adminCharts).map((group) => `
                <section class="admin-chart-group">
                  <h4>${escapeHtml(group.category)}</h4>
                  ${group.items.map((chart) => {
                    const publicUrl = getAirportChartPublicUrl(chart);
                    return `
                      <article class="admin-chart-item${state.admin.chartForm.id === chart.id ? " active" : ""}">
                        <button class="admin-chart-select" data-admin-chart-select="${escapeAttr(chart.id)}" type="button">
                          <span>${escapeHtml(chart.airportCode)}</span>
                          <strong>${escapeHtml(chart.name || "Airport chart")}</strong>
                          ${chart.category ? `<small>${escapeHtml(chart.category)}</small>` : ""}
                        </button>
                        <div class="admin-chart-item-actions">
                          ${publicUrl ? `<a class="action" href="${escapeAttr(publicUrl)}" target="_blank" rel="noopener">Open</a>` : ""}
                          <button class="action" data-admin-chart-delete="${escapeAttr(chart.id)}" type="button">Delete</button>
                        </div>
                      </article>
                    `;
                  }).join("")}
                </section>
              `).join("") : `<p class="setup-caption">No charts uploaded for ${escapeHtml(adminChartQuery)} yet.</p>`}
            </section>
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
                        <input data-admin-announcement-field="${index}:startDate" value="${escapeAttr(formatAnnouncementDateInput(draft.startDate))}" placeholder="yyyy/mm/dd" />
                        <input data-admin-announcement-field="${index}:startTimeUtc" value="${escapeAttr(formatAnnouncementTimeInput(draft.startTimeUtc))}" placeholder="hh:mm" />
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
            <label class="setup-field admin-title-gap">
              <input id="admin-maintenance-text" value="${escapeAttr(state.admin.maintenanceTextDraft || "")}" placeholder="Maintenance message" />
            </label>
            <label class="admin-toggle-line admin-maintenance-toggle">
              <input id="admin-maintenance-flag" type="checkbox" ${state.admin.maintenanceMode ? "checked" : ""} />
              <span>Under maintenance</span>
            </label>
            <div class="entry-actions">
              <button class="action primary" id="admin-maintenance-save" type="button">Save</button>
            </div>
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
            <h3>Aircraft Information</h3><br>
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
            <div class="entry-actions">
              <button class="action primary" id="admin-additional-save">Save</button>
              <span class="admin-subtle-status">${escapeHtml(state.admin.additionalInfoSaveStatus)}</span>
            </div>
          </div>
          <div class="manual-section${panel === "dashboard" ? "" : " hidden"}">
            <h3>Dashboard</h3><br>
            <div class="admin-dashboard-grid">
              <article class="admin-dashboard-card">
                <h4>Loaded waypoints</h4>
                <p>${escapeHtml(String((state.admin.waypoints || []).length))}</p>
              </article>
              <article class="admin-dashboard-card">
                <h4>Route presets</h4>
                <p>${escapeHtml(String((state.admin.presets || []).length))}</p>
              </article>
              <article class="admin-dashboard-card">
                <h4>Airports loaded</h4>
                <p>${escapeHtml(String((state.admin.airports || []).length))}</p>
              </article>
              <article class="admin-dashboard-card">
                <h4>Airplanes</h4>
                <p>${escapeHtml(String((state.admin.rpcRegistry || []).length))}</p>
              </article>
              <article class="admin-dashboard-card">
                <h4>Charts</h4>
                <p>${escapeHtml(String((state.admin.charts || []).length))}</p>
              </article>
            </div>
          </div>
          </div>
          </div>
            ${statusText && state.meta.adminStatusVisible !== false ? `<p class="${statusClass}">${escapeHtml(statusText)}</p>` : ""}
        </section>
        ${renderFrontFooter()}
        ${renderBugReportModal()}
        ${renderAnnouncementModal()}
        ${renderChartPreviewModal()}
      </main>
      </div>
    `;
  }

  function renderNavlogScreen() {
    const h = state.navlog.header;
    const settingsPanel = renderSettingsPanel();
    const activateError = String(state.meta.activateError || "");
    return `
      <div class="ui-scale">
      <main class="page">
        <section class="topbar centered navlog-topbar">
          <div class="top-side navlog-back">${renderBackButton("back-to-setup", "Back to setup")}</div>
          <div class="top-center navlog-title-row">
            <h1>Navlog</h1>
          </div>
          <div class="navlog-clock"><div class="utc-pill" id="utc-clock">UTC ${formatUtcNow()}</div></div>
          <div class="top-side right navlog-actions">
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
        <section class="activate-wrap">
          <button class="activate-button" id="activate-ipad-mode" type="button" title="Activate is for cockpit use.">ACTIVATE</button>
          ${activateError ? `<p class="activate-error">${escapeHtml(activateError)}</p>` : ""}
        </section>
        ${renderActivateInfoModal()}
        ${renderFrontFooter()}
        ${renderBugReportModal()}
        ${renderAnnouncementModal()}
        ${renderChartPreviewModal()}
      </main>
      </div>
    `;
  }

  function renderIpadKioskScreen() {
    const h = state.navlog.header;
    const phoneMode = isPhoneActivateMode();
    const gpsSpeedLabel = getKioskGpsSpeedDisplayText();
    const showGpsSpeed = Boolean(gpsSpeedLabel);
    const showWhereAmI = isActivateGpsEnabled();
    const gpsAgeLabel = showWhereAmI ? getKioskGpsAgeDisplayText() : "";
    const topClockLabel = phoneMode ? `${formatUtcNow()}Z` : `UTC ${formatUtcNow()}`;
    const topStrip = `
      <section class="kiosk-top-strip${phoneMode ? " is-phone" : ""}">
        <div class="kiosk-utc" id="utc-clock">${topClockLabel}</div>
        ${showGpsSpeed ? `<div class="kiosk-gps-speed" id="kiosk-gps-speed">${escapeHtml(gpsSpeedLabel)}</div>` : ""}
        ${!showWhereAmI ? `<button class="action kiosk-chart-launch-btn kiosk-chart-launch-btn-top" id="open-activate-charts" type="button">Charts</button>` : ""}
        <button class="action kiosk-top-scratchpad" id="kiosk-top-scratchpad" type="button">Scratchpad</button>
      </section>
    `;
    const headerSection = phoneMode
      ? renderKioskPhoneHeaderSummary(h)
      : `
        <section class="sheet-header">
          ${renderHeaderInputBox("AIRCRAFT", `<input data-header="aircraft" value="${escapeAttr(h.aircraft)}" />`, "aircraft-box")}
          <div class="header-box dark static planning-box">PREFLIGHT PLANNER</div>
          ${renderHeaderInputBox("RP-C NO.", `<input data-header="rpCNo" value="${escapeAttr(h.rpCNo)}" />`, "rpc-box")}
           ${renderHeaderInputBox("DATE", renderDateHeaderControl(h.date), "date-box")}
          ${renderHeaderInputBox("GPH/PPH", `<input data-header="gphPph" value="${escapeAttr(h.gphPph)}" />`, "gph-box")}
          <div class="header-box static navlog-box">NAVIGATION LOG</div>
          ${renderHeaderInputBox("UTC TIME", `<input data-header="timeUtc" value="${escapeAttr(h.timeUtc)}" />`, "utc-box")}
        </section>
    `;
    return `
      <main class="ipad-kiosk-page${phoneMode ? " kiosk-phone-activate-page" : ""}">
        ${topStrip}
        ${gpsAgeLabel ? `<div class="kiosk-gps-age" id="kiosk-gps-age">${escapeHtml(gpsAgeLabel)}</div>` : ""}
        ${renderKioskEventTimerStrip()}
        <section class="sheet-wrap ipad-kiosk-wrap">
          <div class="sheet ipad-kiosk-sheet${phoneMode ? " kiosk-phone-sheet" : ""}">
            ${phoneMode ? `<section class="kiosk-phone-part kiosk-phone-static-part kiosk-phone-header-panel"><p class="kiosk-part-label">Info</p>${headerSection}</section>` : headerSection}
            ${phoneMode ? `<section class="kiosk-phone-part kiosk-phone-scroll-part kiosk-phone-route-scroll"><p class="kiosk-part-label">Route</p>${renderRouteTable()}</section>` : renderRouteTable()}
            ${phoneMode ? `<section class="kiosk-phone-part kiosk-phone-scroll-part kiosk-phone-toc-panel"><p class="kiosk-part-label">TOC / TOD</p>${renderTocTod()}</section>` : renderTocTod()}
            ${phoneMode ? `<section class="kiosk-phone-part kiosk-phone-scroll-part kiosk-phone-airport-scroll"><p class="kiosk-part-label">Airport Info</p>${renderLocationTable()}</section>` : renderLocationTable()}
            ${phoneMode ? `<section class="kiosk-phone-part kiosk-phone-scroll-part kiosk-phone-atis-scroll"><p class="kiosk-part-label">ATIS</p>${renderAtisSection()}</section>` : renderAtisSection()}
          </div>
        </section>
        <section class="kiosk-whereami-wrap">
          ${showWhereAmI ? `<button class="activate-button kiosk-whereami-btn" id="kiosk-whereami-open" type="button">Where am I</button>` : ""}
          ${showWhereAmI ? `<button class="action kiosk-chart-launch-btn" id="open-activate-charts" type="button">Charts</button>` : ""}
        </section>
        <section class="kiosk-pad-overlay" id="kiosk-pad-overlay" aria-hidden="true">
          <div class="kiosk-pad-card">
            <div class="kiosk-pad-head">
              <button class="action" id="kiosk-pad-clear" type="button">Clear</button>
              <button class="action" id="kiosk-pad-close" type="button">Close</button>
            </div>
            <canvas id="kiosk-pad-canvas" aria-label="Scratch pad"></canvas>
          </div>
        </section>
        ${renderKioskRouteEstimateModal()}
        ${renderKioskWhereAmIModal()}
        ${renderKioskTimerAlertModal()}
        ${renderActivateGpsPermissionPromptModal()}
        ${renderChartPreviewModal()}
      </main>
    `;
  }

  function renderKioskPhoneHeaderSummary(header) {
    const rpCNo = String(header && header.rpCNo ? header.rpCNo : "").trim();
    const aircraft = String(header && header.aircraft ? header.aircraft : "").trim();
    const rpDisplay = rpCNo || aircraft
      ? `RP-C ${rpCNo || "-"}${aircraft ? ` (${aircraft})` : ""}`
      : "";
    const dateDisplay = normalizeDisplayDate(header && header.date ? header.date : "");
    const utcTimeDisplay = String(header && header.timeUtc ? header.timeUtc : "").trim();
    return `
      <section class="kiosk-phone-header-grid">
        <label class="kiosk-phone-head-card">
          <span>RP-C</span>
          <input data-header="rpCNo" value="${escapeAttr(rpDisplay)}" readonly />
        </label>
        <label class="kiosk-phone-head-card">
          <span>Date</span>
          <input data-header="date" value="${escapeAttr(dateDisplay)}" readonly />
        </label>
        <label class="kiosk-phone-head-card">
          <span>GPH/PPH</span>
          <input data-header="gphPph" value="${escapeAttr(header && header.gphPph ? header.gphPph : "")}" />
        </label>
        <label class="kiosk-phone-head-card">
          <span>UTC Time</span>
          <input data-header="timeUtc" value="${escapeAttr(utcTimeDisplay)}" />
        </label>
      </section>
    `;
  }

  function renderKioskEventTimerStrip() {
    const timers = Array.isArray(state.meta.kioskEventTimer) ? state.meta.kioskEventTimer : [];
    if (!timers.length) return "";
    const rows = timers.map((timer) => {
      const kind = String(timer && timer.kind ? timer.kind : "time");
      const countdownDefault = kind === "gps-distance" ? "-- NM" : "T--:--";
      const targetDefault = kind === "gps-distance"
        ? (timer.targetHhmm ? `ETA ${timer.targetHhmm}Z` : "--")
        : `${String(timer.targetHhmm || "")}Z`;
      return `
        <section class="kiosk-event-timer" data-kiosk-timer-id="${escapeAttr(timer.id)}">
          <span class="kiosk-event-label">${escapeHtml(timer.label || "Position estimate")}</span>
          <span class="kiosk-event-countdown" data-kiosk-timer-countdown="${escapeAttr(timer.id)}">${escapeHtml(countdownDefault)}</span>
          <span class="kiosk-event-target" data-kiosk-timer-target="${escapeAttr(timer.id)}">${escapeHtml(targetDefault)}</span>
          <button class="kiosk-event-clear" data-kiosk-timer-clear="${escapeAttr(timer.id)}" type="button" aria-label="Clear timer">×</button>
        </section>
      `;
    }).join("");
    return `
      <div class="kiosk-event-stack">${rows}</div>
    `;
  }

  function renderKioskRouteEstimateModal() {
    const model = state.meta.kioskRouteEstimate;
    if (!model || !model.open) return "";
    const gpsEnabled = isActivateGpsEnabled();
    const liveDistanceText = computeKioskRouteLiveDistanceText(model);
    const routeLabel = String(model.routeLabel || "Waypoint");
    const routeContext = gpsEnabled
      ? routeLabel
      : (liveDistanceText ? `${routeLabel} (${liveDistanceText})` : routeLabel);
    return `
      <div class="bug-report-overlay" id="kiosk-route-estimate-overlay">
        <section class="bug-report-modal kiosk-estimate-modal" role="dialog" aria-modal="true" aria-label="Route estimate calculator">
          <div class="bug-report-head">
            <h3>Route Estimate</h3>
            <button class="action bug-report-close" id="kiosk-route-estimate-close" type="button">Close</button>
          </div>
          <p class="kiosk-estimate-context" id="kiosk-estimate-context">${escapeHtml(routeContext)}</p>
          ${
            gpsEnabled
              ? `
                <div class="kiosk-whereami-results kiosk-route-gps-readout">
                  <article>
                    <span>TH TO</span>
                    <strong id="kiosk-route-gps-direction">--</strong>
                  </article>
                  <article>
                    <span>Distance</span>
                    <strong id="kiosk-route-gps-distance">--</strong>
                  </article>
                  <article>
                    <span>Quadrant</span>
                    <strong id="kiosk-route-gps-quadrant">--</strong>
                  </article>
                </div>
                <p class="kiosk-estimate-result kiosk-gps-estimate" id="kiosk-route-gps-station-estimate">ETA: <strong>--</strong></p>
                <p class="kiosk-estimate-context kiosk-reminder-heading">Distance Alert</p>
              `
              : `
                <div class="kiosk-direction-toggle" id="kiosk-route-estimate-direction">
                  <button type="button" class="kiosk-direction-btn ${model.direction === "inbound" ? "active" : ""}" data-kiosk-direction="inbound">Inbound</button>
                  <button type="button" class="kiosk-direction-btn ${model.direction === "outbound" ? "active" : ""}" data-kiosk-direction="outbound">Outbound</button>
                </div>
              `
          }
          <div class="kiosk-estimate-grid${gpsEnabled ? " gps-distance-only" : ""}">
            <label>
              <span>Distance (NM)</span>
              <input id="kiosk-route-estimate-distance" value="${escapeAttr(model.distance)}" inputmode="decimal" />
              <span class="kiosk-distance-presets">
                <button type="button" class="kiosk-preset-btn" data-kiosk-distance-preset="5">5NM</button>
                <button type="button" class="kiosk-preset-btn" data-kiosk-distance-preset="10">10NM</button>
                <button type="button" class="kiosk-preset-btn" data-kiosk-distance-preset="15">15NM</button>
              </span>
            </label>
            ${gpsEnabled ? "" : `<label>
              <span>Groundspeed</span>
              <input id="kiosk-route-estimate-gs" value="${escapeAttr(model.groundspeed)}" inputmode="decimal" />
            </label>`}
          </div>
          <p class="kiosk-estimate-result${gpsEnabled && !model.resultHhmm ? " hidden" : ""}" id="kiosk-route-estimate-result">${gpsEnabled ? "Alert ETA" : "ETA"}: <strong>${escapeHtml(model.resultHhmm || "--")}${model.resultHhmm ? "Z" : ""}</strong></p>
          ${model.error ? `<p class="kiosk-estimate-error">${escapeHtml(model.error)}</p>` : ""}
          <div class="kiosk-estimate-actions">
            <div class="kiosk-estimate-primary-actions">
              ${gpsEnabled ? '<button class="action primary" id="kiosk-route-estimate-set-timer" type="button">Execute</button>' : '<button class="action primary" id="kiosk-route-estimate-set-timer" type="button">Start Timer</button>'}
            </div>
            <div class="kiosk-route-edit-actions">
              <button class="action kiosk-route-symbol-btn" id="kiosk-route-estimate-add-below" type="button" aria-label="Add row below" title="Add row below">+↓</button>
              <button class="action kiosk-route-symbol-btn danger" id="kiosk-route-estimate-remove-route" type="button" aria-label="Remove waypoint" title="Remove waypoint" ${Number.isFinite(model.legIndex) && model.legIndex > 0 && model.legIndex < (state.navlog.legs.length - 1) ? "" : "disabled"}>Del</button>
              <button class="action kiosk-route-symbol-btn" id="kiosk-route-estimate-add-above" type="button" aria-label="Add row above" title="Add row above">+↑</button>
            </div>
          </div>
        </section>
      </div>
    `;
  }

  function getKioskGpsSpeedDisplayText() {
    if (!isActivateGpsEnabled()) return "";
    const gps = state.meta && state.meta.kioskGps ? state.meta.kioskGps : createEmptyKioskGpsState();
    if (gps.error) return "No GS avbl";
    if (!Number.isFinite(gps.speedKts)) return "GS -- kts";
    return `GS ${formatSpeedDisplayForUnit(gps.speedKts, "kts")} kts`;
  }

  function getKioskGpsAgeDisplayText(nowMs = Date.now()) {
    if (!isActivateGpsEnabled()) return "";
    const gps = state.meta && state.meta.kioskGps ? state.meta.kioskGps : createEmptyKioskGpsState();
    if (gps.error) return "GPS not updating";
    const lastFixMs = Number(gps.lastFixMs);
    if (!Number.isFinite(lastFixMs)) return "GPS waiting for position";
    const ageSeconds = Math.max(0, Math.round((Number(nowMs) - lastFixMs) / 1000));
    if (ageSeconds < 2) return "GPS updated just now";
    if (ageSeconds < 60) return `GPS updated ${ageSeconds}s ago`;
    const ageMinutes = Math.floor(ageSeconds / 60);
    return `GPS updated ${ageMinutes}m ago`;
  }

  function renderKioskWhereAmIModal() {
    if (!isActivateGpsEnabled()) return "";
    const gps = state.meta && state.meta.kioskGps ? state.meta.kioskGps : createEmptyKioskGpsState();
    const model = gps.whereAmI || { open: false, query: "", result: null, error: "" };
    if (!model.open) return "";
    const depCode = getKioskDepartureRouteCode();
    const destCode = getKioskDestinationRouteCode();
    const depLabel = depCode || "DEP";
    const destLabel = destCode || "DEST";
    const result = model.result || null;
    const distanceLabel = result && Number.isFinite(result.distanceNm) ? `${formatDistanceDisplayWithRounding(result.distanceNm, false)} NM` : "--";
    const quadrantLabel = result && result.quadrant ? result.quadrant : "--";
    const headingLabel = result && Number.isFinite(result.headingTrue) ? `${String(roundHalfUp(result.headingTrue)).padStart(3, "0")}°T` : "--";
    const gpsEstimateLabel = result && String(result.gpsEstimateHhmm || "").trim()
      ? `${String(result.gpsEstimateHhmm).trim()}Z`
      : "--";
    return `
      <div class="bug-report-overlay" id="kiosk-whereami-overlay">
        <section class="bug-report-modal kiosk-whereami-modal" role="dialog" aria-modal="true" aria-label="Where am I">
          <div class="bug-report-head">
            <h3>Where am I</h3>
            <button class="action bug-report-close" id="kiosk-whereami-close" type="button">Close</button>
          </div>
          <p class="kiosk-whereami-subtitle">Compute distance, quadrant and TH</p>
          <label class="setup-field kiosk-whereami-input">
            <span>Waypoint</span>
            <input id="kiosk-whereami-query" value="${escapeAttr(model.query || "")}" placeholder="Type waypoint" data-suggest-source="waypoints" />
          </label>
          <div class="kiosk-distance-presets kiosk-whereami-quick">
            <button class="kiosk-preset-btn kiosk-whereami-preset" id="kiosk-whereami-use-departure" type="button">${escapeHtml(depLabel)}</button>
            <button class="kiosk-preset-btn kiosk-whereami-preset" id="kiosk-whereami-use-destination" type="button">${escapeHtml(destLabel)}</button>
          </div>
          <p class="kiosk-estimate-error${model.error ? "" : " hidden"}" id="kiosk-whereami-error">${escapeHtml(model.error || "")}</p>
          <div class="kiosk-whereami-results">
            <article>
              <span>Distance</span>
              <strong id="kiosk-whereami-distance">${escapeHtml(distanceLabel)}</strong>
            </article>
            <article>
              <span>Quadrant</span>
              <strong id="kiosk-whereami-quadrant">${escapeHtml(quadrantLabel)}</strong>
            </article>
            <article>
              <span>TH To</span>
              <strong id="kiosk-whereami-heading">${escapeHtml(headingLabel)}</strong>
            </article>
            <article>
              <span>GPS Estimate</span>
              <strong id="kiosk-whereami-estimate">${escapeHtml(gpsEstimateLabel)}</strong>
            </article>
          </div>
        </section>
      </div>
    `;
  }

  function renderKioskTimerAlertModal() {
    const alertQueue = Array.isArray(state.meta.kioskTimerAlerts) ? state.meta.kioskTimerAlerts : [];
    const alertState = alertQueue[0];
    if (!alertState) return "";
    return `
      <div class="bug-report-overlay" id="kiosk-timer-alert-overlay">
        <section class="bug-report-modal kiosk-timer-alert" role="dialog" aria-modal="true" aria-label="Timer complete">
          <div class="bug-report-head">
            <h3>Alert!</h3>
          </div>
          <p class="kiosk-estimate-result">${escapeHtml(alertState.label || "Position estimate reached")}</p>
          <p class="kiosk-alert-countdown" id="kiosk-alert-countdown">-00:00</p>
          <div class="kiosk-estimate-actions">
            <button class="action primary" id="kiosk-timer-alert-ack" type="button">Acknowledge</button>
          </div>
        </section>
      </div>
    `;
  }

  function renderAccessScreen() {
    const maintenanceBanner = state.catalog.content.maintenanceMode
      ? `<p class="maintenance-warning">${escapeHtml(state.catalog.content.maintenanceText || "under maintenance: service is undergoing maintenance. do not trust.")}</p>`
      : "";
    return `
      <div class="ui-scale">
      <main class="entry-page">
        <section class="entry-hero entry-hero-centered">
          <div class="top-center">
            <h1>Navlog</h1>
            <div class="utc-pill" id="utc-clock">UTC ${formatUtcNow()}</div>
            <p class="setup-caption">Enter access key to continue.</p>
            ${maintenanceBanner}
          </div>
        </section>
        <section class="setup-card">
          <label class="setup-field">
            <span>Access key</span>
            <input id="navlog-access-key" type="password" placeholder="Enter access key" autocomplete="off" />
          </label>
          ${state.meta.accessError ? `<p class="admin-status error">${escapeHtml(state.meta.accessError)}</p>` : ""}
          <div class="entry-actions">
            <button class="action primary" id="unlock-navlog">Unlock</button>
          </div>
        </section>
      </main>
      </div>
    `;
  }

  function renderActivateInfoModal() {
    if (!state.meta.activateInfoOpen) return "";
    return `
      <div class="bug-report-overlay" id="activate-info-overlay">
        <section class="bug-report-modal cockpit-info-modal" role="dialog" aria-modal="true" aria-label="Cockpit mode information">
          <div class="bug-report-head">
            <h3>Cockpit Mode</h3>
            <button class="action bug-report-close" id="activate-info-close" type="button">Close</button>
          </div>
          <div class="cockpit-info-copy">
            <p class="cockpit-info-intro">You are about to enter Cockpit Mode.</p>
            <p class="cockpit-info-recommend">Recommended: Turn on Guided Access and DND.</p>
            <ul class="cockpit-info-list">
              <li>Press and hold Actual Time (AT) for 2 seconds to auto-enter current ZULU time.</li>
              <li>To use keyboard entry for interactive fields (AT, ATIS, LOCATION), tap the respective table cell 2 times.</li>
              <li>For inbound/outbound time estimate, press and hold the route for 2 seconds.</li>
            </ul>
            <label class="settings-item cockpit-gps-toggle">
              <input type="checkbox" id="activate-enable-gps" ${isActivateGpsEnabled() ? "checked" : ""} />
                <span>Enable GPS Functionality? (experimental)</span>
              </label>
          </div>
          <div class="bug-report-actions">
            <button class="action primary" id="activate-info-continue" type="button">Continue</button>
          </div>
        </section>
      </div>
    `;
  }

  function renderActivateGpsPermissionPromptModal() {
    if (!state.meta.gpsPermissionPromptOpen) return "";
    return `
      <div class="bug-report-overlay" id="activate-gps-prompt-overlay">
        <section class="bug-report-modal cockpit-info-modal" role="dialog" aria-modal="true" aria-label="Continue without GPS">
          <div class="bug-report-head">
            <h3>Continue without GPS?</h3>
          </div>
          <div class="cockpit-info-copy">
            <p class="cockpit-info-intro">Navlog could not get GPS permission.</p>
            <p class="cockpit-info-recommend">Choose yes to continue in GPS off mode, or no to ask iOS again immediately.</p>
          </div>
          <div class="bug-report-actions">
            <button class="action" id="activate-gps-no" type="button">NO</button>
            <button class="action primary" id="activate-gps-yes" type="button">YES</button>
          </div>
        </section>
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
    const isPhoneKiosk = isPhoneActivateMode();
    const showCasColumn = state.view !== "ipad-kiosk";
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
    const eeUnitLabel = state.settings.roundTimeValues ? "mins" : "min+sec";
    const withUnit = (label, unitText) => `<span class="time-head"><span>${label}</span><span class="head-format-note">(${unitText})</span></span>`;
    let tableHead = "";
    if (isPhoneKiosk) {
      const headingField = getKioskPhoneHeadingField();
      const headingLabel = headingField === "ch" ? "CH" : "TC";
      const headingHeadMarkup = variationDeviationEnabled
        ? `<button type="button" class="kiosk-heading-toggle" data-kiosk-heading-toggle>${headingLabel}</button>`
        : headingLabel;
      const phoneSpeedMode = getKioskPhoneSpeedCellMode();
      const phoneHeadClass = variationDeviationEnabled
        ? "nav-head-grid nav-head-grid-phone nav-head-grid-phone-vd"
        : "nav-head-grid nav-head-grid-phone";
      tableHead = `
        <div class="${phoneHeadClass}">
          <div class="head-cell tall route-head">ROUTE <button class="mini-plus inline" id="add-leg" type="button">+</button></div>
          <div class="head-cell tall alt-head">${withUnit("ALT", altUnitLabel)}</div>
          <div class="head-cell tall heading-head">${headingHeadMarkup}</div>
          <div class="head-cell tall speed-head speed-mode-head">
            <div class="kiosk-global-speed-toggle">
              <button type="button" class="kiosk-speed-btn ${phoneSpeedMode === "gs" ? "active" : ""}" data-kiosk-speed-mode="gs">GS</button>
              <button type="button" class="kiosk-speed-btn ${phoneSpeedMode === "ta" ? "active" : ""}" data-kiosk-speed-mode="ta">TAS</button>
            </div>
          </div>
          <div class="head-cell tall dis-head">${withUnit("DIS", distanceUnitLabel)}</div>
          <div class="head-cell tall ee-head">${withUnit("EE", eeUnitLabel)}</div>
          <div class="head-cell tall et-head"><span class="time-head"><span>ET</span><span class="head-format-note">(HHMM)</span></span></div>
          <div class="head-cell tall at-head"><span class="time-head"><span>AT</span><span class="head-format-note">(HHMM)</span></span></div>
        </div>
      `;
    } else {
      const headClass = [
        "nav-head-grid",
        variationDeviationEnabled ? "nav-head-grid-vd" : "",
        !showCasColumn ? "nav-head-grid-no-cas" : "",
      ].filter(Boolean).join(" ");
      tableHead = variationDeviationEnabled
        ? `
          <div class="${headClass}">
            <div class="head-cell tall route-head">ROUTE <button class="mini-plus inline" id="add-leg" type="button">+</button></div>
            <div class="head-cell group cruise-head">CRUISE</div>
            <div class="head-cell group wind-head">WIND</div>
            <div class="head-cell sub split-top tcv-head">TC</div>
            <div class="head-cell sub split-top thv-head">TH</div>
            <div class="head-cell sub split-top mhv-head">MH</div>
            <div class="head-cell tall chv-head">CH</div>
            <div class="head-cell tall ta-head-vd">${withUnit("TA", speedUnitLabel)}</div>
            <div class="head-cell tall gs-head-vd">${withUnit("GS", speedUnitLabel)}</div>
            <div class="head-cell tall dis-head-vd">${withUnit("DIS", distanceUnitLabel)}</div>
            <div class="head-cell tall ee-head-vd">${withUnit("EE", eeUnitLabel)}</div>
            <div class="head-cell tall et-head-vd"><span class="time-head"><span>ET</span><span class="head-format-note">(HHMM)</span></span></div>
            <div class="head-cell tall at-head-vd"><span class="time-head"><span>AT</span><span class="head-format-note">(HHMM)</span></span></div>
            ${showCasColumn ? `<div class="head-cell sub cas-head">${withUnit("CAS", speedUnitLabel)}</div>` : ""}
            <div class="head-cell sub alt-head">${withUnit("ALT", altUnitLabel)}</div>
            <div class="head-cell sub temp-head">${withUnit("TEMP", tempUnitLabel)}</div>
            <div class="head-cell sub dir-head">DIR</div>
            <div class="head-cell sub spd-head">${withUnit("SPD", speedUnitLabel)}</div>
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
            <div class="head-cell sub split-top tcw-top-head">TC</div>
            <div class="head-cell sub tcw-bottom-head">WCA</div>
            <div class="head-cell tall ta-head">${withUnit("TA", speedUnitLabel)}</div>
            <div class="head-cell tall gs-head">${withUnit("GS", speedUnitLabel)}</div>
            <div class="head-cell tall dis-head">${withUnit("DIS", distanceUnitLabel)}</div>
            <div class="head-cell tall ee-head">${withUnit("EE", eeUnitLabel)}</div>
            <div class="head-cell tall et-head"><span class="time-head"><span>ET</span><span class="head-format-note">(HHMM)</span></span></div>
            <div class="head-cell tall at-head"><span class="time-head"><span>AT</span><span class="head-format-note">(HHMM)</span></span></div>
            ${showCasColumn ? `<div class="head-cell sub cas-head">${withUnit("CAS", speedUnitLabel)}</div>` : ""}
            <div class="head-cell sub alt-head">${withUnit("ALT", altUnitLabel)}</div>
            <div class="head-cell sub temp-head">${withUnit("TEMP", tempUnitLabel)}</div>
            <div class="head-cell sub dir-head">DIR</div>
            <div class="head-cell sub spd-head">${withUnit("SPD", speedUnitLabel)}</div>
          </div>
        `;
    }
    const markerSnapshot = state.meta && state.meta.routeProgressMarkerSnapshot
      ? state.meta.routeProgressMarkerSnapshot
      : null;
    const markerClass = [
      "route-progress-marker",
      markerSnapshot && markerSnapshot.visible ? "visible" : "",
      markerSnapshot && markerSnapshot.overdue ? "overdue" : "",
    ].filter(Boolean).join(" ");
    const markerStyle = markerSnapshot
      && Number.isFinite(Number(markerSnapshot.leftPx))
      && Number.isFinite(Number(markerSnapshot.topPx))
      ? ` style="left:${Number(markerSnapshot.leftPx).toFixed(3)}px;top:${Number(markerSnapshot.topPx).toFixed(3)}px;"`
      : "";
    return `
      <section class="nav-table">
        ${tableHead}
        <div class="table-body">
          ${state.navlog.legs.map((leg, index) => renderLegRow(leg, index, variationDeviationEnabled)).join("")}
          ${state.view === "ipad-kiosk" ? `
            <div class="${markerClass}" id="route-progress-marker" aria-hidden="true"${markerStyle}>
              <span class="route-progress-dot"></span>
            </div>
          ` : ""}
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
    const isPhoneKiosk = isPhoneActivateMode();
    const showCasColumn = state.view !== "ipad-kiosk";
    const removable = index > 0 && index < state.navlog.legs.length - 1;
    const altExtra = index === 0 ? "first-alt" : "";
    const distanceToGo = getDistanceToGoDisplay(index);
    const isFirstRoute = index === 0;
    const isLastRoute = index === state.navlog.legs.length - 1;
    const routeIsUnknown = String(leg.route || "").trim() && !isRecognizedRoute(leg.route);
    const shouldShowUnknownRoute = routeIsUnknown && (state.view !== "ipad-kiosk" || leg._kioskCreated === true);
    const routeCellExtra = [
      isFirstRoute ? "first-route-hint" : "",
      isLastRoute ? "last-route-hint" : "",
      shouldShowUnknownRoute ? "route-unknown" : "",
    ].filter(Boolean).join(" ");
    const rowClass = isPhoneKiosk
      ? `leg-row leg-row-phone${variationDeviationEnabled ? " leg-row-phone-vd" : ""}`
      : `${variationDeviationEnabled ? "leg-row leg-row-vd" : "leg-row"}${showCasColumn ? "" : " leg-row-no-cas"}`;
    const routeCellMarkup = `
        <div class="${legFieldClass(leg, "route", `route route-cell ${routeCellExtra}`.trim())}">
        <div class="route-main">
          <input data-leg-field="${index}:route" value="${escapeAttr(leg.route)}" data-suggest-source="waypoints" />
          ${removable ? `<button type="button" class="remove-chip" data-remove-leg="${index}">-</button>` : `<span class="blank-chip"></span>`}
          ${
            isFirstRoute
              ? '<span class="route-inline-hint route-inline-hint-dep" aria-hidden="true">Departure<br>Airport</span>'
              : isLastRoute
                ? '<span class="route-inline-hint route-inline-hint-dest" aria-hidden="true">Destination<br>Airport</span>'
                : ""
          }
        </div>
        ${state.view === "ipad-kiosk" ? '<span class="route-waypoint-marker" aria-hidden="true"></span>' : ""}
        ${state.settings.showDistanceToGo ? `<span class="route-dtg">${distanceToGo ? `(${escapeAttr(distanceToGo)})` : ""}</span>` : ""}
      </div>
    `;
    if (isPhoneKiosk) {
      const headingField = getKioskPhoneHeadingField();
      return `
        <div class="${rowClass}">
          ${routeCellMarkup}
          <div class="${legFieldClass(leg, "alt", altExtra)}"><input data-leg-field="${index}:alt" value="${escapeAttr(legFieldValue(leg, "alt"))}" /></div>
          <div class="${legFieldClass(leg, headingField, "kiosk-phone-heading-cell")}"><input data-leg-field="${index}:${headingField}" value="${escapeAttr(legFieldValue(leg, headingField))}" /></div>
          ${renderKioskPhoneSpeedCell(leg, index)}
          <div class="${legFieldClass(leg, "distance")}"><input data-leg-field="${index}:distance" value="${escapeAttr(legFieldValue(leg, "distance"))}" /></div>
          <div class="${legFieldClass(leg, "ee")}"><input data-leg-field="${index}:ee" value="${escapeAttr(legFieldValue(leg, "ee"))}" /></div>
          <div class="${legFieldClass(leg, "et")}"><input data-leg-field="${index}:et" value="${escapeAttr(legFieldValue(leg, "et"))}" /></div>
          <div class="${legFieldClass(leg, "at")}"><input data-leg-field="${index}:at" value="${escapeAttr(legFieldValue(leg, "at"))}" ${index === 0 ? 'placeholder="AB TIME"' : ""} ${state.view === "ipad-kiosk" ? 'inputmode="numeric" pattern="[0-9]*"' : ""} /></div>
        </div>
      `;
    }
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
        <div class="${legFieldClass(leg, "ch")}"><input data-leg-field="${index}:ch" value="${escapeAttr(legFieldValue(leg, "ch"))}" /></div>
      `
      : `
        <div class="${legFieldClass(leg, "tc", "stack-field")}"><input data-leg-field="${index}:tc" value="${escapeAttr(legFieldValue(leg, "tc"))}" /><input data-leg-field="${index}:wca" value="${escapeAttr(legFieldValue(leg, "wca"))}" /></div>
      `;
    return `
      <div class="${rowClass}">
        ${routeCellMarkup}
        ${showCasColumn ? `<div class="${legFieldClass(leg, "cas")}"><input data-leg-field="${index}:cas" value="${escapeAttr(legFieldValue(leg, "cas"))}" /></div>` : ""}
        <div class="${legFieldClass(leg, "alt", altExtra)}">
          <input data-leg-field="${index}:alt" value="${escapeAttr(legFieldValue(leg, "alt"))}" />
          ${
            index === 0
              ? '<span class="alt-departure-hint" aria-hidden="true"><span>Departure</span><span>Elevation</span></span><span class="alt-info-wrap" aria-hidden="true"><span class="alt-info-badge">i</span><span class="alt-info-text">Differential (DEP elevation, WPT 1 ALT) is used for TOC calculation. Default=0</span></span>'
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
        <div class="${legFieldClass(leg, "at")}"><input data-leg-field="${index}:at" value="${escapeAttr(legFieldValue(leg, "at"))}" ${index === 0 ? 'placeholder="AB TIME"' : ""} ${state.view === "ipad-kiosk" ? 'inputmode="numeric" pattern="[0-9]*"' : ""} /></div>
      </div>
    `;
  }

  function getKioskPhoneSpeedCellMode() {
    const gps = state.meta && state.meta.kioskGps ? state.meta.kioskGps : null;
    if (!gps) return "gs";
    if (gps.speedCellMode === "ta") return "ta";
    return "gs";
  }

  function setKioskPhoneSpeedCellMode(mode) {
    if (!state.meta.kioskGps) state.meta.kioskGps = createEmptyKioskGpsState();
    state.meta.kioskGps.speedCellMode = mode === "ta" ? "ta" : "gs";
  }

  function getKioskPhoneHeadingField() {
    if (!state.settings.variationDeviationEnabled) return "tc";
    return state.meta && state.meta.activateHeadingMode === "ch" ? "ch" : "tc";
  }

  function toggleKioskPhoneHeadingField() {
    if (!state.settings.variationDeviationEnabled) return;
    state.meta.activateHeadingMode = getKioskPhoneHeadingField() === "ch" ? "tc" : "ch";
    render();
  }

  function renderKioskPhoneSpeedCell(leg, index) {
    const mode = getKioskPhoneSpeedCellMode();
    const activeField = mode === "ta" ? "ta" : "gs";
    const activeValue = legFieldValue(leg, activeField);
    return `
      <div class="${legFieldClass(leg, activeField, "kiosk-phone-speed-cell")}">
        <input data-kiosk-speed-display="${index}" data-leg-field="${index}:${activeField}" value="${escapeAttr(activeValue)}" readonly />
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
    const isKiosk = state.view === "ipad-kiosk";
    const distanceUnitLabel = isKiosk
      ? "NM"
      : (
        state.settings.distanceUnit === "km"
          ? "KM"
          : state.settings.distanceUnit === "sm"
            ? "SM"
            : "NM"
      );
    const timeUnitLabel = isKiosk ? "mins" : (state.settings.roundTimeValues ? "mins" : "min+sec");
    const showTocUnits = true;
    const tocDistancePlaceholder = "Distance";
    const tocTimePlaceholder = "Time";
    const renderTocValueCell = (field, value, placeholder, unitText, isLast = false) => `
      <label class="toc-value-wrap${isLast ? " is-last" : ""}">
        <input data-toc="${field}" value="${escapeAttr(value)}" placeholder="${escapeAttr(placeholder)}" />
        ${showTocUnits ? `<span class="toc-unit" aria-hidden="true">${escapeHtml(unitText)}</span>` : ""}
      </label>
    `;
    return `
      <section class="toc-tod">
        <div class="toc-tod-card ${!t.tocEditing ? "resolved" : ""}">
          <button type="button" class="toc-tod-title" data-edit-toc="toc">TOC</button>
          ${
            t.tocEditing
              ? `<input class="toc-entry" data-toc-entry="roc" value="${escapeAttr(t.roc)}" placeholder="ROC" inputmode="text" enterkeyhint="done" autocomplete="off" />`
              : `
                ${renderTocValueCell("tocDistance", t.tocDistance, tocDistancePlaceholder, distanceUnitLabel)}
                ${renderTocValueCell("tocTime", t.tocTime, tocTimePlaceholder, timeUnitLabel, true)}
              `
          }
        </div>
        <div class="toc-tod-card ${!t.todEditing ? "resolved" : ""}">
          <button type="button" class="toc-tod-title" data-edit-toc="tod">TOD</button>
          ${
            t.todEditing
              ? `<input class="toc-entry" data-toc-entry="rod" value="${escapeAttr(t.rod)}" placeholder="ROD" inputmode="text" enterkeyhint="done" autocomplete="off" />`
              : `
                ${renderTocValueCell("todDistance", t.todDistance, tocDistancePlaceholder, distanceUnitLabel)}
                ${renderTocValueCell("todTime", t.todTime, tocTimePlaceholder, timeUnitLabel, true)}
              `
          }
        </div>
      </section>
    `;
  }

  function refreshTocTodDom(focusField = "") {
    const current = document.querySelector(".toc-tod");
    if (!current) return;
    const holder = document.createElement("div");
    holder.innerHTML = renderTocTod().trim();
    const replacement = holder.firstElementChild;
    if (!replacement) return;
    current.replaceWith(replacement);
    wireTocTodControls(replacement);
    applyEditableNumericKeyboardDefaults();
    if (focusField) {
      requestAnimationFrame(() => {
        const input = replacement.querySelector(`[data-toc-entry="${focusField}"]`);
        if (input) input.focus();
      });
    }
  }

  function wireTocTodControls(root = document) {
    const shouldCommitOnBlur = state.view === "ipad-kiosk" && !isTouchInputDevice();
    const commitTocEntry = (input, field) => {
      if (!input || input.dataset.tocCommitted === "1") return;
      input.dataset.tocCommitted = "1";
      const value = String(input.value || "").trim();
      state.navlog.tocTod[field] = value;
      if (field === "roc") {
        state.navlog.tocTod.tocEditing = false;
        state.navlog.tocTod.tocManual = false;
      }
      if (field === "rod") {
        state.navlog.tocTod.todEditing = false;
        state.navlog.tocTod.todManual = false;
      }
      computeRouteMath();
      updateComputedCells();
      refreshTocTodDom();
    };

    root.querySelectorAll("[data-toc-entry]").forEach((input) => {
      input.addEventListener("input", (event) => {
        const field = event.target.dataset.tocEntry;
        event.target.dataset.tocCommitted = "0";
        state.navlog.tocTod[field] = event.target.value;
      });
      input.addEventListener("change", (event) => {
        if (!shouldCommitOnBlur) return;
        commitTocEntry(event.target, event.target.dataset.tocEntry);
      });
      input.addEventListener("blur", (event) => {
        if (!shouldCommitOnBlur) return;
        commitTocEntry(event.target, event.target.dataset.tocEntry);
      });
      input.addEventListener("keydown", (event) => {
        if (event.key !== "Enter") return;
        event.preventDefault();
        commitTocEntry(event.target, event.target.dataset.tocEntry);
      });
    });

    root.querySelectorAll("[data-edit-toc]").forEach((button) => {
      button.addEventListener("click", () => {
        if (button.dataset.editToc === "toc") {
          state.navlog.tocTod.tocEditing = true;
          state.navlog.tocTod.tocManual = false;
          refreshTocTodDom("roc");
          return;
        }
        state.navlog.tocTod.todEditing = true;
        state.navlog.tocTod.todManual = false;
        refreshTocTodDom("rod");
      });
    });
  }

  function renderLocationTable() {
    return `
      <section class="radio-block">
        <div class="radio-head">
          <div>LOCATION <button class="mini-plus inline" id="add-radio-row" type="button">+</button></div>
          <div>ATIS</div>
          <div>DEP/APP</div>
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
          <input data-radio-field="${index}:location" value="${escapeAttr(row.location)}" data-suggest-source="airports" />
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

  async function validateAccessKeyWithBackend(key) {
    const value = String(key || "").trim();
    if (!value) return false;
    try {
      const response = await fetch("/api/access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: value }),
      });
      if (!response.ok) return false;
      const payload = await response.json();
      return Boolean(payload && payload.ok);
    } catch {
      return false;
    }
  }

  function wireAccess() {
    const input = document.getElementById("navlog-access-key");
    const unlockButton = document.getElementById("unlock-navlog");
    if (!input || !unlockButton) return;

    const submit = async () => {
      const entered = String(input.value || "").trim();
      if (!entered) {
        state.meta.accessError = "Enter access key.";
        render();
        return;
      }
      unlockButton.disabled = true;
      unlockButton.textContent = "Checking...";
      const ok = await validateAccessKeyWithBackend(entered);
      if (!ok) {
        state.meta.navlogUnlocked = false;
        state.meta.accessError = "Invalid access key.";
        writeStoredValue(NAVLOG_ACCESS_KEY_UNLOCK, "");
        render();
        return;
      }
      state.meta.navlogUnlocked = true;
      state.meta.accessError = "";
      writeStoredValue(NAVLOG_ACCESS_KEY_UNLOCK, "1");
      const welcomeSeen = readStoredValue(NAVLOG_WELCOME_BEHAVIOUR_SEEN) === "1";
      state.meta.showWelcomeBehaviourNotice = !welcomeSeen;
      if (!welcomeSeen) writeStoredValue(NAVLOG_WELCOME_BEHAVIOUR_SEEN, "1");
      state.view = "setup";
      render();
    };

    unlockButton.addEventListener("click", submit);
    input.addEventListener("keydown", async (event) => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      await submit();
    });
    input.focus();
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
      const departure = state.navlog.setup.departure;
      const destination = state.navlog.setup.destination;
      if (hasMeaningfulSheetData() && !window.confirm("Are you sure you want to lose current progress and make a new navlog?")) return;
      if (hasMeaningfulSheetData()) {
        state.navlog = createBlankNavlog();
        state.navlog.setup.departure = departure;
        state.navlog.setup.destination = destination;
      }
      state.settings = createDefaultSettings();
      seedLegs();
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
      if (hasMeaningfulSheetData() && !window.confirm("You may lose unsaved progress. Continue?")) return;
      state.navlog = createBlankNavlog();
      state.settings = createDefaultSettings();
      state.meta.hasOpenedSheet = false;
      state.meta.usingPresetRoute = false;
      render();
    });
    document.getElementById("save-sheet").addEventListener("click", downloadPdf);
    const activateButton = document.getElementById("activate-ipad-mode");
    if (activateButton) {
      activateButton.addEventListener("click", () => {
        if (!isActivateSupportedDevice()) {
          state.meta.activateError = "Only avbl on touch devices";
          render();
          return;
        }
        state.meta.activateError = "";
        state.meta.activateInfoOpen = true;
        render();
      });
    }
    const activateInfoClose = document.getElementById("activate-info-close");
    if (activateInfoClose) {
      activateInfoClose.addEventListener("click", () => {
        state.meta.activateInfoOpen = false;
        render();
      });
    }
    const activateInfoOverlay = document.getElementById("activate-info-overlay");
    if (activateInfoOverlay) {
      activateInfoOverlay.addEventListener("click", (event) => {
        if (event.target !== activateInfoOverlay) return;
        state.meta.activateInfoOpen = false;
        render();
      });
    }
    const activateInfoContinue = document.getElementById("activate-info-continue");
    if (activateInfoContinue) {
      activateInfoContinue.addEventListener("click", () => {
        const enableGpsToggle = document.getElementById("activate-enable-gps");
        state.meta.activateGpsEnabled = Boolean(enableGpsToggle && enableGpsToggle.checked);
        state.meta.activateInfoOpen = false;
        const kioskNavlog = buildActivateNavlogSnapshot();
        warmAirportChartsForActivate(kioskNavlog);
        persistKioskPayload({ navlog: kioskNavlog, activateGpsEnabled: state.meta.activateGpsEnabled });
        if (navigator.onLine === false) {
          state.navlog = kioskNavlog;
          state.meta.routeProgressMarkerSnapshot = null;
          state.view = "ipad-kiosk";
          normalizeActivateRows(false);
          render();
          return;
        }
        const url = new URL(window.location.href);
        url.searchParams.set("kiosk", "1");
        if (isIphoneDevice()) {
          window.location.href = url.toString();
          return;
        }
        window.open(url.toString(), "_blank", "noopener");
      });
    }
    document.getElementById("add-leg").addEventListener("click", () => {
      const newLeg = createBlankLeg("");
      state.navlog.legs.splice(state.navlog.legs.length - 1, 0, newLeg);
      const rpcRecord = getRpcRegistryRecord(state.navlog.header.rpCNo);
      const cruiseCas = String(rpcRecord && rpcRecord.casCruise ? rpcRecord.casCruise : "").trim();
      if (cruiseCas) {
        const insertedIndex = Math.max(1, state.navlog.legs.length - 2);
        setLegCasDefault(insertedIndex, cruiseCas);
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
          applyRpcAutofillFromHeader(event.target.value);
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
          applyRpcAutofillFromHeader(event.target.value);
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
        if (field === "distance") leg._distanceAutofillFromCoords = false;
        if (field === "tc") leg._tcAutofillFromCoords = false;
        if (field === "route") applyCoordinateAutofillAroundRoute(index);
        computeRouteMath({ index, field });
        updateComputedCells({ index, field });
        if (index === 0 && field === "alt") syncFirstAltHint();
        if (field === "route") syncRouteHints();
      });
      input.addEventListener("focus", () => {
        syncFirstAltHint();
        syncRouteHints();
      });
      input.addEventListener("blur", (event) => {
        const [indexText, field] = event.target.dataset.legField.split(":");
        if (field === "at") {
          const index = Number(indexText);
          const leg = state.navlog.legs[index];
          const parsedAtMinutes = parseAtInput(event.target.value);
          if (parsedAtMinutes != null) {
            const normalized = formatMinutesAsHhmm(parsedAtMinutes);
            event.target.value = normalized;
            leg[field] = normalized;
            leg._manual = leg._manual || {};
            leg._manual[field] = normalized.trim() !== "";
            computeRouteMath({ index, field });
            updateComputedCells({ index, field });
          }
        }
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
      const openDatePicker = () => {
        if (typeof datePickerInput.showPicker === "function") {
          datePickerInput.showPicker();
          return;
        }
        datePickerInput.focus();
        datePickerInput.click();
      };
      datePickerInput.addEventListener("change", (event) => {
        const picked = formatDateToDisplay(event.target.value);
        state.navlog.header.date = picked;
        const dateInput = document.querySelector('[data-header="date"]');
        if (dateInput) dateInput.value = picked;
      });
      datePickerInput.addEventListener("click", (event) => {
        if (state.view === "ipad-kiosk") event.preventDefault();
      });
      if (dateDisplayInput) {
        dateDisplayInput.setAttribute("readonly", "readonly");
        dateDisplayInput.addEventListener("click", openDatePicker);
      }
    }

    wireTocTodControls();

    document.querySelectorAll("[data-toc]").forEach((input) => {
      input.addEventListener("input", (event) => {
        const field = String(event.target.dataset.toc || "");
        if (!field) return;
        state.navlog.tocTod[field] = event.target.value;
        if (field === "tocDistance" || field === "tocTime") state.navlog.tocTod.tocManual = true;
        if (field === "todDistance" || field === "todTime") state.navlog.tocTod.todManual = true;
      });
      input.addEventListener("keydown", (event) => {
        if (event.key !== "Enter") return;
        event.preventDefault();
        const field = String(event.target.dataset.toc || "");
        if (!field) return;
        state.navlog.tocTod[field] = event.target.value;
        if (field === "tocDistance" || field === "tocTime") state.navlog.tocTod.tocManual = true;
        if (field === "todDistance" || field === "todTime") state.navlog.tocTod.todManual = true;
        computeRouteMath();
        updateComputedCells();
      });
      input.addEventListener("blur", (event) => {
        const field = String(event.target.dataset.toc || "");
        if (!field) return;
        state.navlog.tocTod[field] = event.target.value;
        if (field === "tocDistance" || field === "tocTime") state.navlog.tocTod.tocManual = true;
        if (field === "todDistance" || field === "todTime") state.navlog.tocTod.todManual = true;
      });
    });

    document.querySelectorAll("[data-radio-field]").forEach((input) => {
      input.addEventListener("input", (event) => {
        const [indexText, field] = event.target.dataset.radioField.split(":");
        const index = Number(indexText);
        state.navlog.radios[index][field] = event.target.value;
        if (field === "location" && String(event.target.value || "").trim() === "") {
          autofillAirportRow(index, "", { render: false });
          return;
        }
        if (field === "location") {
          autofillAirportRow(index, event.target.value, { render: false });
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
          showDistanceToGo: true,
          variationDeviationEnabled: false,
          pdfLayout: "default",
        });
      });
    }

    applyEditableNumericKeyboardDefaults();
    syncFirstAltHint();
    syncRouteHints();
    fitSheetToViewport(".sheet-wrap");
    requestAnimationFrame(() => fitSheetToViewport(".sheet-wrap"));
  }

  function applyEditableNumericKeyboardDefaults() {
    document.querySelectorAll(".sheet input").forEach((input) => {
      if (!input || input.type === "date") return;
      const legField = String(input.dataset.legField || "");
      const radioField = String(input.dataset.radioField || "");
      const footerField = String(input.dataset.footer || "");
      const tocField = String(input.dataset.tocEntry || "");
      if (legField.endsWith(":route")) {
        input.setAttribute("inputmode", "text");
        input.setAttribute("autocomplete", "off");
        input.setAttribute("autocapitalize", "off");
        input.setAttribute("spellcheck", "false");
        input.removeAttribute("pattern");
        return;
      }
      const useAlphabetKeyboard =
        radioField.endsWith(":location")
        || radioField.endsWith(":cptAtis")
        || footerField === "depAtisCode"
        || footerField === "destinAtisCode";
      if (useAlphabetKeyboard) {
        input.setAttribute("inputmode", "text");
        input.setAttribute("autocomplete", "off");
        input.setAttribute("autocapitalize", "characters");
        input.setAttribute("spellcheck", "false");
        input.removeAttribute("pattern");
        return;
      }
      if (tocField === "roc" || tocField === "rod") {
        input.setAttribute("inputmode", isTouchInputDevice() ? "text" : "numeric");
        input.setAttribute("enterkeyhint", "done");
        if (isTouchInputDevice()) input.removeAttribute("pattern");
        else input.setAttribute("pattern", "[0-9]*");
        return;
      }
      input.setAttribute("inputmode", "numeric");
      input.setAttribute("pattern", "[0-9]*");
    });
  }

  function isKioskEditableLegField(field) {
    return field === "route"
      || field === "alt"
      || field === "tc"
      || field === "ch"
      || field === "distance"
      || field === "gs"
      || field === "ta";
  }

  function wireIpadKiosk() {
    const phoneMode = isPhoneActivateMode();
    normalizeActivateRows(false);
    document.querySelectorAll(".mini-plus, .remove-chip, .blank-chip").forEach((node) => {
      node.style.display = "none";
    });
    const activateChartsButton = document.getElementById("open-activate-charts");
    if (activateChartsButton) {
      activateChartsButton.addEventListener("click", () => {
        openChartPreviewModal("", "", { activateMode: true, viewer: false });
      });
    }
    document.body.classList.add("kiosk-mode");
    if (!phoneMode) fitSheetToViewport(".ipad-kiosk-wrap");
    document.querySelectorAll("input, select, textarea, button").forEach((node) => {
      if (node.id === "kiosk-pad-clear") return;
      if (node.id === "kiosk-pad-close") return;
      const legField = String(node.getAttribute("data-leg-field") || "");
      const radioField = String(node.getAttribute("data-radio-field") || "");
      const footerField = String(node.getAttribute("data-footer") || "");
      const isTocTodTitle = String(node.getAttribute("data-edit-toc") || "") !== "";
      const isSpeedToggle = Boolean(node.getAttribute("data-kiosk-speed-mode"));
      const isWhereAmIOpenButton = node.id === "kiosk-whereami-open";
      const isActivateChartsButton = node.id === "open-activate-charts";
      const isTopScratchpadButton = node.id === "kiosk-top-scratchpad";
      const isKioskUtilityUi = Boolean(
        (node.closest && node.closest("#kiosk-route-estimate-overlay"))
        || (node.closest && node.closest("#kiosk-timer-alert-overlay"))
        || (node.closest && node.closest("#kiosk-whereami-overlay"))
        || (node.closest && node.closest("#chart-preview-overlay"))
        || (node.closest && node.closest(".kiosk-event-stack")),
      );
      const allowAt = legField.endsWith(":at");
      const [, legFieldName = ""] = legField.split(":");
      const allowKioskLegEdit = isKioskEditableLegField(legFieldName);
      const allowLocation = radioField.endsWith(":location");
      const allowAtisCode = footerField === "depAtisCode" || footerField === "destinAtisCode";
      const isHeadingToggle = Boolean(node.getAttribute("data-kiosk-heading-toggle"));
      const isAirportInfoAtisField =
        radioField.endsWith(":cptAtis")
        || radioField.endsWith(":depAap")
        || radioField.endsWith(":twr")
        || radioField.endsWith(":gnd")
        || radioField.endsWith(":fss");
      const isDateHeader = String(node.getAttribute("data-header") || "") === "date" || node.hasAttribute("data-date-picker");
      const keepInteractive = allowAt || allowKioskLegEdit || allowLocation || allowAtisCode || isKioskUtilityUi || isSpeedToggle || isHeadingToggle || isWhereAmIOpenButton || isActivateChartsButton || isTopScratchpadButton;
      if (!keepInteractive && node.tagName === "BUTTON" && !isTocTodTitle) node.style.display = "none";
      if (isAirportInfoAtisField) {
        node.tabIndex = -1;
        node.style.pointerEvents = "none";
      }
      if (isTocTodTitle) {
        node.classList.add("kiosk-static-toc");
        node.style.pointerEvents = "none";
      }
      if (isDateHeader) {
        if ("readOnly" in node) node.readOnly = true;
        if ("disabled" in node) node.disabled = true;
        node.tabIndex = -1;
        node.style.pointerEvents = "none";
        return;
      }
      if (!isKioskUtilityUi && node.tagName !== "BUTTON" && "readOnly" in node) node.readOnly = true;
      if (!isKioskUtilityUi && node.tagName !== "BUTTON" && "disabled" in node) node.disabled = false;
      if (!isKioskUtilityUi && "placeholder" in node) node.placeholder = "";
      if (allowAt) {
        const [rowText] = legField.split(":");
        const rowIndex = Number(rowText);
        node.placeholder = rowIndex === 0 ? "AB TIME" : "";
        node.setAttribute("inputmode", "numeric");
        node.setAttribute("pattern", "[0-9]*");
      }
      if (allowKioskLegEdit) {
        if (legFieldName === "route") {
          node.setAttribute("inputmode", "text");
          node.removeAttribute("pattern");
          node.setAttribute("autocomplete", "off");
          node.setAttribute("spellcheck", "false");
        } else {
          node.setAttribute("inputmode", "numeric");
          node.setAttribute("pattern", "[0-9]*");
        }
      }
      node.tabIndex = keepInteractive ? 0 : -1;
    });
    const legInputs = document.querySelectorAll("[data-leg-field]");
    legInputs.forEach((input) => {
      const key = String(input.dataset.legField || "");
      const isAtField = key.endsWith(":at");
      const [indexText, field] = key.split(":");
      const index = Number(indexText);
      const allowKioskLegEdit = isKioskEditableLegField(field);
      if (!isAtField) {
        input.readOnly = true;
        input.tabIndex = allowKioskLegEdit ? 0 : -1;
        if (field === "route") wireKioskRouteEstimateHold(input, Number(indexText));
        if (!allowKioskLegEdit) return;
        wireKioskDelayedKeyboard(input);
        input.addEventListener("input", (event) => {
          const [currentIndexText, currentField] = String(event.target.dataset.legField || "").split(":");
          const currentIndex = Number(currentIndexText);
          const activeField = currentField || field;
          const activeIndex = Number.isFinite(currentIndex) ? currentIndex : index;
          const leg = state.navlog.legs[activeIndex];
          if (!leg) return;
          let nextValue = event.target.value;
          if (isDegreeField(activeField)) {
            const parsed = num(nextValue);
            if (parsed != null) {
              nextValue = String(roundHalfUp(parsed));
              event.target.value = nextValue;
            }
          }
          leg[activeField] = nextValue;
          leg._manual = leg._manual || {};
          leg._manual[activeField] = nextValue.trim() !== "";
          if (activeField === "distance") leg._distanceAutofillFromCoords = false;
          if (activeField === "tc") leg._tcAutofillFromCoords = false;
          if (activeField === "route") applyCoordinateAutofillAroundRoute(activeIndex);
          computeRouteMath({ index: activeIndex, field: activeField });
          updateComputedCells({ index: activeIndex, field: activeField });
          if (activeField === "route") syncRouteHints();
        });
        input.addEventListener("blur", () => {
          persistKioskPayload();
        });
      } else {
        input.addEventListener("input", (event) => {
          const [indexText] = event.target.dataset.legField.split(":");
          const index = Number(indexText);
          const leg = state.navlog.legs[index];
          leg.at = event.target.value;
          leg._manual = leg._manual || {};
          leg._manual.at = String(event.target.value || "").trim() !== "";
          computeRouteMath({ index, field: "at" });
          updateComputedCells({ index, field: "at" });
        });
        input.addEventListener("blur", (event) => {
          const [indexText] = event.target.dataset.legField.split(":");
          const index = Number(indexText);
          const leg = state.navlog.legs[index];
          const parsedAtMinutes = parseAtInput(event.target.value);
          if (parsedAtMinutes == null) return;
          const normalized = formatMinutesAsHhmm(parsedAtMinutes);
          event.target.value = normalized;
          leg.at = normalized;
          leg._manual = leg._manual || {};
          leg._manual.at = true;
          clearFollowingAtFields(index);
          computeRouteMath({ index, field: "at" });
          updateComputedCells({ index, field: "at" });
          persistKioskPayload();
        });
        wireKioskDelayedKeyboard(input);
        wireKioskAtHoldUtc(input);
      }
    });

    document.querySelectorAll("[data-radio-field], [data-footer]").forEach((input) => {
      if (input.tagName !== "INPUT" && input.tagName !== "TEXTAREA") return;
      const radioField = String(input.getAttribute("data-radio-field") || "");
      const footerField = String(input.getAttribute("data-footer") || "");
      const allowDelayedKeyboard = radioField.endsWith(":location") || footerField === "depAtisCode" || footerField === "destinAtisCode";
      if (!allowDelayedKeyboard) return;
      wireKioskDelayedKeyboard(input);
    });

    if (phoneMode) {
      document.querySelectorAll("[data-kiosk-heading-toggle]").forEach((button) => {
        button.addEventListener("click", () => {
          toggleKioskPhoneHeadingField();
        });
      });
      document.querySelectorAll("[data-kiosk-speed-mode]").forEach((button) => {
        button.addEventListener("click", () => {
          const modeText = String(button.getAttribute("data-kiosk-speed-mode") || "");
          const mode = modeText === "ta" ? "ta" : "gs";
          setKioskPhoneSpeedCellMode(mode);
          document.querySelectorAll("[data-kiosk-speed-mode]").forEach((node) => {
            const nodeMode = String(node.getAttribute("data-kiosk-speed-mode") || "");
            node.classList.toggle("active", nodeMode === mode);
          });
          syncKioskPhoneSpeedDisplayValues();
          persistKioskPayload();
        });
      });
    }

    document.querySelectorAll("[data-radio-field$=':location']").forEach((input) => {
      wireKioskDelayedKeyboard(input);
      const commitAirportLocation = (node) => {
        if (!node) return;
        const [indexText] = String(node.dataset.radioField || "").split(":");
        autofillAirportRow(Number(indexText), node.value);
      };
      input.addEventListener("input", (event) => {
        const [indexText] = event.target.dataset.radioField.split(":");
        const index = Number(indexText);
        const value = String(event.target.value || "");
        state.navlog.radios[index].location = value;
        if (value.trim() === "") {
          autofillAirportRow(index, "", { render: false });
          return;
        }
        autofillAirportRow(index, value, { render: false });
      });
      input.addEventListener("change", (event) => {
        commitAirportLocation(event.target);
      });
      input.addEventListener("blur", (event) => {
        commitAirportLocation(event.target);
      });
      input.addEventListener("keydown", (event) => {
        if (event.key !== "Enter") return;
        event.preventDefault();
        commitAirportLocation(event.target);
      });
    });

    document.querySelectorAll('[data-footer="depAtisCode"], [data-footer="destinAtisCode"]').forEach((input) => {
      wireKioskDelayedKeyboard(input);
      input.addEventListener("input", (event) => {
        const key = String(event.target.dataset.footer || "");
        state.navlog[key] = event.target.value;
      });
    });

    wireKioskRouteEstimateModal();
    wireKioskWhereAmIControls();
    wireKioskEventTimerControls();
    wireKioskTimerAlertControls();
    wireKioskGpsPermissionPromptControls();
    syncKioskEventTimerDisplay();
    wireKioskScratchPadToggle();
    bindKioskDoubleTapGuard();
    bindKioskPullToRefreshGuard();
    setupKioskScratchPad();
    requestAnimationFrame(() => {
      if (!phoneMode) fitSheetToViewport(".ipad-kiosk-wrap");
      requestAnimationFrame(() => syncRouteProgressMarkerDisplay());
    });
  }

  function wireKioskDelayedKeyboard(input) {
    if (!input || input.dataset.longPressBound === "1") return;
    input.classList.add("kiosk-editable-on-tap");
    let unlocked = false;
    let tapCount = 0;
    let lastTapAt = 0;
    const tapWindowMs = 900;

    const unlockKeyboard = () => {
      unlocked = true;
      input.readOnly = false;
      input.classList.remove("at-hold-armed");
      input.classList.add("at-hold-done");
      setTimeout(() => input.classList.remove("at-hold-done"), 520);
      input.focus({ preventScroll: true });
      try {
        const length = String(input.value || "").length;
        input.setSelectionRange(length, length);
      } catch {
        // ignore unsupported selection APIs
      }
    };

    const registerTap = () => {
      if (!input.readOnly) return;
      if (input.dataset.atHoldCommitted === "1") {
        input.dataset.atHoldCommitted = "";
        tapCount = 0;
        return;
      }
      const now = Date.now();
      if ((now - lastTapAt) > tapWindowMs) tapCount = 0;
      tapCount += 1;
      lastTapAt = now;
      if (tapCount >= 2) {
        tapCount = 0;
        unlockKeyboard();
      }
    };

    if (window.PointerEvent) input.addEventListener("pointerup", registerTap);
    else {
      input.addEventListener("touchend", registerTap, { passive: true });
      input.addEventListener("mouseup", registerTap);
    }
    input.addEventListener("click", (event) => {
      if (input.readOnly) event.preventDefault();
    });
    input.addEventListener("focus", () => {
      if (input.readOnly) input.blur();
    });
    input.addEventListener("blur", () => {
      input.readOnly = true;
      unlocked = false;
      tapCount = 0;
    });
    input.dataset.longPressBound = "1";
  }

  function wireKioskAtHoldUtc(input) {
    if (!input || input.dataset.atHoldBound === "1") return;
    const cell = input.closest(".field");
    if (cell) cell.classList.add("at-hold-cell");
    let timer = null;
    let rafId = 0;
    let startedAt = 0;
    let startX = 0;
    let startY = 0;
    let pointerId = null;
    let committed = false;
    const holdMs = 2000;
    const maxMovePx = 36;

    const setProgress = (value) => {
      if (!cell) return;
      const next = Math.max(0, Math.min(1, Number(value) || 0));
      cell.style.setProperty("--at-hold-progress", String(next));
      cell.classList.toggle("at-hold-progress", next > 0 && next < 1);
    };

    const stopProgress = () => {
      if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = 0;
      }
      setProgress(0);
    };

    const tick = () => {
      if (!startedAt || committed) return;
      const elapsed = Date.now() - startedAt;
      const progress = elapsed / holdMs;
      setProgress(progress);
      if (progress >= 1) {
        commit();
        return;
      }
      rafId = requestAnimationFrame(tick);
    };

    const clear = () => {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      startedAt = 0;
      pointerId = null;
      stopProgress();
      input.classList.remove("at-hold-armed");
    };

    const maybeCancelOnMove = (clientX, clientY) => {
      if (!startedAt || committed) return;
      const dx = (Number(clientX) || 0) - startX;
      const dy = (Number(clientY) || 0) - startY;
      if (Math.hypot(dx, dy) > maxMovePx) clear();
    };

    const commit = () => {
      if (committed) return;
      const [indexText] = String(input.dataset.legField || "").split(":");
      const index = Number(indexText);
      if (!Number.isFinite(index) || index < 0 || index >= state.navlog.legs.length) return;
      committed = true;
      const utcNow = formatUtcNowHhmm();
      input.value = utcNow;
      const leg = state.navlog.legs[index];
      leg.at = utcNow;
      leg._manual = leg._manual || {};
      leg._manual.at = true;

      clearFollowingAtFields(index);

      computeRouteMath({ index, field: "at" });
      updateComputedCells({ index, field: "at" });
      persistKioskPayload();
      input.dataset.atHoldCommitted = "1";
      setProgress(1);
      input.classList.remove("at-hold-armed");
      input.classList.add("at-hold-done");
      setTimeout(() => input.classList.remove("at-hold-done"), 520);
      if (!input.readOnly) input.blur();
    };

    const start = (event) => {
      if (timer) clearTimeout(timer);
      committed = false;
      startedAt = Date.now();
      startX = Number(event && event.clientX) || 0;
      startY = Number(event && event.clientY) || 0;
      pointerId = Number.isFinite(Number(event && event.pointerId)) ? Number(event.pointerId) : null;
      if (pointerId != null && typeof input.setPointerCapture === "function") {
        try {
          input.setPointerCapture(pointerId);
        } catch {
          // ignore capture failures
        }
      }
      setProgress(0.001);
      input.classList.add("at-hold-armed");
      timer = setTimeout(() => {
        timer = null;
        commit();
      }, holdMs);
      rafId = requestAnimationFrame(tick);
    };

    const end = () => {
      if (!committed && startedAt && (Date.now() - startedAt) >= (holdMs - 40)) commit();
      clear();
    };

    input.addEventListener("contextmenu", (event) => event.preventDefault());

    if (window.PointerEvent) {
      input.addEventListener("pointerdown", (event) => start(event));
      input.addEventListener("pointermove", (event) => maybeCancelOnMove(event.clientX, event.clientY));
      input.addEventListener("pointerup", end);
      input.addEventListener("pointercancel", end);
    } else {
      input.addEventListener("touchstart", (event) => {
        const touch = event.touches && event.touches[0];
        start(touch || {});
      }, { passive: true });
      input.addEventListener("touchmove", (event) => {
        const touch = event.touches && event.touches[0];
        maybeCancelOnMove(touch ? touch.clientX : 0, touch ? touch.clientY : 0);
      }, { passive: true });
      input.addEventListener("touchend", end);
      input.addEventListener("touchcancel", end);
      input.addEventListener("mousedown", (event) => start(event));
      input.addEventListener("mousemove", (event) => maybeCancelOnMove(event.clientX, event.clientY));
      input.addEventListener("mouseup", end);
      input.addEventListener("mouseleave", end);
    }
    input.dataset.atHoldBound = "1";
  }

  function getKioskRouteEstimateDefaultGroundspeed(legIndex, direction) {
    const index = Number(legIndex);
    if (!Number.isFinite(index) || index < 0 || index >= state.navlog.legs.length) return "";
    const mode = direction === "inbound" ? "inbound" : "outbound";
    const currentLeg = state.navlog.legs[index] || {};
    if (mode === "inbound") {
      if (index <= 0) return "";
      const previousLeg = state.navlog.legs[index - 1] || {};
      return String(previousLeg.gs || "").trim();
    }
    return String(currentLeg.gs || "").trim();
  }

  function clearFollowingAtFields(anchorIndex) {
    const index = Number(anchorIndex);
    if (!Number.isFinite(index)) return;
    for (let nextIndex = index + 1; nextIndex < state.navlog.legs.length; nextIndex += 1) {
      const nextLeg = state.navlog.legs[nextIndex];
      if (!nextLeg) continue;
      nextLeg.at = "";
      nextLeg._manual = nextLeg._manual || {};
      nextLeg._manual.at = false;
    }
  }

  function getKioskDepartureRouteCode() {
    const legs = Array.isArray(state.navlog && state.navlog.legs) ? state.navlog.legs : [];
    return legs.length ? normalizeCode(legs[0].route) : "";
  }

  function getKioskDestinationRouteCode() {
    const legs = Array.isArray(state.navlog && state.navlog.legs) ? state.navlog.legs : [];
    return legs.length ? normalizeCode(legs[legs.length - 1].route) : "";
  }

  function setKioskWhereAmIState(next) {
    if (!state.meta.kioskGps) state.meta.kioskGps = createEmptyKioskGpsState();
    const previous = state.meta.kioskGps.whereAmI || { open: false, query: "", result: null, error: "" };
    state.meta.kioskGps.whereAmI = {
      ...previous,
      ...next,
    };
  }

  function getKioskCurrentGpsPoint() {
    const gps = state.meta && state.meta.kioskGps ? state.meta.kioskGps : null;
    if (!gps) return null;
    if (!Number.isFinite(gps.latitude) || !Number.isFinite(gps.longitude)) return null;
    return { lat: gps.latitude, lon: gps.longitude };
  }

  function computeWhereAmIResultForWaypoint(routeText) {
    const current = getKioskCurrentGpsPoint();
    if (!current) return { error: "GPS position unavailable." };
    const target = getWaypointCoordinate(routeText);
    if (!target) return { error: "Waypoint not recognized." };
    const distanceNm = computeGreatCircleDistanceNm(current.lat, current.lon, target.lat, target.lon);
    const headingTrue = computeInitialTrueBearing(current.lat, current.lon, target.lat, target.lon);
    if (!Number.isFinite(distanceNm) || !Number.isFinite(headingTrue)) return { error: "Could not compute position." };
    const liveSpeed = Number(state.meta?.kioskGps?.speedKts);
    let gpsEstimateHhmm = "";
    if (Number.isFinite(liveSpeed) && liveSpeed > 0) {
      const estimateUtcMs = Date.now() + Math.round((distanceNm / liveSpeed) * 60 * 60 * 1000);
      const estimateDate = new Date(estimateUtcMs);
      gpsEstimateHhmm = `${String(estimateDate.getUTCHours()).padStart(2, "0")}${String(estimateDate.getUTCMinutes()).padStart(2, "0")}`;
    }
    return {
      distanceNm,
      headingTrue,
      quadrant: bearingToCompass16(headingTrue),
      waypoint: normalizeCode(routeText),
      gpsEstimateHhmm,
    };
  }

  function getKioskDistanceUnitLabel() {
    return state.settings.distanceUnit === "km" ? "KM" : state.settings.distanceUnit === "sm" ? "SM" : "NM";
  }

  function resolveNavlogUtcMidnightMs() {
    const isoDate = normalizeDateInputValue(state.navlog?.header?.date);
    if (isoDate) {
      const [yearText, monthText, dayText] = isoDate.split("-");
      const year = Number(yearText);
      const month = Number(monthText);
      const day = Number(dayText);
      if (Number.isFinite(year) && Number.isFinite(month) && Number.isFinite(day)) {
        return Date.UTC(year, month - 1, day, 0, 0, 0, 0);
      }
    }
    const now = new Date();
    return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0);
  }

  function buildLegAbsoluteTimeTimeline() {
    const timeline = [];
    const legs = Array.isArray(state.navlog?.legs) ? state.navlog.legs : [];
    const dayMs = 24 * 60 * 60 * 1000;
    const halfDayMs = 12 * 60 * 60 * 1000;
    const baseMidnightMs = resolveNavlogUtcMidnightMs();
    let dayOffset = 0;
    let lastReferenceUtcMs = Number.NaN;
    const mapMinuteToUtcMs = (minuteOfDay, dayShift = dayOffset) => {
      return baseMidnightMs + (dayShift * dayMs) + Math.round(minuteOfDay * 60000);
    };
    const alignNearReference = (candidateUtcMs, referenceUtcMs) => {
      if (!Number.isFinite(candidateUtcMs) || !Number.isFinite(referenceUtcMs)) return candidateUtcMs;
      let aligned = candidateUtcMs;
      while (aligned < (referenceUtcMs - halfDayMs)) aligned += dayMs;
      while (aligned > (referenceUtcMs + halfDayMs)) aligned -= dayMs;
      return aligned;
    };
    legs.forEach((leg) => {
      const etMinutes = parseAtInput(leg?.et);
      const atMinutes = parseAtInput(leg?.at);
      const referenceMinutes = Number.isFinite(atMinutes) ? atMinutes : (Number.isFinite(etMinutes) ? etMinutes : Number.NaN);
      let referenceUtcMs = Number.NaN;
      if (Number.isFinite(referenceMinutes)) {
        referenceUtcMs = mapMinuteToUtcMs(referenceMinutes, dayOffset);
        while (Number.isFinite(lastReferenceUtcMs) && referenceUtcMs < (lastReferenceUtcMs - 30000)) {
          dayOffset += 1;
          referenceUtcMs = mapMinuteToUtcMs(referenceMinutes, dayOffset);
        }
        lastReferenceUtcMs = referenceUtcMs;
      }
      const etUtcMs = Number.isFinite(etMinutes)
        ? alignNearReference(mapMinuteToUtcMs(etMinutes, dayOffset), referenceUtcMs)
        : Number.NaN;
      const atUtcMs = Number.isFinite(atMinutes)
        ? alignNearReference(mapMinuteToUtcMs(atMinutes, dayOffset), referenceUtcMs)
        : Number.NaN;
      timeline.push({ etUtcMs, atUtcMs, referenceUtcMs });
    });
    return timeline;
  }

  function computeKioskRouteLiveDistanceInfo(legIndex, preferredGroundspeedRaw = "", nowMs = Date.now()) {
    const index = Number(legIndex);
    if (!Number.isFinite(index) || index < 0 || index >= state.navlog.legs.length) return null;
    const timeline = buildLegAbsoluteTimeTimeline();
    const referenceUtcMs = Number(timeline[index]?.referenceUtcMs);
    if (!Number.isFinite(referenceUtcMs)) return null;

    const direction = nowMs < referenceUtcMs ? "inbound" : "outbound";
    const isInbound = direction === "inbound";
    const speedLegIndex = isInbound ? index - 1 : index;
    if (speedLegIndex < 0 || speedLegIndex >= state.navlog.legs.length) return null;

    const speedFromLegKnots = parseSpeedInput(state.navlog.legs[speedLegIndex]?.gs);
    const speedFromModalKnots = parseSpeedInput(preferredGroundspeedRaw);
    const speedKnots = Number.isFinite(speedFromLegKnots) && speedFromLegKnots > 0 ? speedFromLegKnots : speedFromModalKnots;
    if (!Number.isFinite(speedKnots) || speedKnots <= 0) return null;

    const deltaHours = Math.abs(referenceUtcMs - nowMs) / (60 * 60 * 1000);
    const distanceNm = deltaHours * speedKnots;
    return { direction, distanceNm };
  }

  function getKioskRouteTimeDirection(legIndex, nowMs = Date.now()) {
    const index = Number(legIndex);
    if (!Number.isFinite(index) || index < 0 || index >= state.navlog.legs.length) return "";
    const timeline = buildLegAbsoluteTimeTimeline();
    const referenceUtcMs = Number(timeline[index]?.referenceUtcMs);
    if (!Number.isFinite(referenceUtcMs)) return "";
    return nowMs < referenceUtcMs ? "inbound" : "outbound";
  }

  function computeKioskRouteGpsRelativeInfo(legIndex) {
    const index = Number(legIndex);
    if (!Number.isFinite(index) || index < 0 || index >= state.navlog.legs.length) return { error: "Waypoint unavailable." };
    const leg = state.navlog.legs[index] || {};
    const routeCode = normalizeCode(leg.route);
    if (!routeCode) return { error: "Waypoint unavailable." };
    const target = getWaypointCoordinate(routeCode);
    if (!target) return { error: "Waypoint coordinates unavailable." };
    const current = getKioskCurrentGpsPoint();
    if (!current) return { error: "GPS position unavailable." };
    const distanceNm = computeGreatCircleDistanceNm(current.lat, current.lon, target.lat, target.lon);
    const headingToWaypoint = computeInitialTrueBearing(current.lat, current.lon, target.lat, target.lon);
    const waypointToUserBearing = computeInitialTrueBearing(target.lat, target.lon, current.lat, current.lon);
    if (!Number.isFinite(distanceNm) || !Number.isFinite(waypointToUserBearing) || !Number.isFinite(headingToWaypoint)) return { error: "Could not compute GPS position." };
    return {
      distanceNm,
      headingTrue: headingToWaypoint,
      quadrant: bearingToCompass16(waypointToUserBearing),
      routeCode,
    };
  }

  function computeKioskGpsReminderEstimateFromDraft(model, nowMs = Date.now()) {
    if (!model || !model.open) return null;
    const direction = getKioskRouteTimeDirection(model.legIndex, nowMs) || "outbound";
    const targetDistanceNm = parseDistanceInputWithUnit(model.distance, "nm");
    if (!Number.isFinite(targetDistanceNm) || targetDistanceNm <= 0) {
      return { error: "Distance invalid. cannot compute." };
    }
    const relative = computeKioskRouteGpsRelativeInfo(model.legIndex);
    if (relative && relative.error) return { error: relative.error };
    const currentDistanceNm = Number(relative.distanceNm);
    if (!Number.isFinite(currentDistanceNm)) return { error: "Could not compute GPS position." };
    const liveGpsSpeed = Number(state.meta?.kioskGps?.speedKts);
    const speedKnots = Number.isFinite(liveGpsSpeed) && liveGpsSpeed > 0 ? liveGpsSpeed : Number.NaN;
    const remainingNm = direction === "inbound"
      ? Math.max(0, currentDistanceNm - targetDistanceNm)
      : Math.max(0, targetDistanceNm - currentDistanceNm);
    const dueUtcMs = Number.isFinite(speedKnots) ? nowMs + Math.round((remainingNm / speedKnots) * 60 * 60 * 1000) : Number.NaN;
    const dueDate = Number.isFinite(dueUtcMs) ? new Date(dueUtcMs) : null;
    const hhmm = dueDate ? `${String(dueDate.getUTCHours()).padStart(2, "0")}${String(dueDate.getUTCMinutes()).padStart(2, "0")}` : "";
    return {
      direction,
      speedKnots,
      targetDistanceNm,
      currentDistanceNm,
      remainingNm,
      dueUtcMs,
      hhmm,
      routeCode: String(relative.routeCode || ""),
      quadrant: String(relative.quadrant || ""),
      distanceNm: currentDistanceNm,
    };
  }

  function computeKioskGpsStationEstimate(legIndex, nowMs = Date.now()) {
    const relative = computeKioskRouteGpsRelativeInfo(legIndex);
    if (!relative || relative.error) return { error: relative && relative.error ? relative.error : "GPS position unavailable." };
    const liveSpeed = Number(state.meta?.kioskGps?.speedKts);
    if (!Number.isFinite(liveSpeed) || liveSpeed <= 0) return { error: "No GS avbl" };
    const direction = getKioskRouteTimeDirection(legIndex, nowMs) || "outbound";
    const offsetMs = Math.round((Number(relative.distanceNm) / liveSpeed) * 60 * 60 * 1000);
    const estimateUtcMs = direction === "inbound" ? (nowMs + offsetMs) : (nowMs - offsetMs);
    const estimateDate = new Date(estimateUtcMs);
    const hhmm = `${String(estimateDate.getUTCHours()).padStart(2, "0")}${String(estimateDate.getUTCMinutes()).padStart(2, "0")}`;
    return { hhmm, direction };
  }

  function computeKioskRouteLiveDistanceText(model, nowMs = Date.now()) {
    if (!model || !model.open) return "";
    const live = computeKioskRouteLiveDistanceInfo(model.legIndex, model.groundspeed, nowMs);
    if (!live) return "";
    const unitLabel = getKioskDistanceUnitLabel();
    const distanceText = formatDistanceDisplayWithRounding(live.distanceNm, false);
    return `${distanceText} ${unitLabel}`;
  }

  function syncKioskRouteEstimateLiveDistanceDisplay() {
    const node = document.getElementById("kiosk-estimate-context");
    if (!node) return;
    const model = state.meta.kioskRouteEstimate;
    const routeLabel = String(model?.routeLabel || "Waypoint");
    if (isActivateGpsEnabled()) {
      node.textContent = routeLabel;
      const directionNode = document.getElementById("kiosk-route-gps-direction");
      const distanceNode = document.getElementById("kiosk-route-gps-distance");
      const quadrantNode = document.getElementById("kiosk-route-gps-quadrant");
      const stationEstimateNode = document.getElementById("kiosk-route-gps-station-estimate");
      const estimateNode = document.getElementById("kiosk-route-estimate-result");
      const relative = computeKioskRouteGpsRelativeInfo(model?.legIndex);
      if (directionNode) directionNode.textContent = relative && !relative.error && Number.isFinite(relative.headingTrue) ? `${String(roundHalfUp(relative.headingTrue)).padStart(3, "0")}°T` : "--";
      if (distanceNode) {
        distanceNode.textContent = relative && !relative.error && Number.isFinite(relative.distanceNm)
          ? `${formatDistanceDisplayWithRounding(relative.distanceNm, false)} NM`
          : "--";
      }
      if (quadrantNode) quadrantNode.textContent = relative && !relative.error ? String(relative.quadrant || "--") : "--";
      const stationEstimate = computeKioskGpsStationEstimate(model?.legIndex, Date.now());
      if (stationEstimateNode) {
        const strong = stationEstimateNode.querySelector("strong");
        if (strong) strong.textContent = stationEstimate && !stationEstimate.error ? `${stationEstimate.hhmm}Z` : "--";
      }
      const estimate = computeKioskGpsReminderEstimateFromDraft(model, Date.now());
      if (estimateNode) {
        const strong = estimateNode.querySelector("strong");
        if (!estimate || estimate.error || !estimate.hhmm) {
          estimateNode.classList.add("hidden");
          if (strong) strong.textContent = "--";
        } else {
          estimateNode.classList.remove("hidden");
          if (strong) strong.textContent = `${estimate.hhmm}Z`;
        }
      }
      return;
    }
    const liveDistanceText = computeKioskRouteLiveDistanceText(model);
    node.textContent = liveDistanceText ? `${routeLabel} (${liveDistanceText})` : routeLabel;
    const estimateNode = document.getElementById("kiosk-route-estimate-result");
    if (estimateNode) {
      const strong = estimateNode.querySelector("strong");
      const estimate = computeKioskRouteEstimateFromDraft();
      if (estimate && !estimate.error) {
        if (strong) strong.textContent = `${estimate.hhmm}Z`;
        estimateNode.classList.remove("hidden");
        model.resultLabel = estimate.label;
        model.resultHhmm = estimate.hhmm;
        model.resultMinuteOfDay = estimate.minuteOfDay;
      } else {
        if (strong) strong.textContent = "--";
        estimateNode.classList.remove("hidden");
        model.resultLabel = "";
        model.resultHhmm = "";
        model.resultMinuteOfDay = null;
      }
    }
  }

  function openKioskRouteEstimateModalForLeg(legIndex) {
    if (!Number.isFinite(legIndex) || legIndex < 0 || legIndex >= state.navlog.legs.length) return;
    const leg = state.navlog.legs[legIndex] || {};
    const routeLabel = String(leg.route || "").trim() || `Waypoint ${legIndex + 1}`;
    const direction = isActivateGpsEnabled() ? (getKioskRouteTimeDirection(legIndex) || "outbound") : "";
    const defaultGpsSpeed = Number.isFinite(state.meta?.kioskGps?.speedKts) ? formatSpeedDisplayForUnit(state.meta.kioskGps.speedKts, "kts") : "";
    state.meta.kioskRouteEstimate = {
      ...createEmptyKioskRouteEstimateState(),
      open: true,
      legIndex,
      routeLabel,
      routeCode: normalizeCode(leg.route),
      direction,
      distance: "10",
      groundspeed: isActivateGpsEnabled()
        ? (defaultGpsSpeed || getKioskRouteEstimateDefaultGroundspeed(legIndex, direction))
        : getKioskRouteEstimateDefaultGroundspeed(legIndex, direction),
    };
    render();
  }

  function insertKioskRouteRowRelativeTo(legIndex, direction) {
    const index = Number(legIndex);
    if (!Number.isFinite(index) || index < 0 || index >= state.navlog.legs.length) return;
    const lastIndex = Math.max(0, state.navlog.legs.length - 1);
    const targetIndex = direction === "above"
      ? Math.max(1, Math.min(index, lastIndex))
      : Math.max(1, Math.min(index + 1, lastIndex));
    const insertedLeg = createBlankLeg("");
    insertedLeg._kioskCreated = true;
    state.navlog.legs.splice(targetIndex, 0, insertedLeg);
    normalizeDestinationLegPlacement(state.navlog);
    persistKioskPayload();
    state.meta.kioskRouteEstimate = createEmptyKioskRouteEstimateState();
    render();
  }

  function removeKioskRouteRowAt(legIndex) {
    const index = Number(legIndex);
    if (!Number.isFinite(index) || index <= 0 || index >= (state.navlog.legs.length - 1)) return;
    state.navlog.legs.splice(index, 1);
    normalizeDestinationLegPlacement(state.navlog);
    persistKioskPayload();
    state.meta.kioskRouteEstimate = createEmptyKioskRouteEstimateState();
    render();
  }

  function wireKioskRouteEstimateHold(input, legIndex) {
    if (!input || input.dataset.routeHoldBound === "1") return;
    const cell = input.closest(".route-cell");
    let timer = null;
    let rafId = 0;
    let startX = 0;
    let startY = 0;
    let startedAt = 0;
    let started = false;
    let committed = false;
    const holdMs = 2000;
    const maxMovePx = 44;

    const setProgress = (value) => {
      if (!cell) return;
      const next = Math.max(0, Math.min(1, Number(value) || 0));
      cell.style.setProperty("--at-hold-progress", String(next));
      cell.classList.toggle("at-hold-progress", next > 0 && next < 1);
    };

    const stopProgress = () => {
      if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = 0;
      }
      setProgress(0);
    };

    const tick = () => {
      if (!started || committed) return;
      const elapsed = Date.now() - startedAt;
      const progress = elapsed / holdMs;
      setProgress(progress);
      if (progress >= 1) return;
      rafId = requestAnimationFrame(tick);
    };

    const commit = () => {
      if (committed) return;
      committed = true;
      openKioskRouteEstimateModalForLeg(legIndex);
    };

    const clear = (skipThresholdCommit = false) => {
      if (!skipThresholdCommit && !committed && startedAt && (Date.now() - startedAt) >= (holdMs - 40)) {
        commit();
      }
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      startedAt = 0;
      started = false;
      stopProgress();
      if (cell) {
        cell.classList.remove("route-hold-armed");
        cell.classList.remove("at-hold-armed");
      }
    };

    const begin = (clientX, clientY, event) => {
      clear();
      committed = false;
      startX = Number(clientX) || 0;
      startY = Number(clientY) || 0;
      startedAt = Date.now();
      started = true;
      if (window.PointerEvent && typeof input.setPointerCapture === "function" && Number.isFinite(Number(event && event.pointerId))) {
        try {
          input.setPointerCapture(Number(event.pointerId));
        } catch {
          // ignore capture failures
        }
      }
      if (cell) {
        cell.classList.add("route-hold-armed");
        cell.classList.add("at-hold-cell");
        cell.classList.add("at-hold-armed");
      }
      setProgress(0.001);
      rafId = requestAnimationFrame(tick);
      timer = setTimeout(() => {
        timer = null;
        commit();
        clear(true);
      }, holdMs);
    };

    const maybeCancelOnMove = (clientX, clientY) => {
      if (!started) return;
      const dx = (Number(clientX) || 0) - startX;
      const dy = (Number(clientY) || 0) - startY;
      if (Math.hypot(dx, dy) > maxMovePx) clear();
    };

    if (window.PointerEvent) {
      input.addEventListener("pointerdown", (event) => begin(event.clientX, event.clientY, event));
      input.addEventListener("pointermove", (event) => maybeCancelOnMove(event.clientX, event.clientY));
      input.addEventListener("pointerup", clear);
      input.addEventListener("pointercancel", clear);
      input.addEventListener("pointerleave", clear);
    } else {
      input.addEventListener("touchstart", (event) => {
        const touch = event.touches && event.touches[0];
        begin(touch ? touch.clientX : 0, touch ? touch.clientY : 0);
      }, { passive: true });
      input.addEventListener("touchmove", (event) => {
        const touch = event.touches && event.touches[0];
        maybeCancelOnMove(touch ? touch.clientX : 0, touch ? touch.clientY : 0);
      }, { passive: true });
      input.addEventListener("touchend", clear);
      input.addEventListener("touchcancel", clear);
      input.addEventListener("mousedown", (event) => begin(event.clientX, event.clientY));
      input.addEventListener("mousemove", (event) => maybeCancelOnMove(event.clientX, event.clientY));
      input.addEventListener("mouseup", clear);
      input.addEventListener("mouseleave", clear);
    }
    input.addEventListener("contextmenu", (event) => event.preventDefault());
    input.dataset.routeHoldBound = "1";
  }

  function wireKioskRouteEstimateModal() {
    const overlay = document.getElementById("kiosk-route-estimate-overlay");
    if (!overlay) return;
    const gpsEnabled = isActivateGpsEnabled();
    const closeButton = document.getElementById("kiosk-route-estimate-close");
    const computeButton = document.getElementById("kiosk-route-estimate-compute");
    const setTimerButton = document.getElementById("kiosk-route-estimate-set-timer");
    const distanceInput = document.getElementById("kiosk-route-estimate-distance");
    const gsInput = document.getElementById("kiosk-route-estimate-gs");
    const draftInputs = [distanceInput, gsInput].filter(Boolean);
    draftInputs.forEach((input) => {
      input.addEventListener("input", () => {
        syncKioskRouteEstimateDraftFromDom();
        syncKioskRouteEstimateLiveDistanceDisplay();
      });
      input.addEventListener("change", () => {
        syncKioskRouteEstimateDraftFromDom();
        syncKioskRouteEstimateLiveDistanceDisplay();
      });
    });
    if (!gpsEnabled) {
      document.querySelectorAll("[data-kiosk-direction]").forEach((button) => {
        button.addEventListener("click", () => {
          syncKioskRouteEstimateDraftFromDom();
          const nextDirection = button.dataset.kioskDirection === "inbound" ? "inbound" : "outbound";
          state.meta.kioskRouteEstimate.direction = nextDirection;
          state.meta.kioskRouteEstimate.groundspeed = getKioskRouteEstimateDefaultGroundspeed(state.meta.kioskRouteEstimate.legIndex, nextDirection);
          state.meta.kioskRouteEstimate.error = "";
          state.meta.kioskRouteEstimate.resultLabel = "";
          state.meta.kioskRouteEstimate.resultHhmm = "";
          state.meta.kioskRouteEstimate.resultMinuteOfDay = null;
          render();
          syncKioskRouteEstimateLiveDistanceDisplay();
        });
      });
    }
    document.querySelectorAll("[data-kiosk-distance-preset]").forEach((button) => {
      button.addEventListener("click", () => {
        const value = String(button.dataset.kioskDistancePreset || "");
        const inputNode = document.getElementById("kiosk-route-estimate-distance");
        if (inputNode) inputNode.value = value;
        state.meta.kioskRouteEstimate.distance = value;
        syncKioskRouteEstimateLiveDistanceDisplay();
      });
    });

    if (closeButton) {
      closeButton.addEventListener("click", () => {
        state.meta.kioskRouteEstimate = createEmptyKioskRouteEstimateState();
        render();
      });
    }

    overlay.addEventListener("click", (event) => {
      if (event.target !== overlay) return;
      state.meta.kioskRouteEstimate = createEmptyKioskRouteEstimateState();
      render();
    });

    if (computeButton) {
      computeButton.addEventListener("click", () => {
        if (gpsEnabled) return;
        syncKioskRouteEstimateDraftFromDom();
        const result = computeKioskRouteEstimateFromDraft();
        const model = state.meta.kioskRouteEstimate;
        if (!result) {
          model.error = "ET/AT unavailable. cannot compute.";
          model.resultLabel = "";
          model.resultHhmm = "";
          model.resultMinuteOfDay = null;
          render();
          return;
        }
        if (result.error) {
          model.error = result.error;
          model.resultLabel = "";
          model.resultHhmm = "";
          model.resultMinuteOfDay = null;
          render();
          return;
        }
        model.error = "";
        model.resultLabel = result.label;
        model.resultHhmm = result.hhmm;
        model.resultMinuteOfDay = result.minuteOfDay;
        render();
      });
    }

    if (setTimerButton) {
      setTimerButton.addEventListener("click", () => {
        syncKioskRouteEstimateDraftFromDom();
        if (gpsEnabled) {
          const model = state.meta.kioskRouteEstimate;
          const reminder = computeKioskGpsReminderEstimateFromDraft(model);
          if (!reminder) {
            model.error = "Distance invalid. cannot compute.";
            render();
            return;
          }
          if (reminder.error) {
            model.error = reminder.error;
            render();
            return;
          }
          model.error = "";
          setKioskGpsDistanceReminderFromEstimate(model, reminder);
          state.meta.kioskRouteEstimate = createEmptyKioskRouteEstimateState();
          render();
          return;
        }
        const result = computeKioskRouteEstimateFromDraft();
        const model = state.meta.kioskRouteEstimate;
        if (!result) {
          model.error = "ET/AT unavailable. cannot compute.";
          model.resultLabel = "";
          model.resultHhmm = "";
          model.resultMinuteOfDay = null;
          render();
          return;
        }
        if (result.error) {
          model.error = result.error;
          model.resultLabel = "";
          model.resultHhmm = "";
          model.resultMinuteOfDay = null;
          render();
          return;
        }
        setKioskEventTimerFromEstimate(result);
        state.meta.kioskRouteEstimate = createEmptyKioskRouteEstimateState();
        render();
      });
    }

    const addAboveButton = document.getElementById("kiosk-route-estimate-add-above");
    if (addAboveButton) {
      addAboveButton.addEventListener("click", () => {
        insertKioskRouteRowRelativeTo(state.meta.kioskRouteEstimate.legIndex, "above");
      });
    }
    const addBelowButton = document.getElementById("kiosk-route-estimate-add-below");
    if (addBelowButton) {
      addBelowButton.addEventListener("click", () => {
        insertKioskRouteRowRelativeTo(state.meta.kioskRouteEstimate.legIndex, "below");
      });
    }
    const removeRouteButton = document.getElementById("kiosk-route-estimate-remove-route");
    if (removeRouteButton) {
      removeRouteButton.addEventListener("click", () => {
        if (!window.confirm("Are you sure you wish to delete this waypoint?")) return;
        removeKioskRouteRowAt(state.meta.kioskRouteEstimate.legIndex);
      });
    }
    syncKioskRouteEstimateLiveDistanceDisplay();
  }

  function readKioskWhereAmIQueryFromDom() {
    const input = document.getElementById("kiosk-whereami-query");
    if (!input) return;
    setKioskWhereAmIState({ query: String(input.value || "") });
  }

  function syncKioskWhereAmIResultDom() {
    const model = state.meta.kioskGps && state.meta.kioskGps.whereAmI ? state.meta.kioskGps.whereAmI : { result: null, error: "" };
    const result = model.result || null;
    const errorNode = document.getElementById("kiosk-whereami-error");
    const distanceNode = document.getElementById("kiosk-whereami-distance");
    const quadrantNode = document.getElementById("kiosk-whereami-quadrant");
    const headingNode = document.getElementById("kiosk-whereami-heading");
    const estimateNode = document.getElementById("kiosk-whereami-estimate");
    if (errorNode) {
      errorNode.textContent = String(model.error || "");
      errorNode.classList.toggle("hidden", !model.error);
    }
    if (distanceNode) {
      distanceNode.textContent = result && Number.isFinite(result.distanceNm)
        ? `${formatDistanceDisplayWithRounding(result.distanceNm, false)} NM`
        : "--";
    }
    if (quadrantNode) quadrantNode.textContent = result && result.quadrant ? result.quadrant : "--";
    if (headingNode) headingNode.textContent = result && Number.isFinite(result.headingTrue) ? `${String(roundHalfUp(result.headingTrue)).padStart(3, "0")}°T` : "--";
    if (estimateNode) estimateNode.textContent = result && result.gpsEstimateHhmm ? `${String(result.gpsEstimateHhmm).trim()}Z` : "--";
  }

  function computeAndStoreKioskWhereAmI(options = {}) {
    const shouldRender = options.render === true;
    if (!isActivateGpsEnabled()) {
      setKioskWhereAmIState({ result: null, error: "GPS unavailable." });
      if (shouldRender) render();
      else syncKioskWhereAmIResultDom();
      return;
    }
    const model = state.meta.kioskGps && state.meta.kioskGps.whereAmI ? state.meta.kioskGps.whereAmI : { query: "" };
    const query = String(model.query || "").trim();
    if (!query) {
      setKioskWhereAmIState({ result: null, error: "" });
      if (shouldRender) render();
      else syncKioskWhereAmIResultDom();
      return;
    }
    const result = computeWhereAmIResultForWaypoint(query);
    if (result && result.error) {
      setKioskWhereAmIState({ result: null, error: result.error });
      if (shouldRender) render();
      else syncKioskWhereAmIResultDom();
      return;
    }
    setKioskWhereAmIState({ result, error: "" });
    if (shouldRender) render();
    else syncKioskWhereAmIResultDom();
  }

  function wireKioskWhereAmIControls() {
    if (!isActivateGpsEnabled()) return;
    const openButton = document.getElementById("kiosk-whereami-open");
    if (openButton) {
      openButton.addEventListener("click", () => {
        const current = state.meta.kioskGps && state.meta.kioskGps.whereAmI ? state.meta.kioskGps.whereAmI : null;
        setKioskWhereAmIState({
          open: true,
          query: current && current.query ? current.query : "",
          error: "",
        });
        render();
      });
    }

    const overlay = document.getElementById("kiosk-whereami-overlay");
    if (!overlay) return;
    const closeButton = document.getElementById("kiosk-whereami-close");
    const queryInput = document.getElementById("kiosk-whereami-query");
    const depButton = document.getElementById("kiosk-whereami-use-departure");
    const destButton = document.getElementById("kiosk-whereami-use-destination");

    if (queryInput) {
      queryInput.addEventListener("input", () => {
        readKioskWhereAmIQueryFromDom();
        computeAndStoreKioskWhereAmI();
      });
      queryInput.addEventListener("change", () => {
        readKioskWhereAmIQueryFromDom();
        computeAndStoreKioskWhereAmI();
      });
      queryInput.addEventListener("keydown", (event) => {
        if (event.key !== "Enter") return;
        event.preventDefault();
        readKioskWhereAmIQueryFromDom();
        computeAndStoreKioskWhereAmI();
      });
    }

    if (depButton) {
      depButton.addEventListener("click", () => {
        const departure = getKioskDepartureRouteCode();
        setKioskWhereAmIState({ query: departure, error: "" });
        const inputNode = document.getElementById("kiosk-whereami-query");
        if (inputNode) inputNode.value = departure;
        computeAndStoreKioskWhereAmI();
      });
    }

    if (destButton) {
      destButton.addEventListener("click", () => {
        const destination = getKioskDestinationRouteCode();
        setKioskWhereAmIState({ query: destination, error: "" });
        const inputNode = document.getElementById("kiosk-whereami-query");
        if (inputNode) inputNode.value = destination;
        computeAndStoreKioskWhereAmI();
      });
    }

    if (closeButton) {
      closeButton.addEventListener("click", () => {
        setKioskWhereAmIState({ open: false, error: "" });
        render();
      });
    }

    overlay.addEventListener("click", (event) => {
      if (event.target !== overlay) return;
      setKioskWhereAmIState({ open: false, error: "" });
      render();
    });
    computeAndStoreKioskWhereAmI();
  }

  function wireKioskGpsPermissionPromptControls() {
    const overlay = document.getElementById("activate-gps-prompt-overlay");
    if (!overlay) return;
    const yesButton = document.getElementById("activate-gps-yes");
    const noButton = document.getElementById("activate-gps-no");
    if (yesButton) {
      yesButton.addEventListener("click", () => {
        state.meta.gpsPermissionPromptOpen = false;
        state.meta.activateGpsEnabled = false;
        persistKioskPayload({ activateGpsEnabled: false });
        stopKioskGpsTracking();
        render();
      });
    }
    if (noButton) {
      noButton.addEventListener("click", () => {
        state.meta.gpsPermissionPromptOpen = false;
        render();
        retryKioskGpsPermissionRequest();
      });
    }
    overlay.addEventListener("click", (event) => {
      if (event.target !== overlay) return;
      state.meta.gpsPermissionPromptOpen = false;
      render();
      retryKioskGpsPermissionRequest();
    });
  }

  function wireKioskEventTimerControls() {
    document.querySelectorAll("[data-kiosk-timer-clear]").forEach((button) => {
      button.addEventListener("click", () => {
        const timerId = String(button.dataset.kioskTimerClear || "");
        const timers = Array.isArray(state.meta.kioskEventTimer) ? state.meta.kioskEventTimer : [];
        const timer = timers.find((item) => String(item.id) === timerId);
        const prompt = timer && String(timer.kind || "") === "gps-distance" ? "Clear alert?" : "Clear timer?";
        if (!window.confirm(prompt)) return;
        state.meta.kioskEventTimer = timers.filter((timer) => String(timer.id) !== timerId);
        render();
      });
    });
  }

  function wireKioskTimerAlertControls() {
    const acknowledgeButton = document.getElementById("kiosk-timer-alert-ack");
    if (!acknowledgeButton) return;
    acknowledgeButton.addEventListener("click", () => {
      const queue = Array.isArray(state.meta.kioskTimerAlerts) ? state.meta.kioskTimerAlerts.slice() : [];
      queue.shift();
      state.meta.kioskTimerAlerts = queue;
      render();
    });
  }

  function syncKioskRouteEstimateDraftFromDom() {
    const model = state.meta.kioskRouteEstimate;
    if (!model || !model.open) return;
    const distanceInput = document.getElementById("kiosk-route-estimate-distance");
    const gsInput = document.getElementById("kiosk-route-estimate-gs");
    if (distanceInput) model.distance = distanceInput.value;
    if (gsInput) model.groundspeed = gsInput.value;
  }

  function computeKioskRouteEstimateFromDraft() {
    const model = state.meta.kioskRouteEstimate;
    if (!model || !model.open) return null;
    const legIndex = Number(model.legIndex);
    if (!Number.isFinite(legIndex) || legIndex < 0 || legIndex >= state.navlog.legs.length) return null;
    const leg = state.navlog.legs[legIndex];
    if (!leg) return null;

    const distanceNm = parseDistanceInputWithUnit(model.distance, "nm");
    const groundspeedKnots = parseSpeedInput(model.groundspeed);
    if (distanceNm == null || !Number.isFinite(distanceNm) || distanceNm <= 0 || groundspeedKnots == null || !Number.isFinite(groundspeedKnots) || groundspeedKnots <= 0) {
      return { error: "Distance/groundspeed invalid. cannot compute." };
    }

    const offsetMs = (distanceNm / groundspeedKnots) * 60 * 60000;
    const direction = model.direction === "inbound" || model.direction === "outbound" ? model.direction : "";
    if (!direction) return { error: "Select inbound or outbound." };
    const timeline = buildLegAbsoluteTimeTimeline();
    const legTime = timeline[legIndex] || {};
    let baseUtcMs = Number.NaN;
    if (direction === "outbound") {
      baseUtcMs = Number.isFinite(legTime.atUtcMs) ? legTime.atUtcMs : legTime.etUtcMs;
    } else {
      baseUtcMs = legTime.etUtcMs;
    }
    if (!Number.isFinite(baseUtcMs)) {
      return { error: "ET/AT unavailable. cannot compute." };
    }

    const dueUtcMs = direction === "outbound" ? (baseUtcMs + offsetMs) : (baseUtcMs - offsetMs);
    const dueDate = new Date(dueUtcMs);
    const minuteOfDay = (dueDate.getUTCHours() * 60) + dueDate.getUTCMinutes();
    const hhmm = `${String(dueDate.getUTCHours()).padStart(2, "0")}${String(dueDate.getUTCMinutes()).padStart(2, "0")}`;
    const distanceLabel = formatDistanceDisplay(distanceNm);
    const distanceUnitLabel = getKioskDistanceUnitLabel();
    const routeLabel = String(leg.route || "").trim() || `Waypoint ${legIndex + 1}`;
    const relation = direction === "inbound" ? "to" : "from";
    const label = `${distanceLabel} ${distanceUnitLabel} ${direction} ${relation} ${routeLabel}`;
    return { minuteOfDay, hhmm, label, dueUtcMs };
  }

  function setKioskEventTimerFromEstimate(estimate) {
    if (!estimate || !Number.isFinite(estimate.minuteOfDay)) return;
    const dueUtcMs = Number.isFinite(estimate.dueUtcMs) ? estimate.dueUtcMs : computeNextUtcDueMs(estimate.minuteOfDay);
    const timers = Array.isArray(state.meta.kioskEventTimer) ? state.meta.kioskEventTimer.slice() : [];
    timers.push({
      id: `kt_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
      kind: "time",
      label: String(estimate.label || "Position estimate"),
      targetHhmm: String(estimate.hhmm || ""),
      dueUtcMs,
    });
    state.meta.kioskEventTimer = timers;
  }

  function setKioskGpsDistanceReminderFromEstimate(model, estimate) {
    if (!model || !estimate) return;
    const legIndex = Number(model.legIndex);
    const routeLabel = String(model.routeLabel || `Waypoint ${legIndex + 1}`);
    const routeCode = String(model.routeCode || routeLabel || "").trim();
    const direction = String(estimate.direction || getKioskRouteTimeDirection(legIndex) || "outbound");
    const toFromText = direction === "inbound" ? "to" : "from";
    const targetDistanceNm = Number(estimate.targetDistanceNm);
    if (!Number.isFinite(targetDistanceNm) || targetDistanceNm <= 0) return;
    const timers = Array.isArray(state.meta.kioskEventTimer) ? state.meta.kioskEventTimer.slice() : [];
    timers.push({
      id: `kg_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
      kind: "gps-distance",
      label: `Alert ${formatDistanceDisplay(targetDistanceNm)} NM ${toFromText} ${routeLabel}`,
      targetHhmm: String(estimate.hhmm || ""),
      waypointIndex: Number.isFinite(legIndex) ? legIndex : -1,
      waypointCode: routeCode,
      direction,
      targetDistanceNm,
      lastDistanceNm: Number(estimate.currentDistanceNm),
      speedKts: Number(estimate.speedKnots),
      dueUtcMs: Number(estimate.dueUtcMs || Date.now()),
    });
    state.meta.kioskEventTimer = timers;
  }

  function normalizeMinuteOfDay(minutesFloat) {
    if (!Number.isFinite(minutesFloat)) return 0;
    let roundedMinutes = roundHalfUp(minutesFloat) % 1440;
    if (roundedMinutes < 0) roundedMinutes += 1440;
    return roundedMinutes;
  }

  function formatMinutesAsHhmmWrapped(minutesFloat) {
    if (!Number.isFinite(minutesFloat)) return "";
    const minuteOfDay = normalizeMinuteOfDay(minutesFloat);
    const hours = Math.floor(minuteOfDay / 60);
    const minutes = minuteOfDay % 60;
    return `${String(hours).padStart(2, "0")}${String(minutes).padStart(2, "0")}`;
  }

  function computeNextUtcDueMs(targetMinuteOfDay) {
    const now = new Date();
    const normalizedTarget = normalizeMinuteOfDay(targetMinuteOfDay);
    const nowWholeMinutes = (now.getUTCHours() * 60) + now.getUTCMinutes();
    const secondsIntoMinute = now.getUTCSeconds() + (now.getUTCMilliseconds() / 1000);
    const minuteFraction = secondsIntoMinute / 60;
    const baseDeltaMinutes = (normalizedTarget - nowWholeMinutes + 1440) % 1440;
    const deltaMinutes = Math.max(0, baseDeltaMinutes - minuteFraction);
    return Date.now() + Math.round(deltaMinutes * 60000);
  }

  function resolveKioskTimerWaypointCode(timer) {
    const fromTimer = normalizeCode(timer && timer.waypointCode);
    if (fromTimer) return fromTimer;
    const legIndex = Number(timer && timer.waypointIndex);
    if (Number.isFinite(legIndex) && legIndex >= 0 && legIndex < state.navlog.legs.length) {
      return normalizeCode(state.navlog.legs[legIndex] && state.navlog.legs[legIndex].route);
    }
    return "";
  }

  function computeGpsDistanceNmForKioskTimer(timer) {
    const routeCode = resolveKioskTimerWaypointCode(timer);
    if (!routeCode) return null;
    const target = getWaypointCoordinate(routeCode);
    const current = getKioskCurrentGpsPoint();
    if (!target || !current) return null;
    const distanceNm = computeGreatCircleDistanceNm(current.lat, current.lon, target.lat, target.lon);
    return Number.isFinite(distanceNm) ? distanceNm : null;
  }

  function syncKioskEventTimerDisplay() {
    const timers = Array.isArray(state.meta.kioskEventTimer) ? state.meta.kioskEventTimer : [];
    if (!timers.length) {
      syncKioskTimerAlertDisplay();
      return;
    }
    const nowMs = Date.now();
    const completedTimerIds = [];
    timers.forEach((timer) => {
      const timerId = String(timer.id || "");
      if (!timerId) return;
      const countdownNode = document.querySelector(`[data-kiosk-timer-countdown="${timerId}"]`);
      const targetNode = document.querySelector(`[data-kiosk-timer-target="${timerId}"]`);
      const timerKind = String(timer.kind || "time");

      if (timerKind === "gps-distance") {
        const direction = timer.direction === "inbound" ? "inbound" : "outbound";
        const targetDistanceNm = Number(timer.targetDistanceNm);
        const liveDistanceNm = computeGpsDistanceNmForKioskTimer(timer);
        const routeCode = resolveKioskTimerWaypointCode(timer) || String(timer.waypointCode || "");
        const liveSpeed = Number.isFinite(state.meta?.kioskGps?.speedKts) ? Number(state.meta.kioskGps.speedKts) : Number.NaN;
        const timerSpeed = Number.isFinite(Number(timer.speedKts)) ? Number(timer.speedKts) : Number.NaN;
        const speedKts = Number.isFinite(liveSpeed) && liveSpeed > 0 ? liveSpeed : timerSpeed;
        const canMeasure = Number.isFinite(liveDistanceNm) && Number.isFinite(targetDistanceNm) && targetDistanceNm >= 0;
        const previousDistanceNm = Number(timer.lastDistanceNm);
        const reached = canMeasure
          ? (
            direction === "inbound"
              ? (liveDistanceNm <= targetDistanceNm || (Number.isFinite(previousDistanceNm) && previousDistanceNm > targetDistanceNm && liveDistanceNm < targetDistanceNm))
              : (liveDistanceNm >= targetDistanceNm || (Number.isFinite(previousDistanceNm) && previousDistanceNm < targetDistanceNm && liveDistanceNm > targetDistanceNm))
          )
          : false;

        if (countdownNode) {
          if (!Number.isFinite(liveDistanceNm)) countdownNode.textContent = "GPS unavailable";
          else countdownNode.textContent = `${formatDistanceDisplayWithRounding(liveDistanceNm, false)} NM`;
        }
        if (targetNode) {
          if (!canMeasure || !Number.isFinite(speedKts) || speedKts <= 0) {
            targetNode.textContent = `${routeCode || "--"} ${direction}`;
          } else {
            const remainingNm = direction === "inbound"
              ? Math.max(0, liveDistanceNm - targetDistanceNm)
              : Math.max(0, targetDistanceNm - liveDistanceNm);
            const dueUtcMs = nowMs + Math.round((remainingNm / speedKts) * 60 * 60 * 1000);
            const dueDate = new Date(dueUtcMs);
            const hhmm = `${String(dueDate.getUTCHours()).padStart(2, "0")}${String(dueDate.getUTCMinutes()).padStart(2, "0")}`;
            timer.targetHhmm = hhmm;
            timer.dueUtcMs = dueUtcMs;
            targetNode.textContent = `ETA ${hhmm}Z`;
          }
        }
        if (canMeasure) timer.lastDistanceNm = liveDistanceNm;
        if (reached) completedTimerIds.push(timerId);
        return;
      }

      const remainingMs = Number(timer.dueUtcMs || 0) - nowMs;
      if (countdownNode) countdownNode.textContent = `T-${formatDurationClockFromMs(remainingMs, false)}`;
      if (targetNode) targetNode.textContent = `${timer.targetHhmm}Z`;
      if (remainingMs <= 0) completedTimerIds.push(timerId);
    });

    let didMutate = false;
    if (completedTimerIds.length) {
      const remainingTimers = timers.filter((timer) => !completedTimerIds.includes(String(timer.id || "")));
      const completedTimers = timers.filter((timer) => completedTimerIds.includes(String(timer.id || "")));
      const alertQueue = Array.isArray(state.meta.kioskTimerAlerts) ? state.meta.kioskTimerAlerts.slice() : [];
      completedTimers.forEach((timer) => {
        alertQueue.push({
          id: String(timer.id || ""),
          label: String(timer.label || "Position estimate reached"),
          dueUtcMs: Number(timer.dueUtcMs || nowMs),
          targetHhmm: String(timer.targetHhmm || ""),
        });
      });
      state.meta.kioskEventTimer = remainingTimers;
      state.meta.kioskTimerAlerts = alertQueue;
      didMutate = true;
    }

    syncKioskTimerAlertDisplay();
    if (didMutate) render();
  }

  function syncKioskTimerAlertDisplay() {
    const alertQueue = Array.isArray(state.meta.kioskTimerAlerts) ? state.meta.kioskTimerAlerts : [];
    const currentAlert = alertQueue[0];
    const alertCountdownNode = document.getElementById("kiosk-alert-countdown");
    if (!currentAlert || !alertCountdownNode) return;
    const deltaMs = Date.now() - Number(currentAlert.dueUtcMs || Date.now());
    alertCountdownNode.textContent = `-${formatDurationClockFromMs(deltaMs, true)}`;
  }

  function getKioskWhereAmIButtonState() {
    if (!isActivateGpsEnabled()) {
      return { label: "Where am I", unavailable: true };
    }
    const gps = state.meta && state.meta.kioskGps ? state.meta.kioskGps : createEmptyKioskGpsState();
    if (gps.error) return { label: "Where am I unavailable", unavailable: true };
    if (!gps.tracking) return { label: "Where am I", unavailable: false };
    if (!Number.isFinite(gps.latitude) || !Number.isFinite(gps.longitude)) {
      return { label: "Where am I", unavailable: false };
    }
    return { label: "Where am I", unavailable: false };
  }

  function formatDurationClockFromMs(milliseconds, floorAtZero = false) {
    const value = Number(milliseconds);
    const positiveMs = floorAtZero ? Math.max(0, value) : value;
    const totalSeconds = Math.max(0, Math.ceil(positiveMs / 1000));
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    if (hours > 0) return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  function median(values) {
    const list = (Array.isArray(values) ? values : [])
      .map((value) => Number(value))
      .filter((value) => Number.isFinite(value))
      .sort((a, b) => a - b);
    if (!list.length) return null;
    const middle = Math.floor(list.length / 2);
    if (list.length % 2) return list[middle];
    return (list[middle - 1] + list[middle]) / 2;
  }

  function pruneGpsSpeedSamples(nowMs) {
    const now = Number(nowMs || Date.now());
    gpsSpeedSamplesKts = gpsSpeedSamplesKts
      .filter((item) => item && Number.isFinite(item.kts) && Number.isFinite(item.tsMs))
      .filter((item) => (now - item.tsMs) <= 20000)
      .slice(-9);
  }

  function updateKioskGpsDom() {
    const node = document.getElementById("kiosk-gps-speed");
    if (node) node.textContent = getKioskGpsSpeedDisplayText();
    const ageNode = document.getElementById("kiosk-gps-age");
    if (ageNode) ageNode.textContent = getKioskGpsAgeDisplayText();
    syncKioskWhereAmIButtonStateDom();
    const whereAmI = state.meta?.kioskGps?.whereAmI;
    if (whereAmI && whereAmI.open && String(whereAmI.query || "").trim()) {
      computeAndStoreKioskWhereAmI({ render: false });
    }
  }

  function restartKioskGpsWatch() {
    if (gpsWatchId != null && navigator.geolocation && typeof navigator.geolocation.clearWatch === "function") {
      try {
        navigator.geolocation.clearWatch(gpsWatchId);
      } catch {
        // ignore
      }
    }
    gpsWatchId = null;
    gpsLastPoint = null;
    gpsSpeedSamplesKts = [];
    startKioskGpsTracking();
  }

  function watchdogKioskGpsTracking() {
    if (state.view !== "ipad-kiosk" || !isActivateGpsEnabled()) return;
    const gps = state.meta && state.meta.kioskGps ? state.meta.kioskGps : null;
    if (!gps || gps.error || gpsWatchId == null) return;
    const lastFixMs = Number(gps.lastFixMs);
    if (!Number.isFinite(lastFixMs)) return;
    if ((Date.now() - lastFixMs) > GPS_STALE_RESTART_MS) restartKioskGpsWatch();
  }

  function syncKioskWhereAmIButtonStateDom() {
    const button = document.getElementById("kiosk-whereami-open");
    if (!button) return;
    const stateInfo = getKioskWhereAmIButtonState();
    button.textContent = stateInfo.label;
    button.classList.toggle("is-error", stateInfo.unavailable);
  }

  function stopKioskGpsTracking() {
    if (gpsWatchId != null && navigator.geolocation && typeof navigator.geolocation.clearWatch === "function") {
      try {
        navigator.geolocation.clearWatch(gpsWatchId);
      } catch {
        // ignore
      }
    }
    gpsWatchId = null;
    gpsLastPoint = null;
    gpsSpeedSamplesKts = [];
    if (!state.meta.kioskGps) state.meta.kioskGps = createEmptyKioskGpsState();
    state.meta.kioskGps.tracking = false;
  }

  function handleKioskGpsSuccess(position) {
    if (!position || !position.coords) return;
    if (!state.meta.kioskGps) state.meta.kioskGps = createEmptyKioskGpsState();
    state.meta.gpsPermissionPromptOpen = false;
    const coords = position.coords;
    const timestampMs = Number(position.timestamp || Date.now());
    const lat = Number(coords.latitude);
    const lon = Number(coords.longitude);
    const accuracy = Number(coords.accuracy);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;
    const now = Date.now();
    let fallbackKts = null;
    let headingTrue = Number.isFinite(Number(coords.heading)) && Number(coords.heading) >= 0
      ? normalizeAngle(Number(coords.heading))
      : null;
    if (gpsLastPoint && Number.isFinite(gpsLastPoint.tsMs)) {
      const elapsedSeconds = (timestampMs - gpsLastPoint.tsMs) / 1000;
      if (elapsedSeconds >= 1 && elapsedSeconds <= 20) {
        const distanceNm = computeGreatCircleDistanceNm(gpsLastPoint.lat, gpsLastPoint.lon, lat, lon);
        if (Number.isFinite(distanceNm)) {
          fallbackKts = (distanceNm * 3600) / elapsedSeconds;
          if (headingTrue == null && distanceNm > 0.005) {
            headingTrue = computeInitialTrueBearing(gpsLastPoint.lat, gpsLastPoint.lon, lat, lon);
          }
        }
      }
    }
    const nativeMps = Number(coords.speed);
    const nativeKts = Number.isFinite(nativeMps) && nativeMps >= 0 ? nativeMps * KNOTS_PER_MS : null;
    const selectedKts = Number.isFinite(nativeKts) && nativeKts >= 0 ? nativeKts : fallbackKts;
    if (Number.isFinite(selectedKts) && selectedKts >= 0 && selectedKts <= 420) {
      gpsSpeedSamplesKts.push({ kts: selectedKts, tsMs: timestampMs });
    }
    pruneGpsSpeedSamples(now);
    const smoothedKts = median(gpsSpeedSamplesKts.map((item) => item.kts));

    state.meta.kioskGps.supported = true;
    state.meta.kioskGps.tracking = true;
    state.meta.kioskGps.error = "";
    state.meta.kioskGps.latitude = lat;
    state.meta.kioskGps.longitude = lon;
    state.meta.kioskGps.accuracyMeters = Number.isFinite(accuracy) ? accuracy : null;
    state.meta.kioskGps.headingTrue = Number.isFinite(headingTrue) ? headingTrue : state.meta.kioskGps.headingTrue;
    state.meta.kioskGps.speedKts = Number.isFinite(smoothedKts) ? smoothedKts : state.meta.kioskGps.speedKts;
    state.meta.kioskGps.lastFixMs = now;

    gpsLastPoint = { lat, lon, tsMs: timestampMs };
    updateKioskGpsDom();
  }

  function retryKioskGpsPermissionRequest() {
    if (!navigator.geolocation || typeof navigator.geolocation.getCurrentPosition !== "function") {
      if (!state.meta.kioskGps) state.meta.kioskGps = createEmptyKioskGpsState();
      state.meta.kioskGps.supported = false;
      state.meta.kioskGps.tracking = false;
      state.meta.kioskGps.error = "GPS unavailable.";
      state.meta.gpsPermissionPromptOpen = false;
      updateKioskGpsDom();
      return;
    }
    navigator.geolocation.getCurrentPosition(
      () => {
        if (state.view === "ipad-kiosk" && isActivateGpsEnabled()) startKioskGpsTracking();
      },
      (retryError) => {
        handleKioskGpsError(retryError);
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 12000 },
    );
  }

  function handleKioskGpsError(error) {
    const permissionDenied = Number(error && error.code) === 1;
    if (
      permissionDenied
      && state.view === "ipad-kiosk"
      && isActivateGpsEnabled()
      && !state.meta.gpsPermissionPromptOpen
    ) {
      state.meta.gpsPermissionPromptOpen = true;
      stopKioskGpsTracking();
      render();
      return;
    }
    if (!state.meta.kioskGps) state.meta.kioskGps = createEmptyKioskGpsState();
    state.meta.kioskGps.supported = Boolean(navigator.geolocation);
    state.meta.kioskGps.tracking = false;
    state.meta.kioskGps.error = error && error.message ? String(error.message) : "GPS unavailable.";
    state.meta.gpsPermissionPromptOpen = false;
    updateKioskGpsDom();
  }

  function startKioskGpsTracking() {
    if (!state.meta.kioskGps) state.meta.kioskGps = createEmptyKioskGpsState();
    if (!navigator.geolocation || typeof navigator.geolocation.watchPosition !== "function") {
      state.meta.kioskGps.supported = false;
      state.meta.kioskGps.tracking = false;
      state.meta.kioskGps.error = "GPS unavailable.";
      updateKioskGpsDom();
      return;
    }
    state.meta.kioskGps.supported = true;
    if (gpsWatchId != null) return;
    try {
      gpsWatchId = navigator.geolocation.watchPosition(
        handleKioskGpsSuccess,
        handleKioskGpsError,
        { enableHighAccuracy: true, maximumAge: 1000, timeout: 12000 },
      );
      state.meta.kioskGps.tracking = true;
      state.meta.kioskGps.error = "";
      updateKioskGpsDom();
    } catch {
      state.meta.kioskGps.tracking = false;
      state.meta.kioskGps.error = "GPS unavailable.";
      updateKioskGpsDom();
    }
  }

  function syncKioskGpsTrackingForView() {
    if (state.view === "ipad-kiosk" && isActivateGpsEnabled()) {
      startKioskGpsTracking();
      return;
    }
    stopKioskGpsTracking();
    if (state.view === "ipad-kiosk") {
      if (!state.meta.kioskGps) state.meta.kioskGps = createEmptyKioskGpsState();
      state.meta.kioskGps.error = "GPS unavailable.";
      state.meta.kioskGps.supported = false;
      state.meta.kioskGps.tracking = false;
      updateKioskGpsDom();
    }
  }

  function bindKioskDoubleTapGuard() {
    const page = document.querySelector(".ipad-kiosk-page");
    if (!page || page.dataset.doubleTapGuardBound === "1") return;
    let lastTouchEnd = 0;
    let lastX = 0;
    let lastY = 0;
    page.addEventListener("touchend", (event) => {
      if (state.view !== "ipad-kiosk") return;
      const touch = event.changedTouches && event.changedTouches[0];
      if (!touch) return;
      const now = Date.now();
      const dx = Math.abs(touch.clientX - lastX);
      const dy = Math.abs(touch.clientY - lastY);
      if ((now - lastTouchEnd) <= 330 && dx < 24 && dy < 24) {
        event.preventDefault();
      }
      lastTouchEnd = now;
      lastX = touch.clientX;
      lastY = touch.clientY;
    }, { passive: false });
    page.dataset.doubleTapGuardBound = "1";
  }

  function bindKioskPullToRefreshGuard() {
    const page = document.querySelector(".ipad-kiosk-page");
    if (!page || page.dataset.pullToRefreshGuardBound === "1") return;
    let startY = 0;
    let tracking = false;
    let trackingId = null;
    const onTouchStart = (event) => {
      if (state.view !== "ipad-kiosk") return;
      if (!event.touches || !event.touches.length) return;
      const first = event.touches[0];
      startY = first.clientY;
      trackingId = first.identifier;
      tracking = window.scrollY <= 0;
    };

    const onTouchMove = (event) => {
      if (state.view !== "ipad-kiosk") return;
      if (!tracking || !event.touches || !event.touches.length) return;
      let activeTouch = event.touches[0];
      if (trackingId != null) {
        for (let index = 0; index < event.touches.length; index += 1) {
          if (event.touches[index].identifier === trackingId) {
            activeTouch = event.touches[index];
            break;
          }
        }
      }
      const currentY = activeTouch.clientY;
      const pullingDown = currentY > (startY + 8);
      if (pullingDown && window.scrollY <= 0) {
        event.preventDefault();
      }
    };

    const onTouchEnd = () => {
      tracking = false;
      trackingId = null;
    };

    page.addEventListener("touchstart", onTouchStart, { passive: true });
    page.addEventListener("touchmove", onTouchMove, { passive: false });
    page.addEventListener("touchend", onTouchEnd, { passive: true });
    page.addEventListener("touchcancel", onTouchEnd, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    page.dataset.pullToRefreshGuardBound = "1";
  }

  function wireKioskScratchPadToggle() {
    const topScratchpadButton = document.getElementById("kiosk-top-scratchpad");
    const overlay = document.getElementById("kiosk-pad-overlay");
    const closeButton = document.getElementById("kiosk-pad-close");
    if (!topScratchpadButton || !overlay) return;

    const openOverlay = () => {
      overlay.classList.add("open");
      overlay.setAttribute("aria-hidden", "false");
      if (kioskPadState && typeof kioskPadState.resize === "function") kioskPadState.resize();
    };
    const closeOverlay = () => {
      overlay.classList.remove("open");
      overlay.setAttribute("aria-hidden", "true");
    };

    if (topScratchpadButton && !topScratchpadButton.dataset.bound) {
      topScratchpadButton.addEventListener("click", openOverlay);
      topScratchpadButton.dataset.bound = "1";
    }
    if (closeButton && !closeButton.dataset.bound) {
      closeButton.addEventListener("click", closeOverlay);
      closeButton.dataset.bound = "1";
    }
    if (!overlay.dataset.bound) {
      overlay.addEventListener("click", (event) => {
        if (event.target === overlay) closeOverlay();
      });
      overlay.dataset.bound = "1";
    }
  }

  function setupKioskScratchPad() {
    const canvas = document.getElementById("kiosk-pad-canvas");
    const clearButton = document.getElementById("kiosk-pad-clear");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const readPadSnapshot = () => {
      try {
        const raw = String(window.localStorage.getItem(NAVLOG_KIOSK_PAD_KEY) || "");
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];
        return parsed
          .filter((stroke) => Array.isArray(stroke) && stroke.length)
          .map((stroke) => stroke
            .map((point) => ({
              x: Number(point && point.x),
              y: Number(point && point.y),
            }))
            .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y)));
      } catch {
        return [];
      }
    };
    const writePadSnapshot = (strokes) => {
      try {
        window.localStorage.setItem(NAVLOG_KIOSK_PAD_KEY, JSON.stringify(strokes || []));
      } catch {
        // ignore storage quota / private mode errors
      }
    };
    const clearPadSnapshot = () => {
      try {
        window.localStorage.removeItem(NAVLOG_KIOSK_PAD_KEY);
      } catch {
        // ignore
      }
    };
    let restoredFromStorage = false;
    let strokes = [];
    let currentStroke = null;
    const drawStroke = (stroke) => {
      if (!Array.isArray(stroke) || stroke.length < 2) return;
      ctx.beginPath();
      ctx.moveTo(stroke[0].x, stroke[0].y);
      for (let index = 1; index < stroke.length; index += 1) {
        ctx.lineTo(stroke[index].x, stroke[index].y);
      }
      ctx.stroke();
    };
    const redrawAll = () => {
      const rect = canvas.getBoundingClientRect();
      ctx.clearRect(0, 0, rect.width, rect.height);
      strokes.forEach((stroke) => drawStroke(stroke));
      if (Array.isArray(currentStroke) && currentStroke.length > 1) drawStroke(currentStroke);
    };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const ratio = Math.max(1, window.devicePixelRatio || 1);
      canvas.width = Math.max(1, Math.floor(rect.width * ratio));
      canvas.height = Math.max(1, Math.floor(rect.height * ratio));
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.lineWidth = 2.4;
      ctx.strokeStyle = "rgba(24, 22, 18, 0.92)";
      if (!restoredFromStorage) {
        strokes = readPadSnapshot();
        restoredFromStorage = true;
      }
      redrawAll();
    };

    const pointer = { drawing: false, x: 0, y: 0 };
    let lastPersistAt = 0;
    const getPoint = (event) => {
      const rect = canvas.getBoundingClientRect();
      const t = event.touches && event.touches[0];
      const clientX = t ? t.clientX : event.clientX;
      const clientY = t ? t.clientY : event.clientY;
      return { x: clientX - rect.left, y: clientY - rect.top };
    };
    const start = (event) => {
      event.preventDefault();
      const p = getPoint(event);
      pointer.drawing = true;
      pointer.x = p.x;
      pointer.y = p.y;
      currentStroke = [{ x: p.x, y: p.y }];
    };
    const move = (event) => {
      if (!pointer.drawing) return;
      event.preventDefault();
      const p = getPoint(event);
      ctx.beginPath();
      ctx.moveTo(pointer.x, pointer.y);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
      pointer.x = p.x;
      pointer.y = p.y;
      if (Array.isArray(currentStroke)) currentStroke.push({ x: p.x, y: p.y });
      const now = Date.now();
      if ((now - lastPersistAt) > 1200) {
        lastPersistAt = now;
        writePadSnapshot(strokes);
      }
    };
    const stop = () => {
      pointer.drawing = false;
      if (Array.isArray(currentStroke) && currentStroke.length > 1) {
        strokes.push(currentStroke);
      }
      currentStroke = null;
      writePadSnapshot(strokes);
    };

    if (!canvas.dataset.bound) {
      canvas.addEventListener("mousedown", start);
      canvas.addEventListener("mousemove", move);
      canvas.addEventListener("mouseup", stop);
      canvas.addEventListener("mouseleave", stop);
      canvas.addEventListener("touchstart", start, { passive: false });
      canvas.addEventListener("touchmove", move, { passive: false });
      canvas.addEventListener("touchend", stop, { passive: false });
      canvas.dataset.bound = "1";
    }
    if (clearButton && !clearButton.dataset.bound) {
      clearButton.addEventListener("click", () => {
        if (!window.confirm("Clear scratch pad?")) return;
        strokes = [];
        currentStroke = null;
        redrawAll();
        clearPadSnapshot();
      });
      clearButton.dataset.bound = "1";
    }
    if (!window.__kioskPadResizeBound) {
      window.addEventListener("resize", () => {
        if (state.view !== "ipad-kiosk") return;
        if (kioskPadState && typeof kioskPadState.resize === "function") kioskPadState.resize();
      });
      window.__kioskPadResizeBound = "1";
    }
    if (!window.__kioskPadUnloadBound) {
      window.addEventListener("beforeunload", () => {
        if (state.view !== "ipad-kiosk") return;
        writePadSnapshot(strokes);
      });
      window.__kioskPadUnloadBound = "1";
    }

    resize();
    kioskPadState = { resize };
  }

  function isIpadDevice() {
    const ua = String(navigator.userAgent || "");
    const platform = String(navigator.platform || "");
    const touchPoints = Number(navigator.maxTouchPoints || 0);
    const classicIpad = /iPad/i.test(ua) || /iPad/i.test(platform);
    const modernIpad = /Macintosh/i.test(ua) && touchPoints > 1;
    return classicIpad || modernIpad;
  }

  function isIphoneDevice() {
    const ua = String(navigator.userAgent || "");
    const platform = String(navigator.platform || "");
    return /iPhone|iPod/i.test(ua) || /iPhone|iPod/i.test(platform);
  }

  function isTouchInputDevice() {
    const touchPoints = Number(navigator.maxTouchPoints || 0);
    const coarsePointer = Boolean(window.matchMedia && window.matchMedia("(pointer: coarse)").matches);
    const noHover = Boolean(window.matchMedia && window.matchMedia("(hover: none)").matches);
    return touchPoints > 0 || coarsePointer || noHover;
  }

  function isMobileOrTabletDevice() {
    const ua = String(navigator.userAgent || "");
    return /Android|iPhone|iPad|iPod|Mobile|Tablet|Silk|Kindle|PlayBook|BlackBerry|Windows Phone/i.test(ua) || isIpadDevice() || isIphoneDevice();
  }

  function isActivateSupportedDevice() {
    if (isIpadDevice() || isIphoneDevice()) return true;
    const ua = String(navigator.userAgent || "");
    const isDesktopOs = /Windows NT|Macintosh|X11|Linux x86_64/i.test(ua) && !/Android|Mobile|Tablet/i.test(ua);
    if (isDesktopOs) return false;
    return isTouchInputDevice() && isMobileOrTabletDevice();
  }

  function isPhoneActivateMode() {
    return state.view === "ipad-kiosk" && !isIpadDevice() && isMobileOrTabletDevice();
  }

  function isActivateGpsEnabled() {
    return Boolean(state.meta && state.meta.activateGpsEnabled);
  }

  function persistKioskPayload(overrides = {}) {
    try {
      const payload = {
        navlog: overrides.navlog || state.navlog,
        settings: overrides.settings || state.settings,
        activateGpsEnabled: Object.prototype.hasOwnProperty.call(overrides, "activateGpsEnabled")
          ? Boolean(overrides.activateGpsEnabled)
          : isActivateGpsEnabled(),
        ts: Date.now(),
      };
      window.localStorage.setItem(NAVLOG_KIOSK_PAYLOAD_KEY, JSON.stringify(payload));
    } catch {
      // ignore storage failure
    }
  }

  function restoreKioskPayload() {
    try {
      const raw = window.localStorage.getItem(NAVLOG_KIOSK_PAYLOAD_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") return;
      if (parsed.navlog && typeof parsed.navlog === "object") state.navlog = parsed.navlog;
      if (parsed.settings && typeof parsed.settings === "object") state.settings = { ...createDefaultSettings(), ...parsed.settings };
      if (Object.prototype.hasOwnProperty.call(parsed, "activateGpsEnabled")) {
        state.meta.activateGpsEnabled = Boolean(parsed.activateGpsEnabled);
      }
    } catch {
      // ignore bad payload
    }
  }

  function fitSheetToViewport(containerSelector) {
    if (!isIpadDevice()) return;
    const container = document.querySelector(containerSelector);
    const sheet = container ? container.querySelector(".sheet") : null;
    if (!container || !sheet) return;

    const baseWidth = 1366;
    sheet.style.transform = "none";
    sheet.style.zoom = "";
    sheet.style.width = `${baseWidth}px`;
    sheet.style.minWidth = `${baseWidth}px`;
    sheet.style.maxWidth = `${baseWidth}px`;
    sheet.style.transformOrigin = "0 0";
    sheet.style.position = "absolute";
    sheet.style.left = "0";
    sheet.style.top = "0";
    container.style.position = "relative";
    container.style.overflow = "visible";

    const available = Math.max(320, container.clientWidth - 4);
    const scale = Math.min(1, available / baseWidth);
    sheet.style.transform = `scale(${scale})`;
    const rawHeight = Math.max(sheet.scrollHeight, sheet.offsetHeight);
    container.style.height = `${Math.ceil(rawHeight * scale)}px`;

    if (!viewportFitResizeBound) {
      viewportFitResizeBound = true;
      window.addEventListener("resize", () => {
        if (state.view === "navlog") fitSheetToViewport(".sheet-wrap");
        if (state.view === "ipad-kiosk") fitSheetToViewport(".ipad-kiosk-wrap");
        requestAnimationFrame(() => syncRouteProgressMarkerDisplay());
      });
      window.addEventListener("orientationchange", () => {
        setTimeout(() => {
          if (state.view === "navlog") fitSheetToViewport(".sheet-wrap");
          if (state.view === "ipad-kiosk") fitSheetToViewport(".ipad-kiosk-wrap");
          syncRouteProgressMarkerDisplay();
        }, 80);
      });
    }
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
      autofillAllCoordinateNavigationValues();
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
    autofillAllCoordinateNavigationValues();
    applyRpcAutofillFromHeader(state.navlog.header.rpCNo);
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
      if (field === "tc" || field === "distance") {
        leg._manual[field] = String(value || "").trim() !== "";
        return;
      }
      leg._manual[field] = true;
    });
    return leg;
  }

  function syncRadioRowDom(index) {
    const row = state.navlog.radios[index];
    if (!row) return;
    ["location", "cptAtis", "depAap", "twr", "gnd", "fss", "remarks"].forEach((field) => {
      const node = document.querySelector(`[data-radio-field="${index}:${field}"]`);
      if (node && node.value !== String(row[field] || "")) node.value = String(row[field] || "");
    });
  }

  function autofillAirportRow(index, rawValue, options = {}) {
    const code = String(rawValue || "").trim().toUpperCase();
    const airport = state.catalog.airports.find((item) => item.code === code || item.id === code);
    if (!airport) {
      state.navlog.radios[index] = {
        ...state.navlog.radios[index],
        location: code ? rawValue : "",
        cptAtis: "",
        depAap: "",
        twr: "",
        gnd: "",
        fss: "",
        remarks: "",
      };
      if (options.render === false) syncRadioRowDom(index);
      else render();
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
    if (options.render === false) syncRadioRowDom(index);
    else render();
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
      ch: manual.ch ? num(leg.ch) : null,
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

      if (values.mh != null && values.dev != null) assignDerived("ch", normalizeAngle(values.mh + values.dev));
      if (values.ch != null && values.dev != null) assignDerived("mh", normalizeAngle(values.ch - values.dev));
      if (values.ch != null && values.mh != null) assignDerived("dev", normalizeSignedAngle(values.ch - values.mh));

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
      ch: resolveDisplayField(leg, manual, lockedField, "ch", values.ch, maybeHeadingDegrees),
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
        state.meta.chartAirportQuery = "";
        state.meta.chartSearchSubmitted = false;
        scrollCurrentViewToTop();
        render();
      });
    });
    const chartSearchInput = document.getElementById("chart-airport-search");
    const chartSearchButton = document.getElementById("chart-airport-search-button");
    const submitChartSearch = () => {
      state.meta.chartAirportQuery = normalizeCode(chartSearchInput ? chartSearchInput.value : state.meta.chartAirportQuery);
      state.meta.chartSearchSubmitted = true;
      render();
    };
    if (chartSearchInput) {
      chartSearchInput.addEventListener("input", () => {
        state.meta.chartAirportQuery = chartSearchInput.value;
        state.meta.chartSearchSubmitted = false;
        if (!String(chartSearchInput.value || "").trim()) render();
      });
      chartSearchInput.addEventListener("keydown", (event) => {
        if (event.key !== "Enter") return;
        event.preventDefault();
        submitChartSearch();
      });
    }
    if (chartSearchButton) chartSearchButton.addEventListener("click", submitChartSearch);
    document.querySelectorAll("[data-open-chart-url]").forEach((button) => {
      button.addEventListener("click", (event) => {
        event.stopPropagation();
        const chartId = String(button.getAttribute("data-open-chart-url") || "");
        const chart = (Array.isArray(state.catalog.charts) ? state.catalog.charts : [])
          .map((record) => normalizeAirportChartRecord(record))
          .find((record) => record.id === chartId);
        if (chart) openChartInNewTab(chart);
      });
    });
    document.querySelectorAll("[data-preview-chart-card]").forEach((card) => {
      const openPreview = () => {
        openChartPreviewModal(
          card.getAttribute("data-preview-chart-card"),
          card.getAttribute("data-chart-preview-id"),
          { viewer: true, activateMode: false },
        );
      };
      card.addEventListener("click", openPreview);
      card.addEventListener("keydown", (event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        openPreview();
      });
    });
  }

  function wireChartPreviewControls() {
    const overlay = document.getElementById("chart-preview-overlay");
    if (!overlay) return;
    const model = state.meta && state.meta.chartPreview ? state.meta.chartPreview : createEmptyChartPreviewState();
    const closeButton = document.getElementById("chart-preview-close");
    const searchInput = document.getElementById("chart-preview-airport-search");
    const searchButton = document.getElementById("chart-preview-search-button");
    const submitSearch = () => {
      const nextCode = normalizeCode(searchInput ? searchInput.value : state.meta.chartPreview.airportCode);
      state.meta.chartPreview.airportCode = nextCode;
      const charts = getChartsForAirportCode(nextCode);
      state.meta.chartPreview.selectedChartId = charts[0] ? charts[0].id : "";
      render();
    };
    if (closeButton) closeButton.addEventListener("click", closeChartPreviewModal);
    if (searchButton) searchButton.addEventListener("click", submitSearch);
    if (searchInput) {
      searchInput.addEventListener("input", () => {
        state.meta.chartPreview.airportCode = String(searchInput.value || "");
        if (!String(searchInput.value || "").trim()) render();
      });
      searchInput.addEventListener("keydown", (event) => {
        if (event.key !== "Enter") return;
        event.preventDefault();
        submitSearch();
      });
    }
    overlay.addEventListener("click", (event) => {
      if (event.target !== overlay) return;
      closeChartPreviewModal();
    });
    document.querySelectorAll("[data-chart-preview-select]").forEach((button) => {
      button.addEventListener("click", () => {
        state.meta.chartPreview.selectedChartId = String(button.getAttribute("data-chart-preview-select") || "");
        state.meta.chartPreview.viewer = true;
        state.meta.chartPreview.activateMode = Boolean(model.activateMode);
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
        clearAdminTransientPanelState(state.admin.panel, nextPanel);
        state.admin.panel = nextPanel;
        if (nextPanel === "additional-info") state.admin.additionalInfoPanel = "";
        scrollCurrentViewToTop();
        render();
      });
    });
    stopAdminMiniGame();

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

    const presetLockButton = document.getElementById("admin-preset-lock");
    if (presetLockButton) {
      presetLockButton.addEventListener("click", () => {
        readPresetFormFromInputs();
        state.admin.presetForm.locked = !state.admin.presetForm.locked;
        render();
      });
    }
    document.querySelectorAll("#admin-preset-add-row, #admin-preset-add-row-mobile").forEach((presetAddRowButton) => {
      presetAddRowButton.addEventListener("click", () => {
        readPresetFormFromInputs();
        state.admin.presetForm.rows.push(createEmptyPresetRow());
        render();
      });
    });
    document.querySelectorAll("[data-admin-preset-remove-row]").forEach((button) => {
      button.addEventListener("click", () => {
        readPresetFormFromInputs();
        const index = Number(button.getAttribute("data-admin-preset-remove-row"));
        if (!Number.isFinite(index)) return;
        if (state.admin.presetForm.rows.length <= 1) state.admin.presetForm.rows = [createEmptyPresetRow()];
        else state.admin.presetForm.rows.splice(index, 1);
        render();
      });
    });

    const presetRowInputs = Array.from(document.querySelectorAll("[data-admin-preset-row]"));
    presetRowInputs.forEach((node) => {
      node.addEventListener("input", () => {
        const key = String(node.getAttribute("data-admin-preset-row") || "");
        const [, field] = key.split(":");
        if (field === "coord") {
          const [indexText] = key.split(":");
          const index = Number(indexText);
          const row = Number.isFinite(index) && index >= 0 ? state.admin.presetForm.rows[index] : null;
          if (row) {
            row._manual = row._manual || {};
            row._manual.coord = String(node.value || "").trim() !== "";
          }
        }
        if (field === "tc" || field === "distance") {
          const [indexText] = key.split(":");
          const index = Number(indexText);
          const row = Number.isFinite(index) && index >= 0 ? state.admin.presetForm.rows[index] : null;
          if (row) {
            row._manual = row._manual || {};
            row._manual[field] = String(node.value || "").trim() !== "";
          }
        }
        readPresetFormFromInputs();
        syncAdminPresetFormUi();
      });
    });

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

    const waypointRowInputs = Array.from(document.querySelectorAll("[data-admin-waypoint-row]"));
    waypointRowInputs.forEach((node) => {
      node.addEventListener("input", () => {
        const key = String(node.getAttribute("data-admin-waypoint-row") || "");
        const [, field] = key.split(":");
        readWaypointFormFromInputs({ autofill: field === "name" });
        syncAdminWaypointFormUi();
      });
    });
    document.querySelectorAll("[data-admin-waypoint-add-alias]").forEach((button) => {
      button.addEventListener("click", () => {
        readWaypointFormFromInputs({ autofill: false });
        const index = Number(button.getAttribute("data-admin-waypoint-add-alias"));
        const rows = normalizeWaypointRows(state.admin.waypointForm.rows);
        if (!Number.isFinite(index) || !rows[index] || !rows[index].name.trim()) return;
        rows[index].aliases = Array.isArray(rows[index].aliases) ? rows[index].aliases : [];
        rows[index].aliases.push("");
        state.admin.waypointForm.rows = rows;
        render();
        requestAnimationFrame(() => {
          const aliasInputs = document.querySelectorAll(`[data-admin-waypoint-row^="${index}:alias:"]`);
          const lastAlias = aliasInputs.length ? aliasInputs[aliasInputs.length - 1] : null;
          if (lastAlias) lastAlias.focus();
        });
      });
    });
    document.querySelectorAll("[data-admin-waypoint-remove-alias]").forEach((button) => {
      button.addEventListener("click", () => {
        readWaypointFormFromInputs({ autofill: false });
        const [rowIndexText, aliasIndexText] = String(button.getAttribute("data-admin-waypoint-remove-alias") || "").split(":");
        const rowIndex = Number(rowIndexText);
        const aliasIndex = Number(aliasIndexText);
        const rows = normalizeWaypointRows(state.admin.waypointForm.rows);
        if (!Number.isFinite(rowIndex) || !Number.isFinite(aliasIndex) || !rows[rowIndex]) return;
        rows[rowIndex].aliases.splice(aliasIndex, 1);
        state.admin.waypointForm.rows = rows;
        render();
      });
    });
    const waypointSaveButton = document.getElementById("admin-waypoint-save");
    if (waypointSaveButton) {
      waypointSaveButton.addEventListener("click", async () => {
        readWaypointFormFromInputs();
        await saveWaypointsFromAdmin();
      });
    }
    const waypointDeleteButton = document.getElementById("admin-waypoint-delete");
    if (waypointDeleteButton) {
      waypointDeleteButton.addEventListener("click", async () => {
        readWaypointFormFromInputs();
        await deleteWaypointRowFromAdmin();
      });
    }

    const rpcRowInputs = Array.from(document.querySelectorAll("[data-admin-rpc-row]"));
    rpcRowInputs.forEach((node) => {
      node.addEventListener("input", () => {
        const key = String(node.getAttribute("data-admin-rpc-row") || "");
        const [, field] = key.split(":");
        if (field === "registration") {
          const registration = String(node.value || "");
          state.admin.selectedRpcRegistration = normalizeCode(registration);
          state.admin.rpcRegistryForm = {
            rows: normalizeRpcRegistryRows([{
              registration,
              aircraftType: "",
              casClimb: "",
              casCruise: "",
              gph: "",
            }]),
          };
          syncAdminRpcAutofill();
          syncAdminRpcFormUi();
          return;
        }
        readRpcRegistryFromInputs();
        syncAdminRpcFormUi();
      });
    });
    const rpcSaveButton = document.getElementById("admin-rpc-save");
    if (rpcSaveButton) {
      rpcSaveButton.addEventListener("click", async () => {
        readRpcRegistryFromInputs();
        await saveRpcRegistryFromAdmin();
      });
    }
    const rpcDeleteButton = document.getElementById("admin-rpc-delete");
    if (rpcDeleteButton) {
      rpcDeleteButton.addEventListener("click", async () => {
        readRpcRegistryFromInputs();
        await deleteRpcRowFromAdmin();
      });
    }
    document.querySelectorAll("[data-admin-rpc-select]").forEach((button) => {
      button.addEventListener("click", () => {
        const registration = normalizeCode(button.getAttribute("data-admin-rpc-select"));
        if (registration && registration === normalizeCode(state.admin.selectedRpcRegistration)) {
          state.admin.selectedRpcRegistration = "";
          state.admin.rpcRegistryForm = createEmptyRpcRegistryForm();
        } else {
          selectRpcForEditing(registration);
        }
        render();
      });
    });

    const airportCodeInput = document.getElementById("admin-airport-code");
    if (airportCodeInput) {
      const onAirportCodeInput = () => {
        readAirportFormFromInputs();
        loadAirportByCode();
        syncAdminAirportFormUi();
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

    const chartUploadButton = document.getElementById("admin-chart-upload");
    if (chartUploadButton) {
      chartUploadButton.addEventListener("click", async () => {
        await uploadAirportChartFromAdmin();
      });
    }
    const chartResetButton = document.getElementById("admin-chart-reset");
    if (chartResetButton) {
      chartResetButton.addEventListener("click", () => {
        state.admin.chartForm = createEmptyChartForm();
        state.admin.chartUploadStatus = "";
        const fileInput = document.getElementById("admin-chart-file");
        if (fileInput) fileInput.value = "";
        render();
      });
    }
    ["admin-chart-airport-code", "admin-chart-name", "admin-chart-category"].forEach((id) => {
      const field = document.getElementById(id);
      if (!field) return;
      field.addEventListener("input", () => {
        readAdminChartFormFromInputs();
        if (id === "admin-chart-airport-code") {
          state.admin.chartForm.airportCode = normalizeCode(state.admin.chartForm.airportCode);
          render();
          requestAnimationFrame(() => {
            const nextField = document.getElementById("admin-chart-airport-code");
            if (!nextField) return;
            nextField.focus({ preventScroll: true });
            try {
              const length = String(nextField.value || "").length;
              nextField.setSelectionRange(length, length);
            } catch {
              // ignore unsupported selection APIs
            }
          });
        }
      });
    });
    document.querySelectorAll("[data-admin-chart-select]").forEach((button) => {
      button.addEventListener("click", () => {
        const chartId = String(button.getAttribute("data-admin-chart-select") || "");
        if (chartId && chartId === String(state.admin.chartForm.id || "")) {
          state.admin.chartForm = { ...createEmptyChartForm(), airportCode: normalizeCode(state.admin.chartForm.airportCode) };
        } else {
          selectAirportChartForEditing(chartId);
        }
        state.admin.chartUploadStatus = "";
        render();
      });
    });
    document.querySelectorAll("[data-admin-chart-delete]").forEach((button) => {
      button.addEventListener("click", async () => {
        await deleteAirportChartFromAdmin(button.getAttribute("data-admin-chart-delete"));
      });
    });

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
    const maintenanceTextInput = document.getElementById("admin-maintenance-text");
    if (maintenanceTextInput) {
      maintenanceTextInput.addEventListener("input", () => {
        state.admin.maintenanceTextDraft = String(maintenanceTextInput.value || "");
        state.admin.maintenanceSaveStatus = "";
      });
    }
    if (maintenanceToggle) {
      maintenanceToggle.addEventListener("change", () => {
        const enabled = Boolean(maintenanceToggle.checked);
        state.admin.maintenanceMode = enabled;
        state.admin.maintenanceSaveStatus = "";
      });
    }
    const maintenanceSaveButton = document.getElementById("admin-maintenance-save");
    if (maintenanceSaveButton) {
      maintenanceSaveButton.addEventListener("click", async () => {
        const enabled = Boolean(maintenanceToggle && maintenanceToggle.checked);
        const text = String(maintenanceTextInput ? maintenanceTextInput.value : state.admin.maintenanceTextDraft);
        state.admin.maintenanceTextDraft = text;
        await saveMaintenanceModeFromAdmin(enabled, text);
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

  function stopAdminMiniGame() {
    // Legacy no-op: mini game removed in favor of dashboard metrics.
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

  async function runSupabaseQuery(query) {
    try {
      return await query;
    } catch (error) {
      return { data: [], error };
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
    state.admin.selectedWaypointName = "";
    state.admin.selectedRpcRegistration = "";
    state.admin.presetForm = createEmptyPresetForm();
    state.admin.waypointForm = createEmptyWaypointForm();
    state.admin.rpcRegistryForm = createEmptyRpcRegistryForm();
    state.admin.chartForm = createEmptyChartForm();
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
      let [presetResult, airportResult, contentResult, waypointResult, rpcResult, chartResult] = await Promise.all([
        runSupabaseQuery(supabaseClient.from("route_presets").select("*").order("name", { ascending: true })),
        runSupabaseQuery(supabaseClient.from("airports").select("*").order("code", { ascending: true })),
        runSupabaseQuery(supabaseClient.from("content_pages").select("*")),
        runSupabaseQuery(supabaseClient.from("waypoints").select("*").order("name", { ascending: true })),
        runSupabaseQuery(supabaseClient.from("rpc_registry").select("*").order("registration", { ascending: true })),
        runSupabaseQuery(supabaseClient.from("airport_charts").select("*").order("airport_code", { ascending: true }).order("name", { ascending: true })),
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
      state.admin.waypoints = (waypointResult.data || []).map((row) => cloneWaypointRecord({
        id: row.id,
        name: row.name,
        coord: row.coord,
      }));
      state.admin.rpcRegistry = (rpcResult.data || []).map((row) => cloneRpcRegistryRecord({
        id: row.id,
        registration: row.registration,
        aircraftType: row.aircraft_type,
        casClimb: row.cas_climb,
        casCruise: row.cas_cruise,
        gph: row.gph,
      }));
      state.admin.charts = chartResult.error ? [] : (chartResult.data || []).map((row) => cloneAirportChartRecord(row));
      if (chartResult.error) state.admin.chartUploadStatus = "Run the updated Supabase schema to enable charts.";
      if (state.admin.selectedWaypointName) selectWaypointForEditing(state.admin.selectedWaypointName);
      else state.admin.waypointForm = createEmptyWaypointForm();
      if (state.admin.selectedRpcRegistration) selectRpcForEditing(state.admin.selectedRpcRegistration);
      else state.admin.rpcRegistryForm = createEmptyRpcRegistryForm();
      const contentMap = {};
      (contentResult.data || []).forEach((row) => {
        contentMap[String(row.key || "").toLowerCase()] = String(row.body_html || "");
      });
      state.catalog.routePresets = state.admin.presets.map((preset) => clonePreset(preset));
      state.catalog.airports = state.admin.airports.map((airport) => ({ ...airport }));
      state.catalog.waypoints = state.admin.waypoints.map((waypoint) => ({ ...waypoint }));
      state.catalog.rpcRegistry = state.admin.rpcRegistry.map((record) => ({ ...record }));
      state.catalog.charts = state.admin.charts.map((record) => ({ ...record }));
      state.catalog.content.manualHtml = contentMap.manual || "";
      state.catalog.content.privacyHtml = contentMap.privacy || "";
      state.catalog.content.announcements = parseAnnouncementsContent(contentMap.announcements || "");
      state.catalog.content.maintenanceMode = parseMaintenanceModeContent(contentMap.maintenance_mode || "");
      state.catalog.content.maintenanceText = String(contentMap.maintenance_text || state.catalog.content.maintenanceText || "").trim() || "under maintenance: service is undergoing maintenance. do not trust.";
      state.catalog.content.additionalInfoTable = parseAdditionalInfoContent(contentMap.additional_info || "");
      state.admin.manualHtmlDraft = contentHtmlToEditorText("manual", state.catalog.content.manualHtml);
      state.admin.privacyHtmlDraft = contentHtmlToEditorText("privacy", state.catalog.content.privacyHtml);
      state.admin.manualDraftBaselineHtml = state.catalog.content.manualHtml;
      state.admin.privacyDraftBaselineHtml = state.catalog.content.privacyHtml;
      state.admin.manualDraftBaselineText = state.admin.manualHtmlDraft;
      state.admin.privacyDraftBaselineText = state.admin.privacyHtmlDraft;
      state.admin.announcementDrafts = normalizeAnnouncementDrafts(state.catalog.content.announcements, false);
      state.admin.maintenanceMode = Boolean(state.catalog.content.maintenanceMode);
      state.admin.maintenanceTextDraft = String(state.catalog.content.maintenanceText || "");
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
    const previousRows = Array.isArray(state.admin.presetForm.rows) ? state.admin.presetForm.rows : [];
    const rows = [];
    rowInputs.forEach((node) => {
      const key = String(node.getAttribute("data-admin-preset-row") || "");
      const [indexText, field] = key.split(":");
      const index = Number(indexText);
      if (!Number.isFinite(index) || index < 0 || !field) return;
      if (!rows[index]) rows[index] = createEmptyPresetRow();
      rows[index][field] = String(node.value || "");
      rows[index]._manual = {
        ...(previousRows[index] && previousRows[index]._manual ? previousRows[index]._manual : createEmptyPresetRow()._manual),
      };
    });
    state.admin.presetForm = {
      departure: normalizeCode(departureInput ? departureInput.value : state.admin.presetForm.departure),
      destination: normalizeCode(destinationInput ? destinationInput.value : state.admin.presetForm.destination),
      locked: Boolean(state.admin.presetForm.locked),
      rows: normalizePresetRows(rows.length ? rows : state.admin.presetForm.rows),
    };
    state.admin.presetForm.rows.forEach((row, index) => {
      row._manual = {
        ...(previousRows[index] && previousRows[index]._manual ? previousRows[index]._manual : createEmptyPresetRow()._manual),
      };
      if (state.admin.presetForm.locked) {
        row._manual.tc = false;
        row._manual.distance = false;
      }
    });
    syncAdminPresetRowAutofill();
  }

  function normalizePresetRows(rows) {
    const source = Array.isArray(rows) ? rows : [];
    const normalized = source
      .map((row) => ({
        route: String(row && row.route != null ? row.route : ""),
        coord: String(row && row.coord != null ? row.coord : ""),
        tc: String(row && row.tc != null ? row.tc : ""),
        distance: String(row && row.distance != null ? row.distance : ""),
        _manual: {
          coord: Boolean(row && row._manual && row._manual.coord),
          tc: Boolean(row && row._manual && row._manual.tc),
          distance: Boolean(row && row._manual && row._manual.distance),
        },
      }));
    return normalized.length ? normalized : [createEmptyPresetRow()];
  }

  function hasPresetRowContent(row) {
    return Boolean(
      row
      && (
        String(row.route || "").trim() !== ""
        || String(row.coord || "").trim() !== ""
        || String(row.tc || "").trim() !== ""
        || String(row.distance || "").trim() !== ""
      )
    );
  }

  function ensureTrailingBlankRow(rows, createRowFn, hasContentFn) {
    const source = Array.isArray(rows) ? rows : [];
    if (!source.length) {
      source.push(createRowFn());
      return true;
    }
    const lastRow = source[source.length - 1];
    if (!hasContentFn(lastRow)) return false;
    source.push(createRowFn());
    return true;
  }

  function getFocusedAdminRowIndex(selector) {
    const active = document.activeElement;
    if (!active || typeof active.closest !== "function") return -1;
    const row = active.closest(selector);
    if (!row) return -1;
    const rawIndex = String(row.getAttribute("data-admin-row-index") || "");
    const index = Number(rawIndex);
    return Number.isFinite(index) ? index : -1;
  }

  function deleteAdminFormRow(formKey, createRowFn, hasContentFn) {
    const form = state.admin[formKey];
    if (!form || !Array.isArray(form.rows) || !form.rows.length) return false;
    const selector = formKey === "waypointForm"
      ? ".admin-waypoint-row"
      : formKey === "rpcRegistryForm"
        ? ".admin-rpc-row"
        : ".admin-preset-row";
    const focusedIndex = getFocusedAdminRowIndex(selector);
    const fallbackIndex = form.rows.findIndex((row) => hasContentFn(row));
    const index = focusedIndex >= 0 ? focusedIndex : fallbackIndex;
    if (!Number.isFinite(index) || index < 0 || index >= form.rows.length) return false;
    if (!window.confirm("Delete this row?")) return false;
    if (form.rows.length === 1) {
      form.rows = [createRowFn()];
    } else {
      form.rows.splice(index, 1);
    }
    return true;
  }

  function clearAdminTransientPanelState(previousPanel, nextPanel) {
    const previous = String(previousPanel || "");
    const next = String(nextPanel || "");
    if (previous === next) return;
    if (previous === "coordinates") {
      state.admin.selectedWaypointName = "";
      state.admin.waypointForm = createEmptyWaypointForm();
    }
    if (previous === "rpc-reg") {
      state.admin.selectedRpcRegistration = "";
      state.admin.rpcRegistryForm = createEmptyRpcRegistryForm();
    }
    if (previous === "charts") {
      state.admin.chartForm = createEmptyChartForm();
      state.admin.chartUploadStatus = "";
    }
  }

  function syncAdminPresetRowAutofill() {
    const rows = normalizePresetRows(state.admin.presetForm.rows);
    rows.forEach((row, index) => {
      const route = normalizeCode(row.route);
      if (!route) return;
      const known = getWaypointData(route);
      if (known && known.hasCoords && !row._manual.coord) {
        row.coord = known.coordText;
      }
      const derived = computeAdminPresetRowDerivedValues(rows, index);
      if (!row._manual.tc && derived.tc != null) row.tc = formatHeadingDisplay(derived.tc);
      if (!row._manual.distance && derived.distance != null) row.distance = formatDistanceDisplay(derived.distance);
    });
    state.admin.presetForm.rows = rows;
  }

  function computeAdminPresetRowDerivedValues(rows, index) {
    const currentIndex = Number(index);
    if (!Number.isFinite(currentIndex) || currentIndex <= 0 || currentIndex >= rows.length) return { tc: null, distance: null };
    const previousRow = rows[currentIndex - 1];
    const currentRow = rows[currentIndex];
    const fromCoord = parseWaypointCoordinate(previousRow && previousRow.coord);
    const toCoord = parseWaypointCoordinate(currentRow && currentRow.coord);
    if (!fromCoord || !toCoord) return { tc: null, distance: null };
    const distanceNm = computeGreatCircleDistanceNm(fromCoord.lat, fromCoord.lon, toCoord.lat, toCoord.lon);
    const tc = computeInitialTrueBearing(fromCoord.lat, fromCoord.lon, toCoord.lat, toCoord.lon);
    return {
      tc: Number.isFinite(tc) ? roundHalfUp(tc) : null,
      distance: Number.isFinite(distanceNm) ? distanceNm : null,
    };
  }

  function formatHeadingDisplay(value) {
    if (value == null || !Number.isFinite(value)) return "";
    return String(roundHalfUp(normalizeAngle(value))).padStart(3, "0");
  }

  function presetRowsFromLegs(legs) {
    if (!Array.isArray(legs) || legs.length === 0) return [createEmptyPresetRow()];
    return normalizePresetRows(
      legs.map((leg) => ({
        route: leg && leg.route != null ? leg.route : "",
        coord: leg && (leg.coord ?? leg.coordinates ?? leg.latlon) != null ? (leg.coord ?? leg.coordinates ?? leg.latlon) : "",
      })),
    );
  }

  function presetLegsFromRows(rows) {
    const source = Array.isArray(rows) ? rows : [];
    const legs = [];
    source.forEach((row) => {
      const route = String(row && row.route != null ? row.route : "").trim();
      const coordRaw = String(row && row.coord != null ? row.coord : "").trim();
      const tcRaw = String(row && row.tc != null ? row.tc : "").trim();
      const distanceRaw = String(row && row.distance != null ? row.distance : "").trim();
      if (!route && !coordRaw && !tcRaw && !distanceRaw) return;
      const leg = {};
      if (route) leg.route = route;
      if (coordRaw) leg.coord = coordRaw;
      if (tcRaw) leg.tc = tcRaw;
      if (distanceRaw) leg.distance = distanceRaw;
      legs.push(leg);
    });
    return legs;
  }

  function waypointRowsFromRecords(records) {
    const source = Array.isArray(records) ? records : [];
    return normalizeWaypointRows(
      source.map((record) => ({
        name: record && record.name != null ? record.name : "",
        aliases: record && Array.isArray(record.aliases) ? record.aliases : [],
        coord: record && record.coord != null ? record.coord : "",
      })),
    );
  }

  function rpcRowsFromRecords(records) {
    const source = Array.isArray(records) ? records : [];
    return normalizeRpcRegistryRows(
      source.map((record) => ({
        registration: record && record.registration != null ? record.registration : "",
        aircraftType: record && record.aircraftType != null ? record.aircraftType : "",
        casClimb: record && record.casClimb != null ? record.casClimb : "",
        casCruise: record && record.casCruise != null ? record.casCruise : "",
        gph: record && record.gph != null ? record.gph : "",
      })),
    );
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

  function readAdminChartFormFromInputs() {
    const airportInput = document.getElementById("admin-chart-airport-code");
    const nameInput = document.getElementById("admin-chart-name");
    const categoryInput = document.getElementById("admin-chart-category");
    state.admin.chartForm = {
      id: String(state.admin.chartForm.id || ""),
      airportCode: String(airportInput ? airportInput.value : state.admin.chartForm.airportCode || ""),
      name: String(nameInput ? nameInput.value : state.admin.chartForm.name || ""),
      category: String(categoryInput ? categoryInput.value : state.admin.chartForm.category || ""),
      storagePath: String(state.admin.chartForm.storagePath || ""),
    };
  }

  function selectAirportChartForEditing(chartId) {
    const currentAirportCode = normalizeCode(state.admin.chartForm && state.admin.chartForm.airportCode);
    const selected = (Array.isArray(state.admin.charts) ? state.admin.charts : [])
      .map((record) => normalizeAirportChartRecord(record))
      .find((record) => record.id === String(chartId || ""));
    if (!selected) {
      state.admin.chartForm = { ...createEmptyChartForm(), airportCode: currentAirportCode };
      return;
    }
    state.admin.chartForm = {
      id: selected.id,
      airportCode: currentAirportCode || selected.airportCode,
      name: selected.name,
      category: selected.category,
      storagePath: selected.storagePath,
    };
  }

  function readWaypointFormFromInputs(options = {}) {
    const rowInputs = Array.from(document.querySelectorAll("[data-admin-waypoint-row]"));
    const previousRows = normalizeWaypointRows(state.admin.waypointForm.rows);
    const rows = [];
    rowInputs.forEach((node) => {
      const key = String(node.getAttribute("data-admin-waypoint-row") || "");
      const [indexText, field, aliasIndexText] = key.split(":");
      const index = Number(indexText);
      if (!Number.isFinite(index) || index < 0 || !field) return;
      if (!rows[index]) rows[index] = createEmptyWaypointRow();
      if (field === "alias") {
        const aliasIndex = Number(aliasIndexText);
        if (!Number.isFinite(aliasIndex) || aliasIndex < 0) return;
        if (!Array.isArray(rows[index].aliases)) rows[index].aliases = [];
        rows[index].aliases[aliasIndex] = String(node.value || "");
      } else {
        rows[index][field] = String(node.value || "");
      }
      rows[index]._coordAutofilledFromName = Boolean(previousRows[index] && previousRows[index]._coordAutofilledFromName);
    });
    state.admin.waypointForm = {
      rows: normalizeWaypointRows(rows.length ? rows : state.admin.waypointForm.rows),
    };
    if (options.autofill !== false) syncAdminWaypointAutofill();
  }

  function normalizeWaypointRows(rows) {
    const source = Array.isArray(rows) ? rows.slice(0, 1) : [];
    const normalized = source.map((row) => {
      const parsedName = parseWaypointNameParts(row && row.name != null ? row.name : "");
      const explicitAliases = Array.isArray(row && row.aliases) ? row.aliases : [];
      return {
      name: parsedName.primary,
      aliases: Array.from(new Set([
        ...parsedName.aliases,
        ...explicitAliases.map((alias) => normalizeCode(alias)),
      ].filter((alias) => alias && alias !== parsedName.primary))),
      coord: String(row && row.coord != null ? row.coord : ""),
      _coordAutofilledFromName: Boolean(row && row._coordAutofilledFromName),
      };
    });
    return normalized.length ? normalized : [createEmptyWaypointRow()];
  }

  function syncAdminWaypointAutofill() {
    const rows = normalizeWaypointRows(state.admin.waypointForm.rows);
    rows.forEach((row) => {
      const route = normalizeCode(row.name);
      if (!route) {
        row.coord = "";
        row._coordAutofilledFromName = false;
        state.admin.selectedWaypointName = "";
        return;
      }
      const known = getWaypointData(route);
      if (known && known.hasCoords) {
        row.coord = known.coordText;
        row._coordAutofilledFromName = true;
      } else if (row._coordAutofilledFromName || !String(row.coord || "").trim()) {
        row.coord = "";
        row._coordAutofilledFromName = false;
      }
    });
    state.admin.waypointForm.rows = rows;
  }

  function readRpcRegistryFromInputs() {
    const rowInputs = Array.from(document.querySelectorAll("[data-admin-rpc-row]"));
    const rows = [];
    rowInputs.forEach((node) => {
      const key = String(node.getAttribute("data-admin-rpc-row") || "");
      const [indexText, field] = key.split(":");
      const index = Number(indexText);
      if (!Number.isFinite(index) || index < 0 || !field) return;
      if (!rows[index]) rows[index] = createEmptyRpcRegistryRow();
      rows[index][field] = String(node.value || "");
    });
    state.admin.rpcRegistryForm = {
      rows: normalizeRpcRegistryRows(rows.length ? rows : state.admin.rpcRegistryForm.rows),
    };
    syncAdminRpcAutofill();
  }

  function normalizeRpcRegistryRows(rows) {
    const source = Array.isArray(rows) ? rows.slice(0, 1) : [];
    const normalized = source.map((row) => ({
      registration: String(row && row.registration != null ? row.registration : ""),
      aircraftType: String(row && row.aircraftType != null ? row.aircraftType : ""),
      casClimb: String(row && row.casClimb != null ? row.casClimb : ""),
      casCruise: String(row && row.casCruise != null ? row.casCruise : ""),
      gph: String(row && row.gph != null ? row.gph : ""),
    }));
    return normalized.length ? normalized : [createEmptyRpcRegistryRow()];
  }

  function syncAdminRpcAutofill() {
    const rows = normalizeRpcRegistryRows(state.admin.rpcRegistryForm.rows);
    rows.forEach((row) => {
      const registration = normalizeCode(row.registration);
      if (!registration) {
        row.aircraftType = "";
        row.casClimb = "";
        row.casCruise = "";
        row.gph = "";
        return;
      }
      const known = getRpcRegistryRecord(registration);
      if (!known) {
        row.aircraftType = "";
        row.casClimb = "";
        row.casCruise = "";
        row.gph = "";
        return;
      }
      row.aircraftType = String(known.aircraftType || "");
      row.casClimb = String(known.casClimb || "");
      row.casCruise = String(known.casCruise || "");
      row.gph = String(known.gph || "");
    });
    state.admin.rpcRegistryForm.rows = rows;
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
      locked: Boolean(state.admin.presetForm.locked),
      rows: presetRowsFromLegs(selected.legs),
    };
    syncAdminPresetRowAutofill();
  }

  function selectWaypointForEditing(name) {
    state.admin.selectedWaypointName = normalizeCode(name);
    const selected = state.admin.waypoints.find((waypoint) => normalizeCode(waypoint.name) === state.admin.selectedWaypointName);
    if (!selected) {
      state.admin.waypointForm = {
        rows: normalizeWaypointRows([{
          name: state.admin.selectedWaypointName,
          aliases: [],
          coord: "",
        }]),
      };
      return;
    }
    state.admin.waypointForm = {
      rows: normalizeWaypointRows([{
        name: selected.name,
        aliases: selected.aliases,
        coord: selected.coord,
      }]),
    };
  }

  function selectRpcForEditing(registration) {
    state.admin.selectedRpcRegistration = normalizeCode(registration);
    const selected = state.admin.rpcRegistry.find((record) => normalizeCode(record.registration) === state.admin.selectedRpcRegistration);
    if (!selected) {
      state.admin.rpcRegistryForm = {
        rows: normalizeRpcRegistryRows([{
          registration: state.admin.selectedRpcRegistration,
          aircraftType: "",
          casClimb: "",
          casCruise: "",
          gph: "",
        }]),
      };
      return;
    }
    state.admin.rpcRegistryForm = {
      rows: normalizeRpcRegistryRows([selected]),
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
      syncAdminPresetRowAutofill();
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
    return { active: true, exists: false, message: "No preset found for this DEP/APP pair. Saving will create one." };
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
      state.admin.error = "Add at least one route row before saving.";
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

  async function saveWaypointsFromAdmin() {
    const ok = await connectSupabaseClient(false);
    if (!ok) {
      render();
      return;
    }
    const draftRow = normalizeWaypointRows(state.admin.waypointForm.rows)[0];
    const row = normalizeWaypointRecord(draftRow);
    if (!row.name) {
      state.admin.error = "Enter a waypoint before saving.";
      state.admin.notice = "";
      render();
      return;
    }
    state.admin.error = "";
    state.admin.notice = "";
    try {
      const payload = {
        name: formatWaypointStorageName(draftRow),
        coord: row.coord,
      };
      if (row.id) payload.id = row.id;
      const originalName = normalizeCode(state.admin.selectedWaypointName);
      const existingRecord = originalName
        ? (Array.isArray(state.admin.waypoints) ? state.admin.waypoints : []).find((waypoint) => normalizeCode(waypoint.name) === originalName)
        : null;
      const result = existingRecord
        ? await supabaseClient.from("waypoints").update(payload).eq("name", existingRecord.rawName || existingRecord.name)
        : await supabaseClient.from("waypoints").upsert(payload, { onConflict: "name" });
      if (result.error) throw result.error;
      state.admin.selectedWaypointName = row.name;
      await loadAdminData();
      state.admin.notice = "Waypoint saved.";
      render();
    } catch (error) {
      state.admin.error = error && error.message ? error.message : "Could not save waypoints.";
      render();
    }
  }

  async function deleteWaypointRowFromAdmin() {
    const row = normalizeWaypointRecord(normalizeWaypointRows(state.admin.waypointForm.rows)[0]);
    if (!row.name) {
      state.admin.waypointForm = createEmptyWaypointForm();
      syncAdminWaypointFormUi();
      render();
      return;
    }
    const existingRecord = (Array.isArray(state.admin.waypoints) ? state.admin.waypoints : []).find((waypoint) => normalizeCode(waypoint.name) === row.name);
    if (!existingRecord) {
      state.admin.waypointForm = createEmptyWaypointForm();
      state.admin.selectedWaypointName = "";
      syncAdminWaypointFormUi();
      render();
      return;
    }
    const ok = await connectSupabaseClient(false);
    if (!ok) {
      render();
      return;
    }
    if (!window.confirm("Delete this waypoint?")) return;
    try {
      const result = await supabaseClient.from("waypoints").delete().eq("name", existingRecord.rawName || existingRecord.name);
      if (result.error) throw result.error;
      state.admin.selectedWaypointName = "";
      state.admin.waypointForm = createEmptyWaypointForm();
      await loadAdminData();
      state.admin.notice = "Waypoint deleted.";
      render();
    } catch (error) {
      state.admin.error = error && error.message ? error.message : "Could not delete waypoint.";
      render();
    }
  }

  async function saveRpcRegistryFromAdmin() {
    const ok = await connectSupabaseClient(false);
    if (!ok) {
      render();
      return;
    }
    const row = normalizeRpcRegistryRecord(normalizeRpcRegistryRows(state.admin.rpcRegistryForm.rows)[0]);
    if (!row.registration) {
      state.admin.error = "Enter an RP-C registration before saving.";
      state.admin.notice = "";
      render();
      return;
    }
    state.admin.error = "";
    state.admin.notice = "";
    try {
      const payload = {
        registration: row.registration,
        aircraft_type: row.aircraftType,
        cas_climb: row.casClimb,
        cas_cruise: row.casCruise,
        gph: row.gph,
      };
      if (row.id) payload.id = row.id;
      const result = await supabaseClient.from("rpc_registry").upsert(payload, { onConflict: "registration" });
      if (result.error) throw result.error;
      state.admin.selectedRpcRegistration = row.registration;
      await loadAdminData();
      state.admin.notice = "RP-C record saved.";
      render();
    } catch (error) {
      state.admin.error = error && error.message ? error.message : "Could not save RP-C registry.";
      render();
    }
  }

  async function deleteRpcRowFromAdmin() {
    const row = normalizeRpcRegistryRecord(normalizeRpcRegistryRows(state.admin.rpcRegistryForm.rows)[0]);
    if (!row.registration) {
      state.admin.rpcRegistryForm = createEmptyRpcRegistryForm();
      syncAdminRpcFormUi();
      render();
      return;
    }
    const exists = (Array.isArray(state.admin.rpcRegistry) ? state.admin.rpcRegistry : []).some((record) => normalizeCode(record.registration) === row.registration);
    if (!exists) {
      state.admin.rpcRegistryForm = createEmptyRpcRegistryForm();
      state.admin.selectedRpcRegistration = "";
      syncAdminRpcFormUi();
      render();
      return;
    }
    const ok = await connectSupabaseClient(false);
    if (!ok) {
      render();
      return;
    }
    if (!window.confirm("Delete this RP-C record?")) return;
    try {
      const result = await supabaseClient.from("rpc_registry").delete().eq("registration", row.registration);
      if (result.error) throw result.error;
      state.admin.selectedRpcRegistration = "";
      state.admin.rpcRegistryForm = createEmptyRpcRegistryForm();
      await loadAdminData();
      state.admin.notice = "RP-C record deleted.";
      render();
    } catch (error) {
      state.admin.error = error && error.message ? error.message : "Could not delete RP-C record.";
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

  function sanitizeChartFileName(value) {
    const cleaned = String(value || "chart.pdf")
      .trim()
      .replace(/[^a-z0-9._-]+/gi, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");
    return cleaned || "chart.pdf";
  }

  function isAirportChartsCategorySchemaError(error) {
    const message = String(error && error.message ? error.message : "").toLowerCase();
    return message.includes("could not find the 'category' column")
      || message.includes('could not find the "category" column')
      || message.includes("schema cache");
  }

  async function uploadAirportChartFromAdmin() {
    const ok = await connectSupabaseClient(false);
    if (!ok || !supabaseClient) {
      render();
      return;
    }
    readAdminChartFormFromInputs();
    const fileInput = document.getElementById("admin-chart-file");
    const uploadButton = document.getElementById("admin-chart-upload");
    const airportCode = normalizeCode(state.admin.chartForm.airportCode);
    const file = fileInput && fileInput.files ? fileInput.files[0] : null;
    const currentChartId = String(state.admin.chartForm.id || "");
    const existingChart = currentChartId
      ? (Array.isArray(state.admin.charts) ? state.admin.charts : [])
        .map((record) => normalizeAirportChartRecord(record))
        .find((record) => record.id === currentChartId)
      : null;
    const fallbackName = file ? String(file.name || "").replace(/\.pdf$/i, "").trim() : "";
    const chartName = String(state.admin.chartForm.name || "").trim() || fallbackName;
    const chartCategory = String(state.admin.chartForm.category || "").trim();
    const isPdf = Boolean(file && (file.type === "application/pdf" || /\.pdf$/i.test(file.name || "")));
    if (!airportCode || !chartName || (!existingChart && !isPdf)) {
      state.admin.chartUploadStatus = !airportCode
        ? "Enter an airport code."
        : !chartName
          ? "Enter a chart name."
          : "Choose a PDF document.";
      render();
      return;
    }
    if (uploadButton) {
      uploadButton.disabled = true;
      uploadButton.textContent = existingChart ? "Saving..." : "Uploading...";
    }
    state.admin.chartUploadStatus = existingChart ? "Saving chart..." : "Uploading chart...";
    try {
      let storagePath = existingChart ? String(existingChart.storagePath || "") : "";
      let previousStoragePath = "";
      if (file) {
        storagePath = `${airportCode}/${Date.now()}-${sanitizeChartFileName(file.name)}`;
        const uploadResult = await supabaseClient.storage.from(AIRPORT_CHARTS_BUCKET).upload(storagePath, file, {
          cacheControl: "3600",
          contentType: "application/pdf",
          upsert: false,
        });
        if (uploadResult.error) throw uploadResult.error;
        previousStoragePath = existingChart ? String(existingChart.storagePath || "") : "";
      }
      let chartResult;
      if (existingChart) {
        chartResult = await supabaseClient.from("airport_charts").update({
          airport_code: airportCode,
          name: chartName,
          category: chartCategory,
          storage_path: storagePath,
        }).eq("id", existingChart.id);
        if (chartResult.error && isAirportChartsCategorySchemaError(chartResult.error)) {
          chartResult = await supabaseClient.from("airport_charts").update({
            airport_code: airportCode,
            name: chartName,
            storage_path: storagePath,
          }).eq("id", existingChart.id);
          if (!chartResult.error) {
            state.admin.chartUploadStatus = "Chart saved. Run the SQL update to enable saved categories.";
          }
        }
      } else {
        chartResult = await supabaseClient.from("airport_charts").insert({
          airport_code: airportCode,
          name: chartName,
          category: chartCategory,
          storage_path: storagePath,
        });
        if (chartResult.error && isAirportChartsCategorySchemaError(chartResult.error)) {
          chartResult = await supabaseClient.from("airport_charts").insert({
            airport_code: airportCode,
            name: chartName,
            storage_path: storagePath,
          });
          if (!chartResult.error) {
            state.admin.chartUploadStatus = "Chart uploaded. Run the SQL update to enable saved categories.";
          }
        }
      }
      if (chartResult.error) {
        if (file && storagePath) await supabaseClient.storage.from(AIRPORT_CHARTS_BUCKET).remove([storagePath]);
        throw chartResult.error;
      }
      if (file && previousStoragePath && previousStoragePath !== storagePath) {
        await supabaseClient.storage.from(AIRPORT_CHARTS_BUCKET).remove([previousStoragePath]);
      }
      await loadAdminData();
      state.admin.chartForm = { ...createEmptyChartForm(), airportCode };
      if (fileInput) fileInput.value = "";
      if (!String(state.admin.chartUploadStatus || "").trim()) state.admin.chartUploadStatus = existingChart ? "Chart saved." : "Chart uploaded.";
      render();
    } catch (error) {
      state.admin.chartUploadStatus = error && error.message ? error.message : (existingChart ? "Could not save chart." : "Could not upload chart.");
      render();
    }
  }

  async function deleteAirportChartFromAdmin(chartId) {
    const chart = (Array.isArray(state.admin.charts) ? state.admin.charts : [])
      .map((record) => normalizeAirportChartRecord(record))
      .find((record) => record.id === String(chartId || ""));
    if (!chart || !window.confirm(`Delete ${chart.name || "this chart"}?`)) return;
    const ok = await connectSupabaseClient(false);
    if (!ok || !supabaseClient) {
      render();
      return;
    }
    try {
      if (chart.storagePath) {
        const storageResult = await supabaseClient.storage.from(AIRPORT_CHARTS_BUCKET).remove([chart.storagePath]);
        if (storageResult.error) throw storageResult.error;
      }
      const deleteResult = await supabaseClient.from("airport_charts").delete().eq("id", chart.id);
      if (deleteResult.error) throw deleteResult.error;
      await loadAdminData();
      if (state.admin.chartForm.id === chart.id) {
        state.admin.chartForm = { ...createEmptyChartForm(), airportCode: normalizeCode(state.admin.chartForm.airportCode || chart.airportCode) };
      }
      state.admin.chartUploadStatus = "Chart deleted.";
      render();
    } catch (error) {
      state.admin.chartUploadStatus = error && error.message ? error.message : "Could not delete chart.";
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

  function syncAdminAirportFormUi() {
    const setValue = (id, value) => {
      const node = document.getElementById(id);
      if (!node) return;
      const next = String(value || "");
      if (node.value !== next) node.value = next;
    };
    setValue("admin-airport-code", state.admin.airportForm.code);
    setValue("admin-airport-cptAtis", state.admin.airportForm.cptAtis);
    setValue("admin-airport-depAap", state.admin.airportForm.depAap);
    setValue("admin-airport-twr", state.admin.airportForm.twr);
    setValue("admin-airport-gnd", state.admin.airportForm.gnd);
    setValue("admin-airport-fss", state.admin.airportForm.fss);
    setValue("admin-airport-remarks", state.admin.airportForm.remarks);

    const statusNode = document.querySelector(".manual-section:not(.hidden) .preset-status");
    if (statusNode) {
      const code = normalizeCode(state.admin.airportForm.code);
      const exists = Boolean(code && state.admin.airports.some((airport) => airport.code === code || airport.id === code));
      statusNode.classList.remove("available", "missing");
      statusNode.textContent = code ? (exists ? "airport avbl" : "airport unavbl") : "";
      if (code) statusNode.classList.add(exists ? "available" : "missing");
    }

    const deleteButton = document.getElementById("admin-airport-delete");
    if (deleteButton) {
      const code = normalizeCode(state.admin.airportForm.code);
      const exists = Boolean(code && state.admin.airports.some((airport) => airport.code === code || airport.id === code));
      deleteButton.disabled = !exists;
    }
  }

  function syncAdminPresetFormUi() {
    const preset = state.admin.presetForm || createEmptyPresetForm();
    const setValue = (selector, value) => {
      const node = document.querySelector(selector);
      if (!node) return;
      const next = String(value || "");
      if (node.value !== next) node.value = next;
    };
    const rows = normalizePresetRows(preset.rows);
    rows.forEach((row, index) => {
      setValue(`[data-admin-preset-row="${index}:route"]`, row.route);
      setValue(`[data-admin-preset-row="${index}:coord"]`, row.coord);
      setValue(`[data-admin-preset-row="${index}:tc"]`, row.tc);
      setValue(`[data-admin-preset-row="${index}:distance"]`, row.distance);
    });
    const lockButton = document.getElementById("admin-preset-lock");
    if (lockButton) {
      lockButton.innerHTML = renderLockGlyph(Boolean(preset.locked));
      lockButton.classList.toggle("active", Boolean(preset.locked));
      lockButton.setAttribute("aria-label", preset.locked ? "Unlock TC and distance overrides" : "Lock TC and distance overrides");
      lockButton.setAttribute("title", preset.locked ? "Unlock TC and distance overrides" : "Lock TC and distance overrides");
    }
  }

  function syncAdminWaypointFormUi() {
    const rows = normalizeWaypointRows(state.admin.waypointForm.rows);
    rows.forEach((row, index) => {
      const nameNode = document.querySelector(`[data-admin-waypoint-row="${index}:name"]`);
      const coordNode = document.querySelector(`[data-admin-waypoint-row="${index}:coord"]`);
      if (nameNode && nameNode.value !== String(row.name || "")) nameNode.value = String(row.name || "");
      if (coordNode && coordNode.value !== String(row.coord || "")) coordNode.value = String(row.coord || "");
      (Array.isArray(row.aliases) ? row.aliases : []).forEach((alias, aliasIndex) => {
        const aliasNode = document.querySelector(`[data-admin-waypoint-row="${index}:alias:${aliasIndex}"]`);
        if (aliasNode && aliasNode.value !== String(alias || "")) aliasNode.value = String(alias || "");
      });
      const addAliasButton = document.querySelector(`[data-admin-waypoint-add-alias="${index}"]`);
      if (addAliasButton) {
        const active = Boolean(String(row.name || "").trim());
        addAliasButton.disabled = !active;
        addAliasButton.classList.toggle("active", active);
      }
    });
  }

  function syncAdminRpcFormUi() {
    const rows = normalizeRpcRegistryRows(state.admin.rpcRegistryForm.rows);
    rows.forEach((row, index) => {
      const registrationNode = document.querySelector(`[data-admin-rpc-row="${index}:registration"]`);
      const aircraftNode = document.querySelector(`[data-admin-rpc-row="${index}:aircraftType"]`);
      const climbNode = document.querySelector(`[data-admin-rpc-row="${index}:casClimb"]`);
      const cruiseNode = document.querySelector(`[data-admin-rpc-row="${index}:casCruise"]`);
      const gphNode = document.querySelector(`[data-admin-rpc-row="${index}:gph"]`);
      if (registrationNode && registrationNode.value !== String(row.registration || "")) registrationNode.value = String(row.registration || "");
      if (aircraftNode && aircraftNode.value !== String(row.aircraftType || "")) aircraftNode.value = String(row.aircraftType || "");
      if (climbNode && climbNode.value !== String(row.casClimb || "")) climbNode.value = String(row.casClimb || "");
      if (cruiseNode && cruiseNode.value !== String(row.casCruise || "")) cruiseNode.value = String(row.casCruise || "");
      if (gphNode && gphNode.value !== String(row.gph || "")) gphNode.value = String(row.gph || "");
    });
  }

  function isAnnouncementActive(item, nowMs) {
    if (!item) return false;
    const startAt = announcementPartsToUtcIso(item.startDate, item.startTimeUtc);
    const endAt = announcementPartsToUtcIso(item.endDate, item.endTimeUtc);
    const startMs = startAt ? new Date(startAt).getTime() : Number.NaN;
    const endMs = endAt ? new Date(endAt).getTime() : Number.NaN;
    const hasStart = Number.isFinite(startMs);
    const hasEnd = Number.isFinite(endMs);
    if (item.permanent) {
      if (hasStart && nowMs < startMs) return false;
      return true;
    }
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

  async function saveMaintenanceModeFromAdmin(enabled, textValue) {
    const ok = await connectSupabaseClient(false);
    if (!ok) {
      render();
      return false;
    }
    state.admin.error = "";
    state.admin.notice = "";
    const text = String(textValue || "").trim() || "under maintenance: service is undergoing maintenance. do not trust.";
    try {
      const { error } = await supabaseClient.from("content_pages").upsert(
        [
          { key: "maintenance_mode", body_html: enabled ? "1" : "0" },
          { key: "maintenance_text", body_html: text },
        ],
        { onConflict: "key" },
      );
      if (error) throw error;
      state.catalog.content.maintenanceMode = Boolean(enabled);
      state.catalog.content.maintenanceText = text;
      state.admin.maintenanceMode = Boolean(enabled);
      state.admin.maintenanceTextDraft = text;
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
    state.navlog.tocTod.tocManual = Boolean(state.navlog.tocTod.tocManual);
    state.navlog.tocTod.todManual = Boolean(state.navlog.tocTod.todManual);
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

    if (!state.navlog.tocTod.tocEditing) {
      if (!state.navlog.tocTod.tocManual && roc != null && roc > 0 && secondAlt != null && firstGs != null) {
        const departureElevation = firstAlt == null ? 0 : firstAlt;
        const altitudeToGain = secondAlt - departureElevation;
        const tocTime = Math.max(0, altitudeToGain / roc);
        const tocDistance = tocTime * (firstGs / 60);
        state.navlog.tocTod.tocTime = formatGeneralMinutes(tocTime);
        state.navlog.tocTod.tocDistance = formatDistanceDisplay(tocDistance);
      } else if (!state.navlog.tocTod.tocManual) {
        state.navlog.tocTod.tocDistance = "";
        state.navlog.tocTod.tocTime = "";
      }
    }

    if (!state.navlog.tocTod.todEditing) {
      if (!state.navlog.tocTod.todManual && rod != null && rod > 0 && lastAlt != null && secondLastAlt != null && lastGs != null) {
        const altitudeToLose = Math.max(0, secondLastAlt - lastAlt);
        const todTime = altitudeToLose / rod;
        const todDistance = todTime * (lastGs / 60);
        state.navlog.tocTod.todTime = formatGeneralMinutes(todTime);
        state.navlog.tocTod.todDistance = formatDistanceDisplay(todDistance);
      } else if (!state.navlog.tocTod.todManual) {
        state.navlog.tocTod.todDistance = "";
        state.navlog.tocTod.todTime = "";
      }
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
      syncLegField(index, "ch", leg.ch, activeEdit, leg);
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
      syncLegDerived(index, "ch", Boolean(leg._derived && leg._derived.ch));
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
    syncKioskPhoneSpeedDisplayValues();
    syncRouteProgressMarkerDisplay();
  }

  function syncKioskPhoneSpeedDisplayValues() {
    if (!isPhoneActivateMode()) return;
    const mode = getKioskPhoneSpeedCellMode();
    state.navlog.legs.forEach((leg, index) => {
      const node = document.querySelector(`[data-kiosk-speed-display="${index}"]`);
      if (!node) return;
      const field = mode === "ta" ? "ta" : "gs";
      node.value = legFieldValue(leg, field);
      node.setAttribute("data-leg-field", `${index}:${field}`);
      const wrapper = node.closest(".field");
      if (wrapper) {
        wrapper.classList.toggle("derived", Boolean(leg._derived && leg._derived[field]));
        wrapper.classList.toggle("error", Boolean(leg._errors && leg._errors[field]));
      }
    });
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

  function computeRouteProgressState(nowMs = Date.now()) {
    const legs = Array.isArray(state.navlog?.legs) ? state.navlog.legs : [];
    if (!legs.length) return null;
    const timeline = buildLegAbsoluteTimeTimeline();
    const lastWaypointIndex = legs.length - 1;

    let latestAtIndex = -1;
    timeline.forEach((entry, index) => {
      if (Number.isFinite(Number(entry?.atUtcMs))) latestAtIndex = index;
    });

    if (latestAtIndex < 0) return { type: "waypoint", waypointIndex: 0, overdue: true };
    if (latestAtIndex >= lastWaypointIndex) {
      return { type: "waypoint", waypointIndex: lastWaypointIndex, overdue: true };
    }

    const fromIndex = latestAtIndex;
    const toIndex = latestAtIndex + 1;
    const fromAtMs = Number(timeline[fromIndex]?.atUtcMs);
    const toEtMs = Number(timeline[toIndex]?.etUtcMs);
    if (!Number.isFinite(fromAtMs) || !Number.isFinite(toEtMs)) return { type: "waypoint", waypointIndex: fromIndex, overdue: true };

    const movementStartMs = Math.min(fromAtMs, nowMs);
    if (toEtMs <= movementStartMs) return { type: "waypoint", waypointIndex: fromIndex, overdue: true };

    if (nowMs >= toEtMs) {
      return { type: "waypoint", waypointIndex: toIndex, overdue: true };
    }

    const progress = clamp((nowMs - movementStartMs) / (toEtMs - movementStartMs), 0, 1);
    return { type: "segment", fromIndex, toIndex, progress, overdue: false };
  }

  function syncRouteProgressMarkerDisplay() {
    const marker = document.getElementById("route-progress-marker");
    if (!marker) return;
    if (!state.meta) state.meta = {};
    if (!("routeProgressMarkerSnapshot" in state.meta)) state.meta.routeProgressMarkerSnapshot = null;
    const tableBody = marker.closest(".table-body");
    if (!tableBody) return;
    if (state.view === "ipad-kiosk" && isIpadDevice()) {
      const sheet = document.querySelector(".ipad-kiosk-wrap .sheet");
      const sheetTransform = String(sheet && sheet.style ? sheet.style.transform || "" : "");
      if (!/scale\(/i.test(sheetTransform)) return;
    }
    const routeCells = Array.from(tableBody.querySelectorAll(".leg-row .route-cell"));
    if (!routeCells.length) {
      marker.classList.remove("visible");
      marker.classList.remove("overdue");
      delete marker.dataset.positioned;
      state.meta.routeProgressMarkerSnapshot = null;
      return;
    }
    const hasUnlaidOutRow = routeCells.some((cell) => cell.offsetHeight < 4 || cell.offsetWidth < 4);
    if (hasUnlaidOutRow || tableBody.offsetHeight < 12) {
      const snapshot = state.meta.routeProgressMarkerSnapshot;
      if (snapshot && Number.isFinite(Number(snapshot.leftPx)) && Number.isFinite(Number(snapshot.topPx))) {
        marker.style.left = `${Number(snapshot.leftPx).toFixed(3)}px`;
        marker.style.top = `${Number(snapshot.topPx).toFixed(3)}px`;
        marker.classList.toggle("visible", Boolean(snapshot.visible));
        marker.classList.toggle("overdue", Boolean(snapshot.overdue));
        marker.dataset.positioned = "1";
        return;
      }
      if (marker.dataset.positioned === "1") return;
      marker.classList.remove("visible");
      marker.classList.remove("overdue");
      delete marker.dataset.positioned;
      state.meta.routeProgressMarkerSnapshot = null;
      return;
    }

    const progressState = computeRouteProgressState(Date.now());
    if (!progressState) {
      marker.classList.remove("visible");
      marker.classList.remove("overdue");
      delete marker.dataset.positioned;
      state.meta.routeProgressMarkerSnapshot = null;
      return;
    }

    const firstRouteCell = routeCells[0];
    let dividerX = Number.NaN;
    const firstWaypointMarker = firstRouteCell.querySelector(".route-waypoint-marker");
    if (firstWaypointMarker && firstWaypointMarker.offsetWidth > 0) {
      // Use layout-space offsets (not viewport-space rects) so iPad sheet
      // scaling does not skew marker X alignment.
      dividerX = firstRouteCell.offsetLeft + firstWaypointMarker.offsetLeft;
    } else {
      const borderRightWidth = parseFloat(window.getComputedStyle(firstRouteCell).borderRightWidth || "2") || 2;
      dividerX = firstRouteCell.offsetLeft + firstRouteCell.offsetWidth - (borderRightWidth / 2);
    }
    const waypointYPositions = routeCells.map((cell) => cell.offsetTop + (cell.offsetHeight / 2));
    if (!waypointYPositions.length || !Number.isFinite(dividerX) || dividerX <= 0) {
      marker.classList.remove("visible");
      marker.classList.remove("overdue");
      delete marker.dataset.positioned;
      state.meta.routeProgressMarkerSnapshot = null;
      return;
    }

    const clampWaypointIndex = (index) => {
      const parsed = Number(index);
      if (!Number.isFinite(parsed)) return 0;
      return Math.max(0, Math.min(waypointYPositions.length - 1, Math.floor(parsed)));
    };

    let markerY = waypointYPositions[0];
    if (progressState.type === "segment") {
      const fromIndex = clampWaypointIndex(progressState.fromIndex);
      const toIndex = clampWaypointIndex(progressState.toIndex);
      const fromY = waypointYPositions[fromIndex];
      const toY = waypointYPositions[toIndex];
      markerY = fromY + ((toY - fromY) * clamp(progressState.progress, 0, 1));
    } else {
      const waypointIndex = clampWaypointIndex(progressState.waypointIndex);
      markerY = waypointYPositions[waypointIndex];
    }

    const nextLeft = `${dividerX.toFixed(3)}px`;
    const nextTop = `${markerY.toFixed(3)}px`;
    const isFirstPosition = marker.dataset.positioned !== "1";
    if (isFirstPosition) {
      marker.style.transition = "none";
      marker.style.left = nextLeft;
      marker.style.top = nextTop;
      marker.classList.add("visible");
      marker.classList.toggle("overdue", Boolean(progressState.overdue));
      marker.dataset.positioned = "1";
      state.meta.routeProgressMarkerSnapshot = {
        leftPx: dividerX,
        topPx: markerY,
        overdue: Boolean(progressState.overdue),
        visible: true,
      };
      marker.getBoundingClientRect();
      marker.style.transition = "";
      return;
    }

    marker.style.left = nextLeft;
    marker.style.top = nextTop;
    marker.classList.add("visible");
    marker.classList.toggle("overdue", Boolean(progressState.overdue));
    state.meta.routeProgressMarkerSnapshot = {
      leftPx: dividerX,
      topPx: markerY,
      overdue: Boolean(progressState.overdue),
      visible: true,
    };
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
      const leg = state.navlog.legs[index] || {};
      const showHint = String(node.value || "").trim() === "" && document.activeElement !== node;
      const routeIsUnknown = String(node.value || "").trim() !== "" && !isRecognizedRoute(node.value);
      const shouldShowUnknownRoute = routeIsUnknown && (state.view !== "ipad-kiosk" || leg._kioskCreated === true);
      wrapper.classList.toggle("show-route-hint", showHint);
      wrapper.classList.toggle("route-unknown", shouldShowUnknownRoute);
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
    const legValues = state.navlog.legs.flatMap((leg) => [leg.route, leg.cas, leg.alt, leg.temp, leg.windDir, leg.windSpd, leg.tc, leg.wca, leg.th, leg.var, leg.mh, leg.dev, leg.ch, leg.ta, leg.gs, leg.distance, leg.ee, leg.et, leg.at]);
    const radioValues = state.navlog.radios.flatMap((row) => [row.location, row.cptAtis, row.depAap, row.twr, row.gnd, row.fss, row.remarks]);
    const tocTodValues = [state.navlog.tocTod.roc, state.navlog.tocTod.rod, state.navlog.tocTod.tocDistance, state.navlog.tocTod.tocTime, state.navlog.tocTod.todDistance, state.navlog.tocTod.todTime];
    const footerValues = [state.navlog.depAtisCode, state.navlog.destinAtisCode];
    return [...headerValues, ...legValues, ...radioValues, ...tocTodValues, ...footerValues].some((value) => String(value || "").trim() !== "");
  }

  function getMappedAircraftFromRpc(rpcValue) {
    const record = getRpcRegistryRecord(rpcValue);
    if (record && record.aircraftType) return String(record.aircraftType || "").trim();
    return "";
  }

  function applyRpcAutofillFromHeader(rpcValue) {
    const record = getRpcRegistryRecord(rpcValue);
    if (!record) return;
    const aircraft = record && record.aircraftType ? String(record.aircraftType || "").trim() : "";
    const fuel = record && record.gph ? String(record.gph || "").trim() : "";
    const aircraftInput = document.querySelector('[data-header="aircraft"]');
    const fuelInput = document.querySelector('[data-header="gphPph"]');
    state.navlog.header.aircraft = aircraft;
    state.navlog.header.gphPph = fuel;
    if (aircraftInput) aircraftInput.value = aircraft;
    if (fuelInput) fuelInput.value = fuel;
    applyDefaultCasForAircraft(record || null);
    syncAircraftFuelDefaults();
    computeRouteMath();
    updateComputedCells();
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

  function applyDefaultCasForAircraft(registrationRecordOrType) {
    if (!Array.isArray(state.navlog.legs) || state.navlog.legs.length === 0) return;
    const record = typeof registrationRecordOrType === "object" && registrationRecordOrType
      ? normalizeRpcRegistryRecord(registrationRecordOrType)
      : getRpcRegistryRecord(registrationRecordOrType) || normalizeRpcRegistryRecord({ aircraftType: registrationRecordOrType });
    const climbCas = String(record.casClimb || "").trim();
    const cruiseCas = String(record.casCruise || "").trim();
    const aircraftType = String(record.aircraftType || "").trim();
    if (!aircraftType && !climbCas && !cruiseCas) {
      state.navlog.legs.forEach((leg) => {
        if (!leg) return;
        leg.cas = "";
        leg._manual = leg._manual || {};
        leg._manual.cas = false;
        leg._derived = leg._derived || {};
        delete leg._derived.cas;
      });
      return;
    }

    state.navlog.legs.forEach((leg, index) => {
      if (!leg) return;
      if (index === 0) {
        leg.cas = "";
        leg._manual = leg._manual || {};
        leg._manual.cas = false;
        leg._derived = leg._derived || {};
        delete leg._derived.cas;
        return;
      }
      const nextCas = index === 1 ? climbCas : cruiseCas;
      leg.cas = String(nextCas || "");
      leg._manual = leg._manual || {};
      leg._manual.cas = String(nextCas || "").trim() !== "";
      leg._derived = leg._derived || {};
      delete leg._derived.cas;
    });
  }

  function syncAircraftFuelDefaults() {
    const rpcRecord = getRpcRegistryRecord(state.navlog.header.rpCNo);
    const fuelInput = document.querySelector('[data-header="gphPph"]');
    const nextFuel = rpcRecord && String(rpcRecord.gph || "").trim() ? String(rpcRecord.gph).trim() : "";
    state.navlog.header.gphPph = nextFuel;
    if (fuelInput) fuelInput.value = nextFuel;
  }

  function roundHalfUp(value) {
    if (!Number.isFinite(value)) return value;
    const sign = value < 0 ? -1 : 1;
    return sign * Math.floor((Math.abs(value) + 0.5));
  }

  function isDegreeField(field) {
    return field === "tc" || field === "wca" || field === "windDir" || field === "th" || field === "var" || field === "mh" || field === "dev" || field === "ch";
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

  function formatEeDisplayWithTimeRounding(minutesFloat, roundTimeValues) {
    if (!Number.isFinite(minutesFloat)) return "";
    const bounded = Math.max(0, minutesFloat);
    if (roundTimeValues) return String(Math.ceil(bounded));
    const totalSeconds = Math.max(0, Math.round(bounded * 60));
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins}m ${secs}s`;
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
    const minsSecs = text.match(/^\s*(\d+)\s*m(?:in)?s?\s*(\d+)\s*s(?:ec)?s?\s*$/i);
    if (minsSecs) {
      const mins = Number(minsSecs[1]);
      const secs = Number(minsSecs[2]);
      if (Number.isFinite(mins) && Number.isFinite(secs) && secs >= 0 && secs < 60) return mins + (secs / 60);
    }
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
    let activeAnchorAt = parseAtInput(state.navlog.legs[0] && state.navlog.legs[0].at);
    let cumulativeEeFromAnchor = 0;
    state.navlog.legs.forEach((leg, index) => {
      leg._derived = leg._derived || {};
      if (index === 0) {
        leg.et = "";
        delete leg._derived.et;
        return;
      }
      const eeMinutes = parseEeInput(leg.ee);
      const safeEe = (eeMinutes == null || !Number.isFinite(eeMinutes) || eeMinutes < 0) ? 0 : eeMinutes;
      const atAbove = parseAtInput(state.navlog.legs[index - 1] && state.navlog.legs[index - 1].at);
      if (Number.isFinite(atAbove)) {
        activeAnchorAt = atAbove;
        cumulativeEeFromAnchor = 0;
      }
      if (Number.isFinite(activeAnchorAt)) {
        cumulativeEeFromAnchor += safeEe;
        leg.et = formatMinutesAsHhmmWrapped(activeAnchorAt + cumulativeEeFromAnchor);
        leg._derived.et = true;
      } else {
        leg.et = "";
        delete leg._derived.et;
      }
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

  function formatUtcNowHhmm() {
    const now = new Date();
    const hh = String(now.getUTCHours()).padStart(2, "0");
    const mm = String(now.getUTCMinutes()).padStart(2, "0");
    return `${hh}${mm}`;
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
      if (state.view === "ipad-kiosk" && isPhoneActivateMode()) {
        node.textContent = `${now}Z`;
        return;
      }
      node.textContent = `UTC ${now}`;
    });
    if (state.view === "ipad-kiosk") {
      syncKioskEventTimerDisplay();
      syncKioskRouteEstimateLiveDistanceDisplay();
      watchdogKioskGpsTracking();
      updateKioskGpsDom();
    }
    syncRouteProgressMarkerDisplay();
  }

  async function downloadPdf() {
    const sheet = document.querySelector(".sheet");
    const saveButton = document.getElementById("save-sheet");
    if (!sheet) return;
    if (!window.html2canvas || !window.jspdf) {
      if (saveButton) saveButton.textContent = "Print...";
      try {
        window.print();
      } finally {
        if (saveButton) {
          setTimeout(() => {
            saveButton.textContent = "Save";
          }, 180);
        }
      }
      return;
    }
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
          const clearInputs = (container) => {
            if (!container) return;
            container.querySelectorAll("input").forEach((input) => {
              input.value = "";
              input.setAttribute("value", "");
              input.placeholder = "";
            });
          };
          const stripRouteHintClasses = (rowNode) => {
            if (!rowNode) return;
            rowNode.querySelectorAll(".route-cell").forEach((routeCell) => {
              routeCell.classList.remove("first-route-hint");
              routeCell.classList.remove("last-route-hint");
              routeCell.classList.remove("show-route-hint");
            });
          };
          const ensureMinimumRows = (bodyNode, rowSelector, minimumRows) => {
            if (!bodyNode) return;
            const currentRows = () => Array.from(bodyNode.children).filter((child) => child.matches(rowSelector));
            let rows = currentRows();
            if (!rows.length) return;
            const template = rows[rows.length - 1];
            while (rows.length < minimumRows) {
              const clone = template.cloneNode(true);
              clearInputs(clone);
              stripRouteHintClasses(clone);
              bodyNode.appendChild(clone);
              rows = currentRows();
            }
          };

          doc.body.classList.add("pdf-export");
          doc.body.classList.add(pdfLayout === "printable" ? "pdf-export-printable" : "pdf-export-default");

          // Force a desktop-like render box so mobile/tablet exports match desktop proportions.
          doc.documentElement.style.width = `${pdfViewportWidth}px`;
          doc.body.style.width = `${pdfViewportWidth}px`;
          doc.querySelectorAll("input").forEach((input) => {
            input.placeholder = "";
          });

          // PDF-only row floor: keep route and airport tables expanded to printable minimums.
          ensureMinimumRows(doc.querySelector(".table-body"), ".leg-row", 8);
          ensureMinimumRows(doc.querySelector(".radio-body"), ".radio-row", 5);

          // PDF view hides CAS structurally: remove CAS cells and shift table grids.
          doc.querySelectorAll(".nav-head-grid").forEach((head) => {
            if (!head.classList.contains("nav-head-grid-phone")) head.classList.add("nav-head-grid-no-cas");
            head.querySelectorAll(".cas-head").forEach((cell) => cell.remove());
          });
          doc.querySelectorAll(".leg-row").forEach((row) => {
            if (row.classList.contains("leg-row-phone")) return;
            const casInput = row.querySelector('input[data-leg-field$=":cas"]');
            if (casInput) {
              const casCell = casInput.closest("div");
              if (casCell && casCell.parentElement === row) casCell.remove();
            }
            row.classList.add("leg-row-no-cas");
          });
        },
      });
      const image = canvas.toDataURL("image/png");
      const { jsPDF } = window.jspdf;
      let pdf;
      if (pdfLayout === "printable") {
        pdf = new jsPDF("p", "mm", "a4");
        const pageWidth = 210;
        const pageHeight = 297;
        const marginLeft = 4;
        const marginTop = 4;
        const marginRight = 4;
        const marginBottom = 4;
        const maxWidth = pageWidth - marginLeft - marginRight;
        const maxHeight = pageHeight - marginTop - marginBottom;
        const cornerWidth = 108;
        const imageAspect = canvas.height / canvas.width;
        let exportWidth = Math.min(cornerWidth, maxWidth);
        let exportHeight = exportWidth * imageAspect;
        if (exportHeight > maxHeight) {
          exportHeight = maxHeight;
          exportWidth = exportHeight / imageAspect;
        }
        pdf.addImage(image, "PNG", marginLeft, marginTop, exportWidth, exportHeight);
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
        <input data-header="date" value="${escapeAttr(normalizedDisplay)}" placeholder="yy/mm/dd" readonly />
        <input type="date" class="date-picker-proxy" data-date-picker value="${escapeAttr(isoValue)}" tabindex="-1" aria-hidden="true" />
      </span>
    `;
  }

  function persistPublicCatalogCache() {
    try {
      const payload = {
        routePresets: (state.catalog.routePresets || []).map((preset) => clonePreset(preset)),
        airports: (state.catalog.airports || []).map((airport) => ({ ...airport })),
        waypoints: (state.catalog.waypoints || []).map((waypoint) => cloneWaypointRecord(waypoint)),
        rpcRegistry: (state.catalog.rpcRegistry || []).map((record) => cloneRpcRegistryRecord(record)),
        charts: (state.catalog.charts || []).map((record) => cloneAirportChartRecord(record)),
        content: {
          manualHtml: String(state.catalog.content.manualHtml || ""),
          privacyHtml: String(state.catalog.content.privacyHtml || ""),
          announcements: Array.isArray(state.catalog.content.announcements) ? state.catalog.content.announcements.map((item) => ({ ...item })) : [],
          maintenanceMode: Boolean(state.catalog.content.maintenanceMode),
          maintenanceText: String(state.catalog.content.maintenanceText || ""),
          additionalInfoTable: Array.isArray(state.catalog.content.additionalInfoTable)
            ? state.catalog.content.additionalInfoTable.map((row) => Array.isArray(row) ? row.slice() : [])
            : [],
        },
        savedAt: Date.now(),
      };
      window.localStorage.setItem(NAVLOG_PUBLIC_CATALOG_CACHE_KEY, JSON.stringify(payload));
    } catch {
      // ignore storage failures
    }
  }

  function restorePublicCatalogCache() {
    try {
      const raw = window.localStorage.getItem(NAVLOG_PUBLIC_CATALOG_CACHE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") return;
      if (Array.isArray(parsed.routePresets) && parsed.routePresets.length) {
        state.catalog.routePresets = parsed.routePresets.map((preset) => clonePreset(preset));
      }
      if (Array.isArray(parsed.airports) && parsed.airports.length) {
        state.catalog.airports = parsed.airports.map((airport) => normalizeAirportRecord(airport));
      }
      if (Array.isArray(parsed.waypoints) && parsed.waypoints.length) {
        state.catalog.waypoints = parsed.waypoints.map((waypoint) => cloneWaypointRecord(waypoint));
      }
      if (Array.isArray(parsed.rpcRegistry) && parsed.rpcRegistry.length) {
        state.catalog.rpcRegistry = parsed.rpcRegistry.map((record) => cloneRpcRegistryRecord(record));
      }
      if (Array.isArray(parsed.charts)) {
        state.catalog.charts = parsed.charts.map((record) => cloneAirportChartRecord(record));
      }
      if (parsed.content && typeof parsed.content === "object") {
        const content = parsed.content;
        if (typeof content.manualHtml === "string") state.catalog.content.manualHtml = content.manualHtml;
        if (typeof content.privacyHtml === "string") state.catalog.content.privacyHtml = content.privacyHtml;
        if (Array.isArray(content.announcements)) state.catalog.content.announcements = content.announcements.map((item) => ({ ...item }));
        if (typeof content.maintenanceMode === "boolean") state.catalog.content.maintenanceMode = content.maintenanceMode;
        if (typeof content.maintenanceText === "string" && content.maintenanceText.trim()) state.catalog.content.maintenanceText = content.maintenanceText.trim();
        if (Array.isArray(content.additionalInfoTable)) {
          state.catalog.content.additionalInfoTable = content.additionalInfoTable
            .map((row) => Array.isArray(row) ? row.map((cell) => String(cell || "")) : [])
            .filter((row) => row.length > 0);
        }
      }
    } catch {
      // ignore malformed cache
    }
  }

  async function loadPublicCatalogFromSupabase() {
    if (loadingPublicCatalog) return;
    if (!state.admin.supabaseUrl || !state.admin.supabaseAnonKey) return;
    const ok = await connectSupabaseClient(false);
    if (!ok || !supabaseClient) return;
    loadingPublicCatalog = true;
    try {
      const [presetResult, airportResult, contentResult, waypointResult, rpcResult, chartResult] = await Promise.all([
        runSupabaseQuery(supabaseClient.from("route_presets").select("*").order("name", { ascending: true })),
        runSupabaseQuery(supabaseClient.from("airports").select("*").order("code", { ascending: true })),
        runSupabaseQuery(supabaseClient.from("content_pages").select("*")),
        runSupabaseQuery(supabaseClient.from("waypoints").select("*").order("name", { ascending: true })),
        runSupabaseQuery(supabaseClient.from("rpc_registry").select("*").order("registration", { ascending: true })),
        runSupabaseQuery(supabaseClient.from("airport_charts").select("*").order("airport_code", { ascending: true }).order("name", { ascending: true })),
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
      const dbWaypoints = (waypointResult.data || []).map((row) => cloneWaypointRecord({
        id: row.id,
        name: row.name,
        coord: row.coord,
      }));
      const dbRpcRegistry = (rpcResult.data || []).map((row) => cloneRpcRegistryRecord({
        id: row.id,
        registration: row.registration,
        aircraftType: row.aircraft_type,
        casClimb: row.cas_climb,
        casCruise: row.cas_cruise,
        gph: row.gph,
      }));
      const contentMap = {};
      (contentResult.data || []).forEach((row) => {
        contentMap[String(row.key || "").toLowerCase()] = String(row.body_html || "");
      });

      state.catalog.routePresets = dbPresets.map((preset) => clonePreset(preset));
      state.catalog.airports = dbAirports.map((airport) => ({ ...airport }));
      state.catalog.waypoints = dbWaypoints.map((waypoint) => ({ ...waypoint }));
      state.catalog.rpcRegistry = dbRpcRegistry.map((record) => ({ ...record }));
      if (!chartResult.error) {
        state.catalog.charts = (chartResult.data || []).map((row) => cloneAirportChartRecord(row));
      }
      if (typeof contentMap.manual === "string") state.catalog.content.manualHtml = contentMap.manual;
      if (typeof contentMap.privacy === "string") state.catalog.content.privacyHtml = contentMap.privacy;
      state.catalog.content.announcements = parseAnnouncementsContent(contentMap.announcements || "");
      state.catalog.content.maintenanceMode = parseMaintenanceModeContent(contentMap.maintenance_mode || "");
      state.catalog.content.maintenanceText = String(contentMap.maintenance_text || state.catalog.content.maintenanceText || "").trim() || "under maintenance: service is undergoing maintenance. do not trust.";
      state.catalog.content.additionalInfoTable = parseAdditionalInfoContent(contentMap.additional_info || "");
      persistPublicCatalogCache();
    } finally {
      loadingPublicCatalog = false;
    }
  }

  function touchMonthlyVisitorCounter() {
    const now = new Date();
    const monthKey = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
    let marker = "";
    let count = 0;
    try {
      marker = String(window.localStorage.getItem(NAVLOG_MONTHLY_VISITOR_KEY) || "");
      count = Number(window.localStorage.getItem(NAVLOG_MONTHLY_VISITOR_COUNT_KEY) || 0);
    } catch {
      marker = "";
      count = 0;
    }
    if (!Number.isFinite(count) || count < 0) count = 0;
    if (marker !== monthKey) {
      marker = monthKey;
      count = 0;
    }
    count = Math.max(0, Math.floor(count)) + 1;
    try {
      window.localStorage.setItem(NAVLOG_MONTHLY_VISITOR_KEY, marker);
      window.localStorage.setItem(NAVLOG_MONTHLY_VISITOR_COUNT_KEY, String(count));
    } catch {
      // ignore storage errors
    }
    state.meta.monthlyVisitors = count;
  }

  async function initializeApp() {
    const params = new URLSearchParams(window.location.search);
    const kioskRequested = params.get("kiosk") === "1";
    if (kioskRequested && state.meta.navlogUnlocked && isActivateSupportedDevice()) {
      state.view = "ipad-kiosk";
      state.meta.routeProgressMarkerSnapshot = null;
      restoreKioskPayload();
      state.navlog.tocTod.tocEditing = false;
      state.navlog.tocTod.todEditing = false;
      normalizeActivateRows(false);
    } else if (kioskRequested && state.meta.navlogUnlocked && !isActivateSupportedDevice()) {
      state.view = "navlog";
      state.meta.activateError = "Only avbl on touch devices";
    } else if (kioskRequested && !state.meta.navlogUnlocked) {
      state.view = "access";
      state.meta.accessError = "Enter access key before opening Activate mode.";
    } else if (!state.meta.navlogUnlocked) {
      state.view = "access";
    } else {
      state.view = "setup";
    }
    restorePublicCatalogCache();
    touchMonthlyVisitorCounter();
    await loadPublicCatalogFromSupabase();
    warmOfflineRuntimeAssets();
    evaluateAnnouncementsPrompt();
    render();
  }

  function warmOfflineRuntimeAssets() {
    const urls = [
      "./",
      "./index.html",
      "./styles.css",
      "./app.js",
      "https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-svg.js",
      "https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js",
      "https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js",
      "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2",
    ];
    urls.forEach((url) => {
      const isHttp = /^https?:\/\//i.test(url);
      const options = isHttp ? { mode: "no-cors", cache: "reload" } : { cache: "reload" };
      fetch(url, options).catch(() => {
        // best-effort warmup only
      });
    });
  }

  function registerOfflineServiceWorker() {
    if (!("serviceWorker" in navigator)) return;
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./sw.js").catch(() => {
        // ignore registration failures
      });
    });
  }

  function installReloadProtection() {
  }

  registerOfflineServiceWorker();
  installReloadProtection();
  initializeApp().catch((error) => {
    console.error(error);
    app.innerHTML = `
      <div class="ui-scale">
        <main class="entry-page">
          <section class="setup-card">
            <h3>Navlog could not start</h3>
            <p class="setup-caption">${escapeHtml(error && error.message ? error.message : "An unexpected startup error occurred.")}</p>
          </section>
        </main>
      </div>
    `;
  });
})();



