/* ============================================
   TG 资源导航 - 核心逻辑
   ============================================ */

var DATA = [];
var activeIdx = 0;
var filteredData = null;

var $ = function(s, p) { return (p || document).closest ? (p || document).querySelector(s) : null; };
var $$ = function(s, p) { return [].slice.call((p || document).querySelectorAll(s)); };

// --- 加载数据 ---
fetch('data.json')
  .then(function(r) { return r.json(); })
  .then(function(data) {
    DATA = data.filter(function(s) { return s.type === 'table'; });
    init();
  })
  .catch(function(err) {
    console.error('Failed to load data:', err);
    document.getElementById('content').innerHTML =
      '<div class="empty-state"><div class="icon">⚠️</div><h3>数据加载失败</h3><p>请检查 data.json 文件是否存在</p></div>';
  });

function init() {
  document.getElementById('updateDate').textContent = new Date().toISOString().slice(0, 10);
  renderSidebar();
  renderStats();
  selectSection(0);
  bindEvents();
}

// --- 渲染侧栏 ---
function renderSidebar() {
  var nav = document.getElementById('sidebarNav');
  DATA.forEach(function(s, i) {
    var label = s.heading.replace(/^#+\s*/, '');
    var div = document.createElement('div');
    div.className = 'nav-item' + (i === 0 ? ' active' : '');
    div.innerHTML = '<span>' + escapeHtml(label) + '</span><span class="badge">' + s.data.length + '</span>';
    div.addEventListener('click', function() { selectSection(i); });
    nav.appendChild(div);
  });
}

// --- 统计 ---
function renderStats() {
  var entries = 0, links = 0;
  DATA.forEach(function(s) {
    if (s.type !== 'table') return;
    entries += s.data.length;
    s.data.forEach(function(row) {
      Object.keys(row).forEach(function(k) {
        if (row[k].links) links += row[k].links.length;
      });
    });
  });
  document.getElementById('totalEntries').textContent = entries;
  document.getElementById('totalSections').textContent = DATA.length;
  document.getElementById('totalLinks').textContent = links;
}

// --- 选中分类 ---
function selectSection(idx) {
  activeIdx = idx;
  $$('.nav-item').forEach(function(el, i) { el.classList.toggle('active', i === idx); });
  renderSection(DATA[idx]);
  sidebar.classList.remove('open');
  overlay.classList.remove('show');
}

// --- 渲染分类卡片 ---
function renderSection(section) {
  if (!section || section.type !== 'table') return;
  var label = section.heading.replace(/^#+\s*/, '');
  var html = '<div class="section-title">' + escapeHtml(label) + ' <span class="count">' + section.data.length + ' 项</span></div>';
  html += '<div class="card-grid">';

  section.data.forEach(function(row) {
    var keys = Object.keys(row);
    var name = row[keys[0]] ? row[keys[0]].text : '';
    var desc = keys.length > 2 && row[keys[2]] ? row[keys[2]].text : '';
    var links = [];
    Object.keys(row).forEach(function(k) {
      if (row[k].links) {
        row[k].links.forEach(function(l) {
          if (l.url && !links.some(function(x) { return x.url === l.url; })) links.push(l);
        });
      }
    });

    var emojis = name.match(/[\u{1F000}-\u{1FFFF}]|[\u{2600}-\u{27BF}]|[\u{2700}-\u{27BF}]|[\u{FE00}-\u{FE0F}]|[\u{200D}]|[⭐💎🚀🎧🌈👚🍉📱⚡️💪💰🔗📨🤖🎮🎯🔥💯✅❌❗️]/gu) || [];
    var cleanName = name.replace(/[\u{1F000}-\u{1FFFF}]|[\u{2600}-\u{27BF}]|[\u{2700}-\u{27BF}]|[\u{FE00}-\u{FE0F}]|[\u{200D}]|[⭐💎🚀🎧🌈👚🍉📱⚡️💪💰🔗📨🤖🎮🎯🔥💯✅❌❗️]/gu, '').trim();

    html += '<div class="card">';
    html += '<div class="card-name">' + (emojis.length ? emojis.join('') + ' ' : '') + escapeHtml(cleanName || name) + '</div>';

    if (links.length) {
      html += '<div class="card-links">';
      links.forEach(function(l) {
        var display = l.text.length > 35 ? l.text.substring(0, 33) + '…' : l.text;
        var isTg = l.url.indexOf('t.me') > -1 || l.url.indexOf('telegram.me') > -1;
        html += '<a href="' + l.url + '" target="_blank" rel="noopener" class="card-link">' + (isTg ? '📨' : '🔗') + ' ' + escapeHtml(display) + '</a>';
      });
      html += '</div>';
    }

    if (desc) {
      var shortDesc = desc.length > 250 ? desc.substring(0, 247) + '…' : desc;
      html += '<div class="card-desc">' + escapeHtml(shortDesc) + '</div>';
    }

    html += '</div>';
  });

  html += '</div>';
  document.getElementById('content').innerHTML = html;
}

// --- 搜索 ---
function doSearch(q) {
  q = q.trim().toLowerCase();
  if (!q) {
    filteredData = null;
    selectSection(activeIdx);
    return;
  }

  filteredData = [];
  DATA.forEach(function(s) {
    if (s.type !== 'table') return;
    var matched = s.data.filter(function(row) {
      return Object.keys(row).some(function(k) {
        var text = (row[k].text || '').toLowerCase();
        var linkText = (row[k].links || []).map(function(l) { return (l.text + ' ' + l.url).toLowerCase(); }).join(' ');
        return text.indexOf(q) > -1 || linkText.indexOf(q) > -1;
      });
    });
    if (matched.length) {
      filteredData.push({ heading: s.heading, type: 'table', headers: s.headers, data: matched });
    }
  });

  $$('.nav-item').forEach(function(el) { el.classList.remove('active'); });

  if (!filteredData.length) {
    document.getElementById('content').innerHTML =
      '<div class="empty-state"><div class="icon">🔍</div><h3>未找到匹配结果</h3><p>试试其他关键词</p></div>';
    return;
  }

  var html = '';
  filteredData.forEach(function(s) {
    var label = s.heading.replace(/^#+\s*/, '');
    html += '<div class="section-title">' + escapeHtml(label) + ' <span class="count">' + s.data.length + ' 项</span></div>';
    html += '<div class="card-grid">';
    s.data.forEach(function(row) {
      var keys = Object.keys(row);
      var name = row[keys[0]] ? row[keys[0]].text : '';
      var desc = keys.length > 2 && row[keys[2]] ? row[keys[2]].text : '';
      var links = [];
      Object.keys(row).forEach(function(k) {
        if (row[k].links) {
          row[k].links.forEach(function(l) {
            if (l.url && !links.some(function(x) { return x.url === l.url; })) links.push(l);
          });
        }
      });
      var emojis = name.match(/[\u{1F000}-\u{1FFFF}]|[\u{2600}-\u{27BF}]|[\u{2700}-\u{27BF}]|[\u{FE00}-\u{FE0F}]|[\u{200D}]|[⭐💎🚀🎧🌈👚🍉📱⚡️💪💰🔗📨🤖🎮🎯🔥💯✅❌❗️]/gu) || [];
      var cleanName = name.replace(/[\u{1F000}-\u{1FFFF}]|[\u{2600}-\u{27BF}]|[\u{2700}-\u{27BF}]|[\u{FE00}-\u{FE0F}]|[\u{200D}]|[⭐💎🚀🎧🌈👚🍉📱⚡️💪💰🔗📨🤖🎮🎯🔥💯✅❌❗️]/gu, '').trim();
      html += '<div class="card">';
      html += '<div class="card-name">' + (emojis.length ? emojis.join('') + ' ' : '') + escapeHtml(cleanName || name) + '</div>';
      if (links.length) {
        html += '<div class="card-links">';
        links.forEach(function(l) {
          var display = l.text.length > 35 ? l.text.substring(0, 33) + '…' : l.text;
          var isTg = l.url.indexOf('t.me') > -1 || l.url.indexOf('telegram.me') > -1;
          html += '<a href="' + l.url + '" target="_blank" rel="noopener" class="card-link">' + (isTg ? '📨' : '🔗') + ' ' + escapeHtml(display) + '</a>';
        });
        html += '</div>';
      }
      if (desc) {
        html += '<div class="card-desc">' + escapeHtml(desc.length > 250 ? desc.substring(0, 247) + '…' : desc) + '</div>';
      }
      html += '</div>';
    });
    html += '</div>';
  });
  document.getElementById('content').innerHTML = html;
}

// --- 工具函数 ---
function escapeHtml(t) {
  if (typeof t !== 'string') return '';
  var d = document.createElement('div');
  d.textContent = t;
  return d.innerHTML;
}

// --- 事件绑定 ---
function bindEvents() {
  var searchInput = document.getElementById('searchInput');
  var timer = null;
  searchInput.addEventListener('input', function() {
    clearTimeout(timer);
    var self = this;
    timer = setTimeout(function() { doSearch(self.value); }, 200);
  });

  var backTop = document.getElementById('backTop');
  window.addEventListener('scroll', function() {
    backTop.classList.toggle('visible', window.pageYOffset > 400);
  });
  backTop.addEventListener('click', function() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  var menuToggle = document.getElementById('menuToggle');
  var sidebar = document.getElementById('sidebar');
  var overlay = document.getElementById('overlay');
  menuToggle.addEventListener('click', function() {
    sidebar.classList.toggle('open');
    overlay.classList.toggle('show');
  });
  overlay.addEventListener('click', function() {
    sidebar.classList.remove('open');
    overlay.classList.remove('show');
  });
}
// Trigger Pages rebuild
// Trigger Pages rebuild
