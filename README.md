# 清算くん（たてかえ侍bot）

飲み会などのグループでの立替金の精算を自動化するLINEボット

<div align="center">

🍻 **グループの割り勘を簡単に！** 🍻

</div>

---

## 📖 ドキュメント

| ドキュメント | 説明 |
|------------|------|
| **[現在の仕様_v260119.md](現在の仕様_v260119.md)** | 現在の仕様を詳しく解説 |
| **[運用手順書_v260119.md](運用手順書_v260119.md)** | 修正からデプロイまでの手順 |
| **[修正履歴_v260118.md](修正履歴_v260118.md)** | これまでの修正履歴 |
| **[Raspberry Pi初期設定手順.md](Raspberry%20Pi初期設定手順.md)** | ラズパイの初期設定手順 |
| **[Raspberry Piデプロイ手順.md](Raspberry%20Piデプロイ手順.md)** | ラズパイへのデプロイ手順 |

---

## 🚀 クイックスタート

### 1. グループに追加

LINEグループに「清算くん」を追加

### 2. セッション開始

```
開始
```

### 3. 全員が参加登録

```
参加
```

### 4. 支払いを記録

```
一軒目 5000
ラーメン 500
タクシー 3000
```

### 5. 精算結果を表示

```
清算
```

### 6. 終了

```
終了
```

---

## 💡 主な機能

- ✅ **簡単な操作**: 「開始」「参加」「清算」だけ
- ✅ **柔軟な入力**: 任意のラベル名、カンマ区切り対応
- ✅ **正確な計算**: 誤差ゼロの精算
- ✅ **最適な送金**: 最小の送金回数で精算完了
- ✅ **シンプルなUI**: LINEに最適化された短いメッセージ

---

## 🛠 技術スタック

- **バックエンド**: Node.js + TypeScript + Express
- **LINE SDK**: @line/bot-sdk v9
- **ストレージ**: JSON ファイル
- **デプロイ**: Raspberry Pi + ngrok
- **プロセス管理**: pm2

---

## 📋 コマンド一覧

| コマンド | 説明 |
|---------|------|
| `開始` | セッションを開始 |
| `参加` | 参加者として登録 |
| `一軒目 5000` | 支払いを記録 |
| `清算` | 精算結果を表示 |
| `状況` | 現在の記録を確認 |
| `キャンセル` | 最後の記録を削除 |
| `終了` | セッションを終了 |
| `ヘルプ` | ヘルプを表示 |

---

## 📂 プロジェクト構成

```
tatekaezamurai-bot/
├── README.md                           # プロジェクト概要
├── 現在の仕様_v260119.md               # 詳細な仕様書
├── 運用手順書_v260119.md               # 運用手順
├── 修正履歴_v260118.md                 # 修正履歴
├── Raspberry Pi初期設定手順.md         # ラズパイ初期設定
├── Raspberry Piデプロイ手順.md         # ラズパイデプロイ
├── .gitignore                          # Git除外設定
├── server/                             # メインアプリケーション
│   ├── src/
│   │   ├── index.ts                    # エントリーポイント
│   │   ├── handlers/
│   │   │   └── commandHandler.ts       # コマンド処理
│   │   ├── services/
│   │   │   └── storageService.ts       # データ保存
│   │   ├── utils/
│   │   │   ├── calculator.ts           # 計算ロジック
│   │   │   ├── formatter.ts            # メッセージフォーマット
│   │   │   └── parser.ts               # コマンドパース
│   │   ├── types/
│   │   │   └── index.ts                # 型定義
│   │   └── data/                       # JSONデータ保存先
│   ├── dist/                           # ビルド後のJS
│   ├── package.json
│   ├── tsconfig.json
│   └── .env                            # 環境変数
└── scripts/                            # ユーティリティスクリプト
    └── 初回Git設定.sh                  # Git初期設定
```

---

## 🔧 セットアップ

### 環境変数

`.env` ファイルを作成:

```env
LINE_CHANNEL_SECRET=your_channel_secret_here
LINE_CHANNEL_ACCESS_TOKEN=your_channel_access_token_here
PORT=3000
```

### インストール

```bash
cd server
npm install
npm run build
```

### 起動

```bash
npm start
```

詳細は [運用手順書_v260119.md](運用手順書_v260119.md) を参照してください。

---

## 📝 ライセンス

MIT License

---

## 👤 作成者

Created with ❤️ by Claude Code

---

## 🔗 リンク

- [LINE Developers](https://developers.line.biz/)
- [LINE Bot SDK](https://github.com/line/line-bot-sdk-nodejs)

---

**最終更新:** 2026年1月19日
