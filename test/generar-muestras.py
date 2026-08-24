# Genera archivos de guion de prueba en los formatos que acepta el desglosador.
# Sirve para verificar que PDF, DOCX, RTF y FDX den el mismo desglose que el .txt.
import io, os, re, zlib, zipfile

BASE = os.path.dirname(os.path.abspath(__file__))
OUT  = os.path.join(BASE, 'muestras')
os.makedirs(OUT, exist_ok=True)

G = io.open(os.path.join(BASE, 'guion-ejemplo.txt'), encoding='utf-8').read()
lineas = [l.rstrip() for l in G.split('\n')]

BS = chr(92)  # barra invertida

def xesc(t):
    return t.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')

# ---------------------------------------------------------------- PDF
# PDF 1.4 de texto con streams FlateDecode, como el que exporta Final Draft.
def pdf_escape(t):
    t = t.replace(BS, BS + BS)
    return t.replace('(', BS + '(').replace(')', BS + ')')

def latin(t):
    return ''.join(ch if ord(ch) < 256 else '?' for ch in t)

paginas, act = [], []
for l in lineas:
    act.append(l)
    if len(act) >= 50:
        paginas.append(act); act = []
if act:
    paginas.append(act)

contenidos = []
for pg in paginas:
    ops = ['BT', '/F1 12 Tf', '14 TL', '72 720 Td']
    for l in pg:
        ops.append('(%s) Tj' % pdf_escape(latin(l)))
        ops.append('T*')
    ops.append('ET')
    contenidos.append(zlib.compress(chr(10).join(ops).encode('latin-1')))

n_pg = len(paginas)
objs = {}
objs[1] = b'<< /Type /Catalog /Pages 2 0 R >>'
kids = ' '.join('%d 0 R' % (4 + 2 * i) for i in range(n_pg))
objs[2] = ('<< /Type /Pages /Count %d /Kids [%s] >>' % (n_pg, kids)).encode()
objs[3] = b'<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>'
for i, c in enumerate(contenidos):
    objs[4 + 2 * i] = ('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] '
                       '/Resources << /Font << /F1 3 0 R >> >> /Contents %d 0 R >>'
                       % (5 + 2 * i)).encode()
    objs[5 + 2 * i] = (('<< /Length %d /Filter /FlateDecode >>' % len(c)).encode()
                       + b'\nstream\n' + c + b'\nendstream')

out, offs = bytearray(b'%PDF-1.4\n'), {}
for k in sorted(objs):
    offs[k] = len(out)
    out += ('%d 0 obj\n' % k).encode() + objs[k] + b'\nendobj\n'
xref = len(out)
mx = max(objs) + 1
out += ('xref\n0 %d\n' % mx).encode() + b'0000000000 65535 f \n'
for k in range(1, mx):
    out += ('%010d 00000 n \n' % offs.get(k, 0)).encode()
out += ('trailer\n<< /Size %d /Root 1 0 R >>\nstartxref\n%d\n%%%%EOF\n' % (mx, xref)).encode()
open(os.path.join(OUT, 'guion.pdf'), 'wb').write(bytes(out))

# --------------------------------------------------------------- DOCX
ps = ''.join('<w:p><w:r><w:t xml:space="preserve">%s</w:t></w:r></w:p>' % xesc(l) for l in lineas)
doc = ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
       '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'
       '<w:body>%s</w:body></w:document>' % ps)
with zipfile.ZipFile(os.path.join(OUT, 'guion.docx'), 'w', zipfile.ZIP_DEFLATED) as z:
    z.writestr('[Content_Types].xml',
        '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
        '<Default Extension="xml" ContentType="application/xml"/>'
        '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-'
        'officedocument.wordprocessingml.document.main+xml"/></Types>')
    z.writestr('_rels/.rels',
        '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/'
        'officeDocument" Target="word/document.xml"/></Relationships>')
    z.writestr('word/document.xml', doc)

# ---------------------------------------------------------------- RTF
def rtf_esc(t):
    o = ''
    for ch in t:
        if ch in (BS + '{}'):
            o += BS + ch
        elif ord(ch) < 128:
            o += ch
        else:
            o += BS + 'u%d?' % ord(ch)
    return o

rtf = (BS + 'rtf1' + BS + 'ansi' + BS + 'deff0{' + BS + 'fonttbl{' + BS + 'f0 Courier;}}\n')
rtf = '{' + rtf + ''.join(rtf_esc(l) + BS + 'par\n' for l in lineas) + '}'
open(os.path.join(OUT, 'guion.rtf'), 'w', encoding='latin-1').write(rtf)

# ----------------------------------------------------------------- FDX
def tipo(l):
    t = l.strip()
    if not t:
        return None
    if re.match(r'^\s*(\d+[\.\)]?\s+)?(INT|EXT)\b', t, re.I):
        return 'Scene Heading'
    if t.startswith('(') and t.endswith(')'):
        return 'Parenthetical'
    if t.upper() == t and len(t) <= 42 and any(c.isalpha() for c in t):
        if t.rstrip().endswith(('A:', 'TO:')) or t in ('FIN', 'THE END'):
            return 'Transition'
        return 'Character'
    return 'Action'

paras, prev = [], None
for l in lineas:
    tp = tipo(l)
    if not tp:
        prev = None
        continue
    if prev in ('Character', 'Parenthetical') and tp == 'Action':
        tp = 'Dialogue'
    paras.append('<Paragraph Type="%s"><Text>%s</Text></Paragraph>' % (tp, xesc(l.strip())))
    prev = tp
fdx = ('<?xml version="1.0" encoding="UTF-8"?><FinalDraft DocumentType="Script" Version="1">'
       '<Content>%s</Content></FinalDraft>' % ''.join(paras))
open(os.path.join(OUT, 'guion.fdx'), 'w', encoding='utf-8').write(fdx)

for f in sorted(os.listdir(OUT)):
    print('  %-14s %7d bytes' % (f, os.path.getsize(os.path.join(OUT, f))))
