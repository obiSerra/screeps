/**
 * Link Manager Module
 * Coordinates energy transfers across link network
 * Architecture: Source links → Storage link → Controller link
 */

const CONFIG = require("./config");

/**
 * Identify link types by position (with 5-tick TTL cache)
 * Links rarely change position, so cache result for 5 ticks
 * @param {Room} room - The room to analyze
 * @returns {Object} Categorized links
 */
const categorizeLinksByType = (room) => {
  // Phase 2 optimization: 5-tick TTL cache for link categorization
  if (!global.linkCache) {
    global.linkCache = {};
  }
  
  const cached = global.linkCache[room.name];
  if (cached && Game.time - cached.tick < 5) {
    // Convert cached IDs back to objects (links may have died)
    const result = {
      sourceLinks: cached.sourceLinks
        .map(sl => ({ link: Game.getObjectById(sl.linkId), source: Game.getObjectById(sl.sourceId) }))
        .filter(sl => sl.link && sl.source),
      storageLink: cached.storageLinkId ? Game.getObjectById(cached.storageLinkId) : null,
      controllerLink: cached.controllerLinkId ? Game.getObjectById(cached.controllerLinkId) : null,
    };
    return result;
  }
  
  // Use Phase 1 room cache if available, otherwise find
  const cache = global.roomCache ? global.roomCache[room.name] : null;
  const links = cache ? cache.links : room.find(FIND_MY_STRUCTURES, {
    filter: (s) => s.structureType === STRUCTURE_LINK,
  });

  if (links.length === 0) {
    global.linkCache[room.name] = {
      tick: Game.time,
      sourceLinks: [],
      storageLinkId: null,
      controllerLinkId: null,
    };
    return { sourceLinks: [], storageLink: null, controllerLink: null };
  }

  const storage = room.storage;
  const controller = room.controller;
  const sources = cache ? cache.sources : room.find(FIND_SOURCES);

  const sourceLinks = [];
  let storageLink = null;
  let controllerLink = null;

  for (const link of links) {
    // Storage link: within range 2 of storage
    if (storage && link.pos.inRangeTo(storage, CONFIG.ENERGY.LINK.STORAGE_RANGE)) {
      storageLink = link;
      continue;
    }

    // Controller link: within range 3 of controller
    if (controller && link.pos.inRangeTo(controller, CONFIG.ENERGY.LINK.CONTROLLER_RANGE)) {
      controllerLink = link;
      continue;
    }

    // Source link: within range 2 of any source
    const nearSource = sources.find((source) => link.pos.inRangeTo(source, CONFIG.ENERGY.LINK.SOURCE_RANGE));
    if (nearSource) {
      sourceLinks.push({ link, source: nearSource });
      continue;
    }
  }

  // Cache result with IDs (objects don't serialize well)
  global.linkCache[room.name] = {
    tick: Game.time,
    sourceLinks: sourceLinks.map(sl => ({ linkId: sl.link.id, sourceId: sl.source.id })),
    storageLinkId: storageLink ? storageLink.id : null,
    controllerLinkId: controllerLink ? controllerLink.id : null,
  };

  return { sourceLinks, storageLink, controllerLink };
};

/**
 * Transfer energy from source links to storage link
 * @param {Array} sourceLinks - Array of {link, source} objects
 * @param {StructureLink} storageLink - Central storage link
 * @returns {number} Total energy transferred
 */
const transferFromSourcesToStorage = (sourceLinks, storageLink) => {
  if (!storageLink) return 0;

  let totalTransferred = 0;

  for (const { link } of sourceLinks) {
    // Skip if link on cooldown or insufficient energy
    if (link.cooldown > 0 || link.store[RESOURCE_ENERGY] < CONFIG.ENERGY.LINK.MIN_TRANSFER_AMOUNT) {
      continue;
    }

    // Skip if storage link is nearly full
    if (storageLink.store.getFreeCapacity(RESOURCE_ENERGY) < CONFIG.ENERGY.LINK.MIN_STORAGE_FREE_CAPACITY) {
      continue;
    }

    // Transfer energy to storage link
    const result = link.transferEnergy(storageLink);
    if (result === OK) {
      totalTransferred += link.store[RESOURCE_ENERGY];
    }
  }

  return totalTransferred;
};

/**
 * Transfer energy from storage link to controller link
 * @param {StructureLink} storageLink - Central storage link
 * @param {StructureLink} controllerLink - Controller link for upgraders
 * @returns {boolean} Whether transfer occurred
 */
const transferToControllerLink = (storageLink, controllerLink) => {
  if (!storageLink || !controllerLink) return false;

  // Only transfer if storage link has enough energy
  if (storageLink.store[RESOURCE_ENERGY] < CONFIG.ENERGY.LINK.STORAGE_TO_CONTROLLER_THRESHOLD) return false;

  // Only transfer if controller link needs energy
  if (controllerLink.store[RESOURCE_ENERGY] > CONFIG.ENERGY.LINK.STORAGE_TO_CONTROLLER_THRESHOLD) return false;

  // Check cooldown
  if (storageLink.cooldown > 0) return false;

  // Transfer energy
  const result = storageLink.transferEnergy(controllerLink);
  return result === OK;
};

/**
 * Main link management function - run every tick
 * @param {Room} room - The room to manage
 * @returns {Object} Status report
 */
const manageLinkNetwork = (room) => {
  // Phase 2 optimization: Remove duplicate room.find() - use categorizeLinksByType result instead
  // Categorize links (uses cached data if available)
  const { sourceLinks, storageLink, controllerLink } = categorizeLinksByType(room);
  
  // Early exit if no links found
  if (sourceLinks.length === 0 && !storageLink && !controllerLink) {
    return { active: false, reason: "no links" };
  }

  // Track transfers
  let sourcesToStorageTransfers = 0;
  let storageToControllerTransfer = false;

  // Phase 1: Transfer from source links to storage link
  if (sourceLinks.length > 0 && storageLink) {
    sourcesToStorageTransfers = transferFromSourcesToStorage(sourceLinks, storageLink);
  }

  // Phase 2: Transfer from storage link to controller link (prioritize upgraders)
  if (storageLink && controllerLink) {
    storageToControllerTransfer = transferToControllerLink(storageLink, controllerLink);
  }

  return {
    active: true,
    sourceLinks: sourceLinks.length,
    hasStorageLink: !!storageLink,
    hasControllerLink: !!controllerLink,
    sourcesToStorageTransfers,
    storageToControllerTransfer,
  };
};

/**
 * Check if room has active link network (for roster calculations)
 * @param {Room} room - The room to check
 * @returns {boolean} Whether link network is active
 */
const hasActiveLinkNetwork = (room) => {
  const { sourceLinks, storageLink } = categorizeLinksByType(room);
  // Network is active if we have at least one source link and a storage link
  return sourceLinks.length > 0 && storageLink !== null;
};

/**
 * Get link near position (for miners and upgraders)
 * Phase 2 optimization: Use Phase 1 roomCache instead of room.find()
 * @param {Room} room - The room
 * @param {RoomPosition} pos - Position to check near
 * @param {number} range - Range to check (default 1)
 * @returns {StructureLink|null} Nearby link or null
 */
const getLinkNearPosition = (room, pos, range = 1) => {
  // Use Phase 1 room cache if available
  const cache = global.roomCache ? global.roomCache[room.name] : null;
  const links = cache ? cache.links : room.find(FIND_MY_STRUCTURES, {
    filter: (s) => s.structureType === STRUCTURE_LINK,
  });
  
  const nearbyLink = links.find(link => link.pos.inRangeTo(pos, range));
  return nearbyLink || null;
};

module.exports = {
  manageLinkNetwork,
  hasActiveLinkNetwork,
  getLinkNearPosition,
  categorizeLinksByType,
};
