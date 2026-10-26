# Cập nhật emoji ảnh – Gia đình Cầu Vồng

## Cách chính (tự động, 1 thao tác)
1. Kéo thả ảnh (hoặc cả thư mục ảnh) vào thư mục `Emoji/` trên GitHub → Commit.
2. Chờ ~1 phút: GitHub Actions "Đồng bộ emoji" tự cập nhật `emoji-manifest.json`. Website đọc manifest từ GitHub nên emoji mới xuất hiện sau vài phút.
3. (Tùy chọn) Mở `emoji-admin.html` trên website để sửa tên/từ khóa cho ảnh có tên khó hiểu → Tải file → đưa lên GitHub thay file cũ.

## Chạy tay trên máy (khi đã clone repo)
- Windows: bấm đúp `cap-nhat-emoji.bat`, hoặc `node scripts/emoji-sync.mjs`
- Xem trước không ghi: `node scripts/emoji-sync.mjs --dry-run`
- Xóa khỏi manifest các emoji đã mất ảnh: `node scripts/emoji-sync.mjs --prune`
