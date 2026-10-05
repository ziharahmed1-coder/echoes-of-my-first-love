# ECHOES OF MY FIRST LOVE

A novel by Yusuf — read free at https://01a10c54-f810-75a8-8be0-530d9a637fc9.skydive.app/

Some people leave your life, but never leave your story.

## Deploy to Vercel

This is a fully static site — no build step, no framework required.

1. Push this repo to your GitHub (done — you're looking at it)
2. Go to [vercel.com/new](https://vercel.com/new) and import `ziharahmed1-coder/echoes-of-my-first-love`
3. Framework Preset: **Other** (static). Leave everything else default.
4. Deploy. Done.

Or with the CLI: `vercel --prod` from this directory.

## Structure

- `index.html` — the landing experience (hero, story, chapters, author)
- `js/orbit.js` — the orbital memory fragments
- `js/book.js` — the reader: pagination, page turns, progress, ending
- `js/audio.js` — synthesized paper/ambience sounds (off by default)
- `data/book.json` — the full manuscript, structured by chapter
- `assets/` — cover art and textures
- `book.pdf` — the downloadable typeset edition
