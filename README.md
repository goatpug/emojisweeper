Emojisweeper is inspired by Mamono Sweeper by Hojamaka Games: https://hojamaka.com/

Developed using Claude Code

## Running locally

No build step required — it's a single HTML file with vanilla JS.

**Easiest: just open the file directly**
```
open index.html
```
This works in most browsers. Right-click the file in your file manager and "Open with" your browser if the above doesn't apply.

**If you need a local server** (e.g. to avoid browser file:// restrictions):

Python 3:
```
python3 -m http.server 8080
```

Node (npx):
```
npx serve .
```

Then visit `http://localhost:8080` (or whatever port is shown).
