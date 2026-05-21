import { env } from "$env/dynamic/private";
import TelegramBot from "node-telegram-bot-api";
import { translate } from "../i18n/i18n";
import { findMigrationCandidates, getGroupById, groupMembers, migrateGroupId, registerGroup, registerUserInGroup, simplifyTransactions } from "../db/interface";
import { formatUser, memberToList, pmd2 } from "./utils";

const BOT_TOKEN = env.BOT_TOKEN;
const BASE_HOST = env.APP_HOST;

if (!BOT_TOKEN) throw new Error("BOT_TOKEN is not set");
if (!BASE_HOST) throw new Error("BASE_HOST is not set");

export const bot = new TelegramBot(BOT_TOKEN);

// Telegram returns 400 "group chat was upgraded to a supergroup chat" with the
// new chat id in response.body.parameters.migrate_to_chat_id. Migrate the
// stored group and retry once. Any other error is rethrown for the caller.
const extractMigrateId = (error: any): number | null => {
  const body = error?.response?.body;
  if (!body) return null;
  try {
    const parsed = typeof body === "string" ? JSON.parse(body) : body;
    const id = parsed?.parameters?.migrate_to_chat_id;
    return typeof id === "number" ? id : null;
  } catch {
    return null;
  }
};

export const safeSendMessage: typeof bot.sendMessage = async (chatId, text, options) => {
  try {
    return await bot.sendMessage(chatId, text, options);
  } catch (error: any) {
    const newId = extractMigrateId(error);
    if (newId && typeof chatId === "number") {
      console.log(`Group ${chatId} upgraded to supergroup ${newId}, migrating…`);
      await migrateGroupId(chatId, newId);
      return await bot.sendMessage(newId, text, options);
    }
    throw error;
  }
};

// Don't let a single Telegram/API rejection crash the bot process.
process.on("unhandledRejection", (reason) => {
  console.error("Unhandled rejection:", reason);
});

let botUsername = "";
bot.getMe().then((me) => {
  botUsername = me.username || "";
});

export const setWebhook = async () => {
  return await bot.setWebHook(`${BASE_HOST}/bot`);
};

const BOT_COMMANDS = [
  { command: "start", description: "Set up the bot in this group" },
  { command: "addexpense", description: "Add a shared expense" },
  { command: "addpayment", description: "Record a payment between members" },
  { command: "split", description: "Show who owes whom" },
  { command: "list", description: "Open the transactions list" },
  { command: "setup", description: "Re-run the group setup" },
  { command: "app", description: "Open the RasWise web app" },
];

export const setCommands = async () => {
  // Show inside groups
  await bot.setMyCommands(BOT_COMMANDS, { scope: { type: "all_group_chats" } });
  // Show in private chats (subset that makes sense one-on-one)
  await bot.setMyCommands(
    [
      { command: "start", description: "Open the RasWise web app" },
      { command: "app", description: "Open the RasWise web app" },
    ],
    { scope: { type: "all_private_chats" } }
  );
  return BOT_COMMANDS;
};

export const getBotUsername = () => botUsername;

function sendPrivateMessage(chatId: number, languageCode: string | undefined) {
  bot.sendMessage(chatId, translate(languageCode, "bot.add_to_group"), {
    parse_mode: "MarkdownV2",
    reply_markup: {
      inline_keyboard: [
        [{ text: translate(languageCode, "bot.list_transactions"), web_app: { url: BASE_HOST + "/webapp/list" } }],
        [{ text: translate(languageCode, "bot.add_split"), web_app: { url: BASE_HOST + "/webapp/add-split" } }],
        [{ text: translate(languageCode, "bot.add_payment"), web_app: { url: BASE_HOST + "/webapp/add-payment" } }],
      ],
    },
  });
}

const sendError = (chatId: TelegramBot.ChatId, languageCode: string | undefined, error: any) => {
  console.log(error);
  bot.sendMessage(chatId, translate(languageCode, "bot.error"));
};

const GROUP_ACTIONS_KEYBOARD = (languageCode: string | undefined, botUsername: string) =>
  ({
    inline_keyboard: [
      [
        {
          text: translate(languageCode, "bot.add_split"),
          url: `https://t.me/${botUsername}?start=addexpense`,
        },
        {
          text: translate(languageCode, "bot.add_payment"),
          url: `https://t.me/${botUsername}?start=addpayment`,
        },
      ],
      [
        {
          text: translate(languageCode, "bot.split"),
          callback_data: "split",
        },
        {
          text: translate(languageCode, "bot.list_transactions"),
          url: `https://t.me/${botUsername}?start=list`,
        },
      ],
    ],
  } as TelegramBot.InlineKeyboardMarkup);

export const OPEN_PRIVATE_KEYBOARD = (languageCode: string | undefined) =>
  ({
    inline_keyboard: [
      [
        {
          text: translate(languageCode, "bot.private_chat"),
          callback_data: "openbot",
        },
        {
          text: translate(languageCode, "bot.split"),
          callback_data: "split",
        },
      ],
    ],
  } as TelegramBot.InlineKeyboardMarkup);

bot.onText(/\/start|\/setup|\/app/, async (message) => {
  const languageCode = message.from?.language_code;

  if (message.chat.type === "channel") return;

  if (message.chat.type === "private") {
    // Check if there's a start parameter (like /start addexpense)
    const messageText = message.text || "";
    const startParam = messageText.split(" ")[1];

    if (startParam === "addexpense" || startParam === "addsplit") {
      // Send message with Add Expense button - with clear instruction
      bot.sendMessage(message.chat.id, "👇 Click the button below to add an expense", {
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: "➕ " + translate(languageCode, "bot.add_split"),
                web_app: { url: BASE_HOST + "/webapp/add-split" },
              },
            ],
          ],
        },
      });
    } else if (startParam === "addpayment") {
      // Send message with Add Payment button - with clear instruction
      bot.sendMessage(message.chat.id, "👇 Click the button below to add a payment", {
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: "💸 " + translate(languageCode, "bot.add_payment"),
                web_app: { url: BASE_HOST + "/webapp/add-payment" },
              },
            ],
          ],
        },
      });
    } else if (startParam === "list") {
      // Send message with List button - with clear instruction
      bot.sendMessage(message.chat.id, "👇 Click the button below to view all transactions", {
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: "🏠 " + translate(languageCode, "bot.list_transactions"),
                web_app: { url: BASE_HOST + "/webapp/list" },
              },
            ],
          ],
        },
      });
    } else {
      // Default start message
      sendPrivateMessage(message.chat.id, languageCode);
    }

    return;
  }

  try {
    await registerGroup(message.chat);

    // Auto-register all group members
    await autoRegisterGroupMembers(message.chat);

    const members = (await groupMembers(message.chat)) || [];

    return safeSendMessage(
      message.chat.id,
      translate(languageCode, "bot.group.registered", {
        members: members.map((m: TelegramBot.User) => memberToList(m)).join("\n"),
      }),
      {
        parse_mode: "MarkdownV2",
        reply_markup: GROUP_ACTIONS_KEYBOARD(languageCode, botUsername),
      }
    );
  } catch (error) {
    sendError(message.chat.id, languageCode, error);
  }
});

bot.on("callback_query", (query) => {
  if (!query.message) return;

  if (query.data === "openbot") sendPrivateMessage(query.from.id, query.from.language_code);
  else if (query.data === "split") sendSplitExpenses(query.from, query.message);
});

async function autoRegisterGroupMembers(chat: TelegramBot.Chat) {
  try {
    // Get all group administrators and members
    const chatAdmins = await bot.getChatAdministrators(chat.id);

    // Register each admin/member
    for (const admin of chatAdmins) {
      if (!admin.user.is_bot) {
        await registerUserInGroup(admin.user, chat);
      }
    }

    // Note: Telegram Bot API doesn't provide a method to get all members of a group
    // We can only get administrators. Regular members will be auto-registered when they
    // send any message to the group
  } catch (error) {
    console.error("Error auto-registering group members:", error);
  }
}

async function sendSplitExpenses(user: TelegramBot.User | undefined, message: TelegramBot.Message) {
  const languageCode = user?.language_code;

  try {
    const group = await getGroupById(message.chat.id);

    if (!group?.defaultCurrency) {
      return safeSendMessage(
        message.chat.id,
        "Please set a default currency for this group first \\— open the web app and pick one\\.",
        {
          parse_mode: "MarkdownV2",
          reply_markup: {
            inline_keyboard: [
              [{ text: "Open web app", web_app: { url: BASE_HOST + "/webapp/list" } }],
            ],
          },
        }
      );
    }

    const result = await simplifyTransactions(group);
    const graph = result?.graph || [];
    const hubs = result?.hubs || [];

    let sendMessage = "*💰 SPLIT SUMMARY*\n";

    if (graph.length <= 0) {
      sendMessage = translate(languageCode, "bot.group.is_pair");
    } else {
      graph.forEach((g) => {
        g.debts.forEach((d) => {
          if (d.amount > 0) {
            sendMessage += `\n${formatUser(g)} → ${formatUser(d)}: ${pmd2(d.amount.toFixed(2))} ${pmd2(d.currency)}`;
          }
        });
      });

      hubs.forEach((hub) => {
        if (hub.passThrough.length > 0) {
          const recipients = hub.passThrough.map((p) => formatUser(p.user)).join(", ");
          sendMessage += `\n\nℹ️ _${formatUser(hub.user)} receives extra ${pmd2(hub.currency)} to pass to ${recipients}_`;
        }
      });
    }

    return safeSendMessage(message.chat.id, sendMessage, {
      parse_mode: "MarkdownV2",
      reply_markup: GROUP_ACTIONS_KEYBOARD(languageCode, botUsername),
    });
  } catch (error) {
    sendError(message.chat.id, languageCode, error);
  }
}

// Telegram sends a service message in the *old* chat when a group is upgraded.
// Migrate proactively so the next send doesn't hit the 400.
bot.on("migrate_to_chat_id", async (message) => {
  const newId = (message as any).migrate_to_chat_id;
  if (typeof newId === "number") {
    try {
      await migrateGroupId(message.chat.id, newId);
      console.log(`Migrated group ${message.chat.id} → ${newId}`);
    } catch (error) {
      console.error("Group migration failed:", error);
    }
  }
});

bot.onText(/\/split/, async (message) => {
  sendSplitExpenses(message.from, message);
});

// Manual rescue for the case where a group was upgraded to a supergroup
// while the bot was offline and a fresh /start created a duplicate doc.
// Type /repair in the new supergroup; the bot finds the old doc by title
// (limited to chat admins) and merges its members + history into the
// current chat id.
bot.onText(/\/repair/, async (message) => {
  if (message.chat.type === "private" || message.chat.type === "channel" || !message.from) return;

  try {
    const admins = await bot.getChatAdministrators(message.chat.id);
    const isAdmin = admins.some((a) => a.user.id === message.from!.id);
    if (!isAdmin) {
      return safeSendMessage(message.chat.id, "Only chat admins can run /repair.");
    }

    const candidates = await findMigrationCandidates(message.chat, message.from.id);

    if (candidates.length === 0) {
      return safeSendMessage(message.chat.id, "Nothing to merge — no other group with this title was found.");
    }
    if (candidates.length > 1) {
      const ids = candidates.map((c) => c.id).join(", ");
      return safeSendMessage(
        message.chat.id,
        `Found ${candidates.length} candidates (${ids}). Please merge manually via mongo to avoid mistakes.`
      );
    }

    const oldId = candidates[0].id as number;
    await migrateGroupId(oldId, message.chat.id);

    return safeSendMessage(
      message.chat.id,
      `✅ Merged old group ${oldId} into this chat. All members, splits and payments are restored.`
    );
  } catch (error) {
    console.error("/repair failed:", error);
    return safeSendMessage(message.chat.id, "Repair failed — check the server logs.");
  }
});

// Command to add expense directly from group
bot.onText(/\/addexpense|\/addsplit/, async (message) => {
  const languageCode = message.from?.language_code;

  if (message.chat.type === "private") {
    sendPrivateMessage(message.chat.id, languageCode);
    return;
  }

  try {
    await safeSendMessage(
      message.chat.id,
      translate(languageCode, "bot.add_split"),
      {
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: translate(languageCode, "bot.add_split"),
                web_app: { url: BASE_HOST + "/webapp/add-split" },
              },
            ],
          ],
        },
      }
    );
  } catch (error) {
    sendError(message.chat.id, languageCode, error);
  }
});

// Command to add payment directly from group
bot.onText(/\/addpayment/, async (message) => {
  const languageCode = message.from?.language_code;

  if (message.chat.type === "private") {
    sendPrivateMessage(message.chat.id, languageCode);
    return;
  }

  try {
    await safeSendMessage(
      message.chat.id,
      translate(languageCode, "bot.add_payment"),
      {
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: translate(languageCode, "bot.add_payment"),
                web_app: { url: BASE_HOST + "/webapp/add-payment" },
              },
            ],
          ],
        },
      }
    );
  } catch (error) {
    sendError(message.chat.id, languageCode, error);
  }
});

// Command to view all transactions
bot.onText(/\/list|\/transactions/, async (message) => {
  const languageCode = message.from?.language_code;

  if (message.chat.type === "private") {
    sendPrivateMessage(message.chat.id, languageCode);
    return;
  }

  try {
    await safeSendMessage(
      message.chat.id,
      translate(languageCode, "bot.list_transactions"),
      {
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: translate(languageCode, "bot.list_transactions"),
                web_app: { url: BASE_HOST + "/webapp/list" },
              },
            ],
          ],
        },
      }
    );
  } catch (error) {
    sendError(message.chat.id, languageCode, error);
  }
});

// Auto-register users when they join the group
bot.on("new_chat_members", async (message) => {
  try {
    const group = await getGroupById(message.chat.id);
    if (!group) {
      // Register the group first if it doesn't exist
      await registerGroup(message.chat);
    }

    // Register each new member
    if (message.new_chat_members) {
      for (const member of message.new_chat_members) {
        if (!member.is_bot) {
          await registerUserInGroup(member, message.chat);
        }
      }
    }
  } catch (error) {
    console.error("Error registering new chat members:", error);
  }
});

// Auto-register users when they send any message in the group
bot.on("message", async (message) => {
  // Skip if it's a private chat, channel, or if there's no user info
  if (message.chat.type === "private" || message.chat.type === "channel" || !message.from) {
    return;
  }

  try {
    const group = await getGroupById(message.chat.id);

    // Only auto-register if the group exists in our database
    if (group && !message.from.is_bot) {
      await registerUserInGroup(message.from, message.chat);
    }
  } catch (error) {
    // Silently fail - don't log to avoid spam
  }
});
