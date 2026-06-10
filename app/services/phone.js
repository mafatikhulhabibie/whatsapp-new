import { parsePhoneNumberWithError } from 'libphonenumber-js';

function toWaDigits(phone) {
    return phone.format('E.164').replace('+', '');
}

function tryParse(value) {
    try {
        const phone = parsePhoneNumberWithError(value);
        if (phone.isValid()) {
            return phone;
        }
    }
    catch {
        return null;
    }
    return null;
}

export function normalizeToWhatsAppNumber(input, defaultCountry = 'ID') {
    if (!input || typeof input !== 'string') {
        return input;
    }
    const trimmed = input.trim();
    if (!trimmed || trimmed.includes('@')) {
        return trimmed;
    }
    const cleaned = trimmed.replace(/[\s\-().]/g, '');
    const digitsOnly = cleaned.replace(/^\+/, '');

    // Indonesia: 08xxxxxxxx
    if (/^0\d+$/.test(digitsOnly)) {
        const phone = tryParse(`+62${digitsOnly.slice(1)}`);
        return phone?.country === 'ID' ? toWaDigits(phone) : `62${digitsOnly.slice(1)}`;
    }

    // International dengan +
    if (cleaned.startsWith('+')) {
        const phone = tryParse(cleaned);
        if (phone) {
            return toWaDigits(phone);
        }
    }

    // Indonesia: sudah pakai 62
    if (digitsOnly.startsWith('62')) {
        const phone = tryParse(`+${digitsOnly}`);
        if (phone) {
            return toWaDigits(phone);
        }
        return digitsOnly;
    }

    // Indonesia: nomor lokal tanpa 0/62 (812..., 822..., dll)
    if (/^8\d{8,11}$/.test(digitsOnly)) {
        const phone = tryParse(`+62${digitsOnly}`);
        if (phone?.country === 'ID') {
            return toWaDigits(phone);
        }
        return `62${digitsOnly}`;
    }

    // Negara lain: parse sebagai nomor internasional
    const intlPhone = tryParse(`+${digitsOnly}`);
    if (intlPhone) {
        return toWaDigits(intlPhone);
    }

    // Fallback: default Indonesia untuk input ambigu
    if (defaultCountry === 'ID') {
        const phone = tryParse(`+62${digitsOnly}`);
        if (phone?.country === 'ID') {
            return toWaDigits(phone);
        }
    }

    return digitsOnly;
}
