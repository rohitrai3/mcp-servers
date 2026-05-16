import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { config } from "dotenv";
import { createLogger, format, transports } from "winston";
import { z } from "zod";

config();

const financeUrl = process.env.FINANCE_URL;
const logger = createLogger({
  format: format.combine(
    format.timestamp(),
    format.printf(({ timestamp, level, message }) => `[${timestamp}][${level}]${message}`)
  ),
  transports: [
    new transports.File({ filename: "finance-mcp-server.log" }),
  ],
});

const server = new McpServer({
  name: "finance",
  version: "1.0.0",
});

server.registerTool(
  "add-transaction",
  {
    title: "Add Transaction",
    description: "Add a transaction in finance app",
    inputSchema: {
      amount: z.number().describe("Amount of transaction"),
      type: z.string().describe("Type of transaction, either DEBIT or CREDIT"),
      description: z.string().describe("Description of transaction"),
      tags: z.string().describe("Tags of transaction for grouping them"),
      date: z.number().describe("Date when transaction was made"),
    },
  },
  async ({ amount, type, description, tags, date }) => {
    if (!financeUrl) logger.info("FINANCE_URL is undefined");

    const response = await fetch(
      `${financeUrl}/transaction/add`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: amount }),
      }
    );
    const transaction = await response.json();

    if (!transaction) {

      return {
        content: [
          {
            type: "text",
            text: "Failed to add transaction",
          },
        ],
      };
    }

    const responseText = `amount: ${amount}, type: ${type}, description: ${description}, tags: ${tags}, date: ${date}.`;

    return {
      content: [
        {
          type: "text",
          text: responseText,
        },
      ],
    };
  },
);

server.registerTool(
  "ping-finance",
  {
    title: "Ping Finance",
    description: "Check status of Finance app",
  },
  async () => {
    if (!financeUrl) logger.info("FINANCE_URL is undefined");

    const response = await fetch(`${financeUrl}/ping`)
      .then(res => res.json())
      .then(data => data)
      .catch(err => logger.error(`Error pinging: ${err}`));

    let status = "Offline";

    if (response && response.status === "success") {
      status = "Online";
      logger.info("Finance app is online.");
    } else {
      logger.info(`Finance app is offline: ${response}`);
    }

    return {
      content: [
        {
          type: "text",
          text: `Finance app is ${status}.`,
        },
      ],
    };
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  logger.error("Finance MCP Server running on stdio");
}

main().catch(err => {
  logger.error("Fatal error in main(): ", err);
  process.exit(1);
});

