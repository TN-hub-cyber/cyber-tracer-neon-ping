# CyberTracer // NEON-PING

> ネットワークの遅延を、快感に変える。

`traceroute` の経路を3D空間に再構築し、データが世界を駆け巡る様子をサイバーパンクな映像で体験するネットワーク診断ツールです。

![License: ISC](https://img.shields.io/badge/license-ISC-cyan)
![Node.js](https://img.shields.io/badge/Node.js-18%2B-green)
![Tests](https://img.shields.io/badge/tests-41%20passing-brightgreen)

---

## 概要

| レイヤー | 技術 | 役割 |
|---------|------|------|
| **Engine** | Node.js | `traceroute` を子プロセスで実行・パース |
| **Nerve** | Socket.IO | IPとレイテンシをリアルタイムに転送 |
| **Visual** | Three.js | 3D空間へのノード生成・ネオンエフェクト |

---

## 機能

- **3Dネットワーク・トポロジー** — 各ホップをワイヤーフレーム球体で表示
- **レイテンシ別カラーリング** — 緑（高速）→ 黄 → 赤（遅延）でリンクを色分け
- **パルスアニメーション** — ライン上を移動する光の粒子（パケットのメタファー）
- **UnrealBloomPass** — 全要素にネオン発光エフェクト
- **デジタルグリッド床** — サイバーパンクな空間演出
- **グリッチエフェクト** — タイムアウト発生時に画面が一瞬乱れる
- **インテリジェント・カメラ** — トレース中は新ノードへ追跡、完了後はシネマティック周回
- **HUD** — ターゲットIP・平均レイテンシ・パケットロス率をリアルタイム表示
- **コンソールオーバーレイ** — 生の `traceroute` 出力をレトログリーンで表示

---

## セットアップ

### 前提条件

- Node.js 18 以上
- `traceroute` コマンド

```bash
# WSL / Ubuntu / Debian
sudo apt install traceroute

# macOS
brew install traceroute
```

### インストールと起動

```bash
git clone https://github.com/TN-hub-cyber/cyber-tracer-neon-ping.git
cd cyber-tracer-neon-ping
npm install
node server.js
```

ブラウザで **http://localhost:3000** を開きます。

### サーバーの停止

ターミナルで `Ctrl + C` を押すと停止します。

バックグラウンドで起動している場合:

```bash
# プロセスIDを確認して停止
pkill -f "node server.js"
```

### ポートを変更する場合

```bash
PORT=8080 node server.js
```

---

## 使い方

1. 入力欄にホスト名または IP アドレスを入力（例: `8.8.8.8`、`google.com`）
2. **TRACE** ボタンをクリック（または Enter キー）
3. 各ホップがリアルタイムに3D空間へ描画されます
4. トレース完了後、カメラが自動的にシネマティック周回モードに移行
5. **CANCEL** で進行中のトレースを中断できます

---

## 開発

```bash
# テスト実行
npm test

# テストをウォッチモードで実行
npx vitest
```

詳細は [docs/CONTRIB.md](docs/CONTRIB.md) を参照してください。

---

## トラブルシューティング

よくある問題の解決方法は [docs/RUNBOOK.md](docs/RUNBOOK.md) を参照してください。

---

## セキュリティ

- 入力は allowlist regex で厳格にバリデーション（コマンドインジェクション防止）
- `spawn()` を args 配列渡しで使用（シェルを介さない安全な子プロセス起動）
- Socket.IO は `localhost` オリジンのみ許可（CSWSH 対策）
- IP アドレス単位のレート制限（2秒クールダウン）

---

## ライセンス

ISC

---

> **Note:** 本ツールは「実用性」よりも「自己満足」と「ロマン」を優先します。画面が光りすぎて目が疲れる場合は、適宜サングラスを着用してください。
