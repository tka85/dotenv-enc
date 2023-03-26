import crypto from 'crypto';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import dotenv from 'dotenv';

export const DEFAULT_ENCRYPTED_FILE = './.env.enc';
export const DEFAULT_DECRYPTED_FILE = './.env';
const ALGOR = 'aes-256-ctr';
const IV_LENGTH = 16;
const MAX_KEY_LENGTH = 32;
const BUFFER_PADDING = Buffer.alloc(MAX_KEY_LENGTH); // key used in createCipheriv()/createDecipheriv() buffer needs to be 32 bytes

type decryptParams = {
    passwd?: string, // default is process.env.DOTENVENC_PASS
    encryptedFile?: string,
    print?: boolean
};

type encryptParams = {
    passwd: string, // default is process.env.DOTENVENC_PASS
    decryptedFile?: string,
    encryptedFile?: string,
};

/**
 * Read encrypted env file and either print it on console or create process.env variables from it
 * @param     {String}    passwd            the password for decrypting the encrypted .env.enc (memory only;no disk)
 * @param     {String}    [encryptedFile]   the full path of encrypted file or DEFAULT_ENCRYPTED_PATHNAME if ommitted
 * @param     {Boolean}   [print]           whether to print result on console
 * @returns   {Object}                      the config object as it's parsed by dotenv
 */
export function decrypt(params?: decryptParams): { [key: string]: any } {
    const passwd = (params && params.passwd) || process.env.DOTENVENC_PASS;
    const encryptedFile = (params && params.encryptedFile) || DEFAULT_ENCRYPTED_FILE;
    console.log(`>>> process.env.DOTENVENC_PASS`, process.env.DOTENVENC_PASS);
    console.log(`>>> passwd`, passwd);
    console.log(`>>> encryptedFile`, encryptedFile);
    if (!passwd) {
        throw new Error('Env variable DOTENVENC_PASS not set and no password provided. Decryption requires a password');
    }
    if (params && params.encryptedFile && !existsSync(params.encryptedFile)) {
        throw new Error(`Encrypted secrets input file "${params.encryptedFile}" not found`);
    }
    const allEncrData = readFileSync(encryptedFile);
    const [ivText, encText] = allEncrData.toString().split(':');
    const ivBuff = Buffer.from(ivText, 'hex');
    const encrBuff = Buffer.from(encText, 'hex');
    const decipher = crypto.createDecipheriv(ALGOR, Buffer.concat([Buffer.from(passwd), BUFFER_PADDING], MAX_KEY_LENGTH), ivBuff);
    const decrBuff = Buffer.concat([decipher.update(encrBuff), decipher.final()]);
    const parsedEnv = dotenv.parse(decrBuff);
    Object.assign(process.env, parsedEnv);
    if (params && params.print) {
        console.log('Added to process.env:', parsedEnv);
    }
    return parsedEnv;
}

/**
 * Write to disk encrypted env secrets file from decrypted env secrets file
 * @param     {String}    passwd             the password for encrypting the .env into .env.enc
 * @param     {String}    [decryptedFile]    the full path of decrypted file or DEFAULT_DECRYPTED_PATHNAME if ommitted
 * @param     {String}    [encryptedFile]    the full path of encrypted file or DEFAULT_ENCRYPTED_PATHNAME if ommitted
 * @returns   {Buffer}                       returns Buffer with encrypted data [regardless of whether it persisted it on disk or not]
 */
export function encrypt(params?: encryptParams): Buffer {
    const passwd = (params && params.passwd) || process.env.DOTENVENC_PASS;
    const decryptedFile = (params && params.decryptedFile) || DEFAULT_DECRYPTED_FILE;
    const encryptedFile = (params && params.encryptedFile) || DEFAULT_ENCRYPTED_FILE;
    if (!passwd) {
        throw new Error('Env variable DOTENVENC_PASS not set and no password provided. Encryption requires a password');
    }
    if (!existsSync(decryptedFile)) {
        throw new Error(`Unencrypted secrets input file "${decryptedFile}" not found`);
    }
    if (encryptedFile && existsSync(encryptedFile)) {
        console.warn(`Encrypted secrets output file "${encryptedFile}" already exists; overwriting...`);
    }
    const ivBuff = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGOR, Buffer.concat([Buffer.from(passwd), BUFFER_PADDING], MAX_KEY_LENGTH), ivBuff);
    const encrBuff = Buffer.concat([cipher.update(readFileSync(decryptedFile)), cipher.final()]);
    writeFileSync(encryptedFile, ivBuff.toString('hex') + ':' + encrBuff.toString('hex'));
    return encrBuff;
}