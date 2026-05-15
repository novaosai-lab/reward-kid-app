import csv, re
from pathlib import Path
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build

PID='1Ad82zfU-qud0S6TxgLyHNsKpXQHG1b80iST7lIiANRo'
BASE=Path('/Users/nova/.openclaw/workspace')
SCOPES=['https://www.googleapis.com/auth/presentations','https://www.googleapis.com/auth/drive.file','https://www.googleapis.com/auth/drive.readonly']
creds=Credentials.from_authorized_user_file(str(BASE/'google-auth/token.json'),SCOPES)
slides=build('slides','v1',credentials=creds); drive=build('drive','v3',credentials=creds)
raw=list(csv.reader(open(BASE/'supportdev_april_gid472044289.csv')))
for i,r in enumerate(raw):
    if r and r[0]=='YEAR': header=r; data=raw[i+1:]; break
records=[dict(zip(header,r)) for r in data if len(r)>=20 and r[0]=='2026' and r[1].isdigit()]
april=[r for r in records if int(r['WEEK NO.']) in [14,15,16,17,18]]

def num(r,k):
    v=r[k].strip().replace(',','')
    return int(v) if v and v!='No Data' else 0

def pct(r,k): return float((r[k] or '0').replace('%','') or 0)
def dur_min(s):
    if not s or s=='No Data': return 0
    h=re.search(r'(\d+)\s*h',s); m=re.search(r'(\d+)\s*m',s)
    return (int(h.group(1)) if h else 0)*60+(int(m.group(1)) if m else 0)
def hm(m): return f'{m/60:.1f} ชม.'

total=sum(num(r,'Total Ticket') for r in april); amaze=sum(num(r,'AMAZE') for r in april); phoenix=sum(num(r,'Phoenix') for r in april)
miss_fr=sum(num(r,'MISSED FIRST RESPONSE') for r in april); miss_sla=sum(num(r,'MISSED SLA') for r in april); resolved=sum(num(r,'Resolve Ticket') for r in april); gchat=sum(num(r,'ggChat') for r in april)
avg_fr=sum(pct(r,'% First Response') for r in april)/len(april); avg_sla=sum(pct(r,'% SLA') for r in april)/len(april)
wavg_resp=sum(dur_min(r['AVG. Response Time'])*num(r,'Total Ticket') for r in april)/total; wavg_res=sum(dur_min(r['AVG. Resolution Time'])*num(r,'Total Ticket') for r in april)/total
peak=max(april,key=lambda r:num(r,'Total Ticket'))
prev=april[0]; last=april[-1]

p=slides.presentations().get(presentationId=PID).execute(); sids=[s['objectId'] for s in p['slides']]
req=[]
# remove slides 8 onward, keep 7-slide catchup deck
for sid in sids[7:]: req.append({'deleteObject':{'objectId':sid}})

def repl(oid,txt):
    req.append({'deleteText':{'objectId':oid,'textRange':{'type':'ALL'}}})
    req.append({'insertText':{'objectId':oid,'text':txt}})

# text replacements in copied template
repl('g3a707ba0d8f_0_93','Support Engineer Team')
repl('g3a707ba0d8f_0_96','Dev/Support Catch Up')
repl('g3a707ba0d8f_0_97','Date 05 May 26 | April Summary')
repl('g3a707ba0d8f_0_337','Agenda')
repl('g3a707ba0d8f_0_343','Agenda')
repl('g3a707ba0d8f_0_346','Support Overview\nIssue Trend\nSLA / First Response Focus\nSupport Case / Spike Insight\nFollow Up Action')
repl('g328c807cdae_1_1','SUPPORT MONTHLY OVERVIEW')
repl('g3bcb49f6991_0_0','Apr')
repl('g3bcfe6af7ae_1_0','Mar')
repl('g3274bb59e7b_2_12','SUPPORT WEEKLY OVERVIEW')
repl('g342e9e13326_0_8','🔹 Ticket Volume – April Week 14–18')
repl('g375b95c0e3e_3_6',f'Key Metrics Summary\n\nAmaze: {amaze} เคส / Phoenix: {phoenix} เคส\nTotal Ticket: {total} เคส | Resolve: {resolved} เคส\nFirst Response เฉลี่ย {avg_fr:.1f}% (Missed {miss_fr})\nSLA เฉลี่ย {avg_sla:.1f}% (Missed {miss_sla})')
repl('g366d1a805c1_0_19','🔺')
repl('g366d1a805c1_0_21','🔻')
repl('g328c807cdae_1_9','April Issue / Volume Insights (30 Mar - 3 May)')
repl('g38c64bef5e2_0_1',f'Case Summary by System:\n\n🔸 AMAZE → {amaze} tickets เป็น workload หลักของเดือน\n🔸 Phoenix → {phoenix} tickets มี spike ชัดใน Week 16 ({num(peak,"Phoenix")} tickets)\n🔸 ggChat → {gchat} cases ควรแยก owner intake ให้ชัด\n🔸 First Response → Missed {miss_fr} cases จุดเสี่ยงหลักคือ Week 15\n🔸 SLA → Missed {miss_sla} cases, ปลายเดือนดีขึ้นจน Week 18 = 100%')
repl('g3bcdc589db6_0_1','[First Response] จุดที่ควรโฟกัส: response discipline')
repl('g3d0454a85a6_1_0',f'Week 15 First Response ต่ำสุดที่ 74% และ missed 21 เคส\n\nLikely actions:\n• ตั้ง daily guardrail: missed first response > 5 ให้แจ้ง lead\n• ทำ queue sweep 2 รอบ/วันช่วง volume สูง\n• แยก owner สำหรับ ggChat / intake cases')
repl('g3d7a90b7752_1_14','[Phoenix Spike] Workload แกว่งจากเคสเฉพาะระบบ')
repl('g3d7a90b7752_1_18',f'Week 16 มี ticket สูงสุด {num(peak,"Total Ticket")} เคส โดย Phoenix = {num(peak,"Phoenix")} เคส\n\nFollow up:\n• Tag Phoenix spike แยกจาก BAU\n• ทำ mini-RCA ว่า spike มาจาก issue/theme ไหน\n• เตรียม playbook เมื่อ Phoenix > 40 tickets/week')

# helper create text box overlays / appendix
W=10_000_000; H=5_625_000
def emu(v): return {'magnitude':v,'unit':'EMU'}
def pt(v): return {'magnitude':v,'unit':'PT'}
def color(hex): return {'red':int(hex[:2],16)/255,'green':int(hex[2:4],16)/255,'blue':int(hex[4:],16)/255}
def textbox(sid, oid, txt, x,y,w,h, size=14, bold=False, c='222222'):
    req.append({'createShape':{'objectId':oid,'shapeType':'TEXT_BOX','elementProperties':{'pageObjectId':sid,'size':{'width':emu(w),'height':emu(h)},'transform':{'scaleX':1,'scaleY':1,'translateX':x,'translateY':y,'unit':'EMU'}}}})
    req.append({'insertText':{'objectId':oid,'text':txt}})
    req.append({'updateTextStyle':{'objectId':oid,'style':{'fontSize':pt(size),'bold':bold,'fontFamily':'Arial','foregroundColor':{'opaqueColor':{'rgbColor':color(c)}}},'fields':'fontSize,bold,fontFamily,foregroundColor'}})
def rect(sid,oid,x,y,w,h,c='FFFFFF'):
    req.append({'createShape':{'objectId':oid,'shapeType':'RECTANGLE','elementProperties':{'pageObjectId':sid,'size':{'width':emu(w),'height':emu(h)},'transform':{'scaleX':1,'scaleY':1,'translateX':x,'translateY':y,'unit':'EMU'}}}})
    req.append({'updateShapeProperties':{'objectId':oid,'shapeProperties':{'shapeBackgroundFill':{'solidFill':{'color':{'rgbColor':color(c)},'alpha':0.92}},'outline':{'propertyState':'NOT_RENDERED'}},'fields':'shapeBackgroundFill.solidFill,outline.propertyState'}})

# overlay metric cards on slide 3 to reduce old-chart dependency
sid=sids[2]
rect(sid,'apr_m_cover_01',700000,1200000,8600000,3300000,'FFFFFF')
metrics=[('Total Tickets',str(total)),('Avg FR',f'{avg_fr:.1f}%'),('Avg SLA',f'{avg_sla:.1f}%'),('Resolved',str(resolved)),('ggChat',str(gchat))]
for i,(a,b) in enumerate(metrics):
    x=900000+i*1700000
    textbox(sid,f'apr_met_{i}_a',b,x,1600000,1300000,420000,26,True,'1A73E8')
    textbox(sid,f'apr_met_{i}_b',a,x,2050000,1300000,260000,11,False,'444444')
textbox(sid,'apr_month_narrative','ภาพรวม April: SLA แข็งแรง แต่ First Response ยังเป็นจุดที่ต้องคุมวินัย โดยเฉพาะ Week 15\nVolume peak ที่ Week 16 จาก Phoenix spike และปลายเดือน SLA recover ดีจน Week 18 = 100%',900000,2850000,7800000,900000,16,False,'222222')

# slide 7 appendix replace old voucher case with weekly data
sid=sids[6]
rect(sid,'apr_app_cover_01',500000,1000000,8800000,3800000,'FFFFFF')
textbox(sid,'apr_app_title','Appendix: Weekly Data',700000,1150000,8000000,400000,24,True,'111111')
lines=['Week | Period | Tickets | AMAZE | Phoenix | FR% | SLA% | Resolved | ggChat']
for r in april:
    lines.append(f"W{r['WEEK NO.']} | {r['From Date']}–{r['To Date']} | {r['Total Ticket']} | {r['AMAZE']} | {r['Phoenix']} | {r['% First Response']} | {r['% SLA']} | {r['Resolve Ticket']} | {r['ggChat']}")
textbox(sid,'apr_app_table','\n'.join(lines),700000,1750000,8200000,2100000,12,False,'222222')
textbox(sid,'apr_app_src','Source: Support Performance Report 2026 (Google Sheet gid 472044289)',700000,4200000,8200000,300000,10,False,'666666')

# Apply
for i in range(0,len(req),80): slides.presentations().batchUpdate(presentationId=PID, body={'requests':req[i:i+80]}).execute()
# rename + share
try: drive.files().update(fileId=PID, body={'name':'Catch up SupportDev April 2026 TH - Same Tone'}, fields='id').execute()
except Exception as e: print('rename warn',e)
try: drive.permissions().create(fileId=PID, body={'type':'anyone','role':'reader'}, fields='id').execute()
except Exception as e: print('perm warn',e)
url=f'https://docs.google.com/presentation/d/{PID}/edit'
(BASE/'google-slides-template-style-final-url.txt').write_text(url+'\n')
print(url)
