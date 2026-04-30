/**
 * Copyright (C) 2025 Ginko
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/
 *
 * This code is part of Ginko project (https://github.com/ginkohub)
 */

export const CONNECTION_UPDATE = 'connection.update';
export const CREDS_UPDATE = 'creds.update';
export const MESSAGING_HISTORY_SET = "messaging-history.set";
export const CHATS_UPSERT = 'chats.upsert';
export const CHATS_UPDATE = 'chats.update';
export const LID_MAPPING_UPDATE = 'lid-mapping.update';
export const CHATS_DELETE = 'chats.delete';
export const PRESENCE_UPDATE = 'presence.update';
export const CONTACTS_UPSERT = 'contacts.upsert';
export const CONTACTS_UPDATE = 'contacts.update';
export const MESSAGES_DELETE = 'messages.delete';
export const MESSAGES_UPDATE = 'messages.update';
export const MESSAGES_MEDIA_UPDATE = 'messages.media-update';
export const MESSAGES_UPSERT = 'messages.upsert';
export const MESSAGES_REACTION = 'messages.reaction';
export const MESSAGE_RECEIPT_UPDATE = 'message-receipt.update';
export const GROUPS_UPSERT = 'groups.upsert';
export const GROUPS_UPDATE = 'groups.update';
export const GROUP_PARTICIPANTS_UPDATE = 'group-participants.update';
export const GROUP_JOIN_REQUEST = 'group.join-request';
export const BLOCKLIST_SET = 'blocklist.set';
export const BLOCKLIST_UPDATE = 'blocklist.update';
export const CALL = 'call';
export const LABELS_EDIT = 'labels.edit';
export const LABELS_ASSOCIATION = 'labels.association';
export const NEWSLETTER_REACTION = 'newsletter.reaction';
export const NEWSLETTER_VIEW = 'newsletter.view';
export const NEWSLETTER_PARTICIPANTS_UPDATE = 'newsletter-participants.update';
export const NEWSLETTER_SETTINGS_UPDATE = 'newsletter-settings.update';


/**
 * @readonly
 * @enum {string}
 */
export const Events = Object.freeze({
  CONNECTION_UPDATE: CONNECTION_UPDATE,
  CREDS_UPDATE: CREDS_UPDATE,
  MESSAGING_HISTORY_SET: MESSAGING_HISTORY_SET,
  CHATS_UPSERT: CHATS_UPSERT,
  CHATS_UPDATE: CHATS_UPDATE,
  LID_MAPPING_UPDATE: LID_MAPPING_UPDATE,
  CHATS_DELETE: CHATS_DELETE,
  PRESENCE_UPDATE: PRESENCE_UPDATE,
  CONTACTS_UPSERT: CONTACTS_UPSERT,
  CONTACTS_UPDATE: CONTACTS_UPDATE,
  MESSAGES_DELETE: MESSAGES_DELETE,
  MESSAGES_UPDATE: MESSAGES_UPDATE,
  MESSAGES_MEDIA_UPDATE: MESSAGES_MEDIA_UPDATE,
  MESSAGES_UPSERT: MESSAGES_UPSERT,
  MESSAGES_REACTION: MESSAGES_REACTION,
  MESSAGE_RECEIPT_UPDATE: MESSAGE_RECEIPT_UPDATE,
  GROUPS_UPSERT: GROUPS_UPSERT,
  GROUPS_UPDATE: GROUPS_UPDATE,
  GROUP_PARTICIPANTS_UPDATE: GROUP_PARTICIPANTS_UPDATE,
  GROUP_JOIN_REQUEST: GROUP_JOIN_REQUEST,
  BLOCKLIST_SET: BLOCKLIST_SET,
  BLOCKLIST_UPDATE: BLOCKLIST_UPDATE,
  CALL: CALL,
  LABELS_EDIT: LABELS_EDIT,
  LABELS_ASSOCIATION: LABELS_ASSOCIATION,
  NEWSLETTER_REACTION: NEWSLETTER_REACTION,
  NEWSLETTER_VIEW: NEWSLETTER_VIEW,
  NEWSLETTER_PARTICIPANTS_UPDATE: NEWSLETTER_PARTICIPANTS_UPDATE,
  NEWSLETTER_SETTINGS_UPDATE: NEWSLETTER_SETTINGS_UPDATE,
});
