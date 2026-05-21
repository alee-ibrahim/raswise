import type TelegramBot from "node-telegram-bot-api";
import db from "./db";
import { ObjectId } from "mongodb";

export const registerGroup = async (chat: TelegramBot.Chat) => {
  await db.collection("groups").createIndex("id", { unique: true });

  await db.collection("groups").updateOne({ id: chat.id }, { $set: chat }, { upsert: true });
};

export const setGroupDefaultCurrency = async (groupId: number, currency: string) => {
  await db.collection("groups").updateOne({ id: groupId }, { $set: { defaultCurrency: currency } });

  // Backfill any historical rows that don't already have a currency set.
  await db
    .collection("splits")
    .updateMany({ group: groupId, currency: { $exists: false } }, { $set: { currency } });
  await db
    .collection("payments")
    .updateMany({ group: groupId, currency: { $exists: false } }, { $set: { currency } });
};

export const migrateGroupId = async (oldId: number, newId: number) => {
  if (oldId === newId) return;

  const existingNew = await db.collection("groups").findOne({ id: newId });
  if (existingNew) {
    // New supergroup already tracked separately — drop the stale old record
    // and repoint any orphaned splits/payments to the new id.
    await db.collection("groups").deleteOne({ id: oldId });
  } else {
    await db.collection("groups").updateOne({ id: oldId }, { $set: { id: newId, type: "supergroup" } });
  }

  await db.collection("splits").updateMany({ group: oldId }, { $set: { group: newId } });
  await db.collection("payments").updateMany({ group: oldId }, { $set: { group: newId } });
};

export const registerUserInGroup = async (user: TelegramBot.User, chat: TelegramBot.Chat) => {
  await db.collection("users").createIndex("id", { unique: true });

  const opUser = await db.collection("users").updateOne({ id: user.id }, { $set: user }, { upsert: true });
  await db.collection("groups").updateOne(
    { id: chat.id },
    {
      $addToSet: {
        members: user.id,
      },
    }
  );

  return opUser;
};

export const getGroupById = async (groupId: number) => {
  const group = (
    await db
      .collection("groups")
      .aggregate([
        { $match: { id: groupId } },
        {
          $lookup: {
            from: "users",
            localField: "members",
            foreignField: "id",
            as: "members",
          },
        },
        { $unwind: "$members" },
        {
          $sort: {
            "members.first_name": 1,
          },
        },
        {
          $group: {
            _id: "$_id",
            member: { $first: "$$ROOT" },
            members: {
              $push: "$members",
            },
          },
        },
        {
          $replaceRoot: { newRoot: { $mergeObjects: ["$member", { members: "$members" }] } },
        },
        { $limit: 1 },
      ])
      .toArray()
  ).pop();

  return group as Group;
};

export const groupMembers = async (group: TelegramBot.Chat) => {
  const groupInfo = await getGroupById(group.id);

  return groupInfo?.members as TelegramBot.User[];
};

export const getGroups = async (user: TelegramBot.User) => {
  return await db
    .collection("groups")
    .aggregate([
      { $match: { members: user.id } },
      {
        $lookup: {
          from: "users",
          localField: "members",
          foreignField: "id",
          as: "members",
        },
      },
      { $unwind: "$members" },
      {
        $sort: {
          "members.first_name": 1,
        },
      },
      {
        $group: {
          _id: "$_id",
          member: { $first: "$$ROOT" },
          members: {
            $push: "$members",
          },
        },
      },
      {
        $replaceRoot: { newRoot: { $mergeObjects: ["$member", { members: "$members" }] } },
      },
    ])
    .toArray();
};

export const addSplit = async (data: TransactionData) => {
  await db.collection("splits").createIndex("group");
  await db.collection("splits").createIndex("from");
  await db.collection("splits").createIndex("date");

  return await db.collection("splits").insertOne({
    group: data.group.id,
    date: new Date(),
    from: data.from.id,
    description: data.description,
    amount: data.amount,
    currency: data.currency,
    mode: data.mode,
    splits: data.splits?.filter((s) => s.selected).map((s) => ({ user: s.id, amount: data.mode === "equally" ? null : s.amount })),
  });
};

export const editSplit = async (id: string, data: TransactionData) => {
  return await db.collection("splits").updateOne(
    {
      _id: new ObjectId(id),
    },
    {
      $set: {
        group: data.group.id,
        from: data.from.id,
        description: data.description,
        amount: data.amount,
        currency: data.currency,
        mode: data.mode,
        splits: data.splits?.filter((s) => s.selected).map((s) => ({ user: s.id, amount: data.mode === "equally" ? null : s.amount })),
      },
    }
  );
};

export const deleteSplit = async (id: string) => {
  return await db.collection("splits").deleteOne({
    _id: new ObjectId(id),
  });
};

export const addPayment = async (data: TransactionData) => {
  await db.collection("payments").createIndex("group");
  await db.collection("payments").createIndex("from");
  await db.collection("payments").createIndex("date");
  await db.collection("payments").createIndex("to");

  return await db.collection("payments").insertOne({
    group: data.group.id,
    date: new Date(),
    from: data.from.id,
    to: data.to?.id,
    amount: data.amount,
    currency: data.currency,
  });
};

export const editPayment = async (id: string, data: TransactionData) => {
  return await db.collection("payments").updateOne(
    {
      _id: new ObjectId(id),
    },
    {
      $set: {
        group: data.group.id,
        from: data.from.id,
        to: data.to?.id,
        amount: data.amount,
        currency: data.currency,
      },
    }
  );
};

export const deletePayment = async (id: string) => {
  return await db.collection("payments").deleteOne({
    _id: new ObjectId(id),
  });
};

export const getSplits = async (group: Group) => {
  if (!group) return [];

  const splits = await db
    .collection("splits")
    .aggregate([
      { $match: { group: group.id } },
      {
        $lookup: {
          from: "users",
          localField: "from",
          foreignField: "id",
          as: "from",
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "splits.user",
          foreignField: "id",
          as: "splitUsers",
        },
      },
      {
        $project: {
          date: 1,
          description: 1,
          amount: 1,
          currency: 1,
          mode: 1,
          from: 1,
          splits: {
            $map: {
              input: "$splits",
              as: "amounts",
              in: {
                $mergeObjects: [
                  "$$amounts",
                  { selected: true },
                  {
                    $arrayElemAt: [
                      {
                        $filter: {
                          input: "$splitUsers",
                          as: "users",
                          cond: {
                            $eq: ["$$users.id", "$$amounts.user"],
                          },
                        },
                      },
                      0,
                    ],
                  },
                ],
              },
            },
          },
        },
      },
      { $unwind: "$from" },
      { $sort: { date: -1 } },
    ])
    .toArray();

  return splits as TransactionData[];
};

export const getPayments = async (group: Group) => {
  if (!group) return [];

  const payments = await db
    .collection("payments")
    .aggregate([
      { $match: { group: group.id } },
      {
        $lookup: {
          from: "users",
          localField: "from",
          foreignField: "id",
          as: "from",
        },
      },
      { $unwind: "$from" },
      {
        $lookup: {
          from: "users",
          localField: "to",
          foreignField: "id",
          as: "to",
        },
      },
      { $unwind: "$to" },
      { $sort: { date: -1 } },
    ])
    .toArray();

  return payments as TransactionData[];
};

function floorAmount(amount: number) {
  return Math.round(amount * 100) / 100;
}

function hubBasedSimplify(graph: Record<string, Record<string, number>>) {
  // Calculate net balance for each person (positive = owed money, negative = owes money)
  const balances = {} as Record<string, number>;

  Object.keys(graph).forEach((fromId) => {
    balances[fromId] = balances[fromId] || 0;
    Object.keys(graph).forEach((toId) => {
      balances[fromId] += (graph[toId][fromId] || 0) - (graph[fromId][toId] || 0);
    });
    balances[fromId] = floorAmount(balances[fromId]);
  });

  // Find creditors (owed money, positive balance) and debtors (owe money, negative balance)
  const creditors = Object.entries(balances)
    .filter(([_, bal]) => bal > 0)
    .sort((a, b) => b[1] - a[1]); // Sort by amount descending

  const debtors = Object.entries(balances)
    .filter(([_, bal]) => bal < 0)
    .sort((a, b) => a[1] - b[1]); // Sort by amount ascending (most negative first)

  if (creditors.length === 0 || debtors.length === 0) {
    return { transactions: {} as Record<string, Record<string, number>>, hub: null };
  }

  // Hub is the person owed the most
  const [hubId, hubAmount] = creditors[0];
  const otherCreditors = creditors.slice(1);

  const transactions = {} as Record<string, Record<string, number>>;

  // All debtors pay the hub
  debtors.forEach(([debtorId, balance]) => {
    const amount = floorAmount(-balance); // Convert negative to positive
    if (amount > 0) {
      if (!transactions[debtorId]) transactions[debtorId] = {};
      transactions[debtorId][hubId] = amount;
    }
  });

  // Hub pays other creditors
  otherCreditors.forEach(([creditorId, balance]) => {
    const amount = floorAmount(balance);
    if (amount > 0) {
      if (!transactions[hubId]) transactions[hubId] = {};
      transactions[hubId][creditorId] = amount;
    }
  });

  // Return hub info for the note (only if hub has to pass money to others)
  const hubPassThrough = otherCreditors.map(([id, amount]) => ({ id, amount: floorAmount(amount) }));

  return {
    transactions,
    hub: hubPassThrough.length > 0 ? { id: hubId, passThrough: hubPassThrough } : null
  };
}

export const simplifyTransactions = async (group: Group, splits: TransactionData[] | null = null, payments: TransactionData[] | null = null) => {
  splits = splits || ((await getSplits(group)) as TransactionData[]);
  payments = payments || ((await getPayments(group)) as TransactionData[]);

  const groupMembers = group.members
    .sort((a, b) => a.first_name.localeCompare(b.first_name))
    .reduce((g, m) => {
      g[m.id] = m;

      return g;
    }, {} as Record<string, TelegramBot.User>);

  const defaultCurrency = group.defaultCurrency || "USD";

  // Partition transactions by currency so each currency is settled independently.
  const buckets = new Map<string, { splits: TransactionData[]; payments: TransactionData[] }>();
  const bucketFor = (currency: string) => {
    let b = buckets.get(currency);
    if (!b) {
      b = { splits: [], payments: [] };
      buckets.set(currency, b);
    }
    return b;
  };
  splits.forEach((s) => bucketFor(s.currency || defaultCurrency).splits.push(s));
  payments.forEach((p) => bucketFor(p.currency || defaultCurrency).payments.push(p));

  const debtsByMember: Record<string, Debt[]> = {};
  const hubInfos: Array<{ user: TelegramBot.User; currency: string; passThrough: { user: TelegramBot.User; amount: number }[] }> = [];

  buckets.forEach(({ splits: cs, payments: cp }, currency) => {
    const usersGraph = {} as Record<string, Record<string, number>>;
    Object.keys(groupMembers).forEach((fromId) => {
      usersGraph[fromId] = {};
      Object.keys(groupMembers).forEach((toId) => {
        if (fromId !== toId) usersGraph[fromId][toId] = 0;
      });
    });

    const allTransactions = [] as TransactionGraph[];

    cs.forEach((split) => {
      const sumShares = split.mode === "shares" ? split.splits?.reduce((t, u) => (t += u.selected ? u.amount || 0 : 0), 0) || 0 : 0;
      const totalSplits = split.splits?.length || 0;

      split.splits?.forEach((member) => {
        const trans = { to: split.from, from: { ...member, selected: undefined, amount: undefined, user: undefined }, amount: 0, currency };

        if (split.mode === "equally") trans.amount = split.amount / totalSplits;
        else if (split.mode === "unequally") trans.amount = member.amount || 0;
        else if (split.mode === "percentages") trans.amount = (split.amount * (member.amount || 0)) / 100;
        else if (split.mode === "shares") trans.amount = (split.amount * (member.amount || 0)) / sumShares;

        if (trans.from.id !== trans.to.id && trans.amount && trans.amount > 0) allTransactions.push(trans);
      });
    });

    cp.forEach((payment) => {
      if (payment.to && payment.from.id !== payment.to?.id && payment.amount && payment.amount > 0)
        allTransactions.push({ to: payment.from, from: payment.to, amount: payment.amount, currency });
    });

    allTransactions.forEach((transaction) => {
      usersGraph[transaction.from.id][transaction.to.id] += transaction.amount;
    });

    const { transactions: simplifiedGraph, hub } = hubBasedSimplify(usersGraph);

    Object.keys(simplifiedGraph).forEach((fromId) => {
      Object.entries(simplifiedGraph[fromId]).forEach(([toId, amount]) => {
        if (amount > 0) {
          if (!debtsByMember[fromId]) debtsByMember[fromId] = [];
          debtsByMember[fromId].push({ ...groupMembers[toId], amount: floorAmount(amount), currency });
        }
      });
    });

    if (hub) {
      hubInfos.push({
        user: groupMembers[hub.id],
        currency,
        passThrough: hub.passThrough.map((p) => ({ user: groupMembers[p.id], amount: p.amount })),
      });
    }
  });

  const finalGraph = [] as GraphData[];
  group.members.forEach((member) => {
    const debts = debtsByMember[member.id];
    if (debts && debts.length > 0) {
      finalGraph.push({ ...member, debts });
    }
  });

  return {
    graph: finalGraph.sort((a, b) => a.first_name.localeCompare(b.first_name)),
    hubs: hubInfos,
  };
};
