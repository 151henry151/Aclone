import sqlite3,json,time
c=sqlite3.connect('file:/var/lib/aclone/aclone.sqlite?mode=ro',uri=True)
c.row_factory=sqlite3.Row
c.execute('BEGIN')
rows=lambda q:[dict(r) for r in c.execute(q)]
r=rows('SELECT id,state FROM npc_residents')
accounts=[]
for a in c.execute("SELECT state FROM accounts WHERE json_extract(state,'$.npc')=1"):
 d=json.loads(a[0]); d.pop('traveler',None); accounts.append(d)
print(json.dumps({'capturedAt':int(time.time()*1000),'worlds':rows('SELECT id,state,saved FROM worlds'),'residents':r,'accounts':accounts,'journal':rows('SELECT * FROM npc_journal WHERE id IN (SELECT id FROM (SELECT id,row_number() OVER (PARTITION BY resident ORDER BY id DESC) n FROM npc_journal) WHERE n<=200)'),'calls':rows("SELECT * FROM npc_calls WHERE at >= CAST(strftime('%s','now','start of month') AS INTEGER)*1000"),'control':rows('SELECT * FROM npc_control'),'meta':rows("SELECT * FROM meta WHERE key='npc-budget-config' OR key LIKE 'market:%'")}))
