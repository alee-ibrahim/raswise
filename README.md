<p align="center">
  <img src="./static/favicon.png" width="150" title="RasWise">
</p>
<h1 align="center">RasWise</h1>

[@raswisebot](https://t.me/raswisebot) on Telegram

## ❓ How does it work?

- Add the bot to your group;
- Members are automatically added when they join or send messages;
- Use the /app command to launch the webapp and manage expenses and splits.

## ✨ Features

- **Smart Debt Simplification** - Minimizes transactions so each person only makes one payment
- **Hub-based Settlement** - The person owed the most collects payments and redistributes
- **Clean Split Summary** - Easy to read format showing who pays whom
- **Multi-language Support** - English and Italian translations
- **Telegram Web App** - Full-featured expense management interface

## Run on custom server

### 1. Set up Cloudflare Tunnel (Free)

1. Create a free account at [Cloudflare](https://dash.cloudflare.com/sign-up)
2. Go to [Zero Trust Dashboard](https://one.dash.cloudflare.com/)
3. Navigate to **Networks** → **Tunnels** → **Create a tunnel**
4. Choose **Cloudflared** and give it a name (e.g., "raswise")
5. Copy the tunnel token (looks like `eyJhIjoiXXXXXX...`)
6. In **Public Hostname** settings:
   - Set your subdomain (e.g., `raswise`)
   - Choose or add a domain
   - Service Type: **HTTP**
   - URL: `raswise-app:3000`
7. Save the configuration

### 2. Create Telegram Bot

1. Message [@BotFather](https://t.me/BotFather) on Telegram
2. Send `/newbot` and follow the instructions
3. Copy your bot token (looks like `1234567890:ABCdefGHIjklMNOpqrsTUVwxyz`)

### 3. Configure Environment

Create a `.env` file from the example:

```bash
cp .env.example .env
```

Edit `.env` and fill in:
- `BOT_TOKEN` - Your Telegram bot token from BotFather
- `APP_HOST` - Your Cloudflare tunnel URL (e.g., `https://raswise.yourdomain.com`)
- `CLOUDFLARE_TUNNEL_TOKEN` - Your tunnel token from step 1

### 4. Deploy

Run the complete stack:

```bash
docker compose up -d --build
```

This will automatically:
- Start MongoDB database
- Start Cloudflare tunnel
- Build and run the Raswise app
- Connect everything together

### 5. Set Telegram Webhook

After deployment, set the webhook for your bot:

```bash
curl "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook?url=<YOUR_APP_HOST>/bot"
```

Replace `<YOUR_BOT_TOKEN>` and `<YOUR_APP_HOST>` with your actual values.

That's it! Your bot should now be running and accessible via Telegram.

## Contribution

Any contribution is well accepted, as reporting any issue you found!

## Donating

If you want to support me, you can do it via PayPal at [@MartinelliLuca](https://paypal.me/MartinelliLuca). **Thank you!**
