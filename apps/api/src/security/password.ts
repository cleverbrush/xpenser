import {
    randomBytes,
    type ScryptOptions,
    scrypt as scryptCallback,
    timingSafeEqual
} from 'node:crypto';

const keyLength = 64;
const scryptOptions: ScryptOptions = { N: 16_384, r: 8, p: 1 };

function scrypt(
    password: string,
    salt: string,
    options: ScryptOptions
): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        scryptCallback(password, salt, keyLength, options, (err, derived) => {
            if (err) {
                reject(err);
                return;
            }
            resolve(derived);
        });
    });
}

/** Hashes a local account password with scrypt and a per-password salt. */
export async function hashPassword(password: string): Promise<string> {
    const salt = randomBytes(16).toString('hex');
    const hash = await scrypt(password, salt, scryptOptions);
    return `${salt}:${hash.toString('hex')}`;
}

/** Verifies a password against a stored scrypt hash in constant time. */
export async function verifyPassword(
    password: string,
    stored: string
): Promise<boolean> {
    const [salt, hashHex] = stored.split(':');
    if (!salt || !hashHex) {
        return false;
    }

    const storedHash = Buffer.from(hashHex, 'hex');
    const derived = await scrypt(password, salt, scryptOptions);
    if (storedHash.length !== derived.length) {
        return false;
    }

    return timingSafeEqual(storedHash, derived);
}
