// Explicit offsets make publication independent of the visitor's timezone.
export function publishTime(article) {
  const stamp = article.publishAt || `${article.date}T00:00:00+08:00`;
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:Z|[+-]\d{2}:\d{2})$/.test(stamp)) throw Error(`Invalid publishAt: ${article.slug}`);
  const [year,month,day] = stamp.slice(0,10).split("-").map(Number);
  const calendar = new Date(Date.UTC(year,month-1,day));
  if(calendar.getUTCFullYear()!==year || calendar.getUTCMonth()!==month-1 || calendar.getUTCDate()!==day) throw Error(`Invalid calendar date: ${article.slug}`);
  const time = Date.parse(stamp);
  if (!Number.isFinite(time)) throw Error(`Invalid publishAt: ${article.slug}`);
  return time;
}
export function publishedArticles(items, now = Date.now()) {
  return items.filter(a => publishTime(a) <= now).sort((a,b) => publishTime(b)-publishTime(a) || a.slug.localeCompare(b.slug));
}
export function selectArticles(items, {query='', category='', date='', page=1, size=12} = {}) {
  const needle = query.trim().toLocaleLowerCase('zh-TW');
  const filtered = items.filter(a => (!category || a.category === category) && (!date || a.date === date) && (!needle || `${a.title} ${a.description} ${a.category}`.toLocaleLowerCase('zh-TW').includes(needle)));
  const pages = Math.max(1, Math.ceil(filtered.length/size));
  const current = Math.min(Math.max(1, Math.floor(Number(page))||1), pages);
  return {items:filtered.slice((current-1)*size,current*size),total:filtered.length,pages,page:current};
}
