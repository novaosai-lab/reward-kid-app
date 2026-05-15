from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from pathlib import Path
SCOPES=['https://www.googleapis.com/auth/presentations','https://www.googleapis.com/auth/drive.file']
creds=Credentials.from_authorized_user_file('/Users/nova/.openclaw/workspace/google-auth/token.json',SCOPES)
slides=build('slides','v1',credentials=creds); drive=build('drive','v3',credentials=creds)
src='1RpLW-LIJ_B-zpjOzochUHAY_wzeQsmxb2CsnOv5ho44'
srcp=slides.presentations().get(presentationId=src).execute()
page_ids=[s['objectId'] for s in srcp['slides'][:7]]
p=slides.presentations().create(body={'title':'Catch up SupportDev April 2026 TH - Same Tone'}).execute(); pid=p['presentationId']; default=p['slides'][0]['objectId']
req=[{'importSlides':{'sourcePresentationId':src,'pageObjectIds':page_ids}} , {'deleteObject':{'objectId':default}}]
res=slides.presentations().batchUpdate(presentationId=pid, body={'requests':req}).execute()
try: drive.permissions().create(fileId=pid, body={'type':'anyone','role':'reader'}, fields='id').execute()
except Exception as e: print('perm warn',e)
url=f'https://docs.google.com/presentation/d/{pid}/edit'
print(url)
Path('/Users/nova/.openclaw/workspace/google-slides-template-import-url.txt').write_text(url+'\n')
