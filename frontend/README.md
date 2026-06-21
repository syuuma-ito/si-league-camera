# SI-League Frontend

React/Vite frontend for the SI-League video display system.

## Screens

- `/main`: Production display for the active 2x2 scene.
- `/streams`: Monitoring display for all streams.
- `/settings`: Scene and stream management.

## Environment

- `VITE_API_BASE_URL`: Backend API URL. Defaults to same-origin `/api` through the Vite dev proxy.
- `VITE_WS_BASE_URL`: Backend WebSocket URL. Defaults to `ws://127.0.0.1:8000` on localhost.
- `VITE_MEDIA_SERVER`: MediaMTX WebRTC host or URL. Defaults to `<page-host>:8889`.
- `VITE_WEBRTC_DEBUG`: Set to `true` to enable WebRTC debug logging.

## Run

```bash
npm install
npm run dev
```
