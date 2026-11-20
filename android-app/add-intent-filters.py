"""Zaregistruje aplikáciu v Androide ako aplikáciu na otváranie dokumentov („Otvoriť pomocou“, „Zdieľať“)."""
import sys

MIME_TYPES = [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.oasis.opendocument.text",
    "application/rtf", "text/rtf",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.oasis.opendocument.spreadsheet",
    "application/vnd.ms-powerpoint",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "text/plain", "text/csv", "text/comma-separated-values", "text/tab-separated-values",
    "text/markdown", "text/x-markdown", "application/json", "text/xml", "application/xml",
]

def block(action, schemes):
    data = "".join(f'\n                <data android:scheme="{s}" />' for s in schemes)
    data += "".join(f'\n                <data android:mimeType="{m}" />' for m in MIME_TYPES)
    return f'''
            <intent-filter>
                <action android:name="android.intent.action.{action}" />
                <category android:name="android.intent.category.DEFAULT" />{data}
            </intent-filter>'''

path = sys.argv[1]
xml = open(path, encoding="utf-8").read()
marker = "</intent-filter>"
i = xml.index(marker) + len(marker)  # za úvodný filter MAIN/LAUNCHER v MainActivity
xml = xml[:i] + block("VIEW", ["content", "file"]) + block("SEND", []) + xml[i:]
open(path, "w", encoding="utf-8").write(xml)
print("Intent filters added to", path)
