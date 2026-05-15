import csv, re, json
from pathlib import Path
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build

BASE=Path('/Users/nova/.openclaw/workspace')
TOKEN=BASE/'google-auth/token.json'
CSV=BASE/'supportdev_april_gid472044289.csv'
SCOPES=['https://www.googleapis.com/auth/presentations','https://www.googleapis.com/auth/drive.file']
creds=Credentials.from_authorized_user_file(str(TOKEN), SCOPES)
slides=build('slides','v1',credentials=creds)
drive=build('drive','v3',credentials=creds)

raw=list(csv.reader(open(CSV)))
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

total=sum(num(r,'Total Ticket') for r in april); amaze=sum(num(r,'AMAZE') for r in april); phoenix=sum(num(r,'Phoenix') for r in april); kd=sum(num(r,'KD') for r in april)
miss_fr=sum(num(r,'MISSED FIRST RESPONSE') for r in april); miss_sla=sum(num(r,'MISSED SLA') for r in april); resolved=sum(num(r,'Resolve Ticket') for r in april); gchat=sum(num(r,'ggChat') for r in april)
avg_fr=sum(pct(r,'% First Response') for r in april)/len(april); avg_sla=sum(pct(r,'% SLA') for r in april)/len(april)
wavg_resp=sum(dur_min(r['AVG. Response Time'])*num(r,'Total Ticket') for r in april)/total; wavg_res=sum(dur_min(r['AVG. Resolution Time'])*num(r,'Total Ticket') for r in april)/total
peak=max(april,key=lambda r:num(r,'Total Ticket'))

presentation=slides.presentations().create(body={'title':'Catch up SupportDev April 2026'}).execute()
pid=presentation['presentationId']
# remove default first slide after adding ours? Use existing blank as first.
existing=presentation['slides'][0]['objectId']

W=10_000_000; H=5_625_000
COL={'navy':'123856','blue':'2C7BE5','cyan':'1EBEBE','green':'27AE60','orange':'F2994A','red':'EB5757','gray':'5F6F7B','light':'F4F7FB','white':'FFFFFF'}

def rgb(hex):
    return {'red':int(hex[0:2],16)/255,'green':int(hex[2:4],16)/255,'blue':int(hex[4:6],16)/255}

def pt(x): return {'magnitude':x,'unit':'PT'}
def emu(x): return {'magnitude':x,'unit':'EMU'}
requests=[]
slide_ids=[]

def new_slide(sid):
    requests.append({'createSlide':{'objectId':sid,'slideLayoutReference':{'predefinedLayout':'BLANK'}}}); slide_ids.append(sid)

def shape(sid, oid, x,y,w,h, fill='white', radius=True):
    requests.append({'createShape':{'objectId':oid,'shapeType':'ROUND_RECTANGLE' if radius else 'RECTANGLE','elementProperties':{'pageObjectId':sid,'size':{'width':emu(w),'height':emu(h)},'transform':{'scaleX':1,'scaleY':1,'translateX':x,'translateY':y,'unit':'EMU'}}}})
    requests.append({'updateShapeProperties':{'objectId':oid,'shapeProperties':{'shapeBackgroundFill':{'solidFill':{'color':{'rgbColor':rgb(COL[fill])}}},'outline':{'outlineFill':{'solidFill':{'color':{'rgbColor':rgb(COL.get(fill,'white'))}}}}},'fields':'shapeBackgroundFill.solidFill.color,outline.outlineFill.solidFill.color'}})

def text(sid, oid, txt, x,y,w,h, size=14, color='navy', bold=False, align='START'):
    requests.append({'createShape':{'objectId':oid,'shapeType':'TEXT_BOX','elementProperties':{'pageObjectId':sid,'size':{'width':emu(w),'height':emu(h)},'transform':{'scaleX':1,'scaleY':1,'translateX':x,'translateY':y,'unit':'EMU'}}}})
    requests.append({'insertText':{'objectId':oid,'text':txt}})
    requests.append({'updateTextStyle':{'objectId':oid,'style':{'fontSize':pt(size),'foregroundColor':{'opaqueColor':{'rgbColor':rgb(COL[color])}},'bold':bold,'fontFamily':'Arial'},'fields':'fontSize,foregroundColor,bold,fontFamily'}})
    requests.append({'updateParagraphStyle':{'objectId':oid,'style':{'alignment':align},'fields':'alignment'}})

def bg(sid):
    shape(sid,f'{sid}_bg',0,0,W,H,'light',False)

def title(sid,t,sub=''):
    text(sid,f'{sid}_title',t,420000,260000,9200000,430000,24,'navy',True)
    if sub: text(sid,f'{sid}_sub',sub,430000,700000,9000000,260000,10,'gray')

def metric(sid,oid,x,y,w,h,label,value,sub,color):
    shape(sid,oid,x,y,w,h,color,True)
    text(sid,oid+'v',value,x+30000,y+95000,w-60000,250000,22,'white',True,'CENTER')
    text(sid,oid+'l',label,x+30000,y+390000,w-60000,160000,10,'white',False,'CENTER')
    if sub: text(sid,oid+'s',sub,x+30000,y+540000,w-60000,130000,8,'white',False,'CENTER')

def bullets(sid,oid,x,y,w,h,head,items,color='blue'):
    shape(sid,oid,x,y,w,h,'white',True)
    text(sid,oid+'h',head,x+160000,y+120000,w-320000,200000,13,color,True)
    body='\n'.join('• '+i for i in items)
    text(sid,oid+'b',body,x+180000,y+430000,w-360000,h-520000,11,'navy')

def bars(sid,oid,x,y,w,h,labels,vals,color='blue'):
    mx=max(vals) or 1; row=h/len(vals)
    for i,(lab,val) in enumerate(zip(labels,vals)):
        yy=int(y+i*row)
        text(sid,f'{oid}lab{i}',lab,x,yy,700000,150000,9,'navy')
        shape(sid,f'{oid}bg{i}',x+850000,yy+30000,w-1500000,105000,'gray',False)
        shape(sid,f'{oid}fg{i}',x+850000,yy+30000,int((w-1500000)*val/mx),105000,color,False)
        text(sid,f'{oid}val{i}',str(val),x+w-560000,yy,500000,150000,9,'navy')

def slide(sid): new_slide(sid); bg(sid)

# create 7 slides
for sid in ['slide01','slide02','slide03','slide04','slide05','slide06','slide07']: slide(sid)
# delete initial slide
requests.append({'deleteObject':{'objectId':existing}})

# s1
title('slide01','Catch up SupportDev April 2026','สรุปภาพรวมจาก Support Performance Report | Weeks 14–18 (30 Mar–3 May)')
xs=[560000,2400000,4240000,6080000,7920000]; labels=[('Total Tickets',str(total),'รวม 5 สัปดาห์','blue'),('Avg First Response',f'{avg_fr:.1f}%',f'Missed {miss_fr}','orange'),('Avg SLA',f'{avg_sla:.1f}%',f'Missed {miss_sla}','green'),('Resolved',str(resolved),f'Backlog ล่าสุด {num(april[-1],"Backlog")}','cyan'),('ggChat',str(gchat),'เคสจาก chat','navy')]
for i,(lab,val,sub,c) in enumerate(labels): metric('slide01',fslide0m{i}',xs[i],1240000,1550000,820000,lab,val,sub,c)
bullets('slide01',slide0b1',560000,2450000,4300000,1950000,'Executive Summary',[f'ปริมาณงานเดือนเมษายนอยู่ที่ {total} tickets โดย peak ที่ Week {peak["WEEK NO."]} ({num(peak,"Total Ticket")} tickets)',f'SLA ภาพรวมค่อนข้างแข็งแรง เฉลี่ย {avg_sla:.1f}% และ Week 18 แตะ 100%',f'จุดที่ควรจับตาคือ First Response เฉลี่ย {avg_fr:.1f}% โดย Week 15 ต่ำสุด 74%'],'blue')
bullets('slide01',slide0b2',5150000,2450000,4300000,1950000,'Lead Takeaway',['ปัญหาหลักไม่ใช่ resolution แต่เป็น response discipline ในบางสัปดาห์','Phoenix spike ใน Week 16 และ Week 18 ทำให้ workload แกว่ง','แนะนำทำ weekly guardrail สำหรับ missed first response + chat intake'],'orange')
# s2
title('slide02','Ticket Volume Trend','แนวโน้มปริมาณงานรายสัปดาห์ในช่วง April')
week_labels=[f'W{r["WEEK NO."]}' for r in april]; ticket_vals=[num(r,'Total Ticket') for r in april]
bars('slide02',slide0bar',850000,1400000,8000000,2100000,week_labels,ticket_vals,'blue')
bullets('slide02',slide0b1',850000,3900000,4000000,1150000,'Insight',[f'Week 16 สูงสุด {num(peak,"Total Ticket")} tickets จาก Phoenix {num(peak,"Phoenix")} tickets','หลัง Week 16 volume ลดลงชัดเจน แต่กลับขึ้นอีกใน Week 18'],'blue')
bullets('slide02',slide0b2',5200000,3900000,4000000,1150000,'Risk',['การแกว่งของ volume สะท้อน dependency กับ event/spike เฉพาะระบบ','ควรแยก incident-like spike ออกจาก BAU เพื่ออ่าน capacity ให้แม่นขึ้น'],'red')
# s3
title('slide03','Workload Mix by System','สัดส่วน workload แยกตามระบบ')
metric('slide03',slide0m1',800000,1300000,2200000,820000,'AMAZE',str(amaze),f'{amaze/total*100:.1f}% ของทั้งหมด','blue')
metric('slide03',slide0m2',3900000,1300000,2200000,820000,'Phoenix',str(phoenix),f'{phoenix/total*100:.1f}% ของทั้งหมด','orange')
metric('slide03',slide0m3',7000000,1300000,2200000,820000,'KD',str(kd),f'{kd/total*100:.1f}% ของทั้งหมด','gray')
bars('slide03',slide0bar',1150000,2700000,7600000,1400000,['AMAZE','Phoenix','KD'],[amaze,phoenix,kd],'cyan')
bullets('slide03',slide0b',1150000,4450000,7600000,680000,'Interpretation',[f'AMAZE ยังเป็น workload หลัก ({amaze} tickets) แต่ Phoenix มี spike สำคัญใน Week 16/18 รวม {phoenix} tickets'],'navy')
# s4
title('slide04','SLA & Resolution Health','คุณภาพการปิดเคสและความเสี่ยง SLA')
metric('slide04',slide0m1',700000,1250000,1900000,820000,'Avg SLA',f'{avg_sla:.1f}%','weekly average','green')
metric('slide04',slide0m2',3000000,1250000,1900000,820000,'Missed SLA',str(miss_sla),'รวมเมษายน','red')
metric('slide04',slide0m3',5300000,1250000,1900000,820000,'Avg Resolution',hm(wavg_res),'weighted by ticket','blue')
metric('slide04',slide0m4',7600000,1250000,1900000,820000,'Resolved',str(resolved),f'{resolved/total*100:.1f}% of tickets','cyan')
bars('slide04',slide0bar',900000,2700000,8000000,1600000,week_labels,[int(pct(r,'% SLA')) for r in april],'green')
bullets('slide04',slide0b',900000,4600000,8000000,620000,'Lead View',['Resolution health ดีขึ้นช่วงปลายเดือน: Week 17–18 missed SLA รวมแค่ 1 เคส และ Week 18 = 100%'],'green')
# s5
title('slide05','First Response Focus','จุดที่ควรปรับเพื่อไม่ให้ SLA ดีแต่ customer wait สูง')
metric('slide05',slide0m1',900000,1250000,2400000,820000,'Avg First Response',f'{avg_fr:.1f}%','weekly average','orange')
metric('slide05',slide0m2',3800000,1250000,2400000,820000,'Missed First Response',str(miss_fr),'รวมเมษายน','red')
metric('slide05',slide0m3',6700000,1250000,2400000,820000,'Avg Response Time',hm(wavg_resp),'weighted by ticket','blue')
bars('slide05',slide0bar',900000,2700000,8000000,1500000,week_labels,[int(pct(r,'% First Response')) for r in april],'orange')
bullets('slide05',slide0b',900000,4550000,8000000,760000,'Action Needed',['Week 15 ต่ำสุดที่ 74% และ missed 21 เคส — ควรทำ root cause แยก: queue coverage, handoff, holiday/weekend pattern, ggChat routing'],'red')
# s6
title('slide06','Recommended Next Actions','ข้อเสนอเพื่อ stabilize SupportDev cadence')
bullets('slide06',slide0b1',600000,1300000,2800000,3350000,'1) Response Guardrail',['ตั้ง daily threshold: missed first response > 5 ให้แจ้ง lead','ทำ queue sweep 2 รอบ/วันในช่วง volume สูง','แยก owner สำหรับ ggChat intake'],'orange')
bullets('slide06',slide0b2',3600000,1300000,2800000,3350000,'2) Spike Readiness',['Tag เคส Phoenix spike แยกจาก BAU','ทำ mini-RCA เฉพาะ Week 16 ว่ามาจาก issue/theme ไหน','เตรียม playbook เมื่อ Phoenix > 40 tickets/week'],'blue')
bullets('slide06',slide0b3',6600000,1300000,2800000,3350000,'3) Reporting Hygiene',['เพิ่ม MoM summary ในชีต','แยก unresolved/backlog movement ให้ชัด','เพิ่ม top issue/theme เพื่อให้ management เห็น action ไม่ใช่แค่ตัวเลข'],'green')
# s7 table as monospaced text
title('slide07','Appendix: Weekly Data','ข้อมูลรายสัปดาห์ที่ใช้ทำสรุป')
lines=['Week | Period | Tickets | AMAZE | Phoenix | FR% | SLA% | Resolved | ggChat']
for r in april:
    lines.append(f"W{r['WEEK NO.']} | {r['From Date']}–{r['To Date']} | {r['Total Ticket']} | {r['AMAZE']} | {r['Phoenix']} | {r['% First Response']} | {r['% SLA']} | {r['Resolve Ticket']} | {r['ggChat']}")
text('slide07',slide0table','\n'.join(lines),700000,1300000,8800000,2600000,11,'navy')
bullets('slide07',slide0note',700000,4200000,8800000,650000,'Source',['Google Sheet: Support Performance Report 2026, gid 472044289'],'gray')

# batch in chunks
for i in range(0,len(requests),90):
    slides.presentations().batchUpdate(presentationId=pid, body={'requests':requests[i:i+90]}).execute()
# permission anyone with link reader
try:
    drive.permissions().create(fileId=pid, body={'type':'anyone','role':'reader'}, fields='id').execute()
except Exception:
    pass
url=f'https://docs.google.com/presentation/d/{pid}/edit'
print(url)
(Path('/Users/nova/.openclaw/workspace/google-slides-supportdev-april-url.txt')).write_text(url+'\n')
