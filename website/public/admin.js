const root = document.querySelector('[data-admin-dashboard]');
const base = root?.dataset.base || '/xuanxuan';
const schedulerBase = location.hostname === '127.0.0.1' || location.hostname === 'localhost' ? location.origin : 'http://127.0.0.1:43170';
const $ = selector => document.querySelector(selector);
const formatter = new Intl.DateTimeFormat('zh-TW', {
  timeZone: 'Asia/Taipei', month: '2-digit', day: '2-digit',
  weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
});
const clockFormatter = new Intl.DateTimeFormat('zh-TW', {
  timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'
});
const escapeHTML = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

function updateClock() {
  const target = $('[data-admin-clock]');
  if (target) target.textContent = clockFormatter.format(new Date());
}
updateClock();
setInterval(updateClock, 1000);

async function fetchText(url) {
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  return response.text();
}

function platformBadge(enabled, type, label, status) {
  const stateLabel = status === 'published' ? ' 已發布' : ' 已排程';
  return `<span class="platform-badge ${enabled ? 'active' : 'missing'}"><i class="${type}"></i>${label}${enabled ? stateLabel : ' 未排程'}</span>`;
}

function renderSchedule(data) {
  $('[data-ig-account]').textContent = `@${data.instagram.username}`;
  $('[data-account-note]').textContent = `${data.instagram.connectedVia} · ${data.instagram.displayName}`;
  const now = Date.now();
  const future = data.schedule.filter(item => new Date(item.publishAt).getTime() > now);
  $('[data-schedule-count]').textContent = future.length;
  $('[data-next-post]').textContent = future.length ? `下一支 · ${formatter.format(new Date(future[0].publishAt))}` : '目前沒有待發佈影片';
  $('[data-schedule-list]').innerHTML = data.schedule.map(item => {
    const time = new Date(item.publishAt);
    const state = item.instagramStatus === 'published' ? '已發布' : (time.getTime() <= now ? '時間已到' : '等待發佈');
    const action = item.instagramStatus === 'pending' ? `<button class="schedule-action" type="button" data-schedule-slug="${escapeHTML(item.slug)}">加入排程</button>` : '';
    return `<article class="schedule-row" data-schedule-row="${escapeHTML(item.slug)}"><time datetime="${item.publishAt}"><strong>${formatter.format(time).replace('週','')}</strong><span>${state}</span></time><div class="schedule-copy"><h3>${escapeHTML(item.title)}</h3><p>短影音播報 · 直式三頁重點</p></div><div class="platforms">${platformBadge(item.instagram,'instagram','Instagram',item.instagramStatus)}${action}</div></article>`;
  }).join('');
}

function setSchedulerState(kind, label, detail) {
  $('[data-scheduler-dot]').className = `status-dot ${kind}`;
  $('[data-scheduler-label]').textContent = label;
  $('[data-scheduler-detail]').textContent = detail;
}

function syncScheduleRows(jobs) {
  const localJobs = new Map(jobs.map(job => [job.slug, job]));
  document.querySelectorAll('[data-schedule-row]').forEach(row => {
    const job = localJobs.get(row.dataset.scheduleRow);
    if (!job) return;
    const platforms = row.querySelector('.platforms');
    if (!platforms) return;
    const published = job.status === 'published';
    const label = published ? 'Instagram 已發布' : 'Instagram 已排程';
    platforms.innerHTML = `<span class="platform-badge active"><i class="instagram"></i>${label}</span>`;
    const timeState = row.querySelector('time span');
    if (timeState && published) timeState.textContent = '已發布';
  });
}

async function schedulerRequest(path, options) {
  const response = await fetch(`${schedulerBase}${path}`, { cache: 'no-store', ...options });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || `排程服務錯誤 ${response.status}`);
  return data;
}

async function refreshScheduler() {
  try {
    const status = await schedulerRequest('/api/status');
    const queued = status.jobs.filter(job => ['scheduled','publishing'].includes(job.status)).length;
    const authLink = status.authorizationUrl ? ` <a href="${escapeHTML(status.authorizationUrl)}" target="_blank" rel="noreferrer">開始 Instagram 授權</a>` : '';
    setSchedulerState(status.configured ? 'ok' : 'warn', status.configured ? '排程服務已連線' : '排程服務待授權', status.configured ? `@${status.username} · ${queued} 支影片在本機佇列` : `服務已啟動；請完成一次官方授權。${authLink}`);
    $('[data-scheduler-jobs]').innerHTML = status.jobs.length ? status.jobs.map(job => `<li><strong>${escapeHTML(job.title)}</strong><span>${escapeHTML(job.status)} · ${formatter.format(new Date(job.publishAt))}</span></li>`).join('') : '<li class="empty-state">本機佇列目前沒有影片。</li>';
    syncScheduleRows(status.jobs);
    document.querySelectorAll('[data-schedule-slug]').forEach(button => { button.disabled = !status.configured; });
  } catch {
    setSchedulerState('warn', '本機排程服務未啟動', '先執行 npm run ig:server；設定完成後可安裝為登入時自動啟動。');
    $('[data-scheduler-jobs]').innerHTML = '<li class="empty-state">無法連線到 127.0.0.1:43170。</li>';
    document.querySelectorAll('[data-schedule-slug]').forEach(button => { button.disabled = true; });
  }
}

async function queueArticle(button) {
  button.disabled = true;
  button.textContent = '加入中…';
  try {
    await schedulerRequest('/api/schedule', { method: 'POST', headers: {'content-type':'application/json'}, body: JSON.stringify({ slug: button.dataset.scheduleSlug }) });
    button.textContent = '已加入';
    await refreshScheduler();
  } catch (error) {
    button.disabled = false;
    button.textContent = '重試';
    setSchedulerState('warn', '加入排程失敗', error.message);
  }
}

function setSync(status, label, detail) {
  $('[data-sync-dot]').className = `status-dot ${status}`;
  $('[data-sync-label]').textContent = label;
  $('[data-sync-detail]').textContent = detail;
}

async function checkDeployment(data) {
  const button = $('[data-admin-refresh]');
  button.disabled = true;
  button.textContent = '檢查中…';
  setSync('checking', '正在比對', '檢查 GitHub 主分支與線上履歷內容。');
  const checks = [
    { label: '本站建置內容', detail: `預期品牌名稱：${data.website.expectedName}`, state: 'ok' }
  ];
  let commit;
  try {
    const response = await fetch(`https://api.github.com/repos/${data.website.repository}/commits/${data.website.branch}`, { cache: 'no-store' });
    if (!response.ok) throw new Error('GitHub API 無法讀取');
    commit = await response.json();
    const stamp = new Intl.DateTimeFormat('zh-TW',{timeZone:'Asia/Taipei',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(commit.commit.committer.date));
    checks.push({ label: 'GitHub 主分支', detail: `${commit.sha.slice(0,7)} · ${stamp}`, state: 'ok' });
  } catch (error) {
    checks.push({ label: 'GitHub 主分支', detail: '暫時無法取得最新 commit', state: 'warn' });
  }
  let liveMatches = false;
  try {
    const online = await fetchText(`${data.website.resumeUrl}?status=${Date.now()}`);
    liveMatches = online.includes(data.website.expectedName) && !online.includes('<h2>紀依媗</h2>');
    checks.push({ label: 'GitHub Pages 線上履歷', detail: liveMatches ? `已顯示「${data.website.expectedName}」` : '仍偵測到舊名或尚未完成部署', state: liveMatches ? 'ok' : 'warn' });
  } catch (error) {
    checks.push({ label: 'GitHub Pages 線上履歷', detail: '目前無法連線檢查', state: 'warn' });
  }
  $('[data-deploy-steps]').innerHTML = checks.map((check, index) => `<div class="deploy-step ${check.state}"><span>${check.state === 'ok' ? '✓' : '!'}</span><div><small>0${index + 1}</small><h3>${check.label}</h3><p>${check.detail}</p></div></div>`).join('');
  if (liveMatches) setSync('ok', '網站已同步', `線上履歷目前顯示「${data.website.expectedName}」。`);
  else setSync('warn', '網站尚未同步', `本機已改為「${data.website.expectedName}」，線上履歷仍待 GitHub Pages 部署。`);
  $('[data-last-check]').textContent = `最後檢查：${clockFormatter.format(new Date())}（Asia/Taipei）`;
  button.disabled = false;
  button.textContent = '重新檢查';
}

try {
  const response = await fetch(`${base}/admin-data.json`, { cache: 'no-store' });
  if (!response.ok) throw new Error('控制台資料讀取失敗');
  const data = await response.json();
  renderSchedule(data);
  $('[data-admin-refresh]').addEventListener('click', () => checkDeployment(data));
  $('[data-scheduler-refresh]').addEventListener('click', refreshScheduler);
  document.querySelectorAll('[data-schedule-slug]').forEach(button => button.addEventListener('click', () => queueArticle(button)));
  await refreshScheduler();
  await checkDeployment(data);
} catch (error) {
  $('[data-schedule-list]').innerHTML = '<p class="empty-state">暫時無法讀取控制台資料，請重新整理頁面。</p>';
  setSync('warn', '資料讀取失敗', '請確認 admin-data.json 已隨網站一起部署。');
  console.error(error);
}
