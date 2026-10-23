"""Assemble actual captured emulator footage and original narration into a local review video."""
from pathlib import Path
import subprocess,json
root=Path(__file__).resolve().parents[1]
out=root/'artifacts'; raw=out/'raw'; raw.mkdir(parents=True,exist_ok=True)
segments=[
 (0,"A familiar remote can be an opportunity to give a decision back. Handback TV explores that through everyday travel planning."),
 (12,"A helper chooses public London stations, comfortable walking and change limits, and a step free routing preference. The destination remains the person's choice."),
 (25,"These are actual journey options from Transport for London. Handback checks walking and changes, shows when the information was fetched, and keeps London time."),
 (38,"Review the journey before opening one instruction at a time. Large focus states and a predictable remote keep the choices deliberate."),
 (52,"Play and pause reads the current instruction aloud, then stops. This emulator uses local speech on the paired Mac, played through native Android audio."),
 (70,"The reviewed route is saved locally. This is a reminder, not a ticket. Reopening it checks fresh travel information rather than trusting an old copy."),
 (86,"Now a separate, clearly labelled booking lab. Its fictional shuttle provider lets us demonstrate transaction failures without booking a real journey or taking payment."),
 (103,"Before confirmation, the lab shows the exact passenger, pickup, destination, date, and fare. Here we deliberately increase the fare after that preview."),
 (118,"The old confirmation is rejected. Only a fresh review can proceed. The browser adapter then reads the provider's stored reservation before showing success."),
 (143,"The observation tool separates self tests, automation, and participants. Target user results remain uncollected. A helper sets the boundaries. The person keeps the decision.")
]
for i,(start,text) in enumerate(segments):
 p=raw/f'narration-{i}.txt';p.write_text(text)
 subprocess.run(['/usr/bin/say','-v','Samantha (English (US))','-r','165','-f',str(p),'-o',str(raw/f'narration-{i}.aiff')],check=True)
 def probe(file): return float(subprocess.check_output(['ffprobe','-v','error','-show_entries','format=duration','-of','default=nw=1:nk=1',str(file)]))
 duration=probe(raw/f'narration-{i}.aiff')
 print('narration',i,'at',start,'seconds, duration',round(duration,2))
# Actual helper screenshot bookends the real emulator screen recording.
common=['-vf','scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=0x112f35,setsar=1','-r','30','-c:v','libx264','-preset','veryfast','-crf','20','-pix_fmt','yuv420p','-an']
for name,image,duration in [('intro','helper-live-setup.png',12),('outro','helper-study.png',16)]:
 subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y','-loop','1','-i',str(out/'screenshots'/image),'-t',str(duration),*common,str(raw/f'{name}.mp4')],check=True)
native_common=common.copy();native_common[1]+=',tpad=stop_mode=clone:stop_duration=30'
subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y','-i',str(raw/'handback-upgrade.mp4'),'-t','130',*native_common,str(raw/'walkthrough-normalized.mp4')],check=True)
files=raw/'concat.txt';files.write_text(''.join("file '"+str(raw/p)+"'\n" for p in ['intro.mp4','walkthrough-normalized.mp4','outro.mp4']))
subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y','-f','concat','-safe','0','-i',str(files),'-c','copy',str(raw/'picture.mp4')],check=True)
args=['ffmpeg','-hide_banner','-loglevel','error','-y','-i',str(raw/'picture.mp4')]
for i in range(len(segments)):args+=['-i',str(raw/f'narration-{i}.aiff')]
filters=[]
for i,(start,_) in enumerate(segments):filters.append(f'[{i+1}:a]adelay={start*1000}|{start*1000},volume=1[a{i}]')
filters.append(''.join(f'[a{i}]' for i in range(len(segments)))+f'amix=inputs={len(segments)}:duration=longest:normalize=0,alimiter=limit=0.95[mix]')
# A persistent original typography overlay identifies the test environment.
label=raw/'video-label.png'
subprocess.run(['magick','-size','1920x38','xc:#102d35','-font','/System/Library/Fonts/Supplemental/Arial.ttf','-pointsize','20','-fill','#eee8d6','-gravity','center','-annotate','0','HANDBACK TV  |  Android TV emulator  |  Real TfL journey data  |  Fictional booking lab',str(label)],check=True)
args+=['-loop','1','-framerate','30','-i',str(label)]
filters.append(f'[0:v][{len(segments)+1}:v]overlay=0:0:repeatlast=1:eof_action=repeat[v]')
args+=['-filter_complex',';'.join(filters),'-map','[v]','-map','[mix]','-t','158','-c:v','libx264','-preset','veryfast','-crf','20','-pix_fmt','yuv420p','-c:a','aac','-b:a','160k','-movflags','+faststart',str(out/'handback-tv-demo-review.mp4')]
subprocess.run(args,check=True)
# A sidecar transcript for review and optional caption editing.
(out/'demo-transcript.txt').write_text('\n\n'.join(f'{start:03d}s  {text}' for start,text in segments)+'\n')
print('Saved',out/'handback-tv-demo-review.mp4')
