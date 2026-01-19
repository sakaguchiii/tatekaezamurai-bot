# たてかえ侍 Raspberry Pi デプロイ手順

## 前提条件

- Raspberry Pi (3以降推奨)
- Raspberry Pi OS (Bullseye以降)
- インターネット接続
- SSH接続可能な環境

---

## 1. Raspberry Piの準備

### 1.1 Node.jsのインストール

```bash
# Node.jsをインストール (v18以上推奨)
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# バージョン確認
node --version
npm --version
```

### 1.2 必要なパッケージのインストール

```bash
sudo apt-get update
sudo apt-get install -y git build-essential
```

---

## 2. プロジェクトのデプロイ

### 2.1 プロジェクトのコピー

**方法A: Gitを使用**
```bash
# GitHubリポジトリからクローン(リポジトリ作成後)
cd ~
git clone https://github.com/YOUR_USERNAME/tatekaezamurai-bot.git
cd tatekaezamurai-bot/server
```

**方法B: SCPで直接転送**
```bash
# ローカルマシンから実行
scp -r /Users/sakaguchitsubasa/claude-code-test/260117_play/terminal1/tatekaezamurai-bot/server pi@YOUR_PI_IP:~/tatekaezamurai-server
```

### 2.2 依存パッケージのインストール

```bash
cd ~/tatekaezamurai-server
npm install
```

### 2.3 環境変数の設定

```bash
# .envファイルを編集
nano .env
```

以下の内容を記入:
```
LINE_CHANNEL_SECRET=17e7ea5c15a53966b862345bd6bcbae1
LINE_CHANNEL_ACCESS_TOKEN=B2GAH0rjnM1LE59bnp+VKYDxk/rx3n7MkA2OIN3lspTeowCvKGDuiUckoqDCL0jpGVVRVS6y1ueao0h98qHRNy14eRIIy9D+/3MF183qKhjlFfXBqQJ0Wiq+c6OABwnh3om+PAx3dw0oNWSAferC7wdB04t89/1O/w1cDnyilFU=
PORT=3000
```

### 2.4 ビルド

```bash
npm run build
```

---

## 3. 外部からのアクセス設定

### 3.1 ngrokのインストール (開発・テスト用)

```bash
# ngrokをインストール
wget https://bin.equinox.io/c/bNyj1mQVY4c/ngrok-v3-stable-linux-arm.tgz
sudo tar xvzf ngrok-v3-stable-linux-arm.tgz -C /usr/local/bin

# ngrokアカウント作成
# https://dashboard.ngrok.com/signup

# 認証トークン設定
ngrok config add-authtoken YOUR_NGROK_AUTHTOKEN
```

### 3.2 ルーター設定 (本番環境用)

**ポートフォワーディング設定:**
1. ルーターの管理画面にアクセス
2. ポートフォワーディング設定
   - 外部ポート: 3000
   - 内部IP: Raspberry PiのローカルIP
   - 内部ポート: 3000

**固定IPまたはDDNS設定:**
- No-IP (https://www.noip.com/) などのDDNSサービスを使用
- または固定IPアドレス契約

---

## 4. サーバー起動

### 4.1 手動起動(テスト用)

```bash
# 開発モード
npm run dev

# 本番モード
npm start
```

### 4.2 PM2で自動起動(推奨)

```bash
# PM2のインストール
sudo npm install -g pm2

# アプリケーション起動
pm2 start dist/index.js --name tatekaezamurai

# 自動起動設定
pm2 startup
pm2 save

# ログ確認
pm2 logs tatekaezamurai

# ステータス確認
pm2 status

# 再起動
pm2 restart tatekaezamurai

# 停止
pm2 stop tatekaezamurai
```

---

## 5. LINE Webhook設定

### 5.1 ngrok使用時

```bash
# 別のターミナルでngrok起動
ngrok http 3000
```

表示されたForwarding URLをコピー:
```
Forwarding  https://xxxx-xx-xx-xx-xx.ngrok-free.app -> http://localhost:3000
```

### 5.2 LINE Developers Consoleで設定

1. https://developers.line.biz/console/ にアクセス
2. チャネルID: 2008912313 を選択
3. Messaging API > Webhook URL に以下を設定:

**ngrok使用時:**
```
https://xxxx-xx-xx-xx-xx.ngrok-free.app/webhook
```

**本番環境(固定IP/DDNS):**
```
http://YOUR_DOMAIN_OR_IP:3000/webhook
```

4. **Verify**ボタンで疎通確認
5. **Use webhook**を有効化

---

## 6. 動作確認

### 6.1 ヘルスチェック

```bash
curl http://localhost:3000/health
```

### 6.2 LINEグループでテスト

1. LINEグループを作成
2. たてかえ侍を友だち追加
3. グループに招待
4. 「開始」と送信
5. 「一軒目 14000円」と送信
6. 「清算」と送信

---

## 7. トラブルシューティング

### ポート3000が使用中

```bash
# ポート使用中のプロセス確認
sudo lsof -i :3000

# プロセスを終了
sudo kill -9 PID
```

### サーバーが起動しない

```bash
# ログ確認
pm2 logs tatekaezamurai

# 環境変数確認
cat .env

# ビルド再実行
npm run build
npm start
```

### Webhook接続エラー

```bash
# ngrokが起動しているか確認
curl http://localhost:4040/api/tunnels

# サーバーが起動しているか確認
curl http://localhost:3000/health

# ファイアウォール確認
sudo ufw status
```

---

## 8. セキュリティ設定

### 8.1 ファイアウォール設定

```bash
# ufwインストール
sudo apt-get install ufw

# SSH許可
sudo ufw allow 22

# HTTP/HTTPS許可
sudo ufw allow 80
sudo ufw allow 443

# カスタムポート許可(必要な場合)
sudo ufw allow 3000

# 有効化
sudo ufw enable
```

### 8.2 Let's Encrypt SSL証明書(本番環境推奨)

```bash
# Nginxインストール
sudo apt-get install nginx

# Certbotインストール
sudo apt-get install certbot python3-certbot-nginx

# SSL証明書取得
sudo certbot --nginx -d your-domain.com

# Nginx設定
sudo nano /etc/nginx/sites-available/default
```

Nginx設定例:
```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

---

## 9. バックアップ

### データバックアップ

```bash
# sessions.jsonのバックアップ
cp ~/tatekaezamurai-server/src/data/sessions.json ~/backups/sessions_$(date +%Y%m%d).json

# 定期バックアップ(cron)
crontab -e

# 毎日午前3時にバックアップ
0 3 * * * cp ~/tatekaezamurai-server/src/data/sessions.json ~/backups/sessions_$(date +\%Y\%m\%d).json
```

---

## 10. 更新手順

```bash
# サーバー停止
pm2 stop tatekaezamurai

# 最新コードを取得(Git使用時)
git pull origin main

# または SCPで再転送
# scp -r ...

# 依存パッケージ更新
npm install

# ビルド
npm run build

# サーバー再起動
pm2 restart tatekaezamurai
```

---

## まとめ

✅ Raspberry Piで完全無料運用可能
✅ PM2で24時間稼働
✅ JSONファイルでデータ保存
✅ ngrokで簡単に外部公開
✅ 本番環境では固定IP/DDNSとSSL推奨

**費用:** ¥0 (電気代のみ、月100円程度)

お疲れ様でした！🎉
