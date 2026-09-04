# Chạy bridge Zalo trên VPS (FR-152 e — 04/09/2026)

Bridge là mắt xích duy nhất của cả hệ thống **không** chạy trên Supabase/Vercel:
nó phải sống trên một máy có Node, giữ session Zalo của acc clone. Chạy trên
máy local là chết theo máy local (sự cố 27/08 → 04/09/2026: bridge im 8 ngày,
kênh Zalo bằng 0, 117 lời cảnh báo không gửi được vì chính chúng đi qua bridge).
VPS nhỏ nhất là đủ (1 vCPU, 1 GB, Ubuntu 22.04/24.04).

## 1. Chuẩn bị máy (một lần)

```bash
# Node 20+ (zca-js cần ESM + fetch)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - && sudo apt-get install -y nodejs git tmux
sudo useradd -m -s /bin/bash nhadat
sudo mkdir -p /opt/nhadat && sudo chown nhadat:nhadat /opt/nhadat
sudo -iu nhadat
git clone https://github.com/quang507/Nhadat.cc.git /opt/nhadat   # repo public
cd /opt/nhadat/bot/bridge-zca && npm init -y >/dev/null && npm i zca-js
```

## 2. Bí mật

`bot/bridge-zca/.env` (đã trong `.gitignore`), đúng một dòng:

```
BRIDGE_SECRET=<giá trị trong Supabase → Project Settings → Vault → BRIDGE_SECRET>
```

Dán trần, không nháy, không ngoặc nhọn. Sai một ký tự là mọi lượt gọi 401/403
và sổ lỗi ghi "bridge secret sai".

## 3. Quét QR lần đầu (bắt buộc chạy tay)

```bash
tmux new -s bridge
cd /opt/nhadat/bot/bridge-zca && node index.mjs
```

Mở Zalo trên điện thoại **bằng acc clone** (không dùng acc chính — zca-js là API
không chính thức, Zalo có thể khoá), quét QR trong terminal. Thấy "Bridge sẵn
sàng" là session đã lưu vào `zalo-session.json`. `Ctrl-C` rồi thoát tmux.

## 4. Bật thành service

```bash
sudo cp /opt/nhadat/bot/bridge-zca/nhadat-bridge.service /etc/systemd/system/
sudo systemctl daemon-reload && sudo systemctl enable --now nhadat-bridge
journalctl -u nhadat-bridge -f       # phải thấy nhịp kéo escalation-feed mỗi 60 s–5 phút
```

Kiểm từ phía DB (Supabase SQL editor): `select * from bot_health where who = 'bridge-zca'`
— cột `at` phải nhích trong 15 phút. Trang `/admin` không còn dòng "bridge-zca im".

## 5. Khi session Zalo hết hạn

Log hiện "Session cũ hết hạn — quét QR lại" và service khởi động lại liên tục.
Làm lại mục 3 (dừng service trước: `sudo systemctl stop nhadat-bridge`), rồi
`sudo systemctl start nhadat-bridge`. Cảnh báo "bridge-zca đang im" sẽ tới
điện thoại qua ntfy (mục 6) sau 15 phút.

## 6. Cảnh báo tới điện thoại không qua bridge

Migration `20260904a` dựng kênh **ntfy.sh**: nhịp kiểm 15 phút của DB gọi thẳng
`https://ntfy.sh/<topic>` khi có lỗi mới hoặc bridge im — không đi qua bridge,
không cần token. Cài app ntfy (Android/iOS) hoặc mở `https://ntfy.sh/<topic>`
trên trình duyệt, đăng ký đúng tên topic trong `app_config` khoá `ntfy_topic`
(đọc bằng SQL editor). Tên topic ngẫu nhiên 24 ký tự — ai biết tên là đọc được,
nên đừng dán nó vào chỗ công khai.

## 7. Cập nhật code bridge

```bash
sudo -iu nhadat bash -c 'cd /opt/nhadat && git pull' && sudo systemctl restart nhadat-bridge
```

## 8. Sao lưu (OPEN-25) — cùng VPS

Supabase Free không có backup. Đặt cron chạy `scripts/sao-luu.mjs` mỗi đêm,
khoá `SUPABASE_SERVICE_ROLE_KEY` để trong `/home/nhadat/.nhadat-backup.env`
(chmod 600), thư mục đích ngoài repo:

```
0 20 * * * . /home/nhadat/.nhadat-backup.env && cd /opt/nhadat && node scripts/sao-luu.mjs /home/nhadat/backup >> /home/nhadat/backup.log 2>&1
```

(20:00 UTC = 03:00 VN.)
