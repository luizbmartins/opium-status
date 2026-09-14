(function () {
  "use strict";
  var OWNER = "luizbmartins";
  var REPO = "opium-status";
  var BASE = "https://raw.githubusercontent.com/" + OWNER + "/" + REPO + "/master/history/";

  var FILTERS = [
    { key: "hora", label: "Última hora" },
    { key: "dia", label: "Últimas 24h" },
    { key: "mes", label: "Últimos 30 dias" },
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
        title: t.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) + " — " + (p.up ? "operacional" : "fora do ar"),
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
        title: d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit" }) + "h — " +
          (status === "up" ? "operacional" : status === "down" ? "fora do ar" : status === "degraded" ? "instabilidade" : "sem dado"),
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
        title: d.toLocaleDateString("pt-BR") + " — " +
          (status === "up" ? "operacional" : status === "down" ? "fora do ar o dia todo" : status === "degraded" ? "instabilidade" : "sem dado"),
      });
    }
    return out;
  }

  function renderBars(container, bars) {
    container.innerHTML = "";
    bars.forEach(function (b) {
      var el = document.createElement("span");
      el.className = "opium-bar opium-bar-" + b.status;
      el.title = b.title;
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
    var name = document.createElement("a");
    name.className = "opium-uptime-name";
    name.textContent = site.name;
    name.href = site.url && site.url.indexOf("$") !== 0 ? site.url : "#";
    var tag = document.createElement("span");
    tag.className = "tag " + site.status;
    tag.textContent = site.status === "up" ? "Operacional" : "Fora do ar";
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
    h2.textContent = "Disponibilidade";
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
      })
      .catch(function () {
        var p = document.createElement("p");
        p.textContent = "Não foi possível carregar os dados de disponibilidade agora.";
        wrap.appendChild(p);
      });

    var liveStatusSection = document.querySelector("section.live-status");
    if (liveStatusSection && liveStatusSection.parentNode) {
      // A secao padrao "Live Status" (titulo + filtros 24h/7d/30d/1y/all) fica
      // logo antes de section.live-status; escondemos as duas, ja que o widget
      // "Disponibilidade" acima a substitui.
      var filterRow = liveStatusSection.previousElementSibling;
      liveStatusSection.parentNode.insertBefore(wrap, liveStatusSection);
      liveStatusSection.style.display = "none";
      if (filterRow) filterRow.style.display = "none";
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
