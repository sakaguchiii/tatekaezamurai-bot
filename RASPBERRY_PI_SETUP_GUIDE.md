# たてかえ侍 完全セットアップガイド (Raspberry Pi版)

最終更新: 2026年1月17日

このガイドでは、Raspberry Piを使って**完全無料**でたてかえ侍 LINEボットを24時間稼働させる方法を説明します。

---

## 📋 目次

1. [必要なもの](#1-必要なもの)
2. [Raspberry Piの初期セットアップ](#2-raspberry-piの初期セットアップ)
3. [Node.js環境構築](#3-nodejs環境構築)
4. [プロジェクトのデプロイ](#4-プロジェクトのデプロイ)
5. [サーバー起動と動作確認](#5-サーバー起動と動作確認)
6. [外部公開設定](#6-外部公開設定)
7. [LINE Webhook設定](#7-line-webhook設定)
8. [PM2で自動起動設定](#8-pm2で自動起動設定)
9. [テストとトラブルシューティング](#9-テストとトラブルシューティング)
10. [運用・メンテナンス](#10-運用メンテナンス)

---

## 1. 必要なもの

### ハードウェア
- ✅ Raspberry Pi (3B以降推奨、Zero 2Wでも可)
- ✅ microSDカード (16GB以上推奨)
- ✅ 電源アダプター
- ✅ ネットワーク接続 (有線LANまたはWi-Fi)

### アカウント
- ✅ LINEアカウント
- ✅ LINE Developers アカウント
- ✅ GitHubアカウント (sakaguchiiii)
- ✅ ngrokアカウント (無料プラン)

### 情報
- ✅ LINE Channel ID: 2008912313
- ✅ LINE Channel Secret: (既に取得済み)
- ✅ LINE Channel Access Token: (既に取得済み)

---

## 2. Raspberry Piの初期セットアップ

### 2.1 Raspberry Pi OS インストール

**方法A: Raspberry Pi Imagerを使用 (推奨)**

1. Raspberry Pi Imagerをダウンロード
   - https://www.raspberrypi.com/software/

2. microSDカードをPCに挿入

3. Raspberry Pi Imagerを起動
   - OS: Raspberry Pi OS Lite (64-bit) 推奨
   - ストレージ: microSDカードを選択
   - 設定アイコン(⚙️)をクリック:
     - ✅ SSHを有効化
     - ✅ ユーザー名とパスワード設定
     - ✅ Wi-Fi設定 (必要な場合)
     - ✅ ロケール設定: Asia/Tokyo

4. 書き込み実行

### 2.2 Raspberry Pi起動とSSH接続

```bash
# ローカルネットワークでRaspberry Piを探す
ping raspberrypi.local

# SSH接続
ssh pi@raspberrypi.local
# または
ssh pi@[IPアドレス]

# 初回ログイン後、パスワード変更
passwd
```

### 2.3 システムアップデート

```bash
# パッケージリスト更新
sudo apt-get update

# システムアップグレード (5-10分程度)
sudo apt-get upgrade -y

# 必要なパッケージインストール
sudo apt-get install -y git curl build-essential
```

---

## 3. Node.js環境構築

### 3.1 Node.jsのインストール

```bash
# Node.js 18.x をインストール
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# バージョン確認
node --version   # v18.x.x 以上
npm --version    # 9.x.x 以上
```

### 3.2 Git設定

```bash
# Gitユーザー情報設定
git config --global user.name "sakaguchiiii"
git config --global user.email "your-email@example.com"

# 確認
git config --list
```

---

## 4. プロジェクトのデプロイ

### 4.1 GitHubからクローン

```bash
# ホームディレクトリに移動
cd ~

# リポジトリをクローン
git clone https://github.com/sakaguchiiii/tatekaezamurai-bot.git

# プロジェクトディレクトリに移動
cd tatekaezamurai-bot/server
```

### 4.2 依存パッケージのインストール

```bash
# npmパッケージインストール (2-5分程度)
npm install

# インストール確認
npm list --depth=0
```

### 4.3 環境変数設定

```bash
# .envファイルをコピー
cp .env.example .env

# .envファイルを編集
nano .env
```

以下の内容を入力:

```env
LINE_CHANNEL_SECRET=17e7ea5c15a53966b862345bd6bcbae1
LINE_CHANNEL_ACCESS_TOKEN=B2GAH0rjnM1LE59bnp+VKYDxk/rx3n7MkA2OIN3lspTeowCvKGDuiUckoqDCL0jpGVVRVS6y1ueao0h98qHRNy14eRIIy9D+/3MF183qKhjlFfXBqQJ0Wiq+c6OABwnh3om+PAx3dw0oNWSAferC7wdB04t89/1O/w1cDnyilFU=
PORT=3000
```

保存: `Ctrl + O` → Enter → `Ctrl + X`

### 4.4 ビルド

```bash
# TypeScriptをJavaScriptにコンパイル
npm run build

# ビルド成功確認
ls -la dist/
```

---

## 5. サーバー起動と動作確認

### 5.1 開発モードでテスト起動

```bash
# 開発モードで起動
npm run dev
```

以下のような出力が表示されれば成功:

```
✅ Environment variables validated
📁 Data directory created: /home/pi/tatekaezamurai-bot/server/dist/data
📄 Sessions file created: /home/pi/tatekaezamurai-bot/server/dist/data/sessions.json

========================================
🍻 たてかえ侍 LINEボット サーバー起動
========================================
🚀 Server is running on port 3000
📍 Webhook URL: http://localhost:3000/webhook
💚 Health check: http://localhost:3000/health
⏰ Started at: 2026/1/17 23:30:00
========================================
```

### 5.2 ヘルスチェック

**別のターミナルで実行 (またはSSHで別接続):**

```bash
# ヘルスチェックエンドポイント確認
curl http://localhost:3000/health

# 期待される出力:
# {"status":"OK","timestamp":"2026-01-17T14:30:00.000Z"}
```

成功したら `Ctrl + C` でサーバーを停止

---

## 6. 外部公開設定

### オプションA: ngrok使用 (開発・テスト用) 推奨

#### ngrokのインストール

```bash
# ngrokをダウンロード (ARM版)
wget https://bin.equinox.io/c/bNyj1mQVY4c/ngrok-v3-stable-linux-arm.tgz

# 解凍して配置
sudo tar xvzf ngrok-v3-stable-linux-arm.tgz -C /usr/local/bin

# バージョン確認
ngrok version
```

#### ngrok設定

1. https://dashboard.ngrok.com/signup でアカウント作成

2. 認証トークン取得
   - https://dashboard.ngrok.com/get-started/your-authtoken

3. 認証トークン設定

```bash
ngrok config add-authtoken YOUR_NGROK_AUTHTOKEN
```

#### ngrok起動

```bash
# ngrokでポート3000を公開
ngrok http 3000
```

以下のような画面が表示されます:

```
Session Status                online
Account                       sakaguchiiii (Plan: Free)
Version                       3.x.x
Region                        Japan (jp)
Latency                       -
Web Interface                 http://127.0.0.1:4040
Forwarding                    https://xxxx-xx-xx-xx-xx.ngrok-free.app -> http://localhost:3000
```

**重要: `https://xxxx-xx-xx-xx-xx.ngrok-free.app` のURLをコピー**

### オプションB: ポートフォワーディング (本番環境用)

#### ルーター設定

1. ルーター管理画面にアクセス
2. ポートフォワーディング設定:
   - 外部ポート: 3000
   - 内部IP: Raspberry PiのローカルIP
   - 内部ポート: 3000
   - プロトコル: TCP

#### DDNS設定 (固定IPがない場合)

**No-IP (無料):**

```bash
# No-IPクライアントインストール
cd /usr/local/src
sudo wget http://www.noip.com/client/linux/noip-duc-linux.tar.gz
sudo tar xzf noip-duc-linux.tar.gz
cd noip-2.1.9-1
sudo make
sudo make install

# 設定
sudo noip2 -C
# メールアドレス、パスワード、ホスト名を入力

# 自動起動
sudo noip2
```

---

## 7. LINE Webhook設定

### 7.1 LINE Developers Consoleにアクセス

1. https://developers.line.biz/console/ にアクセス
2. プロバイダー選択
3. チャネルID: **2008912313** を選択

### 7.2 Webhook URL設定

1. **Messaging API** タブを選択

2. **Webhook settings** セクション:
   - **Webhook URL** に以下を入力:

**ngrok使用時:**
```
https://xxxx-xx-xx-xx-xx.ngrok-free.app/webhook
```

**本番環境(固定IP/DDNS):**
```
http://your-domain.ddns.net:3000/webhook
```

3. **Update** をクリック

4. **Verify** ボタンをクリック
   - "Success" が表示されればOK
   - エラーの場合はトラブルシューティングを参照

5. **Use webhook** を **有効化**

### 7.3 その他の設定確認

**重要:** 以下の設定を確認・変更:

- ✅ **Auto-reply messages**: 無効
- ✅ **Greeting messages**: 無効
- ✅ **Response mode**: Bot (Chatは無効)
- ✅ **Allow bot to join group chats**: 有効

---

## 8. PM2で自動起動設定

PM2を使用してサーバーを24時間稼働させます。

### 8.1 PM2インストール

```bash
# PM2をグローバルインストール
sudo npm install -g pm2

# バージョン確認
pm2 --version
```

### 8.2 サーバー起動

```bash
# Raspberry Pi上で
cd ~/tatekaezamurai-bot/server

# PM2でサーバー起動
pm2 start dist/index.js --name tatekaezamurai

# ステータス確認
pm2 status

# ログ確認
pm2 logs tatekaezamurai

# リアルタイムログ表示を停止: Ctrl + C
```

### 8.3 自動起動設定

```bash
# Raspberry Pi起動時にPM2を自動起動
pm2 startup

# 表示されたコマンドを実行 (sudo ... から始まるコマンド)
# 例: sudo env PATH=$PATH:/usr/bin /usr/lib/node_modules/pm2/bin/pm2 startup systemd -u pi --hp /home/pi

# 現在のPM2プロセスを保存
pm2 save
```

### 8.4 PM2コマンド一覧

```bash
# ステータス確認
pm2 status

# ログ確認
pm2 logs tatekaezamurai

# 再起動
pm2 restart tatekaezamurai

# 停止
pm2 stop tatekaezamurai

# 削除
pm2 delete tatekaezamurai

# モニタリング
pm2 monit
```

---

## 9. テストとトラブルシューティング

### 9.1 LINEグループでテスト

1. **LINEグループ作成**
   - 友人2-3名を招待

2. **たてかえ侍を友だち追加**
   - LINE公式アカウント検索
   - または QRコード

3. **グループに招待**

4. **テストコマンド実行**

```
ユーザー: 開始
ボット: 🍻 たてかえ侍を開始します！...

ユーザー: 一軒目 14000円
ボット: ✅ 一軒目を記録しました...

ユーザー: 二軒目 8000円
ボット: ✅ 二軒目を記録しました...

ユーザー: 状況
ボット: 📊 現在の状況...

ユーザー: 清算
ボット: 💰 清算結果...
```

### 9.2 トラブルシューティング

#### サーバーが起動しない

```bash
# ログ確認
pm2 logs tatekaezamurai

# 環境変数確認
cat ~/tatekaezamurai-bot/server/.env

# ビルド再実行
cd ~/tatekaezamurai-bot/server
npm run build
pm2 restart tatekaezamurai
```

#### Webhook接続エラー

```bash
# ngrokが起動しているか確認
curl http://localhost:4040/api/tunnels

# サーバーが起動しているか確認
curl http://localhost:3000/health

# ポート確認
sudo netstat -tulpn | grep 3000

# ファイアウォール確認
sudo ufw status
```

#### LINEボットが反応しない

1. **LINE Webhook設定確認**
   - Use webhookが有効か
   - Auto-replyが無効か
   - Webhook URLが正しいか

2. **サーバーログ確認**
   ```bash
   pm2 logs tatekaezamurai --lines 100
   ```

3. **ngrok接続確認**
   - http://localhost:4040 でngrokダッシュボード確認
   - リクエストが届いているか確認

#### データが保存されない

```bash
# データファイル確認
cat ~/tatekaezamurai-bot/server/dist/data/sessions.json

# ディレクトリ権限確認
ls -la ~/tatekaezamurai-bot/server/dist/data/

# 権限修正 (必要な場合)
chmod 755 ~/tatekaezamurai-bot/server/dist/data/
```

---

## 10. 運用・メンテナンス

### 10.1 ログ管理

```bash
# リアルタイムログ表示
pm2 logs tatekaezamurai

# 最新100行表示
pm2 logs tatekaezamurai --lines 100

# エラーのみ表示
pm2 logs tatekaezamurai --err

# ログファイルクリア
pm2 flush
```

### 10.2 データバックアップ

**自動バックアップ（既に実装済み）:**
- 1日1回自動バックアップ
- 場所: `dist/data/backups/`
- 7日以上古いバックアップは自動削除

**手動バックアップ:**

```bash
# データファイルをバックアップ
cp ~/tatekaezamurai-bot/server/dist/data/sessions.json ~/backups/sessions_$(date +%Y%m%d).json

# 定期バックアップ設定 (cron)
crontab -e

# 以下を追加 (毎日午前3時にバックアップ)
0 3 * * * cp ~/tatekaezamurai-bot/server/dist/data/sessions.json ~/backups/sessions_$(date +\%Y\%m\%d).json
```

### 10.3 アップデート手順

```bash
# サーバー停止
pm2 stop tatekaezamurai

# 最新コードを取得
cd ~/tatekaezamurai-bot
git pull origin main

# 依存パッケージ更新
cd server
npm install

# ビルド
npm run build

# サーバー再起動
pm2 restart tatekaezamurai

# ログ確認
pm2 logs tatekaezamurai
```

### 10.4 セキュリティ設定

#### ファイアウォール設定

```bash
# ufwインストール (未インストールの場合)
sudo apt-get install ufw

# SSH許可
sudo ufw allow 22

# カスタムポート許可 (ポートフォワーディング使用時)
sudo ufw allow 3000

# 有効化
sudo ufw enable

# ステータス確認
sudo ufw status
```

#### 定期的なシステムアップデート

```bash
# 週1回実行推奨
sudo apt-get update && sudo apt-get upgrade -y

# 不要なパッケージ削除
sudo apt-get autoremove -y
```

### 10.5 モニタリング

#### リソース使用状況確認

```bash
# CPU/メモリ使用率
htop

# ディスク使用率
df -h

# PM2モニタリング
pm2 monit
```

#### アラート設定 (オプション)

**Uptime Robotで死活監視 (無料):**

1. https://uptimerobot.com/ でアカウント作成
2. New Monitor:
   - Monitor Type: HTTP(s)
   - Friendly Name: たてかえ侍
   - URL: https://your-ngrok-url.ngrok-free.app/health
   - Monitoring Interval: 5 minutes

---

## 11. コスト試算

### 運用コスト (月額)

| 項目 | 費用 |
|------|------|
| Raspberry Pi 電気代 | 約100円 |
| インターネット回線 | (既存) |
| ngrok (無料プラン) | 0円 |
| LINE Messaging API | 0円 |
| **合計** | **約100円/月** |

### 初期費用

| 項目 | 費用 |
|------|------|
| Raspberry Pi 4B (4GB) | 約8,000円 |
| microSDカード (32GB) | 約1,000円 |
| 電源アダプター | 約1,500円 |
| ケース | 約1,000円 |
| **合計** | **約11,500円** |

→ **Firebase Functionsと比較して、2ヶ月で元が取れます！**

---

## 12. よくある質問 (FAQ)

### Q1: ngrokの無料プランで制限はありますか？

A: はい、以下の制限があります:
- セッションタイムアウト: 8時間
- 同時接続数: 1つまで
- カスタムドメイン: 不可

**対策:** 8時間ごとにngrokを再起動するか、有料プラン($8/月)に升級

### Q2: Raspberry Piが再起動したらどうなりますか？

A: PM2の自動起動設定をしているため、自動的にサーバーが起動します。
ただし、ngrokは手動で再起動が必要です。

### Q3: データが消えることはありますか？

A: JSONファイルに保存しており、自動バックアップも実装済みです。
ただし、定期的な手動バックアップも推奨します。

### Q4: 複数のLINEグループで使えますか？

A: はい、同じボットを複数のグループに招待できます。
各グループのデータは独立して管理されます。

### Q5: スマホのテザリングでも動きますか？

A: はい、動作しますが通信量に注意してください。
Webhookのトラフィックは軽量です（1リクエスト数KB程度）。

---

## 13. まとめ

✅ **完了チェックリスト**

- [ ] Raspberry Pi OSインストール完了
- [ ] Node.js環境構築完了
- [ ] プロジェクトクローン完了
- [ ] 環境変数設定完了
- [ ] ビルド成功
- [ ] サーバー起動確認
- [ ] ngrok設定完了
- [ ] LINE Webhook設定完了
- [ ] PM2自動起動設定完了
- [ ] LINEグループでテスト成功

---

## 14. サポート・問い合わせ

### 問題が発生した場合

1. **ログ確認**
   ```bash
   pm2 logs tatekaezamurai --lines 50
   ```

2. **GitHubでIssue作成**
   - https://github.com/sakaguchiiii/tatekaezamurai-bot/issues

3. **ドキュメント再確認**
   - このガイドを最初から見直す

---

**🎉 お疲れ様でした！**

これで、完全無料で24時間稼働するたてかえ侍 LINEボットが完成しました。
楽しい飲み会ライフをお楽しみください！🍻
