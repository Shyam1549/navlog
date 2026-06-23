-- Navlog default data seed (run after supabase-schema.sql)

-- Airports
insert into public.airports (code, id, cpt_atis, dep_aap, twr, gnd, fss, remarks)
values
  ('RPVD','RPVD','','','129.7','','','09-27/15ft'),
  ('RPVZ','RPVZ','','','','','121.9','04-22/26ft'),
  ('RPMG','RPMG','','','123.8/121.7','','','02-20/12ft'),
  ('RPSP','RPSP','126.5','','124.5','121.6','','03-21/39ft'),
  ('RPMO','RPMO','127.6','125.5','122.6','','','03-21/16ft'),
  ('RPMY','RPMY','127.6','125.5','122.6','','','09-27/191ft'),
  ('RPVB','RPVB','','121.0','118.8','','','03-21/86ft'),
  ('RPMH','RPMH','','','','','121.9','07-25/53ft'),
  ('RPVM','RPVM','126.6','121.2','118.1','121.8','124.0','04-22/28ft'),
  ('RPVH','RPVH','','','','','121.9','16-34/328ft'),
  ('RPSM','RPSM','','','','','121.9','18-36/12ft'),
  ('RPMP','RPMP','','122.0','','','','02-20/5ft'),
  ('RPSB','RPSB','','','','','121.9','16-24/60ft'),
  ('RPVI','RPVI','','121.0','123.4','','','02-20/153ft'),
  ('RPVR','RPVR','','','118.5','','','14-32/9ft'),
  ('SIPALAY','SIPALAY','','','','','121.9','02-20'),
  ('RPVK','RPVK','','120.4','124.2','','','05-23/91ft'),
  ('RPVO','RPVO','','','','','121.9','18-36/83ft'),
  ('RPVA','RPVA','','120.4','124.3','','','18-36/4ft'),
  ('RPMS','RPMS','','122.0','','','','18-36/20ft'),
  ('RPME','RPME','','121.3','123.3/122.0','','','12-30/44ft')
on conflict (code) do update set
  id = excluded.id,
  cpt_atis = excluded.cpt_atis,
  dep_aap = excluded.dep_aap,
  twr = excluded.twr,
  gnd = excluded.gnd,
  fss = excluded.fss,
  remarks = excluded.remarks;

-- RP-C registration defaults
insert into public.aircraft_registrations (rpc, aircraft_type, cas_climb, cas_cruise, gph)
values
  ('832','C152','70','85','6'),
  ('840','C152','70','85','6'),
  ('860','C152','70','85','6'),
  ('831','C152','70','85','6'),
  ('8749','C152','70','85','6'),
  ('8596','C152','70','85','6'),
  ('8152','C152','70','85','6'),
  ('8804','C152','70','85','6'),
  ('8747','C152','70','85','6'),
  ('3288','C172','','',''),
  ('833','C172','','',''),
  ('8734','Seneca','','','')
on conflict (rpc) do nothing;

-- Route presets (insert only if DEP/ARR pair not already present)
with seed (name, departure, destination, legs_json) as (
  values
  (
    'RPSP to RPVD',
    'RPSP',
    'RPVD',
    $json$[
      {"route":"RPSP"},
      {"route":"DOLJO","tc":291,"distance":4,"cas":70},
      {"route":"BOLJOON","tc":280,"distance":15,"cas":85},
      {"route":"OSLOB","tc":203,"distance":6,"cas":85},
      {"route":"SUMILON","tc":210,"distance":6,"cas":85},
      {"route":"RPVD","tc":215,"distance":8,"cas":85}
    ]$json$::jsonb
  ),
  (
    'RPVD to RPMG',
    'RPVD',
    'RPMG',
    $json$[
      {"route":"RPVD"},
      {"route":"DAUIN","tc":197,"distance":9,"cas":70},
      {"route":"ZAMBOANGUITA","tc":218,"distance":8,"cas":85},
      {"route":"ALIGUAY","tc":176,"distance":22,"cas":85},
      {"route":"RPMG","tc":137,"distance":11,"cas":85}
    ]$json$::jsonb
  ),
  (
    'RPMG to RPVD',
    'RPMG',
    'RPVD',
    $json$[
      {"route":"RPMG"},
      {"route":"TAGULO POINT","tc":16,"distance":8,"cas":70},
      {"route":"SELINOG","tc":18,"distance":8,"cas":85},
      {"route":"APO ISLAND","tc":327,"distance":16,"cas":85},
      {"route":"DAUIN","tc":359,"distance":7,"cas":85},
      {"route":"RPVD","tc":22,"distance":7,"cas":85}
    ]$json$::jsonb
  ),
  (
    'RPVD to RPSP',
    'RPVD',
    'RPSP',
    $json$[
      {"route":"RPVD"},
      {"route":"SUMILON","tc":35,"distance":8,"cas":70},
      {"route":"OSLOB","tc":30,"distance":6,"cas":85},
      {"route":"DOLJO","tc":76,"distance":18,"cas":85},
      {"route":"RPSP","tc":111,"distance":4,"cas":85}
    ]$json$::jsonb
  ),
  (
    'RPMG to RPSP',
    'RPMG',
    'RPSP',
    $json$[
      {"route":"RPMG"},
      {"route":"TAUOLO POINT","tc":16,"distance":8,"cas":70},
      {"route":"SELINOG","tc":14,"distance":8,"cas":85},
      {"route":"SAN JUAN","tc":14,"distance":19,"cas":85},
      {"route":"LAZI","tc":116,"distance":8,"cas":85},
      {"route":"MARIA","tc":39,"distance":7,"cas":85},
      {"route":"PAMILICAN","tc":38,"distance":24,"cas":85},
      {"route":"RPSP","tc":300,"distance":10,"cas":85}
    ]$json$::jsonb
  )
)
insert into public.route_presets (name, departure, destination, legs_json)
select s.name, s.departure, s.destination, s.legs_json
from seed s
where not exists (
  select 1
  from public.route_presets r
  where upper(r.departure) = upper(s.departure)
    and upper(r.destination) = upper(s.destination)
);

-- Manual and privacy content (upsert)
insert into public.content_pages (key, body_html)
values
(
  'manual',
  $manual$
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
  <div class="manual-row"><p class="manual-formula">\( P_{Pa} = 101325\left(1 - \frac{0.0065h_{m}}{288.15}\right)^{5.2558797} \)</p><p class="manual-note">Pressure at altitude.</p></div>
  <div class="manual-row"><p class="manual-formula">\( \rho_{kg/m^3} = \frac{P_{Pa}}{287.05\,(T_{C}+273.15)} \)</p><p class="manual-note">Air density from pressure + temperature.</p></div>
  <div class="manual-row"><p class="manual-formula">\( F = \sqrt{\frac{1.225}{\rho_{kg/m^3}}} \)</p><p class="manual-note">Density factor.</p></div>
  <div class="manual-row"><p class="manual-formula">\( V_{tas,kts}=V_{cas,kts}\,F \quad\text{and}\quad V_{cas,kts}=\frac{V_{tas,kts}}{F} \)</p><p class="manual-note">Convert CAS and TAS both ways.</p></div>
</div>
<div class="manual-section">
  <h3>Wind Triangle</h3>
  <div class="manual-row"><p class="manual-formula">\( \Delta_{deg} = \theta_{wind,deg}-\theta_{course,deg} \)</p><p class="manual-note">Relative wind angle.</p></div>
  <div class="manual-row"><p class="manual-formula">\( WCA_{deg}=\arcsin\!\left(\frac{W_{kts}\sin\Delta_{deg}}{V_{tas,kts}}\right) \)</p><p class="manual-note">Wind correction angle.</p></div>
  <div class="manual-row"><p class="manual-formula">\( V_{gs,kts}=V_{tas,kts}\cos(WCA_{deg})-W_{kts}\cos\Delta_{deg} \)</p><p class="manual-note">Track speed over ground.</p></div>
  <div class="manual-row"><p class="manual-formula">\( W_{kts}=\frac{V_{tas,kts}\cos(WCA_{deg})-V_{gs,kts}}{\cos\Delta_{deg}} \)</p><p class="manual-note">Reverse wind (priority formula).</p></div>
  <div class="manual-row"><p class="manual-formula">\( W_{kts}=\frac{V_{tas,kts}\sin(WCA_{deg})}{\sin\Delta_{deg}} \)</p><p class="manual-note">Fallback wind formula.</p></div>
  <div class="manual-row"><p class="manual-formula">\( V_{tas,kts}=\frac{V_{gs,kts}+W_{kts}\cos\Delta_{deg}}{\cos(WCA_{deg})} \)</p><p class="manual-note">Reverse TAS (priority formula).</p></div>
  <div class="manual-row"><p class="manual-formula">\( V_{tas,kts}=\frac{W_{kts}\sin\Delta_{deg}}{\sin(WCA_{deg})} \)</p><p class="manual-note">Fallback TAS formula.</p></div>
</div>
<div class="manual-section">
  <h3>Leg Time / Distance</h3>
  <div class="manual-row"><p class="manual-formula">\( t_{min}=\frac{d_{NM}}{V_{gs,kts}}\times 60 \)</p><p class="manual-note">Time from distance and groundspeed.</p></div>
  <div class="manual-row"><p class="manual-formula">\( d_{NM}=\frac{V_{gs,kts}\,t_{min}}{60} \)</p><p class="manual-note">Distance from speed and time.</p></div>
  <div class="manual-row"><p class="manual-formula">\( V_{gs,kts}=\frac{d_{NM}}{t_{min}/60} \)</p><p class="manual-note">Groundspeed from distance and time.</p></div>
</div>
<div class="manual-section">
  <h3>TOC / TOD</h3>
  <div class="manual-row"><p class="manual-formula">\( \Delta h_{toc,ft}=h_{2,ft}-h_{1,ft} \)</p><p class="manual-note">Altitude to gain for climb.</p></div>
  <div class="manual-row"><p class="manual-formula">\( t_{toc,min}=\frac{\Delta h_{toc,ft}}{ROC_{ft/min}} \)</p><p class="manual-note">TOC time.</p></div>
  <div class="manual-row"><p class="manual-formula">\( d_{toc,NM}=t_{toc,min}\cdot\frac{V_{gs,kts}}{60} \)</p><p class="manual-note">TOC distance.</p></div>
  <div class="manual-row"><p class="manual-formula">\( \Delta h_{tod,ft}=h_{secondLast,ft}-h_{last,ft} \)</p><p class="manual-note">Altitude to lose for descent.</p></div>
  <div class="manual-row"><p class="manual-formula">\( t_{tod,min}=\frac{\Delta h_{tod,ft}}{ROD_{ft/min}} \)</p><p class="manual-note">TOD time.</p></div>
  <div class="manual-row"><p class="manual-formula">\( d_{tod,NM}=t_{tod,min}\cdot\frac{V_{gs,kts}}{60} \)</p><p class="manual-note">TOD distance.</p></div>
</div>
<div class="manual-section">
  <h3>Limits / Guards</h3>
  <div class="manual-row"><p class="manual-formula">Trig tolerance</p><p class="manual-note">Very small sine/cosine values are treated as zero to avoid unstable division.</p></div>
  <div class="manual-row"><p class="manual-formula">WCA check</p><p class="manual-note">If \(\left|\frac{W\sin\Delta}{V_{tas}}\right| &gt; 1\), WCA is invalid and "Wind too strong" is shown.</p></div>
  <div class="manual-row"><p class="manual-formula">Positive GS requirement</p><p class="manual-note">Derived GS must be above zero; impossible wind cases are blocked.</p></div>
  <div class="manual-row"><p class="manual-formula">TOC default</p><p class="manual-note">If departure elevation is blank, TOC uses 0 for departure elevation.</p></div>
</div>
<div class="manual-section">
  <h3>Data Behaviors</h3>
  <div class="manual-row"><p class="manual-formula">Preset route delete</p><p class="manual-note">If a preset leg is removed, the next leg TC is cleared for manual entry.</p></div>
  <div class="manual-row"><p class="manual-formula">Airport autofill</p><p class="manual-note">Type airport code and press Enter to auto-fill frequency/remarks.</p></div>
  <div class="manual-row"><p class="manual-formula">RP-C auto-fill</p><p class="manual-note">Entering RP-C No. auto-fills aircraft type and default GPH/PPH when mapping is available.</p></div>
  <div class="manual-row"><p class="manual-formula">TOC/TOD edit button</p><p class="manual-note">TOC and TOD fields can be switched to manual mode by clicking their edit button.</p></div>
  <div class="manual-row"><p class="manual-formula">Distance to go</p><p class="manual-note">If enabled, a remaining-distance value is shown below each waypoint route field.</p></div>
</div>
$manual$
),
(
  'privacy',
  $privacy$
<h3>Overview</h3>
<p>Navlog is a flight planning utility. We collect only the information needed to run core features and maintain service reliability.</p>

<h3>Information You Enter</h3>
<p>Most planning values you type into Navlog are processed in your browser for calculations. Bug report submissions may include the issue message, optional contact email, and basic technical metadata such as browser type.</p>

<h3>Bug Report Processing</h3>
<p>When you submit a bug report, data is sent to our secure backend endpoint and then routed through our email service provider so we can investigate and respond. Please avoid sharing highly sensitive personal or operational details in reports.</p>

<h3>Use Of Data</h3>
<p>Submitted data is used to provide functionality, diagnose faults, improve product quality, and maintain operational security. We do not sell personal data.</p>

<h3>Data Retention</h3>
<p>Bug report records are retained only as long as reasonably required for support, maintenance, legal obligations, and audit or record-keeping needs.</p>

<h3>Contact</h3>
<p>For privacy questions, submit a bug report and include "Privacy" in your message so it can be prioritized appropriately.</p>
$privacy$
)
on conflict (key) do update set
  body_html = excluded.body_html;

