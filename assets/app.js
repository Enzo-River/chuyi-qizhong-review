/* 初一上 · 期中在线复习 —— 纯前端，无构建、无网络依赖 */
(function () {
  'use strict';

  /* ---------------- 访问口令门（前端门槛，非服务端鉴权） ----------------
     源码只保存口令哈希，不保存明文；验证通过后把「已解锁」标记写入本机 localStorage。
     注意：纯静态站点无法做到真正的权限控制，此方法仅拦住随手打开的人。 */
  var GATE_STORE = 'chu1_gate_v1';
  var GATE_HASH = 1226898545; // djb2 口令哈希；修改口令时替换此值
  function gateHash(str) {
    var h = 5381;
    for (var i = 0; i < str.length; i++) h = ((h * 33) + str.charCodeAt(i)) >>> 0;
    return h >>> 0;
  }
  function gateUnlocked() {
    try { return localStorage.getItem(GATE_STORE) === String(GATE_HASH); } catch (e) { return false; }
  }
  function gateInit() {
    var lock = document.getElementById('lockOverlay');
    if (!lock) return true;
    if (gateUnlocked()) { lock.parentNode.removeChild(lock); return true; }
    var input = document.getElementById('lockInput');
    var btn = document.getElementById('lockBtn');
    var msg = document.getElementById('lockMsg');
    function tryUnlock() {
      if (gateHash(input.value) === GATE_HASH) {
        try { localStorage.setItem(GATE_STORE, String(GATE_HASH)); } catch (e) {}
        msg.textContent = '';
        location.reload(); // 重新执行 IIFE，此时 gateInit 直接放行并初始化应用
        return true;
      }
      msg.textContent = '口令不正确，请重试';
      input.value = ''; input.focus();
      return false;
    }
    btn.addEventListener('click', tryUnlock);
    input.addEventListener('keydown', function (e) { if (e.key === 'Enter') tryUnlock(); });
    input.focus();
    return false;
  }
  if (!gateInit()) return; // 未解锁：不初始化应用，页面只有锁屏

  var REPO_URL = 'https://github.com/Enzo-River/chuyi-qizhong-review';
  var ORDER = ['bio', 'his', 'df', 'geo'];
  var D = window.REVIEW_DATA || {};
  var SUBJECTS = ORDER.map(function (k) { return D[k]; }).filter(Boolean);
  var STORE = 'chu1_review_v1';

  function loadState() {
    try {
      var s = JSON.parse(localStorage.getItem(STORE) || '{}');
      return { done: s.done || {}, quiz: s.quiz || {}, theme: s.theme || null };
    } catch (e) { return { done: {}, quiz: {}, theme: null }; }
  }
  function saveState() {
    try { localStorage.setItem(STORE, JSON.stringify(S)); } catch (e) { /* 隐私模式下忽略 */ }
  }
  var S = loadState();

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function el(id) { return document.getElementById(id); }
  function byId(sub, sec) {
    for (var i = 0; i < SUBJECTS.length; i++) {
      if (SUBJECTS[i].id === sub) {
        for (var j = 0; j < SUBJECTS[i].sections.length; j++) {
          if (SUBJECTS[i].sections[j].id === sec) return SUBJECTS[i].sections[j];
        }
      }
    }
    return null;
  }
  function itemId(sub, sec, i) { return sub + '/' + sec + '/' + i; }

  /* ---------------- 期中 / 期末 两个范围 ---------------- */
  function hasFinal(sub) {
    return sub.sections.some(function (s) { return s.scope === 'final'; });
  }
  function visibleSections(sub, scope) {
    var final_ = sub.sections.filter(function (s) { return s.scope === 'final'; });
    var mid = sub.sections.filter(function (s) { return s.scope !== 'final'; });
    return scope === 'final' ? final_.concat(mid) : mid;
  }
  function secHref(sub, s) {
    return '#/' + sub.id + (s.scope === 'final' ? '/final/' + s.id : '/' + s.id);
  }

  /* ---------------- 进度统计 ---------------- */
  function stats(subjectId) {
    var total = 0, done = 0, quizTotal = 0, cards = 0, fills = 0;
    SUBJECTS.forEach(function (sub) {
      if (subjectId && sub.id !== subjectId) return;
      sub.sections.forEach(function (sec) {
        if (sec.kind === 'cards' || sec.kind === 'fill' || sec.kind === 'qa') {
          sec.items.forEach(function (_, i) {
            total++;
            if (S.done[itemId(sub.id, sec.id, i)]) done++;
            if (sec.kind === 'cards') cards++;
            if (sec.kind === 'fill') fills++;
          });
        } else if (sec.kind === 'mcq') {
          sec.items.forEach(function (it, i) {
            total++; quizTotal++;
            if (S.done[itemId(sub.id, sec.id, i)]) done++;
          });
        }
      });
    });
    return { total: total, done: done, quizTotal: quizTotal, cards: cards, fills: fills };
  }
  function progressBar(st) {
    var pct = st.total ? Math.round(st.done / st.total * 100) : 0;
    return '<div class="progress-card">' +
      '<div class="progress-top"><strong>我的复习进度</strong>' +
      '<span class="progress-num">' + st.done + ' / ' + st.total + '　·　' + pct + '%</span></div>' +
      '<div class="bar"><i style="width:' + pct + '%"></i></div>' +
      '<p class="progress-hint">在抽背卡片、填空自测、答案对照里点「✓ 已掌握」，或把选择题做对，就会记入进度。进度只存在这台设备的浏览器里。</p>' +
      '</div>';
  }

  /* ---------------- 首页 ---------------- */
  function renderHome() {
    var st = stats();
    var h = '<div class="wrap"><section class="hero">' +
      '<h1>初一上 · 期中/期末在线复习</h1>' +
      '<p class="lead">生物 · 历史 · 道法 · 地理　四科资料分门别类，边看边测，随时抽背。</p>' +
      '<p class="meta">每科都分「期中范围」与「期末全册」两个入口；期末新增章节为自主整理，逐题答案以教材与老师课堂讲授为准　·　共 ' + SUBJECTS.length + ' 科 / ' +
      SUBJECTS.reduce(function (n, s) { return n + s.sections.length; }, 0) + ' 个板块</p>' +
      '</section>' + progressBar(st);

    var skillSubs = SUBJECTS.filter(function (x) { return x.sections.some(function (y) { return y.id === x.id + '-skill'; }); });
    if (skillSubs.length) {
      h += '<a class="skill-entry" href="#/skills">' +
        '<span class="se-ico">🎯</span><span class="se-txt"><b>专项刷练 · 随时一页搞定</b>' +
        '<small>生物实验识图 / 历史材料题 / 道法答题模板 / 地理气候图判读，四科专项集中在一页，点开即刷</small></span>' +
        '<span class="se-arrow">→</span></a>';
    }

    h += '<div class="grid">';
    SUBJECTS.forEach(function (sub) {
      var s = stats(sub.id), mcq = 0, notes = 0, quizCards = 0;
      sub.sections.forEach(function (sec) {
        if (sec.kind === 'mcq') mcq += sec.items.length;
        if (sec.kind === 'notes') notes += sec.groups.length;
        if (sec.kind === 'cards') quizCards += sec.items.length;
      });
      var third = mcq ? '<span><b>' + mcq + '</b> 道选择题</span>'
        : '<span><b>' + quizCards + '</b> 张抽背卡</span>';
      var href = '#' + '/' + sub.id + (hasFinal(sub) ? '/final' : '');
      h += '<a class="subject-card" style="--sub-color:' + esc(sub.color) + '" href="' + href + '">' +
        '<span class="sc-emoji">' + sub.emoji + '</span>' +
        '<h2>' + esc(sub.name) + '</h2>' +
        '<p class="sc-sub">' + esc(sub.sub) + '</p>' +
        '<p class="sc-desc">' + esc(sub.desc) + '</p>' +
        '<div class="sc-stats"><span><b>' + sub.sections.length + '</b> 个板块</span>' +
        '<span><b>' + notes + '</b> 组知识要点</span>' + third +
        '<span>已掌握 <b>' + s.done + '/' + s.total + '</b></span></div>' +
        (hasFinal(sub) ? '<div class="sc-scope"><span class="pill on">期末全册</span><span class="pill">期中范围</span></div>' : '') +
        '</a>';
    });
    h += '</div>';

    h += '<section class="howto"><h3>怎么用</h3><ol>' +
      '<li><b>先选范围</b>：学科页顶部可切「期中范围 / 期末全册」。期末全册里，前面是新增章节，末尾「期中回顾」是已复习过的板块。</li>' +
      '<li><b>先看知识提纲</b>：按章节折叠展开，点「遮罩速记」盖住要点边回忆边对照。</li>' +
      '<li><b>再自测</b>：生物填空由「空白版 ↔ 答案版」逐行比对生成；地理、道法另配知识点填空与抽背卡。</li>' +
      '<li><b>刷题与对照</b>：原卷选择题与自编选择题均可即时判分；非选择题可展开看参考答案，地理每题附解析。</li>' +
      '<li><b>抽背</b>：道法必考卡、历史卡、地理卡可随机抽取、逐张标记已掌握。</li>' +
      '<li><b>看图复习</b>：原卷配图、历史 PPT 结构图已嵌回站内；地理配 10 张自制识图示意图，点图可放大。</li>' +
      '<li><b>专项刷练</b>：首页顶部「专项刷练」入口把四科研判/实验/材料题模板集中在一页，切科不用返回。</li>' +
      '<li><b>查原件</b>：生物、历史、道法提供原 Word / PPT / PDF 下载；地理与期末新增内容为按教材自主整理，无校内原件。</li>' +
      '</ol></section></div>';
    return h;
  }

  /* ---------------- 原卷配图 ---------------- */
  function figLink(f, showCap) {
    return '<a class="fig-link" href="' + esc(f.src) + '" target="_blank" rel="noopener" ' +
      'title="点击在新标签打开原图，可放大查看">' +
      '<img src="' + esc(f.src) + '" alt="' + esc(f.cap || '原卷配图') + '" loading="lazy">' +
      (showCap && f.cap ? '<span class="fig-cap">' + esc(f.cap) + '</span>' : '') + '</a>';
  }

  function qFigs(imgs) {
    if (!imgs || !imgs.length) return '';
    return '<div class="q-figs"><div class="fig-label">🖼 原卷配图 · 点击放大</div>' +
      '<div class="fig-grid">' + imgs.map(function (f) { return figLink(f, false); }).join('') + '</div></div>';
  }

  function figureStrip(figures) {
    if (!figures || !figures.items || !figures.items.length) return '';
    return '<details class="group fig-strip"><summary>' + esc(figures.title) + '</summary>' +
      '<div class="group-body"><div class="fig-grid wide">' +
      figures.items.map(function (f) { return figLink(f, true); }).join('') +
      '</div><p class="muted slide-tip">以上为原始 Word 文档内嵌配图，按原文顺序排列；点开可放大。</p></div></details>';
  }

  /* ---------------- 各类板块渲染 ---------------- */
  function renderNotes(sec, sub) {
    var h = '<div class="section-tools">' +
      '<button class="btn small" data-act="expand">全部展开</button>' +
      '<button class="btn small" data-act="collapse">全部折叠</button>' +
      '<button class="btn small" data-act="mask" id="maskBtn">🫧 遮罩速记</button>' +
      '</div><div class="notes-root">';
    sec.groups.forEach(function (g, gi) {
      h += '<details class="group" ' + (gi === 0 ? 'open' : '') + '><summary>' + esc(g.title) + '</summary><div class="group-body">';
      g.blocks.forEach(function (b) {
        if (b.t === 'p') h += '<p class="maskable">' + esc(b.text) + '</p>';
        else if (b.t === 'table') {
          h += '<div class="tbl-wrap"><table>';
          b.rows.forEach(function (row, ri) {
            h += '<tr>' + row.map(function (c) {
              return ri === 0 ? '<th>' + esc(c) + '</th>' : '<td class="maskable">' + esc(c) + '</td>';
            }).join('') + '</tr>';
          });
          h += '</table></div>';
        } else if (b.t === 'note') h += '<p><span class="note-line">' + esc(b.text) + '</span></p>';
        else if (b.t === 'img') h += '<figure class="inline-fig">' + figLink(b, true) + '</figure>';
      });
      h += '</div></details>';
    });
    return h + '</div>';
  }

  function fillFull(it) {
    var parts = esc(it.q).split('＿＿＿＿'), out = '';
    for (var i = 0; i < parts.length - 1; i++) {
      out += parts[i] + '<b style="color:var(--accent)">' + esc(it.a[i] || '') + '</b>';
    }
    return out + parts[parts.length - 1];
  }

  function renderFill(sec, sub) {
    var groups = {}, order = [];
    sec.items.forEach(function (it, i) {
      var g = it.group || '要点';
      if (!groups[g]) { groups[g] = []; order.push(g); }
      groups[g].push({ it: it, i: i });
    });
    var h = '<div class="section-tools">' +
      '<button class="btn small primary" data-act="focus" data-mode="fill">🎲 随机抽背</button>' +
      '<button class="btn small" data-act="expand">全部展开</button>' +
      '<button class="btn small" data-act="collapse">全部折叠</button>' +
      '<span class="source-tag">共 ' + sec.items.length + ' 空</span></div>';
    order.forEach(function (g, gi) {
      h += '<details class="group" ' + (gi === 0 ? 'open' : '') + '><summary>' + esc(g.length > 48 ? g.slice(0, 48) + '…' : g) +
        ' <span class="badge">' + groups[g].length + ' 题</span></summary><div class="group-body">';
      groups[g].forEach(function (o) {
        var id = itemId(sub.id, sec.id, o.i), ok = !!S.done[id];
        var q = esc(o.it.q).replace(/＿＿＿＿/g, '<span class="blank">?</span>');
        h += '<div class="card ' + (ok ? 'mastered' : '') + '" data-card="' + esc(id) + '">' +
          '<div class="card-head"><div class="q-text">' + q + '</div></div>' +
          '<div class="answers hidden">' + o.it.a.map(function (a) {
            return '<span class="answer-chip">' + esc(a) + '</span>';
          }).join('') + '</div>' +
          '<div class="answer-full hidden">' + fillFull(o.it) + '</div>' +
          '<div class="card-actions">' +
          '<button class="btn small" data-act="reveal-fill">显示答案</button>' +
          '<button class="btn small ' + (ok ? 'on' : '') + '" data-act="master" data-id="' + esc(id) + '">' + (ok ? '✓ 已掌握' : '标记已掌握') + '</button>' +
          '</div></div>';
      });
      h += '</div></details>';
    });
    return h;
  }

  function renderMcq(sec, sub) {
    var answered = 0, correct = 0;
    sec.items.forEach(function (it, i) {
      var v = S.quiz[itemId(sub.id, sec.id, i)];
      if (v) { answered++; if (v === it.ans) correct++; }
    });
    var h = '<div class="quiz-bar"><span>已答 <b>' + answered + '/' + sec.items.length + '</b>　答对 <b>' + correct + '</b></span>' +
      '<div class="bar"><i style="width:' + (sec.items.length ? Math.round(answered / sec.items.length * 100) : 0) + '%"></i></div>' +
      '<button class="btn small" data-act="quiz-filter" id="quizFilterBtn">只看错题</button>' +
      '<button class="btn small" data-act="quiz-reset">重做本组</button></div><div class="quiz-root">';
    sec.items.forEach(function (it, i) {
      var id = itemId(sub.id, sec.id, i), chosen = S.quiz[id], ok = chosen === it.ans;
      h += '<div class="card quiz-card" data-no="' + it.no + '" data-wrong="' + (chosen && !ok ? '1' : '0') + '">' +
        '<div class="card-head"><div class="q-text"><b>第 ' + it.no + ' 题</b>　' + esc(it.q) + '</div>' +
        '<span class="badge ' + (ok ? 'ok' : '') + '">' + (chosen ? (ok ? '✓ 答对' : '✗ 答错') : '未作答') + '</span></div>' +
        qFigs(it.imgs) + '<div class="opts">';
      it.opts.forEach(function (o) {
        var cls = 'opt';
        if (chosen) {
          if (o.k === it.ans) cls += ' correct';
          else if (o.k === chosen) cls += ' wrong';
          else cls += ' dim';
        }
        h += '<button class="' + cls + '" data-act="answer" data-id="' + esc(id) + '" data-k="' + o.k +
          '" data-ans="' + it.ans + '"' + (chosen ? ' disabled' : '') + '><span class="k">' + o.k + '</span><span>' + esc(o.v) + '</span></button>';
      });
      h += '</div><div class="quiz-result ' + (chosen ? (ok ? 'ok' : 'no') : 'hidden') + '">' +
        (chosen ? (ok ? '✓ 回答正确' : '✗ 答错了，正确答案 ' + it.ans) : '') + '</div>' +
        (it.tip ? '<details class="quiz-tip"><summary>查看解析</summary><div>' + esc(it.tip) + '</div></details>' : '') +
        '</div>';
    });
    return h + '</div>';
  }

  function renderQa(sec, sub) {
    var h = '<div class="qa">';
    sec.items.forEach(function (it, i) {
      var id = itemId(sub.id, sec.id, i), ok = !!S.done[id];
      h += '<div class="qa-item' + (ok ? ' mastered' : '') + '">' +
        '<div class="qa-q">' + esc(it.q) + (ok ? '　<span class="badge ok">✓ 已掌握</span>' : '') + '</div>' +
        qFigs(it.imgs) +
        '<details class="qa-ans"><summary>展开参考答案</summary>' +
        '<div class="a-body">' + esc(it.a) +
        '<div class="card-actions"><button class="btn small ' + (ok ? 'on' : '') + '" data-act="master" data-id="' + esc(id) + '">' +
        (ok ? '✓ 已掌握' : '标记已掌握') + '</button></div></div></details></div>';
    });
    return h + '</div>';
  }

  function renderCards(sec, sub) {
    var groups = {}, order = [];
    sec.items.forEach(function (it, i) {
      var g = it.group || '卡片';
      if (!groups[g]) { groups[g] = []; order.push(g); }
      groups[g].push({ it: it, i: i });
    });
    var h = '<div class="section-tools">' +
      '<button class="btn small primary" data-act="focus" data-mode="cards">🎲 随机抽背</button>' +
      '<button class="btn small" data-act="expand">全部展开</button>' +
      '<button class="btn small" data-act="collapse">全部折叠</button>' +
      '<span class="source-tag">共 ' + sec.items.length + ' 张</span></div>';
    order.forEach(function (g, gi) {
      h += '<details class="group" ' + (gi === 0 ? 'open' : '') + '><summary>' + esc(g) +
        ' <span class="badge">' + groups[g].length + ' 张</span></summary><div class="group-body">';
      groups[g].forEach(function (o) {
        var id = itemId(sub.id, sec.id, o.i), ok = !!S.done[id];
        h += '<div class="card ' + (ok ? 'mastered' : '') + '">' +
          '<div class="card-head"><div class="q-text">' + esc(o.it.q) + '</div>' +
          '<span class="badge ' + (ok ? 'ok' : '') + '">' + (ok ? '✓ 已掌握' : '待背') + '</span></div>' +
          '<div class="answer-full hidden">' + esc(o.it.a) + '</div>' +
          '<div class="card-actions"><button class="btn small" data-act="reveal-card">显示答案</button>' +
          '<button class="btn small ' + (ok ? 'on' : '') + '" data-act="master" data-id="' + esc(id) + '">' + (ok ? '✓ 已掌握' : '标记已掌握') + '</button>' +
          '</div></div>';
      });
      h += '</div></details>';
    });
    return h;
  }

  function renderTimeline(sec) {
    var h = '<pre class="poem">' + esc(sec.poem || '') + '</pre><div class="timeline">';
    sec.items.forEach(function (it) {
      h += '<div class="tl-item"><h3>' + esc(it.era) + '　<span class="yr">' + esc(it.year) + '</span></h3>' +
        '<div class="tg">' + esc(it.tag) + '</div></div>';
    });
    return h + '</div>';
  }

  function renderFiles(sec) {
    var h = '<div class="file-list">';
    sec.items.forEach(function (f) {
      h += '<a class="file-item" href="' + esc(f.path) + '" download><span class="file-name">📎 ' + esc(f.name) + '</span>' +
        '<span class="file-size">' + esc(f.size) + '　下载 ⬇</span></a>';
    });
    return h + '</div><p class="muted" style="margin-top:14px;font-size:13px">提示：浏览器不能直接预览 docx / pptx，点链接会下载到本地，用 Word / WPS / PowerPoint 打开即可看到试卷插图。</p>';
  }

  function renderGallery(sec) {
    var h = '<div class="gallery">';
    sec.items.forEach(function (it) {
      h += '<figure class="slide-fig"><figcaption>' + esc(it.q) + '</figcaption>' +
        '<a class="slide-img-link" href="' + esc(it.src) + '" target="_blank" rel="noopener" title="点击在新标签查看原图">' +
        '<img src="' + esc(it.src) + '" alt="' + esc(it.alt || it.q) + '" loading="lazy"></a>' +
        '<p class="muted slide-tip">点击图片在新标签打开原图，可放大查看</p>';
      if (it.a) {
        h += '<details class="slide-text"><summary>文字要点（按原图逐字转录，可全站搜索）</summary>' +
          '<div class="slide-text-body">' + esc(it.a) + '</div></details>';
      }
      h += '</figure>';
    });
    return h + '</div>';
  }

  var RENDERERS = { notes: renderNotes, fill: renderFill, mcq: renderMcq, qa: renderQa,
                    cards: renderCards, timeline: renderTimeline, files: renderFiles,
                    gallery: renderGallery };

  /* ---------------- 专项刷练聚合页 ---------------- */
  function skillSections() {
    var out = [];
    SUBJECTS.forEach(function (sub) {
      sub.sections.forEach(function (sec) {
        if (sec.id === sub.id + '-skill' || /专项突破/.test(sec.title)) {
          out.push({ sub: sub, sec: sec });
        }
      });
    });
    return out;
  }

  function renderSkills(active) {
    var list = skillSections();
    if (!list.length) return '<div class="wrap"><p class="muted">暂无专项板块。</p></div>';
    if (!active) active = list[0].sec.id;
    var cur = null;
    list.forEach(function (x) { if (x.sec.id === active) cur = x; });
    if (!cur) cur = list[0];

    var h = '<div class="wrap"><div class="sub-head"><a class="back-link" href="#/">← 返回学科总览</a>' +
      '<h1>🎯 专项刷练</h1><p>四科研判 / 实验 / 材料题方法集中在一页，随时切换、即开即刷。</p></div>' +
      '<nav class="tabs skill-tabs">';
    list.forEach(function (x) {
      h += '<a class="tab ' + (x.sec.id === active ? 'active' : '') + '" href="#/skills/' + x.sec.id + '">' +
        x.sub.emoji + ' ' + esc(x.sub.name) + ' · ' + esc(x.sec.title.replace(/^专项突破\s*·\s*/, '')) + '</a>';
    });
    h += '</nav><div class="section-head"><h2>' + esc(cur.sub.name) + ' · ' + esc(cur.sec.title) + '</h2><p>' +
      esc(cur.sec.desc) + (cur.sec.source ? '　<span class="source-tag">来源：' + esc(cur.sec.source) + '</span>' : '') +
      '</p></div>';
    h += (RENDERERS[cur.sec.kind] || function () { return '<p class="muted">暂不支持的板块类型</p>'; })(cur.sec, cur.sub);
    h += '<div class="skill-foot"><a class="btn ghost" href="#/' + cur.sub.id + '/final/' + cur.sec.id + '">在' + esc(cur.sub.name) + '学科页打开 →</a></div>';
    h += '</div>';
    return h;
  }

  /* ---------------- 学科页 ---------------- */
  function renderSubject(sub, sec, scope) {
    var finals = hasFinal(sub);
    var list = visibleSections(sub, scope);
    var h = '<div class="wrap"><div class="sub-head"><a class="back-link" href="#/">← 返回学科总览</a>' +
      '<h1>' + sub.emoji + '　' + esc(sub.name) + '</h1><p>' + esc(sub.sub) + '</p>';
    if (finals) {
      h += '<div class="scope-switch">' +
        '<a class="' + (scope === 'final' ? '' : 'on') + '" href="#/' + sub.id + '">期中范围</a>' +
        '<a class="' + (scope === 'final' ? 'on' : '') + '" href="#/' + sub.id + '/final">期末全册</a>' +
        '</div>' +
        '<p class="scope-hint">' + (scope === 'final'
          ? '期末按全册复习：前 ' + list.filter(function (s) { return s.scope === 'final'; }).length +
            ' 个板块是新增内容，末尾「期中回顾」为已复习板块，可快速过一遍。'
          : '当前只看期中范围；点「期末全册」可查看新增章节、全册串讲与模拟卷。') + '</p>';
    }
    h += '</div><nav class="tabs">';
    list.forEach(function (s, i) {
      if (scope === 'final' && s.scope !== 'final' && (i === 0 || list[i - 1].scope === 'final')) {
        h += '<span class="tab-sep">期中回顾</span>';
      }
      h += '<a class="tab ' + (s.id === sec.id ? 'active' : '') + '" href="' + secHref(sub, s) + '">' +
        s.icon + ' ' + esc(s.title) + '</a>';
    });
    h += '</nav><div class="section-head"><h2>' + esc(sec.title) + '</h2><p>' + esc(sec.desc) +
      (sec.source ? '　<span class="source-tag">来源：' + esc(sec.source) + '</span>' : '') + '</p></div>';
    h += (RENDERERS[sec.kind] || function () { return '<p class="muted">暂不支持的板块类型</p>'; })(sec, sub);
    h += figureStrip(sec.figures);
    h += '</div>';
    return h;
  }

  /* ---------------- 路由 ---------------- */
  function currentRoute() {
    var raw = location.hash.replace(/^#\/?/, '');
    var parts = raw.split('/');
    var sub = null;
    SUBJECTS.forEach(function (s) { if (s.id === parts[0]) sub = s; });
    if (parts[0] === 'skills') {
      var firstSkill = skillSections();
      return { sub: null, sec: null, scope: 'mid', skills: parts[1] || (firstSkill.length ? firstSkill[0].sec.id : '') };
    }
    if (!sub) return { sub: null, sec: null, scope: 'mid' };
    var scope = 'mid', sec = null;
    if (parts[1] === 'final') {
      scope = 'final';
      sub.sections.forEach(function (s) { if (s.id === parts[2] && s.scope === 'final') sec = s; });
      if (!sec) sec = visibleSections(sub, 'final')[0] || sub.sections[0];
    } else {
      sub.sections.forEach(function (s) { if (s.id === parts[1]) sec = s; });
      if (!sec) sec = sub.sections[0];
      scope = sec.scope === 'final' ? 'final' : 'mid';
    }
    return { sub: sub, sec: sec, scope: scope, skills: null };
  }

  var view = { sub: null, sec: null, masked: false, quizFilter: 'all', focusList: [], focusIdx: 0, focusMode: 'cards' };

  function render() {
    var r = currentRoute();
    var routeKey = r.skills ? 'skills/' + r.skills : (r.sub ? r.sub.id + '/' + r.sec.id : 'home');
    var oldKey = view.routeKey || 'home';
    var sameRoute = routeKey === oldKey;
    var y = sameRoute ? window.scrollY : 0;
    view.routeKey = routeKey;
    view.sub = r.sub; view.sec = r.sec;
    if (!sameRoute) { view.masked = false; view.quizFilter = 'all'; }
    el('app').innerHTML = r.skills ? renderSkills(r.skills) : (r.sub ? renderSubject(r.sub, r.sec, r.scope) : renderHome());
    document.title = (r.skills ? '专项刷练 · ' : (r.sub ? r.sub.name + ' · ' + (r.scope === 'final' ? '期末' : '期中') + ' · ' + r.sec.title + ' · ' : '')) + '初一上 · 期中/期末复习';
    if (view.masked) {
      var ms = el('app').querySelectorAll('.maskable');
      for (var i = 0; i < ms.length; i++) ms[i].classList.add('masked');
      var mb = el('maskBtn');
      if (mb) { mb.classList.add('on'); mb.textContent = '👁 取消遮罩'; }
    }
    window.scrollTo(0, y);
    updateBackTop();
  }

  /* ---------------- 搜索 ---------------- */
  var SEARCH = [];
  function buildSearch() {
    SUBJECTS.forEach(function (sub) {
      sub.sections.forEach(function (sec) {
        var add = function (text) {
          if (text && String(text).trim()) SEARCH.push({ sub: sub.id, sec: sec.id,
            href: secHref(sub, sec),
            subName: sub.name, secTitle: sec.title, text: String(text).replace(/\s+/g, ' ').trim() });
        };
        if (sec.kind === 'notes') sec.groups.forEach(function (g) {
          add(g.title);
          g.blocks.forEach(function (b) {
            add(b.t === 'p' || b.t === 'note' || b.t === 'img' ? b.text || b.cap :
                (b.rows || []).map(function (r) { return r.join(' '); }).join(' '));
          });
        });
        else if (sec.items) sec.items.forEach(function (it) {
          if (it.q) add('第' + (it.no || '') + '题 ' + it.q);
          if (it.a) add(Array.isArray(it.a) ? it.a.join(' ') : it.a);
          if (it.opts) add(it.opts.map(function (o) { return o.k + '.' + o.v; }).join(' '));
          if (it.tip) add(it.tip);
          if (it.era) add(it.era + ' ' + it.year + ' ' + it.tag);
          if (it.name) add(it.name);
          (it.imgs || []).forEach(function (f) { add(f.cap); });
        });
        if (sec.figures) (sec.figures.items || []).forEach(function (f) { add(f.cap); });
        if (sec.poem) add(sec.poem);
      });
    });
  }
  function highlight(text, q) {
    var s = esc(text);
    if (!q) return s;
    var parts = s.split(new RegExp('(' + q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'ig'));
    return parts.map(function (p, i) { return i % 2 ? '<mark>' + p + '</mark>' : p; }).join('');
  }
  function runSearch(q) {
    q = q.trim();
    var box = el('searchResults');
    if (!q) { box.innerHTML = '<p class="muted">输入关键词，例如「显微镜」「分封制」「友谊」「经纬网」。</p>'; return; }
    var low = q.toLowerCase(), hits = [];
    for (var i = 0; i < SEARCH.length && hits.length < 50; i++) {
      if (SEARCH[i].text.toLowerCase().indexOf(low) >= 0) hits.push(SEARCH[i]);
    }
    if (!hits.length) { box.innerHTML = '<p class="muted">没有找到「' + esc(q) + '」，换个关键词试试。</p>'; return; }
    box.innerHTML = hits.map(function (h) {
      var pos = Math.max(0, h.text.toLowerCase().indexOf(low) - 40);
      var snip = (pos ? '…' : '') + h.text.slice(pos, pos + 190) + (h.text.length > pos + 190 ? '…' : '');
      return '<a class="search-hit" href="' + h.href + '" data-close-search="1">' +
        '<div class="hit-top">' + esc(h.subName) + ' · ' + esc(h.secTitle) + '</div>' +
        '<div class="hit-txt">' + highlight(snip, q) + '</div></a>';
    }).join('');
  }

  /* ---------------- 抽背浮层 ---------------- */
  function openFocus(mode) {
    var sec = view.sec, sub = view.sub;
    if (!sec || !sub) return;
    view.focusMode = mode;
    view.focusList = sec.items.map(function (it, i) { return { it: it, id: itemId(sub.id, sec.id, i) }; });
    if (!view.focusList.length) return;
    view.focusIdx = Math.floor(Math.random() * view.focusList.length);
    el('focusTitle').textContent = sub.name + ' · ' + sec.title + '（' + view.focusList.length + ' 张）';
    el('focusOverlay').classList.remove('hidden');
    paintFocus(false);
  }
  function paintFocus(reveal) {
    var o = view.focusList[view.focusIdx];
    if (!o) return;
    var q = esc(o.it.q).replace(/＿＿＿＿/g, '<span class="blank">?</span>');
    var a = esc(Array.isArray(o.it.a) ? o.it.a.join('　/　') : o.it.a);
    var ok = !!S.done[o.id];
    el('focusBody').innerHTML = '<div class="fq">' + q + '</div>' +
      '<div class="fa ' + (reveal ? '' : 'hidden') + '" id="focusAnswer">' + a + '</div>' +
      '<div class="card-actions"><button class="btn small ' + (ok ? 'on' : '') + '" data-act="master" data-id="' + esc(o.id) + '">' +
      (ok ? '✓ 已掌握' : '标记已掌握') + '</button><span class="muted" style="align-self:center;font-size:13px">' +
      (view.focusIdx + 1) + ' / ' + view.focusList.length + '</span></div>';
    el('focusReveal').textContent = reveal ? '隐藏答案' : '显示答案';
    el('focusReveal').dataset.shown = reveal ? '1' : '';
  }
  function closeFocus() { el('focusOverlay').classList.add('hidden'); }

  /* ---------------- 事件 ---------------- */
  function updateBackTop() { el('backTop').classList.toggle('show', window.scrollY > 400); }

  function onAction(act, node, ev) {
    var card, id, ans, k, all;
    switch (act) {
      case 'expand':
      case 'collapse':
        all = el('app').querySelectorAll('details.group, .qa details');
        for (var i = 0; i < all.length; i++) all[i].open = (act === 'expand');
        return;
      case 'mask':
        view.masked = !view.masked;
        var ms = el('app').querySelectorAll('.maskable');
        for (var j = 0; j < ms.length; j++) {
          ms[j].classList.toggle('masked', view.masked);
          ms[j].classList.remove('revealed');
        }
        node.classList.toggle('on', view.masked);
        node.textContent = view.masked ? '👁 取消遮罩' : '🫧 遮罩速记';
        return;
      case 'reveal-fill':
        card = node.closest('.card');
        var ansBox = card.querySelector('.answers');
        var full = card.querySelector('.answer-full');
        var show = ansBox.classList.contains('hidden');
        ansBox.classList.toggle('hidden', !show);
        full.classList.toggle('hidden', !show);
        node.textContent = show ? '收起答案' : '显示答案';
        return;
      case 'reveal-card':
        card = node.closest('.card');
        var aBox = card.querySelector('.answer-full');
        var on = aBox.classList.contains('hidden');
        aBox.classList.toggle('hidden', !on);
        node.textContent = on ? '收起答案' : '显示答案';
        return;
      case 'master':
        id = node.dataset.id;
        if (S.done[id]) delete S.done[id]; else S.done[id] = 1;
        saveState();
        var y = window.scrollY;
        render();
        window.scrollTo(0, y);
        if (!el('focusOverlay').classList.contains('hidden')) paintFocus(el('focusReveal').dataset.shown === '1');
        return;
      case 'answer':
        id = node.dataset.id; k = node.dataset.k; ans = node.dataset.ans;
        if (S.quiz[id]) return;
        S.quiz[id] = k;
        if (k === ans) S.done[id] = 1; else delete S.done[id];
        saveState();
        var y2 = window.scrollY;
        render();
        window.scrollTo(0, y2);
        return;
      case 'quiz-filter':
        view.quizFilter = view.quizFilter === 'all' ? 'wrong' : 'all';
        var cards = el('app').querySelectorAll('.quiz-card');
        for (var m = 0; m < cards.length; m++) {
          cards[m].style.display = (view.quizFilter === 'all' || cards[m].dataset.wrong === '1') ? '' : 'none';
        }
        node.textContent = view.quizFilter === 'all' ? '只看错题' : '显示全部';
        node.classList.toggle('on', view.quizFilter === 'wrong');
        return;
      case 'quiz-reset':
        if (!confirm('确定清空本组选择题的作答记录吗？')) return;
        var sec = view.sec, sub = view.sub;
        sec.items.forEach(function (_, i) { delete S.quiz[itemId(sub.id, sec.id, i)]; delete S.done[itemId(sub.id, sec.id, i)]; });
        saveState(); render();
        return;
      case 'focus':
        openFocus(node.dataset.mode || 'cards');
        return;
    }
  }

  document.addEventListener('click', function (ev) {
    var n = ev.target.closest('[data-act]');
    if (n) { ev.preventDefault(); onAction(n.dataset.act, n, ev); return; }
    var m = ev.target.closest('.maskable.masked');
    if (m) { m.classList.remove('masked'); m.classList.add('revealed'); return; }
    var hit = ev.target.closest('[data-close-search]');
    if (hit) { el('searchOverlay').classList.add('hidden'); return; }
  });

  window.addEventListener('hashchange', render);
  window.addEventListener('scroll', updateBackTop, { passive: true });

  el('searchBtn').addEventListener('click', function () {
    el('searchOverlay').classList.remove('hidden');
    el('searchInput').value = ''; runSearch(''); el('searchInput').focus();
  });
  el('searchClose').addEventListener('click', function () { el('searchOverlay').classList.add('hidden'); });
  el('searchOverlay').addEventListener('click', function (e) { if (e.target === this) this.classList.add('hidden'); });
  el('searchInput').addEventListener('input', function () { runSearch(this.value); });
  el('themeBtn').addEventListener('click', function () {
    var t = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    applyTheme(t); S.theme = t; saveState();
  });
  el('githubLink').href = REPO_URL;
  if (el('lockBtnTop')) el('lockBtnTop').addEventListener('click', function () {
    if (!confirm('锁定本站？下次打开需要重新输入口令。')) return;
    try { localStorage.removeItem(GATE_STORE); } catch (e) {}
    location.reload();
  });
  el('backTop').addEventListener('click', function () { window.scrollTo({ top: 0, behavior: 'smooth' }); });
  el('focusClose').addEventListener('click', closeFocus);
  el('focusOverlay').addEventListener('click', function (e) { if (e.target === this) closeFocus(); });
  el('focusReveal').addEventListener('click', function () {
    var a = el('focusAnswer'); if (!a) return;
    var show = a.classList.contains('hidden');
    a.classList.toggle('hidden', !show);
    this.textContent = show ? '隐藏答案' : '显示答案';
    this.dataset.shown = show ? '1' : '';
  });
  el('focusNext').addEventListener('click', function () {
    view.focusIdx = (view.focusIdx + 1) % view.focusList.length; paintFocus(false);
  });
  el('focusPrev').addEventListener('click', function () {
    view.focusIdx = (view.focusIdx - 1 + view.focusList.length) % view.focusList.length; paintFocus(false);
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { el('searchOverlay').classList.add('hidden'); closeFocus(); }
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') { e.preventDefault(); el('searchBtn').click(); }
  });

  function applyTheme(t) {
    document.documentElement.setAttribute('data-theme', t);
    el('themeBtn').textContent = t === 'dark' ? '☀️' : '🌙';
  }
  applyTheme(S.theme || (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'));

  buildSearch();
  render();
})();
