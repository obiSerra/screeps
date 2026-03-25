/**
 * Terminal Manager Module
 * Automated market trading for resource optimization
 * Manages buy/sell orders based on storage thresholds
 */

const CONFIG = require("./config");

/**
 * Resource thresholds for trading
 */
const THRESHOLDS = {
  [RESOURCE_ENERGY]: { min: CONFIG.ENERGY.TERMINAL.MIN_ENERGY, max: CONFIG.ENERGY.TERMINAL.MAX_ENERGY },
  [RESOURCE_HYDROGEN]: { min: CONFIG.TRADING.MINERALS.MIN, max: CONFIG.TRADING.MINERALS.MAX },
  [RESOURCE_OXYGEN]: { min: CONFIG.TRADING.MINERALS.MIN, max: CONFIG.TRADING.MINERALS.MAX },
  [RESOURCE_UTRIUM]: { min: CONFIG.TRADING.MINERALS.MIN, max: CONFIG.TRADING.MINERALS.MAX },
  [RESOURCE_LEMERGIUM]: { min: CONFIG.TRADING.MINERALS.MIN, max: CONFIG.TRADING.MINERALS.MAX },
  [RESOURCE_KEANIUM]: { min: CONFIG.TRADING.MINERALS.MIN, max: CONFIG.TRADING.MINERALS.MAX },
  [RESOURCE_ZYNTHIUM]: { min: CONFIG.TRADING.MINERALS.MIN, max: CONFIG.TRADING.MINERALS.MAX },
  [RESOURCE_CATALYST]: { min: CONFIG.TRADING.MINERALS.MIN, max: CONFIG.TRADING.MINERALS.MAX },
  [RESOURCE_GHODIUM]: { min: CONFIG.TRADING.GHODIUM.MIN, max: CONFIG.TRADING.GHODIUM.MAX },
  [RESOURCE_POWER]: { min: CONFIG.TRADING.POWER.MIN, max: CONFIG.TRADING.POWER.MAX },
  
  // Compounds
  OH: { min: CONFIG.TRADING.COMPOUNDS.MIN, max: CONFIG.TRADING.COMPOUNDS.MAX },
  UH: { min: CONFIG.TRADING.COMPOUNDS.MIN, max: CONFIG.TRADING.COMPOUNDS.MAX },
  UO: { min: CONFIG.TRADING.COMPOUNDS.MIN, max: CONFIG.TRADING.COMPOUNDS.MAX },
  KH: { min: CONFIG.TRADING.COMPOUNDS.MIN, max: CONFIG.TRADING.COMPOUNDS.MAX },
  KO: { min: CONFIG.TRADING.COMPOUNDS.MIN, max: CONFIG.TRADING.COMPOUNDS.MAX },
  LH: { min: CONFIG.TRADING.COMPOUNDS.MIN, max: CONFIG.TRADING.COMPOUNDS.MAX },
  LO: { min: CONFIG.TRADING.COMPOUNDS.MIN, max: CONFIG.TRADING.COMPOUNDS.MAX },
  ZH: { min: CONFIG.TRADING.COMPOUNDS.MIN, max: CONFIG.TRADING.COMPOUNDS.MAX },
  ZO: { min: CONFIG.TRADING.COMPOUNDS.MIN, max: CONFIG.TRADING.COMPOUNDS.MAX },
  GH: { min: CONFIG.TRADING.COMPOUNDS.MIN, max: CONFIG.TRADING.COMPOUNDS.MAX },
  GO: { min: CONFIG.TRADING.COMPOUNDS.MIN, max: CONFIG.TRADING.COMPOUNDS.MAX },
};

const CREDIT_RESERVE = CONFIG.TRADING.MIN_CREDITS;  // Minimum credits to maintain
const MAX_ORDER_SIZE = CONFIG.TRADING.MAX_ORDER_UNITS;    // Maximum units per order
const MIN_ORDER_VALUE = CONFIG.TRADING.MIN_ORDER_VALUE;    // Minimum credits for an order

/**
 * Check if room can afford to buy
 * @param {number} cost - Cost of purchase
 * @returns {boolean} Whether purchase is affordable
 */
const canAfford = (cost) => {
  return Game.market.credits >= (CREDIT_RESERVE + cost);
};

/**
 * Get best buy order for a resource
 * @param {string} resourceType - Resource to buy
 * @param {string} roomName - Room where terminal is located
 * @returns {Object|null} Best order or null
 */
const getBestBuyOrder = (resourceType, roomName) => {
  const orders = Game.market.getAllOrders({
    type: ORDER_SELL,
    resourceType: resourceType,
  });

  if (orders.length === 0) return null;

  // Sort by effective price (price + energy cost)
  const roomPos = Game.rooms[roomName];
  if (!roomPos) return null;

  const rankedOrders = orders
    .filter((o) => o.amount >= 100) // Minimum order size
    .map((order) => {
      const distance = Game.map.getRoomLinearDistance(roomName, order.roomName);
      const energyCost = Math.ceil((order.amount * distance) / 1000);
      const effectivePrice = order.price + energyCost / order.amount;
      return { ...order, effectivePrice, energyCost, distance };
    })
    .sort((a, b) => a.effectivePrice - b.effectivePrice);

  return rankedOrders.length > 0 ? rankedOrders[0] : null;
};

/**
 * Get best sell order for a resource
 * @param {string} resourceType - Resource to sell
 * @returns {Object|null} Best order or null
 */
const getBestSellOrder = (resourceType) => {
  const orders = Game.market.getAllOrders({
    type: ORDER_BUY,
    resourceType: resourceType,
  });

  if (orders.length === 0) return null;

  // Sort by price (highest first)
  const rankedOrders = orders
    .filter((o) => o.amount >= 100) // Minimum order size
    .sort((a, b) => b.price - a.price);

  return rankedOrders.length > 0 ? rankedOrders[0] : null;
};

/**
 * Execute a buy transaction
 * @param {Room} room - The room with terminal
 * @param {string} resourceType - Resource to buy
 * @param {number} shortage - Amount needed
 * @returns {Object} Transaction result
 */
const executeBuy = (room, resourceType, shortage) => {
  const terminal = room.terminal;
  if (!terminal) return { success: false, reason: "no terminal" };

  const order = getBestBuyOrder(resourceType, room.name);
  if (!order) return { success: false, reason: "no orders" };

  const amountToBuy = Math.min(shortage, order.amount, MAX_ORDER_SIZE);
  const cost = amountToBuy * order.price;

  if (!canAfford(cost + order.energyCost)) {
    return { success: false, reason: "insufficient credits", cost };
  }

  const result = Game.market.deal(order.id, amountToBuy, room.name);

  if (result === OK) {
    return {
      success: true,
      resourceType,
      amount: amountToBuy,
      cost,
      energyCost: order.energyCost,
      price: order.price,
    };
  }

  return { success: false, reason: `error ${result}` };
};

/**
 * Execute a sell transaction
 * @param {Room} room - The room with terminal
 * @param {string} resourceType - Resource to sell
 * @param {number} surplus - Amount to sell
 * @returns {Object} Transaction result
 */
const executeSell = (room, resourceType, surplus) => {
  const terminal = room.terminal;
  if (!terminal) return { success: false, reason: "no terminal" };

  const terminalAmount = terminal.store[resourceType] || 0;
  if (terminalAmount === 0) {
    return { success: false, reason: "not in terminal" };
  }

  const order = getBestSellOrder(resourceType);
  if (!order) return { success: false, reason: "no orders" };

  const amountToSell = Math.min(surplus, order.amount, terminalAmount, MAX_ORDER_SIZE);
  const revenue = amountToSell * order.price;

  if (revenue < MIN_ORDER_VALUE) {
    return { success: false, reason: "order too small", revenue };
  }

  const result = Game.market.deal(order.id, amountToSell, room.name);

  if (result === OK) {
    return {
      success: true,
      resourceType,
      amount: amountToSell,
      revenue,
      price: order.price,
    };
  }

  return { success: false, reason: `error ${result}` };
};

/**
 * Analyze storage and identify buy/sell opportunities
 * @param {Room} room - The room
 * @returns {Object} Trading opportunities
 */
const analyzeTrading = (room) => {
  const storage = room.storage;
  if (!storage) return { buys: [], sells: [] };

 const buys = [];
  const sells = [];

  for (const resourceType in THRESHOLDS) {
    const threshold = THRESHOLDS[resourceType];
    const storageAmount = storage.store[resourceType] || 0;

    // Check for shortage (below minimum)
    if (storageAmount < threshold.min) {
      const shortage = threshold.min - storageAmount;
      buys.push({ resourceType, shortage });
    }

    // Check for surplus (above maximum)
    if (storageAmount > threshold.max) {
      const surplus = storageAmount - threshold.max;
      sells.push({ resourceType, surplus });
    }
  }

  return { buys, sells };
};

/**
 * Main terminal management function - run every 10 ticks
 * @param {Room} room - The room to manage
 * @returns {Object} Status report
 */
const manageTerminal = (room) => {
  const terminal = room.terminal;
  if (!terminal) {
    return { active: false, reason: "no terminal" };
  }

  // Only trade every 10 ticks (rate limit)
  if (Game.time % 10 !== 0) {
    return { active: false, reason: "rate limited" };
  }

  const analysis = analyzeTrading(room);
  const transactions = [];

  // Execute buy orders (prioritize shortages)
  for (const buy of analysis.buys.slice(0, 1)) { // Only 1 buy per cycle
    const result = executeBuy(room, buy.resourceType, buy.shortage);
    if (result.success) {
      transactions.push({ type: "buy", ...result });
      console.log(`✅ Bought ${result.amount} ${result.resourceType} for ${result.cost} credits`);
    }
  }

  // Execute sell orders (prioritize surpluses)
  for (const sell of analysis.sells.slice(0, 1)) { // Only 1 sell per cycle
    const result = executeSell(room, sell.resourceType, sell.surplus);
    if (result.success) {
      transactions.push({ type: "sell", ...result });
      console.log(`💰 Sold ${result.amount} ${result.resourceType} for ${result.revenue} credits`);
    }
  }

  return {
    active: true,
    credits: Game.market.credits,
    buyOpportunities: analysis.buys.length,
    sellOpportunities: analysis.sells.length,
    transactions,
  };
};

/**
 * Get resources that need to be moved to terminal for selling
 * @param {Room} room - The room
 * @returns {Array} Resources to move to terminal
 */
const getTerminalTransferNeeds = (room) => {
  const analysis = analyzeTrading(room);
  const terminal = room.terminal;
  
  if (!terminal) return [];

  const needs = [];

  // Check which surplus resources are not in terminal
  for (const sell of analysis.sells) {
    const terminalAmount = terminal.store[sell.resourceType] || 0;
    if (terminalAmount < sell.surplus) {
      const needed = Math.min(sell.surplus - terminalAmount, 1000); // Move in chunks
      needs.push({
        resourceType: sell.resourceType,
        amount: needed,
        action: "toTerminal",
      });
    }
  }

  return needs;
};

module.exports = {
  manageTerminal,
  getTerminalTransferNeeds,
  analyzeTrading,
  THRESHOLDS,
};
