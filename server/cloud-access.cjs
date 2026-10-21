'use strict';
const crypto = require('node:crypto');
const cookieName = '__Host-mincetong';
const lifetime = 12 * 60 * 60;
const digest = value => crypto.createHash('sha256').update(value).digest();
const equal = (a, b) => crypto.timingSafeEqual(digest(a), digest(b));

module.exports = function cloudAccess(env = process.env) {
  const cloud = env.MINCETONG_CLOUD === 'true' || env.RENDER === 'true';
  const requirePassword = env.MINCETONG_TEAM_AUTH === 'true';
  const password = env.MINCETONG_TEAM_PASSWORD || '';
  let origin;
  if (cloud) {
    if (requirePassword && password.length < 16) throw Error('Cloud mode requires MINCETONG_TEAM_PASSWORD with at least 16 characters');
    const url = new URL(env.MINCETONG_PUBLIC_ORIGIN || env.RENDER_EXTERNAL_URL || '');
    if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
      throw Error('Cloud mode requires an HTTPS public origin without a path');
    }
    origin = url.origin;
  }
  const signature = expires => crypto.createHmac('sha256', password).update('mincetong-team:' + expires).digest('base64url');
  function authenticated(req) {
    const value = (req.headers.cookie || '').split(';').map(x => x.trim()).find(x => x.startsWith(cookieName + '='))?.slice(cookieName.length + 1) || '';
    const [expires, mac, extra] = value.split('.');
    const seconds = Number(expires), now = Math.floor(Date.now() / 1000);
    return !extra && /^\d+$/.test(expires || '') && seconds > now && seconds <= now + lifetime && equal(mac || '', signature(expires));
  }
  const page = message => `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>民策通 · 共创入口</title><style>body{font:18px/1.7 system-ui,sans-serif;background:#eef5fb;color:#17344b;margin:0;padding:8vh 24px}main{max-width:480px;margin:auto;padding:32px;background:white;border-radius:24px}input,button{box-sizing:border-box;width:100%;padding:14px;font:inherit;margin:12px 0;border-radius:12px;border:1px solid #93b7c9}button{background:#145b85;color:white}small{color:#536b7b}</style><main><h1>民策通 · 线上共创</h1><p>使用团队口令进入政府端、居民端与模型配置。</p>${message ? '<p role="alert">' + message + '</p>' : ''}<form method="post" action="/team-login"><label for="password">共创口令</label><input id="password" name="password" type="password" autocomplete="current-password" required maxlength="1024"><button>进入共创站</button></form><small>仅供受邀团队使用虚构数据共创演示。团队成员共享管理权限；请勿填写真实居民敏感资料。</small></main></html>`;
  function html(res, status, content) {
    res.writeHead(status, {'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'"});
    res.end(content);
  }
  function reject(res, status, message) {
    res.writeHead(status, {'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});
    res.end(JSON.stringify({error:message}));
  }
  let attempts = 0, windowEnd = 0;
  async function handle(req, res, url) {
    if (!cloud) return false;
    if (url.pathname === '/healthz' && ['GET','HEAD'].includes(req.method)) {
      res.writeHead(200, {'Content-Type':'application/json','Cache-Control':'no-store'});
      res.end(req.method === 'HEAD' ? undefined : '{"ok":true}');
      return true;
    }
    // Ignore proxy-supplied host/origin hints: only the configured HTTPS origin is trusted.
    if (req.headers.host !== new URL(origin).host || (req.headers.origin && req.headers.origin !== origin) || (req.headers['sec-fetch-site'] === 'cross-site' && (url.pathname.startsWith('/api/') || !['GET','HEAD'].includes(req.method)))) {
      reject(res, 403, '来源不受信任'); return true;
    }
    if (!requirePassword) return false;
    if (url.pathname === '/team-login' && req.method === 'POST') {
      if (Date.now() > windowEnd) { attempts = 0; windowEnd = Date.now() + 60000; }
      if (++attempts > 30) { res.setHeader('Retry-After','60'); reject(res,429,'尝试次数过多，请稍后再试'); return true; }
      if (!(req.headers['content-type'] || '').startsWith('application/x-www-form-urlencoded')) { reject(res,415,'请使用登录表单'); return true; }
      let input = '';
      for await (const chunk of req) {
        input += chunk;
        if (Buffer.byteLength(input) > 4096) { reject(res,413,'登录内容过大'); return true; }
      }
      if (!equal(new URLSearchParams(input).get('password') || '', password)) { html(res,401,page('口令不正确，请重试。')); return true; }
      const expires = String(Math.floor(Date.now() / 1000) + lifetime);
      res.writeHead(303, {'Location':'/','Cache-Control':'no-store','Set-Cookie':`${cookieName}=${expires}.${signature(expires)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${lifetime}`});
      res.end(); return true;
    }
    if (!authenticated(req)) {
      if (url.pathname.startsWith('/api/')) reject(res,401,'请先打开首页并输入团队共创口令');
      else html(res,200,page(''));
      return true;
    }
    if (url.pathname === '/team-logout' && req.method === 'POST') {
      res.writeHead(303, {'Location':'/','Cache-Control':'no-store','Set-Cookie':`${cookieName}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`});
      res.end(); return true;
    }
    return false;
  }
  return {cloud, origin, handle};
};
