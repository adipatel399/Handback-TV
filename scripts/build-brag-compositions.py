"""Build editable Hyperframes compositions from actual Handback captures and local narration."""
from pathlib import Path
import json,html,shutil
root=Path(__file__).resolve().parents[1];out=root/'brag-output';script=json.loads((out/'demo-script.json').read_text())
css='''@font-face{font-family:FilmSerif;src:url('assets/fonts/EBGaramond.ttf')}@font-face{font-family:FilmSans;src:url('assets/fonts/Inter.ttf')}*{box-sizing:border-box}#root{position:absolute;inset:0;background:#173b3d;color:#f5f4ee;font-family:FilmSans,Arial,sans-serif;overflow:hidden}h1,h2,p{margin:0}h1{font-family:FilmSerif,Georgia,serif;font-weight:500;font-size:136px;line-height:1.02;letter-spacing:-2px} .accent{color:#efb879}.eyebrow{font-size:30px;letter-spacing:3px;text-transform:uppercase;color:#d8e4d0;font-weight:600}.copy{font-size:38px;line-height:1.5;color:#d8e4d0}.source{position:absolute;left:260px;top:48px;width:1400px;font-size:28px;line-height:36px;color:#d8e4d0}.surface{position:absolute;left:260px;top:100px;width:1400px;height:788px;object-fit:contain}.hero-copy{position:absolute;left:192px;top:245px;width:1140px}.hero-copy .copy{margin-top:32px;max-width:1000px}.hero-copy .eyebrow{margin-bottom:28px}.brand{font-family:FilmSans;font-size:100px;letter-spacing:-5px;font-weight:700}.brand small{font-size:34px;letter-spacing:3px;color:#efb879}.remote{position:absolute;right:210px;top:150px;width:310px;height:680px}.credit{font-size:28px;line-height:1.45;color:#d8e4d0}.legal{position:absolute;left:192px;right:192px;top:770px;line-height:1.5;font-size:28px;color:#d8e4d0}'''
remote='''<svg viewBox="0 0 310 680" aria-label="Illustrated remote control" style="width:100%;height:100%"><rect x="20" y="4" width="270" height="672" rx="105" fill="#234d4f" stroke="#d8e4d0" stroke-width="5"/><circle cx="155" cy="100" r="15" fill="#efb879"/><circle cx="155" cy="279" r="102" fill="#173b3d" stroke="#efb879" stroke-width="6"/><circle cx="155" cy="279" r="49" fill="#efb879"/><text x="155" y="291" text-anchor="middle" fill="#173b3d" font-family="Arial" font-size="34" font-weight="700">OK</text><path d="m155 195-15 18h30z m0 168-15-18h30z m-84-84 18-15v30z m168 0-18-15v30z" fill="#f5f4ee"/><path d="m100 453-22 18 22 18 M80 471h42" fill="none" stroke="#f5f4ee" stroke-width="7" stroke-linecap="round"/><path d="m187 448 27 22-27 22z" fill="#f5f4ee"/><path d="M227 449v43" stroke="#f5f4ee" stroke-width="7"/><rect x="83" y="551" width="144" height="18" rx="9" fill="#d8e4d0" opacity=".7"/></svg>'''
def scene(project,name,content,duration,move=None,bg='#173b3d'):
 d=project/'compositions';d.mkdir(exist_ok=True)
 motion=move or f'''tl.fromTo("#{name}-content",{{opacity:0,y:24}},{{opacity:1,y:0,duration:.5,ease:"power4.out"}},0.06);'''
 text=f'''<template><style>{css}#root{{background:{bg}}}</style><div id="root" data-composition-id="{name}" data-width="1920" data-height="1080">{content}</div><script>const tl=gsap.timeline({{paused:true}});{motion}window.__timelines["{name}"]=tl;</script></template>'''
 (d/f'{name}.html').write_text(text)
def composition(project,scenes,duration,voices=True,trailer=False):
 hosts=[]
 for s in scenes:
  hosts.append(f'''<div id="{s['id']}" class="clip scene-host" data-composition-id="{s['id']}" data-composition-src="compositions/{s['id']}.html" data-start="{s['start']}" data-duration="{s['duration']}" data-width="1920" data-height="1080" data-track-index="1" data-track-kind="graphics"></div>''')
 aud=[]
 if voices:
  for i,s in enumerate(scenes):
   file='trailer' if trailer else s['id'];start=.4 if trailer else s['start']+.3
   length=script['duration'] if trailer else s.get('audioDuration',s['duration']-.6)
   if trailer:length=23.0
   if not (project/f'assets/voice/{file}.wav').exists():continue
   aud.append(f'<audio id="voice-{file}" class="clip" data-start="{start}" data-duration="{length}" data-track-index="{10+i}" data-volume="1" src="assets/voice/{file}.wav"></audio>')
   if trailer:break
 # One seamless extended music asset for main; quiet enough to preserve narration.
 music='bed.mp3' if trailer else 'bed-long.wav'
 aud.append(f'<audio id="music" class="clip" data-start="0" data-duration="{duration}" data-track-index="30" data-volume="0.12" data-fade-in="0.6" data-fade-out="1.6" src="assets/music/{music}"></audio>')
 # Sparse accents have real visible causes; no synthetic UI click sound is claimed as device audio.
 for i,t in enumerate(([4.39,18.56] if trailer else [6.5,80,143])):
  aud.append(f'<audio id="accent-{i}" class="clip" data-start="{t}" data-duration="0.18" data-track-index="{40+i}" data-volume="0.32" src="assets/sfx/impactSoft_medium_001.ogg"></audio>')
 captions=project/'compositions/captions.html'
 if captions.exists():hosts.append(f'<div id="captions" class="clip scene-host" data-composition-id="captions" data-composition-src="compositions/captions.html" data-start="0" data-duration="{duration}" data-width="1920" data-height="1080" data-track-index="3" data-track-kind="captions" style="z-index:80"></div>')
 title='Handback TV — Brag trailer' if trailer else 'Handback TV — judges demonstration'
 body=''.join(hosts+aud)
 (project/'index.html').write_text(f'''<!doctype html><html lang="en" data-composition-variables='[{{"id":"color-ground","type":"color","label":"Background","default":"#173b3d"}},{{"id":"color-accent","type":"color","label":"Accent","default":"#efb879"}},{{"id":"title","type":"string","label":"Product name","default":"Handback TV"}}]'><head><meta charset="utf-8"><title>{title}</title><script src="assets/gsap.min.js"></script><style>*{{margin:0;box-sizing:border-box}}html,body{{width:1920px;height:1080px;overflow:hidden;background:#173b3d}}#root{{position:relative;width:1920px;height:1080px}}.scene-host{{position:absolute;inset:0;width:1920px;height:1080px}}</style></head><body><div id="root" data-composition-id="main" data-start="0" data-duration="{duration}" data-width="1920" data-height="1080">{body}</div><script>window.__timelines=window.__timelines||{{}};const tl=gsap.timeline({{paused:true}});window.__timelines.main=tl;</script></body></html>''')

def workflow(project,s,src=None,offset=0,label=None):
 name=s['id'];dur=s['duration'];file=src or name
 label=label or ('Fictional booking lab · Controlled test scenario' if name in ['lab','receipt'] else 'Recorded live TfL response · Android TV emulator')
 content=f'''<div class="source">{html.escape(label)}</div><video id="{name}-video" class="clip surface" data-start="0" data-duration="{dur}" data-media-start="{offset}" data-track-index="2" muted playsinline src="assets/video/{file}.mp4"></video>'''
 scene(project,name,content,dur,move='''tl.to({}, {duration:.01},0);''')
main=out/'judges-demo'
for s in script['scenes']:
 n=s['id'];dur=s['duration']
 if n in ['choose','routes','steps','voice','saved','lab','change','receipt']:
  workflow(main,s,offset=2 if n=='saved' else 0,label='Fictional booking lab · Fare deliberately raised by ₹20' if n=='change' else None);continue
 if n=='hook':
  content=f'''<div id="hook-content" class="hero-copy"><p class="eyebrow">EVERYDAY INDEPENDENCE</p><h1>A familiar remote.<br><span class="accent">Their own decision.</span></h1></div><div id="hook-remote" class="remote">{remote}</div>'''
  scene(main,n,content,dur,move='''tl.fromTo("#hook-remote",{x:120,opacity:0},{x:0,opacity:1,duration:.65,ease:"expo.out"},.15);''')
 elif n=='reveal':
  content='''<div id="reveal-content"><div style="position:absolute;left:192px;top:240px;width:620px"><p class="brand">handback <small>TV</small></p><h1 style="font-size:95px;margin-top:50px">Give the<br>everyday back.</h1></div><img id="reveal-screen" src="assets/images/home.png" alt="Actual Handback TV home screen" style="position:absolute;left:830px;top:240px;width:900px;height:506px;object-fit:contain"></div>'''
  scene(main,n,content,dur)
 elif n=='setup':
  content='''<div id="setup-content"><p class="source">A helper chooses public stations and comfortable limits</p><img class="surface" src="assets/images/helper-journeys.png" alt="Actual helper journey settings"><div id="setup-note" style="position:absolute;left:300px;top:790px;width:1320px;padding:16px;background:#173b3d;font-size:32px;text-align:center">Walking limit. Change limit. Step-free preference.</div></div>'''
  scene(main,n,content,dur,move='''tl.fromTo("#setup-content",{opacity:0},{opacity:1,duration:.2},0);tl.fromTo("#setup-note",{opacity:0,y:20},{opacity:1,y:0,duration:.4,ease:"power4.out"},5);''')
 elif n=='runtime':
  content='''<div id="runtime-content" class="hero-copy" style="top:150px;width:1536px"><p class="eyebrow">NATIVE INPUT. A LIVE SERVICE.</p><h1 style="font-size:116px">Built for the remote.</h1><div style="display:flex;gap:55px;align-items:center;margin-top:95px;font-size:44px"><span id="runtime-a">D-pad + Play/Pause<br><small style="font-size:30px;color:#d8e4d0">Native Android launcher</small></span><span aria-hidden="true" style="color:#efb879">→</span><span id="runtime-b">One clear interface<br><small style="font-size:30px;color:#d8e4d0">WebView + spoken guidance</small></span><span aria-hidden="true" style="color:#efb879">→</span><span id="runtime-c">Live journeys<br><small style="font-size:30px;color:#d8e4d0">Node service + TfL</small></span></div><p class="copy" style="margin-top:85px">Private Azure preview. Runs without the laptop.</p></div>'''
  scene(main,n,content,dur,move='''tl.fromTo("#runtime-content",{opacity:0},{opacity:1,duration:.2},0);tl.fromTo("#runtime-a",{opacity:0},{opacity:1,duration:.3},.5);tl.fromTo("#runtime-b",{opacity:0},{opacity:1,duration:.3},2.5);tl.fromTo("#runtime-c",{opacity:0},{opacity:1,duration:.3},4.5);''')
 elif n=='proof':
  content='''<div id="proof-content"><div class="hero-copy" style="top:150px;width:620px"><p class="eyebrow">WORKING PROTOTYPE</p><h1 style="font-size:105px">Built. Tested.<br>Still learning.</h1><p style="font-size:132px;font-weight:600;margin-top:25px;color:#efb879">33</p><p class="copy">automated tests passed</p></div><img src="assets/images/helper-observations.png" alt="Actual observation dashboard with zero participant studies" style="position:absolute;left:870px;top:150px;width:850px;height:630px;object-fit:contain"><p id="proof-next" style="position:absolute;left:870px;top:735px;width:850px;font-size:32px;line-height:1.5">Next: testing with older adults and helpers.<br>Zero target-user results claimed.</p></div>'''
  scene(main,n,content,dur)
 elif n=='outro':
  content='''<div id="outro-content" class="hero-copy" style="top:155px;width:1536px"><p class="brand">handback <small>TV</small></p><h1 style="margin-top:45px">Give the everyday back.</h1><p class="copy" style="margin-top:35px">A helper sets the boundaries. The person keeps the decision.</p></div><div class="legal">London planning prototype · No ticketing · Synthetic Kokoro narration<br>Original Android TV emulator footage<br>Music: Sascha Ende, Happy Beats / Business Moves Vol.12 · ende.app · CC BY 4.0 · Edited/faded</div>'''
  scene(main,n,content,dur)
composition(main,script['scenes'],script['duration'])
short=out/'composition';shortscenes=[dict(id='premise',start=0,duration=4.4),dict(id='actual',start=4.4,duration=6.5),dict(id='clarity',start=10.9,duration=7.7),dict(id='finish',start=18.6,duration=5.4)]
scene(short,'premise',f'''<div id="premise-content" class="hero-copy"><p class="eyebrow">A FAMILIAR REMOTE.</p><h1>Their own<br><span class="accent">decision.</span></h1></div><div id="premise-remote" class="remote">{remote}</div>''',4.4,move='''tl.fromTo("#premise-remote",{x:110,opacity:0},{x:0,opacity:1,duration:.55,ease:"expo.out"},.1);''')
workflow(short,shortscenes[1],src='trailer-route')
scene(short,'clarity','''<p class="source">One clear step at a time · Actual Android TV emulator</p><video id="clarity-step" class="clip surface" data-start="0" data-duration="4.2" data-track-index="2" muted playsinline src="assets/video/trailer-steps.mp4"></video><video id="clarity-save" class="clip surface" data-start="4.2" data-duration="3.5" data-track-index="2" muted playsinline src="assets/video/trailer-save.mp4"></video>''',7.7,move='''tl.to({}, {duration:.01},0); // beat-locked: instruction reveal at 10.9s, near cue 10.93s''')
scene(short,'finish','''<div id="finish-content" class="hero-copy" style="top:180px;width:1536px"><p class="brand">handback <small>TV</small></p><h1 style="margin-top:45px">Give the everyday back.</h1><p class="copy" style="margin-top:40px">Real London journeys. Clear, spoken steps.</p></div><div class="legal">Android TV emulator · Journey planning, no ticketing · Synthetic Kokoro narration<br>Music: Sascha Ende / ende.app · CC BY 4.0 · Edited/faded</div>''',5.4,move='''tl.fromTo("#finish-content",{opacity:0,y:30},{opacity:1,y:0,duration:.5,ease:"expo.out"},0); // beat-locked: end-card entry at 18.6s, near cue 18.56s''')
composition(short,shortscenes,24,trailer=True)
(out/'share-copy.txt').write_text('A familiar remote. Their own decision. Handback TV brings real London journey planning, spoken steps, and helper-defined limits to the television.\n')
print('Built 24-second trailer and',script['duration'],'second judging film, with local editable source.')
