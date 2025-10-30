# Deployment Notes for LAMP Server

## Current Issue
The project is using relative paths but still getting 404 errors. This suggests the files may not be uploaded correctly or are in the wrong location on the server.

## Directory Structure on Server
Based on the server listing, you should have:
```
~/public_html/
├── index.html
├── final.html
├── west.html
├── carcross.html
├── labs.html
├── src/
│   ├── loading.css
│   ├── ui.css
│   ├── main.js
│   ├── final.js
│   ├── west.js
│   ├── carcross.js
│   ├── labs.js
│   ├── characterControls.js
│   └── (other .js files)
├── models/
│   ├── final.glb
│   ├── Soldier.glb
│   ├── west.glb
│   ├── sky.jpeg
│   └── (other .glb files)
├── assets/
│   └── (audio files)
└── node_modules/
```

## All HTML Files Now Use Relative Paths
✅ All HTML files have been updated to use relative paths (not absolute `/src/...` paths)
✅ All JavaScript files have been updated to use relative paths for models
✅ All redirects have been updated to use relative paths

## Next Steps
1. Verify all files are uploaded to `~/public_html/`
2. Make sure the `src/` directory with all .js and .css files is in `public_html/`
3. Make sure the `models/` directory with all .glb files is in `public_html/`
4. Make sure the `assets/` directory with audio files is in `public_html/`
5. Check file permissions on the server: `chmod 755` for directories, `chmod 644` for files

## Testing
Access your site at: `https://lamp.ms.wits.ac.za/~slancegames/index.html`
Or if it's the main site: `https://lamp.ms.wits.ac.za/index.html`

