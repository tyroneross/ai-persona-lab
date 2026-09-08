"""Build a task-configured persona output comparison. Python standard library only."""
import argparse,hashlib,html,json,shutil,re
from pathlib import Path

def build(config_path,out):
 config=json.loads(config_path.read_text());task=config['task'];labels=task['sections'];drafts=[]
 if out.exists() and any(out.iterdir()):raise ValueError('Output directory must be empty; use a new directory to preserve saved choices')
 if task.get('linkBase') and not re.match(r'^https?://[^/]+/',task['linkBase']):raise ValueError('linkBase must be an absolute HTTP(S) directory URL')
 if not labels or not isinstance(labels,dict):raise ValueError('task.sections must map stable keys to labels')
 if any(not re.fullmatch(r'[a-z][a-z0-9_-]{0,63}',k) or k in {'full','structure','words'} for k in labels):raise ValueError('Comparison keys must be safe stable ids, excluding full/structure/words')
 for d in config['reviewers']:
  if not re.fullmatch(r'[a-z][a-z0-9_-]{0,63}',d['id']):raise ValueError('Reviewer ids must be safe stable ids')
  if len(d['sections'])!=len(labels) or {s['key'] for s in d['sections']}!=set(labels):raise ValueError('Each reviewer must cover the same comparison units')
  d=dict(d);d['wordChoices']=d.get('wordChoices',[]);d['markdown']='\n\n'.join(s['markdown'] for s in d['sections'])+'\n';d['words']=len(d['markdown'].split());d['hash']=hashlib.sha256(d['markdown'].encode()).hexdigest()
  for w in d['wordChoices']:
   if w['phrase'] not in d['markdown']:raise ValueError('Choice phrase must appear in the output')
  for field in ['name','subtitle','philosophy','strength','tradeoff']:d.setdefault(field,'')
  drafts.append(d)
 if len(drafts)<2 or len({d['id'] for d in drafts})!=len(drafts):raise ValueError('At least two reviewers with unique ids are required')
 digest=hashlib.sha256(config_path.read_bytes()).hexdigest()[:16]
 data={'version':'persona-comparison-'+digest,'labels':labels,'drafts':drafts,'baseline':task.get('baseline','No source artifact supplied.'),'sourceCommit':task.get('sourceReference','Supplied comparison inputs'),'linkBase':task.get('linkBase',''),'ui':{'summaryTitle':task['title'],'summaryText':task['description'],'sourceNote':task['provenance'],'exportName':task.get('exportName','selected-output.md')}}
 a=Path(__file__).resolve().parent.parent/'assets';shell=(a/'shell.html').read_text()
 substitutions={k:html.escape(v) for k,v in {'title':task['title'],'description':task['description'],'kind':task.get('kind','Persona outputs'),'eyebrow':f"{task.get('kind','Comparison')} · {len(drafts)} perspectives"}.items()}
 app=(a/'app.js').read_text().replace('/*__DATA__*/',json.dumps(data).replace('<','\\u003c'))
 substitutions.update({'CSS':(a/'app.css').read_text(),'APP':app})
 shell=re.sub(r'\{\{(title|description|kind|eyebrow)\}\}|/\*(CSS|APP)\*/',lambda m:substitutions[m[1] or m[2]],shell)
 out.mkdir(parents=True,exist_ok=True);(out/'index.html').write_text(shell);(out/'manifest.json').write_text(json.dumps(data,indent=2));shutil.copy2(a/'serve.py',out/'serve.py')
 print(f'Created {out / "index.html"}; {len(drafts)} perspectives, {len(labels)} comparison units. Run python3 {out / "serve.py"} for agent-readable autosave.')
 return data
if __name__=='__main__':
 parser=argparse.ArgumentParser();parser.add_argument('input',type=Path);parser.add_argument('--out',type=Path,required=True);args=parser.parse_args();build(args.input,args.out)
