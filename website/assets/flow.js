/* Maurya Flow Studio — visual automation builder (client-side).
   Exports JSON compatible with Maurya Automation (desktop + Android):
   { name, description, nodes: [{id,type,name,config,x,y}], connections: [{id,from,to}] } */
(function () {
  'use strict';

  var TYPES = {
    trigger:    { label: 'Trigger',        cat: 'Triggers', color: '#22d3ee', sub: 'Manual / Schedule / Webhook',
                  fields: [{ k: 'triggerType', l: 'Trigger type', ph: 'Manual' }, { k: 'schedule', l: 'Schedule (if Schedule)', ph: 'every 5m' }] },
    http:       { label: 'HTTP Request',   cat: 'Actions',  color: '#3b82f6', sub: 'Call any API',
                  fields: [{ k: 'url', l: 'URL', ph: 'https://api.example.com' }, { k: 'method', l: 'Method', ph: 'GET' }, { k: 'body', l: 'Body (optional)', ph: '{}' }] },
    setvar:     { label: 'Set Variable',   cat: 'Actions',  color: '#3b82f6', sub: 'Store a value',
                  fields: [{ k: 'name', l: 'Variable name', ph: 'greeting' }, { k: 'value', l: 'Value', ph: 'Hello {{trigger.name}}' }] },
    writefile:  { label: 'Write File',     cat: 'Actions',  color: '#3b82f6', sub: 'Save text to a file',
                  fields: [{ k: 'path', l: 'File path', ph: 'out/report.txt' }, { k: 'content', l: 'Content', ph: '{{vars.greeting}}' }] },
    email:      { label: 'Send Email',     cat: 'Actions',  color: '#3b82f6', sub: 'SMTP with app password',
                  fields: [{ k: 'host', l: 'SMTP host', ph: 'smtp.gmail.com' }, { k: 'port', l: 'Port', ph: '587' }, { k: 'user', l: 'User', ph: 'you@gmail.com' }, { k: 'pass', l: 'App password / secret', ph: '{{secrets.GMAIL_APP_PASS}}' }, { k: 'to', l: 'To', ph: 'someone@example.com' }, { k: 'subject', l: 'Subject', ph: 'Report ready' }, { k: 'body', l: 'Body', ph: 'Done at {{trigger.time}}' }] },
    pdf:        { label: 'Generate PDF',   cat: 'Actions',  color: '#3b82f6', sub: 'Text to PDF file',
                  fields: [{ k: 'path', l: 'Output path', ph: 'out/invoice.pdf' }, { k: 'text', l: 'Text', ph: 'Invoice for {{vars.client}}' }] },
    delay:      { label: 'Delay',          cat: 'Logic',    color: '#8b5cf6', sub: 'Wait before next step',
                  fields: [{ k: 'ms', l: 'Milliseconds', ph: '2000' }] },
    condition:  { label: 'Condition',      cat: 'Logic',    color: '#8b5cf6', sub: 'Branch on expression',
                  fields: [{ k: 'expression', l: 'Expression', ph: 'data.status == "ok"' }] },
    loop:       { label: 'Loop',           cat: 'Logic',    color: '#8b5cf6', sub: 'Iterate a list',
                  fields: [{ k: 'items', l: 'Items expression', ph: 'data.results' }] },
    filter:     { label: 'Filter',         cat: 'Logic',    color: '#8b5cf6', sub: 'Keep matching items',
                  fields: [{ k: 'expression', l: 'Expression per item', ph: 'item.price > 100' }] },
    transform:  { label: 'Transform',      cat: 'Logic',    color: '#8b5cf6', sub: 'Compute an expression',
                  fields: [{ k: 'expression', l: 'Expression', ph: 'sum(data.items, "price")' }] }
  };

  var state = { name: 'My Automation', description: '', nodes: [], connections: [], seq: 1, sel: null, pendingFrom: null };

  var canvas = document.getElementById('canvas');
  var nodesLayer = document.getElementById('nodes-layer');
  var wiresG = document.getElementById('wires-g');
  var emptyMsg = document.getElementById('canvas-empty');
  var paletteEl = document.getElementById('palette');
  var inspectorBody = document.getElementById('inspector-body');
  var statusCounts = document.getElementById('status-counts');
  var wfName = document.getElementById('wf-name');

  function uid(p) { return p + (state.seq++); }

  function addNode(type) {
    var t = TYPES[type];
    if (!t) return;
    var n = Math.floor(state.nodes.length / 4);
    var node = { id: uid('n'), type: type, name: t.label, config: {}, x: 60 + n * 30, y: 50 + n * 26 };
    state.nodes.push(node);
    select(node.id);
    render();
  }

  function nodeById(id) { for (var i = 0; i < state.nodes.length; i++) if (state.nodes[i].id === id) return state.nodes[i]; return null; }

  function select(id) { state.sel = id; state.pendingFrom = null; render(); }

  function deleteNode(id) {
    state.nodes = state.nodes.filter(function (n) { return n.id !== id; });
    state.connections = state.connections.filter(function (c) { return c.from !== id && c.to !== id; });
    if (state.sel === id) state.sel = null;
    render();
  }

  function connect(from, to) {
    if (!from || !to || from === to) return;
    for (var i = 0; i < state.connections.length; i++) {
      if (state.connections[i].from === from && state.connections[i].to === to) return;
    }
    state.connections.push({ id: uid('c'), from: from, to: to });
    state.pendingFrom = null;
    render();
  }

  function buildPalette() {
    var cats = { Triggers: [], Actions: [], Logic: [] };
    Object.keys(TYPES).forEach(function (k) { cats[TYPES[k].cat].push(k); });
    Object.keys(cats).forEach(function (cat) {
      var g = document.createElement('div');
      g.className = 'palette-group';
      var h = document.createElement('h4');
      h.textContent = cat;
      g.appendChild(h);
      cats[cat].forEach(function (type) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'palette-item';
        b.innerHTML = '';
        var s1 = document.createElement('span'); s1.textContent = TYPES[type].label;
        var s2 = document.createElement('small'); s2.textContent = TYPES[type].sub;
        b.appendChild(s1); b.appendChild(s2);
        b.addEventListener('click', function () { addNode(type); });
        g.appendChild(b);
      });
      paletteEl.appendChild(g);
    });
  }

  function render() {
    nodesLayer.textContent = '';
    wiresG.textContent = '';
    emptyMsg.style.display = state.nodes.length ? 'none' : 'block';
    statusCounts.textContent = state.nodes.length + ' nodes · ' + state.connections.length + ' connections';

    state.nodes.forEach(function (n) {
      var t = TYPES[n.type] || { label: n.type, color: '#3b82f6', fields: [] };
      var el = document.createElement('div');
      el.className = 'fnode' + (state.sel === n.id ? ' selected' : '');
      el.style.left = n.x + 'px';
      el.style.top = n.y + 'px';
      el.dataset.id = n.id;

      var head = document.createElement('div');
      head.className = 'fnode-head';
      var dot = document.createElement('span'); dot.className = 'dot'; dot.style.background = t.color;
      var lbl = document.createElement('span'); lbl.textContent = t.label;
      head.appendChild(dot); head.appendChild(lbl);

      var nm = document.createElement('span'); nm.className = 'fnode-name'; nm.textContent = n.name || t.label;
      var sub = document.createElement('span'); sub.className = 'fnode-sub'; sub.textContent = summarize(n);
      el.appendChild(head); el.appendChild(nm); el.appendChild(sub);

      var pin = document.createElement('span'); pin.className = 'port in'; pin.dataset.node = n.id; pin.dataset.kind = 'in';
      var pout = document.createElement('span'); pout.className = 'port out'; pout.dataset.node = n.id; pout.dataset.kind = 'out';
      el.appendChild(pin); el.appendChild(pout);

      el.addEventListener('pointerdown', function (e) { startDrag(e, n, el); });
      el.addEventListener('click', function (e) {
        if (e.target.classList.contains('port')) return;
        if (state.pendingFrom && state.pendingFrom !== n.id) { connect(state.pendingFrom, n.id); }
        else select(n.id);
      });
      nodesLayer.appendChild(el);
    });

    state.connections.forEach(function (c) {
      var a = nodeById(c.from), b = nodeById(c.to);
      if (!a || !b) return;
      var ae = elOf(a.id), be = elOf(b.id);
      if (!ae || !be) return;
      var x1 = a.x + ae.offsetWidth - 2, y1 = a.y + ae.offsetHeight / 2;
      var x2 = b.x + 2, y2 = b.y + be.offsetHeight / 2;
      var dx = Math.max(40, Math.abs(x2 - x1) / 2);
      var d = 'M' + x1 + ' ' + y1 + ' C' + (x1 + dx) + ' ' + y1 + ', ' + (x2 - dx) + ' ' + y2 + ', ' + x2 + ' ' + y2;
      var hit = mkPath(d, 'wire-hit');
      hit.addEventListener('click', function () {
        if (window.confirm('Delete this connection?')) {
          state.connections = state.connections.filter(function (x) { return x.id !== c.id; });
          render();
        }
      });
      wiresG.appendChild(hit);
      wiresG.appendChild(mkPath(d, 'wire'));
    });

    renderInspector();
  }

  function mkPath(d, cls) {
    var p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    p.setAttribute('d', d);
    p.setAttribute('class', cls);
    return p;
  }

  function elOf(id) { return nodesLayer.querySelector('[data-id="' + id + '"]'); }

  function summarize(n) {
    var keys = Object.keys(n.config || {});
    if (!keys.length) return 'Not configured';
    return keys.slice(0, 2).map(function (k) { return k + ': ' + String(n.config[k]).slice(0, 18); }).join(' · ');
  }

  function startDrag(e, n, el) {
    if (e.target.classList.contains('port')) return;
    e.preventDefault();
    el.setPointerCapture(e.pointerId);
    var ox = e.clientX - n.x, oy = e.clientY - n.y;
    function move(ev) {
      n.x = Math.max(0, ev.clientX - ox);
      n.y = Math.max(0, ev.clientY - oy);
      el.style.left = n.x + 'px';
      el.style.top = n.y + 'px';
      redrawWiresOnly();
    }
    function up() {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    }
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }

  function redrawWiresOnly() {
    wiresG.textContent = '';
    state.connections.forEach(function (c) {
      var a = nodeById(c.from), b = nodeById(c.to);
      if (!a || !b) return;
      var ae = elOf(a.id), be = elOf(b.id);
      if (!ae || !be) return;
      var x1 = a.x + ae.offsetWidth - 2, y1 = a.y + ae.offsetHeight / 2;
      var x2 = b.x + 2, y2 = b.y + be.offsetHeight / 2;
      var dx = Math.max(40, Math.abs(x2 - x1) / 2);
      var d = 'M' + x1 + ' ' + y1 + ' C' + (x1 + dx) + ' ' + y1 + ', ' + (x2 - dx) + ' ' + y2 + ', ' + x2 + ' ' + y2;
      (function (cid) {
        var hit = mkPath(d, 'wire-hit');
        hit.addEventListener('click', function () {
          if (window.confirm('Delete this connection?')) {
            state.connections = state.connections.filter(function (x) { return x.id !== cid; });
            render();
          }
        });
        wiresG.appendChild(hit);
      })(c.id);
      wiresG.appendChild(mkPath(d, 'wire'));
    });
  }

  function renderInspector() {
    inspectorBody.textContent = '';
    var n = state.sel ? nodeById(state.sel) : null;
    if (!n) {
      var p = document.createElement('p');
      p.className = 'muted small';
      p.textContent = 'Select a node on the canvas to edit it.';
      inspectorBody.appendChild(p);
      return;
    }
    var t = TYPES[n.type] || { fields: [] };

    var l1 = document.createElement('label'); l1.textContent = 'Node name';
    var i1 = document.createElement('input'); i1.type = 'text'; i1.value = n.name;
    i1.addEventListener('input', function () { n.name = i1.value; refreshNode(n); });
    inspectorBody.appendChild(l1); inspectorBody.appendChild(i1);

    t.fields.forEach(function (f) {
      var lab = document.createElement('label'); lab.textContent = f.l;
      var inp = document.createElement('textarea');
      inp.value = n.config[f.k] != null ? n.config[f.k] : '';
      inp.placeholder = f.ph || '';
      inp.addEventListener('input', function () { n.config[f.k] = inp.value; refreshNode(n); });
      inspectorBody.appendChild(lab); inspectorBody.appendChild(inp);
    });

    var del = document.createElement('button');
    del.type = 'button'; del.className = 'del-node'; del.textContent = 'Delete node';
    del.addEventListener('click', function () { deleteNode(n.id); });
    inspectorBody.appendChild(del);
  }

  function refreshNode(n) {
    var el = elOf(n.id);
    if (!el) return;
    el.querySelector('.fnode-name').textContent = n.name;
    el.querySelector('.fnode-sub').textContent = summarize(n);
  }

  canvas.addEventListener('click', function (e) {
    var port = e.target.closest ? e.target.closest('.port') : null;
    if (port && port.dataset.kind === 'out') {
      state.pendingFrom = port.dataset.node;
      redrawPending(e.target);
      return;
    }
    if (e.target === canvas || e.target === nodesLayer) { state.sel = null; state.pendingFrom = null; render(); }
  });

  function redrawPending(targetEl) {
    var from = nodeById(state.pendingFrom);
    if (!from) return;
    var fe = elOf(from.id);
    var x1 = from.x + fe.offsetWidth - 2, y1 = from.y + fe.offsetHeight / 2;
    var r = canvas.getBoundingClientRect();
    var x2 = e2x(targetEl, r), y2 = e2y(targetEl, r);
    var d = 'M' + x1 + ' ' + y1 + ' L' + x2 + ' ' + y2;
    wiresG.appendChild(mkPath(d, 'wire pending'));
  }
  function e2x(el, r) { return el.getBoundingClientRect().left - r.left + canvas.scrollLeft + 6; }
  function e2y(el, r) { return el.getBoundingClientRect().top - r.top + canvas.scrollTop + 6; }

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { state.pendingFrom = null; render(); }
    if ((e.key === 'Delete' || e.key === 'Backspace') && state.sel &&
        !/INPUT|TEXTAREA/.test(document.activeElement.tagName)) { deleteNode(state.sel); }
  });

  wfName.addEventListener('input', function () { state.name = wfName.value || 'Untitled'; });

  document.getElementById('btn-clear').addEventListener('click', function () {
    if (!state.nodes.length || window.confirm('Clear the whole canvas?')) {
      state.nodes = []; state.connections = []; state.sel = null; state.pendingFrom = null; render();
    }
  });

  document.getElementById('btn-export').addEventListener('click', function () {
    var data = {
      name: state.name || 'Untitled',
      description: state.description || '',
      nodes: state.nodes.map(function (n) { return { id: n.id, type: n.type, name: n.name, config: n.config, x: n.x, y: n.y }; }),
      connections: state.connections.map(function (c) { return { id: c.id, from: c.from, to: c.to }; })
    };
    var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = (state.name || 'workflow').replace(/[^a-z0-9\-_ ]/gi, '').trim().replace(/\s+/g, '-').toLowerCase() + '.flow.json';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
  });

  document.getElementById('btn-import').addEventListener('click', function () {
    document.getElementById('file-import').click();
  });
  document.getElementById('file-import').addEventListener('change', function (ev) {
    var f = ev.target.files && ev.target.files[0];
    if (!f) return;
    var fr = new FileReader();
    fr.onload = function () {
      try {
        var j = JSON.parse(String(fr.result));
        if (!Array.isArray(j.nodes)) throw new Error('nodes missing');
        state.name = j.name || 'Imported workflow';
        state.description = j.description || '';
        wfName.value = state.name;
        state.nodes = j.nodes.map(function (n) {
          return { id: String(n.id), type: TYPES[n.type] ? n.type : 'http', name: n.name || '', config: n.config || {}, x: Number(n.x) || 0, y: Number(n.y) || 0 };
        });
        var ids = {}; state.nodes.forEach(function (n) { ids[n.id] = 1; });
        state.connections = (Array.isArray(j.connections) ? j.connections : [])
          .filter(function (c) { return ids[c.from] && ids[c.to]; })
          .map(function (c) { return { id: String(c.id), from: String(c.from), to: String(c.to) }; });
        var maxSeq = 0;
        state.nodes.concat(state.connections).forEach(function (o) {
          var m = /^(n|c)(\d+)$/.exec(o.id); if (m) maxSeq = Math.max(maxSeq, Number(m[2]));
        });
        state.seq = maxSeq + 1;
        state.sel = null; state.pendingFrom = null;
        render();
      } catch (err) {
        window.alert('Invalid workflow JSON: ' + err.message);
      }
    };
    fr.readAsText(f);
    ev.target.value = '';
  });

  document.getElementById('btn-sample').addEventListener('click', function () {
    state.name = 'Daily Report Automation'; wfName.value = state.name;
    state.nodes = [
      { id: 'n1', type: 'trigger', name: 'Every morning', config: { triggerType: 'Schedule', schedule: 'every 24h' }, x: 40, y: 60 },
      { id: 'n2', type: 'http', name: 'Fetch stats', config: { url: 'https://api.example.com/stats', method: 'GET' }, x: 300, y: 140 },
      { id: 'n3', type: 'transform', name: 'Sum totals', config: { expression: 'sum(data.items, "price")' }, x: 560, y: 220 },
      { id: 'n4', type: 'pdf', name: 'Make report', config: { path: 'out/daily-report.pdf', text: 'Total: {{vars.result}}' }, x: 820, y: 300 }
    ];
    state.connections = [
      { id: 'c1', from: 'n1', to: 'n2' },
      { id: 'c2', from: 'n2', to: 'n3' },
      { id: 'c3', from: 'n3', to: 'n4' }
    ];
    state.seq = 5; state.sel = null; state.pendingFrom = null;
    render();
  });

  buildPalette();
  render();
})();
