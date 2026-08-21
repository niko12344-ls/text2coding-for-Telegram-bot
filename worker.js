/*
 * Telegram Encoding Bot - Cloudflare Workers
 * 必需配置: TELEGRAM_BOT_TOKEN, WEBHOOK_SECRET
 */

const MAX_INPUT_CHARS = 4096;
const MAX_MESSAGE_CHARS = 3900;

const HELP_MD = `# Telegram 编码机器人

## 使用方法
直接向机器人发送任意文本，然后从菜单中选择编码方式。

## 重要限制
- 不支持控制字符 (ASCII 0-31, 127)
- 不支持空字符 (\\x00)
- 仅支持可打印字符和常用Unicode字符

## 编码支持及字符兼容性

### 进制编码
- Hex (十六进制): 支持中文、Emoji、所有Unicode字符
- Decimal (十进制): 支持中文、Emoji、所有Unicode字符
- Octal (八进制): 支持中文、Emoji、所有Unicode字符
- Binary (二进制): 支持中文、Emoji、所有Unicode字符
- ASCII: 仅支持可打印ASCII字符(32-126)。中文、Emoji、控制字符不支持。

### Base编码
- Base16: 支持中文、Emoji、所有Unicode字符
- Base32: 支持中文、Emoji、所有Unicode字符
- Base58: 支持中文、Emoji、所有Unicode字符
- Base62: 支持中文、Emoji、所有Unicode字符
- Base64: 支持中文、Emoji、所有Unicode字符
- Base64URL: 支持中文、Emoji、所有Unicode字符
- Base85: 支持中文、Emoji、所有Unicode字符

### Unicode / UTF
- UTF-8: 支持中文、Emoji、所有Unicode字符
- UTF-16: 支持中文、Emoji、所有Unicode字符
- UTF-32: 支持中文、Emoji、所有Unicode字符
- Unicode码点: 支持中文、Emoji、所有Unicode字符
- Unicode转义: 支持中文、Emoji、所有Unicode字符

### Web / 转义
- URL编码: 支持中文、Emoji、所有Unicode字符
- HTML实体: 支持中文、Emoji、所有Unicode字符
- JSON转义: 支持中文、Emoji、所有Unicode字符

### 字符变换
- ROT13: 仅字母(A-Z, a-z)。中文/Emoji/控制字符保持不变(原样输出)
- ROT47: 仅可打印ASCII 33-126。中文/Emoji/控制字符保持不变(原样输出)
- Atbash: 仅字母(A-Z, a-z)。中文/Emoji/控制字符保持不变(原样输出)
- 摩斯密码: 仅字母和数字。中文/Emoji/控制字符保持不变(原样输出)

## 使用示例

中文 "你好":
- UTF-8 Hex: E4 BD A0 E5 A5 BD
- Unicode: U+4F60 U+597D
- Base64: 5L2g5aW9

Emoji "😀":
- UTF-8 Hex: F0 9F 98 80
- Unicode: U+1F600
- UTF-16: D83D DE00

英文 "Hello":
- ASCII: 72 101 108 108 111
- Hex: 48 65 6C 6C 6F
- Base64: SGVsbG8=

## 解码说明

部分编码不支持直接解码：

- UTF-8 / UTF-16 / UTF-32：编码结果是 Hex，请使用 Hex 解码
- Unicode 码点：输出格式如 U+4F60，去掉 U+ 后使用 Hex 解码
- ASCII：编码结果是十进制数字，请使用十进制解码
- Unicode 转义：与 JSON 转义格式冲突，暂不支持自动解码

其他编码直接在解码菜单选择对应方式即可。

## 重要说明
- 长结果(>3900字符)会自动转为TXT文件发送
- 编码不是加密，请勿用于密码、Token、私钥等敏感信息
- 无状态运行，不保存任何数据
- 部分编码(ASCII、ROT13、ROT47、Atbash、摩斯密码)有字符集限制
- 不支持控制字符 (如 \\x00, \\x01 等)

## 命令
/start - 启动机器人
/help - 查看帮助文档
`;

// ===== Telegram API =====
async function tg(method, env, body) {
    const r = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/${method}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
    });
    return r.json();
}

async function send(chatId, text, env, kb = null) {
    return tg("sendMessage", env, { chat_id: chatId, text, ...(kb && { reply_markup: kb }) });
}

async function edit(chatId, msgId, text, env, kb = null) {
    return tg("editMessageText", env, { 
        chat_id: chatId, 
        message_id: msgId, 
        text, 
        parse_mode: "HTML",
        ...(kb && { reply_markup: kb }) 
    });
}

async function answer(id, env) {
    return tg("answerCallbackQuery", env, { callback_query_id: id });
}

async function sendDoc(chatId, name, content, env, caption = "") {
    const form = new FormData();
    form.append("chat_id", String(chatId));
    form.append("document", new Blob([content], { type: "text/plain;charset=utf-8" }), name);
    if (caption) form.append("caption", caption);
    const r = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendDocument`, {
        method: "POST",
        body: form
    });
    return r.json();
}

// ===== 工具函数 =====
const utf8 = (t) => new TextEncoder().encode(t);
const utf8d = (b) => new TextDecoder("utf-8", { fatal: false }).decode(b);

const hex = (b, s = " ") => Array.from(b).map(x => x.toString(16).padStart(2, "0").toUpperCase()).join(s);
const hexd = (s) => {
    const c = s.replace(/\s+/g, "").replace(/0x/gi, "");
    if (!c || !/^[0-9a-fA-F]+$/.test(c) || c.length % 2) throw new Error("Hex数据无效");
    const r = new Uint8Array(c.length / 2);
    for (let i = 0; i < c.length; i += 2) r[i / 2] = parseInt(c.slice(i, i + 2), 16);
    return r;
};

const bin = (b) => Array.from(b).map(x => x.toString(2).padStart(8, "0")).join(" ");
const bind = (s) => {
    const c = s.replace(/\s+/g, "");
    if (!c || !/^[01]+$/.test(c) || c.length % 8) throw new Error("二进制数据无效");
    const r = new Uint8Array(c.length / 8);
    for (let i = 0; i < c.length; i += 8) r[i / 8] = parseInt(c.slice(i, i + 8), 2);
    return r;
};

const dec = (b) => Array.from(b).join(" ");
const decd = (s) => {
    const p = s.trim().split(/\s+/);
    if (!p.length) throw new Error("十进制数据无效");
    const r = new Uint8Array(p.length);
    p.forEach((x, i) => {
        if (!/^\d+$/.test(x)) throw new Error("非法数字");
        const n = Number(x);
        if (!Number.isInteger(n) || n < 0 || n > 255) throw new Error("数值须为0-255");
        r[i] = n;
    });
    return r;
};

const oct = (b) => Array.from(b).map(x => x.toString(8).padStart(3, "0")).join(" ");
const octd = (s) => {
    const p = s.trim().split(/\s+/);
    if (!p.length) throw new Error("八进制数据无效");
    const r = new Uint8Array(p.length);
    p.forEach((x, i) => {
        if (!/^[0-7]+$/.test(x)) throw new Error("非法八进制数字");
        const n = parseInt(x, 8);
        if (n > 255) throw new Error("八进制值不能超过377");
        r[i] = n;
    });
    return r;
};

const b64 = (b) => {
    let s = "";
    for (let i = 0; i < b.length; i += 8192) s += String.fromCharCode(...b.subarray(i, i + 8192));
    return btoa(s);
};
const b64d = (s) => {
    let c = s.replace(/\s+/g, "").replace(/-/g, "+").replace(/_/g, "/");
    while (c.length % 4) c += "=";
    let bin;
    try { bin = atob(c); } catch { throw new Error("Base64数据无效"); }
    const r = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) r[i] = bin.charCodeAt(i);
    return r;
};
const b64url = (b) => b64(b).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");

const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const b32 = (b) => {
    let bits = 0, val = 0, out = "";
    for (const x of b) { val = (val << 8) | x; bits += 8; while (bits >= 5) { out += B32[(val >>> (bits - 5)) & 31]; bits -= 5; } }
    if (bits) out += B32[(val << (5 - bits)) & 31];
    while (out.length % 8) out += "=";
    return out;
};
const b32d = (s) => {
    const c = s.replace(/\s+/g, "").replace(/=+$/g, "").toUpperCase();
    let bits = 0, val = 0, out = [];
    for (const ch of c) {
        const idx = B32.indexOf(ch);
        if (idx === -1) throw new Error("Base32数据无效");
        val = (val << 5) | idx; bits += 5;
        if (bits >= 8) { out.push((val >>> (bits - 8)) & 255); bits -= 8; }
    }
    return new Uint8Array(out);
};

const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const b58 = (b) => {
    if (!b.length) return "";
    let d = [0];
    for (const x of b) {
        let c = x;
        for (let i = 0; i < d.length; i++) { const v = d[i] * 256 + c; d[i] = v % 58; c = Math.floor(v / 58); }
        while (c > 0) { d.push(c % 58); c = Math.floor(c / 58); }
    }
    let r = "";
    for (const x of d) r += B58[x];
    for (const x of b) { if (x === 0) r += "1"; else break; }
    return r.split("").reverse().join("");
};
const b58d = (s) => {
    const c = s.replace(/\s+/g, "");
    if (!c) throw new Error("Base58数据为空");
    let b = [0];
    for (const ch of c) {
        const v = B58.indexOf(ch);
        if (v === -1) throw new Error("Base58字符无效");
        let carry = v;
        for (let i = 0; i < b.length; i++) { const n = b[i] * 58 + carry; b[i] = n & 255; carry = n >> 8; }
        while (carry > 0) { b.push(carry & 255); carry >>= 8; }
    }
    for (const ch of c) { if (ch === "1") b.push(0); else break; }
    return new Uint8Array(b.reverse());
};

const B62 = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
const b62 = (b) => {
    if (!b.length) return "";
    let d = [0];
    for (const x of b) {
        let c = x;
        for (let i = 0; i < d.length; i++) { const v = d[i] * 256 + c; d[i] = v % 62; c = Math.floor(v / 62); }
        while (c > 0) { d.push(c % 62); c = Math.floor(c / 62); }
    }
    let r = "";
    for (const x of d) r += B62[x];
    return r.split("").reverse().join("");
};
const b62d = (s) => {
    const c = s.replace(/\s+/g, "");
    if (!c) throw new Error("Base62数据为空");
    let b = [0];
    for (const ch of c) {
        const v = B62.indexOf(ch);
        if (v === -1) throw new Error("Base62字符无效");
        let carry = v;
        for (let i = 0; i < b.length; i++) { const n = b[i] * 62 + carry; b[i] = n & 255; carry = n >> 8; }
        while (carry > 0) { b.push(carry & 255); carry >>= 8; }
    }
    return new Uint8Array(b.reverse());
};

const b85 = (b) => {
    let out = "";
    for (let i = 0; i < b.length; i += 4) {
        const chunk = b.slice(i, i + 4);
        let v = 0;
        for (let j = 0; j < 4; j++) v = v * 256 + (chunk[j] || 0);
        let chars = "";
        for (let j = 0; j < 5; j++) { chars = String.fromCharCode(33 + (v % 85)) + chars; v = Math.floor(v / 85); }
        out += chars.slice(0, chunk.length + 1);
    }
    return out;
};
const b85d = (s) => {
    const c = s.replace(/\s+/g, "");
    if (!c) throw new Error("Base85数据为空");
    const out = [];
    for (let i = 0; i < c.length; i += 5) {
        const chunk = c.slice(i, i + 5);
        if (chunk.length === 1) throw new Error("Base85数据无效");
        let v = 0;
        for (let j = 0; j < 5; j++) {
            const ch = j < chunk.length ? chunk.charCodeAt(j) - 33 : 84;
            if (ch < 0 || ch >= 85) throw new Error("Base85字符无效");
            v = v * 85 + ch;
        }
        const bytes = [(v >>> 24) & 255, (v >>> 16) & 255, (v >>> 8) & 255, v & 255];
        out.push(...bytes.slice(0, chunk.length - 1));
    }
    return new Uint8Array(out);
};

const unicode = (t) => Array.from(t).map(ch => "U+" + ch.codePointAt(0).toString(16).toUpperCase().padStart(4, "0")).join(" ");
const unescape = (t) => Array.from(t).map(ch => {
    const cp = ch.codePointAt(0);
    if (cp <= 0xFFFF) return "\\u" + cp.toString(16).toUpperCase().padStart(4, "0");
    const h = Math.floor((cp - 0x10000) / 0x400) + 0xD800;
    const l = ((cp - 0x10000) % 0x400) + 0xDC00;
    return "\\u" + h.toString(16).toUpperCase().padStart(4, "0") + "\\u" + l.toString(16).toUpperCase().padStart(4, "0");
}).join("");

const htmlEn = (t) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
const htmlDe = (t) => t.replace(/&lt;/gi, "<").replace(/&gt;/gi, ">").replace(/&quot;/gi, '"').replace(/&#39;/gi, "'").replace(/&amp;/gi, "&");

const rot13 = (t) => t.replace(/[A-Za-z]/g, ch => String.fromCharCode(((ch.charCodeAt(0) - (ch <= "Z" ? 65 : 97) + 13) % 26) + (ch <= "Z" ? 65 : 97)));
const rot47 = (t) => Array.from(t).map(ch => { const n = ch.charCodeAt(0); return n >= 33 && n <= 126 ? String.fromCharCode(33 + ((n - 33 + 47) % 94)) : ch; }).join("");
const atbash = (t) => t.replace(/[A-Za-z]/g, ch => ch >= "A" && ch <= "Z" ? String.fromCharCode(90 - (ch.charCodeAt(0) - 65)) : String.fromCharCode(122 - (ch.charCodeAt(0) - 97)));

const MORSE = { A: ".-", B: "-...", C: "-.-.", D: "-..", E: ".", F: "..-.", G: "--.", H: "....", I: "..", J: ".---", K: "-.-", L: ".-..", M: "--", N: "-.", O: "---", P: ".--.", Q: "--.-", R: ".-.", S: "...", T: "-", U: "..-", V: "...-", W: ".--", X: "-..-", Y: "-.--", Z: "--..", "0": "-----", "1": ".----", "2": "..---", "3": "...--", "4": "....-", "5": ".....", "6": "-....", "7": "--...", "8": "---..", "9": "----." };
const morse = (t) => Array.from(t).map(ch => ch === " " ? "/" : MORSE[ch.toUpperCase()] || ch).join(" ");
const morsed = (t) => {
    const rev = {};
    for (const [k, v] of Object.entries(MORSE)) rev[v] = k;
    return t.trim().split(/\s+/).map(p => p === "/" ? " " : rev[p] || p).join("");
};

const urlEn = (t) => encodeURIComponent(t);
const urlDe = (t) => { try { return decodeURIComponent(t); } catch { throw new Error("URL编码无效"); } };

const jsonEn = (t) => JSON.stringify(t);
const jsonDe = (t) => { try { const v = JSON.parse(t); if (typeof v !== "string") throw new Error(); return v; } catch { throw new Error("JSON转义数据无效"); } };

const utf16 = (t) => Array.from(t).map(ch => {
    const cp = ch.codePointAt(0);
    if (cp <= 0xFFFF) return cp.toString(16).padStart(4, "0").toUpperCase();
    const n = cp - 0x10000;
    return (0xD800 + (n >> 10)).toString(16).padStart(4, "0").toUpperCase() + " " + (0xDC00 + (n & 0x3FF)).toString(16).padStart(4, "0").toUpperCase();
}).join(" ");
const utf32 = (t) => Array.from(t).map(ch => ch.codePointAt(0).toString(16).padStart(8, "0").toUpperCase()).join(" ");

const ascii = (t) => {
    for (const ch of t) if (ch.codePointAt(0) > 0x7F) throw new Error("ASCII不支持: " + ch);
    return Array.from(t).map(ch => ch.charCodeAt(0)).join(" ");
};

const NAMES = {
    hex: "Hex十六进制", decimal: "十进制", octal: "八进制", binary: "二进制", ascii: "ASCII", unicode: "Unicode码点",
    utf8: "UTF-8", utf16: "UTF-16", utf32: "UTF-32",
    base16: "Base16", base32: "Base32", base58: "Base58", base62: "Base62", base64: "Base64", base64url: "Base64URL", base85: "Base85",
    url: "URL编码", html: "HTML实体", unicode_escape: "Unicode转义", json: "JSON转义",
    rot13: "ROT13", rot47: "ROT47", atbash: "Atbash", morse: "摩斯密码"
};

// ===== 编解码 =====
function encode(type, text) {
    const b = utf8(text);
    switch (type) {
        case "hex": return hex(b);
        case "decimal": return dec(b);
        case "octal": return oct(b);
        case "binary": return bin(b);
        case "ascii": return ascii(text);
        case "unicode": return unicode(text);
        case "utf8": return hex(b);
        case "utf16": return utf16(text);
        case "utf32": return utf32(text);
        case "base16": return hex(b, "");
        case "base32": return b32(b);
        case "base58": return b58(b);
        case "base62": return b62(b);
        case "base64": return b64(b);
        case "base64url": return b64url(b);
        case "base85": return b85(b);
        case "url": return urlEn(text);
        case "html": return htmlEn(text);
        case "unicode_escape": return unescape(text);
        case "json": return jsonEn(text);
        case "rot13": return rot13(text);
        case "rot47": return rot47(text);
        case "atbash": return atbash(text);
        case "morse": return morse(text);
        default: throw new Error("未知编码方式");
    }
}

function decode(type, input) {
    switch (type) {
        case "hex": case "base16": case "utf8": return utf8d(hexd(input));
        case "binary": return utf8d(bind(input));
        case "decimal": return utf8d(decd(input));
        case "octal": return utf8d(octd(input));
        case "base32": return utf8d(b32d(input));
        case "base58": return utf8d(b58d(input));
        case "base62": return utf8d(b62d(input));
        case "base64": case "base64url": return utf8d(b64d(input));
        case "base85": return utf8d(b85d(input));
        case "url": return urlDe(input);
        case "html": return htmlDe(input);
        case "json": return jsonDe(input);
        case "rot13": return rot13(input);
        case "rot47": return rot47(input);
        case "atbash": return atbash(input);
        case "morse": return morsed(input);
        default: throw new Error("该编码方式不支持解码");
    }
}

// ===== 键盘 =====
const mainKb = () => ({
    inline_keyboard: [
        [{ text: "编码", callback_data: "menu:encode" }, { text: "解码", callback_data: "menu:decode" }]
    ]
});

const startKb = () => ({
    inline_keyboard: [
        [{ text: "帮助", callback_data: "help" }]
    ]
});

const encodeCat = () => ({
    inline_keyboard: [
        [{ text: "进制", callback_data: "cat:base" }, { text: "Base", callback_data: "cat:basecode" }],
        [{ text: "Unicode / UTF", callback_data: "cat:unicode" }],
        [{ text: "Web / 转义", callback_data: "cat:web" }],
        [{ text: "字符变换", callback_data: "cat:char" }],
        [{ text: "返回", callback_data: "back" }]
    ]
});

const catKb = (cat) => {
    const map = {
        base: [
            [{ text: "Hex", callback_data: "enc:hex" }, { text: "十进制", callback_data: "enc:decimal" }],
            [{ text: "八进制", callback_data: "enc:octal" }, { text: "二进制", callback_data: "enc:binary" }],
            [{ text: "ASCII", callback_data: "enc:ascii" }, { text: "Unicode码点", callback_data: "enc:unicode" }],
            [{ text: "返回", callback_data: "menu:encode" }]
        ],
        basecode: [
            [{ text: "Base16", callback_data: "enc:base16" }, { text: "Base32", callback_data: "enc:base32" }],
            [{ text: "Base58", callback_data: "enc:base58" }, { text: "Base62", callback_data: "enc:base62" }],
            [{ text: "Base64", callback_data: "enc:base64" }, { text: "Base64URL", callback_data: "enc:base64url" }],
            [{ text: "Base85", callback_data: "enc:base85" }],
            [{ text: "返回", callback_data: "menu:encode" }]
        ],
        unicode: [
            [{ text: "UTF-8", callback_data: "enc:utf8" }, { text: "UTF-16", callback_data: "enc:utf16" }],
            [{ text: "UTF-32", callback_data: "enc:utf32" }, { text: "Unicode转义", callback_data: "enc:unicode_escape" }],
            [{ text: "返回", callback_data: "menu:encode" }]
        ],
        web: [
            [{ text: "URL编码", callback_data: "enc:url" }, { text: "HTML实体", callback_data: "enc:html" }],
            [{ text: "JSON转义", callback_data: "enc:json" }],
            [{ text: "返回", callback_data: "menu:encode" }]
        ],
        char: [
            [{ text: "ROT13", callback_data: "enc:rot13" }, { text: "ROT47", callback_data: "enc:rot47" }],
            [{ text: "Atbash", callback_data: "enc:atbash" }, { text: "摩斯密码", callback_data: "enc:morse" }],
            [{ text: "返回", callback_data: "menu:encode" }]
        ]
    };
    return { inline_keyboard: map[cat] || map.base };
};

const decodeKb = () => ({
    inline_keyboard: [
        [{ text: "Hex", callback_data: "dec:hex" }, { text: "二进制", callback_data: "dec:binary" }],
        [{ text: "十进制", callback_data: "dec:decimal" }, { text: "八进制", callback_data: "dec:octal" }],
        [{ text: "Base16", callback_data: "dec:base16" }, { text: "Base32", callback_data: "dec:base32" }],
        [{ text: "Base58", callback_data: "dec:base58" }, { text: "Base62", callback_data: "dec:base62" }],
        [{ text: "Base64", callback_data: "dec:base64" }, { text: "Base64URL", callback_data: "dec:base64url" }],
        [{ text: "Base85", callback_data: "dec:base85" }],
        [{ text: "URL解码", callback_data: "dec:url" }, { text: "HTML解码", callback_data: "dec:html" }],
        [{ text: "JSON解析", callback_data: "dec:json" }, { text: "摩斯解码", callback_data: "dec:morse" }],
        [{ text: "ROT13", callback_data: "dec:rot13" }, { text: "ROT47", callback_data: "dec:rot47" }],
        [{ text: "Atbash", callback_data: "dec:atbash" }],
        [{ text: "返回", callback_data: "back" }]
    ]
});

const resultKb = () => ({
    inline_keyboard: [
        [{ text: "帮助", callback_data: "help" }]
    ]
});

async function sendHelp(chatId, env) {
    await sendDoc(chatId, "HELP.md", HELP_MD, env, "编码机器人使用说明");
}

// ===== 存储用户输入的原文 =====
const userInputs = {};

async function handleMsg(msg, env) {
    if (!msg?.chat) return;
    const chatId = msg.chat.id;
    const text = msg.text;
    if (typeof text !== "string") {
        await send(chatId, "仅支持文本消息。发送 /help 查看帮助。", env);
        return;
    }
    if (text === "/help" || text.toLowerCase() === "help") { await sendHelp(chatId, env); return; }
    if (text === "/start" || text === "/start@") {
        await send(chatId, "发送任意文本，然后选择编码方式。\n\n支持: Hex、Base64、UTF-8、URL编码、ROT13 等", env, startKb());
        return;
    }
    if (text.startsWith("/")) { await send(chatId, "未知命令。发送 /help 查看帮助。", env); return; }
    if (text.length > MAX_INPUT_CHARS) { await send(chatId, "输入过长。限制: " + MAX_INPUT_CHARS + " 个字符。", env); return; }

    userInputs[chatId] = text;

    await send(chatId, "原文:\n" + text + "\n\n请选择操作:", env, mainKb());
}

async function handleCb(query, env) {
    const data = query.data || "";
    const msg = query.message;
    if (!msg) return;
    await answer(query.id, env);

    const chatId = msg.chat.id;
    const msgId = msg.message_id;

    let original = userInputs[chatId] || "";
    if (!original) {
        const match = msg.text.match(/^原文:\n([\s\S]*?)\n\n请选择操作:/);
        if (match) {
            original = match[1];
            userInputs[chatId] = original;
        }
    }

    if (!original && data !== "help" && data !== "back") {
        await edit(chatId, msgId, "消息已过期，请重新发送文本。", env, {
            inline_keyboard: [[{ text: "重新开始", callback_data: "restart" }]]
        });
        return;
    }

    switch (data) {
        case "help": { await sendHelp(chatId, env); return; }
        case "back": {
            await edit(chatId, msgId, "原文:\n" + original + "\n\n请选择操作:", env, mainKb());
            return;
        }
        case "restart": {
            delete userInputs[chatId];
            await edit(chatId, msgId, "请重新发送需要处理的文本。", env, null);
            return;
        }
        case "menu:encode": {
            await edit(chatId, msgId, "原文:\n" + original + "\n\n选择编码分类:", env, encodeCat());
            return;
        }
        case "menu:decode": {
            await edit(chatId, msgId, "原文:\n" + original + "\n\n选择解码方式:", env, decodeKb());
            return;
        }
    }

    if (data.startsWith("cat:")) {
        const cat = data.substring(4);
        await edit(chatId, msgId, "原文:\n" + original + "\n\n选择编码方式:", env, catKb(cat));
        return;
    }

    if (data.startsWith("enc:")) {
        const type = data.substring(4);
        const name = NAMES[type] || type;
        try {
            const result = encode(type, original);
            const preview = result.length > 800 ? result.slice(0, 800) + "\n... (完整结果见文件)" : result;
            await edit(chatId, msgId,
                "[成功] " + name + " 编码完成\n\n" +
                "原文: " + (original.length > 60 ? original.slice(0, 60) + '...' : original) + "\n\n" +
                "结果:\n<code>" + preview + "</code>",
                env, resultKb()
            );
            if (result.length > 800) {
                await sendDoc(chatId, name + "-" + Date.now() + ".txt", result, env, "完整结果");
            }
            delete userInputs[chatId];
        } catch (e) {
            await edit(chatId, msgId, "[失败] " + name + " 编码失败\n\n错误: " + e.message, env, {
                inline_keyboard: [[{ text: "返回", callback_data: "menu:encode" }]]
            });
        }
        return;
    }

    if (data.startsWith("dec:")) {
        const type = data.substring(4);
        const name = NAMES[type] || type;
        try {
            const result = decode(type, original);
            const preview = result.length > 800 ? result.slice(0, 800) + "\n... (完整结果见文件)" : result;
            await edit(chatId, msgId,
                "[成功] " + name + " 解码完成\n\n" +
                "原文: " + (original.length > 60 ? original.slice(0, 60) + '...' : original) + "\n\n" +
                "结果:\n<code>" + preview + "</code>",
                env, resultKb()
            );
            if (result.length > 800) {
                await sendDoc(chatId, name + "-" + Date.now() + ".txt", result, env, "完整结果");
            }
            delete userInputs[chatId];
        } catch (e) {
            await edit(chatId, msgId, "[失败] " + name + " 解码失败\n\n错误: " + e.message, env, {
                inline_keyboard: [[{ text: "返回", callback_data: "menu:decode" }]]
            });
        }
        return;
    }

    await edit(chatId, msgId, "未知操作", env, null);
}

async function handleUpdate(update, env) {
    if (update.message) {
        const msg = update.message;
        if (typeof msg.text === "string" && !msg.text.startsWith("/") && msg.text.length <= MAX_INPUT_CHARS) {
            userInputs[msg.chat.id] = msg.text;
            await send(msg.chat.id, "原文:\n" + msg.text + "\n\n请选择操作:", env, mainKb());
            return;
        }
        await handleMsg(msg, env);
        return;
    }
    if (update.callback_query) {
        await handleCb(update.callback_query, env);
        return;
    }
}

// ===== Worker =====
export default {
    async fetch(request, env) {
        const url = new URL(request.url);
        if (request.method === "GET" && url.pathname === "/") {
            return new Response("Telegram Encoding Bot Running", { status: 200 });
        }
        if (request.method !== "POST") return new Response("Method Not Allowed", { status: 405 });

        const secret = request.headers.get("X-Telegram-Bot-Api-Secret-Token");
        if (!env.WEBHOOK_SECRET || secret !== env.WEBHOOK_SECRET) {
            return new Response("Forbidden", { status: 403 });
        }

        let update;
        try { update = await request.json(); } catch { return new Response("Bad Request", { status: 400 }); }

        try { await handleUpdate(update, env); } catch (e) { console.error(e); }

        return new Response("OK", { status: 200 });
    }
};