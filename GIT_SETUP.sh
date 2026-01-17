#!/bin/bash

# たてかえ侍 GitHub セットアップスクリプト

echo "🚀 たてかえ侍 GitHubセットアップを開始します"

# プロジェクトルートに移動
cd /Users/sakaguchitsubasa/claude-code-test/260117_play/terminal1/tatekaezamurai-bot

# Git初期化（既に初期化済みの場合はスキップ）
if [ ! -d .git ]; then
  git init
  echo "✅ Git初期化完了"
fi

# .gitignoreファイルの確認・作成
if [ ! -f .gitignore ]; then
  cat > .gitignore << 'EOF'
# Node modules
node_modules/
functions/node_modules/
server/node_modules/

# Environment variables
.env
.env.local
functions/.env
server/.env

# Build output
dist/
lib/
functions/lib/
server/dist/

# Data files (JSONストレージ)
server/src/data/sessions.json
server/src/data/*.json

# Logs
*.log
npm-debug.log*
logs/

# Firebase
.firebase/
.firebaserc
firebase-debug.log
firestore-debug.log
ui-debug.log

# Service account keys
serviceAccountKey.json
*-firebase-adminsdk-*.json

# OS files
.DS_Store
Thumbs.db

# IDE
.vscode/
.idea/
*.swp
*.swo
EOF
  echo "✅ .gitignore作成完了"
fi

# README.md作成
cat > README.md << 'EOF'
# たてかえ侍 (Tatekaezamurai)

飲み会の立替精算を自動化するLINEボット

## 概要

「飲み会で立て替えたけど、催促しづらくて泣き寝入り...」
そんな問題を解決するLINEボットです。

## 主な機能

- 💰 支払い記録の自動管理
- 🧮 割り勘計算の自動化
- 📊 精算結果の自動表示
- 🔗 PayPay/LINE Pay送金リンク生成
- ⏰ リマインダー機能（開発中）

## 技術スタック

- **Backend**: Node.js + Express + TypeScript
- **LINE SDK**: @line/bot-sdk
- **Storage**: JSONファイル (完全無料)
- **Deploy**: Raspberry Pi対応

## セットアップ

詳細は [RASPBERRY_PI_DEPLOY.md](./RASPBERRY_PI_DEPLOY.md) を参照

### クイックスタート

\`\`\`bash
# リポジトリクローン
git clone https://github.com/sakaguchiiii/tatekaezamurai-bot.git
cd tatekaezamurai-bot/server

# 依存パッケージインストール
npm install

# 環境変数設定
cp .env.example .env
# .envファイルを編集してLINE認証情報を設定

# ビルド
npm run build

# 起動
npm start
\`\`\`

## 使い方

1. LINEグループにたてかえ侍を招待
2. 「開始」と送信
3. 「一軒目 14000円」のように支払いを記録
4. 「清算」で精算結果を表示

### コマンド一覧

- `開始` - セッション開始
- `一軒目 XXXX円` - 支払い記録
- `清算` - 精算結果表示
- `状況` - 現在の記録確認
- `キャンセル` - 最後の記録削除
- `終了` - セッション終了
- `ヘルプ` - 使い方表示

## ライセンス

MIT

## 作者

[@sakaguchiiii](https://github.com/sakaguchiiii)
EOF
echo "✅ README.md作成完了"

# .env.exampleファイル作成（環境変数のテンプレート）
cat > server/.env.example << 'EOF'
LINE_CHANNEL_SECRET=your_channel_secret_here
LINE_CHANNEL_ACCESS_TOKEN=your_channel_access_token_here
PORT=3000
EOF
echo "✅ .env.example作成完了"

# データディレクトリの.gitkeep作成（空ディレクトリをGitで管理）
mkdir -p server/src/data
touch server/src/data/.gitkeep
echo "✅ データディレクトリ準備完了"

# Gitに追加
git add .
git status

echo ""
echo "✅ セットアップ完了！"
echo ""
echo "次のステップ:"
echo "1. GitHubでリポジトリ作成: https://github.com/new"
echo "   Repository name: tatekaezamurai-bot"
echo ""
echo "2. 以下のコマンドを実行:"
echo "   git commit -m \"Initial commit: たてかえ侍 LINEボット\""
echo "   git branch -M main"
echo "   git remote add origin https://github.com/sakaguchiiii/tatekaezamurai-bot.git"
echo "   git push -u origin main"
echo ""
EOF
