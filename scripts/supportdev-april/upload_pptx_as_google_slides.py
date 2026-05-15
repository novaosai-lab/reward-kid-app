from pathlib import Path
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload

BASE=Path('/Users/nova/.openclaw/workspace')
TOKEN=BASE/'google-auth/token.json'
PPTX=BASE/'Catch_up_SupportDev_April_2026_TH.pptx'
SCOPES=['https://www.googleapis.com/auth/presentations','https://www.googleapis.com/auth/drive.file']
creds=Credentials.from_authorized_user_file(str(TOKEN), SCOPES)
drive=build('drive','v3',credentials=creds)
media=MediaFileUpload(str(PPTX), mimetype='application/vnd.openxmlformats-officedocument.presentationml.presentation', resumable=False)
file=drive.files().create(
    body={'name':'Catch up SupportDev April 2026 TH','mimeType':'application/vnd.google-apps.presentation'},
    media_body=media,
    fields='id,webViewLink'
).execute()
try:
    drive.permissions().create(fileId=file['id'], body={'type':'anyone','role':'reader'}, fields='id').execute()
except Exception as e:
    print('permission warning:', e)
url=file.get('webViewLink') or f"https://docs.google.com/presentation/d/{file['id']}/edit"
(BASE/'google-slides-supportdev-april-url.txt').write_text(url+'\n')
print(url)
