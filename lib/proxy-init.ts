/**
 * 代理初始化——纯 side-effect 模块。
 * 任何需要让服务器 fetch() 走 HTTPS_PROXY 的文件都应该在最顶部 import 这个，
 * 否则 Node 的 undici 默认直连（国内环境会超时）。
 *
 * Vercel 等海外服务器：不设这些环境变量就什么都不会发生，安全。
 */
import { setGlobalDispatcher, ProxyAgent } from 'undici';

const PROXY_URL =
  process.env.HTTPS_PROXY ||
  process.env.HTTP_PROXY ||
  process.env.ALL_PROXY ||
  process.env.https_proxy ||
  process.env.http_proxy ||
  process.env.all_proxy;

if (PROXY_URL && !(globalThis as any).__proxyInstalled) {
  try {
    setGlobalDispatcher(new ProxyAgent(PROXY_URL));
    (globalThis as any).__proxyInstalled = true;
    console.log(`[proxy] Using ${PROXY_URL}`);
  } catch (e) {
    console.warn('[proxy] Failed to install:', e);
  }
}

export {};
