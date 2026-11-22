// Writes a variant of fast.cjs with its plain-byte fast checks unrolled n bytes deep (an experiment tool). It reads
// fast.cjs as it stands, unrolled or not, and rewrites each loop's check block.
// usage: node bench/unroll.cjs <fast.cjs> <out.cjs> <unquoted n> <quoted n>
const fs = require('fs');
const [src, dst, nu, nq] = process.argv.slice(2);
let s = fs.readFileSync(src, 'utf8');

// A loop's check block: from `const c = b[i];` and its table test to the block's own closing `continue; }`, at the
// block's indentation (\1): inner exits sit deeper, so they never end the match.
const block = (v, table) =>
  new RegExp(`( *)const c = b\\[${v}\\];\\n *if \\(${table}\\[c\\] === 1\\) \\{\\n[\\s\\S]*?\\n\\1  (?:${v}\\+\\+|${v} \\+= \\d+);\\n\\1  continue;\\n\\1\\}\\n`);

function unrolled(v, table, ind, n) {
  let r = `${ind}const c = b[${v}];\n${ind}if (${table}[c] === 1) {\n${ind}  out[o++] = c;\n`;
  for (let k = 1; k < n; k++) {
    r += `${ind}  const c${k} = b[${v} + ${k}];\n`;
    r += `${ind}  if (${table}[c${k}] !== 1) {\n${ind}    ${v} += ${k};\n${ind}    continue;\n${ind}  }\n`;
    r += `${ind}  out[o++] = c${k};\n`;
  }
  return r + `${ind}  ${v} += ${n};\n${ind}  continue;\n${ind}}\n`;
}

const U = block('i', 'PLAIN');
const Q = block('j', 'QPLAIN');
if (!U.test(s) || !Q.test(s)) throw new Error('pattern not found');
s = s.replace(U, (m, ind) => unrolled('i', 'PLAIN', ind, Number(nu)));
s = s.replace(Q, (m, ind) => unrolled('j', 'QPLAIN', ind, Number(nq)));
fs.writeFileSync(dst, s);
