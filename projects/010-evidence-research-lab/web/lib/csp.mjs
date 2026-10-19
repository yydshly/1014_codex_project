import {createHash} from 'node:crypto';

// HTML 在分词前将 CRLF 和单独 CR 转为 LF。CSP 必须校验解析后的文本。
export function inlineSourceHashes(html){
  const hashes={script:[],style:[]};
  for(const match of html.matchAll(/<(script|style)(?:\s[^>]*)?>([\s\S]*?)<\/\1>/g)){
    const source=match[2].replace(/\r\n?/g,'\n');
    hashes[match[1]].push(`'sha256-${createHash('sha256').update(source).digest('base64')}'`);
  }
  return hashes;
}
