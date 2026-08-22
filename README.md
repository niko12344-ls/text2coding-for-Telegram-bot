# text2coding-for-Telegram-bot

一个运行在 Cloudflare Workers 上的 Telegram 编码/解码机器人，支持数十种编码方式。

## 功能

- 进制编码：Hex、十进制、八进制、二进制、ASCII、Unicode
- Base 系列：Base16/32/58/62/64/64URL/85
- Unicode/UTF：UTF-8/16/32、Unicode 转义
- Web 相关：URL 编码、HTML 实体、JSON 转义
- 字符变换：ROT13、ROT47、Atbash、摩斯密码
- 字体转换：Wingdings
- 支持中文、Emoji（部分编码有限制）
- 长结果自动转为 TXT 文件发送
- 无状态运行，不保存任何数据
## 解码说明

部分编码的解码需要通过其他方式实现：

| 编码 | 如何解码 |
|------|----------|
| UTF-8 / UTF-16 / UTF-32 | 编码结果是 Hex，用 Hex 解码即可 |
| Unicode 码点 | 输出格式为 U+4F60，去掉 U+ 后用 Hex 解码 |
| ASCII | 编码结果是十进制数字，用十进制解码即可 |
| Unicode 转义 | 输出包含 \u 前缀，与 JSON 转义格式不同，暂不支持自动解码 |

其余编码直接在解码菜单中选用对应方式即可。

## 部署

### 1. 创建 Telegram Bot

在 Telegram 中搜索 @BotFather，发送 `/newbot` 创建机器人，获取 Bot Token。

### 2. 部署到 Cloudflare Workers

复制 `worker.js` 内容，粘贴到 Cloudflare Workers 编辑器中，保存并部署。

### 3. 设置环境变量

在 Workers 设置中添加：

| 变量名 | 说明 |
|--------|------|
| TELEGRAM_BOT_TOKEN | 你的 Bot Token |
| WEBHOOK_SECRET | 自定义密钥，随便填 |

### 4. 设置 Webhook

浏览器访问以下地址（替换成你自己的值）：
https://api.telegram.org/bot<你的BOT_TOKEN>/setWebhook?url=https://<你的Worker域名>&secret_token=<你的WEBHOOK_SECRET>

### 5. 验证

浏览器访问：
https://api.telegram.org/bot<你的BOT_TOKEN>/getWebhookInfo
返回 `"ok": true` 即部署成功。

## 使用

发送任意文本，机器人会显示编码/解码菜单。
用户：Hello World
机器人：原文: Hello World
请选择操作: [编码] [解码]

用户点击：编码 → Base → Base64
机器人：[成功] Base64 编码完成
原文: Hello World
结果: SGVsbG8gV29ybGQ=

## 编码支持说明

| 编码 | 中文 | Emoji | 说明 |
|------|------|-------|------|
| Hex | ✅ | ✅ | |
| 十进制 | ✅ | ✅ | |
| 八进制 | ✅ | ✅ | |
| 二进制 | ✅ | ✅ | |
| ASCII | ❌ | ❌ | 仅 ASCII 可打印字符 |
| Base16 | ✅ | ✅ | |
| Base32 | ✅ | ✅ | |
| Base58 | ✅ | ✅ | |
| Base62 | ✅ | ✅ | |
| Base64 | ✅ | ✅ | |
| Base64URL | ✅ | ✅ | |
| Base85 | ✅ | ✅ | |
| UTF-8 | ✅ | ✅ | |
| UTF-16 | ✅ | ✅ | |
| UTF-32 | ✅ | ✅ | |
| Unicode 码点 | ✅ | ✅ | |
| Unicode 转义 | ✅ | ✅ | |
| URL 编码 | ✅ | ✅ | |
| HTML 实体 | ✅ | ✅ | |
| JSON 转义 | ✅ | ✅ | |
| ROT13 | ❌ | ❌ | 仅字母 |
| ROT47 | ❌ | ❌ | 仅可打印 ASCII |
| Atbash | ❌ | ❌ | 仅字母 |
| 摩斯密码 | ❌ | ❌ | 仅字母和数字 |
| Wingdings | ❌ | ❌ | 仅字母和数字 |

## 解码说明

部分编码的解码需要通过其他方式实现：

| 编码 | 如何解码 |
|------|----------|
| UTF-8 / UTF-16 / UTF-32 | 编码结果是 Hex，用 Hex 解码即可 |
| Unicode 码点 | 输出格式为 U+4F60，去掉 U+ 后用 Hex 解码 |
| ASCII | 编码结果是十进制数字，用十进制解码即可 |
| Unicode 转义 | 输出包含 \u 前缀，与 JSON 转义格式不同，暂不支持自动解码 |

其余编码直接在解码菜单中选用对应方式即可。

## 字体转换说明

Wingdings 是符号字体，将字母和数字转换为对应的符号：

| 输入 | 输出 |
|------|------|
| A | ✈ |
| B | ☺ |
| C | ☻ |
| D | ♠ |
| Hello | ✈☺☻♠♣ |

**注意**：Wingdings 仅支持字母和数字，中文、Emoji 等字符保持不变。

## 注意事项

- 编码不是加密，不要用于保护密码、Token、私钥等敏感信息
- 输入限制 4096 字符
- 结果超过 3900 字符自动转为 TXT 文件
- 不支持控制字符


## 注意事项

- 编码不是加密，不要用于保护密码、Token、私钥等敏感信息
- 输入限制 4096 字符
- 结果超过 3900 字符自动转为 TXT 文件
- 不支持控制字符

## 许可证

MIT