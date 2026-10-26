#!/usr/bin/env node
/**
 * Đồng bộ thư mục Emoji/ với emoji-manifest.json (không cần cài thêm gói nào, cần Node 18+).
 *
 *   node scripts/emoji-sync.mjs             cập nhật manifest
 *   node scripts/emoji-sync.mjs --dry-run   chỉ xem sẽ thay đổi gì, không ghi file
 *   node scripts/emoji-sync.mjs --prune     xóa khỏi manifest các mục mà ảnh không còn tồn tại
 *
 * Quy tắc:
 *  - Quét đệ quy Emoji/ (kể cả thư mục con), nhận .png .jpg .jpeg .webp .gif (và .apng .avif).
 *  - Ảnh mới -> thêm vào CUỐI danh sách. Ảnh cũ -> giữ nguyên id, tên, từ khóa, vị trí.
 *  - Ảnh bị thay nội dung (cùng tên file) -> chỉ cập nhật "hash".
 *  - Ảnh bị đổi tên/di chuyển (nội dung y hệt) -> giữ id/tên/từ khóa, chỉ sửa "file".
 *  - Mục có ảnh đã mất -> GIỮ LẠI và cảnh báo (chỉ xóa khi dùng --prune), vì bình luận cũ lưu :id:.
 *  - Chạy lại nhiều lần không tạo trùng; nếu không có gì đổi thì không ghi file.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
const opt = (name, def) => { const a = args.find(x => x.startsWith('--' + name + '=')); return a ? a.slice(name.length + 3) : def; };
const DRY = args.includes('--dry-run');
const PRUNE = args.includes('--prune');
const ROOT = path.resolve(opt('root', path.join(path.dirname(fileURLToPath(import.meta.url)), '..')));
const DIR = path.join(ROOT, opt('dir', 'Emoji'));
const MANIFEST = path.join(ROOT, opt('manifest', 'emoji-manifest.json'));
const EXT = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.apng', '.avif']);
const BIG = 2 * 1024 * 1024;

// ---------- Gợi ý từ khóa tiếng Việt từ tên file ----------
const TU_DIEN = {
  cat: 'mèo', kitty: 'mèo', kitten: 'mèo con', dog: 'chó', puppy: 'chó con', heart: 'tim trái tim', love: 'yêu thương tình yêu',
  smile: 'cười', smiley: 'cười', grin: 'cười toe', laugh: 'cười lớn', lol: 'cười lớn', haha: 'cười lớn', lmao: 'cười lớn',
  happy: 'vui hạnh phúc', joy: 'vui vẻ', sad: 'buồn', cry: 'khóc', crying: 'khóc', tear: 'nước mắt', sob: 'khóc',
  angry: 'giận tức giận', mad: 'giận', rage: 'nổi giận', wow: 'ngạc nhiên', surprised: 'ngạc nhiên', shock: 'sốc ngạc nhiên',
  sleep: 'ngủ', sleepy: 'buồn ngủ', zzz: 'ngủ', tired: 'mệt', kiss: 'hôn', hug: 'ôm', ok: 'ổn đồng ý', okay: 'ổn đồng ý',
  yes: 'có đồng ý', no: 'không từ chối', like: 'thích', thumbsup: 'thích tuyệt', thumb: 'ngón tay cái', thanks: 'cảm ơn', thank: 'cảm ơn',
  thx: 'cảm ơn', hello: 'chào xin chào', hi: 'chào', wave: 'vẫy tay chào', bye: 'tạm biệt', please: 'làm ơn xin', sorry: 'xin lỗi',
  cool: 'ngầu', cute: 'dễ thương', shy: 'ngại ngùng', blush: 'đỏ mặt ngại', think: 'suy nghĩ', thinking: 'suy nghĩ',
  confused: 'bối rối khó hiểu', scared: 'sợ hãi', fear: 'sợ', sick: 'ốm bệnh', eat: 'ăn', eating: 'ăn', food: 'đồ ăn',
  drink: 'uống', coffee: 'cà phê', tea: 'trà', cake: 'bánh', star: 'sao ngôi sao', flower: 'hoa', sun: 'mặt trời', moon: 'trăng',
  rain: 'mưa', rainbow: 'cầu vồng', fire: 'lửa', party: 'tiệc ăn mừng', dance: 'nhảy múa', dancing: 'nhảy múa', run: 'chạy',
  fight: 'đánh nhau', clap: 'vỗ tay', pray: 'cầu nguyện', wink: 'nháy mắt', lick: 'liếm', pat: 'xoa đầu', poke: 'chọc',
  bonk: 'đánh', sip: 'nhấp', pepe: 'ếch', frog: 'ếch', rabbit: 'thỏ', bunny: 'thỏ', bear: 'gấu', panda: 'gấu trúc',
  duck: 'vịt', chicken: 'gà', pig: 'heo', fox: 'cáo', mouse: 'chuột', bird: 'chim', fish: 'cá', boy: 'bé trai', girl: 'bé gái',
  baby: 'em bé', king: 'vua', queen: 'nữ hoàng', money: 'tiền', gift: 'quà', book: 'sách', music: 'nhạc', game: 'trò chơi',
  sparkle: 'lấp lánh', gm: 'chào buổi sáng', gn: 'chúc ngủ ngon', morning: 'buổi sáng', night: 'đêm ngủ ngon', good: 'tốt',
  bad: 'xấu tệ', hot: 'nóng', cold: 'lạnh', evil: 'ác quỷ', devil: 'quỷ', angel: 'thiên thần', ghost: 'ma', skull: 'đầu lâu',
  nom: 'ăn ngon', yum: 'ngon', hungry: 'đói', bored: 'chán', lazy: 'lười', hide: 'trốn', peek: 'nhìn lén', stare: 'nhìn chằm chằm',
  facepalm: 'bó tay', shrug: 'nhún vai', salute: 'chào kính', flex: 'khoe cơ bắp', dead: 'chết ngất', cringe: 'ghê',
};
const bo = s => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D');
function goiYTuKhoa(stem, thuMuc) {
  const raw = stem.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/([A-Za-z])(\d)/g, '$1 $2').replace(/(\d)([A-Za-z])/g, '$1 $2');
  const toks = raw.split(/[^\p{L}\p{N}]+/u).filter(Boolean).map(t => t.toLowerCase());
  const out = new Set();
  const them = s => String(s).split(/\s+/).filter(Boolean).forEach(w => out.add(w));
  const tra = t => { const k = bo(t); return TU_DIEN[k] || (k.endsWith('s') ? TU_DIEN[k.slice(0, -1)] : '') || ''; };
  toks.forEach((t, i) => {
    if (/^\d+$/.test(t)) return;
    them(t); them(bo(t));
    const ghep = i + 1 < toks.length ? tra(t + toks[i + 1]) : '';   // "thumbs up" -> thumbsup
    them(ghep || tra(t));
  });
  (thuMuc || []).forEach(f => { const w = f.toLowerCase(); them(w); them(bo(w)); });
  return [...out].join(' ');
}

// ---------- Tiện ích ----------
const hashFile = p => crypto.createHash('sha1').update(fs.readFileSync(p)).digest('hex').slice(0, 12);
function taoId(stem, daDung) {
  let base = bo(stem).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'emoji';
  base = base.slice(0, 32).replace(/_+$/, '') || 'emoji';
  let id = base, n = 2;
  while (daDung.has(id)) { const hau = '_' + n++; id = base.slice(0, 32 - hau.length) + hau; }
  daDung.add(id);
  return id;
}
function quet(dir) {
  const ds = [];
  (function di(d, rel) {
    if (!fs.existsSync(d)) return;
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      if (e.name.startsWith('.')) continue;
      const p = path.join(d, e.name), r = rel ? rel + '/' + e.name : e.name;
      if (e.isDirectory()) di(p, r);
      else if (e.isFile() && EXT.has(path.extname(e.name).toLowerCase())) ds.push({ file: r, abs: p, size: fs.statSync(p).size });
    }
  })(dir, '');
  return ds.sort((a, b) => a.file.localeCompare(b.file, 'vi', { numeric: true, sensitivity: 'base' }));
}

// ---------- Đọc manifest hiện có (lỗi cú pháp -> dừng, không ghi đè) ----------
let goc = '', data = { emoji: [] };
if (fs.existsSync(MANIFEST)) {
  goc = fs.readFileSync(MANIFEST, 'utf8');
  try {
    const d = JSON.parse(goc.replace(/^\uFEFF/, ''));
    data = Array.isArray(d) ? { emoji: d } : d;
    if (!Array.isArray(data.emoji)) throw new Error('thiếu mảng "emoji"');
  } catch (e) { console.error('✖ emoji-manifest.json đang bị lỗi (' + e.message + '). Dừng lại, không ghi đè. Hãy sửa file rồi chạy lại.'); process.exit(1); }
}
if (!fs.existsSync(DIR)) { console.error('✖ Không thấy thư mục ' + DIR); process.exit(1); }

const files = quet(DIR);
const byFile = new Map(files.map(f => [f.file, f]));
const byLower = new Map(files.map(f => [f.file.toLowerCase(), f]));
const daNhan = new Set();
const idDung = new Set(data.emoji.map(e => e && e.id).filter(Boolean));
const log = { them: [], capNhat: [], doiTen: [], suaHoa: [], mat: [], bo: [], canh: [] };
const list = data.emoji.filter(e => e && typeof e === 'object');
const giu = [];

// 1) Mục đã có, ảnh còn nguyên
for (const e of list) {
  if (typeof e.file !== 'string') { giu.push(e); continue; }          // mục dùng "src" ngoài: không đụng tới
  let f = byFile.get(e.file);
  if (!f) { const l = byLower.get(e.file.toLowerCase()); if (l && !daNhan.has(l.file)) { log.suaHoa.push(e.file + ' -> ' + l.file); e.file = l.file; f = l; } }
  if (f) {
    daNhan.add(f.file);
    const h = hashFile(f.abs);
    if (e.hash && e.hash !== h) log.capNhat.push(e.file);
    e.hash = h;
  }
  giu.push(e);
}
// 2) Mục mất ảnh: thử nhận diện đổi tên theo nội dung
const moi = files.filter(f => !daNhan.has(f.file)).map(f => ({ ...f, hash: hashFile(f.abs) }));
const ketQua = [];
for (const e of giu) {
  if (typeof e.file !== 'string' || byFile.has(e.file) && daNhan.has(e.file)) { ketQua.push(e); continue; }
  const k = e.hash ? moi.findIndex(m => m.hash === e.hash && !daNhan.has(m.file)) : -1;
  if (k >= 0) { log.doiTen.push(e.file + ' -> ' + moi[k].file); e.file = moi[k].file; daNhan.add(moi[k].file); moi.splice(k, 1); ketQua.push(e); }
  else if (PRUNE) log.bo.push(e.file);
  else { log.mat.push(e.file + '  (id :' + e.id + ':)'); ketQua.push(e); }
}
// 3) Ảnh mới -> thêm cuối danh sách
for (const m of moi) {
  if (daNhan.has(m.file)) continue;
  const stem = path.basename(m.file, path.extname(m.file));
  const thuMuc = m.file.split('/').slice(0, -1);
  ketQua.push({ id: taoId(stem, idDung), file: m.file, name: stem, keywords: goiYTuKhoa(stem, thuMuc), hash: m.hash });
  log.them.push(m.file);
}
files.filter(f => f.size > BIG).forEach(f => log.canh.push(f.file + ' nặng ' + (f.size / 1048576).toFixed(1) + ' MB (nên < 2 MB để tải nhanh)'));
data.emoji = ketQua;

const moiText = JSON.stringify(data, null, 2) + '\n';
const doi = moiText !== goc.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');
const dong = (t, a) => a.length && console.log(t + ' (' + a.length + '):\n' + a.map(x => '   - ' + x).join('\n'));
console.log('Ảnh trong ' + path.basename(DIR) + '/: ' + files.length + ' | Emoji trong manifest: ' + ketQua.length);
dong('＋ Thêm mới', log.them); dong('↻ Ảnh đã thay đổi nội dung', log.capNhat); dong('⇄ Đổi tên/di chuyển (giữ nguyên id)', log.doiTen);
dong('Aa Sửa hoa/thường cho khớp GitHub', log.suaHoa); dong('✂ Đã bỏ khỏi manifest (--prune)', log.bo);
dong('⚠ Mục còn trong manifest nhưng KHÔNG thấy ảnh (giữ lại; dùng --prune để xóa)', log.mat); dong('⚠ Lưu ý', log.canh);
if (!doi) console.log('✔ Không có gì thay đổi, manifest đã đúng.');
else if (DRY) console.log('… (--dry-run) chưa ghi file.');
else { const tmp = MANIFEST + '.tmp'; fs.writeFileSync(tmp, moiText); fs.renameSync(tmp, MANIFEST); console.log('✔ Đã cập nhật ' + path.basename(MANIFEST)); }
