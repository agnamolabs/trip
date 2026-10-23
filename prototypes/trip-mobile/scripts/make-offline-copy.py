from pathlib import Path
import base64,mimetypes,re
root=Path(__file__).resolve().parents[1];dist=root/'dist/client'
h=(dist/'index.html').read_text()
js=(dist/re.search(r'src="/([^"]+\.js)"',h).group(1)).read_text()
css=(dist/re.search(r'href="/([^"]+\.css)"',h).group(1)).read_text()
for p in sorted(dist.rglob('*'),key=lambda p:len(str(p)),reverse=True):
 if not p.is_file() or p.suffix in ('.html','.js','.css'):continue
 url='/'+p.relative_to(dist).as_posix();mime=mimetypes.guess_type(p.name)[0] or 'application/octet-stream'
 data='data:'+mime+';base64,'+base64.b64encode(p.read_bytes()).decode();js=js.replace(url,data);css=css.replace(url,data)
h=re.sub(r'<script[^>]+src="[^"]+"[^>]*></script>','',h);h=re.sub(r'<link[^>]+href="[^"]+"[^>]*>','',h)
h=h.replace('</head>','<style>'+css+'</style></head>');h=h.replace('</body>','<script type="module">'+js.replace('</script','<\\/script')+'</script></body>')
(root.parent/'Trip-Functional-Copy.html').write_text(h);(root/'public/functional-copy.html').write_text(h)
print('Created single-file copy:',len(h.encode()),'bytes')
