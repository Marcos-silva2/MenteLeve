/* ============================================================
   push.js — Notificações push (lembrete de tarefa)
   Degrada em silêncio quando o navegador não suporta (iOS Safari fora da
   Tela de Início, navegadores antigos) ou quando o servidor não tem VAPID
   configurada — nunca lança erro visível, só devolve false/null.
   ============================================================ */

import { apiPushPublicKey, apiPushSubscribe, apiPushUnsubscribe } from './api.js';

export function isPushSupported() {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

/** 'default' | 'granted' | 'denied' — sem suporte, trata como 'denied'. */
export function permissionState() {
  return isPushSupported() ? Notification.permission : 'denied';
}

/** Assinatura ativa neste aparelho, ou null (sem suporte, sem SW pronto, ou nunca assinou). */
export async function currentSubscription() {
  if (!isPushSupported()) return null;
  try {
    const reg = await navigator.serviceWorker.ready;
    return await reg.pushManager.getSubscription();
  } catch (_) {
    return null;
  }
}

export async function isEnabled() {
  return !!(await currentSubscription());
}

function urlBase64ToUint8Array(base64) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const base64safe = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64safe);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

/**
 * Ativa o lembrete: pede permissão, assina o push no navegador e registra a
 * assinatura no backend.
 *
 * @returns {Promise<'enabled'|'denied'|'unsupported'|'unavailable'|'error'>}
 *   'unavailable' = servidor sem VAPID configurada (recurso desligado, não é
 *   uma falha do aparelho da usuária).
 */
export async function enable() {
  if (!isPushSupported()) return 'unsupported';

  const key = await apiPushPublicKey();
  if (!key || !key.enabled || !key.public_key) return 'unavailable';

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return 'denied';

  try {
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(key.public_key),
      });
    }
    const ok = await apiPushSubscribe(sub.toJSON());
    return ok ? 'enabled' : 'error';
  } catch (_) {
    return 'error';
  }
}

/** Desativa: cancela a assinatura no navegador e avisa o backend. */
export async function disable() {
  const sub = await currentSubscription();
  if (!sub) return true;
  const endpoint = sub.endpoint;
  try {
    await sub.unsubscribe();
  } catch (_) { /* segue mesmo assim — o backend limpa o resto */ }
  await apiPushUnsubscribe(endpoint);
  return true;
}
