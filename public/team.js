'use strict';
fetch('/api/version').then(async response => {
  if (!response.ok) throw Error('请重新打开首页登录');
  const version = await response.json();
  const element = document.getElementById('version');
  if (/^[a-f0-9]{7,40}$/.test(version.commit || '')) {
    const link = document.createElement('a');
    link.href = 'https://github.com/Sym233-sketch/agent/commit/' + version.commit;
    link.textContent = version.commit.slice(0,7); element.replaceChildren(link);
  } else element.textContent = '本地开发版本';
  document.getElementById('branch').textContent = '分支：' + (version.branch || '本地') + ' · ' + (version.cloud ? '线上共创模式' : '本地模式');
}).catch(error => {document.getElementById('version').textContent = error.message});
