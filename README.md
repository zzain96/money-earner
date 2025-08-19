# money-earner
just a big dream to earn money

## Utility Hub Website

This repository now includes a lightweight, privacy-friendly website with useful everyday tools:

- Password generator
- Unit converter (length, weight, temperature, volume)
- Markdown preview (client-side)
- Pomodoro timer
- QR code generator

### Run locally

Open `index.html` directly in your browser, or serve the folder with a simple static server for best results:

```bash
python3 -m http.server 8080 --directory /workspace
```

Then open `http://localhost:8080`.

### Notes

- No tracking; everything runs client-side.
- The Markdown and QR features load tiny libraries from a CDN for convenience.
