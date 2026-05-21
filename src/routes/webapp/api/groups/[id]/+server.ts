import type { RequestHandler } from "./$types";
import { getGroupById, getPayments, getSplits, setGroupDefaultCurrency, simplifyTransactions } from "$lib/db/interface";
import { verifyTelegram } from "$lib/bot/utils";
import { env } from "$env/dynamic/private";
import { getCurrency } from "$lib/data/currencies";

export const GET: RequestHandler = async ({ url, params }) => {
  const { valid } = verifyTelegram(url.searchParams.get("login"));
  if (!valid && parseInt(env.DEBUG || '0') <= 0) return new Response("Unauthorized", { status: 418 });

  let group;
  let splits;
  let payments;
  let graph;
  let hubs;

  try {
    group = await getGroupById(parseInt(params.id));

    splits = await getSplits(group);
    payments = await getPayments(group);

    const result = await simplifyTransactions(group, splits, payments);
    graph = result.graph;
    hubs = result.hubs;
  } catch (error) {
    console.log(error);
    return new Response("", { status: 500 });
  }

  const transactions = [...splits, ...payments].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return Response.json({ ...group, transactions, graph, hubs });
};

export const PATCH: RequestHandler = async ({ url, params, request }) => {
  const { valid } = verifyTelegram(url.searchParams.get("login"));
  if (!valid && parseInt(env.DEBUG || "0") <= 0) return new Response("Unauthorized", { status: 418 });

  let body: { defaultCurrency?: string };
  try {
    body = await request.json();
  } catch {
    return new Response("Invalid body", { status: 400 });
  }

  const code = body.defaultCurrency?.toUpperCase();
  if (!code || !getCurrency(code)) return new Response("Invalid currency", { status: 400 });

  try {
    await setGroupDefaultCurrency(parseInt(params.id), code);
  } catch (error) {
    console.log(error);
    return new Response("", { status: 500 });
  }

  return Response.json({ ok: true, defaultCurrency: code });
};
