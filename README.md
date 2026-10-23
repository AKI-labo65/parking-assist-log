# 精算機補助

駐車場での駐車証明発行・精算記録を、スマホで素早く残すためのローカル保存型Webアプリです。

## 起動方法

必要なものは Node.js 20.19以上、または22.12以上です（Vite 8の動作要件）。

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

自動テストは以下で実行します。

```bash
npm test
```

## テスト版と本番への反映

チュートリアルの確認用URL:

https://aki-labo65.github.io/parking-assist-log-preview/

本番URLは従来どおり https://aki-labo65.github.io/parking-assist-log/ です。テスト版の公開先は別リポジトリ `AKI-labo65/parking-assist-log-preview`。本番のファイルを上書きせず、保存キーも `parking-assist-preview-*` に分けています。本番の既存の保存キーは変えていません。テスト用データを本番にコピーする処理はありません。

```bash
# ローカルでテスト版を起動（スマホから同じWi-Fiで接続できます）
npm run dev:preview

# テスト版のビルドだけを確認
npm run build:preview

# 変更をコミットした後、同じ内容をテスト用URLへ公開
npm run deploy:preview
```

`deploy:preview` はテスト成功後にプレビュー用ビルドを一時ディレクトリに生成し、上記のテスト専用リポジトリの `gh-pages` に公開します。GitとGitHub CLIの認証が必要です。認証情報はコードやノートに保存しません。未コミットの変更がある場合は公開を止めます。公開済みソースのコミットはテストURLの `deployment.json` で確認できます。テスト版ではService Workerを登録せず、更新時の古い画面の混入を避けています。

確認する順番:

1. 店舗を選択し「使い方を見てみる」を開く。
2. 番号あり／未入力の開始、番号の確認・修正、精算、90秒以内／90秒超の報告例を試す。
3. 「戻る」「スキップ」「×」、再読込後の非表示、右上「？」からの再表示を確認する。
4. 既にタイマーが動いている場合も、ガイドを試して元の記録が変わらないことを確認する。
5. 内容が承認されたら、**テスト済みのソースのPRを `main` にマージ**する。テスト・ビルド成功後に本番へ配信される。

本番配信ワークフローは `main` のみを対象にしています。作業ブランチへのpushやPR作成では本番に配信されません。公開直前にテストURLのコミットとPRの先頭コミットを照合し、変更が入った場合はテスト版を更新して再確認します。戻す場合は本番反映のPRをrevertし、同じテスト・配信手順で前の内容へ戻せます。既存の駐車記録を削除する必要はありません。

### 使い方ガイド

初めて店舗を選んだとき、記録がまだなければ任意のガイドを案内します。すでに対応中の記録がある場合は自動で割り込みません。ガイド内の車両・経過時間・報告文はサンプルで、端末の駐車記録・勤務報告・通知・クリップボードには書き込みません。コピーやLINE送信も実行しません。完了またはスキップの状態だけを保存し、右上の「？」からいつでも最初から見直せます。

## 使い方

1. 起動時に「名東本通店」または「杉栄店」を選択します。選択した店舗がその日の稼働店舗として端末内に保存され、ヘッダーと駐車記録のLINE報告に反映されます。
2. 「記録」画面で駐車位置番号をタップします。タップ時刻を駐車開始時刻としてタイマーが始まります。番号が見えないときは「番号未入力でタイマー開始」を押します。
3. 証明書を発行したら「証明書発行＋番号入力」をタップします。駐車位置番号の確認シートが開くので、利用者さまから聞いた番号を入力（または1〜21の候補をタップ）してから発行を確定します。開始時の番号が違っていても、この時点で修正できます。
4. 「発行済み・精算待ち」画面で該当レコードの「精算」をタップします。精算時刻が確定します。
5. 例外がある場合は各レコードの「メモ」から定型メモを選択するか、自由メモを入力します。
6. 精算ボタンを押すと、その時点で履歴へ移動します。続けて「報告設定」から、通常・入店時証明書未発行・発行不具合・入店時誤操作・未発行＋サービス券・自由入力を選択できます。
7. 90秒以内の記録は18:00の「勤務終了」を記録した後、履歴の「まとめて報告文を生成」から全件をまとめて報告します。コピーすると対象記録が報告済みになります。90秒を超えた記録は精算後に各カードの「都度報告」から1件ずつ生成・コピーします。発行不具合や誤操作を選んだ記録は、例の報告形式で出力されます。
8. 「勤務報告」画面で、2店舗への到着、再起動、水曜・日曜の復旧結果、土曜は初期点検8秒以上の場合だけ再起動の復旧結果、10:00開始・12:00休憩・15:00再開・18:00終了を記録できます。店舗名は画面右上の設定から端末内だけに保存できます。勤務報告もLINE用に生成・コピーできます。

スマホでは開始後に「記録」「発行済み・精算待ち」「履歴」を画面下の固定タブから切り替えます。使用頻度の低い「勤務報告」は、画面上部の日付欄にある小さなリンクから開けます。PCでは従来どおり上部の4タブを使用します。駐車番号ボタンは店舗ごとの実際の配置に合わせて切り替わります。名東本通店は左側1〜8番・右側21〜9番、杉栄店は左側15・14・13・12・10・9・8・7番、下側6・5・4・3・2・1番、中央16・17・18・19・20番、右側21・23番の配置です。開始後のヘッダーに表示される店舗名をタップすると、その日の店舗を変更できます。

記録中・発行済み・履歴の各画面にある「編集」「削除」は同じ記録データへ反映されます。記録中・発行済みの番号を変更すると、表示・精算待ち一覧・履歴・LINE用テキストにも反映されます。記録画面の「待ち」「対応中」になっている駐車位置番号をタップすると、その記録の詳細編集ポップアップを開けます。履歴ではLINE報告パターン、報告済み時刻も同じ記録へ保存されます。90秒以内の報告は勤務終了後の一括、90秒超の報告は都度報告として分けています。記録を削除すると表示中の生成済みLINE文面もクリアされ、残った記録で再生成できます。削除は確認ダイアログ付きです。

履歴画面の「履歴を全件削除」は、当日の精算済み履歴だけをまとめて削除します。駐車中・精算待ちの記録は残り、実行前に画面内の確認ポップアップが表示されます。

90秒を超えて証明書を発行した記録は、通常の記録と区別して「90秒超」と表示されます。

### 駐車番号が見えない場合

駐車位置番号が確認できない場合でも、タイマーは止めずに「番号未入力でタイマー開始」を押します。タイマー動作中は「番号未入力 #1」のように表示されるため、複数台を同時に追えます。証明書発行時に利用者さまへ番号を確認して入力すると、その確定番号が発行済み一覧・履歴・LINE報告へ反映されます。通常は番号入力が必須で、どうしても分からない場合だけ「番号不明のまま発行（例外）」を使います。

番号は1〜21以外にも入力できるため、区画の枝番などにも対応できます。過去の記録は従来どおり表示されます。

## ファイル構成

```text
.
├── index.html                 # エントリHTML、PWAメタ情報
├── capacitor.config.ts        # Android/iOSアプリ化用のCapacitor設定
├── package.json               # Vite / Reactの依存関係とスクリプト
├── android/                   # Capacitorが生成するAndroid Studioプロジェクト
├── ios/                       # Capacitor iOSプロジェクトとLive Activity用Widget Extension
├── public/
│   ├── icon.svg               # アプリアイコン
│   ├── manifest.webmanifest   # PWAマニフェスト
│   └── sw.js                  # 最小構成のService Worker
└── src/
    ├── main.jsx               # 画面、駐車記録・番号確定・勤務報告、localStorage、各操作
    ├── main.test.jsx          # 記録・報告文・日付切替の回帰テスト
    └── styles.css             # モバイル優先のUIスタイル
```

Android版では、アプリ更新時に古いWebViewのService Workerキャッシュを削除してから新しい画面を読み込みます。記録本体のlocalStorageは削除しません。

## iPhoneアプリとDynamic Island

Safariの「ホーム画面に追加」で使うPWAはそのまま利用できますが、Dynamic Islandには表示できません。Dynamic Island対応版は、Capacitorで同じWeb画面をiOSアプリに組み込み、`ActivityKit`のLive Activityと`WidgetKit`のDynamic Island表示を追加しています。

現在のiOSネイティブ版はiOS 16.1以降を対象にしています。アプリ本体は既存の駐車記録画面をネイティブのCapacitorアプリとして表示し、駐車中・証明書発行済み・精算待ちの状態をLive Activityへ同期します。Dynamic Island対応機種では、駐車位置番号と経過時間をコンパクト表示・展開表示・ロック画面へ表示できます。

```bash
npm install
npm run ios:sync
npm run ios:open
```

Xcodeでは`ios/App/App.xcodeproj`を開き、`App`スキームを実機またはシミュレータへビルドしてください。iOSアプリ側の`ParkingLiveActivityPlugin.swift`がWeb画面の記録状態をLive Activityへ同期し、`ParkingLiveActivityWidget.swift`が駐車中の経過時間・駐車位置番号・証明書発行済み状態を表示します。精算済みになるとLive Activityを終了します。Dynamic Islandの実機確認には、対応するiPhoneとAppleの署名設定が必要です。

この初版は端末内のタイマー表示が目的なので、サーバーやAPNsは使いません。バックエンドから閉じたアプリへ状態を送る必要が出た場合は、ActivityKitのプッシュ更新用APNsを追加します。実機へのインストール・TestFlight配布にはApple Developer Programと署名設定が必要です。

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
android/app/build/outputs/apk/debug/v0.1.23.apk
```

APK名はAndroidの`versionName`から自動生成されます。次回バージョンを`0.1.24`にすると、`v0.1.24.apk`になります。

### Androidのロック画面・システム通知

Android APKでは、駐車中または証明書発行済み・精算待ちの記録がある間、ネイティブの継続通知を表示します。駐車中は通知の経過時間が自動更新され、ロック画面からアプリを開けます。Android 13以降では、初回に通知の許可が必要です。

OPPOのAqua Dynamicsなど、通知を上部のシステム領域へ表示するかどうかはColorOSと端末設定が決めます。アプリ側はAndroidのForeground Service、公開ロック画面通知、継続通知の昇格要求に対応していますが、すべての端末で同じ表示になるわけではありません。端末で「通知を許可」「ロック画面に表示」「通知をフローティング表示」などを有効にしてください。

この機能はAPK版のネイティブ機能です。Safari/Chromeからホーム画面に追加したPWAだけでは、OPPOのシステム領域やロック画面へタイマーを表示できません。

Android端末へUSB接続してインストールする場合は、USBデバッグを有効にしてから以下を実行できます。

```bash
adb install -r android/app/build/outputs/apk/debug/v0.1.23.apk
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

公開版URL（GitHub Pages）:

```text
https://aki-labo65.github.io/parking-assist-log/
```

- iPhone（Safari）: ページを開く → 共有ボタン → 「ホーム画面に追加」 → 追加
- Android（Chrome）: ページを開く → 右上メニュー → 「ホーム画面に追加」または「アプリをインストール」

公開時は `manifest.webmanifest` と `sw.js` を同じドメインで配信してください。Service Workerが登録されると、アプリシェルをキャッシュして通信が一時的に不安定でも画面を開きやすくなります。

## 今後Supabaseなどへ移行する場合の拡張ポイント

- `records` の読み書きを担当する処理を `src/main.jsx` からリポジトリ層へ切り出し、`loadRecords` / `localStorage.setItem` をSupabaseのテーブル操作へ置き換える
- `records` テーブルに `id`, `work_date`, `spot`, `started_at`, `issued_at`, `settled_at`, `exit_completed_at`, `line_reported_at`, `status`, `note_presets`, `memo`, `report_type`, `report_flags`, `report_memo` を持たせる
- 複数スタッフで使う場合はユーザーID・担当者ID・駐車場IDを追加し、Row Level Securityで閲覧範囲を制御する
- 通信が切れた現場向けには、localStorageまたはIndexedDBを一時キューとして残し、通信復旧時に同期する
- LINE送信用テキストは現在クライアントで生成しているため、そのまま継続利用できる。報告履歴を保存する場合だけサーバー側の生成・保存を追加する
