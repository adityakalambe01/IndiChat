import {
  Contact,
  ContactField,
  ContactsSortOrder,
  getPermissionsAsync,
  requestPermissionsAsync,
} from 'expo-contacts';
import { api } from './api';
import { MatchedContactDto } from '@chat/shared-types';

export interface DeviceContactItem {
  id: string;
  name: string;
  phoneNumber: string;
}

export interface MatchedContactItem extends MatchedContactDto {
  contactName: string;
}

export interface ContactDiscoveryResult {
  matched: MatchedContactItem[];
  unregistered: DeviceContactItem[];
  totalDeviceContacts: number;
}

export interface PermissionStatusResult {
  granted: boolean;
  canAskAgain: boolean;
  status: string;
}

/**
 * Checks existing Contacts permission without prompting using the modern API
 */
export async function checkContactsPermission(): Promise<PermissionStatusResult> {
  try {
    const { status, canAskAgain, granted } = await getPermissionsAsync();
    return {
      granted: granted || status === 'granted',
      canAskAgain,
      status,
    };
  } catch (error) {
    console.warn('Failed to check contacts permission:', error);
    return {
      granted: false,
      canAskAgain: true,
      status: 'undetermined',
    };
  }
}

/**
 * Prompts user for Contacts permission using the modern API
 */
export async function requestContactsPermission(): Promise<PermissionStatusResult> {
  try {
    const { status, canAskAgain, granted } = await requestPermissionsAsync();
    return {
      granted: granted || status === 'granted',
      canAskAgain,
      status,
    };
  } catch (error) {
    console.warn('Failed to request contacts permission:', error);
    return {
      granted: false,
      canAskAgain: false,
      status: 'denied',
    };
  }
}

/**
 * Helper to strip non-digit characters for matching comparison
 */
function cleanDigits(phone: string): string {
  return phone.replace(/[^\d]/g, '');
}

/**
 * Reads device contacts using the modern class-based Contact API,
 * queries backend for matches, and partitions into matched IndiChat users
 * and unregistered contacts available for invite.
 */
export async function discoverContacts(defaultRegion = 'US'): Promise<ContactDiscoveryResult> {
  const perm = await checkContactsPermission();
  if (!perm.granted) {
    throw new Error('PERMISSION_DENIED');
  }

  // Fetch device contacts using the new class-based Contact API from expo-contacts
  let rawContacts: Array<{
    id: string;
    fullName?: string | null;
    givenName?: string | null;
    familyName?: string | null;
    phones?: Array<{ number?: string }>;
  }> = [];

  try {
    if (typeof Contact.getAllDetails === 'function') {
      rawContacts = await Contact.getAllDetails(
        [
          ContactField.FULL_NAME,
          ContactField.GIVEN_NAME,
          ContactField.FAMILY_NAME,
          ContactField.PHONES,
        ],
        {
          sortOrder: ContactsSortOrder.GivenName,
        }
      );
    } else if (typeof Contact.getAll === 'function') {
      const all = await Contact.getAll({ sortOrder: ContactsSortOrder.GivenName });
      for (const c of all) {
        const details = await c.getDetails([
          ContactField.FULL_NAME,
          ContactField.GIVEN_NAME,
          ContactField.FAMILY_NAME,
          ContactField.PHONES,
        ]);
        rawContacts.push({
          id: c.id,
          fullName: (details as any).fullName,
          givenName: (details as any).givenName,
          familyName: (details as any).familyName,
          phones: (details as any).phones,
        });
      }
    }
  } catch (fetchError) {
    console.warn('Contact.getAllDetails failed, trying Contact.getAll:', fetchError);
    if (typeof Contact.getAll === 'function') {
      const all = await Contact.getAll();
      for (const c of all) {
        const details = await c.getDetails([ContactField.FULL_NAME, ContactField.PHONES]);
        rawContacts.push({
          id: c.id,
          fullName: (details as any).fullName,
          phones: (details as any).phones,
        });
      }
    }
  }

  if (!rawContacts || rawContacts.length === 0) {
    return {
      matched: [],
      unregistered: [],
      totalDeviceContacts: 0,
    };
  }

  // Map numbers to local contacts
  // Clean phone numbers and deduplicate
  const phoneToContact = new Map<string, { id: string; name: string; rawPhone: string }>();
  const rawNumbersToQuery: string[] = [];
  const contactMapById = new Map<string, DeviceContactItem>();

  for (const contact of rawContacts) {
    const displayName =
      contact.fullName ||
      [contact.givenName, contact.familyName].filter(Boolean).join(' ') ||
      'Unknown Contact';

    if (!contact.phones || contact.phones.length === 0) continue;

    for (const p of contact.phones) {
      if (!p.number) continue;
      const trimmed = p.number.trim();
      if (!trimmed) continue;

      const digits = cleanDigits(trimmed);
      if (digits.length < 7) continue; // Skip numbers that are clearly too short

      if (!phoneToContact.has(digits)) {
        phoneToContact.set(digits, {
          id: contact.id || digits,
          name: displayName,
          rawPhone: trimmed,
        });
        rawNumbersToQuery.push(trimmed);
      }

      if (!contactMapById.has(contact.id || digits)) {
        contactMapById.set(contact.id || digits, {
          id: contact.id || digits,
          name: displayName,
          phoneNumber: trimmed,
        });
      }
    }
  }

  if (rawNumbersToQuery.length === 0) {
    return {
      matched: [],
      unregistered: Array.from(contactMapById.values()),
      totalDeviceContacts: rawContacts.length,
    };
  }

  // Cap at 500 numbers to respect API security limit
  const batchToQuery = rawNumbersToQuery.slice(0, 500);

  // Call authenticated backend API
  const response = await api.matchContacts(batchToQuery, defaultRegion);

  const matchedDigitsSet = new Set<string>();
  const matchedList: MatchedContactItem[] = [];

  for (const m of response.matches) {
    const mDigits = cleanDigits(m.phoneNumber);
    matchedDigitsSet.add(mDigits);

    // Find local contact name if available
    let localName = m.displayName;
    const localContact = phoneToContact.get(mDigits);
    if (localContact?.name) {
      localName = localContact.name;
    } else {
      // Check last 10 digits in case country code differences
      for (const [key, val] of phoneToContact.entries()) {
        if (key.endsWith(mDigits) || mDigits.endsWith(key)) {
          localName = val.name;
          matchedDigitsSet.add(key);
          break;
        }
      }
    }

    matchedList.push({
      ...m,
      contactName: localName,
    });
  }

  // Filter out matched contacts from the unregistered contacts list
  const unregisteredList: DeviceContactItem[] = [];
  for (const contact of contactMapById.values()) {
    const cDigits = cleanDigits(contact.phoneNumber);
    let isMatched = matchedDigitsSet.has(cDigits);

    if (!isMatched) {
      for (const mDigits of matchedDigitsSet) {
        if (cDigits.endsWith(mDigits) || mDigits.endsWith(cDigits)) {
          isMatched = true;
          break;
        }
      }
    }

    if (!isMatched) {
      unregisteredList.push(contact);
    }
  }

  // Sort matched contacts: online first, then by contact name
  matchedList.sort((a, b) => {
    if (a.isOnline && !b.isOnline) return -1;
    if (!a.isOnline && b.isOnline) return 1;
    return a.contactName.localeCompare(b.contactName);
  });

  // Sort unregistered contacts alphabetically
  unregisteredList.sort((a, b) => a.name.localeCompare(b.name));

  return {
    matched: matchedList,
    unregistered: unregisteredList,
    totalDeviceContacts: rawContacts.length,
  };
}
