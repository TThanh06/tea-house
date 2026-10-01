"""Create a source-only ZIP. Run: python scripts/package-source.py"""
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
from hashlib import sha256
from datetime import datetime, timezone
import json

root = Path(__file__).resolve().parents[1]
destination = root.parent / 'tea-house-source.zip'
allowed_dirs = {'src', 'server', 'public', 'scripts', 'tests', 'docs'}
allowed_root = {'package.json', 'package-lock.json', 'README.md', '.env.example', '.gitignore', 'index.html', 'vite.config.js'}
blocked = {'node_modules', 'data', 'dist', '.git', '.npm-cache', '__pycache__'}
files = []
for path in root.rglob('*'):
    relative = path.relative_to(root)
    if not path.is_file() or path.is_symlink() or any(part in blocked for part in relative.parts):
        continue
    if path.name.startswith('.env') and relative.as_posix() != '.env.example':
        continue
    if path.suffix in {'.log', '.key', '.pem', '.pfx', '.pyc'}:
        continue
    if (len(relative.parts) == 1 and (path.name in allowed_root or path.suffix == '.cmd')) or relative.parts[0] in allowed_dirs:
        files.append((relative, path))
manifest = {
    'name': 'tea-house', 'created_at': datetime.now(timezone.utc).isoformat(),
    'files': {relative.as_posix(): sha256(path.read_bytes()).hexdigest() for relative, path in sorted(files)},
}
with ZipFile(destination, 'w', ZIP_DEFLATED) as archive:
    for relative, path in sorted(files):
        archive.write(path, Path('tea-house') / relative)
    archive.writestr('tea-house/RELEASE-MANIFEST.json', json.dumps(manifest, ensure_ascii=False, indent=2))
with ZipFile(destination) as archive:
    assert archive.testzip() is None
    for relative, digest in manifest['files'].items():
        assert sha256(archive.read('tea-house/' + relative)).hexdigest() == digest
print(f'Source ZIP verified: {len(files)} source files + SHA-256 manifest.\n{destination}')
