/* The only frontend loader: used unchanged by GitHub Pages and Colab. */
(function () {
  'use strict';
  const REQUIRED = ['assets/data.json.gz', 'assets/panels.json'];
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
    if (data.schema !== 1 || data.main.selected_libraries.join(',') !== 'endfb71,jendl40' ||
        Object.keys(data.main.libraries).sort().join(',') !== 'endfb71,jendl40') throw Error('Unexpected bundle schema or library selection');
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
    frame.title = hostId === 'main-panel' ? 'Interactive neutron–xenon angular, recoil, partial-wave, potential and ENDF-minus-JENDL difference plots' : 'Interactive saved OPTMAN angular and recoil plots';
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
    frame.srcdoc = '<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>' + style + '</style><body>' + body + resize + '</body></html>';
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
        '<text x="300" y="63" fill="#d55e00">Visual choice (dotted): '+row.visual_fraction.toFixed(2)+'</text>'+ticks+
        '<path d="M60 90V300H530" fill="none" stroke="#435765"/>' +
        '<path d="M60 '+y(0)+'H530" stroke="#aaa"/><path d="M60 '+y(row.area_fraction)+'H530" stroke="#222" stroke-dasharray="7 4"/>' +
        '<path d="M60 '+y(row.visual_fraction)+'H530" stroke="#d55e00" stroke-width="2" stroke-dasharray="2 4"/>' +
        '<path d="M'+x(s.shape_dip_angle_deg)+' 90V300" stroke="#aaa"/>'+
        '<polyline points="'+points+'" fill="none" stroke="#0072b2" stroke-width="2"/>'+
        '<circle cx="'+x(s.shape_dip_angle_deg)+'" cy="'+y(row.at_shape_dip_fraction)+'" r="4" fill="#0072b2"/>'+
        '<text x="290" y="350" text-anchor="middle">Centre-of-mass angle θ (degrees)</text><text transform="translate(16,195) rotate(-90)" text-anchor="middle">Fraction of optical reaction</text></g></svg>';
    }
    document.getElementById('diagnostic-plot').innerHTML = plots;
    document.getElementById('diagnostic-table').innerHTML = '<table><caption>Native calculation; shape minimum '+s.shape_dip_angle_deg.toFixed(2)+'°. Browser recoil column uses the display grid.</caption><thead><tr><th>Evaluation</th><th>Area match</th><th>At shape minimum</th><th>At '+s.probe_angle_deg+'°</th><th>Browser recoil dip</th><th>Area excess with visual choice</th></tr></thead><tbody>'+s.rows.map(r=>'<tr><td>'+escapeHTML(r.label)+'</td><td>'+r.area_fraction.toFixed(4)+'</td><td>'+r.at_shape_dip_fraction.toFixed(4)+'</td><td>'+r.at_probe_fraction.toFixed(4)+'</td><td>'+r.browser_recoil_dip_fraction.toFixed(4)+'</td><td>+'+r.visual_area_excess_b.toFixed(4)+' b (+'+r.visual_area_excess_percent.toFixed(2)+'%)</td></tr>').join('')+'</tbody></table>';
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
    diagnostic(data); sources(data,manifest);
    document.getElementById('status').textContent = 'Ready · ENDF/B-VII.1 and JENDL-4.0u · Shared data checksums verified';
    if (globalThis.NXE_EMBEDDED) document.querySelector('.downloads').hidden=true;
    new ResizeObserver(notifyHeight).observe(document.body);
  }).catch(error => {
    const status = document.getElementById('status');
    status.className='error'; status.textContent='Unable to load the explorer: '+error.message+' For local viewing, serve this folder over localhost; double-clicking the HTML file does not work.';
    console.error(error);
  });
}());
