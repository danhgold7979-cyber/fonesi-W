"""Generate a standalone review HTML; never modify the frozen source."""
from pathlib import Path
import hashlib

ROOT=Path(__file__).resolve().parents[2]
source=ROOT/'docs/reference/studio-workspace/AutoReels-Workspace.html'
original=source.read_bytes()
assert hashlib.sha256(original).hexdigest()=='3afb29c567a58b654de2b555b19ed60e8e074c604b2d1d4621e77d21d44cdf54'
html=original.decode().replace('autoreels-studio-preview-v1','autoreels-studio-compact-preview-v21')
css=(Path(__file__).parent/'compact.css').read_text()
js=(Path(__file__).parent/'compact.js').read_text()
html=html.replace('</head>','<style>\n'+css+'\n</style></head>')
prefix,closing,suffix=html.rpartition('</body>')
assert closing, 'Missing outer body closing tag'
html=prefix+'<script>\n'+js+'\n</script>'+closing+suffix
target=ROOT/'docs/previews/AutoReels-Studio-Compact.html'
target.parent.mkdir(parents=True,exist_ok=True)
target.write_text(html)
assert source.read_bytes()==original
print(target)
