/**
 * Link Manager Module
 * Coordinates energy transfers across link network
 * Architecture: Source links → Storage link → Controller link
 */

/**
 * Identify link types by position
 * @param {Room} room - The room to analyze
 * @returns {Object} Categorized links
 */
const categorizeLinksByType = (room) => {
  const links = room.find(FIND_MY_STRUCTURES, {
    filter: (s) => s.structureType === STRUCTURE_LINK,
  });

  if (links.length === 0) {
    return { sourceLinks: [], storageLink: null, controllerLink: null };
  }

  const storage = room.storage;
  const controller = room.controller;
  const sources = room.find(FIND_SOURCES);

  const sourceLinks = [];
  let storageLink = null;
  let controllerLink = null;

  for (const link of links) {
    // Storage link: within range 2 of storage
    if (storage && link.pos.inRangeTo(storage, 2)) {
      storageLink = link;
      continue;
    }

    // Controller link: within range 3 of controller
    if (controller && link.pos.inRangeTo(controller, 3)) {
      controllerLink = link;
      continue;
    }

    // Source link: within range 2 of any source
    const nearSource = sources.find((source) => link.pos.inRangeTo(source, 2));
    if (nearSource) {
      sourceLinks.push({ link, source: nearSource });
      continue;
    }
  }

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
    if (link.cooldown > 0 || link.store[RESOURCE_ENERGY] < 400) {
      continue;
    }

    // Skip if storage link is nearly full
    if (storageLink.store.getFreeCapacity(RESOURCE_ENERGY) < 100) {
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
  if (storageLink.store[RESOURCE_ENERGY] < 400) return false;

  // Only transfer if controller link needs energy
  if (controllerLink.store[RESOURCE_ENERGY] > 400) return false;

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
  // Only run if room has links
  const linkCount = room.find(FIND_MY_STRUCTURES, {
    filter: (s) => s.structureType === STRUCTURE_LINK,
  }).length;

  if (linkCount === 0) {
    return { active: false, reason: "no links" };
  }

  // Categorize links
  const { sourceLinks, storageLink, controllerLink } = categorizeLinksByType(room);

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
 * @param {Room} room - The room
 * @param {RoomPosition} pos - Position to check near
 * @param {number} range - Range to check (default 1)
 * @returns {StructureLink|null} Nearby link or null
 */
const getLinkNearPosition = (room, pos, range = 1) => {
  const links = room.find(FIND_MY_STRUCTURES, {
    filter: (s) => s.structureType === STRUCTURE_LINK && s.pos.inRangeTo(pos, range),
  });

  return links.length > 0 ? links[0] : null;
};

module.exports = {
  manageLinkNetwork,
  hasActiveLinkNetwork,
  getLinkNearPosition,
  categorizeLinksByType,
};
