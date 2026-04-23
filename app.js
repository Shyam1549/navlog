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
    meta: {
      hasOpenedSheet: false,
      usingPresetRoute: false,
    },
  };
  let utcTimer = null;

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
    app.innerHTML = state.view === "setup" ? renderSetupScreen() : renderNavlogScreen();
    startUtcClock();
    if (state.view === "setup") wireSetup();
    else wireNavlog();
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
      </main>
      </div>
    `;
  }

  function renderNavlogScreen() {
    const h = state.navlog.header;
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
            <button class="action" id="new-sheet">New</button>
            <button class="action primary" id="save-sheet">Save</button>
          </div>
        </section>

        <section class="sheet-wrap">
          <div class="sheet">
            <section class="sheet-header">
              ${renderHeaderInputBox("AIRCRAFT", `<input data-header="aircraft" value="${escapeAttr(h.aircraft)}" />`, "aircraft-box")}
              <div class="header-box dark static planning-box">PREFLIGHT PLANNER</div>
              ${renderHeaderInputBox("RP-C NO.", `<input data-header="rpCNo" value="${escapeAttr(h.rpCNo)}" />`, "rpc-box")}
              ${renderHeaderInputBox("DATE", `<input data-header="date" value="${escapeAttr(h.date)}" />`, "date-box")}
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
    return `
      <section class="nav-table">
        <div class="nav-head-grid">
          <div class="head-cell tall route-head">ROUTE <button class="mini-plus inline" id="add-leg" type="button">+</button></div>
          <div class="head-cell group cruise-head">CRUISE</div>
          <div class="head-cell group wind-head">WIND</div>
          <div class="head-cell tall tc-head">TC</div>
          <div class="head-cell tall wca-head">WCA</div>
          <div class="head-cell tall ta-head">TA (KTS)</div>
          <div class="head-cell tall gs-head">GS (KTS)</div>
          <div class="head-cell tall dis-head">DIS (NM)</div>
          <div class="head-cell tall ee-head">EE</div>
          <div class="head-cell tall et-head">ET</div>
          <div class="head-cell tall at-head">AT</div>
          <div class="head-cell sub cas-head">CAS (KTS)</div>
          <div class="head-cell sub alt-head">ALT (FT)</div>
          <div class="head-cell sub temp-head">TEMP (C)</div>
          <div class="head-cell sub dir-head">DIR</div>
          <div class="head-cell sub spd-head">SPD (KTS)</div>
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
    return classes.join(" ");
  }

  function renderLegRow(leg, index) {
    const removable = index > 0 && index < state.navlog.legs.length - 1;
    return `
      <div class="leg-row">
        <div class="${legFieldClass(leg, "route", "route route-cell")}">
          <input data-leg-field="${index}:route" value="${escapeAttr(leg.route)}" />
          ${removable ? `<button type="button" class="remove-chip" data-remove-leg="${index}">-</button>` : `<span class="blank-chip"></span>`}
        </div>
        <div class="${legFieldClass(leg, "cas")}"><input data-leg-field="${index}:cas" value="${escapeAttr(leg.cas)}" /></div>
        <div class="${legFieldClass(leg, "alt")}"><input data-leg-field="${index}:alt" value="${escapeAttr(leg.alt)}" /></div>
        <div class="${legFieldClass(leg, "temp")}"><input data-leg-field="${index}:temp" value="${escapeAttr(leg.temp)}" /></div>
        <div class="${legFieldClass(leg, "windDir")}"><input data-leg-field="${index}:windDir" value="${escapeAttr(leg.windDir)}" /></div>
        <div class="${legFieldClass(leg, "windSpd")}"><input data-leg-field="${index}:windSpd" value="${escapeAttr(leg.windSpd)}" /></div>
        <div class="${legFieldClass(leg, "tc")}"><input data-leg-field="${index}:tc" value="${escapeAttr(leg.tc)}" /></div>
        <div class="${legFieldClass(leg, "wca")}"><input data-leg-field="${index}:wca" value="${escapeAttr(leg.wca)}" /></div>
        <div class="${legFieldClass(leg, "ta")}"><input data-leg-field="${index}:ta" value="${escapeAttr(leg.ta)}" /></div>
        <div class="${legFieldClass(leg, "gs")}"><input data-leg-field="${index}:gs" value="${escapeAttr(leg.gs)}" /></div>
        <div class="${legFieldClass(leg, "distance")}"><input data-leg-field="${index}:distance" value="${escapeAttr(leg.distance)}" /></div>
        <div class="${legFieldClass(leg, "ee")}"><input data-leg-field="${index}:ee" value="${escapeAttr(leg.ee)}" /></div>
        <div class="${legFieldClass(leg, "et")}"><input data-leg-field="${index}:et" value="${escapeAttr(leg.et)}" /></div>
        <div class="${legFieldClass(leg, "at")}"><input data-leg-field="${index}:at" value="${escapeAttr(leg.at)}" /></div>
      </div>
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
      state.meta.hasOpenedSheet = true;
      state.view = "navlog";
      render();
    });
    const resumeButton = document.getElementById("resume-sheet");
    if (resumeButton) {
      resumeButton.addEventListener("click", () => {
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
    document.getElementById("new-sheet").addEventListener("click", () => {
      if (!window.confirm("Clear this navlog?")) return;
      state.navlog = createBlankNavlog();
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
        state.navlog.header[field] = event.target.value;
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
        state.navlog.header[field] = event.target.value;
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
        leg[field] = event.target.value;
        leg._manual = leg._manual || {};
        leg._manual[field] = event.target.value.trim() !== "";
        computeRouteMath({ index, field });
        updateComputedCells({ index, field });
      });
    });

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
      cas: manual.cas ? num(leg.cas) : null,
      alt: manual.alt ? num(leg.alt) : null,
      temp: manual.temp ? num(leg.temp) : null,
      windDir: manual.windDir ? num(leg.windDir) : null,
      windSpd: manual.windSpd ? num(leg.windSpd) : null,
      tc: manual.tc ? num(leg.tc) : null,
      wca: manual.wca ? num(leg.wca) : null,
      ta: manual.ta ? num(leg.ta) : null,
      gs: manual.gs ? num(leg.gs) : null,
      distance: manual.distance ? num(leg.distance) : null,
      ee: manual.ee ? militaryToMinutes(leg.ee) : null,
    };
    const derived = {};
    const canDerive = (field) => !manual[field] && lockedField !== field;
    const assignDerived = (field, nextValue) => {
      if (!canDerive(field)) return;
      if (nextValue == null || !Number.isFinite(nextValue)) return;
      values[field] = nextValue;
      derived[field] = true;
    };

    for (let pass = 0; pass < 6; pass += 1) {
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

      if (values.ta != null && values.ta > 0 && relativeRad != null && values.windSpd != null) {
        const ratio = (values.windSpd * Math.sin(relativeRad)) / values.ta;
        if (Math.abs(ratio) <= 1) {
          assignDerived("wca", toDegrees(Math.asin(ratio)));
        }
      }

      if (values.ta != null && values.ta > 0 && wcaRad != null && relativeRad != null) {
        const sideComponent = Math.sin(relativeRad);
        if (Math.abs(sideComponent) > 1e-6) {
          assignDerived("windSpd", (values.ta * Math.sin(wcaRad)) / sideComponent);
        }
      }

      if (values.windSpd != null && wcaRad != null && relativeRad != null) {
        const wcaSine = Math.sin(wcaRad);
        if (Math.abs(wcaSine) > 1e-6) {
          assignDerived("ta", (values.windSpd * Math.sin(relativeRad)) / wcaSine);
        }
      }

      if (values.ta != null && values.wca != null && values.windSpd != null && relativeRad != null) {
        const alongTrack = values.ta * Math.cos(toRadians(values.wca));
        const headwind = values.windSpd * Math.cos(relativeRad);
        assignDerived("gs", alongTrack - headwind);
      }

      if (values.gs != null && values.wca != null && values.windSpd != null && relativeRad != null) {
        const cosWca = Math.cos(toRadians(values.wca));
        if (Math.abs(cosWca) > 1e-6) {
          assignDerived("ta", (values.gs + (values.windSpd * Math.cos(relativeRad))) / cosWca);
        }
      }

      if (values.gs != null && values.ta != null && values.wca != null && relativeRad != null) {
        const cosRelative = Math.cos(relativeRad);
        if (Math.abs(cosRelative) > 1e-6) {
          assignDerived("windSpd", ((values.ta * Math.cos(toRadians(values.wca))) - values.gs) / cosRelative);
        }
      }

      if (values.distance != null && values.gs != null && values.gs > 0) {
        assignDerived("ee", (values.distance / values.gs) * 60);
      }
      if (values.ee != null && values.ee > 0 && values.gs != null) {
        assignDerived("distance", (values.gs * values.ee) / 60);
      }
      if (values.distance != null && values.ee != null && values.ee > 0) {
        assignDerived("gs", values.distance / (values.ee / 60));
      }
    }

    Object.keys(derived).forEach((field) => {
      if (manual[field] || values[field] == null || !Number.isFinite(values[field])) delete derived[field];
    });

    return {
      ...leg,
      _manual: manual,
      _derived: derived,
      cas: resolveDisplayField(leg, manual, lockedField, "cas", values.cas, maybeFormat),
      alt: resolveDisplayField(leg, manual, lockedField, "alt", values.alt, maybeFormat),
      temp: resolveDisplayField(leg, manual, lockedField, "temp", values.temp, maybeFormat),
      windSpd: resolveDisplayField(leg, manual, lockedField, "windSpd", values.windSpd, maybeFormat),
      wca: resolveDisplayField(leg, manual, lockedField, "wca", values.wca, maybeSigned),
      ta: resolveDisplayField(leg, manual, lockedField, "ta", values.ta, maybeFormat),
      gs: resolveDisplayField(leg, manual, lockedField, "gs", values.gs, maybeFormat),
      distance: resolveDisplayField(leg, manual, lockedField, "distance", values.distance, maybeFormat),
      ee: resolveDisplayField(leg, manual, lockedField, "ee", values.ee, minutesToMilitary),
    };
  }

  function computeTocTod() {
    const last = state.navlog.legs[state.navlog.legs.length - 1];
    const secondLast = state.navlog.legs[state.navlog.legs.length - 2];
    const roc = num(state.navlog.tocTod.roc);
    const rod = num(state.navlog.tocTod.rod);

    const firstAlt = firstAvailableValue("alt");
    const firstGs = firstAvailableValue("gs");
    const lastAlt = num(last?.alt);
    const secondLastAlt = num(secondLast?.alt);
    const lastGs = num(last?.gs);

    state.navlog.tocTod.tocDistance = "";
    state.navlog.tocTod.tocTime = "";
    state.navlog.tocTod.todDistance = "";
    state.navlog.tocTod.todTime = "";

    if (!state.navlog.tocTod.tocEditing && roc != null && roc > 0 && firstAlt != null && firstGs != null) {
      const tocTime = firstAlt / roc;
      const tocDistance = tocTime * (firstGs / 60);
      state.navlog.tocTod.tocTime = minutesToMilitary(tocTime);
      state.navlog.tocTod.tocDistance = maybeFormat(tocDistance);
    }

    if (!state.navlog.tocTod.todEditing && rod != null && rod > 0 && lastAlt != null && secondLastAlt != null && lastGs != null) {
      const altitudeToLose = Math.max(0, secondLastAlt - lastAlt);
      const todTime = altitudeToLose / rod;
      const todDistance = todTime * (lastGs / 60);
      state.navlog.tocTod.todTime = minutesToMilitary(todTime);
      state.navlog.tocTod.todDistance = maybeFormat(todDistance);
    }
  }

  function firstAvailableValue(field) {
    const firstTwoLegs = state.navlog.legs.slice(0, 2);
    for (const leg of firstTwoLegs) {
      const value = num(leg?.[field]);
      if (value != null) return value;
    }
    return null;
  }

  function updateComputedCells(activeEdit) {
    state.navlog.legs.forEach((leg, index) => {
      syncLegField(index, "cas", leg.cas, activeEdit);
      syncLegField(index, "alt", leg.alt, activeEdit);
      syncLegField(index, "temp", leg.temp, activeEdit);
      syncLegField(index, "windSpd", leg.windSpd, activeEdit);
      syncLegField(index, "wca", leg.wca, activeEdit);
      syncLegField(index, "ta", leg.ta, activeEdit);
      syncLegField(index, "gs", leg.gs, activeEdit);
      syncLegField(index, "distance", leg.distance, activeEdit);
      syncLegField(index, "ee", leg.ee, activeEdit);

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
    });

    const tocDistance = document.querySelector('[data-toc="tocDistance"]');
    const tocTime = document.querySelector('[data-toc="tocTime"]');
    const todDistance = document.querySelector('[data-toc="todDistance"]');
    const todTime = document.querySelector('[data-toc="todTime"]');
    if (tocDistance) tocDistance.value = state.navlog.tocTod.tocDistance;
    if (tocTime) tocTime.value = state.navlog.tocTod.tocTime;
    if (todDistance) todDistance.value = state.navlog.tocTod.todDistance;
    if (todTime) todTime.value = state.navlog.tocTod.todTime;
  }

  function syncLegField(index, field, value, activeEdit) {
    if (activeEdit && activeEdit.index === index && activeEdit.field === field) return;
    const node = document.querySelector(`[data-leg-field="${index}:${field}"]`);
    if (node) node.value = value;
  }

  function syncLegDerived(index, field, isDerived) {
    const node = document.querySelector(`[data-leg-field="${index}:${field}"]`);
    const wrapper = node && node.closest(".field");
    if (wrapper) wrapper.classList.toggle("derived", Boolean(isDerived));
  }

  function resolveDisplayField(leg, manual, lockedField, field, derivedValue, formatter) {
    if (lockedField === field) return leg[field];
    if (manual[field]) return leg[field];
    return derivedValue == null ? "" : formatter(derivedValue);
  }

  function tasFactor(tempC, pressureAltitude) {
    if (tempC == null || pressureAltitude == null) return null;
    const actualKelvin = tempC + 273.15;
    const standardKelvin = 273.15 + (15 - ((2 * pressureAltitude) / 1000));
    if (standardKelvin <= 0) return null;
    return Math.sqrt(actualKelvin / standardKelvin) * (1 + ((0.02 * pressureAltitude) / 1000));
  }

  function tempFromTasFactor(factor, pressureAltitude) {
    if (factor == null || pressureAltitude == null || factor <= 0) return null;
    const standardKelvin = 273.15 + (15 - ((2 * pressureAltitude) / 1000));
    if (standardKelvin <= 0) return null;
    const altitudeCorrection = 1 + ((0.02 * pressureAltitude) / 1000);
    if (altitudeCorrection === 0) return null;
    const actualKelvin = standardKelvin * ((factor / altitudeCorrection) ** 2);
    if (!Number.isFinite(actualKelvin) || actualKelvin <= 0) return null;
    return actualKelvin - 273.15;
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
    return value == null || !Number.isFinite(value) ? "" : String(Math.round(value));
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

  function maybeSigned(value) {
    if (value == null || !Number.isFinite(value)) return "";
    const rounded = Math.round(value);
    return rounded > 0 ? `+${rounded}` : String(rounded);
  }

  function minutesToMilitary(minutesFloat) {
    if (!Number.isFinite(minutesFloat)) return "";
    const wholeMinutes = Math.floor(minutesFloat);
    const seconds = Math.round((minutesFloat - wholeMinutes) * 60);
    const roundedMinutes = wholeMinutes + (seconds > 5 ? 1 : 0);
    const hours = Math.floor(roundedMinutes / 60);
    const minutes = roundedMinutes % 60;
    return `${String(hours).padStart(2, "0")}${String(minutes).padStart(2, "0")}`;
  }

  function militaryToMinutes(value) {
    const text = String(value || "").replace(/[^\d]/g, "");
    if (!text) return null;
    const padded = text.padStart(4, "0");
    const hours = Number(padded.slice(0, 2));
    const minutes = Number(padded.slice(2, 4));
    if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
    return (hours * 60) + minutes;
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

    try {
      const canvas = await window.html2canvas(sheet, {
        scale: 2,
        backgroundColor: "#f7f2e7",
        useCORS: true,
        windowWidth: pdfViewportWidth,
        windowHeight: pdfViewportHeight,
        onclone: (doc) => {
          doc.body.classList.add("pdf-export");

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
      const pdf = new jsPDF("p", "mm", "a4");
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

  window.addEventListener("beforeunload", (event) => {
    event.preventDefault();
    event.returnValue = "";
  });

  render();
})();
