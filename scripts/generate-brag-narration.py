"""Generate the explicitly requested Brag Kokoro narration locally, without keys or cloud TTS."""
from pathlib import Path
import subprocess,json,os,time,shutil
root=Path(__file__).resolve().parents[1];out=root/'brag-output'
model=Path.home()/'.cache/hyperframes/tts/models/kokoro-v1.0.onnx'
while not model.exists():time.sleep(1)
env=dict(os.environ,HYPERFRAMES_PYTHON=str(root/'.tools/brag-venv/bin/python'))
script=json.loads((out/'demo-script.json').read_text())
voice=out/'judges-demo/assets/voice';voice.mkdir(parents=True,exist_ok=True)
results=[]
for scene in script['scenes']:
 target=voice/f"{scene['id']}.wav"
 if not target.exists():
  r=subprocess.run(['npx','--yes','hyperframes@0.8.186','tts',str(out/'narration'/f"{scene['id']}.txt"),'--voice','af_heart','--speed','0.96','--output',str(target),'--json'],env=env,cwd=root,text=True,capture_output=True,check=True)
  result=json.loads(r.stdout.strip().splitlines()[-1]);assert result['ok'],result
 duration=float(subprocess.check_output(['ffprobe','-v','error','-show_entries','format=duration','-of','csv=p=0',str(target)]))
 scene['audioDuration']=duration;scene['duration']=max(scene['duration'],round(duration+0.8,2));results.append({'scene':scene['id'],'seconds':duration})
 print(scene['id'],round(duration,2),'seconds',flush=True)
start=0
for s in script['scenes']:s['start']=round(start,3);start+=s['duration']
script['duration']=round(start,3);assert start<175,'Narration exceeds a safe hackathon window'
(out/'demo-script.json').write_text(json.dumps(script,indent=2,ensure_ascii=False)+'\n')
short=out/'composition/assets/voice';short.mkdir(exist_ok=True)
target=short/'trailer.wav'
if not target.exists():subprocess.run(['npx','--yes','hyperframes@0.8.186','tts',str(out/'narration/trailer.txt'),'--voice','af_heart','--speed','0.96','--output',str(target),'--json'],env=env,cwd=root,check=True)
(out/'voice-verification.json').write_text(json.dumps({'engine':'Hyperframes local Kokoro-82M, original float32 model','voice':'af_heart','synthetic':True,'speed':0.96,'measuredNotSubjectivelyHeard':True,'scenes':results,'filmDuration':start},indent=2)+'\n')
print('All local narration generated; film duration',start,flush=True)
