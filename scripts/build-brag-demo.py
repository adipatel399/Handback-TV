"""User-directed, beat-cut judging film. Uses actual captured UI and measured narration."""
from pathlib import Path
import json,html,math
root=Path(__file__).resolve().parents[1];out=root/'brag-output';project=out/'judges-demo';d=project/'compositions';d.mkdir(exist_ok=True)
spec=json.loads((out/'demo-edit.json').read_text());duration=spec['duration'];cues=json.loads((out/'music/demo-cues.json').read_text())['beats']
CSS='''@font-face{font-family:Display;src:url('assets/fonts/Anton.ttf')}@font-face{font-family:Body;src:url('assets/fonts/Inter.ttf')}*{box-sizing:border-box}#root{position:absolute;inset:0;background:#091b1d;color:#f5f4ee;font-family:Body,Arial,sans-serif;overflow:hidden}h1,h2,p{margin:0}h1,h2{font-family:Display,sans-serif;font-weight:400;line-height:1.04;letter-spacing:-2px;text-transform:uppercase}.huge{font-size:210px}.big{font-size:156px}.accent{color:#efb879}.tag{font-size:32px;letter-spacing:2px;font-weight:700;text-transform:uppercase}.stack{position:absolute;left:192px;right:192px;top:205px}.small{font-size:36px;line-height:1.4}.camera{position:absolute;inset:0;transform-origin:40% 43%}.footage{position:absolute;inset:0;width:1920px;height:1080px;object-fit:contain}.source{position:absolute;left:128px;top:994px;max-width:1664px;padding:8px 12px;background:#091b1d;color:#f5f4ee;font-size:28px;line-height:32px;font-weight:600}.chapter{position:absolute;inset:0;background:#efb879;color:#091b1d;z-index:15;display:flex;align-items:center;padding:0 192px}.chapter h1{font-size:212px;max-width:1536px}.credits{position:absolute;left:192px;right:192px;top:775px;font-size:29px;line-height:1.4;color:#dbe5dc}.sub{font-size:42px;line-height:1.45;font-weight:600}.line{display:block}.cut-image{position:absolute;left:260px;top:420px;width:1400px;height:320px;object-fit:contain}'''

def write_scene(name,content,motion='',bg='#091b1d'):
 (d/f'{name}.html').write_text(f'''<template><style>{CSS}#root{{background:{bg}}}</style><div id="root" data-composition-id="{name}" data-width="1920" data-height="1080">{content}</div><script>const tl=gsap.timeline({{paused:true}});{motion}\nwindow.__timelines["{name}"]=tl;</script></template>''')

for s in spec['scenes']:
 n=s['id'];dur=s['duration'];start=s['start']
 if n=='hook':
  content='''<div class="stack"><p class="tag">HAND BACK THE EVERYDAY.</p><h1 class="huge" style="margin-top:35px"><span id="hook-a" class="line">THEIR</span><span id="hook-b" class="line accent">DECISION.</span></h1></div><div id="hook-rule" style="position:absolute;left:192px;top:745px;width:1536px;height:12px;background:#efb879"></div>'''
  motion='''tl.fromTo("#hook-a",{x:-70},{x:0,duration:.22,ease:"power4.out"},0);tl.fromTo("#hook-b",{opacity:0,scale:1.15},{opacity:1,scale:1,duration:.18,ease:"power3.out"},.78);tl.fromTo("#hook-rule",{scaleX:0,transformOrigin:"left"},{scaleX:1,duration:.28,ease:"power3.out"},2.53);'''
  write_scene(n,content,motion)
 elif n in ['reveal','choose','routes','steps','voice','saved','lab','change','receipt']:
  file='choose' if n=='reveal' else n
  offset=1 if n=='voice' else 2 if n=='saved' else 4 if n=='lab' else 0
  # Source clips end on purpose before the scene slot; hold their real last frame.
  label='ACTUAL ANDROID TV EMULATOR · REAL TFL DATA'
  if n in ['lab','change','receipt']:label='FICTIONAL BOOKING LAB · CONTROLLED TEST'
  if n=='change':label='FICTIONAL BOOKING LAB · FARE DELIBERATELY RAISED BY ₹20'
  content=f'''<div id="{n}-cam" class="camera" data-layout-allow-overflow><video id="{n}-video" class="clip footage" data-start="0" data-duration="{dur}" data-media-start="{offset}" muted playsinline src="assets/video/{file}.mp4"></video></div><p class="source">{label}</p>'''
  titles={'choose':'YOUR MOVE.','routes':'REAL ROUTES.','steps':'ONE CLEAR STEP.','voice':'PRESS PLAY.','lab':'WHAT IF?','change':'NEW PRICE.<br>NEW YES.'}
  motion=''
  if n in titles:
   content+=f'''<div id="{n}-chapter" class="clip chapter" data-start="0" data-duration="1.7" data-track-index="4"><h1 id="{n}-headline">{titles[n]}</h1></div>'''
   motion+=f'''tl.fromTo("#{n}-headline",{{x:90,opacity:0}},{{x:0,opacity:1,duration:.2,ease:"power4.out"}},0);tl.to("#{n}-chapter",{{x:-1920,duration:.24,ease:"power3.in"}},1.43);'''
  if n=='reveal':
   content+='''<div id="reveal-brand" style="position:absolute;left:950px;top:155px;color:#efb879;font-family:Display;font-size:145px;line-height:1">HANDBACK<br>TV.</div>'''
   motion+='''tl.fromTo("#reveal-brand",{x:160,opacity:0},{x:0,opacity:1,duration:.22,ease:"expo.out"},0);tl.to("#reveal-brand",{opacity:0,duration:.18},2.6);'''
  # A few measured, purposeful beat punch-ins; primary confirmation shots hold full-frame.
  if n not in ['lab','change','receipt']:
   localbeats=[b['time']-start for b in cues if start+2.3<b['time']<start+dur-.7]
   t=min(localbeats,key=lambda t:abs(t-3.75)) if localbeats else 3.75
   motion+=f'''tl.to("#{n}-cam",{{scale:1.07,duration:.18,ease:"power3.out"}},{t:.3f});tl.to("#{n}-cam",{{scale:1,duration:.18,ease:"power3.out"}},{min(t+1.875,dur-.3):.3f});'''
  write_scene(n,content,motion)
 elif n=='setup':
  content='''<div class="stack" style="top:115px"><p class="tag">A HELPER SETS THE BOUNDARIES.</p><h1 id="setup-title" class="big" style="margin-top:25px">YOUR LIMITS.</h1></div>'''
  for i,(file,title) in enumerate([('helper-origin','FAMILIAR STATIONS'),('helper-walk','COMFORTABLE WALKING'),('helper-change','FEWER CHANGES')]):
   t=i*3.125;length=min(3.125,dur-t)
   content+=f'''<div id="setup-field-{i}" class="clip" data-start="{t}" data-duration="{length}" data-track-index="2"><img class="cut-image" src="assets/images/{file}.png" alt="Actual helper setting, enlarged for readability"><p style="position:absolute;left:260px;top:745px;font-size:34px;font-weight:700">{title}</p></div>'''
  write_scene(n,content,'tl.fromTo("#setup-title",{x:60},{x:0,duration:.22,ease:"power4.out"},0);',bg='#f5f4ee')
  # Cream scene needs dark ink; source is an enlarged crop of the real form.
  p=d/f'{n}.html';p.write_text(p.read_text().replace('#root{background:#f5f4ee}','#root{background:#f5f4ee;color:#091b1d}'))
 elif n=='runtime':
  content='''<div class="stack" style="top:125px"><p class="tag">NATIVE INPUT. LIVE SERVICE.</p><h1 class="big" style="margin-top:35px"><span id="runtime-a" class="line">REMOTE → ANDROID.</span><span id="runtime-b" class="line accent">ONE CLEAR UI.</span><span id="runtime-c" class="line">REAL TFL DATA.</span></h1><p id="runtime-d" class="sub" style="margin-top:50px">Private Azure preview. No laptop required.</p></div>'''
  motion=''
  for i,id in enumerate(['runtime-a','runtime-b','runtime-c','runtime-d']):motion+=f'''tl.fromTo("#{id}",{{opacity:0,y:35}},{{opacity:1,y:0,duration:.2,ease:"power4.out"}},{i*1.875});'''
  write_scene(n,content,motion)
 elif n=='proof':
  content='''<div class="stack" style="top:110px"><p class="tag">WORKING PROTOTYPE. CHECKABLE RESULTS.</p><h1 style="font-size:270px;margin-top:25px"><span id="proof-count">33/33</span></h1><p class="sub">AUTOMATED TESTS PASSED</p><h2 id="proof-native" style="font-size:85px;margin-top:55px;color:#efb879">NATIVE D-PAD. REAL TFL. PRIVATE HTTPS.</h2><p id="proof-next" class="small" style="margin-top:40px">Next: testing with older adults and helpers.<br>No target-user results claimed.</p></div>'''
  motion='''tl.fromTo("#proof-count",{scale:1.2,opacity:0},{scale:1,opacity:1,duration:.2,ease:"power4.out"},0);tl.fromTo("#proof-native",{x:80,opacity:0},{x:0,opacity:1,duration:.22,ease:"power3.out"},3.75);tl.fromTo("#proof-next",{opacity:0},{opacity:1,duration:.15},7.5);'''
  write_scene(n,content,motion)
 elif n=='outro':
  content='''<div class="stack" style="top:120px"><h1 class="huge"><span id="outro-a" class="line">HANDBACK</span><span id="outro-b" class="line">TV<span style="color:#173b3d">.</span></span></h1><p id="outro-c" class="sub" style="margin-top:28px">GIVE THE EVERYDAY BACK.</p></div><div class="credits" style="color:#091b1d">Android TV emulator · London planning prototype · No ticket sales<br>Synthetic Kokoro narration · Music: Phonk Execution, Alex-Productions<br>onsound.eu / free-stock-music.com · CC BY 3.0 · Edited and mixed</div>'''
  motion='''tl.fromTo("#outro-a",{x:-90},{x:0,duration:.2,ease:"power4.out"},0);tl.fromTo("#outro-b",{x:90,opacity:0},{x:0,opacity:1,duration:.2,ease:"power4.out"},.46);tl.fromTo("#outro-c",{opacity:0},{opacity:1,duration:.12},1.875);'''
  write_scene(n,content,motion,bg='#efb879');p=d/f'{n}.html';p.write_text(p.read_text().replace('#root{background:#efb879}','#root{background:#efb879;color:#091b1d}'))
# Source word timings preserve what's actually spoken, with product spelling corrected.
words=[]
for s in spec['scenes']:
 measured=json.loads((out/'transcripts'/s['id']/'transcript.json').read_text())
 for w in measured:
  if w['start']>=s['audioDuration']:continue
  v=dict(w);v['start']=s['start']+.3+w['start'];v['end']=min(s['start']+.3+s['audioDuration'],s['start']+.3+w['end']);words.append(v)
groups=[];buffer=[]
for w in words:
 if buffer and w['start']-buffer[-1]['end']>.18:groups.append(buffer);buffer=[]
 buffer.append(w)
 if len(buffer)>=5 or w['text'].endswith(('.', '?','!')):groups.append(buffer);buffer=[]
if buffer:groups.append(buffer)
caphtml=[]
for i,g in enumerate(groups):
 text=' '.join(w['text'] for w in g).replace('Hand back','Handback').replace('transport for London','Transport for London')
 start=g[0]['start'];next_start=groups[i+1][0]['start'] if i+1<len(groups) else duration;end=min(duration,next_start,g[-1]['end']+.08)
 caphtml.append(f'''<div id="caption-{i}" class="clip caption-window" data-start="{start:.3f}" data-duration="{max(.08,end-start):.3f}" data-track-index="3"><span>{html.escape(text)}</span></div>''')
capcss='''@font-face{font-family:Body;src:url('assets/fonts/Inter.ttf')}#root{position:absolute;inset:0;pointer-events:none;background:transparent}.caption-window{position:absolute;inset:0;text-align:center}.caption-window span{position:absolute;left:260px;bottom:100px;width:1400px;padding:10px 18px;background:#091b1d;color:#f5f4ee;font:700 44px/1.2 Body,Arial,sans-serif;letter-spacing:-.3px;border-radius:5px}'''
(d/'captions.html').write_text(f'''<template><style>{capcss}</style><div id="root" data-composition-id="captions" data-width="1920" data-height="1080">{''.join(caphtml)}</div><script>const tl=gsap.timeline({{paused:true}});window.__timelines.captions=tl;</script></template>''')
def clock(t):
 ms=round(t*1000);h,ms=divmod(ms,3600000);m,ms=divmod(ms,60000);sec,ms=divmod(ms,1000);return f'{h:02}:{m:02}:{sec:02},{ms:03}'
(out/'handback-tv-judges-demo.srt').write_text('\n\n'.join(f"{i+1}\n{clock(g[0]['start'])} --> {clock(min(duration,groups[i+1][0]['start'] if i+1<len(groups) else duration,g[-1]['end']+.08))}\n"+' '.join(w['text'] for w in g).replace('Hand back','Handback') for i,g in enumerate(groups))+'\n')
hosts=[];audio=[]
for i,s in enumerate(spec['scenes']):
 n=s['id'];hosts.append(f'''<div id="{n}" class="clip scene-host" data-composition-id="{n}" data-composition-src="compositions/{n}.html" data-start="{s['start']}" data-duration="{s['duration']}" data-width="1920" data-height="1080" data-track-index="1" data-track-kind="graphics"></div>''')
 audio.append(f'''<audio id="voice-{n}" class="clip" data-start="{s['start']+.3}" data-duration="{s['audioDuration']}" data-track-index="{10+i}" data-volume="1" src="assets/voice/{n}.wav"></audio>''')
hosts.append(f'''<div id="captions" class="clip scene-host" data-composition-id="captions" data-composition-src="compositions/captions.html" data-start="0" data-duration="{duration}" data-width="1920" data-height="1080" data-track-index="3" data-track-kind="captions" style="z-index:80"></div>''')
points=[{'t':0,'v':.30}]
for s in spec['scenes']:
 a=s['start']+.3;b=a+s['audioDuration'];points.extend([{'t':max(0,a-.1),'v':.11},{'t':b,'v':.11},{'t':min(duration,b+.18),'v':.33}])
points.sort(key=lambda p:p['t']);automation=html.escape(json.dumps({'version':1,'lanes':[{'target':'volume','points':points}]}),quote=True)
audio.append(f'''<audio id="music-phonk" class="clip" data-timeline-role="music" data-start="0" data-duration="{duration}" data-track-index="30" data-volume="1" data-fade-out="0.75" data-automation="{automation}" src="assets/music/phonk-demo.wav"></audio>''')
(project/'index.html').write_text(f'''<!doctype html><html lang="en" data-composition-variables='[{{"id":"title","type":"string","label":"Project","default":"Handback TV"}},{{"id":"color-accent","type":"color","label":"Accent","default":"#efb879"}}]'><head><meta charset="utf-8"><title>Handback TV — The Beat Cut</title><script src="assets/gsap.min.js"></script><style>*{{margin:0;box-sizing:border-box}}html,body{{width:1920px;height:1080px;overflow:hidden;background:#091b1d}}#root{{position:relative;width:1920px;height:1080px}}.scene-host{{position:absolute;inset:0;width:1920px;height:1080px}}</style></head><body><div id="root" data-composition-id="main" data-start="0" data-duration="{duration}" data-width="1920" data-height="1080">{''.join(hosts+audio)}</div><script>window.__timelines=window.__timelines||{{}};const tl=gsap.timeline({{paused:true}});window.__timelines.main=tl;</script></body></html>''')
# Strongest actual music drop is original15.105, edited5.625: exact first product reveal.
(out/'demo-beat-edit-evidence.json').write_text(json.dumps({'duration':duration,'music':'Phonk Execution — Alex-Productions','sourceOffset':9.48,'firstMeasuredBassDrop':5.625,'firstProductReveal':5.625,'beatsSource':'Hyperframes signal detection 128.3 BPM','sceneStarts':[{'scene':s['id'],'start':s['start']} for s in spec['scenes']],'captionGroups':len(groups),'wordsSource':'Local Whisper timings of actual Kokoro output'},indent=2)+'\n')
print('Rebuilt full-bleed beat-cut demo:',duration,'seconds;',len(groups),'spoken caption groups.')
