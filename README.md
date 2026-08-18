# 精算機補助

駐車場での駐車証明発行・精算記録を、スマホで素早く残すためのローカル保存型Webアプリです。

## 起動方法

必要なものは Node.js 18 以上です。

```bash
npm install
npm run dev
```

表示されたURL（通常は `http://localhost:5173`）をブラウザで開きます。

本番ビルドの確認は以下です。

```bash
npm run build
npm run preview
```

## 使い方

1. 「記録」画面で駐車位置番号をタップします。タップ時刻を駐車開始時刻としてタイマーが始まります。
2. 証明書を発行したら「証明書発行」をタップします。経過秒数と発行時刻が確定します。
3. 「発行済み・精算待ち」画面で該当レコードの「精算」をタップします。精算時刻が確定します。
4. 例外がある場合は各レコードの「メモ」から定型メモを選択するか、自由メモを入力します。
5. 「履歴」画面の「LINE用テキストを生成」から駐車記録の報告文を作成し、「コピー」でクリップボードへコピーできます。
6. 「勤務報告」画面で、杉栄店・名東本通店への到着、再起動、水曜・土曜の復旧結果、10:00開始・12:00休憩・15:00再開・18:00終了を記録できます。勤務報告もLINE用に生成・コピーできます。

90秒を超えて証明書を発行した記録は、通常の記録と区別して「90秒超」と表示されます。

## ファイル構成

```text
.
├── index.html                 # エントリHTML、PWAメタ情報
├── capacitor.config.ts        # Androidアプリ化用のCapacitor設定
├── package.json               # Vite / Reactの依存関係とスクリプト
├── android/                   # Capacitorが生成するAndroid Studioプロジェクト
├── public/
│   ├── icon.svg               # アプリアイコン
│   ├── manifest.webmanifest   # PWAマニフェスト
│   └── sw.js                  # 最小構成のService Worker
└── src/
    ├── main.jsx               # 画面、駐車記録・勤務報告、localStorage、各操作
    └── styles.css             # モバイル優先のUIスタイル
```

Android版では、アプリ更新時に古いWebViewのService Workerキャッシュを削除してから新しい画面を読み込みます。記録本体のlocalStorageは削除しません。

## Android APK化

このプロジェクトはCapacitorでAndroidアプリとしてパッケージできます。Android Studio、Android SDK、JDKがインストール済みの環境で実行してください。

### デバッグAPKを作る

macOSでAndroid Studio付属のJDKを使う場合は、必要に応じて先に環境変数を設定します。

```bash
export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
export ANDROID_HOME="$HOME/Library/Android/sdk"
export ANDROID_SDK_ROOT="$ANDROID_HOME"
```

その後、以下を実行します。

```bash
npm install
npm run android:debug
```

生成物は以下です。

```text
android/app/build/outputs/apk/debug/app-debug.apk
```

Android端末へUSB接続してインストールする場合は、USBデバッグを有効にしてから以下を実行できます。

```bash
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
```

### Android Studioで開く

```bash
npx cap open android
```

### Playストア用AAB

署名設定を用意したうえで、以下を実行します。

```bash
npm run android:release
```

生成物は `android/app/build/outputs/bundle/release/app-release.aab` です。公開用にはAndroid StudioまたはGradleでリリース署名を設定してください。署名鍵はリポジトリやREADMEへ保存しないでください。

Capacitor版でも記録データはWebView内のlocalStorageに保存されます。既存のPWA版と同じく端末内保存で、アプリ削除・アプリデータ削除を行うと消える点に注意してください。

## データ保存方法

バックエンドは使用していません。記録はブラウザの `localStorage` に、日付ごとに以下のキーで保存します。

```text
parking-assist-records:YYYY-MM-DD
parking-assist-work:YYYY-MM-DD
```

ページを再読み込みしたりブラウザを閉じたりしても、同じ端末・同じブラウザの保存領域が残っている限り当日の記録を復元できます。ブラウザのサイトデータを削除した場合や別端末では共有されません。

## PWAとしてホーム画面に追加する方法

PWAとして使うには、スマホからアクセスできるHTTPSのURLで配信する必要があります。開発中の `localhost` は同じ端末上での確認に使えます。

- iPhone（Safari）: ページを開く → 共有ボタン → 「ホーム画面に追加」 → 追加
- Android（Chrome）: ページを開く → 右上メニュー → 「ホーム画面に追加」または「アプリをインストール」

公開時は `manifest.webmanifest` と `sw.js` を同じドメインで配信してください。Service Workerが登録されると、アプリシェルをキャッシュして通信が一時的に不安定でも画面を開きやすくなります。

## 今後Supabaseなどへ移行する場合の拡張ポイント

- `records` の読み書きを担当する処理を `src/main.jsx` からリポジトリ層へ切り出し、`loadRecords` / `localStorage.setItem` をSupabaseのテーブル操作へ置き換える
- `records` テーブルに `id`, `work_date`, `spot`, `started_at`, `issued_at`, `settled_at`, `status`, `note_presets`, `memo` を持たせる
- 複数スタッフで使う場合はユーザーID・担当者ID・駐車場IDを追加し、Row Level Securityで閲覧範囲を制御する
- 通信が切れた現場向けには、localStorageまたはIndexedDBを一時キューとして残し、通信復旧時に同期する
- LINE送信用テキストは現在クライアントで生成しているため、そのまま継続利用できる。報告履歴を保存する場合だけサーバー側の生成・保存を追加する
