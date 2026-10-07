# compass-maneuvers

A small static game site about compass headings. No build step. Open `index.html` or serve the folder (for example with GitHub Pages).

- **Heading Drill**: answer 60 seconds of compass questions (bearings, back bearings, port/starboard turns) by tapping the ring. Keys 1–8 also work.
- **Reef Run**: queue helm orders (ahead, turn 45°/90°), then sail them to the treasure without hitting rocks. Levels are generated from a seed and always have a solution. Match par to get 3 stars.
- **Eastern Harbor**: tap the "Go east" compass on the home page twice to open it. Load your own `.html` game files and play them in a sandboxed frame. Files are kept in the browser's IndexedDB and are never uploaded. Paste a game code there to load a whole set of games at once.
- **Code Maker** (`code-maker.html`, not linked from the site): pick HTML files and get a `CM1:` code for them. The code contains the compressed files themselves, so its length grows with the games' size.

Run locally:

```bash
python3 -m http.server 8000
```
