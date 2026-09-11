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
  mindset: [],
  archiveCache: {}
};

async function loadDashboardData() {
  try {
    // 3-Tier 아키텍처: 살아있는 활성 업무(workstreams_active.json)를 우선 로드
    // 만약 파일이 없을 경우 기존 workstreams.json으로 fallback
    let workstreamsRes;
    try {
      workstreamsRes = await fetch("./data/workstreams_active.json");
      if (!workstreamsRes.ok) throw new Error("workstreams_active.json not found");
    } catch {
      workstreamsRes = await fetch("./data/workstreams.json");
    }

    const [metaRes, projectsRes, risksRes, gtRes, mindsetRes] = await Promise.all([
      fetch("./data/meta.json"),
      fetch("./data/projects.json"),
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

    // RDB JOIN logic: Projects + Active Workstreams + Project Risks (Bottlenecks)
    const joinedProjects = rawProjects.map(p => {
      const pWorkstreams = workstreams.filter(ws => ws.projectId === p.id);
      const pRisks = risks.filter(r => r.projectId === p.id);

      return {
        ...p,
        main: p.isMain,
        execution: {
          workstreams: pWorkstreams,
          risks: pRisks
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
const expandedRiskKeys = new Set();
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

    // Project Bottlenecks: 해당 프로젝트에 할당된 병목 중 '해결 전'인 것만 필터링
    const projectRisks = project.execution?.risks || data.risks.filter(r => r.projectId === project.id);
    const unresolvedRisks = projectRisks.filter(risk => {
      const s = String(risk.status || risk.resolutionStatus || "").toLowerCase().trim();
      return !(s === "resolved" || s === "pass" || s === "done" || s === "해결 완료" || s === "완료");
    });

    const riskCardsHTML = unresolvedRisks.length > 0 ? unresolvedRisks.map((risk, rIdx) => {
      const riskKey = `${project.id}_${risk.id || rIdx}`;
      const isExpanded = expandedRiskKeys.has(riskKey);
      return `
        <article class="risk-item ${isExpanded ? "expanded" : ""}" data-risk-key="${riskKey}" role="button" tabindex="0" aria-expanded="${isExpanded}">
          <div class="risk-primary">
            <div class="severity-label severity-${risk.severity || "warning"}">
              <span class="status-dot"></span>${(risk.severity === "critical") ? "CRITICAL" : (risk.severity === "progress" ? "PROGRESS" : "WARNING")}
            </div>
            <strong class="risk-title">${risk.title}</strong>
            <span class="risk-metric">${risk.metric || risk.deadline || ""}</span>
            <span class="expand-icon" aria-hidden="true">${isExpanded ? "▲" : "▼"}</span>
          </div>
          <div class="risk-action-preview">
            <span class="action-badge">조치</span>
            <p>${risk.action || "-"}</p>
          </div>
          ${isExpanded ? `
            <div class="risk-expanded-details">
              ${risk.cause ? `<div class="detail-row"><span>원인</span><p>${risk.cause}</p></div>` : ""}
              ${risk.impact ? `<div class="detail-row"><span>영향</span><p>${risk.impact}</p></div>` : ""}
              ${risk.action ? `<div class="detail-row"><span>조치</span><p>${risk.action}</p></div>` : ""}
              ${risk.deadline ? `<div class="detail-row"><span>기한</span><p>${risk.deadline}</p></div>` : ""}
              ${risk.recommendation ? `<div class="detail-row"><span>추천</span><p>${risk.recommendation}</p></div>` : ""}
              ${risk.decision ? `<div class="detail-row"><span>결정</span><p>${risk.decision}</p></div>` : ""}
              ${risk.evidence && risk.evidence.length > 0 ? `
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
              ` : ""}
            </div>
          ` : ""}
        </article>
      `;
    }).join("") : `
      <div class="ws-empty-state">
        <p>현재 해결 전인 병목(BOTTLENECK) 항목이 없습니다.</p>
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

        <!-- 클릭 시 확장되는 상세 영역: Workstream 목록 및 BOTTLENECK → ACTION -->
        <div class="portfolio-expanded-content">
          <!-- 1. Workstream 영역 -->
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

          <!-- 구분선 -->
          <div class="portfolio-section-divider" role="separator"></div>

          <!-- 2. BOTTLENECK → ACTION 영역 (프로젝트 할당, 해결 전 항목만 표출) -->
          <div class="portfolio-bottleneck-section">
            <div class="portfolio-ws-head">
              <div class="portfolio-ws-head-left">
                <span class="ws-heading-title">BOTTLENECK → ACTION</span>
                <span class="ws-heading-sub">해결 전 난관 및 대응 조치 · 카드 클릭 시 상세/근거 펼침</span>
              </div>
            </div>
            <div class="portfolio-risk-list">${riskCardsHTML}</div>
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

  // Bottleneck (Risk) 카드 클릭 시 상세/근거 펼침 토글
  document.querySelectorAll("[data-risk-key]").forEach(riskCard => {
    const toggleRisk = (e) => {
      e.stopPropagation(); // 상위 이벤트 전파 방지
      const key = riskCard.dataset.riskKey;
      if (expandedRiskKeys.has(key)) {
        expandedRiskKeys.delete(key);
      } else {
        expandedRiskKeys.add(key);
      }
      renderPortfolio();
    };
    riskCard.addEventListener("click", toggleRisk);
    riskCard.addEventListener("keydown", e => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        e.stopPropagation();
        toggleRisk(e);
      }
    });
  });
}

function renderRisks() {
  // 기존 독립 섹션(#riskList) 제거됨에 따라 각 프로젝트 하위(renderPortfolio)로 통합됨
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

// ==========================================
// 월별 캘린더 렌더링 (일~토, 오늘 하이라이트, 프로젝트 마감일 뱃지 & 호버 툴팁)
// ==========================================
function renderMonthlyCalendar() {
  const container = $("#calendarDays");
  const titleEl = $("#calendarMonthTitle");
  if (!container) return;

  const kst = getKSTToday(); // { year: 2026, month: 8 (9월), day: 7 }
  const curYear = kst.year;
  const curMonth = kst.month; // 0-indexed (8 = 9월)
  const todayDate = kst.day;

  if (titleEl) {
    titleEl.textContent = `${curYear}년 ${curMonth + 1}월`;
  }

  // 1. 프로젝트 목표일 이벤트 맵 구축: { dayNumber: [ { id, name, short, status, targetDate } ] }
  const eventMap = {};
  if (data.projects && Array.isArray(data.projects)) {
    data.projects.forEach(p => {
      const dStr = String(p.targetDate || "").trim();
      const m = dStr.match(/(\d{1,2})\s*[\/.-]\s*(\d{1,2})/);
      if (m) {
        const pMonth = parseInt(m[1], 10);
        const pDay = parseInt(m[2], 10);
        // 이번 달과 일치하는 경우
        if (pMonth === curMonth + 1) {
          if (!eventMap[pDay]) eventMap[pDay] = [];
          eventMap[pDay].push(p);
        }
      }
    });
  }

  // 2. 월의 첫째 날 요일 및 마지막 날짜 계산
  const firstDayOfWeek = new Date(curYear, curMonth, 1).getDay(); // 0(일) ~ 6(토)
  const totalDaysInMonth = new Date(curYear, curMonth + 1, 0).getDate();

  // 3. 그리드 HTML 생성
  let cellsHTML = "";

  // 첫째 주 시작 전 빈 칸 (이전 달 공간)
  for (let i = 0; i < firstDayOfWeek; i++) {
    cellsHTML += `<div class="calendar-day-cell empty" aria-hidden="true"></div>`;
  }

  // 이번 달 일자 셀들
  for (let d = 1; d <= totalDaysInMonth; d++) {
    const isToday = (d === todayDate);
    const events = eventMap[d] || [];
    const hasEvent = events.length > 0;
    const dayOfWeek = (firstDayOfWeek + d - 1) % 7;
    const isSunday = (dayOfWeek === 0);
    const isSaturday = (dayOfWeek === 6);

    let cellClass = "calendar-day-cell";
    if (isToday) cellClass += " is-today";
    if (hasEvent) cellClass += " has-event";
    if (isSunday) cellClass += " sunday";
    if (isSaturday) cellClass += " saturday";

    // 이벤트가 있는 경우 툴팁 생성
    let tooltipHTML = "";
    if (hasEvent) {
      tooltipHTML = `
        <div class="calendar-tooltip" role="tooltip">
          <div class="tooltip-tag">📌 ${curMonth + 1}/${d} 마감 과제 (${events.length}건)</div>
          ${events.map(ev => `
            <div class="tooltip-project-item">
              <span>• <strong>${ev.short || ev.name}</strong></span>
            </div>
          `).join("")}
        </div>
      `;
    }

    cellsHTML += `
      <div class="${cellClass}" tabindex="${hasEvent ? "0" : "-1"}" aria-label="${curMonth + 1}월 ${d}일${isToday ? " (오늘)" : ""}${hasEvent ? ` (마감일: ${events.map(e => e.name).join(", ")})` : ""}">
        <span class="day-number">${d}</span>
        ${hasEvent ? `<span class="event-marker" aria-hidden="true"></span>` : ""}
        ${tooltipHTML}
      </div>
    `;
  }

  container.innerHTML = cellsHTML;
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

// ==========================================
// 3-Tier 아키텍처: 과거 완료 업무 아카이브 모달 로더
// ==========================================
let currentArchiveMonth = "2026-08";

async function loadArchiveData(month) {
  if (data.archiveCache[month]) {
    return data.archiveCache[month];
  }
  try {
    const res = await fetch(`./data/archive/done_${month}.json`);
    if (!res.ok) throw new Error(`Archive done_${month}.json not found`);
    const list = await res.json();
    data.archiveCache[month] = list;
    return list;
  } catch (err) {
    console.error(`Failed to load archive for ${month}:`, err);
    return [];
  }
}

async function renderArchiveModal(month = currentArchiveMonth) {
  currentArchiveMonth = month;
  const container = $("#archiveBody");
  if (!container) return;

  // 탭 활성화 상태 동기화
  const tabs = document.querySelectorAll(".archive-tab-btn");
  tabs.forEach(tab => {
    tab.classList.toggle("active", tab.dataset.month === month);
  });

  container.innerHTML = `<div class="archive-loading">아카이브 원장 로딩 중... (${month})</div>`;
  const items = await loadArchiveData(month);

  if (!items || items.length === 0) {
    container.innerHTML = `
      <div class="archive-empty">
        <p>${month}월에 완료되어 아카이브된 업무 내역이 없습니다.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <div class="archive-summary-box">
      <span><strong>${month}월 완수 총계:</strong> ${items.length}건</span>
      <span class="archive-tip">※ 완료된 업무는 영구 보존되며, 관련 회의록 및 도면 원문 앵커로 직접 점프할 수 있습니다.</span>
    </div>
    <div class="archive-list">
      ${items.map((item, idx) => `
        <div class="archive-card">
          <div class="archive-card-head">
            <div class="archive-title-group">
              <span class="archive-num">#${idx + 1}</span>
              <span class="archive-project-tag">${item.projectId}</span>
              <strong class="archive-name">${item.name}</strong>
            </div>
            <div class="archive-date-badge">
              <span class="badge-label">완수일</span>
              <strong>${item.closedDate || item.targetDate || "-"}</strong>
            </div>
          </div>
          ${item.goal ? `<p class="archive-goal"><strong>목표:</strong> ${item.goal}</p>` : ""}
          ${item.criteria && item.criteria.length > 0 ? `
            <div class="archive-criteria-wrap">
              <span class="criteria-label">완료 검증 기준:</span>
              <ul class="archive-criteria-list">
                ${item.criteria.map(c => `<li>${c}</li>`).join("")}
              </ul>
            </div>
          ` : ""}
          <div class="archive-footer-row">
            <div class="archive-deep-context">
              ${item.deepContext ? `
                <a href="${item.deepContext}" target="_blank" rel="noopener noreferrer" class="deep-context-link">
                  <span>📄 원천 근거/회의록 조회 (${item.deepContext})</span>
                </a>
              ` : `<span class="deep-context-text">${item.evidenceDate || ""}</span>`}
            </div>
            ${item.links && item.links.length > 0 ? `
              <div class="archive-sub-links">
                ${item.links.map(l => {
                  const href = typeof l === "string" ? l : (l.url || "#");
                  const title = typeof l === "string" ? l : (l.title || "링크");
                  return `<a href="${href}" target="_blank" rel="noopener noreferrer" class="archive-sub-link">🔗 ${title}</a>`;
                }).join("")}
              </div>
            ` : ""}
          </div>
        </div>
      `).join("")}
    </div>
  `;
}

function openArchiveModal() {
  const dialog = $("#archiveDialog");
  if (!dialog) return;
  renderArchiveModal(currentArchiveMonth);
  if (typeof dialog.showModal === "function") dialog.showModal();
  else dialog.setAttribute("open", "open");
}

function closeArchiveModal() {
  const dialog = $("#archiveDialog");
  if (!dialog) return;
  if (typeof dialog.close === "function") dialog.close();
  else dialog.removeAttribute("open");
}

// 이벤트 핸들러 바인딩
const btnOpenArchive = $("#btnOpenArchive");
if (btnOpenArchive) {
  btnOpenArchive.addEventListener("click", openArchiveModal);
}

const btnCloseArchive = $("#closeArchive");
if (btnCloseArchive) {
  btnCloseArchive.addEventListener("click", closeArchiveModal);
}

const archiveDialogEl = $("#archiveDialog");
if (archiveDialogEl) {
  archiveDialogEl.addEventListener("click", e => {
    if (e.target === archiveDialogEl) closeArchiveModal();
  });
}

// 아카이브 월별 탭 클릭 이벤트
document.querySelectorAll(".archive-tab-btn").forEach(btn => {
  btn.addEventListener("click", (e) => {
    const month = e.currentTarget.dataset.month;
    if (month) renderArchiveModal(month);
  });
});

async function initDashboard() {
  setMode("level1"); // 기본 모드: 1단계 모드 (통합 확장형 포트폴리오 뷰)
  const success = await loadDashboardData();
  if (success) {
    renderMonthlyCalendar();
    renderPortfolio();
    renderRisks();
    renderGroundTruth();
    renderCoverage();
    renderNextControl();
    renderMindset();
  }
}

initDashboard();
