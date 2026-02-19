# Telegram Confirmation MCP Bridge

A simple bridge to request human confirmation via Telegram from an MCP agent (like Antigravity).

## Antigravity Configuration

To add this server to your Antigravity configuration (or any MCP client), use the following JSON block.

You need to replace:

- `<ABSOLUTE_PATH>` with the absolute path where you cloned this repository.
- `<YOUR_VERCEL_URL>` with your Vercel deployment URL (e.g., `https://my-telegram-bot.vercel.app`).

```json
{
  "mcpServers": {
    "telegram-bot": {
      "command": "node",
      "args": ["<ABSOLUTE_PATH>/telegram-bot-mcp/mcp-server.js"],
      "env": {
        "VERCEL_URL": "https://<YOUR_VERCEL_URL>"
      }
    }
  }
}
```

### Explanation

This script (`mcp-server.js`) acts as a **local proxy**. The agent communicates with it via `stdio` (standard), and the script makes HTTP requests to your Vercel backend, managing the question delivery and the polling (active waiting) for the response.

---

## Architecture

1. **Agent (Local)** → calls `ask_telegram_confirmation`
2. **Local Proxy (`mcp-server.js`)** → calls `POST /api/confirm` on Vercel
3. **Vercel** → sends a message to the Telegram Bot
4. **User** → replies YES/NO on mobile
5. **Telegram** → calls the Webhook `POST /api/webhook` on Vercel
6. **Vercel** → saves the response in Redis (Upstash)
7. **Local Proxy** → receives the response by polling `GET /api/confirm-status`
8. **Agent** → receives the result "User replied: YES"

---

## Installation and Deployment

### 1. Clone and Prepare

```bash
git clone https://github.com/aralroca/telegram-bot-mcp.git
cd telegram-bot-mcp
npm install
```

### 2. Configure Telegram

1. Talk to `@BotFather` to create a bot (`/newbot`).
2. Save the `BOT_TOKEN`.
3. Get your `CHAT_ID` (send a message to the bot and check `https://api.telegram.org/bot<TOKEN>/getUpdates`).

### 3. Deploy to Vercel

```bash
npm run deploy
```

Configure environment variables in Vercel:

- `BOT_TOKEN`: Your Telegram token.
- `CHAT_ID`: Your chat ID.
- `ALLOWED_USER_ID`: Your numeric user ID (for security).

Configure **Upstash Redis** (from Vercel Marketplace) for persistence.

### 4. Configure Webhook

Once deployed, register the Telegram webhook using your Vercel URL:

```
https://api.telegram.org/bot<BOT_TOKEN>/setWebhook?url=https://<YOUR_VERCEL_URL>/api/webhook
```

---

## Troubleshooting and Tips

### 1. Vercel "401 Unauthorized"

If the agent receives a 401 error, it's likely due to **Vercel Deployment Protection**.

- Go to your Vercel Dashboard → **Settings** → **Deployment Protection**.
- **Disable "Vercel Authentication"**.
- This allows the local MCP proxy and Telegram webhooks to reach your API.

### 2. Forbidden (403)

Make sure the `ALLOWED_USER_ID` in your Vercel environment variables matches your actual Telegram User ID. You can find your ID by sending a message to `@userinfobot`.

### 3. State Persistence (Redis)

This bridge uses **Redis** to keep track of questions while waiting for your reply.

- Use the **Vercel Marketplace** to add **Upstash Redis**.
- Ensure it's **Connected** to your project in the **Storage** tab.
- We support both REST protocol (`UPSTASH_REDIS_REST_URL`) and standard Redis protocol (`REDIS_URL`).
- **Redeploy** your project after connecting the storage.

### 4. Continuous Polling (Wait state)

If the agent stays in a "Waiting" state even after you reply "YES":

- Check if Redis is correctly initialized by visiting `https://<YOUR_VERCEL_URL>/health`.
- You should see `"redis_initialized": true`.

### 5. Stable URLs

Always use the **Production Domain** (e.g., `my-project.vercel.app`) in your Antigravity configuration `VERCEL_URL` environment variable. Using the specific deployment URL (the one with the hash) will stop working after your next deploy.

## How to use with an Agent

To trigger the confirmation, you should invoke the MCP server by its name (defined in your configuration, e.g., `telegram-bot`) in your prompt. This helps the agent select the correct tool.

**Example Prompts:**

- _"Use **telegram-bot** to ask for my confirmation before deleting any file."_
- _"Tell **telegram-bot** to send me a confirmation request to proceed with the deployment."_

**What happens next:**

1. The agent will call the tool from the `telegram-bot` server.
2. You will receive a message from your bot on Telegram: `Should I proceed? Reply: YES / NO`.
3. The agent will stay in a "waiting" state while polling Vercel.
4. Once you reply **YES** or **NO** on your phone, the agent will receive the answer and continue its task.
