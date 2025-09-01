# PWAアイコン作成ガイド

## 必要なアイコンサイズ

PWAとして正常に動作するには、以下のサイズのアイコンファイルを`images/`フォルダに配置する必要があります：

### 必須アイコン
- `icon-72.png` (72x72px) - Android用
- `icon-96.png` (96x96px) - Android用
- `icon-128.png` (128x128px) - Chrome Web Store用
- `icon-144.png` (144x144px) - Windows用
- `icon-152.png` (152x152px) - iOS用
- `icon-192.png` (192x192px) - Android用（推奨）
- `icon-384.png` (384x384px) - Android用
- `icon-512.png` (512x512px) - Android用（必須）

### アイコン作成方法

1. **元画像の準備**
   - 既存の`images/logo.png`を使用
   - または新しいアイコンデザインを作成

2. **リサイズツールの使用**
   ```bash
   # ImageMagickを使用する場合の例
   convert logo.png -resize 72x72 icon-72.png
   convert logo.png -resize 96x96 icon-96.png
   convert logo.png -resize 128x128 icon-128.png
   convert logo.png -resize 144x144 icon-144.png
   convert logo.png -resize 152x152 icon-152.png
   convert logo.png -resize 192x192 icon-192.png
   convert logo.png -resize 384x384 icon-384.png
   convert logo.png -resize 512x512 icon-512.png
   ```

3. **オンラインツールの使用**
   - [PWA Image Generator](https://www.pwabuilder.com/imageGenerator)
   - [App Icon Generator](https://appicon.co/)
   - [Favicon Generator](https://realfavicongenerator.net/)

### デザインの推奨事項

- **正方形**のデザインにする
- **シンプル**で判読しやすいデザイン
- **高コントラスト**で視認性を確保
- **背景は透明または白**
- **マスク可能デザイン**を考慮（円形にトリミングされても見栄えが良い）

### スクリーンショット（オプション）

より良いPWA体験のために、以下のスクリーンショットも追加できます：
- `screenshot-wide.png` (1280x720px) - デスクトップ用
- `screenshot-narrow.png` (375x812px) - モバイル用

## 現在の状況

アイコンファイルが存在しない場合でも、PWAとしては動作しますが、以下の機能が制限されます：
- インストール時にデフォルトのアイコンが使用される
- アプリストアでの見栄えが悪くなる

## 確認方法

ブラウザの開発者ツールで以下を確認：
1. **Application/PWA** タブでマニフェストの状態
2. **Network** タブでアイコンファイルの読み込み状況
3. **Lighthouse** での PWA監査結果