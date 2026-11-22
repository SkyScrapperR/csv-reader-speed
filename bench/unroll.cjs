// Writes variants of fast.cjs with the plain-byte fast checks unrolled n bytes deep (an experiment tool).
// usage: node bench/unroll.cjs <fast.cjs> <out.cjs> <unquoted n> <quoted n>
const fs = require('fs');
const [src, dst, nu, nq] = process.argv.slice(2);
let s = fs.readFileSync(src, 'utf8');

// The plain-byte check of each loop as fast.cjs writes it (with a class table).
const U = /( *)const c = b\[i\];\n *if \(PLAIN\[c\] === 1\) \{\n[^}]*?\}\n/;
const Q = /( *)const c = b\[j\];\n *if \(QPLAIN\[c\] === 1\) \{\n[^}]*?\}\n/;

function unrolled(v, table, ind, n) {
  let r = `${ind}const c = b[${v}];\n${ind}if (${table}[c] === 1) {\n${ind}  out[o++] = c;\n`;
  for (let k = 1; k < n; k++) {
    r += `${ind}  const c${k} = b[${v} + ${k}];\n`;
    r += `${ind}  if (${table}[c${k}] !== 1) {\n${ind}    ${v} += ${k};\n${ind}    continue;\n${ind}  }\n`;
    r += `${ind}  out[o++] = c${k};\n`;
  }
  return r + `${ind}  ${v} += ${n};\n${ind}  continue;\n${ind}}\n`;
}

if (!U.test(s) || !Q.test(s)) throw new Error('pattern not found');
s = s.replace(U, (m, ind) => unrolled('i', 'PLAIN', ind, Number(nu)));
s = s.replace(Q, (m, ind) => unrolled('j', 'QPLAIN', ind, Number(nq)));
fs.writeFileSync(dst, s);
