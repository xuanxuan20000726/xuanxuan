const root = document.querySelector('[data-admin-dashboard]');
const base = root?.dataset.base || '/xuanxuan';
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

function platformBadge(enabled, type, label) {
  return `<span class="platform-badge ${enabled ? 'active' : 'missing'}"><i class="${type}"></i>${label}${enabled ? ' 已排程' : ' 未排程'}</span>`;
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
    const state = time.getTime() <= now ? '時間已到' : '等待發佈';
    return `<article class="schedule-row"><time datetime="${item.publishAt}"><strong>${formatter.format(time).replace('週','')}</strong><span>${state}</span></time><div class="schedule-copy"><h3>${escapeHTML(item.title)}</h3><p>短影音播報 · 直式三頁重點</p></div><div class="platforms">${platformBadge(item.facebook,'facebook','Facebook')}${platformBadge(item.instagram,'instagram','Instagram')}</div></article>`;
  }).join('');
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
  await checkDeployment(data);
} catch (error) {
  $('[data-schedule-list]').innerHTML = '<p class="empty-state">暫時無法讀取控制台資料，請重新整理頁面。</p>';
  setSync('warn', '資料讀取失敗', '請確認 admin-data.json 已隨網站一起部署。');
  console.error(error);
}
