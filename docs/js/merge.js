// docs/js/merge.js
// Append post-cutoff months from /data/summary.json to the dashboard.
// Purely additive — does not modify the original `data` array. Re-renders
// footer, breakdown sidebar, bar chart, and the two header strings off a
// merged copy. Silent fail if summary.json is missing or malformed.
//
// summary.json is written by scripts/ap_dashboard_sync.py in the
// project-help-collections repo. Historical months (Jul'25 through Mar'26)
// are NOT in summary.json — they remain hard-coded in index.html and are
// the source of truth for those numbers.

(function () {
  if (typeof data === "undefined" || typeof fmt === "undefined") return;

  var MONTH_NAMES = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];

  function ymToShortLabel(ym) {
    var p = ym.split("-");
    return MONTH_NAMES[parseInt(p[1], 10) - 1].slice(0, 3) + " " + p[0]; // "Apr 2026"
  }

  function ymToFullLabel(ym) {
    var p = ym.split("-");
    return MONTH_NAMES[parseInt(p[1], 10) - 1] + " " + p[0]; // "April 2026"
  }

  function ymToPeriod(ym) {
    var p = ym.split("-");
    var y = parseInt(p[0], 10);
    var m = parseInt(p[1], 10);
    var days = new Date(y, m, 0).getDate();
    return "1–" + days + " " + MONTH_NAMES[m - 1] + " " + y;
  }

  function jsonEntryToRow(e) {
    return {
      month: ymToShortLabel(e.month),
      collected: e.net,
      failed: null, // unknown — render as em-dash
      total: e.net, // decision: use net for "Total Loaded" on JSON-sourced rows
      sAmt: e.single_commission,
      fAmt: e.family_commission,
      collection: e.total_commission,
      period: ymToPeriod(e.month),
      single: e.singles,
      family: e.families,
      _ym: e.month,
      _fromJson: true,
    };
  }

  function appendTableRow(d) {
    var tb = document.getElementById("tableBody");
    var tr = document.createElement("tr");

    var tdM = document.createElement("td");
    var mDiv = document.createElement("div");
    mDiv.className = "td-month";
    var pip = document.createElement("span");
    pip.className = "mpip paid-pip";
    mDiv.appendChild(pip);
    mDiv.appendChild(document.createTextNode(d.month));
    tdM.appendChild(mDiv);

    var tdC = document.createElement("td");
    tdC.style.cssText = "text-align:right;font-weight:600;color:var(--green)";
    tdC.textContent = d.collected;

    var tdFl = document.createElement("td");
    if (d.failed !== null && d.failed > 0) {
      tdFl.style.cssText = "text-align:right;font-weight:600;color:var(--orange)";
      tdFl.textContent = d.failed;
    } else {
      tdFl.style.cssText = "text-align:right;color:var(--dim)";
      tdFl.textContent = "—";
    }

    var tdT = document.createElement("td");
    tdT.className = "td-num";
    tdT.textContent = d.total;

    var tdA = document.createElement("td");
    tdA.className = "td-amt";
    tdA.textContent = fmt(d.collection);

    var tdSt = document.createElement("td");
    var acts = document.createElement("div");
    acts.className = "td-actions";
    var badge = document.createElement("span");
    badge.className = "badge badge-paid";
    badge.textContent = "Paid";
    acts.appendChild(badge);
    // Decision: no "Data" button on JSON-sourced rows — no per-member detail.
    tdSt.appendChild(acts);

    tr.appendChild(tdM);
    tr.appendChild(tdC);
    tr.appendChild(tdFl);
    tr.appendChild(tdT);
    tr.appendChild(tdA);
    tr.appendChild(tdSt);
    tb.appendChild(tr);
  }

  function rerenderFooter(merged) {
    var totMem = merged.reduce(function (s, d) { return s + (d.collected || 0); }, 0);
    var totFail = merged.reduce(function (s, d) { return s + (d.failed || 0); }, 0);
    var totLoad = merged.reduce(function (s, d) { return s + (d.total || 0); }, 0);
    var totC = merged.reduce(function (s, d) { return s + (d.collection || 0); }, 0);
    document.getElementById("fs").textContent = totMem + " collected";
    document.getElementById("ff").textContent = totFail + " unsuccessful";
    document.getElementById("fm").textContent = totLoad + " total";
    document.getElementById("fa").textContent = fmt(totC);
  }

  function rerenderBreakdown(merged) {
    var bl = document.getElementById("breakdownList");
    if (!bl) return;
    bl.innerHTML = "";
    var maxV = Math.max.apply(null, merged.map(function (d) { return d.collection; }));
    if (!maxV) return;
    merged.forEach(function (d) {
      var pct = Math.round((d.collection / maxV) * 100);
      var div = document.createElement("div");
      div.className = "bitem";
      var mDiv = document.createElement("div");
      mDiv.className = "bmonth";
      mDiv.textContent = d.month;
      var bWrap = document.createElement("div");
      bWrap.className = "bbar-wrap";
      var bar = document.createElement("div");
      bar.className = "bbar";
      var fill = document.createElement("div");
      fill.className = "bfill";
      fill.style.cssText =
        "width:" + pct + "%;background:" + (d.collection === maxV ? "#E8192C" : "#00AEEF");
      bar.appendChild(fill);
      bWrap.appendChild(bar);
      var amt = document.createElement("div");
      amt.className = "bamt";
      amt.textContent = fmt(d.collection);
      div.appendChild(mDiv);
      div.appendChild(bWrap);
      div.appendChild(amt);
      bl.appendChild(div);
    });
  }

  function rerenderChart(merged) {
    if (typeof Chart === "undefined") return;
    var existing = Chart.getChart("barChart");
    if (existing) existing.destroy();
    new Chart(document.getElementById("barChart"), {
      type: "bar",
      data: {
        labels: merged.map(function (d) { return d.month; }),
        datasets: [
          { label: "Single", data: merged.map(function (d) { return d.sAmt; }),
            backgroundColor: "#00AEEF", borderRadius: 4, borderSkipped: false },
          { label: "Family", data: merged.map(function (d) { return d.fAmt; }),
            backgroundColor: "#E8192C", borderRadius: 4, borderSkipped: false },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: "#1B1464", borderColor: "rgba(255,255,255,0.1)",
            borderWidth: 1, titleColor: "#fff", bodyColor: "#a0adc8", padding: 10,
            callbacks: { label: function (ctx) { return " " + ctx.dataset.label + ": " + fmt(ctx.parsed.y); } },
          },
        },
        scales: {
          x: { stacked: true,
               ticks: { color: "#9aa3c2", font: { size: 11, family: "Barlow" }, autoSkip: false, maxRotation: 30 },
               grid: { color: "rgba(27,20,100,0.06)" }, border: { color: "#e2e6f0" } },
          y: { stacked: true,
               ticks: { color: "#9aa3c2", font: { size: 11 },
                        callback: function (v) { return "R " + Math.round(v / 1000) + "k"; } },
               grid: { color: "rgba(27,20,100,0.06)" }, border: { color: "#e2e6f0" } },
        },
      },
    });
  }

  function updateHeaderText(merged) {
    var latest = merged[merged.length - 1];
    var latestFull = latest._ym
      ? ymToFullLabel(latest._ym)
      : latest.month; // historical labels are already "Mar 2026" — fine as a fallback
    var hbarItems = document.querySelectorAll(".hbar-item");
    hbarItems.forEach(function (item) {
      if (item.innerHTML.indexOf("Commission period:") !== -1) {
        var strong = item.querySelector("strong");
        if (strong) strong.innerHTML = "July 2025 &ndash; " + latestFull;
      } else if (/\d+\s+months\s+tracked/i.test(item.textContent)) {
        item.textContent = merged.length + " months tracked";
      }
    });
  }

  fetch("data/summary.json?v=" + Date.now())
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (payload) {
      if (!payload || !Array.isArray(payload.monthly) || payload.monthly.length === 0) return;
      var existingLabels = {};
      data.forEach(function (d) { existingLabels[d.month] = true; });
      var newRows = payload.monthly
        .map(jsonEntryToRow)
        .filter(function (r) { return !existingLabels[r.month]; });
      if (newRows.length === 0) return;
      newRows.forEach(appendTableRow);
      var merged = data.concat(newRows);
      rerenderFooter(merged);
      rerenderBreakdown(merged);
      rerenderChart(merged);
      updateHeaderText(merged);
    })
    .catch(function () { /* silent fail — page renders as today */ });
})();
