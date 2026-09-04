const STATUS_LABEL = {
  pass: "PASS",
  progress: "PROGRESS",
  risk: "RISK",
  fail: "FAIL",
  pending: "PENDING",
  unknown: "확인 필요"
};

const DAY_NAMES = ["일", "월", "화", "수", "목", "금", "토"];

// KST (UTC+9) 기준 현재 일자의 자정(00:00:00 UTC) 타임스탬프 계산
function getKSTToday() {
  const now = new Date();
  const kstOffsetMs = 9 * 60 * 60 * 1000;
  const kstTime = new Date(now.getTime() + (now.getTimezoneOffset() * 60000) + kstOffsetMs);
  return {
    year: kstTime.getFullYear(),
    month: kstTime.getMonth(), // 0-indexed
    day: kstTime.getDate()
  };
}

function formatTargetDate(dateStr, status, allowOverdueHighlight = false, closedDateStr = null) {
  // 상태가 PASS이고 완수일(closedDate)이 전달된 경우, 완수일을 우선 표시
  const effectiveDateStr = (status === "pass" && closedDateStr) ? closedDateStr : dateStr;
  if (!effectiveDateStr) return "-";
  const str = String(effectiveDateStr).trim();

  // Match month/day (e.g. 08/28, 8/4, 09/04)
  const match = str.match(/(\d{1,2})\s*[\/.-]\s*(\d{1,2})/);
  if (match) {
    const month = parseInt(match[1], 10);
    const day = parseInt(match[2], 10);
    const kstToday = getKSTToday();
    
    // 목표 연도 설정 (기본은 KST 현재 연도, 12월에서 1월로 넘어가는 등 연말연초 처리)
    let targetYear = kstToday.year;
    if (kstToday.month === 11 && month === 1) {
      targetYear += 1;
    } else if (kstToday.month === 0 && month === 12) {
      targetYear -= 1;
    }

    const targetDateObj = new Date(targetYear, month - 1, day);
    const dayName = DAY_NAMES[targetDateObj.getDay()];
    const dateFormatted = `${month}/${day}(${dayName})`;

    // 상태가 PASS라면 D-Day 표시를 하지 않고, 완수일(pass-date) 적용
    if (status === "pass") {
      return `<span class="date-text pass-date">${dateFormatted}</span>`;
    }

    // 시간은 완전 제외하고 UTC 자정 기준 일자(Day) 단위 차이 계산
    const todayUTC = Date.UTC(kstToday.year, kstToday.month, kstToday.day);
    const targetUTC = Date.UTC(targetYear, month - 1, day);
    const diffDays = Math.round((targetUTC - todayUTC) / (1000 * 60 * 60 * 24));

    const isOverdue = allowOverdueHighlight && diffDays < 0 && status !== "pass";

    let ddayText = "";
    if (diffDays === 0) {
      ddayText = "D-Day";
    } else if (diffDays > 0) {
      ddayText = `D-${diffDays}`;
    } else {
      ddayText = `D+${Math.abs(diffDays)}`;
    }

    if (isOverdue) {
      return `<span class="date-text overdue-date">${dateFormatted}</span><span class="dday-tag overdue-dday">${ddayText}</span>`;
    }

    return `<span class="date-text">${dateFormatted}</span><span class="dday-tag">${ddayText}</span>`;
  }

  // 상시, 8월 말, 9월 초 등 일반 텍스트
  return `<span class="date-text">${str}</span>`;
}

// Dashboard State and DataStore
const data = {
  mainProjectId: "",
  summary: {},
  projects: [],
  risks: [],
  groundTruth: [],
  coverage: {},
  nextControl: { today: [], week: [], next: [] },
  mindset: []
};

async function loadDashboardData() {
  try {
    const [metaRes, projectsRes, workstreamsRes, risksRes, gtRes, mindsetRes] = await Promise.all([
      fetch("./data/meta.json"),
      fetch("./data/projects.json"),
      fetch("./data/workstreams.json"),
      fetch("./data/risks.json"),
      fetch("./data/ground_truth.json"),
      fetch("./data/mindset.json")
    ]);

    const meta = await metaRes.json();
    const rawProjects = await projectsRes.json();
    const workstreams = await workstreamsRes.json();
    const risks = await risksRes.json();
    const groundTruth = await gtRes.json();
    const mindset = await mindsetRes.json();

    // RDB JOIN logic: Projects + Workstreams
    const joinedProjects = rawProjects.map(p => {
      const pWorkstreams = workstreams.filter(ws => ws.projectId === p.id);

      return {
        ...p,
        main: p.isMain,
        execution: {
          workstreams: pWorkstreams
        }
      };
    });

    data.mainProjectId = meta.mainProjectId;
    data.summary = meta.summary;
    data.coverage = meta.coverage;
    data.nextControl = meta.nextControl;
    data.projects = joinedProjects;
    data.risks = risks;
    data.groundTruth = groundTruth;
    data.mindset = mindset;

    return true;
  } catch (err) {
    console.error("Failed to load JSON database tables:", err);
    return false;
  }
}

let selectedProjectId = null; // 기본 선택된 프로젝트 없음
let currentMode = "level2"; // 기본 모드: 2단계 모드
let workstreamStatusFilter = "pending"; // 기본 필터: 'pending' (미완료). 옵션: 'pending' (미완료), 'completed' (완료)
const expandedRiskIndices = new Set();
const expandedTruthIndices = new Set();
const expandedWorkstreamKeys = new Set();

const $ = (selector) => document.querySelector(selector);

function statusHTML(status, label = STATUS_LABEL[status]) {
  return `<span class="status ${status}"><span class="status-dot"></span>${label}</span>`;
}

function progressHTML(progress) {
  if (typeof progress !== "number") {
    return `
      <div class="progress-wrap">
        <div class="progress-track unknown" title="문서에서 신뢰 가능한 진행률 %를 확인할 수 없음"></div>
        <span class="progress-value">N/A</span>
      </div>`;
  }
  return `
    <div class="progress-wrap">
      <div class="progress-track">
        <div class="progress-fill" style="--progress:${Math.max(0, Math.min(100, progress))}%"></div>
      </div>
      <span class="progress-value">${progress}%</span>
    </div>`;
}

function setMode(mode) {
  currentMode = mode;
  document.body.className = `mode-${mode}`;
  const btn1 = $("#btnModeLevel1");
  const btn2 = $("#btnModeLevel2");
  if (btn1) btn1.classList.toggle("active", mode === "level1");
  if (btn2) btn2.classList.toggle("active", mode === "level2");
}



function parseTargetDateScore(dateStr) {
  if (!dateStr) return Infinity;
  const str = String(dateStr).trim();
  if (str.includes("상시")) return Infinity;

  const m1 = str.match(/(\d{1,2})\s*[\/.-]\s*(\d{1,2})/);
  if (m1) {
    return parseInt(m1[1], 10) * 100 + parseInt(m1[2], 10);
  }
  const m2 = str.match(/(\d{1,2})월\s*(초|중순|말)?/);
  if (m2) {
    const month = parseInt(m2[1], 10);
    const pos = m2[2];
    if (pos === "초") return month * 100 + 5;
    if (pos === "중순") return month * 100 + 15;
    if (pos === "말") return month * 100 + 31;
    return month * 100 + 1;
  }
  return 9999;
}

// 2. RESEARCH PORTFOLIO: [프로젝트 | 목표일 | 상태 | 진행도] + 클릭 시 Workstream 목록 확장
function renderPortfolio() {
  // 'RESEARCH PORTFOLIO' 정렬 순서: 목표일과 관계없이 고정 우선순위 적용
  // 1. smart-hanger > 2. ax-it > 3. agritech > 4. org
  const PROJECT_ORDER = ["smart-hanger", "ax-it", "agritech", "org"];
  const sortedProjects = [...data.projects].sort((a, b) => {
    const orderA = PROJECT_ORDER.indexOf(a.id);
    const orderB = PROJECT_ORDER.indexOf(b.id);
    return (orderA !== -1 ? orderA : 99) - (orderB !== -1 ? orderB : 99);
  });

  const rows = sortedProjects.map(project => {
    const selected = project.id === selectedProjectId;
    const allWorkstreams = project.execution?.workstreams || [];
    const pendingCount = allWorkstreams.filter(ws => ws.status !== "pass").length;
    const completedCount = allWorkstreams.filter(ws => ws.status === "pass").length;

    // workstreamStatusFilter 기준 필터링: 'pending'(미완료: status !== 'pass'), 'completed'(완료: status === 'pass')
    const filteredWorkstreams = allWorkstreams.filter(ws => {
      if (workstreamStatusFilter === "completed") {
        return ws.status === "pass";
      }
      return ws.status !== "pass";
    });

    const sortedWorkstreams = [...filteredWorkstreams].sort((a, b) => {
      const dateA = (a.status === "pass" && a.closedDate) ? a.closedDate : a.targetDate;
      const dateB = (b.status === "pass" && b.closedDate) ? b.closedDate : b.targetDate;
      return parseTargetDateScore(dateA) - parseTargetDateScore(dateB);
    });

    const workstreamRowsHTML = sortedWorkstreams.length > 0 ? sortedWorkstreams.map((ws, wsIdx) => {
      const key = `${project.id}_${ws.id || wsIdx}`;
      const isWsExpanded = expandedWorkstreamKeys.has(key);
      const isPass = ws.status === "pass";
      return `
        <div class="workstream-row ${isWsExpanded ? "expanded" : ""} ${isPass ? "status-pass-row" : ""}" data-ws-key="${key}" aria-expanded="${isWsExpanded}">
          <div class="workstream-main" role="button" tabindex="0" data-ws-toggle="${key}" aria-label="${ws.name} 상세 토글">
            <div class="workstream-name col-name ${isPass ? "pass-title" : ""}">
              <span class="expand-icon" aria-hidden="true">${isWsExpanded ? "▾" : "▸"}</span>
              <strong>${ws.name}</strong>
            </div>
            <div class="workstream-target-date col-target-date">${formatTargetDate(ws.targetDate, ws.status, true, ws.closedDate)}</div>
            <div class="col-status">${statusHTML(ws.status)}</div>
            <div class="col-progress">${progressHTML(ws.progress)}</div>
          </div>
          ${isWsExpanded ? `
            <div class="workstream-expanded-details">
              ${ws.goal ? `
                <div class="ws-detail-block">
                  <div class="ws-goal">${ws.goal}</div>
                  <div class="ws-scope">${ws.scope}</div>
                  ${ws.closedDate ? `
                    <div class="ws-closed-date">
                      <span class="closed-date-badge">완수일</span>
                      <strong class="closed-date-value">${ws.closedDate} 완수</strong>
                    </div>
                  ` : ""}
                  ${ws.criteria && ws.criteria.length > 0 ? `
                    <ul class="ws-criteria">
                      ${ws.criteria.map(c => `<li>${c}</li>`).join("")}
                    </ul>
                  ` : ""}
                  ${ws.links && ws.links.length > 0 ? `
                    <div class="ws-links-block">
                      <span class="ws-links-title">관련 링크</span>
                      <ul class="ws-links-list">
                        ${ws.links.map(link => {
                          const href = typeof link === "string" ? link : (link.url || link.href || "#");
                          const title = typeof link === "string" ? link : (link.title || link.name || href);
                          return `
                            <li>
                              <a href="${href}" target="_blank" rel="noopener noreferrer" class="ws-link-item" title="${title}">
                                <span class="ws-link-icon">🔗</span>
                                <span>${title}</span>
                              </a>
                            </li>
                          `;
                        }).join("")}
                      </ul>
                    </div>
                  ` : ""}
                  ${ws.next ? `
                    <div class="ws-status-divider"></div>
                    <div class="ws-current-status">
                      <span class="ws-status-icon" aria-hidden="true">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                          <line x1="5" y1="12" x2="19" y2="12"></line>
                          <polyline points="12 5 19 12 12 19"></polyline>
                        </svg>
                      </span>
                      <p class="ws-status-text">${ws.next}</p>
                    </div>
                  ` : ""}
                </div>
              ` : `
                <div class="ws-current-status">
                  <span class="ws-status-icon" aria-hidden="true">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                      <line x1="5" y1="12" x2="19" y2="12"></line>
                      <polyline points="12 5 19 12 12 19"></polyline>
                    </svg>
                  </span>
                  <p class="ws-status-text">${ws.next}</p>
                </div>
              `}
            </div>
          ` : ""}
        </div>
      `;
    }).join("") : `
      <div class="ws-empty-state">
        <p>${workstreamStatusFilter === "completed" ? "완료된 Workstream이 없습니다." : "진행 중인 미완료 Workstream이 없습니다."}</p>
      </div>
    `;

    return `
      <div class="portfolio-row ${selected ? "selected" : ""}" data-project-id="${project.id}">
        <div class="portfolio-row-inner" role="button" tabindex="0"
             data-project-toggle="${project.id}" aria-label="${project.name} 상세 보기" aria-expanded="${selected}">
          <div class="project-name col-name">
            ${project.main ? `<span class="main-label">MAIN PROJECT</span>` : ""}
            <strong>${project.name}</strong>
            <small>${project.target}</small>
            ${project.bottleneck ? `
              <div class="portfolio-bottleneck-badge">
                <span class="bn-text">${project.bottleneck}</span>
              </div>
            ` : ""}
          </div>
          <div class="portfolio-target-date col-target-date">${formatTargetDate(project.targetDate, project.status, false, project.closedDate)}</div>
          <div class="col-status">${statusHTML(project.status)}</div>
          <div class="col-progress">${progressHTML(project.progress)}</div>
        </div>

        <!-- 클릭 시 확장되는 상세 영역: Workstream 목록 -->
        <div class="portfolio-expanded-content">
          <div class="portfolio-ws-section">
            <div class="portfolio-ws-head">
              <div class="portfolio-ws-head-left">
                <span class="ws-heading-title">WORKSTREAMS</span>
                <span class="ws-heading-sub">항목 클릭 시 세부 목표·기준·현황 표출</span>
              </div>
              <div class="ws-filter-segmented-control" role="group" aria-label="Workstream 완료 상태 필터">
                <button type="button" class="ws-filter-btn ${workstreamStatusFilter === "pending" ? "active" : ""}" data-ws-filter="pending" title="미완료 Workstream만 보기">
                  <span>미완료</span>
                  <span class="ws-filter-count">(${pendingCount})</span>
                </button>
                <button type="button" class="ws-filter-btn filter-completed ${workstreamStatusFilter === "completed" ? "active" : ""}" data-ws-filter="completed" title="완료(PASS) Workstream만 보기">
                  <span>완료</span>
                  <span class="ws-filter-count">(${completedCount})</span>
                </button>
              </div>
            </div>
            <div class="workstream-table">
              <div class="workstream-row workstream-head" role="row">
                <div class="workstream-main">
                  <span class="col-name">Workstream</span>
                  <span class="col-target-date">${workstreamStatusFilter === "completed" ? "완수일" : "목표일"}</span>
                  <span class="col-status">상태</span>
                  <span class="col-progress">진행도</span>
                </div>
              </div>
              <div class="portfolio-workstream-list">${workstreamRowsHTML}</div>
            </div>
          </div>
        </div>
      </div>
    `;
  }).join("");

  $("#portfolioRows").innerHTML = rows;

  // Portfolio 상단 헤더(.portfolio-row-inner) 클릭 시에만 프로젝트 확장/축소 토글
  document.querySelectorAll("[data-project-toggle]").forEach(headerRow => {
    const select = (e) => {
      const pid = headerRow.dataset.projectToggle;
      selectedProjectId = selectedProjectId === pid ? null : pid;
      renderPortfolio();
    };
    headerRow.addEventListener("click", select);
    headerRow.addEventListener("keydown", event => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        select(event);
      }
    });
  });

  // Workstream 미완료/완료 필터 버튼 클릭 핸들러
  document.querySelectorAll("[data-ws-filter]").forEach(filterBtn => {
    const applyFilter = (e) => {
      e.stopPropagation(); // 포트폴리오 행 클릭으로 버블링 방지
      const filterValue = filterBtn.dataset.wsFilter;
      if (workstreamStatusFilter !== filterValue) {
        workstreamStatusFilter = filterValue;
        renderPortfolio();
      }
    };
    filterBtn.addEventListener("click", applyFilter);
  });

  // Workstream 상단 헤더(축소 시에도 유지되는 .workstream-main) 클릭 시에만 아코디언 토글
  document.querySelectorAll("[data-ws-toggle]").forEach(toggleHeader => {
    const toggleWs = (e) => {
      e.stopPropagation(); // 포트폴리오 행 클릭으로 버블링 방지
      const key = toggleHeader.dataset.wsToggle;
      if (expandedWorkstreamKeys.has(key)) {
        expandedWorkstreamKeys.delete(key);
      } else {
        expandedWorkstreamKeys.add(key);
      }
      renderPortfolio();
    };
    toggleHeader.addEventListener("click", toggleWs);
    toggleHeader.addEventListener("keydown", e => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        e.stopPropagation();
        toggleWs(e);
      }
    });
  });
}

function renderRisks() {
  const el = $("#riskList");
  if (!el || !data.risks) return;
  el.innerHTML = data.risks.map((risk, idx) => {
    const isExpanded = expandedRiskIndices.has(idx);
    return `
      <article class="risk-item ${isExpanded ? "expanded" : ""}" data-risk-idx="${idx}" role="button" tabindex="0" aria-expanded="${isExpanded}">
        <div class="risk-primary">
          <div class="severity-label severity-${risk.severity}">
            <span class="status-dot"></span>${risk.severity === "critical" ? "CRITICAL" : "WARNING"}
          </div>
          <strong class="risk-title">${risk.title}</strong>
          <span class="risk-metric">${risk.metric}</span>
          <span class="expand-icon" aria-hidden="true">${isExpanded ? "▲" : "▼"}</span>
        </div>
        <div class="risk-action-preview">
          <span class="action-badge">조치</span>
          <p>${risk.action}</p>
        </div>
        ${isExpanded ? `
          <div class="risk-expanded-details">
            <div class="detail-row"><span>원인</span><p>${risk.cause}</p></div>
            <div class="detail-row"><span>영향</span><p>${risk.impact}</p></div>
            <div class="detail-row"><span>조치</span><p>${risk.action}</p></div>
            <div class="detail-row"><span>기한</span><p>${risk.deadline}</p></div>
            <div class="detail-row"><span>추천</span><p>${risk.recommendation}</p></div>
            <div class="detail-row"><span>결정</span><p>${risk.decision}</p></div>
            <div class="risk-evidence-divider"></div>
            <div class="risk-inline-evidence">
              <span class="evidence-title">근거</span>
              <div class="evidence-items">
                ${risk.evidence.map(([ref, text]) => `
                  <div class="evidence-item">
                    <strong>${ref}</strong>
                    <p>${text}</p>
                  </div>
                `).join("")}
              </div>
            </div>
          </div>
        ` : ""}
      </article>
    `;
  }).join("");

  document.querySelectorAll(".risk-item").forEach(card => {
    const toggle = () => {
      const idx = Number(card.dataset.riskIdx);
      if (expandedRiskIndices.has(idx)) {
        expandedRiskIndices.delete(idx);
      } else {
        expandedRiskIndices.add(idx);
      }
      renderRisks();
    };
    card.addEventListener("click", toggle);
    card.addEventListener("keydown", e => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        toggle();
      }
    });
  });
}

function truthBullet(row) {
  if (row.value === null || row.target === null) {
    return `
      <div class="bullet">
        <div class="progress-track unknown"></div>
        <div class="bullet-labels"><span>${row.actualText}</span><span>${row.targetText}</span></div>
      </div>`;
  }

  const scale = Math.max(row.target * 1.2, 100);
  const value = Math.max(0, Math.min(100, row.value / scale * 100));
  const target = Math.max(0, Math.min(100, row.target / scale * 100));

  return `
    <div class="bullet">
      <div class="bullet-track">
        <div class="bullet-value" style="--value:${value}%"></div>
        <div class="bullet-target" style="--target:${target}%"></div>
      </div>
      <div class="bullet-labels"><span>${row.actualText}</span><span>GT ${row.targetText}</span></div>
    </div>`;
}

function renderGroundTruth() {
  const el = $("#truthRows");
  if (!el || !data.groundTruth) return;
  el.innerHTML = data.groundTruth.map((row, idx) => {
    const isExpanded = expandedTruthIndices.has(idx);
    return `
      <div class="truth-row ${isExpanded ? "expanded" : ""}" role="button" tabindex="0" data-truth-idx="${idx}" aria-expanded="${isExpanded}">
        <div class="truth-main">
          <div class="truth-name">
            <strong>${row.name}</strong>
            <small>${row.context}</small>
          </div>
          ${truthBullet(row)}
          <div class="truth-status-col">
            ${statusHTML(row.status)}
            <span class="expand-icon" aria-hidden="true">${isExpanded ? "▲" : "▼"}</span>
          </div>
        </div>
        ${isExpanded ? `
          <div class="truth-inline-evidence">
            <div class="truth-evidence-divider"></div>
            <div class="evidence-items">
              ${row.evidence.map(([ref, text]) => `
                <div class="evidence-item">
                  <strong>${ref}</strong>
                  <p>${text}</p>
                </div>
              `).join("")}
            </div>
          </div>
        ` : ""}
      </div>
    `;
  }).join("");

  document.querySelectorAll(".truth-row").forEach(row => {
    const toggle = () => {
      const idx = Number(row.dataset.truthIdx);
      if (expandedTruthIndices.has(idx)) {
        expandedTruthIndices.delete(idx);
      } else {
        expandedTruthIndices.add(idx);
      }
      renderGroundTruth();
    };
    row.addEventListener("click", toggle);
    row.addEventListener("keydown", e => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        toggle();
      }
    });
  });
}

function renderCoverage() {
  const elRows = $("#coverageRows");
  const elExc = $("#coverageExceptions");
  if (!elRows || !elExc || !data.coverage) return;
  const c = data.coverage;
  const items = [
    ["Action 등록", c.totalActions, c.totalActions],
    ["Owner 명시", c.ownerAssigned, c.totalActions],
    ["목표/마감 필드", c.targetFieldPresent, c.totalActions],
    ["완료 명시", c.explicitCompleted, c.totalActions]
  ];

  elRows.innerHTML = items.map(([label, value, total]) => {
    const pct = Math.round(value / total * 100);
    return `
      <div class="coverage-row">
        <div class="coverage-label">${label}</div>
        <div class="coverage-number">${value} / ${total}</div>
        <div class="coverage-bar" title="${pct}%"><span style="--coverage:${pct}%"></span></div>
      </div>`;
  }).join("");

  elExc.innerHTML = `
    <div class="exception">등록 누락 <strong>0</strong> <span>(문서 Matrix 기준)</span></div>
    <div class="exception">Owner 없음 <strong>0</strong></div>
    <div class="exception">상태 미확정 <strong>${c.stateUnconfirmed}</strong></div>
    <div class="exception">완료 명시 <strong>${c.explicitCompleted}</strong></div>
    <div class="exception"><button id="coverageInfo" class="evidence-button" type="button">산정 기준</button></div>
  `;

  const btnCov = $("#coverageInfo");
  if (btnCov) {
    btnCov.addEventListener("click", () => {
      openEvidence("CONTROL COVERAGE 산정 기준", [
        ["Action Matrix", `${c.note}`],
        ["해석 제한", "과거 목표일이 지났다는 이유만으로 개별 업무를 자동 FAIL/완료 처리하지 않았습니다. 같은 업무가 후속 회의에서 갱신될 수 있기 때문에 최신 상태는 별도 확인이 필요합니다."]
      ]);
    });
  }
}

function renderNextControl() {
  const groups = [
    ["TODAY / 즉시 확인", data.nextControl.today],
    ["THIS WEEK", data.nextControl.week],
    ["NEXT", data.nextControl.next]
  ];

  $("#nextControl").innerHTML = groups.map(([title, items]) => `
    <div class="next-column">
      <h3>${title}</h3>
      ${items.map(item => `
        <div class="next-item ${item.status}">
          <span class="dot"></span>
          <span>${item.label}</span>
          <small>${item.meta}</small>
        </div>
      `).join("")}
    </div>
  `).join("");
}

function renderMindset() {
  const el = $("#mindsetList");
  if (!el || !data.mindset) return;

  el.innerHTML = `
    <div class="mindset-table">
      ${data.mindset.map((item, idx) => `
        <div class="mindset-row">
          <div class="mindset-left">원칙 0${idx + 1} · ${item.category}</div>
          <div class="mindset-right">${item.directive}</div>
        </div>
      `).join("")}
    </div>
  `;
}

function openEvidence(title, entries = []) {
  $("#evidenceTitle").textContent = title;
  $("#evidenceBody").innerHTML = entries.map(([ref, text]) => `
    <div class="evidence-entry">
      <strong>${ref}</strong>
      <p>${text}</p>
    </div>
  `).join("");
  const dialog = $("#evidenceDialog");
  if (typeof dialog.showModal === "function") dialog.showModal();
  else dialog.setAttribute("open", "open");
}

function closeEvidence() {
  const dialog = $("#evidenceDialog");
  if (typeof dialog.close === "function") dialog.close();
  else dialog.removeAttribute("open");
}

const btnL1 = $("#btnModeLevel1");
const btnL2 = $("#btnModeLevel2");

if (btnL1) btnL1.addEventListener("click", () => setMode("level1"));
if (btnL2) btnL2.addEventListener("click", () => setMode("level2"));

window.addEventListener("keydown", (e) => {
  if (e.key === "Tab" && !e.ctrlKey && !e.altKey && !e.metaKey) {
    const activeEl = document.activeElement;
    if (activeEl && (activeEl.tagName === "INPUT" || activeEl.tagName === "TEXTAREA" || activeEl.closest("#evidenceDialog"))) {
      return;
    }
    e.preventDefault();
    // Tab 키를 누를 때마다 1단계 ➔ 2단계 ➔ 1단계 순환
    if (currentMode === "level1") {
      setMode("level2");
    } else {
      setMode("level1");
    }
  }
});

const btnBackToMain = $("#backToMain");
if (btnBackToMain) {
  btnBackToMain.addEventListener("click", () => {
    selectedProjectId = data.mainProjectId;
    renderPortfolio();
  });
}

$("#closeEvidence").addEventListener("click", closeEvidence);
$("#evidenceDialog").addEventListener("click", e => {
  if (e.target === $("#evidenceDialog")) closeEvidence();
});

async function initDashboard() {
  setMode("level1"); // 기본 모드: 1단계 모드 (통합 확장형 포트폴리오 뷰)
  const success = await loadDashboardData();
  if (success) {
    renderPortfolio();
    renderRisks();
    renderGroundTruth();
    renderCoverage();
    renderNextControl();
    renderMindset();
  }
}

initDashboard();
