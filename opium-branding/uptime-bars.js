(function () {
  "use strict";
  var OWNER = "luizbmartins";
  var REPO = "opium-status";
  var BASE = "https://raw.githubusercontent.com/" + OWNER + "/" + REPO + "/master/history/";

  var FILTERS = [
    { key: "hora", label: "Last hour" },
    { key: "dia", label: "Last 24h" },
    { key: "mes", label: "Last 30 days" },
  ];
  var current = "dia";

  function fetchJson(url) {
    return fetch(url, { cache: "no-store" }).then(function (r) {
      if (!r.ok) throw new Error("http " + r.status);
      return r.json();
    });
  }

  function pad(n) { return n < 10 ? "0" + n : "" + n; }
  function dateKey(d) {
    return d.getUTCFullYear() + "-" + pad(d.getUTCMonth() + 1) + "-" + pad(d.getUTCDate());
  }

  // Retorna lista de {status: 'up'|'down'|'degraded'|'none', title}
  function barsHora(recent) {
    var cutoff = Date.now() - 60 * 60 * 1000;
    var pts = (recent || []).filter(function (p) { return new Date(p.t).getTime() > cutoff; });
    return pts.map(function (p) {
      var t = new Date(p.t);
      return {
        status: p.up ? "up" : "down",
        title: t.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }) + " — " + (p.up ? "operational" : "down"),
      };
    });
  }

  function barsDia(hourly) {
    var now = new Date();
    var buckets = {};
    (hourly || []).forEach(function (b) { buckets[b.h] = b; });
    var out = [];
    for (var i = 23; i >= 0; i--) {
      var d = new Date(now);
      d.setUTCMinutes(0, 0, 0);
      d.setUTCHours(d.getUTCHours() - i);
      var key = d.toISOString();
      var b = buckets[key];
      var status = "none";
      if (b) {
        if (b.down === 0) status = "up";
        else if (b.up === 0) status = "down";
        else status = "degraded";
      }
      out.push({
        status: status,
        title: d.toLocaleString("en-US", { day: "2-digit", month: "2-digit", hour: "2-digit" }) + "h — " +
          (status === "up" ? "operational" : status === "down" ? "down" : status === "degraded" ? "degraded" : "no data"),
      });
    }
    return out;
  }

  function barsMes(daily) {
    var now = new Date();
    var buckets = {};
    (daily || []).forEach(function (b) { buckets[b.d] = b; });
    var out = [];
    for (var i = 29; i >= 0; i--) {
      var d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - i));
      var key = dateKey(d);
      var b = buckets[key];
      var status = "none";
      if (b) {
        if (b.down === 0) status = "up";
        else if (b.up === 0) status = "down";
        else status = "degraded";
      }
      out.push({
        status: status,
        title: d.toLocaleDateString("en-US") + " — " +
          (status === "up" ? "operational" : status === "down" ? "down all day" : status === "degraded" ? "degraded" : "no data"),
      });
    }
    return out;
  }

  // Tooltip customizado (nao usamos o "title" nativo do navegador porque ele
  // nao aparece de forma confiavel no toque em mobile). Um unico elemento
  // reaproveitado pra todas as barras.
  var tooltipEl = null;
  var activeBar = null;

  function ensureTooltip() {
    if (!tooltipEl) {
      tooltipEl = document.createElement("div");
      tooltipEl.className = "opium-bar-tooltip";
      document.body.appendChild(tooltipEl);
    }
    return tooltipEl;
  }

  function hideTooltip() {
    if (activeBar) activeBar.classList.remove("is-active");
    activeBar = null;
    if (tooltipEl) tooltipEl.classList.remove("visible");
  }

  function showTooltip(bar) {
    var tip = ensureTooltip();
    tip.textContent = bar.getAttribute("data-tip") || "";
    tip.classList.add("visible");

    var rect = bar.getBoundingClientRect();
    var tipRect = tip.getBoundingClientRect();
    var left = rect.left + rect.width / 2 - tipRect.width / 2;
    left = Math.max(6, Math.min(left, window.innerWidth - tipRect.width - 6));
    tip.style.left = left + "px";
    tip.style.top = Math.max(6, rect.top - tipRect.height - 8) + "px";

    if (activeBar && activeBar !== bar) activeBar.classList.remove("is-active");
    activeBar = bar;
    bar.classList.add("is-active");
  }

  // Delegado no document: cobre barras recriadas a cada troca de filtro.
  document.addEventListener("mouseover", function (e) {
    var bar = e.target.closest && e.target.closest(".opium-bar");
    if (bar) showTooltip(bar);
  });
  document.addEventListener("mouseout", function (e) {
    var bar = e.target.closest && e.target.closest(".opium-bar");
    if (bar && bar === activeBar) hideTooltip();
  });
  document.addEventListener("click", function (e) {
    var bar = e.target.closest && e.target.closest(".opium-bar");
    if (bar) {
      showTooltip(bar);
      e.stopPropagation();
    } else {
      hideTooltip();
    }
  });

  function renderBars(container, bars) {
    hideTooltip();
    container.innerHTML = "";
    bars.forEach(function (b) {
      var el = document.createElement("span");
      el.className = "opium-bar opium-bar-" + b.status;
      el.setAttribute("data-tip", b.title);
      container.appendChild(el);
    });
  }

  function buildRow(site) {
    var row = document.createElement("div");
    row.className = "opium-uptime-row";

    var head = document.createElement("div");
    head.className = "opium-uptime-head";
    var icon = document.createElement("img");
    icon.className = "opium-uptime-icon";
    icon.alt = "";
    icon.src = site.icon || "";
    // Linhas de API/backend nao viram link publico -- so a URL do produto
    // (Platform) faz sentido clicar a partir de uma pagina de status publica.
    var isApiEndpoint = !!(site.url && site.url.indexOf("/api/") !== -1);
    var name = document.createElement(isApiEndpoint ? "span" : "a");
    name.className = "opium-uptime-name";
    name.textContent = site.name;
    if (!isApiEndpoint) {
      name.href = site.url && site.url.indexOf("$") !== 0 ? site.url : "#";
    }
    var tag = document.createElement("span");
    tag.className = "tag " + site.status;
    tag.textContent = site.status === "up" ? "Operational" : "Down";
    head.appendChild(icon);
    head.appendChild(name);
    head.appendChild(tag);

    var bars = document.createElement("div");
    bars.className = "opium-uptime-bars";

    row.appendChild(head);
    row.appendChild(bars);
    row._barsEl = bars;
    row._site = site;
    return row;
  }

  function update(rows) {
    rows.forEach(function (row) {
      var site = row._site;
      if (current === "hora") {
        fetchJson(BASE + site.slug + "-recent.json")
          .then(function (data) { renderBars(row._barsEl, barsHora(data)); })
          .catch(function () { renderBars(row._barsEl, []); });
      } else if (current === "dia") {
        fetchJson(BASE + site.slug + "-hourly.json")
          .then(function (data) { renderBars(row._barsEl, barsDia(data)); })
          .catch(function () { renderBars(row._barsEl, barsDia([])); });
      } else {
        fetchJson(BASE + site.slug + "-daily.json")
          .then(function (data) { renderBars(row._barsEl, barsMes(data)); })
          .catch(function () { renderBars(row._barsEl, barsMes([])); });
      }
    });
  }

  // Troca o emoji do card "All systems are operational" (ou o titulo "Active
  // Incidents", quando tem algo fora do ar) por um LED de verdade (mesmo
  // glow das barras), calculado a partir do status real de cada site em vez
  // de confiar só no texto -- o template do Upptime so tem string pronta pro
  // caso "tudo ok"; sem incidente nenhuma variante "tudo fora do ar" com
  // banner proprio existe, so essa lista de incidentes ativos.
  function decorateStatusBanner(main, sites) {
    var allDown = sites.length > 0 && sites.every(function (s) { return s.status !== "up"; });
    var anyDown = sites.some(function (s) { return s.status !== "up"; });
    var overall = allDown ? "down" : anyDown ? "degraded" : "up";

    function run() {
      var all = main.querySelectorAll("*");
      for (var i = 0; i < all.length; i++) {
        var el = all[i];
        if (
          el.children.length === 0 &&
          el.textContent &&
          /All systems are operational|Active Incidents/.test(el.textContent)
        ) {
          var stripped = el.textContent.replace(/^[\p{Extended_Pictographic}️\s]+/u, "");
          el.textContent = "";
          var led = document.createElement("span");
          led.className = "opium-led opium-led-" + overall;
          el.appendChild(led);
          el.appendChild(document.createTextNode(" " + stripped));
          return;
        }
      }
    }
    run();
    new MutationObserver(run).observe(main, { childList: true, subtree: true });
  }

  // Esconde secoes cujo titulo (h1/h2/h3) bate com o texto dado. O conteudo
  // (ex: "Past Incidents") so entra no DOM depois da hidratacao do Svelte,
  // entao observamos mudancas em vez de so checar uma vez no load.
  function hideSectionByHeading(main, text) {
    function run() {
      var heads = main.querySelectorAll("h1, h2, h3");
      for (var i = 0; i < heads.length; i++) {
        if (heads[i].textContent.trim() === text) {
          var sec = heads[i].closest("section") || heads[i].parentElement;
          if (sec) sec.style.display = "none";
        }
      }
    }
    run();
    new MutationObserver(run).observe(main, { childList: true, subtree: true });
  }

  // O rodape do Upptime nao e HTML estatico: o client bundle monta
  // "This page is [open source]($REPO), powered by [Upptime](...)" via JS
  // depois que a pagina carrega -- por isso o sed no site.yml (que so mexe no
  // HTML exportado) nunca resolvia de verdade, so limpava o que o curl via.
  // Aqui removemos o link "open source" (+ a virgula que sobra) direto do DOM
  // depois que o Svelte monta o rodape.
  function stripOpenSourceFooterLink() {
    function run() {
      var link = document.querySelector('footer a[href*="github.com/luizbmartins/opium-status"]');
      if (!link) return;
      var next = link.nextSibling;
      if (next && next.nodeType === Node.TEXT_NODE) {
        next.textContent = next.textContent.replace(/^,\s*/, "");
      }
      link.remove();
    }
    run();
    new MutationObserver(run).observe(document.body, { childList: true, subtree: true });
  }

  function init() {
    var main = document.querySelector("main.container");
    if (!main) return;

    stripOpenSourceFooterLink();

    // "Past Incidents": historico de issues do GitHub, nao interessa pro
    // publico geral do status page.
    hideSectionByHeading(main, "Past Incidents");

    var wrap = document.createElement("section");
    wrap.className = "opium-uptime-widget";

    var titleRow = document.createElement("div");
    titleRow.className = "opium-uptime-titlerow";
    var h2 = document.createElement("h2");
    h2.textContent = "Availability";
    var tabs = document.createElement("div");
    tabs.className = "opium-uptime-tabs";
    FILTERS.forEach(function (f) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = f.label;
      btn.className = "opium-uptime-tab" + (f.key === current ? " active" : "");
      btn.addEventListener("click", function () {
        current = f.key;
        Array.prototype.forEach.call(tabs.children, function (c) { c.classList.remove("active"); });
        btn.classList.add("active");
        update(rows);
      });
      tabs.appendChild(btn);
    });
    titleRow.appendChild(h2);
    titleRow.appendChild(tabs);
    wrap.appendChild(titleRow);

    var rows = [];
    fetchJson(BASE + "summary.json")
      .then(function (sites) {
        sites.forEach(function (site) {
          var row = buildRow(site);
          rows.push(row);
          wrap.appendChild(row);
        });
        update(rows);
        decorateStatusBanner(main, sites);
      })
      .catch(function () {
        var p = document.createElement("p");
        p.textContent = "Could not load availability data right now.";
        wrap.appendChild(p);
      });

    // Insere o widget "Availability" (LEDs) logo antes do "Live Status"
    // nativo (grafico de tempo de resposta + uptime%) -- os dois ficam
    // visiveis, resumo rapido em cima, grafico detalhado embaixo.
    var liveStatusSection = document.querySelector("section.live-status");
    if (liveStatusSection && liveStatusSection.parentNode) {
      liveStatusSection.parentNode.insertBefore(wrap, liveStatusSection);
    } else {
      main.appendChild(wrap);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
