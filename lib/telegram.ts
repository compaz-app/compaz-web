const TELEGRAM_API = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`

type ReplyKeyboard = { keyboard: { text: string }[][]; resize_keyboard: boolean; one_time_keyboard?: boolean }
type RemoveKeyboard = { remove_keyboard: true }

export async function sendTelegramMessage(
  chatId: string,
  text: string,
  replyMarkup?: ReplyKeyboard | RemoveKeyboard,
): Promise<void> {
  const res = await fetch(`${TELEGRAM_API}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
      ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
    }),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Telegram sendMessage error: ${err}`)
  }
}

// Teclados reutilizables
export const TECLADO_INICIO = {
  keyboard: [[{ text: '▶️ Iniciar visita' }]],
  resize_keyboard: true,
} satisfies ReplyKeyboard

export const TECLADO_DURANTE_VISITA = {
  keyboard: [[{ text: '🔴 Terminar visita' }]],
  resize_keyboard: true,
} satisfies ReplyKeyboard

export const TECLADO_CONFIRMAR_INICIO = {
  keyboard: [[{ text: '✅ Sí, iniciar' }, { text: '❌ Cancelar' }]],
  resize_keyboard: true,
  one_time_keyboard: true,
} satisfies ReplyKeyboard

export const TECLADO_CONFIRMAR_FIN = {
  keyboard: [[{ text: '✅ Sí, terminar' }, { text: '❌ Cancelar' }]],
  resize_keyboard: true,
  one_time_keyboard: true,
} satisfies ReplyKeyboard

export const QUITAR_TECLADO: RemoveKeyboard = { remove_keyboard: true }

export async function sendTelegramPhoto(chatId: string, photoUrl: string, caption?: string): Promise<void> {
  const res = await fetch(`${TELEGRAM_API}/sendPhoto`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, photo: photoUrl, caption }),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Telegram sendPhoto error: ${err}`)
  }
}

export async function getTelegramFileUrl(fileId: string): Promise<string> {
  const res = await fetch(`${TELEGRAM_API}/getFile?file_id=${fileId}`)
  if (!res.ok) throw new Error('Telegram getFile error')
  const data = await res.json() as { ok: boolean; result: { file_path: string } }
  const token = process.env.TELEGRAM_BOT_TOKEN!
  return `https://api.telegram.org/file/bot${token}/${data.result.file_path}`
}

export function validateTelegramWebhook(secretHeader: string | null): boolean {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET
  if (!secret) return false
  return secretHeader === secret
}

export async function registerWebhook(webhookUrl: string): Promise<void> {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET!
  const res = await fetch(`${TELEGRAM_API}/setWebhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      url: webhookUrl,
      secret_token: secret,
      allowed_updates: ['message'],
    }),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Telegram setWebhook error: ${err}`)
  }
}
