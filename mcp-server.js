#!/usr/bin/env node

const { Server } = require("@modelcontextprotocol/sdk/server/index.js");
const {
  StdioServerTransport,
} = require("@modelcontextprotocol/sdk/server/stdio.js");
const {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} = require("@modelcontextprotocol/sdk/types.js");
const axios = require("axios");

const VERCEL_URL = process.env.VERCEL_URL;

if (!VERCEL_URL) {
  console.error("Error: VERCEL_URL environment variable is required");
  process.exit(1);
}

const BASE_URL = VERCEL_URL.replace(/\/$/, "");

const server = new Server(
  {
    name: "telegram-bot-mcp",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  },
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "ask_telegram_confirmation",
        description:
          "Sends a question to the user via Telegram and waits for a YES/NO response.",
        inputSchema: {
          type: "object",
          properties: {
            question: {
              type: "string",
              description: "The question to ask the user",
            },
          },
          required: ["question"],
        },
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (name === "ask_telegram_confirmation") {
    try {
      const { question } = args;

      console.error(`[MCP] Requesting confirmation: "${question}"`);
      console.error(`[MCP] Endpoint: ${BASE_URL}/api/confirm`);

      const confirmRes = await axios.post(`${BASE_URL}/api/confirm`, {
        question,
      });

      const { requestId } = confirmRes.data;

      if (!requestId) {
        throw new Error("Failed to get requestId from Telegram bridge");
      }

      console.error(
        `[MCP] Request sent. ID: ${requestId}. Starting polling...`,
      );

      const maxAttempts = 150;
      let attempts = 0;

      while (attempts < maxAttempts) {
        attempts++;

        if (attempts % 5 === 0) {
          console.error(
            `[MCP] Polling attempt ${attempts}/${maxAttempts} for ID ${requestId}...`,
          );
        }

        await new Promise((resolve) => setTimeout(resolve, 2000));

        try {
          const statusRes = await axios.get(`${BASE_URL}/api/confirm-status`, {
            params: { id: requestId },
          });

          const data = statusRes.data;

          if (data.status === "answered" && data.answer) {
            console.error(`[MCP] Received answer: ${data.answer}`);
            return {
              content: [
                {
                  type: "text",
                  text: `User replied: ${data.answer}`,
                },
              ],
            };
          }
        } catch (pollError) {
          console.error(
            `[MCP] Polling error (attempt ${attempts}): ${pollError.message}`,
          );
          if (pollError.response) {
            console.error(
              `[MCP] Status: ${pollError.response.status} - Data: ${JSON.stringify(pollError.response.data)}`,
            );
          }
        }
      }

      throw new Error("Timeout waiting for user confirmation via Telegram");
    } catch (error) {
      console.error(`[MCP] ERROR: ${error.message}`);
      return {
        isError: true,
        content: [
          {
            type: "text",
            text: `Error asking Telegram confirmation: ${error.message}`,
          },
        ],
      };
    }
  }

  throw new Error(`Unknown tool: ${name}`);
});

async function run() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Telegram MCP Server running on stdio");
  console.error(`Bridging to: ${BASE_URL}`);
}

run().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});
