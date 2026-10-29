/* The only frontend loader: used unchanged by GitHub Pages and Colab. */
(function () {
  'use strict';
  const REQUIRED = ['assets/data.json.gz', 'assets/panels.json'];
  // LaTeX in the page and in the plot frame is typeset by KaTeX 0.16.11 (pinned, with integrity hashes); without it
  // the LaTeX source shows. Chen, 2026-10-29: "you should use latex".
  const KATEX = 'https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/';
  const KATEX_HEAD = '<link rel="stylesheet" href="' + KATEX + 'katex.min.css" integrity="sha384-nB0miv6/jRmo5UMMR1wu3Gz6NLsoTkbqJghGIsx//Rlm+ZU03BU6SQNC66uf4l5+" crossorigin="anonymous">' +
    '<script defer src="' + KATEX + 'katex.min.js" integrity="sha384-7zkQWkzuo3B5mTepMUcHkMB5jZaolc2xDwL6VFqjFALcbeS9Ggm/Yr2r3Dy4lfFg" crossorigin="anonymous"><\/script>' +
    '<script defer src="' + KATEX + 'contrib/auto-render.min.js" integrity="sha384-43gviWU0YVjaDtb/GhzOouOXtZMP/7XUzwPTstBeZFe/+rCMvRwr4yROQP43s0Xk" crossorigin="anonymous" onload="renderMathInElement(document.body)"><\/script>';
  const typeset = node => { if (node && globalThis.renderMathInElement) renderMathInElement(node); };
  const decode64 = value => Uint8Array.from(atob(value), c => c.charCodeAt(0));
  const escapeHTML = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  async function verify(bytes, record, name) {
    if (!record || bytes.byteLength !== record.bytes) throw Error('Size mismatch: ' + name);
    if (!globalThis.crypto || !crypto.subtle) throw Error('Integrity checking requires HTTPS or localhost.');
    const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), b => b.toString(16).padStart(2,'0')).join('');
    if (hash !== record.sha256) throw Error('Checksum mismatch: ' + name);
  }
  async function getBytes(name) {
    if (globalThis.NXE_EMBEDDED) {
      const encoded = NXE_EMBEDDED.files[name];
      if (typeof encoded !== 'string') throw Error('Missing embedded asset: ' + name);
      return decode64(encoded);
    }
    const response = await fetch(name, {cache:'no-cache'});
    if (!response.ok) throw Error('Could not load ' + name + ' (HTTP ' + response.status + ')');
    return new Uint8Array(await response.arrayBuffer());
  }
  async function load() {
    const manifest = JSON.parse(new TextDecoder().decode(await getBytes('manifest.json')));
    if (manifest.schema !== 1) throw Error('Unsupported manifest version');
    const files = {};
    await Promise.all(REQUIRED.map(async name => {
      files[name] = await getBytes(name);
      await verify(files[name], manifest.files[name], name);
    }));
    if (typeof DecompressionStream === 'undefined') throw Error('This browser needs gzip DecompressionStream support; please use a current browser.');
    const stream = new Blob([files['assets/data.json.gz']]).stream().pipeThrough(new DecompressionStream('gzip'));
    const data = JSON.parse(await new Response(stream).text());
    const templates = JSON.parse(new TextDecoder().decode(files['assets/panels.json']));
    const keys = Object.keys(data.main.libraries);
    if (data.schema !== 1 || data.main.selected_libraries.join(',') !== 'endfb71,jendl40' ||
        !keys.includes('endfb71') || !keys.includes('jendl40') || !data.main.compound || !data.findings) throw Error('Unexpected bundle schema or library selection');
    return {manifest, data, templates};
  }
  // Exposes the real loader for the offline/network integration checks.
  if (globalThis.__NXE_PORTABLE_TEST__) {
    globalThis.__NXE_PORTABLE_API__ = {load, verify, escapeHTML};
    return;
  }
  function notifyHeight() {
    if (window.parent !== window) window.parent.postMessage({type:'nxe-page-height', height:Math.ceil(document.body.getBoundingClientRect().height)}, '*');
  }
  function mount(hostId, template, data) {
    const host = document.getElementById(hostId);
    const frame = document.createElement('iframe');
    frame.title = hostId === 'main-panel' ? 'Interactive neutron–xenon recoil (with cos θ), angular, ENDF-minus-JENDL difference (against cos θ), partial-wave and potential plots' : 'Interactive Xe-132 coupled-channel (OPTMAN) angular and recoil plots';
    const root = hostId === 'main-panel' ? 'nxe-main' : 'nxe-optman';
    const body = template.replaceAll('ROOT', root).replace('__DATA__', JSON.stringify(data).replaceAll('</', '<\\/'));
    // Responsive layout changes sizing only; numerical and drawing code is shared verbatim.
    const style = 'html,body{margin:0;padding:0;background:white}*{box-sizing:border-box}' +
      'canvas{max-width:100%!important;height:auto!important}svg{height:auto}input[type=range]{max-width:70vw}' +
      '#' + root + '>div[style*="display:grid"]{grid-template-columns:minmax(0,1fr) minmax(0,1fr)!important}' +
      '#' + root + '>div[style*="display:flex;flex-wrap:wrap"]>svg{width:50%!important}' +
      '@media(max-width:650px){#' + root + '>div[style*="display:grid"]{grid-template-columns:minmax(0,1fr)!important}' +
      '#' + root + '>div[style*="display:flex;flex-wrap:wrap"]>svg{width:100%!important}}';
    const resize = '<script>new ResizeObserver(function(){parent.postMessage({type:"nxe-panel-height",id:' + JSON.stringify(hostId) + ',height:Math.ceil(document.body.getBoundingClientRect().height)},"*")}).observe(document.body);<\/script>';
    window.addEventListener('message', event => {
      if (event.source === frame.contentWindow && event.data && event.data.type === 'nxe-panel-height' && event.data.id === hostId && Number.isFinite(event.data.height)) {
        frame.style.height = Math.max(300, Math.min(10000, event.data.height + 4)) + 'px';
        notifyHeight();
      }
    });
    frame.srcdoc = '<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' + KATEX_HEAD + '<style>' + style + '</style><body>' + body + resize + '</body></html>';
    host.replaceChildren(frame);
  }
  function diagnostic(bundle) {
    const d = bundle.diagnostic, s = d.summary;
    const ymin = Math.min(0, ...Object.values(d.curves).flat()), ymax = Math.max(...Object.values(d.curves).flat());
    const low = ymin - .07*(ymax-ymin), high = ymax + .07*(ymax-ymin);
    const x = t => 60 + 470*t/180, y = f => 300 - 210*(f-low)/(high-low);
    let plots = '';
    for (const row of s.rows) {
      const local = d.curves[row.library];
      const points = d.angles.map((t,i) => x(t).toFixed(2)+','+y(local[i]).toFixed(2)).join(' ');
      let ticks = '';
      for (const t of [0,45,90,135,180]) ticks += '<text x="'+x(t)+'" y="322" text-anchor="middle">'+t+'</text>';
      for (let i=0;i<=4;i++) {const f=low+(high-low)*i/4; ticks += '<path d="M60 '+y(f)+'H530" stroke="#e1e7ec"/><text x="52" y="'+(y(f)+4)+'" text-anchor="end">'+f.toFixed(2)+'</text>';}
      plots += '<svg viewBox="0 0 560 360" role="img" aria-label="'+escapeHTML(row.label)+' local residual versus angle"><rect width="560" height="360" fill="white"/>' +
        '<g font-family="system-ui,sans-serif" font-size="12" fill="#173047"><text x="280" y="21" text-anchor="middle" font-size="16">'+escapeHTML(row.label)+'</text>' +
        '<text x="60" y="44" fill="#0072b2">Local residual (solid)</text><text x="60" y="63">Area match (dashed): '+row.area_fraction.toFixed(4)+'</text>' +
        '<text x="300" y="63" fill="#d55e00">Fills the minimum (dotted): '+row.visual_fraction.toFixed(3)+'</text>'+ticks+
        '<path d="M60 90V300H530" fill="none" stroke="#435765"/>' +
        '<path d="M60 '+y(0)+'H530" stroke="#aaa"/><path d="M60 '+y(row.area_fraction)+'H530" stroke="#222" stroke-dasharray="7 4"/>' +
        '<path d="M60 '+y(row.visual_fraction)+'H530" stroke="#d55e00" stroke-width="2" stroke-dasharray="2 4"/>' +
        '<path d="M'+x(s.shape_dip_angle_deg)+' 90V300" stroke="#aaa"/>'+
        '<polyline points="'+points+'" fill="none" stroke="#0072b2" stroke-width="2"/>'+
        '<circle cx="'+x(s.shape_dip_angle_deg)+'" cy="'+y(row.at_shape_dip_fraction)+'" r="4" fill="#0072b2"/>'+
        '<text x="290" y="350" text-anchor="middle">Centre-of-mass angle θ (degrees)</text><text transform="translate(16,195) rotate(-90)" text-anchor="middle">Fraction of the reaction cross section</text></g></svg>';
    }
    document.getElementById('diagnostic-plot').innerHTML = plots;
    document.getElementById('diagnostic-table').innerHTML = '<table><caption>Native calculation; shape minimum '+s.shape_dip_angle_deg.toFixed(2)+'°. Browser recoil column uses the display grid.</caption><thead><tr><th>Evaluation</th><th>Area match</th><th>At shape minimum</th><th>At '+s.probe_angle_deg+'°</th><th>Browser recoil dip</th><th>Excess if the minimum-filling value is applied at every angle</th></tr></thead><tbody>'+s.rows.map(r=>'<tr><td>'+escapeHTML(r.label)+'</td><td>'+r.area_fraction.toFixed(4)+'</td><td>'+r.at_shape_dip_fraction.toFixed(4)+'</td><td>'+r.at_probe_fraction.toFixed(4)+'</td><td>'+r.browser_recoil_dip_fraction.toFixed(4)+'</td><td>+'+r.visual_area_excess_b.toFixed(4)+' b (+'+r.visual_area_excess_percent.toFixed(2)+'%)</td></tr>').join('')+'</tbody></table>';
  }
  function findings(bundle) {
    // Every number of the "Why the libraries differ" and "model" text comes from the bundle (one source).
    const F = bundle.findings, S = bundle.diagnostic.summary;
    const values = Object.assign({}, F, {}), derived = {shape_b: S.shape_b.toFixed(3), reaction_b: S.optical_reaction_b.toFixed(3)};
    if (document.querySelectorAll) {
      document.querySelectorAll('[data-f]').forEach(n => { const v = values[n.dataset.f]; if (v === undefined) throw Error('Missing finding: ' + n.dataset.f); n.textContent = v; });
      document.querySelectorAll('[data-d]').forEach(n => { const v = derived[n.dataset.d]; if (v === undefined) throw Error('Missing value: ' + n.dataset.d); n.textContent = v; });
    }
    const pass = v => v >= 1 ? 'ok' : 'below';
    const lineage = Object.fromEntries(F.lineage.map(r => [r.A, r]));
    // Table 1: who made each file, and whether it meets the forward limit (Chen, 2026-10-29: Table II of the note).
    document.getElementById('findings-table').innerHTML = '<table><caption>Who made each file (from its own description, MF1/MT451), and its stored forward elastic cross section divided by the optical-theorem lower limit \\((k\\sigma_{\\rm tot}/4\\pi)^2\\), each file against its own total, at 2.45 MeV. Below 1 the file is internally inconsistent; above 1 it is consistent, not necessarily right. All JENDL-4.0u xenon files are JENDL-4.0 (OPTMAN coupled channels + POD).</caption><thead><tr><th>Isotope</th><th>% of natural Xe</th><th>ENDF/B-VII.1 file from</th><th>ENDF/B-VII.1</th><th>JENDL-4.0u</th><th>JEFF-4.0 file from</th><th>JEFF-4.0</th></tr></thead><tbody>' +
      F.table.map(r => '<tr><td>Xe-' + r.A + '</td><td>' + lineage[r.A].percent.toFixed(2) + '</td><td>' + escapeHTML(lineage[r.A].endfb71) + '</td><td class="' + pass(r.endfb71) + '">' + r.endfb71.toFixed(3) + '</td><td class="' + pass(r.jendl40) + '">' + r.jendl40.toFixed(3) + '</td><td>' + escapeHTML(lineage[r.A].jeff40) + '</td><td class="' + pass(r.jeff40) + '">' + r.jeff40.toFixed(3) + '</td></tr>').join('') + '</tbody></table>';
    agreement(F.agreement);
    document.getElementById('lineage-table').innerHTML = '<table><caption>Where the fast-neutron data of each xenon file come from, in five releases (seven libraries: ENDF/B-VIII.0 and VIII.1 store the same xenon files, as do JENDL-4.0u and JENDL-5), read from each file\'s own description.</caption><thead><tr><th>Isotope</th><th>%</th>' +
      F.releases.map(c => '<th>' + escapeHTML(c.label) + '</th>').join('') + '</tr></thead><tbody>' +
      F.lineage.map(r => '<tr><td>Xe-' + r.A + '</td><td>' + r.percent.toFixed(2) + '</td>' + F.releases.map(c => '<td>' + escapeHTML(r[c.key]) + '</td>').join('') + '</tr>').join('') + '</tbody></table>';
  }
  function agreement(G) {
    // Table 2: who agrees with whom. Near-identical pairs are named with the code each file names (Chen, 2026-10-29).
    const L = G.labels, code = s => s.shape.replace(/ \(TENDL[^)]*\)/, '').replace(', neutron potential not adjusted', '');
    const cols = [['jeff40', 'jendl40'], ['endfb71', 'jendl40'], ['jeff40', 'endfb71'], ['jeff40', 'talys']];
    const cell = (q, check) => '<td class="' + (q.near_identical && !check ? 'near' : '') + '">' + q.distance_pct.toFixed(1) + '%' + (q.near_identical && !check ? ' ≈' : '') + '</td>';
    const note = r => r.pairs.slice(0, 3).filter(q => q.near_identical).map(q => {
      const a = r.sources[q.a], b = r.sources[q.b];
      const how = q.relation === 'same code' ? 'same code (' + a.family + '): in effect one calculation, not two independent ones' :
        q.relation === 'different codes' ? 'different codes: ' + L[q.a] + ' ' + code(a) + '; ' + L[q.b] + ' ' + code(b) :
        q.relation === 'a fitted angular distribution against a calculation' ? 'a fit against a calculation: ' +
          [[q.a, a], [q.b, b]].map(([k, s]) => L[k] + ' ' + (s.family === 'CHAD fit' ? 'angular distribution ' + s.angular + ' (ENDF/B-IV)' : code(s))).join('; ') :
        'one file names no code';
      return '<b>' + escapeHTML(L[q.a]) + ' and ' + escapeHTML(L[q.b]) + '</b> (' + q.distance_pct.toFixed(1) + '%): ' + escapeHTML(how);
    }).join('<br>');
    const find = (r, a, b) => r.pairs.find(q => q.a === a && q.b === b);
    document.getElementById('agreement-table').innerHTML = '<table><caption>Who agrees with whom at 2.45 MeV: the percentage of elastic scatters that would have to change angle to turn one file\'s angular distribution into the other\'s, \\(d_{ab} = \\tfrac12\\int_{-1}^{1}|p_a-p_b|\\,d\\mu\\). ≈ marks two files within ' + G.near_identical_pct + '%; the last column names the code each of them says it used. The JEFF-4.0 − TALYS column compares JEFF-4.0 with a default TALYS run made for this tool (Koning–Delaroche potential).</caption><thead><tr><th>Isotope</th>' +
      cols.map(c => '<th>' + escapeHTML(L[c[0]]) + ' − ' + escapeHTML(L[c[1]]) + '</th>').join('') + '<th class="note">Near-identical pairs and the codes they name</th></tr></thead><tbody>' +
      G.rows.map(r => '<tr><td>Xe-' + r.A + '</td>' + cols.map((c, i) => cell(find(r, c[0], c[1]), i === 3)).join('') + '<td class="note">' + note(r) + '</td></tr>').join('') +
      '<tr><td>natural Xe</td>' + cols.map(c => '<td>' + G.natural.find(q => q.a === c[0] && q.b === c[1]).distance_pct.toFixed(1) + '%</td>').join('') + '<td class="note">isotopes weighted by abundance × each file\'s own elastic cross section</td></tr></tbody></table>';
  }
  function openTarget() {   // a link to a folded section opens it
    const target = location.hash && document.getElementById(location.hash.slice(1));
    if (target && target.tagName === 'DETAILS') target.open = true;
  }
  function sources(bundle, manifest) {
    const libraries = bundle.main.libraries, keys = Object.keys(libraries), nA = bundle.main.A.length;
    document.getElementById('coverage-table').innerHTML = '<table><caption>First supported evaluated display energy (MeV)</caption><thead><tr><th>Isotope</th>'+keys.map(k=>'<th>'+escapeHTML(libraries[k].label)+'</th>').join('')+'</tr></thead><tbody>'+bundle.main.A.map((a,j)=>'<tr><td>Xe-'+a+'</td>'+keys.map(k=>{
      const b=libraries[k], i=b.T.findIndex((t,i)=>b.valid[i*nA+j]);
      return '<td>'+(i<0?'Unavailable':b.T[i].toFixed(6))+'</td>';
    }).join('')+'</tr>').join('')+'</tbody></table>';
    const button = document.getElementById('download-provenance');
    button.disabled = false;
    button.addEventListener('click', () => {
      const blob = new Blob([JSON.stringify(bundle.provenance,null,2)+'\n'], {type:'application/json'});
      const url = URL.createObjectURL(blob), a = document.createElement('a');
      a.href=url; a.download='neutron_xe_provenance.json'; a.click(); setTimeout(()=>URL.revokeObjectURL(url),1000);
    });
    document.getElementById('bundle-info').textContent = 'Compressed shared data: '+(manifest.files['assets/data.json.gz'].bytes/1e6).toFixed(2)+' MB. SHA-256: '+manifest.files['assets/data.json.gz'].sha256;
  }
  load().then(({manifest, data, templates}) => {
    mount('main-panel', templates.main, data.main);
    mount('optman-panel', templates.optman, data.optman);
    diagnostic(data); findings(data); sources(data,manifest); typeset(document.getElementById('why'));
    document.getElementById('status').textContent = 'Ready · ENDF/B-VII.1 and JENDL-4.0u (JEFF-4.0 optional) · Shared data checksums verified';
    if (typeof location !== 'undefined') { openTarget(); window.addEventListener('hashchange', openTarget); }
    if (globalThis.NXE_EMBEDDED) document.querySelector('.downloads').hidden=true;
    new ResizeObserver(notifyHeight).observe(document.body);
  }).catch(error => {
    const status = document.getElementById('status');
    status.className='error'; status.textContent='Unable to load the visualization: '+error.message+' For local viewing, serve this folder over localhost; double-clicking the HTML file does not work.';
    console.error(error);
  });
}());
