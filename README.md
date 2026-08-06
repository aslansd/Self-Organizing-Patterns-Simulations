# Playable Morphogenesis

An **explorable explanation** of how patterns form in nature, in the tradition of Bret Victor and
Nicky Case. Seven chapters take you from "why doesn't diffusion just flatten everything?" to a free
sandbox with two live 3D engines.

- **Gray–Scott reaction–diffusion** on a 128² periodic grid, texture-mapped onto a sphere, cylinder,
  torus or lobed body. Paint activator directly onto the surface with the mouse.
- **L-systems** with a full 3D turtle (yaw, pitch and roll), an editable grammar, and a growth
  timeline.

See `REVIEW.md` for the accuracy and correctness audit behind the current version.

## Run locally

```bash
npm install
npm run dev          # http://localhost:3000
```

## Build and serve

```bash
npm run build
npm start            # express, honours $PORT, defaults to 8080
```

## Deploy to Cloud Run

The included `Dockerfile` builds and serves the static bundle on `0.0.0.0:$PORT`.

```bash
gcloud run deploy morphogenesis --source . --region=<region> --allow-unauthenticated
```

If you deploy from a GitHub trigger without a Dockerfile, the Node buildpack runs `npm start`,
which is why `server.js` exists.

## Stack

React 19 · TypeScript · Vite 6 · Tailwind CSS 4 · three.js · lucide-react. No backend, no
analytics, no cookies.
