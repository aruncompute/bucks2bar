# Bucks2Bar

A minimal Bootstrap starter using Bootstrap 5.3.3 CDN with Chart.js charts and an email feature to send charts.

## Quick start (static)

- If you're using XAMPP:
  - Keep this folder under your XAMPP web root (typically `C:\\xampp\\htdocs`).
  - Open http://localhost/bucks2bar/index.html (or your vhost name) in your browser.
- Or simply open `index.html` directly in a browser by double-clicking it.

## Email charts (Node server)

Use the small Express server to send the two charts via email as PNG attachments.

1. Install dependencies:
  - `npm install`
2. Configure environment:
  - Copy `.env.example` to `.env` and set `MAIL_FROM` and either `SMTP_URL` or `SMTP_HOST` credentials.
  - For quick dev, leave SMTP unset and the server will use Nodemailer Ethereal and return a `previewUrl`.
3. Start the server:
  - `npm start`
  - Visit http://localhost:3001/index.html
4. Go to the Chart tab, enter an email address under "Email charts", and Submit.

Notes:
- Endpoint: `POST /api/send-charts` with JSON `{ email, monthlyChart, totalsPieChart }` (both data URLs).
- Payload limit is configurable via `MAX_JSON` (default `2mb`).
- `.env` is ignored by git; see `.env.example` for options.

## Tests

- Unit tests use Jest with jsdom: `npm test`.

## Customize

Replace the placeholder hero image and text with your own content. Add more Bootstrap components from the official docs: https://getbootstrap.com/
