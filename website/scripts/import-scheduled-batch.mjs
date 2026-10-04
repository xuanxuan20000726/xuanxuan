import fs from 'node:fs/promises';
import path from 'node:path';

const website = path.resolve(import.meta.dirname, '..');
const root = path.resolve(website, '..');
const posts = path.join(root, 'posts');
const catalogPath = path.join(posts, '2026-09-27_10-04_排程', '內容規劃.json');
const catalog = JSON.parse(await fs.readFile(catalogPath, 'utf8'));

catalog.unshift({
  date: '2026-09-27',
  time: '08:00',
  slug: 'de-artifact',
  title: 'AI 分軌之後，聲音還需要修整',
  category: '音樂與科技',
  publishAt: '2026-09-27T08:00:00+08:00',
  folder: '2026-09-27_0800_de-artifact',
  points: ['修復分軌與壓縮後的音訊瑕疵', '殘留監聽能檢查工具拿掉什麼', '乾淨不等於保留作品的呼吸'],
});

const articlesPath = path.join(website, 'content', 'articles.json');
const articles = JSON.parse(await fs.readFile(articlesPath, 'utf8')).filter(article => article.slug !== 'spark-sleep');
const bySlug = new Map(articles.map((article, index) => [article.slug, index]));
await fs.mkdir(path.join(website, 'public', 'videos'), { recursive: true });

function pngSize(buffer) {
  if (buffer.toString('ascii', 1, 4) !== 'PNG') throw new Error('Expected PNG image');
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

for (const item of catalog) {
  const post = path.join(posts, item.folder);
  const hasVideo = item.time === '08:00' || item.video === true;
  const sourceImage = path.join(post, hasVideo ? '01_新聞重點.png' : '配圖.png');
  const image = `${item.date}-${item.slug}.png`;
  const imageBuffer = await fs.readFile(sourceImage);
  const { width, height } = pngSize(imageBuffer);
  await fs.writeFile(path.join(website, 'public', 'images', image), imageBuffer);

  const sourceMarkdown = await fs.readFile(path.join(post, '文案.md'), 'utf8');
  await fs.writeFile(path.join(website, 'content', `${item.slug}.md`), sourceMarkdown);

  const record = {
    slug: item.slug,
    title: item.title,
    category: item.category,
    date: item.date,
    publishAt: item.publishAt,
    description: item.points.join('；') + '。',
    image,
    imageAlt: item.category === '育兒與照顧'
      ? `日系動畫六格漫畫：${item.title}。`
      : `米媗媗的日系動畫重點圖：${item.title}。`,
    imageWidth: width,
    imageHeight: height,
  };

  if (hasVideo) {
    const video = `${item.date}-${item.slug}.mp4`;
    const candidates = (await fs.readdir(post)).filter(name => name.endsWith('.mp4'))
      .sort((a, b) => Number(b.includes('1.08')) - Number(a.includes('1.08')) || b.localeCompare(a, 'zh-Hant'));
    if (candidates.length) {
      await fs.copyFile(path.join(post, candidates[0]), path.join(website, 'public', 'videos', video));
      record.video = video;
    }
  }

  if (bySlug.has(record.slug)) articles[bySlug.get(record.slug)] = record;
  else {
    bySlug.set(record.slug, articles.length);
    articles.push(record);
  }
}

articles.sort((a, b) => Date.parse(b.publishAt || `${b.date}T00:00:00+08:00`) - Date.parse(a.publishAt || `${a.date}T00:00:00+08:00`));
await fs.writeFile(articlesPath, JSON.stringify(articles, null, 2) + '\n');
console.log(`Imported ${catalog.length} scheduled articles into the website.`);
