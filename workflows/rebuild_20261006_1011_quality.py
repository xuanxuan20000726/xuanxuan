#!/usr/bin/env python3
"""Rebuild 2026-10-06..11 cards from premium illustrations and expand narration."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageEnhance
import json, re, shutil

ROOT=Path(__file__).resolve().parents[1]
POSTS=ROOT/'posts'
GEN=Path('/Users/timmychi/.codex/generated_images/01a0bd7b-777f-72c3-a027-78b2fb40a493')
W,H=1080,1920
REG='/System/Library/Fonts/Songti.ttc'
BOLD='/System/Library/Fonts/STHeiti Medium.ttc'

rows=[
('2026-10-06_0800_engram-tiny-ai','Engram：把可弄壞的 AI\n放進取樣器','exec-ec5decb2-5e27-47f6-a347-93203d49db31.png','#62d9ff','研究原型值得期待，因為它把模型變成可以親手演奏的材料。先從一段自己的錄音開始，慢慢建立只屬於你的聲音語彙。'),
('2026-10-06_2100_yamaha-rs20mm','Yamaha RS20MM\n讓觸弦動態說話','exec-554f25a9-9efb-4049-ae39-1203fa4514ef.png','#ffba73','好消息是，這些設計都能透過自己的手感直接驗證。帶著熟悉的句子去試琴，更容易找到真正承接你表情的聲音。'),
('2026-10-07_0800_umg-elevenlabs-licensed-ai','UMG × ElevenLabs\nAI 音樂開始談授權','exec-aa461420-bfd0-4c03-8fd8-952db49b030d.png','#e9a8ff','產業願意把授權放到產品起點，是值得鼓勵的一步。只要同意、分帳與退出都能被清楚執行，創作者就更有機會安心參與新工具。'),
('2026-10-07_2100_audient-horizon-native','Audient Horizon\n低延遲要看完整路徑','exec-9fb1530a-032e-4a4b-8928-8672426c3e66.png','#73e5d1','低延遲與彈性擴充，確實能替大型錄音省下很多溝通成本。從小型 session 先測穩定度，再逐步擴張，就能讓規格真正服務表演。'),
('2026-10-08_0800_snapdragon-ai-hearables','Snapdragon Sound\n耳機成為 AI 介面','exec-9746ac88-01c8-4d97-88f6-802b3e0bdf72.png','#78e3ff','端側運算進步，代表更多即時功能有機會兼顧速度與隱私。只要提示與選擇權做得清楚，智慧耳機很可能成為更貼近人的音訊工具。'),
('2026-10-08_2100_boss-ex4-expander','BOSS EX-4\n一顆踏板擴充整塊板','exec-2a79f1f6-2b8b-4d13-91d5-81b8175a6d99.png','#ff7a63','四個效果與彈性路由，足以把常用場景整理得很俐落。先為每首歌設計少量、明確的切換，舞台上就能把注意力留給演奏。'),
('2026-10-09_0800_voices-2026-new-songs','呼聲 VOICES 2026\n新歌先找到現場體溫','exec-0c46e5c0-a474-4aa1-bd17-321902395fb5.png','#ffc0dd','首唱最動人的地方，是作品還保有呼吸與成長空間。把觀眾反應當成溫柔的回饋，再守住創作核心，新歌就能一步步長成自己的樣子。'),
('2026-10-09_2100_tonex-2-rig','TONEX 2 Player\n軟硬體工作流接軌','exec-a509f173-3246-4485-b857-46287944e428.png','#ffc46b','軟硬體能互相接力，會讓整理音色與備份演出設定更從容。先核對版本、授權與增益，再建立自己的範本，就能放心享受便利。'),
('2026-10-10_0800_cosmos-dear-you-tape','宇宙人《Dear You》\n用盤帶留下碰撞','exec-266776a4-d33c-4195-8785-0daf2090dffc.png','#ffd18b','願意換一種流程重新聽見彼此，本身就是很有勇氣的創作選擇。類比與數位可以互補，重點是讓每一次決定更靠近歌曲。'),
('2026-10-10_2100_zenology-gx-auv3','ZENOLOGY GX\n正式接進 iPad DAW','exec-f4b88513-4d0e-4b3b-aef5-517721f3687a.png','#69dcff','AUv3 讓靈感少一次搬運，也提高行動創作完成作品的機會。先用一個小專案測召回與效能，穩定後再擴大使用會更安心。'),
('2026-10-11_0800_yokeoasu-tsou-citypop','《yokeoasu》\n讓鄒語活在今天','exec-d5f49327-5204-4271-9ec8-682c88e7b724.png','#ffd75e','當族語自然地唱出心動、玩笑與回家，它就不只被保存，也持續創造新的記憶。從好好聽完一首歌開始，就是很好的靠近。'),
('2026-10-11_2100_sandyne-25-workflow','SANDYNE 2.5\n免費 DAW 補齊工作流','exec-eceb27bd-2d5b-483e-a67c-f19524293743.png','#e5a3ff','免費工具持續補齊錄音與路由，讓更多人能低門檻開始創作。先完成一首小作品、建立穩定範本，再逐步加功能，會比一次全開更有成就感。'),
]

FOLLOW={
'2026-10-06_0800_engram-tiny-ai':'創作不一定要從完整答案開始；有時候，一個意外的聲響就足以帶你走向下一段旋律。',
'2026-10-06_2100_yamaha-rs20mm':'器材的價值不在替你定義風格，而是讓細微的力度與語氣更容易被聽見。',
'2026-10-07_0800_umg-elevenlabs-licensed-ai':'規則越透明，音樂人越能帶著選擇權進場，也越可能做出真正有意思的新合作。',
'2026-10-07_2100_audient-horizon-native':'當技術摩擦降低，錄音者就能把更多專注放回呼吸、節奏與彼此的互動。',
'2026-10-08_0800_snapdragon-ai-hearables':'新功能可以很貼心，而清楚告知資料如何使用，會讓這份貼心更值得信任。',
'2026-10-08_2100_boss-ex4-expander':'先把最常用的聲音練成肌肉記憶，再把新增效果當成擴充，演出會更自在。',
'2026-10-09_0800_voices-2026-new-songs':'每一次現場相遇都可能替作品補上一點方向，也替創作者累積繼續前進的勇氣。',
'2026-10-09_2100_tonex-2-rig':'把設定整理好之後，科技就能安靜退到後面，讓你的音色與演奏站到前面。',
'2026-10-10_0800_cosmos-dear-you-tape':'願意為一首歌放慢、重聽與重新選擇，往往比追求某種器材標籤更珍貴。',
'2026-10-10_2100_zenology-gx-auv3':'工具之間少一道牆，就多一次把靈感完成的機會，這是很實際的進步。',
'2026-10-11_0800_yokeoasu-tsou-citypop':'語言走進當代流行聲響，也讓更多年輕聽眾有機會在旋律裡遇見它。',
'2026-10-11_2100_sandyne-25-workflow':'能夠低成本開始、安心試錯並完成第一首作品，本身就是創作工具很大的價值。',
}
CLOSER={
'2026-10-06_0800_engram-tiny-ai':'也期待它從原型走向更多創作者手中。',
'2026-10-06_2100_yamaha-rs20mm':'願每一次觸弦，都更靠近你想說的話。',
'2026-10-07_0800_umg-elevenlabs-licensed-ai':'期待合作把尊重真正寫進每一個環節。',
'2026-10-08_0800_snapdragon-ai-hearables':'期待便利與安心可以一起被設計進耳機。',
'2026-10-08_2100_boss-ex4-expander':'願每一次切換，都讓演奏更自由。',
'2026-10-09_0800_voices-2026-new-songs':'也祝福每一首新歌，都能找到願意聽它長大的耳朵。',
'2026-10-10_0800_cosmos-dear-you-tape':'慢一點做決定，也可能留下更長久的聲音。',
'2026-10-11_0800_yokeoasu-tsou-citypop':'願更多語言，都能自在唱出今天的生活。',
}

def f(size,b=False): return ImageFont.truetype(BOLD if b else REG,size)
def lines(draw,text,font,maxw):
 out=[]
 for para in text.split('\n'):
  cur=''
  for ch in para:
   if draw.textlength(cur+ch,font=font)<=maxw: cur+=ch
   else: out.append(cur);cur=ch
  if cur: out.append(cur)
 return out

archive=ROOT/'work'/'archive_low_quality_20261006_1011'
archive.mkdir(parents=True,exist_ok=True)
labels=['NEWS / 01','TECH / 02','VIEW / 03']
subheads=['新聞重點','技術拆解','創作觀點']

for folder,title,bgname,accent,encourage in rows:
 p=POSTS/folder; a=p/'影片素材'
 for name in ['01_新聞重點.png','02_技術拆解.png','03_創作觀點.png']:
  old=p/name; dest=archive/folder/name
  dest.parent.mkdir(parents=True,exist_ok=True)
  if old.exists() and not dest.exists(): shutil.copy2(old,dest)
 voice=json.loads((a/'口播.json').read_text())
 # Expand commentary naturally to a roughly 50-second read.
 if encourage not in voice['slides'][2]['sentences']:
  voice['slides'][2]['sentences'].append(encourage)
 follow=FOLLOW[folder]
 if follow not in voice['slides'][2]['sentences']:
  voice['slides'][2]['sentences'].append(follow)
 closer=CLOSER.get(folder)
 if closer and closer not in voice['slides'][2]['sentences']:
  voice['slides'][2]['sentences'].append(closer)
 (a/'口播.json').write_text(json.dumps(voice,ensure_ascii=False,indent=2)+'\n')
 for idx,slide in enumerate(voice['slides']):
  src=Image.open(GEN/bgname).convert('RGB')
  # center crop to 9:16
  ratio=W/H; sr=src.width/src.height
  if sr>ratio:
   nw=int(src.height*ratio); left=(src.width-nw)//2; src=src.crop((left,0,left+nw,src.height))
  else:
   nh=int(src.width/ratio); top=(src.height-nh)//2; src=src.crop((0,top,src.width,top+nh))
  im=src.resize((W,H),Image.Resampling.LANCZOS)
  im=ImageEnhance.Contrast(im).enhance(1.04).convert('RGBA')
  ov=Image.new('RGBA',(W,H),(0,0,0,0)); d=ImageDraw.Draw(ov)
  # cinematic left/top shade; retains the illustration instead of a template card
  d.rectangle((0,0,W,H),fill=(4,9,20,20))
  for x in range(760):
   alpha=int(178*(1-x/760)**1.7)
   d.line((x,0,x,H),fill=(4,8,18,alpha))
  d.rounded_rectangle((54,54,312,114),24,fill=(5,10,20,185),outline=accent,width=2)
  d.text((80,67),labels[idx],font=f(28,True),fill=accent)
  y=155
  tf=f(66 if idx==0 else 60,True)
  heading=title if idx==0 else subheads[idx]
  for ln in lines(d,heading,tf,680):
   d.text((64,y),ln,font=tf,fill='white',stroke_width=2,stroke_fill=(0,0,0,120)); y+=int(tf.size*1.18)
  y+=32
  bulletfont=f(39,True)
  for s in slide['sentences'][:3]:
   d.ellipse((68,y+13,84,y+29),fill=accent)
   ls=lines(d,s,bulletfont,630)
   for ln in ls:
    d.text((104,y),ln,font=bulletfont,fill='white',stroke_width=2,stroke_fill=(0,0,0,140)); y+=54
   y+=30
  # source/footer band
  d.rounded_rectangle((56,1738,1024,1856),28,fill=(3,8,18,185),outline=(255,255,255,55),width=2)
  d.text((82,1762),'米媗媗｜音樂 × 科技 × 生活',font=f(27,True),fill='white')
  d.text((82,1806),'新聞事實與個人評論分開整理',font=f(25),fill=accent)
  out=Image.alpha_composite(im,ov).convert('RGB')
  out.save(p/f"{idx+1:02}_{subheads[idx]}.png",quality=96)
 # Add an encouraging closing paragraph to article/caption once.
 for name in ['文案.md','IG文案.txt']:
  q=p/name; text=q.read_text()
  marker='我也想多補一句鼓勵：'
  if marker not in text:
   insert=f"\n{marker}{encourage}{follow}\n"
   pos=text.rfind('\n來源：')
   text=text[:pos]+insert+text[pos:] if pos>=0 else text+insert
   q.write_text(text)
  elif follow not in text:
   pos=text.rfind('\n來源：')
   text=text[:pos]+follow+'\n'+text[pos:] if pos>=0 else text+'\n'+follow+'\n'
   q.write_text(text)
  if closer and closer not in text:
   text=q.read_text(); pos=text.rfind('\n來源：')
   text=text[:pos]+closer+'\n'+text[pos:] if pos>=0 else text+'\n'+closer+'\n'
   q.write_text(text)

print('rebuilt',len(rows),'posts /',len(rows)*3,'cards')
