import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const exec = promisify(execFile);
const script = fileURLToPath(new URL('./instagram-scheduler.mjs', import.meta.url));
const project = path.resolve(path.dirname(script), '../..');
const env = path.join(project, '.env.ig');
try { await fs.access(env); } catch { throw new Error(`請先建立 ${env}（可複製 .env.ig.example）`); }

const label = 'studio.zhiyin.mixuanxuan.instagram-scheduler';
const plist = path.join(os.homedir(), 'Library', 'LaunchAgents', `${label}.plist`);
const logDir = path.join(project, 'work', 'instagram-scheduler');
await fs.mkdir(logDir, { recursive: true });
const xml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>Label</key><string>${label}</string>
<key>ProgramArguments</key><array><string>${process.execPath}</string><string>${script}</string></array>
<key>WorkingDirectory</key><string>${project}</string>
<key>RunAtLoad</key><true/><key>KeepAlive</key><true/>
<key>StandardOutPath</key><string>${logDir}/service.out.log</string>
<key>StandardErrorPath</key><string>${logDir}/service.err.log</string>
</dict></plist>`;
await fs.writeFile(plist, xml);
try { await exec('launchctl', ['bootout', `gui/${process.getuid()}`, plist]); } catch {}
await exec('launchctl', ['bootstrap', `gui/${process.getuid()}`, plist]);
console.log(`已安裝並啟動：${label}\n控制台：http://127.0.0.1:43170/xuanxuan/admin/`);
