// CommonJS polyfills for Node Jest runs
const { TextEncoder, TextDecoder } = require("util");
if (!global.TextEncoder) global.TextEncoder = TextEncoder;
if (!global.TextDecoder) global.TextDecoder = TextDecoder;

const { webcrypto } = require("node:crypto");
if (!global.crypto) global.crypto = webcrypto;
