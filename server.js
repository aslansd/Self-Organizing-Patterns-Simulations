// Minimal static server for Cloud Run.
// Cloud Run injects PORT and expects the container to listen on 0.0.0.0:$PORT.
// The previous package.json had express as a dependency and a `clean` script
// that deleted server.js, but no server.js and no `start` script existed.
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 8080;
const dist = path.join(__dirname, 'dist');

app.use(express.static(dist, { maxAge: '1h', index: false }));
app.get('*', (_req, res) => res.sendFile(path.join(dist, 'index.html')));

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Serving ${dist} on http://0.0.0.0:${PORT}`);
});
