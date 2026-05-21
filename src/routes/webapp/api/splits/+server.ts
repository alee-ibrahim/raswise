import type { RequestHandler } from "./$types";
import { addSplit } from "$lib/db/interface";
import { formatUser, pmd2, verifyTelegram } from "$lib/bot/utils";
import { getBotUsername, safeSendMessage } from "$lib/bot/bot";
import { translate } from "$lib/i18n/i18n";

export const POST: RequestHandler = async ({ url, request }) => {
  const { user, valid } = verifyTelegram(url.searchParams.get("login"));
  if (!valid) return new Response("", { status: 418 });

  const data = (await request.json()) as TransactionData;

  try {
    await addSplit(data);
  } catch (error) {
    console.log(error);
    return new Response("", { status: 500 });
  }

  // Build detailed notification message
  let message = `*💰 NEW EXPENSE ADDED*\n\n`;
  message += `*Paid by:* ${formatUser(data.from)}\n`;
  message += `*Amount:* ${pmd2(data.amount.toFixed(2))}${data.currency ? " " + pmd2(data.currency) : ""}\n`;

  if (data.description) {
    message += `*Description:* ${pmd2(data.description)}\n`;
  }

  // Add involved members
  if (data.splits && data.splits.length > 0) {
    const involvedMembers = data.splits
      .filter(s => s.selected)
      .map(s => formatUser(s))
      .join(", ");
    message += `*Involved:* ${involvedMembers}`;
  }

  const botUsername = getBotUsername();

  safeSendMessage(
    data.group.id,
    message,
    {
      parse_mode: "MarkdownV2",
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: translate(user.language_code, "bot.add_split"),
              url: `https://t.me/${botUsername}?start=addexpense`,
            },
            {
              text: translate(user.language_code, "bot.add_payment"),
              url: `https://t.me/${botUsername}?start=addpayment`,
            },
          ],
          [
            {
              text: translate(user.language_code, "bot.split"),
              callback_data: "split",
            },
            {
              text: translate(user.language_code, "bot.list_transactions"),
              url: `https://t.me/${botUsername}?start=list`,
            },
          ],
        ],
      },
    }
  );

  return new Response("", { status: 200 });
};
