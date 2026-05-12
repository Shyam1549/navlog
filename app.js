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
  const AIRPORTS = [
    { id: "RPVD", code: "RPVD", cptAtis: "", depAap: "", twr: "129.7", gnd: "", fss: "", remarks: "09-27/15ft" },
    { id: "RPVZ", code: "RPVZ", cptAtis: "", depAap: "", twr: "", gnd: "", fss: "121.9", remarks: "04-22/26ft" },
    { id: "RPMG", code: "RPMG", cptAtis: "", depAap: "", twr: "123.8/121.7", gnd: "", fss: "", remarks: "02-20/12ft" },
    { id: "RPSP", code: "RPSP", cptAtis: "126.5", depAap: "", twr: "124.5", gnd: "121.6", fss: "", remarks: "03-21/39ft" },
    { id: "RPMO", code: "RPMO", cptAtis: "127.6", depAap: "125.5", twr: "122.6", gnd: "", fss: "", remarks: "03-21/16ft" },
    { id: "RPMY", code: "RPMY", cptAtis: "127.6", depAap: "125.5", twr: "122.6", gnd: "", fss: "", remarks: "09-27/191ft" },
    { id: "RPVB", code: "RPVB", cptAtis: "", depAap: "121.0", twr: "118.8", gnd: "", fss: "", remarks: "03-21/86ft" },
    { id: "RPMH", code: "RPMH", cptAtis: "", depAap: "", twr: "", gnd: "", fss: "121.9", remarks: "07-25/53ft" },
    { id: "RPVM", code: "RPVM", cptAtis: "126.6", depAap: "121.2", twr: "118.1", gnd: "121.8", fss: "124.0", remarks: "04-22/28ft" },
    { id: "RPVH", code: "RPVH", cptAtis: "", depAap: "", twr: "", gnd: "", fss: "121.9", remarks: "16-34/328ft" },
    { id: "RPSM", code: "RPSM", cptAtis: "", depAap: "", twr: "", gnd: "", fss: "121.9", remarks: "18-36/12ft" },
    { id: "RPMP", code: "RPMP", cptAtis: "", depAap: "122.0", twr: "", gnd: "", fss: "", remarks: "02-20/5ft" },
    { id: "RPSB", code: "RPSB", cptAtis: "", depAap: "", twr: "", gnd: "", fss: "121.9", remarks: "16-24/60ft" },
    { id: "RPVI", code: "RPVI", cptAtis: "", depAap: "121.0", twr: "123.4", gnd: "", fss: "", remarks: "02-20/153ft" },
    { id: "RPVR", code: "RPVR", cptAtis: "", depAap: "", twr: "118.5", gnd: "", fss: "", remarks: "14-32/9ft" },
    { id: "SIPALAY", code: "SIPALAY", cptAtis: "", depAap: "", twr: "", gnd: "", fss: "121.9", remarks: "02-20" },
    { id: "RPVK", code: "RPVK", cptAtis: "", depAap: "120.4", twr: "124.2", gnd: "", fss: "", remarks: "05-23/91ft" },
    { id: "RPVO", code: "RPVO", cptAtis: "", depAap: "", twr: "", gnd: "", fss: "121.9", remarks: "18-36/83ft" },
    { id: "RPVA", code: "RPVA", cptAtis: "", depAap: "120.4", twr: "124.3", gnd: "", fss: "", remarks: "18-36/4ft" },
    { id: "RPMS", code: "RPMS", cptAtis: "", depAap: "122.0", twr: "", gnd: "", fss: "", remarks: "18-36/20ft" },
    { id: "RPME", code: "RPME", cptAtis: "", depAap: "121.3", twr: "123.3/122.0", gnd: "", fss: "", remarks: "12-30/44ft" },
  ];

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
    meta: {
      hasOpenedSheet: false,
      usingPresetRoute: false,
    },
  };
  const TRIG_TOLERANCE = 1e-6;
  const FEET_PER_METER = 3.280839895013123;
  const KNOTS_PER_MPH = 0.868976;
  const KNOTS_PER_KMH = 1 / 1.852;
  const KNOTS_PER_MS = 1.9438444924406046;
  let utcTimer = null;
  let manualMathRetryCount = 0;

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

  function render() {
    computeRouteMath();
    if (state.view === "setup") app.innerHTML = renderSetupScreen();
    else if (state.view === "manual") app.innerHTML = renderManualScreen();
    else if (state.view === "privacy") app.innerHTML = renderPrivacyScreen();
    else app.innerHTML = renderNavlogScreen();
    startUtcClock();
    if (state.view === "setup") wireSetup();
    else if (state.view === "manual") wireManual();
    else if (state.view === "privacy") wirePrivacy();
    else wireNavlog();
    if (state.view === "manual") typesetManualMath();
  }

  function createDefaultSettings() {
    return {
      open: false,
      altitudeUnit: "ft",
      speedUnit: "kts",
      temperatureUnit: "c",
      roundTimeValues: true,
      roundDistanceValues: true,
      showDistanceToGo: false,
      pdfLayout: "default",
    };
  }

  function renderSetupScreen() {
    const presetStatus = getPresetStatusMarkup();
    const showResume = shouldShowResumeButton();
    return `
      <div class="ui-scale">
      <main class="entry-page">
        <section class="entry-hero entry-hero-centered">
          <div class="top-center">
            <h1>Navlog</h1>
            <div class="utc-pill" id="utc-clock">UTC ${formatUtcNow()}</div>
            <p class="setup-caption">Enter your DEP and ARR aerodrome.</p>
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

  function renderManualScreen() {
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
        <section class="setup-card manual-card">
          <div class="manual-section">
            <h3>Variables</h3>
            <div class="manual-vars">
              <p><strong>h</strong><span>altitude</span></p>
              <p><strong>T</strong><span>temperature</span></p>
              <p><strong>P</strong><span>pressure</span></p>
              <p><strong>rho</strong><span>air density</span></p>
              <p><strong>F</strong><span>TAS factor</span></p>
              <p><strong>Vcas</strong><span>calibrated airspeed</span></p>
              <p><strong>Vtas</strong><span>true airspeed</span></p>
              <p><strong>Vgs</strong><span>groundspeed</span></p>
              <p><strong>W</strong><span>wind speed</span></p>
              <p><strong>Delta</strong><span>relative wind angle</span></p>
              <p><strong>WCA</strong><span>wind correction angle</span></p>
              <p><strong>d</strong><span>distance</span></p>
              <p><strong>t</strong><span>time</span></p>
            </div>
          </div>
          <div class="manual-section">
            <h3>Density / TAS Factor</h3>
            <div class="manual-row"><p class="manual-formula">\\( P_{Pa} = 101325\\left(1 - \\frac{0.0065h_{m}}{288.15}\\right)^{5.2558797} \\)</p><p class="manual-note">Pressure at altitude.</p></div>
            <div class="manual-row"><p class="manual-formula">\\( \\rho_{kg/m^3} = \\frac{P_{Pa}}{287.05\\,(T_{C}+273.15)} \\)</p><p class="manual-note">Air density from pressure + temperature.</p></div>
            <div class="manual-row"><p class="manual-formula">\\( F = \\sqrt{\\frac{1.225}{\\rho_{kg/m^3}}} \\)</p><p class="manual-note">Density factor.</p></div>
            <div class="manual-row"><p class="manual-formula">\\( V_{tas,kts}=V_{cas,kts}\\,F \\quad\\text{and}\\quad V_{cas,kts}=\\frac{V_{tas,kts}}{F} \\)</p><p class="manual-note">Convert CAS and TAS both ways.</p></div>
          </div>
          <div class="manual-section">
            <h3>Wind Triangle</h3>
            <div class="manual-row"><p class="manual-formula">\\( \\Delta_{deg} = \\theta_{wind,deg}-\\theta_{course,deg} \\)</p><p class="manual-note">Relative wind angle.</p></div>
            <div class="manual-row"><p class="manual-formula">\\( WCA_{deg}=\\arcsin\\!\\left(\\frac{W_{kts}\\sin\\Delta_{deg}}{V_{tas,kts}}\\right) \\)</p><p class="manual-note">Wind correction angle.</p></div>
            <div class="manual-row"><p class="manual-formula">\\( V_{gs,kts}=V_{tas,kts}\\cos(WCA_{deg})-W_{kts}\\cos\\Delta_{deg} \\)</p><p class="manual-note">Track speed over ground.</p></div>
            <div class="manual-row"><p class="manual-formula">\\( W_{kts}=\\frac{V_{tas,kts}\\cos(WCA_{deg})-V_{gs,kts}}{\\cos\\Delta_{deg}} \\)</p><p class="manual-note">Reverse wind (priority formula).</p></div>
            <div class="manual-row"><p class="manual-formula">\\( W_{kts}=\\frac{V_{tas,kts}\\sin(WCA_{deg})}{\\sin\\Delta_{deg}} \\)</p><p class="manual-note">Fallback wind formula.</p></div>
            <div class="manual-row"><p class="manual-formula">\\( V_{tas,kts}=\\frac{V_{gs,kts}+W_{kts}\\cos\\Delta_{deg}}{\\cos(WCA_{deg})} \\)</p><p class="manual-note">Reverse TAS (priority formula).</p></div>
            <div class="manual-row"><p class="manual-formula">\\( V_{tas,kts}=\\frac{W_{kts}\\sin\\Delta_{deg}}{\\sin(WCA_{deg})} \\)</p><p class="manual-note">Fallback TAS formula.</p></div>
          </div>
          <div class="manual-section">
            <h3>Leg Time / Distance</h3>
            <div class="manual-row"><p class="manual-formula">\\( t_{min}=\\frac{d_{NM}}{V_{gs,kts}}\\times 60 \\)</p><p class="manual-note">Time from distance and groundspeed.</p></div>
            <div class="manual-row"><p class="manual-formula">\\( d_{NM}=\\frac{V_{gs,kts}\\,t_{min}}{60} \\)</p><p class="manual-note">Distance from speed and time.</p></div>
            <div class="manual-row"><p class="manual-formula">\\( V_{gs,kts}=\\frac{d_{NM}}{t_{min}/60} \\)</p><p class="manual-note">Groundspeed from distance and time.</p></div>
          </div>
          <div class="manual-section">
            <h3>TOC / TOD</h3>
            <div class="manual-row"><p class="manual-formula">\\( \\Delta h_{toc,ft}=h_{2,ft}-h_{1,ft} \\)</p><p class="manual-note">Altitude to gain for climb.</p></div>
            <div class="manual-row"><p class="manual-formula">\\( t_{toc,min}=\\frac{\\Delta h_{toc,ft}}{ROC_{ft/min}} \\)</p><p class="manual-note">TOC time.</p></div>
            <div class="manual-row"><p class="manual-formula">\\( d_{toc,NM}=t_{toc,min}\\cdot\\frac{V_{gs,kts}}{60} \\)</p><p class="manual-note">TOC distance.</p></div>
            <div class="manual-row"><p class="manual-formula">\\( \\Delta h_{tod,ft}=h_{secondLast,ft}-h_{last,ft} \\)</p><p class="manual-note">Altitude to lose for descent.</p></div>
            <div class="manual-row"><p class="manual-formula">\\( t_{tod,min}=\\frac{\\Delta h_{tod,ft}}{ROD_{ft/min}} \\)</p><p class="manual-note">TOD time.</p></div>
            <div class="manual-row"><p class="manual-formula">\\( d_{tod,NM}=t_{tod,min}\\cdot\\frac{V_{gs,kts}}{60} \\)</p><p class="manual-note">TOD distance.</p></div>
          </div>
          <div class="manual-section">
            <h3>Limits / Guards</h3>
            <div class="manual-row"><p class="manual-formula">Trig tolerance</p><p class="manual-note">Very small sine/cosine values are treated as zero to avoid unstable division.</p></div>
            <div class="manual-row"><p class="manual-formula">WCA check</p><p class="manual-note">If \\(\\left|\\frac{W\\sin\\Delta}{V_{tas}}\\right| &gt; 1\\), WCA is invalid and "Wind too strong" is shown.</p></div>
            <div class="manual-row"><p class="manual-formula">Positive GS requirement</p><p class="manual-note">Derived GS must be above zero; impossible wind cases are blocked.</p></div>
            <div class="manual-row"><p class="manual-formula">TOC default</p><p class="manual-note">If departure elevation is blank, TOC uses 0 for departure elevation.</p></div>
          </div>
          <div class="manual-section">
            <h3>Data Behaviors</h3>
            <div class="manual-row"><p class="manual-formula">Preset route delete</p><p class="manual-note">If a preset leg is removed, the next leg TC is cleared for manual entry.</p></div>
            <div class="manual-row"><p class="manual-formula">Airport autofill</p><p class="manual-note">Type airport code and press Enter to auto-fill frequency/remarks.</p></div>
            <div class="manual-row"><p class="manual-formula">Distance to go</p><p class="manual-note">If enabled, a remaining-distance value is shown below each waypoint route field.</p></div>
          </div>
        </section>
      </main>
      </div>
    `;
  }

  function renderPrivacyScreen() {
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
        <section class="setup-card manual-card privacy-card">
          <div class="manual-section">
            <h3>Overview</h3>
            <p>Navlog is a flight planning utility. We only collect information needed to run core features and improve reliability.</p>
          </div>
          <div class="manual-section">
            <h3>Information You Enter</h3>
            <p>Flight planning fields you type into Navlog are processed in your browser for calculations. Bug reports may include the message you submit, optional email address, and basic device/browser metadata.</p>
          </div>
          <div class="manual-section">
            <h3>Bug Reports</h3>
            <p>When you submit a bug report, data is sent to our backend endpoint and delivered by our email service provider so we can troubleshoot and respond. Do not include sensitive personal or operational information in bug reports.</p>
          </div>
          <div class="manual-section">
            <h3>How We Use Information</h3>
            <p>We use submitted data to provide navlog functionality, diagnose technical issues, and improve service quality. We do not sell your data.</p>
          </div>
          <div class="manual-section">
            <h3>Data Retention</h3>
            <p>Bug report emails are retained as long as needed for support, maintenance, legal compliance, and record-keeping.</p>
          </div>
          <div class="manual-section">
            <h3>Contact</h3>
            <p>For privacy concerns, use the bug report form and include “Privacy” in your message subject line.</p>
          </div>
        </section>
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
    const speedUnitLabel =
      state.settings.speedUnit === "mph"
        ? "MPH"
        : state.settings.speedUnit === "kmh"
          ? "KM/H"
          : state.settings.speedUnit === "ms"
            ? "M/S"
            : "KTS";
    const altUnitLabel = state.settings.altitudeUnit === "m" ? "M" : "FT";
    const tempUnitLabel =
      state.settings.temperatureUnit === "f"
        ? "F"
        : state.settings.temperatureUnit === "k"
          ? "K"
          : "C";
    return `
      <section class="nav-table">
        <div class="nav-head-grid">
          <div class="head-cell tall route-head">ROUTE <button class="mini-plus inline" id="add-leg" type="button">+</button></div>
          <div class="head-cell group cruise-head">CRUISE</div>
          <div class="head-cell group wind-head">WIND</div>
          <div class="head-cell tall tc-head">TC</div>
          <div class="head-cell tall wca-head">WCA</div>
          <div class="head-cell tall ta-head">TA (${speedUnitLabel})</div>
          <div class="head-cell tall gs-head">GS (${speedUnitLabel})</div>
          <div class="head-cell tall dis-head">DIS (NM)</div>
          <div class="head-cell tall ee-head">EE</div>
          <div class="head-cell tall et-head">ET</div>
          <div class="head-cell tall at-head">AT</div>
          <div class="head-cell sub cas-head">CAS (${speedUnitLabel})</div>
          <div class="head-cell sub alt-head">ALT (${altUnitLabel})</div>
          <div class="head-cell sub temp-head">TEMP (${tempUnitLabel})</div>
          <div class="head-cell sub dir-head">DIR</div>
          <div class="head-cell sub spd-head">SPD (${speedUnitLabel})</div>
        </div>
        <div class="table-body">
          ${state.navlog.legs.map((leg, index) => renderLegRow(leg, index)).join("")}
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

  function renderLegRow(leg, index) {
    const removable = index > 0 && index < state.navlog.legs.length - 1;
    const altExtra = index === 0 ? "first-alt" : "";
    const distanceToGo = getDistanceToGoDisplay(index);
    return `
      <div class="leg-row">
        <div class="${legFieldClass(leg, "route", "route route-cell")}">
          <div class="route-main">
            <input data-leg-field="${index}:route" value="${escapeAttr(leg.route)}" />
            ${removable ? `<button type="button" class="remove-chip" data-remove-leg="${index}">-</button>` : `<span class="blank-chip"></span>`}
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
        <div class="${legFieldClass(leg, "tc")}"><input data-leg-field="${index}:tc" value="${escapeAttr(legFieldValue(leg, "tc"))}" /></div>
        <div class="${legFieldClass(leg, "wca")}"><input data-leg-field="${index}:wca" value="${escapeAttr(legFieldValue(leg, "wca"))}" /></div>
        <div class="${legFieldClass(leg, "ta")}"><input data-leg-field="${index}:ta" value="${escapeAttr(legFieldValue(leg, "ta"))}" /></div>
        <div class="${legFieldClass(leg, "gs")}"><input data-leg-field="${index}:gs" value="${escapeAttr(legFieldValue(leg, "gs"))}" /></div>
        <div class="${legFieldClass(leg, "distance")}"><input data-leg-field="${index}:distance" value="${escapeAttr(legFieldValue(leg, "distance"))}" /></div>
        <div class="${legFieldClass(leg, "ee")}"><input data-leg-field="${index}:ee" value="${escapeAttr(legFieldValue(leg, "ee"))}" /></div>
        <div class="${legFieldClass(leg, "et")}"><input data-leg-field="${index}:et" value="${escapeAttr(legFieldValue(leg, "et"))}" /></div>
        <div class="${legFieldClass(leg, "at")}"><input data-leg-field="${index}:at" value="${escapeAttr(legFieldValue(leg, "at"))}" /></div>
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
    const openManualButton = document.getElementById("open-manual");
    if (openManualButton) {
      openManualButton.addEventListener("click", () => {
        state.view = "manual";
        render();
      });
    }
    const openPrivacyButton = document.getElementById("open-privacy");
    if (openPrivacyButton) {
      openPrivacyButton.addEventListener("click", () => {
        state.view = "privacy";
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
    const closeBugReportButton = document.getElementById("close-bug-report");
    if (closeBugReportButton) {
      closeBugReportButton.addEventListener("click", () => {
        state.bugReport.open = false;
        state.bugReport.submitting = false;
        state.bugReport.status = "";
        state.bugReport.note = "";
        render();
      });
    }
    const bugReportOverlay = document.getElementById("bug-report-overlay");
    if (bugReportOverlay) {
      bugReportOverlay.addEventListener("click", (event) => {
        if (event.target !== bugReportOverlay || state.bugReport.submitting) return;
        state.bugReport.open = false;
        state.bugReport.status = "";
        state.bugReport.note = "";
        render();
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
      state.navlog.legs.splice(state.navlog.legs.length - 1, 0, createBlankLeg(""));
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
          const mappedAircraft = RPC_TO_AIRCRAFT[event.target.value.trim()];
          if (mappedAircraft) {
            state.navlog.header.aircraft = mappedAircraft;
            const aircraftInput = document.querySelector('[data-header="aircraft"]');
            if (aircraftInput) aircraftInput.value = mappedAircraft;
          }
          syncAircraftFuelDefaults();
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
          const mappedAircraft = RPC_TO_AIRCRAFT[event.target.value.trim()];
          if (mappedAircraft) {
            state.navlog.header.aircraft = mappedAircraft;
            const aircraftInput = document.querySelector('[data-header="aircraft"]');
            if (aircraftInput) aircraftInput.value = mappedAircraft;
          }
          syncAircraftFuelDefaults();
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
        computeRouteMath({ index, field });
        updateComputedCells({ index, field });
        if (index === 0 && field === "alt") syncFirstAltHint();
      });
      input.addEventListener("focus", () => {
        syncFirstAltHint();
      });
      input.addEventListener("blur", () => {
        syncFirstAltHint();
      });
    });
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
        state.navlog.radios[Number(indexText)][field] = event.target.value;
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
          temperatureUnit: "c",
          roundTimeValues: true,
          roundDistanceValues: true,
          showDistanceToGo: false,
          pdfLayout: "default",
        });
      });
    }

    syncFirstAltHint();
  }

  function applySettingsChange(partial) {
    const previous = { ...state.settings };
    const next = { ...state.settings, ...partial };
    const affectsMathFormatting =
      previous.altitudeUnit !== next.altitudeUnit
      || previous.speedUnit !== next.speedUnit
      || previous.temperatureUnit !== next.temperatureUnit
      || previous.roundTimeValues !== next.roundTimeValues
      || previous.roundDistanceValues !== next.roundDistanceValues;
    const changed =
      affectsMathFormatting
      || previous.showDistanceToGo !== next.showDistanceToGo
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
      convertLegField(leg, "distance", previous, next, parseDistanceInputWithRounding, formatDistanceDisplayWithRounding);
      convertLegField(leg, "ee", previous, next, parseDurationInputWithTimeRounding, formatEeDisplayWithTimeRounding);
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

    if (previous.roundDistanceValues !== next.roundDistanceValues) {
      const tocDistance = parseDistanceInputWithRounding(state.navlog.tocTod.tocDistance, previous.roundDistanceValues);
      const todDistance = parseDistanceInputWithRounding(state.navlog.tocTod.todDistance, previous.roundDistanceValues);
      if (tocDistance != null) state.navlog.tocTod.tocDistance = formatDistanceDisplayWithRounding(tocDistance, next.roundDistanceValues);
      if (todDistance != null) state.navlog.tocTod.todDistance = formatDistanceDisplayWithRounding(todDistance, next.roundDistanceValues);
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
      parseMode = previous.roundDistanceValues;
      formatMode = next.roundDistanceValues;
    } else if (field === "alt") {
      parseMode = previous.altitudeUnit;
      formatMode = next.altitudeUnit;
    } else if (field === "temp") {
      parseMode = previous.temperatureUnit;
      formatMode = next.temperatureUnit;
    }
    const internal = parseFn(raw, parseMode);
    if (internal == null) return;
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
  }

  function getPresetLegs(departure, destination) {
    if (departure === "RPSP" && destination === "RPVD") {
      return [
        createPresetLeg({ route: "RPSP" }),
        createPresetLeg({ route: "DOLJO", tc: 291, distance: 4, cas: 70 }),
        createPresetLeg({ route: "BOLJOON", tc: 280, distance: 15, cas: 85 }),
        createPresetLeg({ route: "OSLOB", tc: 203, distance: 6, cas: 85 }),
        createPresetLeg({ route: "SUMILON", tc: 210, distance: 6, cas: 85 }),
        createPresetLeg({ route: "RPVD", tc: 215, distance: 8, cas: 85 }),
      ];
    }
    if (departure === "RPVD" && destination === "RPMG") {
      return [
        createPresetLeg({ route: "RPVD" }),
        createPresetLeg({ route: "DAUIN", tc: 197, distance: 9, cas: 70 }),
        createPresetLeg({ route: "ZAMBOANGUITA", tc: 218, distance: 8, cas: 85 }),
        createPresetLeg({ route: "ALIGUAY", tc: 176, distance: 22, cas: 85 }),
        createPresetLeg({ route: "RPMG", tc: 137, distance: 11, cas: 85 }),
      ];
    }
    if (departure === "RPMG" && destination === "RPVD") {
      return [
        createPresetLeg({ route: "RPMG" }),
        createPresetLeg({ route: "TAGULO POINT", tc: 16, distance: 8, cas: 70 }),
        createPresetLeg({ route: "SELINOG", tc: 18, distance: 8, cas: 85 }),
        createPresetLeg({ route: "APO ISLAND", tc: 327, distance: 16, cas: 85 }),
        createPresetLeg({ route: "DAUIN", tc: 359, distance: 7, cas: 85 }),
        createPresetLeg({ route: "RPVD", tc: 22, distance: 7, cas: 85 }),
      ];
    }
    if (departure === "RPVD" && destination === "RPSP") {
      return [
        createPresetLeg({ route: "RPVD" }),
        createPresetLeg({ route: "SUMILON", tc: 35, distance: 8, cas: 70 }),
        createPresetLeg({ route: "OSLOB", tc: 30, distance: 6, cas: 85 }),
        createPresetLeg({ route: "DOLJO", tc: 76, distance: 18, cas: 85 }),
        createPresetLeg({ route: "RPSP", tc: 111, distance: 4, cas: 85 }),
      ];
    }
    if (departure === "RPMG" && destination === "RPSP") {
      return [
        createPresetLeg({ route: "RPMG" }),
        createPresetLeg({ route: "TAUOLO POINT", tc: 16, distance: 8, cas: 70 }),
        createPresetLeg({ route: "SELINOG", tc: 14, distance: 8, cas: 85 }),
        createPresetLeg({ route: "SAN JUAN", tc: 14, distance: 19, cas: 85 }),
        createPresetLeg({ route: "LAZI", tc: 116, distance: 8, cas: 85 }),
        createPresetLeg({ route: "MARIA", tc: 39, distance: 7, cas: 85 }),
        createPresetLeg({ route: "PAMILICAN", tc: 38, distance: 24, cas: 85 }),
        createPresetLeg({ route: "RPSP", tc: 300, distance: 10, cas: 85 }),
      ];
    }
    return null;
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
      leg[field] = String(value);
      leg._manual[field] = true;
    });
    return leg;
  }

  function autofillAirportRow(index, rawValue) {
    const code = String(rawValue || "").trim().toUpperCase();
    const airport = AIRPORTS.find((item) => item.code === code || item.id === code);
    if (!airport) return;
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
      ta: manual.ta ? parseSpeedInput(leg.ta) : null,
      gs: manual.gs ? parseSpeedInput(leg.gs) : null,
      distance: manual.distance ? parseDistanceInput(leg.distance) : null,
      ee: manual.ee ? parseDurationInput(leg.ee) : null,
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
      tc: resolveDisplayField(leg, manual, lockedField, "tc", values.tc, maybeDegrees),
      wca: resolveDisplayField(leg, manual, lockedField, "wca", values.wca, maybeSignedDegrees),
      ta: resolveDisplayField(leg, manual, lockedField, "ta", values.ta, formatSpeedDisplay),
      gs: resolveDisplayField(leg, manual, lockedField, "gs", values.gs, formatSpeedDisplay),
      distance: resolveDisplayField(leg, manual, lockedField, "distance", values.distance, formatDistanceDisplay),
      ee: resolveDisplayField(leg, manual, lockedField, "ee", values.ee, formatEeDisplay),
    };
  }

  function wireManual() {
    document.getElementById("back-from-manual").addEventListener("click", () => {
      state.view = "setup";
      render();
    });
  }

  function wirePrivacy() {
    const backButton = document.getElementById("back-from-privacy");
    if (!backButton) return;
    backButton.addEventListener("click", () => {
      state.view = "setup";
      render();
    });
  }

  function handleBugReportEscape(event) {
    if (event.key !== "Escape" || !state.bugReport.open || state.bugReport.submitting) return;
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
      syncLegField(index, "ta", leg.ta, activeEdit, leg);
      syncLegField(index, "gs", leg.gs, activeEdit, leg);
      syncLegField(index, "distance", leg.distance, activeEdit, leg);
      syncLegField(index, "ee", leg.ee, activeEdit, leg);

      syncLegDerived(index, "cas", Boolean(leg._derived && leg._derived.cas));
      syncLegDerived(index, "alt", Boolean(leg._derived && leg._derived.alt));
      syncLegDerived(index, "temp", Boolean(leg._derived && leg._derived.temp));
      syncLegDerived(index, "windDir", Boolean(leg._derived && leg._derived.windDir));
      syncLegDerived(index, "windSpd", Boolean(leg._derived && leg._derived.windSpd));
      syncLegDerived(index, "tc", Boolean(leg._derived && leg._derived.tc));
      syncLegDerived(index, "wca", Boolean(leg._derived && leg._derived.wca));
      syncLegDerived(index, "ta", Boolean(leg._derived && leg._derived.ta));
      syncLegDerived(index, "gs", Boolean(leg._derived && leg._derived.gs));
      syncLegDerived(index, "distance", Boolean(leg._derived && leg._derived.distance));
      syncLegDerived(index, "ee", Boolean(leg._derived && leg._derived.ee));

      syncLegError(index, "wca", Boolean(leg._errors && leg._errors.wca));
      syncLegError(index, "gs", Boolean(leg._errors && leg._errors.gs));
    });
    syncDistanceToGo();
    syncFirstAltHint();

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

  function parseDistanceInputWithRounding(value, _roundDistanceValues) {
    return num(value);
  }

  function formatDistanceDisplay(valueNm) {
    return formatDistanceDisplayWithRounding(valueNm, state.settings.roundDistanceValues);
  }

  function formatDistanceDisplayWithRounding(valueNm, roundDistanceValues) {
    if (valueNm == null || !Number.isFinite(valueNm)) return "";
    return roundDistanceValues ? maybeFormat(valueNm) : formatOneDecimal(valueNm);
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
    return field === "tc" || field === "wca" || field === "windDir";
  }

  function maybeDegrees(value) {
    if (value == null || !Number.isFinite(value)) return "";
    return String(roundHalfUp(value));
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
    return formatMinutesDisplayWithTimeRounding(minutesFloat, roundTimeValues);
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
          doc.querySelectorAll(".route-cell input, .location-cell input").forEach((input) => {
            const wrapped = doc.createElement("div");
            wrapped.className = "pdf-wrap-value";
            wrapped.textContent = input.value;
            input.replaceWith(wrapped);
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

  window.addEventListener("beforeunload", (event) => {
    event.preventDefault();
    event.returnValue = "";
  });

  render();
})();
